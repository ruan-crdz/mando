import { clamp, hash } from './random';
import { overall } from './ratings';
import { familiarity, positionNames, roleOf } from './positions';
import { findPlayer } from './npc';
import { bestLineup, stateOf } from './matches';
import {
  formations,
  type Attributes,
  type Career,
  type Formation,
  type Player,
  type Tactic,
  type World,
} from './types';

/** Retrato coletivo de uma escalação, usado no confronto tático. */
export type Profile = {
  /** Velocidade de quem ataca o espaço (centroavantes e pontas). */
  paceAtt: number;
  /** Velocidade da última linha (zagueiros). */
  paceDef: number;
  /** Qualidade do jogo pelos lados (pontas, meias abertos e laterais no apoio). */
  wing: number;
  /** Capacidade dos laterais de defender o corredor. */
  flankDef: number;
  /** Criação por dentro (volantes, meias e meia-atacante). */
  central: number;
  /** Proteção da faixa central (zagueiros e volantes). */
  centralDef: number;
  /** Saída de bola sob pressão. */
  pressRes: number;
  /** Fôlego médio da linha. */
  stamina: number;
  /** Jogadores no meio-campo. */
  mids: number;
  /** Média de overall na função escalada. */
  ovr: number;
};

type Slot = { player: Player; role: string };

const avg = (slots: Slot[], keys: (keyof Attributes)[], fallback = 65) => {
  if (!slots.length) return fallback;
  return (
    slots.reduce(
      (sum, { player }) => sum + keys.reduce((n, k) => n + player.attributes[k], 0) / keys.length,
      0,
    ) / slots.length
  );
};

export function lineupSlots(world: World, ids: string[], formation: Formation): Slot[] {
  return ids.flatMap((id, i) => {
    const player = findPlayer(world, id);
    return player ? [{ player, role: formations[formation][i] || 'CM' }] : [];
  });
}

export function profile(
  career: Career,
  world: World,
  ids: string[],
  formation: Formation,
): Profile {
  const slots = lineupSlots(world, ids, formation);
  const at = (roles: string[]) => slots.filter((s) => roles.includes(s.role));
  // Atleta fora de posição rende como alguém mais fraco naquela faixa do campo.
  const fit = (list: Slot[]) =>
    list.map((s) => {
      const fam = familiarity(s.player, s.role, stateOf(career, s.player.id));
      if (fam >= 85) return s;
      const factor = 0.55 + fam / 220;
      const attributes = Object.fromEntries(
        Object.entries(s.player.attributes).map(([k, v]) => [k, v * factor]),
      ) as Attributes;
      return { ...s, player: { ...s.player, attributes } };
    });
  const forwards = fit(at(['ST', 'LW', 'RW']));
  const wide = fit(at(['LW', 'RW', 'LM', 'RM', 'LB', 'RB']));
  const fullbacks = fit(at(['LB', 'RB']));
  const middle = fit(at(['DM', 'CM', 'AM']));
  const backbone = fit(at(['CB', 'DM']));
  const buildUp = fit(at(['CB', 'DM', 'CM']));
  const outfield = fit(slots.filter((s) => s.role !== 'GK'));
  return {
    paceAtt: avg(forwards, ['pace', 'acceleration']),
    paceDef: avg(fit(at(['CB'])), ['pace', 'acceleration']),
    wing: avg(wide, ['pace', 'dribbling', 'control', 'longPass']),
    flankDef: avg(fullbacks, ['marking', 'tackling', 'pace', 'positioning']),
    central: avg(middle, ['vision', 'shortPass', 'control', 'dribbling']),
    centralDef: avg(backbone, ['marking', 'tackling', 'interception', 'positioning']),
    pressRes: avg(buildUp, ['shortPass', 'control', 'composure']),
    stamina: avg(outfield, ['stamina']),
    mids: formations[formation].filter((r) => ['DM', 'CM', 'AM', 'LM', 'RM'].includes(r)).length,
    ovr:
      slots.reduce((n, s) => n + overall(s.player, s.role, stateOf(career, s.player.id)), 0) /
      Math.max(1, slots.length),
  };
}

