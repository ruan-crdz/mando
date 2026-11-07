import { notify } from './chronicle';
import { overall } from './ratings';
import { addDays, hash } from './random';
import { formations, roleNames, type Career, type Player, type Position, type World } from './types';

const squadPositions: Position[] = [
  'GK', 'GK', 'CB', 'CB', 'CB', 'CB', 'LB', 'LB', 'RB', 'RB', 'DM', 'DM',
  'CM', 'CM', 'AM', 'AM', 'LW', 'LW', 'RW', 'RW', 'ST', 'ST', 'ST',
];

/** Datas fictícias recorrentes; não representam o calendário oficial da FIFA. */
export function internationalWindows(season: number) {
  return ['03-25', '06-12', '09-08', '10-13', '11-17'].map((monthDay) => {
    const matchDate = `${season}-${monthDay}`;
    return { from: addDays(matchDate, -4), until: addDays(matchDate, 2), matchDate };
  });
}

export function internationalCountry(career: Career, playerId: string): string | undefined {
  const duty = career.international;
  return duty && career.date >= duty.from && career.date <= duty.until
    ? duty.players[playerId]
    : undefined;
}

export function eligibleForBrazil(career: Career, player: Player): boolean {
  const state = career.players[player.id];
  return player.nationality === 'Brasil' && Boolean(state?.clubId) && !state?.retired;
}

/** Não agrava a falta de atletas ou deixa um clube principal sem goleiro. */
export function canReleaseForInternational(
  career: Career,
  world: World,
  playerId: string,
  called: ReadonlySet<string>,
): boolean {
  const player = world.players.find((item) => item.id === playerId);
  const state = career.players[playerId];
  if (!player || !state?.clubId) return false;
  if (!world.clubs.some((club) => club.id === state.clubId)) return true;
  if (state.injuryDays > 0 || state.suspension > 0 || state.fitness < 30) return true;
  let available = 0;
  let keepers = 0;
  for (const candidate of world.players) {
    const current = career.players[candidate.id];
    if (
      candidate.id === playerId ||
      called.has(candidate.id) ||
      current?.clubId !== state.clubId ||
      current.retired ||
      current.injuryDays > 0 ||
      current.suspension > 0 ||
      current.fitness < 30
    )
      continue;
    available++;
    if (candidate.position === 'GK') keepers++;
  }
  return available >= 11 && keepers >= 1;
}

export function nationalLineup(career: Career, world: World): string[] {
  const national = career.national;
  if (!national) return [];
  const pool = world.players.filter((player) => {
    const state = career.players[player.id];
    return (
      national.callups.includes(player.id) &&
      eligibleForBrazil(career, player) &&
      state.injuryDays === 0 &&
      state.fitness >= 30 &&
      !(national.suspensions[player.id] > 0)
    );
  });
  const chosen: string[] = [];
  for (const role of formations[national.tactic.formation]) {
    const candidates = pool
      .filter((player) => !chosen.includes(player.id) && (role !== 'GK' || player.position === 'GK'))
      .sort(
        (a, b) =>
          overall(b, role, career.players[b.id]) - overall(a, role, career.players[a.id]) ||
          a.id.localeCompare(b.id),
      );
    if (candidates[0]) chosen.push(candidates[0].id);
  }
  return chosen;
}

export function resetNationalRoles(career: Career) {
  const national = career.national;
  if (!national) return;
  for (const role of roleNames) {
    if (!national.callups.includes(national.roles[role]))
      national.roles[role] = national.lineup[role === 'Capitão' ? 2 : 10] || national.lineup[0] || '';
  }
}

/** Seleciona 23 atletas com posições variadas, usando apenas o mundo da carreira. */
export function recommendCallups(career: Career, world: World): string[] {
  const pool = world.players
    .filter(
      (p) =>
        eligibleForBrazil(career, p) &&
        career.players[p.id].injuryDays === 0 &&
        career.players[p.id].fitness >= 30 &&
        (career.national?.suspensions[p.id] ?? 0) <= 0,
    )
    .sort(
      (a, b) =>
        overall(b, b.position, career.players[b.id]) - overall(a, a.position, career.players[a.id]) ||
        a.id.localeCompare(b.id),
    );
  const chosen: string[] = [];
  const duty = career.international;
  const called = new Set(
    duty && career.date >= duty.from && career.date <= duty.until
      ? Object.entries(duty.players).filter(([, country]) => country !== 'Brasil').map(([id]) => id)
      : [],
  );
  const canChoose = (player: Player) =>
    !chosen.includes(player.id) && canReleaseForInternational(career, world, player.id, called);
  const choose = (player: Player) => {
    chosen.push(player.id);
    called.add(player.id);
  };
  for (const role of squadPositions) {
    const player = pool.find((p) => p.position === role && canChoose(p));
    if (player) choose(player);
  }
  for (const player of pool) {
    if (chosen.length >= 23) break;
    if (canChoose(player)) choose(player);
  }
  return chosen;
}

