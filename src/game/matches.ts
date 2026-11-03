import { ageAt, clamp, hash, random } from './random';
import { overall } from './ratings';
import { clubById, findPlayer, isNpc, npcSquad, npcState } from './npc';
import {
  formations,
  type Career,
  type Fixture,
  type Match,
  type MatchMoment,
  type Player,
  type Tactic,
  type World,
} from './types';

type MomentKind = MatchMoment['kind'];

export const stateOf = (career: Career, id: string) =>
  career.players[id] || (isNpc(id) ? npcState : undefined);

export const available = (career: Career, id: string) => {
  const p = stateOf(career, id);
  return p && p.injuryDays === 0 && p.suspension === 0 && p.fitness >= 30;
};

export function squad(career: Career, world: World, clubId = career.clubId) {
  if (isNpc(clubId)) return npcSquad(clubId);
  return world.players.filter((p) => career.players[p.id]?.clubId === clubId);
}

/** Formação usada pelos clubes controlados pela engine durante as partidas. */
export const npcFormation = '4-2-3-1' as const;

export function bestLineup(
  career: Career,
  world: World,
  clubId = career.clubId,
  formation = career.tactic.formation,
) {
  const pool = squad(career, world, clubId).filter((p) => available(career, p.id));
  const chosen: string[] = [];
  // Clubes controlados pela engine poupam atletas desgastados quando há alternativa.
  const rest = clubId !== career.clubId;
  const score = (p: Player, role: string) => {
    const s = stateOf(career, p.id)!;
    return overall(p, role, s) - (rest && s.fitness < 65 ? 10 : 0);
  };
  for (const role of formations[formation]) {
    const best = pool
      .filter((p) => !chosen.includes(p.id))
      .sort(
        (a, b) =>
          score(b, role) - score(a, role) ||
          stateOf(career, b.id)!.fitness - stateOf(career, a.id)!.fitness,
      )[0];
    if (best) chosen.push(best.id);
  }
  return chosen;
}

export function reconcileSquad(career: Career, world: World) {
  if (career.lineup.some((id) => career.players[id]?.clubId !== career.clubId)) {
    const lineup = bestLineup(career, world);
    if (lineup.length !== 11)
      throw new Error('O clube ficou sem onze atletas disponíveis. Reveja a operação.');
    career.lineup = lineup;
  }
  for (const [role, id] of Object.entries(career.roles)) {
    if (career.players[id]?.clubId !== career.clubId)
      career.roles[role] = career.lineup[role === 'Capitão' ? 2 : 10];
  }
}

export function validateLineup(career: Career, world: World) {
  if (new Set(career.lineup).size !== 11 || career.lineup.length !== 11)
    throw new Error('Escale onze atletas diferentes.');
  if (
    career.lineup.some(
      (id) => !available(career, id) || career.players[id].clubId !== career.clubId,
    )
  )
    throw new Error(
      'A escalação contém atleta lesionado, suspenso, exausto ou de outro clube. Use a autoescalação.',
    );
  const keeper = world.players.find((p) => p.id === career.lineup[0]);
  if (keeper?.position !== 'GK') throw new Error('Escale um goleiro na posição de goleiro.');
  if (career.challenge === 'Só a base') {
    const young = career.lineup.filter((id) => {
      const p = world.players.find((p) => p.id === id)!;
      return ageAt(p.birthDate, career.date) <= 23;
    }).length;
    if (young < 3)
      throw new Error('O desafio Só a base exige ao menos três titulares de até 23 anos.');
  }
}