/** Calibrado em balance.test.ts: o encaixe certo vale ~0,5 gol de saldo por jogo. */
const EDGE_SCALE = 0.5;
const EDGE_CAP = 0.15;
/**
 * Diferenças típicas da liga (média dos 40 clubes de 2026). Os encaixes comparam com o normal:
 * atacante costuma ser mais rápido que zagueiro, então só a diferença acima disso conta.
 */
const NORM = { speed: 8.6, press: 68, wide: -5.5, inner: 4.3, run: 8.6, stamina: 66 };

export type EdgeNote = { area: 'attack' | 'midfield' | 'defense'; value: number; text: string };
export type Edge = { attack: number; midfield: number; defense: number; notes: EdgeNote[] };

/**
 * Efeito do plano de jogo de um lado contra o outro. Os valores são frações somadas aos
 * multiplicadores de ataque, meio e defesa: acertar o encaixe dá vantagem real em campo.
 */
export function tacticalEdge(
  ours: { tactic: Tactic; profile: Profile },
  theirs: { tactic: Tactic; profile: Profile },
): Edge {
  const edge: Edge = { attack: 0, midfield: 0, defense: 0, notes: [] };
  const add = (area: EdgeNote['area'], value: number, text: string) => {
    value *= EDGE_SCALE;
    edge[area] += value;
    if (Math.abs(value) >= 0.01) edge.notes.push({ area, value, text });
  };
  const o = ours.profile;
  const t = theirs.profile;
  const { pressure, width, tempo, line } = ours.tactic;
  // Linha defensiva x velocidade dos atacantes rivais.
  const speedGap = clamp(t.paceAtt - o.paceDef - NORM.speed, -12, 12);
  const ls = line - 3;
  if (ls > 0) {
    add(
      'defense',
      -ls * speedGap * 0.007,
      speedGap > 0
        ? 'Linha alta contra atacantes mais rápidos que nossos zagueiros: bola nas costas'
        : 'Linha alta bem protegida: nossos zagueiros acompanham a velocidade deles',
    );
    add('midfield', ls * 0.018, 'Linha alta deixa o time compacto no meio');
    if (ls === 2)
      add('defense', -0.03, 'Linha altíssima: qualquer erro vira mano a mano com o goleiro');
  } else if (ls < 0) {
    add(
      'defense',
      -ls * Math.max(0, speedGap) * 0.006,
      'Linha baixa tira o espaço dos atacantes velozes deles',
    );
    add('midfield', ls * 0.02, 'Linha baixa cede o meio-campo');
    add('attack', ls * 0.018, 'Time recuado chega com menos gente ao ataque');
  }
  // Pressão x saída de bola rival.
  const pressEdge = clamp((NORM.press - t.pressRes) / 6, -2, 2);
  const ps = pressure - 3;
  if (ps > 0) {
    add(
      'midfield',
      ps * pressEdge * 0.035,
      pressEdge > 0
        ? 'Pressão alta sufoca uma saída de bola fraca'
        : 'A saída de bola deles é qualificada e escapa da pressão',
    );
    if (pressEdge > 0) add('attack', ps * pressEdge * 0.025, 'Roubadas perto da área rival');
    else add('defense', ps * pressEdge * 0.03, 'Pressão quebrada deixa espaços atrás');
    add('defense', -ps * ps * 0.012, 'Pressão alta deixa espaço nas costas do meio-campo');
    const tired = Math.max(0, NORM.stamina + 4 - o.stamina);
    if (tired > 0)
      add('midfield', -ps * tired * 0.004, 'Elenco com pouco fôlego para sustentar a pressão');
  } else if (ps < 0) {
    add('defense', -ps * 0.012, 'Bloco médio-baixo protege a área');
    add(
      'midfield',
      ps * (pressEdge > 0 ? 0.035 : 0.012),
      pressEdge > 0
        ? 'Deixamos jogar um time que sofre quando é pressionado'
        : 'Sem pressão, eles trocam passes com tranquilidade',
    );
  }
  // Largura x laterais rivais / jogo por dentro x proteção central.
  const wideEdge = clamp((o.wing - t.flankDef - NORM.wide) / 6, -2, 2);
  const innerEdge = clamp((o.central - t.centralDef - NORM.inner) / 6, -2, 2);
  const ws = width - 3;
  if (ws === 2) add('midfield', -0.03, 'Time muito espaçado perde compactação');
  if (ws === -2) add('defense', -0.03, 'Campo estreito: as viradas de jogo deles nos pegam');
  if (ws > 0)
    add(
      'attack',
      ws * wideEdge * 0.045,
      wideEdge > 0
        ? 'Jogo aberto explora laterais fracos na marcação'
        : 'Os laterais deles seguram bem nossos pontas',
    );
  else if (ws < 0)
    add(
      'attack',
      -ws * innerEdge * 0.045,
      innerEdge > 0
        ? 'Jogo por dentro aproveita a faixa central frágil deles'
        : 'O miolo deles é forte: o jogo por dentro emperra',
    );
  // Ritmo x velocidade.
  const runEdge = clamp((o.paceAtt - t.paceDef - NORM.run) / 6, -2, 2);
  const ts = tempo - 3;
  if (ts > 0) {
    add(
      'attack',
      ts * runEdge * 0.04,
      runEdge > 0
        ? 'Ritmo alto: nossos atacantes ganham na corrida'
        : 'Ritmo alto sem velocidade para isso: muitas bolas perdidas',
    );
    add('midfield', -ts * ts * 0.015, 'Jogo vertical perde a posse com mais frequência');
  } else if (ts < 0) {
    const touch = clamp((o.central - t.central) / 6, -2, 2);
    add(
      'midfield',
      -ts * touch * 0.03,
      touch > 0
        ? 'Jogo cadenciado: nosso meio troca passes melhor que o deles'
        : 'Cadenciar contra um meio mais técnico entrega a bola',
    );
    add('attack', ts * 0.012, 'Jogo cadenciado finaliza menos');
  }
  // Superioridade numérica no meio.
  const extra = o.mids - t.mids;
  if (extra)
    add(
      'midfield',
      extra * 0.025,
      extra > 0 ? 'Superioridade numérica no meio-campo' : 'Inferioridade numérica no meio-campo',
    );
  edge.attack = clamp(edge.attack, -EDGE_CAP, EDGE_CAP);
  edge.midfield = clamp(edge.midfield, -EDGE_CAP, EDGE_CAP);
  edge.defense = clamp(edge.defense, -EDGE_CAP, EDGE_CAP);
  return edge;
}

