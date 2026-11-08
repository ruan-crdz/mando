import { ageAt, clamp, hash, random } from './random';
import { overall } from './ratings';
import { clubById, findPlayer, isNpc, npcSquad, npcState } from './npc';
import { familiarity } from './positions';
import {
  adjustMentality,
  applyTactic,
  counterTactic,
  npcTactic,
  profile,
  shotChance,
  strength,
  tacticalEdge,
  type Strength,
} from './tactics';
import { conditionFactor, injuryRisk, minuteDrain } from './fatigue';
import { trainingEffect } from './economy';
import { fitnessEffect, goalkeepingEffect, staffLevel } from './staff';
import { manOfTheMatch, matchRatings } from './matchRatings';
import {
  formations,
  type Career,
  type Fixture,
  type Formation,
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
    return overall(p, role, s) - (rest ? Math.max(0, 85 - s.fitness) * 0.5 : 0);
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

export function syncBenchWithLineup(career: Career, lineup: string[]): Career {
  const outgoing = career.lineup.filter(
    (id) =>
      !lineup.includes(id) && career.players[id]?.clubId === career.clubId && available(career, id),
  );
  let next = 0;
  const bench = career.bench.flatMap((id) =>
    lineup.includes(id)
      ? outgoing[next]
        ? [outgoing[next++]]
        : []
      : career.players[id]?.clubId === career.clubId
        ? [id]
        : [],
  );
  return { ...career, lineup: [...lineup], bench: [...new Set(bench)].slice(0, 9) };
}

export function reconcileSquad(career: Career, world: World) {
  if (career.lineup.some((id) => career.players[id]?.clubId !== career.clubId)) {
    const lineup = bestLineup(career, world);
    if (lineup.length !== 11)
      throw new Error('O clube ficou sem onze atletas disponíveis. Reveja a operação.');
    Object.assign(career, syncBenchWithLineup(career, lineup));
  }
  for (const [role, id] of Object.entries(career.roles)) {
    if (career.players[id]?.clubId !== career.clubId)
      career.roles[role] = career.lineup[role === 'Capitão' ? 2 : 10];
  }
  const seen = new Set<string>();
  career.bench = (career.bench ?? [])
    .filter((id) => {
      if (
        seen.has(id) ||
        career.lineup.includes(id) ||
        career.players[id]?.clubId !== career.clubId
      )
        return false;
      seen.add(id);
      return true;
    })
    .slice(0, 9);
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
      'A escalação contém atleta lesionado, suspenso, convocado, exausto ou de outro clube. Use a autoescalação.',
    );
  if (
    career.bench.length > 9 ||
    new Set(career.bench).size !== career.bench.length ||
    career.bench.some(
      (id) => career.lineup.includes(id) || career.players[id]?.clubId !== career.clubId,
    )
  )
    throw new Error('O banco contém atleta duplicado ou que não pertence ao seu elenco.');
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
  const plan = (clubId: string) => npcTactic(career, world, clubId, own);
  const homePlan = fixture.homeId === career.clubId ? null : plan(fixture.homeId);
  const awayPlan = fixture.awayId === career.clubId ? null : plan(fixture.awayId);
  const homeOvr = own ?? homePlan!.ovr;
  const awayOvr = own ?? awayPlan!.ovr;
  if (homePlan && !ours) homePlan.tactic = adjustMentality(homePlan.tactic, homePlan.ovr - awayOvr);
  if (awayPlan && !ours) awayPlan.tactic = adjustMentality(awayPlan.tactic, awayPlan.ovr - homeOvr);
  const homeLineup = homePlan ? homePlan.lineup : [...career.lineup];
  const awayLineup = awayPlan ? awayPlan.lineup : [...career.lineup];
  const rivalPlan = homePlan ?? awayPlan;
  const prematch: Match['events'] = [];
  if (ours && rivalPlan) {
    const read = rivalRead(career, world, {
      rivalTactic: rivalPlan.tactic,
      rivalLineup: rivalPlan.lineup,
      rivalHome: Boolean(homePlan),
      ownLineup: career.lineup,
    });
    if (read) {
      rivalPlan.tactic = read.tactic;
      prematch.push({
        minute: 0,
        type: 'tactic',
        clubId: homePlan ? fixture.homeId : fixture.awayId,
        text: `${clubById(world, homePlan ? fixture.homeId : fixture.awayId).name} estudou seu time: ${read.reason}.`,
      });
    }
  }
  return {
    ...(ours ? { aiSubs: 0 } : {}),
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
    events: [
      {
        minute: 0,
        type: 'kickoff',
        clubId: fixture.homeId,
        text: 'Bola rolando. Começa a partida!',
      },
      ...prematch,
    ],
  };
}