export function beginMatch(career: Career, world: World, fixture: Fixture): Match {
  const ours = fixture.homeId === career.clubId || fixture.awayId === career.clubId;
  if (ours) validateLineup(career, world);
  const empty = { shots: 0, xg: 0, possession: 50, passes: 0 };
  return {
    fixtureId: fixture.id,
    seed: hash(`${career.seed}:${fixture.id}`),
    minute: 0,
    homeGoals: 0,
    awayGoals: 0,
    home: { ...empty },
    away: { ...empty },
    homeLineup:
      fixture.homeId === career.clubId
        ? [...career.lineup]
        : bestLineup(career, world, fixture.homeId, npcFormation),
    awayLineup:
      fixture.awayId === career.clubId
        ? [...career.lineup]
        : bestLineup(career, world, fixture.awayId, npcFormation),
    usedSubs: 0,
    replaced: [],
    ratings: {},
    minutesPlayed: {},
    energySpent: {},
    injured: [],
    moments: [],
    events: [
      {
        minute: 0,
        type: 'kickoff',
        clubId: fixture.homeId,
        text: 'Bola rolando. Começa a partida!',
      },
    ],
  };
}

function power(
  career: Career,
  world: World,
  ids: string[],
  tactic: Tactic,
  spent: Record<string, number>,
  injured: string[] = [],
) {
  const players = ids.flatMap((id, i) => {
    const player = findPlayer(world, id);
    return player ? [{ player, role: formations[tactic.formation][i] || 'CM' }] : [];
  });
  const score = (roles: string[]) => {
    const values = players
      .filter(({ role }) => roles.includes(role))
      .map(({ player: p, role }) => {
        const s = stateOf(career, p.id)!;
        const fatigue = clamp(s.fitness - (spent[p.id] || 0), 25, 100) / 100;
        return (
          overall(p, role, s) *
          (0.65 + fatigue * 0.25 + s.morale / 1000) *
          (injured.includes(p.id) ? 0.6 : 1)
        );
      });
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 25;
  };
  return {
    attack:
      score(['ST', 'LW', 'RW', 'AM', 'LM', 'RM']) *
      (1 + (tactic.mentality === 'Ofensiva' ? 0.12 : tactic.mentality === 'Defensiva' ? -0.12 : 0)),
    midfield: score(['DM', 'CM', 'AM', 'LM', 'RM']) * (1 + (tactic.width - 3) * 0.015),
    defense:
      score(['GK', 'CB', 'LB', 'RB']) *
      (1 +
        (tactic.mentality === 'Defensiva' ? 0.1 : tactic.mentality === 'Ofensiva' ? -0.08 : 0) -
        (tactic.line - 3) * 0.015),
  };
}