const formationCache = new Map<string, Formation>();

/** Postura conforme a diferença de força para o adversário. */
export function adjustMentality(tactic: Tactic, gap: number): Tactic {
  const next = {
    ...tactic,
    mentality: gap >= 4 ? 'Ofensiva' : gap <= -4 ? 'Defensiva' : 'Equilibrada',
  } as Tactic;
  if (gap <= -6) next.line = Math.min(next.line, 2);
  return next;
}

/** Plano de jogo dos clubes da engine, coerente com o elenco de cada um. */
export function npcTactic(
  career: Career,
  world: World,
  clubId: string,
  opponentOvr?: number,
): { tactic: Tactic; lineup: string[]; ovr: number } {
  // O desenho é a identidade do clube na temporada; a escalação muda com lesões e cansaço.
  const key = `${career.id}:${career.season}:${clubId}`;
  let formation = formationCache.get(key);
  if (!formation) {
    let best = -1;
    for (const f of Object.keys(formations) as Formation[]) {
      const lineup = bestLineup(career, world, clubId, f);
      const score =
        profile(career, world, lineup, f).ovr + (hash(`${clubId}:${f}:style`) % 10) * 0.03;
      if (score > best) {
        best = score;
        formation = f;
      }
    }
    formationCache.set(key, formation!);
  }
  const lineup = bestLineup(career, world, clubId, formation!);
  const p = profile(career, world, lineup, formation!);
  const step = (v: number, low: number, high: number) => (v >= high ? 4 : v <= low ? 2 : 3);
  const tactic: Tactic = {
    formation: formation!,
    mentality: 'Equilibrada',
    pressure: step(p.stamina, 64, 74),
    width: p.wing - p.central + 5.6 >= 3 ? 4 : p.wing - p.central + 5.6 <= -3 ? 2 : 3,
    tempo: step(p.paceAtt, 66, 76),
    line: step(p.paceDef, 58, 68),
  };
  return {
    tactic: opponentOvr === undefined ? tactic : adjustMentality(tactic, p.ovr - opponentOvr),
    lineup,
    ovr: p.ovr,
  };
}

