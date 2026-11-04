import { ageAt, clamp, hash, random } from './random';
import { overall } from './ratings';
import { clubById, findPlayer, isNpc, npcSquad, npcState } from './npc';
import { familiarity } from './positions';
import {
  adjustMentality,
  applyTactic,
  npcTactic,
  profile,
  rivalPlan,
  shotChance,
  strength,
  tacticalEdge,
  type Strength,
} from './tactics';
import { matchConditions } from './context';
import { trainingEffect, trainingLevel } from './economy';
import { fitnessEffect, goalkeepingEffect, staffLevel } from './staff';
import { manOfTheMatch, matchRatings } from './matchRatings';
import {
  formations,
  type Career,
  type Fixture,
  type Formation,
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

/** Formação padrão dos clubes da engine (saves antigos sem plano registrado). */
export const npcFormation = '4-2-3-1' as const;

/** Formação usada por um lado da partida. */
export function sideFormation(career: Career, match: Match, clubId: string): Formation {
  if (clubId === career.clubId) return career.tactic.formation;
  const fixture = career.fixtures.find((f) => f.id === match.fixtureId);
  const plan = fixture?.homeId === clubId ? match.homeTactic : match.awayTactic;
  return plan?.formation || npcFormation;
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
  const own = ours ? profile(career, world, career.lineup, career.tactic.formation).ovr : undefined;
  // Contra o usuário, o técnico rival pode ter estudado o padrão dele.
  const plan = (clubId: string, home: boolean) =>
    ours ? rivalPlan(career, world, clubId, home, own) : npcTactic(career, world, clubId);
  const homePlan = fixture.homeId === career.clubId ? null : plan(fixture.homeId, true);
  const awayPlan = fixture.awayId === career.clubId ? null : plan(fixture.awayId, false);
  const homeOvr = own ?? homePlan!.ovr;
  const awayOvr = own ?? awayPlan!.ovr;
  if (homePlan && !ours) homePlan.tactic = adjustMentality(homePlan.tactic, homePlan.ovr - awayOvr);
  if (awayPlan && !ours) awayPlan.tactic = adjustMentality(awayPlan.tactic, awayPlan.ovr - homeOvr);
  const homeLineup = homePlan ? homePlan.lineup : [...career.lineup];
  const awayLineup = awayPlan ? awayPlan.lineup : [...career.lineup];
  const conditions = matchConditions(career, world, fixture, homeLineup, awayLineup);
  const rivalLineup = fixture.homeId === career.clubId ? awayLineup : homeLineup;
  const marked =
    ours && career.living?.marking
      ? rivalLineup
          .map((id) => findPlayer(world, id))
          .filter((p): p is Player => Boolean(p) && p!.position !== 'GK')
          .sort((a, b) => overall(b) + b.attributes.finishing - overall(a) - a.attributes.finishing)[0]?.id
      : undefined;
  const studied = Boolean(homePlan && 'studied' in homePlan && homePlan.studied) ||
    Boolean(awayPlan && 'studied' in awayPlan && awayPlan.studied);
  return {
    conditions,
    ...(marked ? { marked } : {}),
    ...(ours ? { studied, aiSubs: 0 } : {}),
    fixtureId: fixture.id,
    seed: hash(`${career.seed}:${fixture.id}`),
    minute: 0,
    homeGoals: 0,
    awayGoals: 0,
    home: { ...empty },
    away: { ...empty },
    homeLineup,
    awayLineup,
    ...(homePlan ? { homeTactic: homePlan.tactic } : {}),
    ...(awayPlan ? { awayTactic: awayPlan.tactic } : {}),
    bonus: {},
    usedSubs: 0,
    replaced: [],
    ratings: {},
    minutesPlayed: {},
    energySpent: {},
    injured: [],
    dismissed: [],
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

export function stepMatch(
  career: Career,
  world: World,
  current: Match,
  interactive = false,
): Match {
  if (current.minute >= 90) return current;
  const match = structuredClone(current);
  match.injured ??= [];
  match.dismissed ??= [];
  match.moments ??= [];
  const fixture = career.fixtures.find((f) => f.id === match.fixtureId)!;
  const minute = ++match.minute;
  const rng = random(hash(`${match.seed}:${minute}`));
  match.bonus ??= {};
  const legacy: Tactic = {
    formation: npcFormation,
    mentality: 'Equilibrada',
    pressure: 3,
    width: 3,
    tempo: 3,
    line: 3,
  };
  const ownHome = fixture.homeId === career.clubId;
  const npc: Tactic = { ...((ownHome ? match.awayTactic : match.homeTactic) || legacy) };
  const npcLosing =
    fixture.homeId === career.clubId
      ? match.awayGoals < match.homeGoals
      : match.homeGoals < match.awayGoals;
  if (career.difficulty !== 'Iniciante' && minute > 60 && npcLosing) npc.mentality = 'Ofensiva';
  if (career.difficulty === 'Profissional' && minute > 75 && !npcLosing)
    npc.mentality = 'Defensiva';
  const ours = ownHome || fixture.awayId === career.clubId;
  const ht = ownHome ? career.tactic : ours ? npc : match.homeTactic || legacy;
  const at =
    fixture.awayId === career.clubId ? career.tactic : ours ? npc : match.awayTactic || legacy;
  const cond = match.conditions;
  const physio = fitnessEffect(staffLevel(career, 'fitness'));
  const activeShout = match.shout && minute <= match.shout.until ? match.shout.kind : undefined;
  const ownTire = (1 - physio.energy) * (activeShout === 'pressionar' ? 1.08 : 1);
  for (const [ids, tactic, tire] of [
    [match.homeLineup, ht, (cond?.homeTire ?? 1) * (ownHome ? ownTire : 1)],
    [match.awayLineup, at, (cond?.awayTire ?? 1) * (fixture.awayId === career.clubId ? ownTire : 1)],
  ] as const) {
    for (const id of ids) {
      if (match.dismissed.includes(id)) continue;
      match.minutesPlayed[id] = (match.minutesPlayed[id] || 0) + 1;
      match.energySpent[id] =
        (match.energySpent[id] || 0) +
        (0.155 + tactic.pressure * 0.03 + tactic.tempo * 0.01) * tire;
    }
  }
  if (ours) aiSubstitutions(career, world, match, fixture, minute);
  const activeLineup = (ids: string[]) =>
    ids.map((id) => (match.dismissed.includes(id) ? '' : id));
  const homeActive = activeLineup(match.homeLineup);
  const awayActive = activeLineup(match.awayLineup);
  const homeSide = {
    tactic: ht,
    profile: profile(career, world, homeActive, ht.formation),
  };
  const awaySide = {
    tactic: at,
    profile: profile(career, world, awayActive, at.formation),
  };
  const scale = (
    s: Strength,
    k: number,
    markCost: boolean,
    own: boolean,
    dismissed: number,
  ): Strength => {
    const numerical = Math.max(0.7, 1 - dismissed * 0.1);
    const command = own ? activeShout : undefined;
    return {
      attack: s.attack * k * numerical * (command === 'pressionar' ? 1.05 : command === 'acalmar' ? 0.98 : command === 'incentivar' ? 1.02 : 1),
      midfield: s.midfield * k * numerical * (markCost ? 0.985 : 1) * (command === 'acalmar' ? 1.04 : 1),
      defense: s.defense * k * numerical * (command === 'pressionar' ? 0.97 : command === 'incentivar' ? 1.02 : 1),
    };
  };
  const ourSideHome = fixture.homeId === career.clubId;
  const home = scale(
    applyTactic(
      strength(career, world, homeActive, ht.formation, match.energySpent, match.injured),
      ht,
      tacticalEdge(homeSide, awaySide),
    ),
    cond?.home ?? 1,
    Boolean(match.marked) && ourSideHome,
    ourSideHome,
    match.homeLineup.filter((id) => match.dismissed.includes(id)).length,
  );
  const away = scale(
    applyTactic(
      strength(career, world, awayActive, at.formation, match.energySpent, match.injured),
      at,
      tacticalEdge(awaySide, homeSide),
    ),
    cond?.away ?? 1,
    Boolean(match.marked) && !ourSideHome && ours,
    fixture.awayId === career.clubId,
    match.awayLineup.filter((id) => match.dismissed.includes(id)).length,
  );
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
  const players = ids
    .filter((id) => !match.dismissed.includes(id))
    .map((id) => findPlayer(world, id))
    .filter((p): p is Player => Boolean(p));
  const roles = formations[tactic.formation];
  const pick = (weight: (p: Player, role: string) => number, skip?: string) => {
    const pool = ids.flatMap((id, i) => {
      const p = findPlayer(world, id);
      return p && id !== skip && !match.dismissed.includes(id) && roles[i] !== 'GK'
        ? [{ p, w: weight(p, roles[i]) }]
        : [];
    });
    let roll = rng() * pool.reduce((n, x) => n + x.w, 0);
    for (const x of pool) if ((roll -= x.w) <= 0) return x.p;
    return pool.at(-1)?.p;
  };
  // Quem finaliza depende da função em campo e da qualidade de finalização naquela função.
  let scorer = pick(
    (p, role) =>
      (shooterWeight[role] || 1) *
      (p.id === match.marked ? 0.45 : 1) *
      Math.pow((p.attributes.finishing * familiarity(p, role, stateOf(career, p.id))) / 7000, 3),
  );
  if (
    scorer &&
    rng() <
      clamp(
        shotChance(attack.attack, defense.defense) +
          (tactic.tempo - 3) * 0.012 +
          (isHome ? 0.015 : 0),
        0.06,
        0.45,
      )
  ) {
    const stats = isHome ? match.home : match.away;
    const previousXg = stats.xg;
    const setPiece = random(hash(`${match.seed}:${minute}:bola-parada`))();
    const origin =
      setPiece < 0.02
        ? 'penalty'
        : setPiece < 0.06
          ? 'freeKick'
          : setPiece < 0.18
            ? 'corner'
            : 'open';
    const longFreeKick =
      origin === 'freeKick' &&
      random(hash(`${match.seed}:${minute}:falta-longa`))() < 0.5;
    const cornerRole =
      random(hash(`${match.seed}:${minute}:lado-escanteio`))() < 0.5
        ? 'Escanteio esquerdo'
        : 'Escanteio direito';
    const taker = (role: string, score: (p: Player) => number) => {
      const selected = clubId === career.clubId ? career.roles[role] : undefined;
      return (
        players.find((p) => p.id === selected) ||
        [...players].filter((p) => p.position !== 'GK').sort((a, b) => score(b) - score(a))[0]
      );
    };
    if (origin === 'penalty')
      scorer = taker('Pênaltis', (p) => p.attributes.finishing + p.attributes.composure) || scorer;
    else if (origin === 'freeKick' && !longFreeKick)
      scorer =
        taker(
          'Faltas curtas',
          (p) => p.attributes.shortPass + p.attributes.vision + p.attributes.finishing * 0.5,
        ) || scorer;
    const pitchFactor =
      cond?.pitch === 'Pesado'
        ? 0.9
        : cond?.pitch === 'Irregular'
          ? 0.96
          : cond?.pitch === 'Molhado'
            ? 0.98
            : 1;
    const baseXg =
      origin === 'penalty'
        ? 0.72 + (scorer.attributes.finishing - 65) * 0.001
        : origin === 'freeKick'
          ? 0.07 + rng() * 0.06
          : origin === 'corner'
            ? 0.07 + rng() * 0.11
            : 0.06 + rng() * 0.23 + (scorer.attributes.finishing - 65) * 0.001;
    const xg = clamp(baseXg * pitchFactor, 0.03, origin === 'penalty' ? 0.85 : 0.4);
    stats.shots++;
    stats.xg = Math.round((stats.xg + xg) * 100) / 100;
    // O treinador de goleiros do usuário transforma algumas finalizações em defesas.
    const keeper =
      ours && clubId !== career.clubId
        ? 1 - goalkeepingEffect(staffLevel(career, 'goalkeeping')).save
        : 1;
    const initialGoal = rng() < xg * keeper;
    const reviewRng = random(hash(`${match.seed}:${minute}:${scorer.id}:var`));
    const reviewed = initialGoal && Boolean(cond?.referee?.varEnabled) && reviewRng() < 0.08;
    const annulled = reviewed && origin === 'open' && reviewRng() < 0.35;
    const goal = initialGoal && !annulled;
    if (annulled) {
      stats.shots--;
      stats.xg = previousXg;
    }
    if (goal) {
      if (isHome) match.homeGoals++;
      else match.awayGoals++;
    }
    const type = annulled ? 'var' : goal ? 'goal' : rng() < 0.55 ? 'save' : 'miss';
    const helper =
      goal && origin === 'corner'
        ? taker(cornerRole, (p) => p.attributes.longPass + p.attributes.vision)
        : goal && longFreeKick
          ? taker('Faltas longas', (p) => p.attributes.longPass + p.attributes.vision)
        : goal && origin === 'open' && rng() < 0.85
        ? pick(
            (p, role) =>
              (passerWeight[role] || 1) *
              Math.pow((p.attributes.vision + p.attributes.shortPass) / 140, 3),
            scorer.id,
          )
        : undefined;
    match.events.push({
      minute,
      type,
      clubId,
      playerId: scorer.id,
      ...(helper && helper.id !== scorer.id ? { assistId: helper.id } : {}),
      ...(!annulled ? { xg: Math.round(xg * 100) / 100 } : {}),
      origin,
      text: annulled
        ? `VAR: gol de ${scorer.name} anulado por impedimento.`
        : goal
        ? `GOL! ${scorer.name} marca para o ${club.name}${origin === 'penalty' ? ' de pênalti' : longFreeKick ? ' após cobrança de falta' : origin === 'freeKick' ? ' em cobrança de falta' : origin === 'corner' ? ' após escanteio' : ''}!${helper && helper.id !== scorer.id ? ` Passe de ${helper.name}.` : ''}`
        : type === 'save'
          ? `${scorer.name} finaliza${origin === 'penalty' ? ' o pênalti' : longFreeKick ? ' após cobrança de falta' : origin === 'freeKick' ? ' a falta' : origin === 'corner' ? ' após escanteio' : ''}. O goleiro faz a defesa!`
          : `${scorer.name} finaliza${origin === 'penalty' ? ' o pênalti' : longFreeKick ? ' após cobrança de falta' : origin === 'freeKick' ? ' a falta' : origin === 'corner' ? ' após escanteio' : ''} para fora.`,
    });
    if (reviewed && !annulled)
      match.events.push({
        minute,
        type: 'var',
        clubId,
        playerId: scorer.id,
        text: `VAR confirma o gol de ${scorer.name}.`,
      });
  }
  const athlete = players[Math.floor(rng() * players.length)];
  const offender = athlete?.position === 'GK' ? players.find((p) => p.position !== 'GK') : athlete;
  const strictness = cond?.referee?.strictness ?? 3;
  const cardFactor = (0.7 + strictness * 0.1) * (clubId === career.clubId && activeShout === 'acalmar' ? 0.9 : 1);
  if (offender && rng() < (0.025 + tactic.pressure * 0.003) * cardFactor) {
    const second = match.events.some(
      (event) => event.type === 'yellow' && event.clubId === clubId && event.playerId === offender.id,
    );
    const direct = random(hash(`${match.seed}:${minute}:${offender.id}:cartao`))() < 0.025;
    if (!direct)
      match.events.push({
        minute,
        type: 'yellow',
        clubId,
        playerId: offender.id,
        text: `Cartão amarelo para ${offender.name} por falta na disputa.`,
      });
    if (direct || second) {
      match.dismissed.push(offender.id);
      match.events.push({
        minute,
        type: 'red',
        clubId,
        playerId: offender.id,
        text: direct
          ? `${offender.name} é expulso por falta grave.`
          : `${offender.name} recebe o segundo amarelo e é expulso.`,
      });
    }
  }
  if (
    athlete &&
    !match.dismissed.includes(athlete.id) &&
    !match.injured.includes(athlete.id) &&
    rng() <
      (0.0015 + Math.max(0, 65 - stateOf(career, athlete.id)!.fitness) * 0.0002) *
        (cond?.pitch === 'Pesado' ? 1.18 : cond?.pitch === 'Irregular' ? 1.1 : cond?.pitch === 'Molhado' ? 1.06 : 1) *
        (clubId === career.clubId
          ? (1 - trainingEffect(trainingLevel(career)).injury) * (1 - physio.injury)
          : 1)
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
  if (minute === 90 && (ours || interactive)) {
    const ratings = matchRatings(career, world, match);
    match.ratings = Object.fromEntries(ratings.map((r) => [r.id, r.rating]));
    match.mvp = manOfTheMatch(ratings, match, fixture.homeId)?.id;
  }
  if (minute === 90)
    match.events.push({
      minute,
      type: 'full',
      clubId,
      text: 'Fim de jogo. Cada decisão deixa uma história.',
    });
  return match;
}

/** Técnico da IA mexe no time aos 60, 70 e 80 minutos, sempre com um motivo. */
function aiSubstitutions(
  career: Career,
  world: World,
  match: Match,
  fixture: Fixture,
  minute: number,
) {
  if (![60, 70, 80].includes(minute) || (match.aiSubs ?? 0) >= 3) return;
  const rivalHome = fixture.awayId === career.clubId;
  const clubId = rivalHome ? fixture.homeId : fixture.awayId;
  const lineup = rivalHome ? match.homeLineup : match.awayLineup;
  const formation = (rivalHome ? match.homeTactic : match.awayTactic)?.formation || npcFormation;
  const roles = formations[formation];
  const losing = rivalHome ? match.homeGoals < match.awayGoals : match.awayGoals < match.homeGoals;
  const bench = squad(career, world, clubId).filter(
    (p) =>
      !lineup.includes(p.id) &&
      !match.replaced.includes(p.id) &&
      available(career, p.id) &&
      p.position !== 'GK',
  );
  if (!bench.length) return;
  const energy = (id: string) => (stateOf(career, id)?.fitness ?? 80) - (match.energySpent[id] || 0);
  const slots = lineup
    .map((id, i) => ({ id, i, role: roles[i] }))
    .filter((s) => s.role !== 'GK' && !match.dismissed.includes(s.id));
  const hurt = slots.find((s) => match.injured.includes(s.id));
  const chasing = losing && minute >= 70 ? slots.filter((s) => ['DM', 'CM', 'CB', 'LB', 'RB'].includes(s.role)) : [];
  const tiredest = [...slots].sort((a, b) => energy(a.id) - energy(b.id))[0];
  const out = hurt || (chasing.length ? chasing.sort((a, b) => energy(a.id) - energy(b.id))[0] : tiredest);
  if (!out || (!hurt && !chasing.length && energy(out.id) > 55)) return;
  const role = chasing.length && !hurt ? 'AM' : out.role;
  const incoming = bench.sort((a, b) => overall(b, role) - overall(a, role))[0];
  const outgoing = findPlayer(world, out.id);
  if (!incoming || !outgoing) return;
  lineup[out.i] = incoming.id;
  match.replaced.push(out.id);
  match.aiSubs = (match.aiSubs ?? 0) + 1;
  const reason = hurt
    ? 'lesão'
    : chasing.length
      ? 'precisa do gol, tira um homem de marcação e coloca mais um ofensivo'
      : 'renova o fôlego';
  match.events.push({
    minute,
    type: 'sub',
    clubId,
    playerId: incoming.id,
    text: `${clubById(world, clubId).name} mexe: sai ${outgoing.name}, entra ${incoming.name} (${reason}).`,
  });
}

const shooterWeight: Record<string, number> = {
  ST: 5,
  LW: 3,
  RW: 3,
  AM: 2.6,
  LM: 1.8,
  RM: 1.8,
  CM: 1.2,
  DM: 0.6,
  LB: 0.5,
  RB: 0.5,
  CB: 0.55,
};
const passerWeight: Record<string, number> = {
  AM: 4,
  LW: 3,
  RW: 3,
  LM: 2.6,
  RM: 2.6,
  CM: 2.4,
  ST: 1.6,
  LB: 1.4,
  RB: 1.4,
  DM: 1,
  CB: 0.4,
};

export function simulateMatch(career: Career, world: World, fixture: Fixture) {
  let match = beginMatch(career, world, fixture);
  while (match.minute < 90) match = stepMatch(career, world, match);
  return match;
}

export type ShoutKind = NonNullable<Match['shout']>['kind'];
export const shoutChoices: { kind: ShoutKind; label: string; effect: string }[] = [
  {
    kind: 'incentivar',
    label: 'Incentivar',
    effect: '+2% de ataque e defesa por 10 minutos.',
  },
  {
    kind: 'pressionar',
    label: 'Pressionar',
    effect: '+5% de ataque, −3% de defesa e +8% de desgaste por 10 minutos.',
  },
  {
    kind: 'acalmar',
    label: 'Acalmar',
    effect: '+4% de meio-campo, −2% de ataque e −10% de chance de cartão por 10 minutos.',
  },
];

export function shoutFromSideline(career: Career, kind: ShoutKind): Career {
  const c = structuredClone(career);
  const match = c.activeMatch;
  if (!match || match.minute >= 90) throw new Error('Não há partida em andamento.');
  if (match.lastShout !== undefined && match.minute - match.lastShout < 15)
    throw new Error(`Aguarde ${15 - (match.minute - match.lastShout)} minutos para outra instrução.`);
  const choice = shoutChoices.find((item) => item.kind === kind);
  if (!choice) throw new Error('Instrução desconhecida.');
  match.shout = { kind, until: Math.min(90, match.minute + 10) };
  match.lastShout = match.minute;
  match.events.push({
    minute: match.minute,
    type: 'tactic',
    clubId: c.clubId,
    text: `Da beira do campo: ${choice.label}. ${choice.effect}`,
  });
  return c;
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
    match.dismissed.includes(outgoing) ||
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
      match.bonus = { ...match.bonus, [incoming]: (match.bonus?.[incoming] || 0) + 0.3 };
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
  const lines =
    kind === 'badday' && role
      ? [
          'Professor, eu nunca joguei de {pos}! Tô completamente perdido aqui.',
          'De {pos}? Não tá rolando, professor. Não é meu lugar, tô sofrendo.',
          'Isso não vai dar certo. Jogar de {pos} não é comigo, tá todo mundo passando por mim.',
        ]
      : momentLines[kind];
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
  if (!player || from < 0 || match.dismissed.includes(playerId)) return -1;
  const roles = formations[career.tactic.formation];
  let best = -1;
  let bestGain = 0;
  roles.forEach((role, j) => {
    if (j === from || j === 0 || match.dismissed.includes(lineup[j]) || naturalRole(role) !== player.position) return;
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
    if (m.kind !== 'tired' || m.action !== 'insist' || !lineup.includes(m.playerId) || match.dismissed.includes(m.playerId)) continue;
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
    if (match.dismissed.includes(id)) return [];
    const p = findPlayer(world, id);
    const s = stateOf(career, id);
    return p && s ? [{ p, s, role: roles[i] || 'CM' }] : [];
  });
  const goalsFor = ownHome ? match.homeGoals : match.awayGoals;
  const goalsAgainst = ownHome ? match.awayGoals : match.homeGoals;
  const candidates: [MomentKind, Player, number, string?][] = [];
  for (const { p, s, role } of starters) {
    const fam = familiarity(p, role, s);
    const lost = fam < 50 && p.position !== 'GK' && role !== 'GK';
    const legs = s.fitness - (match.energySpent[p.id] || 0);
    if (legs < 48 && !asked('tired', p.id)) candidates.push(['tired', p, 0.18]);
    const misses = match.events.filter(
      (e) => e.playerId === p.id && (e.type === 'miss' || e.type === 'save'),
    ).length;
    if (
      p.position !== 'GK' &&
      minute >= 10 &&
      minute <= 70 &&
      (s.morale < 50 || misses >= 2 || lost) &&
      !asked('badday', p.id)
    )
      candidates.push([
        'badday',
        p,
        lost ? 0.1 : misses >= 2 ? 0.08 : 0.025,
        lost ? role : undefined,
      ]);
    if (
      p.position !== 'GK' &&
      minute >= (lost ? 3 : 8) &&
      minute <= 65 &&
      naturalRole(role) !== p.position &&
      overall(p, role) <= overall(p, p.position) - 5 &&
      !asked('position', p.id)
    )
      candidates.push(['position', p, lost ? 0.22 : fam < 70 ? 0.07 : 0.03, p.position]);
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
      match.bonus = { ...match.bonus, [player.id]: (match.bonus?.[player.id] || 0) + 0.4 };
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