/**
 * O técnico rival lê o plano do usuário (desenho, pressão, largura, ritmo, linha e o elenco em
 * campo, com cansaço e lesões) e ajusta o próprio plano. Iniciante não estuda o adversário.
 */
function rivalRead(
  career: Career,
  world: World,
  input: {
    rivalTactic: Tactic;
    rivalLineup: string[];
    rivalHome: boolean;
    ownLineup: string[];
    spent?: Record<string, number>;
    injured?: string[];
  },
) {
  if (career.difficulty === 'Iniciante') return null;
  const loyalty = career.difficulty === 'Profissional' ? 0.012 : 0.035;
  const f = input.rivalTactic.formation;
  const rival = {
    profile: profile(career, world, input.rivalLineup, f),
    base: strength(career, world, input.rivalLineup, f, input.spent, input.injured),
  };
  const user = {
    tactic: career.tactic,
    profile: profile(career, world, input.ownLineup, career.tactic.formation),
    base: strength(
      career,
      world,
      input.ownLineup,
      career.tactic.formation,
      input.spent,
      input.injured,
    ),
  };
  const read = counterTactic(input.rivalTactic, rival, user, input.rivalHome, loyalty);
  const changed = (['pressure', 'width', 'tempo', 'line'] as const).some(
    (k) => read.tactic[k] !== input.rivalTactic[k],
  );
  if (!changed || read.gain < 0.02) return null;
  const reason = read.notes[0]?.text.toLowerCase() || 'ajustou o encaixe para o seu desenho';
  return { tactic: read.tactic, reason };
}