export function stepMatch(
  career: Career,
  world: World,
  current: Match,
  interactive = false,
): Match {
  if (current.minute >= 90) return current;
  const match = structuredClone(current);
  match.injured ??= [];
  match.moments ??= [];
  const fixture = career.fixtures.find((f) => f.id === match.fixtureId)!;
  const minute = ++match.minute;
  const rng = random(hash(`${match.seed}:${minute}`));
  const npc: Tactic = {
    formation: npcFormation,
    mentality: 'Equilibrada',
    pressure: 3,
    width: 3,
    tempo: 3,
    line: 3,
  };
  const npcLosing =
    fixture.homeId === career.clubId
      ? match.awayGoals < match.homeGoals
      : match.homeGoals < match.awayGoals;
  if (career.difficulty !== 'Iniciante' && minute > 60 && npcLosing) npc.mentality = 'Ofensiva';
  if (career.difficulty === 'Profissional' && minute > 75 && !npcLosing)
    npc.mentality = 'Defensiva';
  const ht = fixture.homeId === career.clubId ? career.tactic : npc;
  const at = fixture.awayId === career.clubId ? career.tactic : npc;
  for (const [ids, tactic] of [
    [match.homeLineup, ht],
    [match.awayLineup, at],
  ] as const) {
    for (const id of ids) {
      match.minutesPlayed[id] = (match.minutesPlayed[id] || 0) + 1;
      match.energySpent[id] =
        (match.energySpent[id] || 0) + 0.2 + tactic.pressure * 0.015 + tactic.tempo * 0.005;
    }
  }
  const home = power(career, world, match.homeLineup, ht, match.energySpent, match.injured);
  const away = power(career, world, match.awayLineup, at, match.energySpent, match.injured);
  const share = clamp(
    home.midfield / (home.midfield + away.midfield) + 0.025 + (ht.pressure - at.pressure) * 0.008,
    0.3,
    0.7,
  );
  match.home.possession = Math.round(
    (current.home.possession * (minute - 1) + share * 100) / minute,
  );
  match.away.possession = 100 - match.home.possession;
  match.home.passes += Math.round(share * (5 + rng() * 5));
  match.away.passes += Math.round((1 - share) * (5 + rng() * 5));
  const isHome = rng() < share;
  const ids = isHome ? match.homeLineup : match.awayLineup;
  const clubId = isHome ? fixture.homeId : fixture.awayId;
  const club = clubById(world, clubId);
  const attack = isHome ? home : away;
  const defense = isHome ? away : home;
  const tactic = isHome ? ht : at;
  const players = ids.map((id) => findPlayer(world, id)).filter((p): p is Player => Boolean(p));
  const attackers = players
    .filter((p) => p.position !== 'GK')
    .sort((a, b) => b.attributes.finishing - a.attributes.finishing);
  const scorer =
    attackers[Math.min(attackers.length - 1, Math.floor(rng() * Math.min(5, attackers.length)))];
  if (
    scorer &&
    rng() <
      clamp(
        (0.22 * attack.attack) / defense.defense +
          (tactic.tempo - 3) * 0.012 +
          (isHome ? 0.015 : 0),
        0.09,
        0.42,
      )
  ) {
    const stats = isHome ? match.home : match.away;
    const xg = clamp(0.06 + rng() * 0.23 + (scorer.attributes.finishing - 65) * 0.001, 0.03, 0.4);
    stats.shots++;
    stats.xg = Math.round((stats.xg + xg) * 100) / 100;
    const goal = rng() < xg;
    if (goal) {
      if (isHome) match.homeGoals++;
      else match.awayGoals++;
      match.ratings[scorer.id] = (match.ratings[scorer.id] || 6.5) + 0.85;
    }
    const type = goal ? 'goal' : rng() < 0.55 ? 'save' : 'miss';
    match.events.push({
      minute,
      type,
      clubId,
      playerId: scorer.id,
      text: goal
        ? `GOL! ${scorer.name} marca para o ${club.name}!`
        : type === 'save'
          ? `${scorer.name} finaliza. O goleiro faz a defesa!`
          : `${scorer.name} encontra espaço, mas finaliza para fora.`,
    });
  }
  const athlete = players[Math.floor(rng() * players.length)];
  if (athlete && rng() < 0.025 + tactic.pressure * 0.003) {
    match.events.push({
      minute,
      type: 'yellow',
      clubId,
      playerId: athlete.id,
      text: `Cartão amarelo para ${athlete.name}.`,
    });
  }
  if (
    athlete &&
    !match.injured.includes(athlete.id) &&
    rng() < 0.0015 + Math.max(0, 65 - stateOf(career, athlete.id)!.fitness) * 0.0002
  ) {
    match.injured.push(athlete.id);
    match.events.push({
      minute,
      type: 'injury',
      clubId,
      playerId: athlete.id,
      text: `${athlete.name} sente uma lesão. A comissão recomenda substituição.`,
    });
  }
  if (interactive) humanMoments(career, world, match, fixture, minute);
  if (minute === 45)
    match.events.push({
      minute,
      type: 'half',
      clubId,
      text: 'Intervalo. Hora de ajustar o plano.',
    });
  if (minute === 90)
    match.events.push({
      minute,
      type: 'full',
      clubId,
      text: 'Fim de jogo. Cada decisão deixa uma história.',
    });
  return match;
}