/** Saldo de gols esperado por jogo, pela mesma conta que a engine usa minuto a minuto. */
export function expectedBalance(
  ours: { tactic: Tactic; profile: Profile; base: Strength },
  theirs: { tactic: Tactic; profile: Profile; base: Strength },
  home: boolean,
) {
  const a = applyTactic(ours.base, ours.tactic, tacticalEdge(ours, theirs));
  const b = applyTactic(theirs.base, theirs.tactic, tacticalEdge(theirs, ours));
  const share = clamp(
    a.midfield / (a.midfield + b.midfield) +
      (home ? 0.025 : -0.025) +
      (ours.tactic.pressure - theirs.tactic.pressure) * 0.008,
    0.3,
    0.7,
  );
  const chance = (x: typeof a, y: typeof a, tempo: number, h: boolean) =>
    clamp(shotChance(x.attack, y.defense) + (tempo - 3) * 0.012 + (h ? 0.015 : 0), 0.06, 0.45);
  const xg = 90 * 0.175;
  return {
    goalsFor: xg * share * chance(a, b, ours.tactic.tempo, home),
    goalsAgainst: xg * (1 - share) * chance(b, a, theirs.tactic.tempo, !home),
  };
}

export type Strength = { attack: number; midfield: number; defense: number };

/** Chance de finalização por posse; o expoente faz a diferença de qualidade pesar. */
const SHOT_BASE = 0.13;
export const shotChance = (attack: number, defense: number) =>
  SHOT_BASE * Math.pow(attack / defense, 2.2);

export function applyTactic(base: Strength, tactic: Tactic, edge: Edge): Strength {
  const m = tactic.mentality;
  return {
    attack:
      base.attack * (1 + edge.attack + (m === 'Ofensiva' ? 0.06 : m === 'Defensiva' ? -0.06 : 0)),
    midfield: base.midfield * (1 + edge.midfield),
    defense:
      base.defense * (1 + edge.defense + (m === 'Defensiva' ? 0.05 : m === 'Ofensiva' ? -0.05 : 0)),
  };
}

/** Força bruta da escalação por setor (overall na função, fôlego, moral e lesões). */
export function strength(
  career: Career,
  world: World,
  ids: string[],
  formation: Formation,
  spent: Record<string, number> = {},
  injured: string[] = [],
): Strength {
  const slots = lineupSlots(world, ids, formation);
  const score = (roles: string[]) => {
    const values = slots
      .filter(({ role }) => roles.includes(role))
      .map(({ player: p, role }) => {
        const s = stateOf(career, p.id)!;
        const fatigue = clamp(s.fitness - (spent[p.id] || 0), 25, 100) / 100;
        const sharpness = 0.85 + clamp(s.sharpness, 0, 100) * 0.003;
        const rolePositions: Record<string, string[]> = {
          Finalizador: ['ST'],
          Armador: ['AM', 'CM'],
          Pivô: ['ST'],
          Volante: ['DM', 'CM'],
          'Zagueiro construtor': ['CB'],
          'Lateral ofensivo': ['LB', 'RB', 'LW', 'RW'],
        };
        const roleFit =
          s.role === 'Padrão' ? 1 : rolePositions[s.role]?.includes(role) ? 1.04 : 0.96;
        return (
          overall(p, role, s) *
          (0.65 + fatigue * 0.25 + s.morale / 1000) *
          sharpness *
          roleFit *
          (injured.includes(p.id) ? 0.6 : 1)
        );
      });
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 25;
  };
  return {
    attack: score(['ST', 'LW', 'RW', 'AM', 'LM', 'RM']),
    midfield: score(['DM', 'CM', 'AM', 'LM', 'RM']),
    defense: score(['GK', 'CB', 'LB', 'RB', 'DM']),
  };
}