export function stepMatch(career: Career, world: World, current: Match): Match {
  if (current.minute >= 90) return current;
  const match = structuredClone(current);
  match.injured ??= [];
  match.dismissed ??= [];
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
  const ours = ownHome || fixture.awayId === career.clubId;
  // No intervalo e na reta final o rival relê o jogo com o cansaço e o seu plano atual.
  if (ours && (minute === 46 || minute === 70)) {
    const rivalTactic = ownHome ? match.awayTactic : match.homeTactic;
    const active = (ids: string[]) => ids.map((id) => (match.dismissed.includes(id) ? '' : id));
    const read =
      rivalTactic &&
      rivalRead(career, world, {
        rivalTactic,
        rivalLineup: active(ownHome ? match.awayLineup : match.homeLineup),
        rivalHome: !ownHome,
        ownLineup: active(ownHome ? match.homeLineup : match.awayLineup),
        spent: match.energySpent,
        injured: match.injured,
      });
    if (read) {
      if (ownHome) match.awayTactic = read.tactic;
      else match.homeTactic = read.tactic;
      const rivalId = ownHome ? fixture.awayId : fixture.homeId;
      match.events.push({
        minute,
        type: 'tactic',
        clubId: rivalId,
        text: `${clubById(world, rivalId).name} muda o plano: ${read.reason}.`,
      });
    }
  }
  const npc: Tactic = { ...((ownHome ? match.awayTactic : match.homeTactic) || legacy) };
  const npcDiff = ownHome ? match.awayGoals - match.homeGoals : match.homeGoals - match.awayGoals;
  const bump = (v: number, d: number) => Math.max(1, Math.min(5, v + d));
  // Gestão do placar: quem perde se expõe aos poucos; quem ganha administra.
  if (career.difficulty !== 'Iniciante') {
    if (npcDiff < 0 && minute > 60) {
      npc.mentality = 'Ofensiva';
      if (minute > 75 || npcDiff <= -2) {
        npc.pressure = bump(npc.pressure, 1);
        npc.tempo = bump(npc.tempo, 1);
        npc.line = bump(npc.line, 1);
      }
    } else if (npcDiff > 0 && minute > 70) {
      npc.mentality = 'Defensiva';
      if (career.difficulty === 'Profissional') {
        npc.line = bump(npc.line, -1);
        npc.tempo = bump(npc.tempo, -1);
      }
    } else if (npcDiff === 0 && minute > 80 && career.difficulty === 'Profissional') {
      // Fora de casa o empate vale; em casa, o rival vai atrás da vitória.
      npc.mentality = ownHome ? 'Defensiva' : 'Ofensiva';
    }
  }
  const ht = ownHome ? career.tactic : ours ? npc : match.homeTactic || legacy;
  const at =
    fixture.awayId === career.clubId ? career.tactic : ours ? npc : match.awayTactic || legacy;
  const physio = fitnessEffect(staffLevel(career, 'fitness'));
  const activeShout = match.shout && minute <= match.shout.until ? match.shout.kind : undefined;
  const ownTire = (1 - physio.energy) * (activeShout === 'pressionar' ? 1.08 : 1);
  for (const [ids, tactic, tire] of [
    [match.homeLineup, ht, ownHome ? ownTire : 1],
    [match.awayLineup, at, fixture.awayId === career.clubId ? ownTire : 1],
  ] as const) {
    const roles = formations[tactic.formation];
    ids.forEach((id, i) => {
      if (match.dismissed.includes(id)) return;
      match.minutesPlayed[id] = (match.minutesPlayed[id] || 0) + 1;
      const player = findPlayer(world, id);
      const drain = player
        ? minuteDrain(player, roles[i] || 'CM', tactic, ageAt(player.birthDate, career.date))
        : 0.13;
      match.energySpent[id] = (match.energySpent[id] || 0) + drain * tire;
    });
  }
  if (ours) aiSubstitutions(career, world, match, fixture, minute);
  const activeLineup = (ids: string[]) => ids.map((id) => (match.dismissed.includes(id) ? '' : id));
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
  const scale = (s: Strength, k: number, own: boolean, dismissed: number): Strength => {
    const numerical = Math.max(0.7, 1 - dismissed * 0.1);
    const command = own ? activeShout : undefined;
    return {
      attack:
        s.attack *
        k *
        numerical *
        (command === 'pressionar'
          ? 1.05
          : command === 'acalmar'
            ? 0.98
            : command === 'incentivar'
              ? 1.02
              : 1),
      midfield: s.midfield * k * numerical * (command === 'acalmar' ? 1.04 : 1),
      defense:
        s.defense *
        k *
        numerical *
        (command === 'pressionar' ? 0.97 : command === 'incentivar' ? 1.02 : 1),
    };
  };
  const ourSideHome = fixture.homeId === career.clubId;
  const home = scale(
    applyTactic(
      strength(career, world, homeActive, ht.formation, match.energySpent, match.injured),
      ht,
      tacticalEdge(homeSide, awaySide),
    ),
    1.02,
    ourSideHome,
    match.homeLineup.filter((id) => match.dismissed.includes(id)).length,
  );
  const away = scale(
    applyTactic(
      strength(career, world, awayActive, at.formation, match.energySpent, match.injured),
      at,
      tacticalEdge(awaySide, homeSide),
    ),
    1,
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
      origin === 'freeKick' && random(hash(`${match.seed}:${minute}:falta-longa`))() < 0.5;
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
    const baseXg =
      origin === 'penalty'
        ? 0.72 + (scorer.attributes.finishing - 65) * 0.001
        : origin === 'freeKick'
          ? 0.07 + rng() * 0.06
          : origin === 'corner'
            ? 0.07 + rng() * 0.11
            : 0.06 + rng() * 0.23 + (scorer.attributes.finishing - 65) * 0.001;
    const xg = clamp(baseXg, 0.03, origin === 'penalty' ? 0.85 : 0.4);
    stats.shots++;
    stats.xg = Math.round((stats.xg + xg) * 100) / 100;
    // O treinador de goleiros do usuário transforma algumas finalizações em defesas.
    const keeper =
      ours && clubId !== career.clubId
        ? 1 - goalkeepingEffect(staffLevel(career, 'goalkeeping')).save
        : 1;
    const initialGoal = rng() < xg * keeper;
    const goal = initialGoal;
    if (goal) {
      if (isHome) match.homeGoals++;
      else match.awayGoals++;
    }
    const type = goal ? 'goal' : rng() < 0.55 ? 'save' : 'miss';
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
      xg: Math.round(xg * 100) / 100,
      origin,
      text: goal
        ? `GOL! ${scorer.name} marca para o ${club.name}${origin === 'penalty' ? ' de pênalti' : longFreeKick ? ' após cobrança de falta' : origin === 'freeKick' ? ' em cobrança de falta' : origin === 'corner' ? ' após escanteio' : ''}!${helper && helper.id !== scorer.id ? ` Passe de ${helper.name}.` : ''}`
        : type === 'save'
          ? `${scorer.name} finaliza${origin === 'penalty' ? ' o pênalti' : longFreeKick ? ' após cobrança de falta' : origin === 'freeKick' ? ' a falta' : origin === 'corner' ? ' após escanteio' : ''}. O goleiro faz a defesa!`
          : `${scorer.name} finaliza${origin === 'penalty' ? ' o pênalti' : longFreeKick ? ' após cobrança de falta' : origin === 'freeKick' ? ' a falta' : origin === 'corner' ? ' o escanteio' : ''} para fora.`,
    });
  }
  const athlete = players[Math.floor(rng() * players.length)];
  const offender = athlete?.position === 'GK' ? players.find((p) => p.position !== 'GK') : athlete;
  const cardFactor = clubId === career.clubId && activeShout === 'acalmar' ? 0.9 : 1;
  if (offender && rng() < (0.025 + tactic.pressure * 0.003) * cardFactor) {
    const second = match.events.some(
      (event) =>
        event.type === 'yellow' && event.clubId === clubId && event.playerId === offender.id,
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
      injuryRisk(stateOf(career, athlete.id)!.fitness - (match.energySpent[athlete.id] || 0)) *
        (clubId === career.clubId ? (1 - trainingEffect().injury) * (1 - physio.injury) : 1)
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
  if (minute === 45)
    match.events.push({
      minute,
      type: 'half',
      clubId,
      text: 'Intervalo. Hora de ajustar o plano.',
    });
  if (minute === 90 && ours) {
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

/**
 * Técnico da IA: troca lesionados na hora e, nas janelas do 2º tempo, compara cada titular
 * (overall na função × condição atual × desgaste) com o melhor reserva para a mesma função.
 * Perdendo, prioriza pernas novas no ataque; ganhando, reforça a marcação; amarelados em
 * risco de expulsão saem antes. No máximo cinco trocas.
 */
function aiSubstitutions(
  career: Career,
  world: World,
  match: Match,
  fixture: Fixture,
  minute: number,
) {
  if ((match.aiSubs ?? 0) >= 5) return;
  const rivalHome = fixture.awayId === career.clubId;
  const clubId = rivalHome ? fixture.homeId : fixture.awayId;
  const lineup = rivalHome ? match.homeLineup : match.awayLineup;
  const formation = (rivalHome ? match.homeTactic : match.awayTactic)?.formation || npcFormation;
  const roles = formations[formation];
  const diff = rivalHome ? match.homeGoals - match.awayGoals : match.awayGoals - match.homeGoals;
  const slots = lineup
    .map((id, i) => ({ id, i, role: roles[i] }))
    .filter((s) => !match.dismissed.includes(s.id));
  const hurt = slots.find((s) => match.injured.includes(s.id));
  const window = [46, 58, 64, 70, 76, 82].includes(minute);
  if (!hurt && !window) return;
  const bench = squad(career, world, clubId).filter(
    (p) => !lineup.includes(p.id) && !match.replaced.includes(p.id) && available(career, p.id),
  );
  if (!bench.length) return;
  const attacking = ['ST', 'LW', 'RW', 'AM', 'LM', 'RM'];
  const defensive = ['GK', 'CB', 'LB', 'RB', 'DM'];
  const booked = (id: string) =>
    match.events.some((e) => e.type === 'yellow' && e.clubId === clubId && e.playerId === id);
  const current = (id: string, role: string) => {
    const p = findPlayer(world, id);
    const s = stateOf(career, id);
    if (!p || !s) return 0;
    const spent = match.energySpent[id] || 0;
    return (
      overall(p, role, s) *
      conditionFactor(s.fitness - spent) *
      (1 - Math.min(0.08, spent * 0.003)) *
      (match.injured.includes(id) ? 0.4 : 1) *
      (booked(id) && minute >= 58 && defensive.includes(role) ? 0.94 : 1)
    );
  };
  const fresh = (p: Player, role: string) =>
    overall(p, role, stateOf(career, p.id)) * conditionFactor(stateOf(career, p.id)!.fitness);
  let best: { slot: (typeof slots)[number]; incoming: Player; gain: number } | null = null;
  for (const slot of hurt ? [hurt] : slots) {
    const options = bench.filter((p) => (slot.role === 'GK') === (p.position === 'GK'));
    const incoming = options.sort((a, b) => fresh(b, slot.role) - fresh(a, slot.role))[0];
    if (!incoming) continue;
    let gain = fresh(incoming, slot.role) - current(slot.id, slot.role);
    if (diff < 0 && minute >= 64 && attacking.includes(slot.role)) gain *= 1.6;
    if (diff > 0 && minute >= 70 && defensive.includes(slot.role)) gain *= 1.5;
    if (!best || gain > best.gain) best = { slot, incoming, gain };
  }
  if (!best || (!hurt && best.gain < (minute >= 70 ? 0.8 : 1.6))) return;
  const { slot, incoming } = best;
  const outgoing = findPlayer(world, slot.id);
  if (!outgoing) return;
  lineup[slot.i] = incoming.id;
  match.replaced.push(slot.id);
  match.aiSubs = (match.aiSubs ?? 0) + 1;
  const reason = hurt
    ? 'lesão'
    : booked(slot.id) && defensive.includes(slot.role) && minute >= 58
      ? 'amarelado, evita a expulsão'
      : diff < 0 && attacking.includes(slot.role)
        ? 'precisa do gol: perna nova no ataque'
        : diff > 0 && defensive.includes(slot.role)
          ? 'segura o resultado e reforça a marcação'
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
    throw new Error(
      `Aguarde ${15 - (match.minute - match.lastShout)} minutos para outra instrução.`,
    );
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
  return c;
}