export function simulateMatch(career: Career, world: World, fixture: Fixture) {
  let match = beginMatch(career, world, fixture);
  while (match.minute < 90) match = stepMatch(career, world, match);
  return match;
}

export function substitute(
  career: Career,
  world: World,
  outgoing: string,
  incoming: string,
): Career {
  const c = structuredClone(career);
  const match = c.activeMatch;
  if (!match || match.minute >= 90 || match.usedSubs >= 5)
    throw new Error('Não é possível substituir agora (máximo de cinco trocas).');
  const fixture = c.fixtures.find((f) => f.id === match.fixtureId)!;
  const lineup = fixture.homeId === c.clubId ? match.homeLineup : match.awayLineup;
  if (
    !lineup.includes(outgoing) ||
    lineup.includes(incoming) ||
    match.replaced.includes(incoming) ||
    !available(c, incoming) ||
    c.players[incoming]?.clubId !== c.clubId
  )
    throw new Error('Substituição inválida. Escolha um titular e um reserva disponível.');
  const index = lineup.indexOf(outgoing);
  if (index === 0 && world.players.find((p) => p.id === incoming)?.position !== 'GK')
    throw new Error('O substituto do goleiro precisa ser goleiro.');
  lineup[index] = incoming;
  c.lineup[c.lineup.indexOf(outgoing)] = incoming;
  match.usedSubs++;
  match.replaced.push(outgoing);
  match.events.push({
    minute: match.minute,
    type: 'sub',
    clubId: c.clubId,
    playerId: incoming,
    text: `Substituição: sai ${world.players.find((p) => p.id === outgoing)!.name}, entra ${world.players.find((p) => p.id === incoming)!.name}.`,
  });
  match.moments ??= [];
  let asked = false;
  for (const m of match.moments) {
    if (m.status !== 'open') continue;
    const self = m.kind === 'bench' ? m.playerId === incoming : m.playerId === outgoing;
    if (!self) continue;
    asked = m.kind !== 'position';
    m.status = 'done';
    m.action = 'sub';
    const s = c.players[m.playerId];
    if (m.kind === 'bench' && s) {
      s.morale = clamp(s.morale + 10);
      s.relationship = clamp(s.relationship + 4);
      match.ratings[incoming] = (match.ratings[incoming] || 6.5) + 0.3;
      m.outcome = 'Entrou em campo motivado para cumprir a promessa.';
    } else if (s) {
      s.relationship = clamp(s.relationship + 2);
      m.outcome = 'Saiu de campo e agradeceu a leitura do técnico.';
    }
  }
  if (!asked && match.minute < 75) {
    const p = findPlayer(world, outgoing)!;
    const s = c.players[outgoing];
    const team = lineup.map((id) => {
      const q = findPlayer(world, id);
      return q ? overall(q, q.position) : 60;
    });
    const average = team.reduce((a, b) => a + b, 0) / team.length;
    if (
      s &&
      !match.injured?.includes(outgoing) &&
      (match.energySpent[outgoing] || 0) < 16 &&
      overall(p, p.position) >= average &&
      s.morale >= 40 &&
      hash(`${match.seed}:${outgoing}:subbed`) % 100 < 60
    )
      openMoment(match, c.clubId, 'subbed', p, match.minute);
  }
  return c;
}

const roleNames: Record<string, string> = {
  GK: 'goleiro',
  CB: 'zagueiro',
  LB: 'lateral-esquerdo',
  RB: 'lateral-direito',
  DM: 'volante',
  CM: 'meia central',
  AM: 'meia ofensivo',
  LM: 'meia pela esquerda',
  RM: 'meia pela direita',
  LW: 'ponta-esquerda',
  RW: 'ponta-direita',
  ST: 'centroavante',
};
const naturalRole = (role: string) => (role === 'LM' ? 'LW' : role === 'RM' ? 'RW' : role);

