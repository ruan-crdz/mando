import { ageAt, clamp, hash } from './random';
import { overall } from './ratings';
import { squad } from './matches';
import { notify } from './chronicle';
import type { Career, Player, PlayerState, World } from './types';

export const MENTOR_SLOTS = 3;
export const MENTOR_MIN_AGE = 28;
export const PUPIL_MAX_AGE = 21;
/** Mentoria acaba quando o jovem passa desta idade. */
const PUPIL_GRADUATE_AGE = 23;
const mentorTraits: PlayerState['personality'][] = ['Líder', 'Profissional', 'Disciplinado'];

export const goodMentor = (s: PlayerState) => mentorTraits.includes(s.personality);
/** Multiplicador de evolução do jovem com mentor. */
export const mentorGrowth = (s: PlayerState) => (goodMentor(s) ? 1.3 : 1.2);
/** Chance mensal de o jovem herdar a personalidade do mentor. */
export const inheritChance = (s: PlayerState) => (goodMentor(s) ? 0.15 : 0.08);

export type Tier = 'Líderes' | 'Influentes' | 'Elenco' | 'Periféricos';
export const tiers: Tier[] = ['Líderes', 'Influentes', 'Elenco', 'Periféricos'];

export type Influence = {
  player: Player;
  score: number;
  tier: Tier;
  /** Anos de clube (aproximado para quem já estava no elenco no início da carreira). */
  tenure: number;
  reasons: string[];
};

function tenureOf(c: Career, p: Player) {
  const arrival = [...c.living.transfers]
    .reverse()
    .find((t) => t.playerId === p.id && t.to === c.clubId);
  if (arrival) return Math.max(0, (Date.parse(c.date) - Date.parse(arrival.date)) / 3.156e10);
  if (c.youth.some((y) => y.id === p.id) || p.id.startsWith('prospect-'))
    return Math.max(0, ageAt(p.birthDate, c.date) - 17);
  return 2 + Math.max(0, c.season - 2026);
}

const personalityWeight: Record<PlayerState['personality'], number> = {
  Líder: 15,
  Leal: 6,
  Profissional: 4,
  Disciplinado: 4,
  Ambicioso: 0,
  Temperamental: -4,
};

/** Hierarquia do vestiário: idade, tempo de clube, braçadeira, personalidade, nível e jogos. */
export function hierarchy(c: Career, world: World): Influence[] {
  const rows = squad(c, world).map((p) => {
    const s = c.players[p.id];
    const age = ageAt(p.birthDate, c.date);
    const tenure = tenureOf(c, p);
    const games = c.living.clubStats[p.id]?.games ?? 0;
    const captain = c.roles['Capitão'] === p.id;
    const vice = c.roles['Vice-capitão'] === p.id;
    const ovr = overall(p, s.position || p.position, s);
    const reasons: string[] = [];
    if (captain) reasons.push('capitão');
    else if (vice) reasons.push('vice-capitão');
    if (s.personality === 'Líder') reasons.push('líder nato');
    if (age >= 30) reasons.push(`${age} anos`);
    if (tenure >= 4) reasons.push(`${Math.floor(tenure)} anos de clube`);
    if (ovr >= 75) reasons.push('referência técnica');
    if (games >= 40) reasons.push(`${games} jogos com você`);
    const score =
      Math.min(14, Math.max(0, age - 18)) * 1.5 +
      Math.min(6, tenure) * 3 +
      (captain ? 25 : vice ? 12 : 0) +
      personalityWeight[s.personality] +
      (ovr - 60) * 0.8 +
      Math.min(15, games / 4);
    return { player: p, score: Math.round(score), tenure, reasons, tier: 'Elenco' as Tier };
  });
  rows.sort((a, b) => b.score - a.score || a.player.id.localeCompare(b.player.id));
  const peripheral = Math.floor(rows.length * 0.25);
  rows.forEach((r, i) => {
    r.tier =
      i < 3 ? 'Líderes' : i < 8 ? 'Influentes' : i >= rows.length - peripheral ? 'Periféricos' : 'Elenco';
  });
  return rows;
}

export type Clique = { name: string; kind: 'país' | 'amizade' | 'geração'; ids: string[] };

