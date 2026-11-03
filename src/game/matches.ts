import { ageAt, clamp, hash, random } from './random';
import { overall } from './ratings';
import { clubById, findPlayer, isNpc, npcSquad, npcState } from './npc';
import {
  formations,
  type Career,
  type Fixture,
  type Match,
  type Player,
  type Tactic,
  type World,
} from './types';

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
        : bestLineup(career, world, fixture.homeId),
    awayLineup:
      fixture.awayId === career.clubId
        ? [...career.lineup]
        : bestLineup(career, world, fixture.awayId),
    usedSubs: 0,
    replaced: [],
    ratings: {},
    minutesPlayed: {},
    energySpent: {},
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
        return overall(p, role, s) * (0.65 + fatigue * 0.25 + s.morale / 1000);
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

export function stepMatch(career: Career, world: World, current: Match): Match {
  if (current.minute >= 90) return current;
  const match = structuredClone(current);
  const fixture = career.fixtures.find((f) => f.id === match.fixtureId)!;
  const minute = ++match.minute;
  const rng = random(hash(`${match.seed}:${minute}`));
  const npc: Tactic = {
    formation: '4-2-3-1',
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
  const home = power(career, world, match.homeLineup, ht, match.energySpent);
  const away = power(career, world, match.awayLineup, at, match.energySpent);
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
  if (athlete && rng() < 0.0015 + Math.max(0, 65 - stateOf(career, athlete.id)!.fitness) * 0.0002) {
    match.events.push({
      minute,
      type: 'injury',
      clubId,
      playerId: athlete.id,
      text: `${athlete.name} sente uma lesão. A comissão recomenda substituição.`,
    });
  }
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
  return c;
}