const momentLines: Record<MomentKind, string[]> = {
  tired: [
    'Professor, tô no limite. A perna não responde mais, me tira!',
    'Tô morto, professor. Não tenho mais gás pra acompanhar.',
    'Se eu continuar assim, vou acabar me machucando. Pede a troca!',
  ],
  injury: [
    'Senti a coxa, professor! Não sei se dá pra continuar...',
    'Torci o tornozelo. Tá doendo muito, acho que não volto.',
    'Algo estalou aqui atrás. Melhor eu sair antes que piore.',
  ],
  position: [
    'Professor, eu rendo muito mais de {pos}. Me deixa jogar lá!',
    'Tô perdido nessa função. Me bota de {pos} que eu resolvo.',
    'Essa não é a minha posição. Deixa eu jogar de {pos}?',
  ],
  subbed: [
    'Por que eu, professor?! Eu tava bem no jogo!',
    'Sério isso? Logo eu? Não entendi essa troca.',
    'Tá de brincadeira... Eu ia decidir esse jogo!',
  ],
  bench: [
    'Professor, me coloca! Eu vou fazer a diferença, confia em mim!',
    'Tô pronto. Me dá vinte minutos que eu resolvo esse jogo.',
    'Deixa eu entrar! Eu sinto que hoje é o meu dia.',
  ],
  badday: [
    'Professor, não tô num dia bom... Nada sai. Por que você me escalou?',
    'Hoje não tá saindo nada. Acho que não era pra eu ter começado.',
    'Tô travado, professor. A cabeça não tá aqui hoje.',
  ],
};

function openMoment(
  match: Match,
  clubId: string,
  kind: MomentKind,
  player: Player,
  minute: number,
  role?: string,
) {
  const lines = momentLines[kind];
  const text = lines[hash(`${match.seed}:${player.id}:${kind}`) % lines.length].replace(
    '{pos}',
    roleNames[role || ''] || '',
  );
  match.moments.push({
    id: `${minute}-${kind}-${player.id}`,
    minute,
    kind,
    playerId: player.id,
    text,
    status: 'open',
    role,
  });
  match.events.push({
    minute,
    type: 'moment',
    clubId,
    playerId: player.id,
    text: `${player.name}: “${text}”`,
  });
}

/** Índice da escalação para onde o atleta pode ir jogar na posição de origem. */
export function swapTarget(career: Career, world: World, playerId: string) {
  const match = career.activeMatch;
  if (!match) return -1;
  const fixture = career.fixtures.find((f) => f.id === match.fixtureId)!;
  const lineup = fixture.homeId === career.clubId ? match.homeLineup : match.awayLineup;
  const player = findPlayer(world, playerId);
  const from = lineup.indexOf(playerId);
  if (!player || from < 0) return -1;
  const roles = formations[career.tactic.formation];
  let best = -1;
  let bestGain = 0;
  roles.forEach((role, j) => {
    if (j === from || j === 0 || naturalRole(role) !== player.position) return;
    const mate = findPlayer(world, lineup[j]);
    if (!mate) return;
    const gain =
      overall(player, role) +
      overall(mate, roles[from]) -
      overall(player, roles[from]) -
      overall(mate, role);
    if (best < 0 || gain > bestGain) {
      best = j;
      bestGain = gain;
    }
  });
  return best;
}