export type Recommendation = {
  tactic: Tactic;
  lineup: string[];
  balance: number;
  current: number;
  notes: EdgeNote[];
};

/** O auxiliar testa todas as combinações e indica a que mais rende contra este rival. */
export function recommendTactic(
  career: Career,
  world: World,
  opponent: { clubId: string; tactic: Tactic; lineup: string[] },
  home: boolean,
): Recommendation {
  const theirs = {
    tactic: opponent.tactic,
    profile: profile(career, world, opponent.lineup, opponent.tactic.formation),
    base: strength(career, world, opponent.lineup, opponent.tactic.formation),
  };
  const evaluate = (tactic: Tactic, lineup: string[], p: Profile, base: Strength) => {
    const r = expectedBalance({ tactic, profile: p, base }, theirs, home);
    return r.goalsFor - r.goalsAgainst;
  };
  const currentProfile = profile(career, world, career.lineup, career.tactic.formation);
  const currentBase = strength(career, world, career.lineup, career.tactic.formation);
  const current = evaluate(career.tactic, career.lineup, currentProfile, currentBase);
  let best: Recommendation | null = null;
  const levels = [1, 2, 3, 4, 5];
  for (const formation of Object.keys(formations) as Formation[]) {
    const keep = formation === career.tactic.formation;
    const lineup = keep ? career.lineup : bestLineup(career, world, career.clubId, formation);
    if (lineup.length < 11) continue;
    const p = profile(career, world, lineup, formation);
    const base = strength(career, world, lineup, formation);
    for (const mentality of ['Defensiva', 'Equilibrada', 'Ofensiva'] as const)
      for (const pressure of levels)
        for (const width of levels)
          for (const tempo of levels)
            for (const line of levels) {
              const tactic: Tactic = { formation, mentality, pressure, width, tempo, line };
              // Trocar o desenho só vale se a vantagem for clara.
              const balance = evaluate(tactic, lineup, p, base) - (keep ? 0 : 0.05);
              if (!best || balance > best.balance)
                best = { tactic, lineup, balance, current, notes: [] };
            }
  }
  const chosen = best!;
  const p = profile(career, world, chosen.lineup, chosen.tactic.formation);
  chosen.notes = tacticalEdge({ tactic: chosen.tactic, profile: p }, theirs)
    .notes.filter((n) => n.value > 0)
    .sort((a, b) => b.value - a.value);
  return chosen;
}

const level = (v: number, names: [string, string, string, string, string]) => names[v - 1];

export function describeTactic(t: Tactic) {
  return [
    `${t.formation}, postura ${t.mentality.toLowerCase()}`,
    level(t.pressure, [
      'pressão bem baixa',
      'pressão baixa',
      'pressão média',
      'pressão alta',
      'pressão sufocante',
    ]),
    level(t.width, [
      'jogo bem centralizado',
      'jogo por dentro',
      'largura equilibrada',
      'jogo pelos lados',
      'campo todo aberto',
    ]),
    level(t.tempo, [
      'ritmo bem cadenciado',
      'ritmo cadenciado',
      'ritmo normal',
      'ritmo rápido',
      'ritmo frenético',
    ]),
    level(t.line, [
      'linha bem recuada',
      'linha baixa',
      'linha média',
      'linha alta',
      'linha altíssima',
    ]),
  ].join(', ');
}

/** Titulares atuando sem saber a função. */
export function misplaced(career: Career, world: World) {
  return lineupSlots(world, career.lineup, career.tactic.formation)
    .filter(({ player, role }) => familiarity(player, role, stateOf(career, player.id)) < 65)
    .map(({ player, role }) => ({ player, role: positionNames[roleOf(role)] }));
}