/** Panelinhas: estrangeiros do mesmo país, círculos de amizade e gerações. */
export function cliques(c: Career, world: World): Clique[] {
  const players = squad(c, world);
  const ids = new Set(players.map((p) => p.id));
  const out: Clique[] = [];
  const byCountry = new Map<string, string[]>();
  for (const p of players)
    if (p.nationality !== 'Brasil')
      byCountry.set(p.nationality, [...(byCountry.get(p.nationality) || []), p.id]);
  for (const [country, members] of byCountry)
    if (members.length >= 2) out.push({ name: `Estrangeiros · ${country}`, kind: 'país', ids: members });
  // Círculos de amizade: componentes conectados pelas amizades registradas.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const linked = new Set<string>();
  for (const r of c.living.relations)
    if (r.kind === 'amizade' && ids.has(r.a) && ids.has(r.b)) {
      linked.add(r.a);
      linked.add(r.b);
      const ra = find(r.a);
      const rb = find(r.b);
      if (ra !== rb) parent.set(ra, rb);
    }
  const circles = new Map<string, string[]>();
  for (const id of linked) {
    const root = find(id);
    circles.set(root, [...(circles.get(root) || []), id]);
  }
  const name = (id: string) => world.players.find((p) => p.id === id)?.name.split(' ')[0] || 'Atleta';
  for (const members of circles.values())
    if (members.length >= 2)
      out.push({ name: `Turma de ${name(members[0])}`, kind: 'amizade', ids: members });
  const veterans = players.filter((p) => ageAt(p.birthDate, c.date) >= 30).map((p) => p.id);
  const kids = players.filter((p) => ageAt(p.birthDate, c.date) <= PUPIL_MAX_AGE).map((p) => p.id);
  if (veterans.length >= 3) out.push({ name: 'Veteranos', kind: 'geração', ids: veterans });
  if (kids.length >= 3) out.push({ name: 'Garotada', kind: 'geração', ids: kids });
  return out;
}

/** Quem anda com o atleta (panelinhas e dupla de mentoria), sem ele mesmo. */
export function circleOf(c: Career, world: World, id: string) {
  const set = new Set<string>();
  for (const g of cliques(c, world)) if (g.ids.includes(id)) g.ids.forEach((x) => set.add(x));
  for (const m of c.living.mentors) {
    if (m.mentor === id) set.add(m.pupil);
    if (m.pupil === id) set.add(m.mentor);
  }
  set.delete(id);
  return [...set];
}

/** Promessa quebrada: o grupo do atleta sente (mais se ele for liderança). */
export function lockerFallout(c: Career, world: World, playerId: string) {
  const leader = hierarchy(c, world).find((r) => r.player.id === playerId)?.tier === 'Líderes';
  const circle = circleOf(c, world, playerId);
  const hit = leader ? 4 : 2;
  for (const id of circle) if (c.players[id]) c.players[id].morale = clamp(c.players[id].morale - hit);
  if (leader && circle.length) {
    const name = world.players.find((p) => p.id === playerId)?.name || 'O atleta';
    notify(c, {
      kind: 'staff',
      from: 'Auxiliar técnico',
      title: 'Liderança contrariada',
      body: `${name} é uma das lideranças e espalhou a insatisfação: ${circle.length} companheiros do grupo dele perderam ${hit} de moral.`,
      playerId,
    });
  }
}

/** Fechamento do mês no vestiário: líderes no banco, líderes felizes e mentorias. */
export function lockerMonthly(c: Career, world: World) {
  const ranks = hierarchy(c, world);
  const leaders = ranks.filter((r) => r.tier === 'Líderes');
  let happy = 0;
  for (const r of leaders) {
    const s = c.players[r.player.id];
    if (s.benchGames >= 4 && !s.injuryDays) {
      const circle = circleOf(c, world, r.player.id);
      s.morale = clamp(s.morale - 3);
      for (const id of circle) if (c.players[id]) c.players[id].morale = clamp(c.players[id].morale - 3);
      notify(c, {
        kind: 'staff',
        from: 'Auxiliar técnico',
        title: `${r.player.name} incomoda o grupo`,
        body: `Liderança do elenco, ${r.player.name} está há ${s.benchGames} jogos fora. Ele e ${circle.length} companheiros próximos perderam 3 de moral.`,
        playerId: r.player.id,
      });
    } else if (s.morale >= 75) happy++;
  }
  const lift = Math.min(3, happy);
  if (lift) for (const r of ranks) c.players[r.player.id].morale = clamp(c.players[r.player.id].morale + lift);
  mentorMonthly(c, world);
}