function humanMoments(
  career: Career,
  world: World,
  match: Match,
  fixture: Fixture,
  minute: number,
) {
  const ownHome = fixture.homeId === career.clubId;
  if (!ownHome && fixture.awayId !== career.clubId) return;
  const lineup = ownHome ? match.homeLineup : match.awayLineup;
  const rng = random(hash(`${match.seed}:${minute}:moments`));
  const asked = (kind: MomentKind, id: string) =>
    match.moments.some((m) => m.kind === kind && m.playerId === id);
  // Quem pediu para sair e foi mantido em campo corre risco maior de lesão.
  for (const m of match.moments) {
    if (m.kind !== 'tired' || m.action !== 'insist' || !lineup.includes(m.playerId)) continue;
    if (match.injured.includes(m.playerId) || rng() >= 0.012) continue;
    const p = findPlayer(world, m.playerId)!;
    match.injured.push(p.id);
    match.events.push({
      minute,
      type: 'injury',
      clubId: career.clubId,
      playerId: p.id,
      text: `${p.name} insistiu no sacrifício e sentiu uma lesão.`,
    });
  }
  for (const e of match.events) {
    if (e.minute !== minute || e.type !== 'injury' || !e.playerId) continue;
    if (!lineup.includes(e.playerId) || asked('injury', e.playerId)) continue;
    openMoment(match, career.clubId, 'injury', findPlayer(world, e.playerId)!, minute);
  }
  if (match.moments.some((m) => m.status === 'open') || minute > 88) return;
  const last = match.moments.filter((m) => m.kind !== 'injury' && m.kind !== 'subbed').at(-1);
  if ((last && minute - last.minute < 8) || match.moments.length >= 6) return;
  const roles = formations[career.tactic.formation];
  const starters = lineup.flatMap((id, i) => {
    const p = findPlayer(world, id);
    const s = stateOf(career, id);
    return p && s ? [{ p, s, role: roles[i] || 'CM' }] : [];
  });
  const goalsFor = ownHome ? match.homeGoals : match.awayGoals;
  const goalsAgainst = ownHome ? match.awayGoals : match.homeGoals;
  const candidates: [MomentKind, Player, number, string?][] = [];
  for (const { p, s, role } of starters) {
    const legs = s.fitness - (match.energySpent[p.id] || 0);
    if (legs < 48 && !asked('tired', p.id)) candidates.push(['tired', p, 0.18]);
    const misses = match.events.filter(
      (e) => e.playerId === p.id && (e.type === 'miss' || e.type === 'save'),
    ).length;
    if (
      p.position !== 'GK' &&
      minute >= 10 &&
      minute <= 70 &&
      (s.morale < 50 || misses >= 2) &&
      !asked('badday', p.id)
    )
      candidates.push(['badday', p, misses >= 2 ? 0.08 : 0.025]);
    if (
      p.position !== 'GK' &&
      minute >= 8 &&
      minute <= 65 &&
      naturalRole(role) !== p.position &&
      overall(p, role) <= overall(p, p.position) - 5 &&
      !asked('position', p.id)
    )
      candidates.push(['position', p, 0.03, p.position]);
  }
  if (minute >= 55 && minute <= 82 && goalsFor <= goalsAgainst && match.usedSubs < 5) {
    const strength = starters.map(({ p }) => overall(p, p.position)).sort((a, b) => a - b)[
      Math.floor(starters.length / 2)
    ];
    const bench = world.players
      .filter(
        (p) =>
          career.players[p.id]?.clubId === career.clubId &&
          p.position !== 'GK' &&
          !lineup.includes(p.id) &&
          !match.replaced.includes(p.id) &&
          available(career, p.id) &&
          career.players[p.id].morale >= 55 &&
          overall(p, p.position) >= strength &&
          !asked('bench', p.id),
      )
      .sort((a, b) => overall(b, b.position) - overall(a, a.position));
    if (bench[0]) candidates.push(['bench', bench[0], goalsFor < goalsAgainst ? 0.07 : 0.04]);
  }
  for (const [kind, player, chance, role] of candidates) {
    if (rng() < chance) {
      openMoment(match, career.clubId, kind, player, minute, role);
      return;
    }
  }
}

export type MomentAction = 'insist' | 'swap' | 'support' | 'talk' | 'ignore';