/** Revê os desfalques após lesões, transferências ou mudanças na convocação. */
export function refreshInternationalDuty(career: Career, world: World, announce = true) {
  const duty = career.international;
  if (!duty || career.date < duty.from || career.date > duty.until) return;
  const previous = duty.players;
  const brazil = career.national?.callups ||
    Object.keys(previous).filter((id) => previous[id] === 'Brasil');
  const next: Record<string, string> = {};
  const called = new Set<string>();
  const rejected: string[] = [];
  for (const id of brazil) {
    const player = world.players.find((item) => item.id === id);
    if (!player || !eligibleForBrazil(career, player) || career.players[id].injuryDays > 0) continue;
    if (!canReleaseForInternational(career, world, id, called)) {
      if (career.national) rejected.push(id);
      continue;
    }
    next[id] = 'Brasil';
    called.add(id);
  }
  for (const [id, country] of Object.entries(previous)) {
    if (country === 'Brasil') continue;
    const state = career.players[id];
    if (!state?.clubId || state.retired || state.injuryDays > 0) continue;
    if (!canReleaseForInternational(career, world, id, called)) continue;
    next[id] = country;
    called.add(id);
  }
  duty.players = next;
  if (career.national && rejected.length) {
    career.national.callups = career.national.callups.filter((id) => !rejected.includes(id));
    career.national.lineup = nationalLineup(career, world);
    resetNationalRoles(career);
    notify(career, {
      kind: 'staff',
      from: 'Seleção Brasileira',
      title: 'Convocação precisa de ajustes',
      body: `${rejected.length} atleta(s) foram dispensados para não deixar um clube sem onze disponíveis e um goleiro. Revise a lista da Seleção.`,
    });
  }
  if (announce) {
    const changed = new Set([...Object.keys(previous), ...Object.keys(next)]);
    const ownChanges = [...changed].filter(
      (id) => career.players[id]?.clubId === career.clubId && previous[id] !== next[id],
    );
    if (ownChanges.length)
      notify(career, {
        kind: 'staff',
        from: 'Secretaria de futebol',
        title: 'Desfalques internacionais atualizados',
        body: 'A situação de convocados do seu elenco mudou. Confira a disponibilidade antes da próxima partida.',
      });
  }
}

/** Registra as convocações antes da simulação dos jogos de clube do primeiro dia. */
export function beginInternationalWindow(career: Career, world: World) {
  const window = internationalWindows(career.season).find((item) => item.from === career.date);
  if (!window) return;
  const chosen = career.national?.callups ?? recommendCallups(career, world);
  const players: Record<string, string> = {};
  for (const id of chosen) {
    const player = world.players.find((p) => p.id === id);
    if (player && eligibleForBrazil(career, player) && career.players[id].injuryDays === 0)
      players[id] = 'Brasil';
  }
  const foreign = new Map<string, Player[]>();
  for (const player of world.players) {
    const state = career.players[player.id];
    if (
      !state?.clubId ||
      state.retired ||
      state.injuryDays ||
      state.fitness < 30 ||
      player.nationality === 'Brasil'
    )
      continue;
    const group = foreign.get(player.nationality) || [];
    group.push(player);
    foreign.set(player.nationality, group);
  }
  for (const [country, group] of foreign) {
    group.sort(
      (a, b) =>
        overall(b, b.position, career.players[b.id]) - overall(a, a.position, career.players[a.id]) ||
        a.id.localeCompare(b.id),
    );
    // O snapshot cobre apenas parte do futebol mundial; os demais convocados estão fora dele.
    const count = Math.min(23, Math.floor((group.length + (hash(`${career.seed}:${window.matchDate}:${country}`) % 4)) / 4));
    let selected = 0;
    for (const player of group) {
      if (selected >= count) break;
      if (!canReleaseForInternational(career, world, player.id, new Set(Object.keys(players)))) continue;
      players[player.id] = country;
      selected++;
    }
  }
  career.international = { from: window.from, until: window.until, players };
  refreshInternationalDuty(career, world, false);
  const own = Object.keys(career.international.players).filter(
    (id) => career.players[id]?.clubId === career.clubId,
  );
  if (own.length)
    notify(career, {
      kind: 'staff',
      from: 'Secretaria de futebol',
      title: 'Convocações para a data internacional',
      body: `${own.length} atleta(s) do elenco foram convocados e ficam indisponíveis para o clube até ${window.until}.`,
    });
}