function mentorMonthly(c: Career, world: World) {
  const L = c.living;
  const find = (id: string) => world.players.find((p) => p.id === id);
  L.mentors = L.mentors.filter((m) => {
    const mentor = find(m.mentor);
    const pupil = find(m.pupil);
    const ms = c.players[m.mentor];
    const ps = c.players[m.pupil];
    if (!mentor || !pupil || ms?.clubId !== c.clubId || ps?.clubId !== c.clubId) return false;
    if (ageAt(pupil.birthDate, c.date) > PUPIL_GRADUATE_AGE) {
      notify(c, {
        kind: 'staff',
        from: 'Auxiliar técnico',
        title: 'Mentoria concluída',
        body: `${pupil.name} já tem ${ageAt(pupil.birthDate, c.date)} anos e encerrou a mentoria com ${mentor.name}. A vaga está livre.`,
        playerId: pupil.id,
      });
      return false;
    }
    return true;
  });
  for (const m of L.mentors) {
    const ms = c.players[m.mentor];
    const ps = c.players[m.pupil];
    ms.morale = clamp(ms.morale + 2);
    ps.morale = clamp(ps.morale + 2);
    const roll = (hash(`${c.seed}:${c.date}:${m.pupil}:mentor`) % 1000) / 1000;
    if (ps.personality !== ms.personality && roll < inheritChance(ms)) {
      const before = ps.personality;
      ps.personality = ms.personality;
      notify(c, {
        kind: 'staff',
        from: 'Auxiliar técnico',
        title: `${find(m.pupil)!.name} se espelha no mentor`,
        body: `De tanto acompanhar ${find(m.mentor)!.name}, o jovem deixou de ser ${before.toLowerCase()} e agora tem perfil ${ms.personality.toLowerCase()}.`,
        playerId: m.pupil,
      });
    }
  }
}

export const mentorOf = (c: Career, pupilId: string) =>
  c.living.mentors.find((m) => m.pupil === pupilId);
export const pupilOf = (c: Career, mentorId: string) =>
  c.living.mentors.find((m) => m.mentor === mentorId);

export function canMentor(c: Career, p: Player) {
  const s = c.players[p.id];
  return s?.clubId === c.clubId && ageAt(p.birthDate, c.date) >= MENTOR_MIN_AGE && !pupilOf(c, p.id);
}

export function canBeMentored(c: Career, p: Player) {
  const s = c.players[p.id];
  return s?.clubId === c.clubId && ageAt(p.birthDate, c.date) <= PUPIL_MAX_AGE && !mentorOf(c, p.id);
}

/** Sugestões de dupla: melhores mentores (perfil e hierarquia) para jovens sem mentor. */
export function mentorSuggestions(c: Career, world: World, limit = 3) {
  const ranks = hierarchy(c, world);
  const mentors = ranks
    .filter((r) => canMentor(c, r.player))
    .sort(
      (a, b) =>
        Number(goodMentor(c.players[b.player.id])) - Number(goodMentor(c.players[a.player.id])) ||
        b.score - a.score,
    );
  const pupils = ranks
    .filter((r) => canBeMentored(c, r.player))
    .sort((a, b) => b.player.potential - a.player.potential);
  const out: { mentor: Player; pupil: Player }[] = [];
  const used = new Set<string>();
  for (const pupil of pupils) {
    // Mesma posição (ou mesmo setor) primeiro.
    const pick =
      mentors.find((m) => !used.has(m.player.id) && m.player.position === pupil.player.position) ||
      mentors.find((m) => !used.has(m.player.id));
    if (!pick) break;
    used.add(pick.player.id);
    out.push({ mentor: pick.player, pupil: pupil.player });
    if (out.length >= limit) break;
  }
  return out;
}

export function assignMentor(career: Career, world: World, mentorId: string, pupilId: string): Career {
  const mentor = world.players.find((p) => p.id === mentorId);
  const pupil = world.players.find((p) => p.id === pupilId);
  if (!mentor || !pupil || mentorId === pupilId) throw new Error('Dupla inválida.');
  if (career.living.mentors.length >= MENTOR_SLOTS)
    throw new Error(`Limite de ${MENTOR_SLOTS} duplas de mentoria. Encerre uma para abrir vaga.`);
  if (!canMentor(career, mentor))
    throw new Error(`O mentor precisa ser do elenco, ter ${MENTOR_MIN_AGE}+ anos e estar livre.`);
  if (!canBeMentored(career, pupil))
    throw new Error(`O jovem precisa ser do elenco, ter até ${PUPIL_MAX_AGE} anos e estar sem mentor.`);
  const c = structuredClone(career);
  c.living.mentors.push({ mentor: mentorId, pupil: pupilId, since: c.date });
  return c;
}

export function endMentorship(career: Career, pupilId: string): Career {
  const c = structuredClone(career);
  c.living.mentors = c.living.mentors.filter((m) => m.pupil !== pupilId);
  return c;
}