/** Resolve um momento sem substituição (substituições resolvem pelo próprio `substitute`). */
export function resolveMoment(
  career: Career,
  world: World,
  momentId: string,
  action: MomentAction,
): Career {
  const c = structuredClone(career);
  const match = c.activeMatch;
  const moment = match?.moments?.find((m) => m.id === momentId && m.status === 'open');
  if (!match || !moment) throw new Error('Esse momento já foi resolvido.');
  const s = c.players[moment.playerId];
  const player = findPlayer(world, moment.playerId)!;
  const roll = hash(`${match.seed}:${moment.id}:${action}`) % 100;
  const shift = (morale: number, relationship: number) => {
    if (!s) return;
    s.morale = clamp(s.morale + morale);
    s.relationship = clamp(s.relationship + relationship);
  };
  const remember = (text: string) => c.memories.push({ playerId: player.id, date: c.date, text });
  moment.status = 'done';
  moment.action = action;
  if (action === 'swap') {
    const fixture = c.fixtures.find((f) => f.id === match.fixtureId)!;
    const lineup = fixture.homeId === c.clubId ? match.homeLineup : match.awayLineup;
    const target = swapTarget(career, world, player.id);
    if (target < 0) throw new Error('Não há uma vaga compatível para trocar a posição agora.');
    const from = lineup.indexOf(player.id);
    const mate = lineup[target];
    [lineup[from], lineup[target]] = [mate, player.id];
    const a = c.lineup.indexOf(player.id);
    const b = c.lineup.indexOf(mate);
    if (a >= 0 && b >= 0) [c.lineup[a], c.lineup[b]] = [mate, player.id];
    shift(6, 3);
    moment.outcome = `${player.name} foi para a posição de origem. Troca de função com ${findPlayer(world, mate)!.name}.`;
  } else if (action === 'support') {
    if (roll < 65) {
      shift(12, 4);
      match.ratings[player.id] = (match.ratings[player.id] || 6.5) + 0.4;
      moment.outcome = `${player.name} respirou fundo e voltou para o jogo confiante.`;
    } else {
      shift(3, 2);
      moment.outcome = `${player.name} agradeceu o apoio, mas segue abaixo do esperado.`;
    }
  } else if (action === 'talk') {
    if (roll < 70) {
      shift(-1, 1);
      moment.outcome = `${player.name} entendeu a decisão e foi para o banco apoiar o time.`;
    } else {
      shift(-5, -3);
      moment.outcome = `${player.name} não aceitou a explicação e sentou emburrado.`;
      remember('Ficou chateado ao ser substituído no meio do jogo.');
    }
  } else if (action === 'insist') {
    if (moment.kind === 'injury') {
      shift(-4, -6);
      moment.outcome = `${player.name} segue em campo no sacrifício, rendendo bem menos.`;
      remember('Foi mantido em campo lesionado.');
    } else {
      shift(-2, -2);
      moment.outcome = `${player.name} vai tentar mais um esforço, mas o risco de lesão aumenta.`;
    }
  } else {
    const effects: Record<MomentKind, [number, number, string, string?]> = {
      tired: [-2, -2, 'segue em campo no limite.'],
      injury: [-4, -6, 'segue em campo no sacrifício.', 'Foi mantido em campo lesionado.'],
      position: [
        -5,
        -3,
        'continua na função, contrariado.',
        'Pediu para mudar de posição e foi ignorado.',
      ],
      subbed: [-7, -5, 'ficou sem resposta e saiu irritado.', 'Foi substituído sem explicação.'],
      bench: [-6, -4, 'segue no banco, frustrado.', 'Pediu para entrar e foi ignorado.'],
      badday: [-4, -2, 'segue em campo, sem confiança.'],
    };
    const [morale, relationship, text, memory] = effects[moment.kind];
    shift(morale, relationship);
    moment.outcome = `${player.name} ${text}`;
    if (memory) remember(memory);
  }
  match.events.push({
    minute: match.minute,
    type: 'moment',
    clubId: c.clubId,
    playerId: player.id,
    text: moment.outcome,
  });
  return c;
}
