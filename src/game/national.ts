import { competitionName } from './calendar';
import { notify, remember } from './chronicle';
import {
  canReleaseForInternational,
  eligibleForBrazil,
  internationalWindows,
  nationalLineup,
  recommendCallups,
  refreshInternationalDuty,
  resetNationalRoles,
} from './international';
import { beginMatch, stepMatch } from './matches';
import { BRAZIL_NATIONAL_ID, clubById, nationalTeams } from './npc';
import { clamp, hash } from './random';
import { type Career, type Fixture, type World } from './types';

export function nationalFixtures(season: number): Fixture[] {
  const opponents = nationalTeams.filter((team) => team.id !== BRAZIL_NATIONAL_ID);
  return internationalWindows(season).map(({ matchDate }, index) => {
    const rival = opponents[(index + season - 2026) % opponents.length];
    const home = index % 2 === 0;
    return {
      id: `${season}-selecao-${index + 1}`,
      date: matchDate,
      cup: 'SEL',
      stage: 'Amistoso internacional',
      round: index + 1,
      homeId: home ? BRAZIL_NATIONAL_ID : rival.id,
      awayId: home ? rival.id : BRAZIL_NATIONAL_ID,
      playoff: false,
    };
  });
}

export function nextNationalFixture(career: Career): Fixture | undefined {
  return career.national?.fixtures.find((fixture) => !fixture.result);
}

function nationalLineupReady(career: Career, world: World): boolean {
  const national = career.national;
  if (!national || national.lineup.length !== 11 || new Set(national.lineup).size !== 11)
    return false;
  return national.lineup.every((id, index) => {
    const player = world.players.find((item) => item.id === id);
    const state = career.players[id];
    return Boolean(
      player &&
        state &&
        national.callups.includes(id) &&
        eligibleForBrazil(career, player) &&
        !state.injuryDays &&
        state.fitness >= 30 &&
        !(national.suspensions[id] > 0) &&
        (index !== 0 || player.position === 'GK'),
    );
  });
}

export function acceptNationalJob(career: Career, world: World): Career {
  if (!career.living.nationalInvite) throw new Error('Você ainda não recebeu convite da Seleção.');
  if (career.national) throw new Error('Você já comanda a Seleção.');
  const c = structuredClone(career);
  c.national = {
    callups: recommendCallups(c, world),
    lineup: [],
    roles: {},
    tactic: { ...c.tactic },
    fixtures: nationalFixtures(c.season).filter((fixture) => fixture.date >= c.date),
    suspensions: {},
  };
  c.national.lineup = nationalLineup(c, world);
  resetNationalRoles(c);
  refreshInternationalDuty(c, world);
  remember(c, 'cargo', 'Aceitou o comando da Seleção Brasileira em paralelo ao clube');
  notify(c, {
    kind: 'staff',
    from: 'Seleção Brasileira',
    title: 'Novo trabalho na Seleção',
    body: 'Escolha os convocados e a escalação em Temporada → Seleção. Os jogos e as datas são simulados.',
  });
  return c;
}

export function autoSelectNational(career: Career, world: World): Career {
  const c = structuredClone(career);
  if (!c.national || c.national.activeMatch) throw new Error('A convocação não pode ser alterada agora.');
  c.national.callups = recommendCallups(c, world);
  c.national.lineup = nationalLineup(c, world);
  resetNationalRoles(c);
  refreshInternationalDuty(c, world);
  return c;
}

export function toggleNationalCallup(career: Career, world: World, playerId: string): Career {
  const c = structuredClone(career);
  const national = c.national;
  if (!national || national.activeMatch) throw new Error('A convocação não pode ser alterada agora.');
  const index = national.callups.indexOf(playerId);
  if (index >= 0) national.callups.splice(index, 1);
  else {
    const player = world.players.find((item) => item.id === playerId);
    if (!player || !eligibleForBrazil(c, player))
      throw new Error('Esse atleta não está disponível para a Seleção Brasileira.');
    if (national.callups.length >= 23) throw new Error('A convocação permite até 23 atletas.');
    const called = new Set(national.callups);
    const duty = c.international;
    if (duty && c.date >= duty.from && c.date <= duty.until)
      for (const [id, country] of Object.entries(duty.players))
        if (country !== 'Brasil') called.add(id);
    if (!canReleaseForInternational(c, world, playerId, called))
      throw new Error('A convocação deixaria o clube sem onze atletas disponíveis ou sem goleiro.');
    national.callups.push(playerId);
  }
  if (index >= 0 || national.lineup.length < 11) national.lineup = nationalLineup(c, world);
  resetNationalRoles(c);
  refreshInternationalDuty(c, world);
  return c;
}

export function swapNationalStarter(
  career: Career,
  world: World,
  outgoing: string,
  incoming: string,
): Career {
  const c = structuredClone(career);
  const national = c.national;
  if (!national || national.activeMatch) throw new Error('A escalação não pode ser alterada agora.');
  const slot = national.lineup.indexOf(outgoing);
  const player = world.players.find((item) => item.id === incoming);
  const state = c.players[incoming];
  if (
    slot < 0 ||
    !player ||
    !state ||
    !eligibleForBrazil(c, player) ||
    !national.callups.includes(incoming) ||
    national.lineup.includes(incoming) ||
    state.injuryDays > 0 ||
    state.fitness < 30 ||
    national.suspensions[incoming] > 0
  )
    throw new Error('Escolha um titular e um reserva convocado disponível.');
  if (slot === 0 && player.position !== 'GK')
    throw new Error('O titular no gol precisa ser goleiro.');
  national.lineup[slot] = incoming;
  return c;
}

/** Adapta a partida sem alterar os contratos ou o clube real dos convocados. */
export function nationalMatchCareer(career: Career): Career {
  const national = career.national;
  if (!national) throw new Error('Você ainda não comanda a Seleção.');
  const players = { ...career.players };
  for (const id of national.callups) {
    const state = players[id];
    if (state)
      players[id] = {
        ...state,
        clubId: BRAZIL_NATIONAL_ID,
        suspension: national.suspensions[id] || 0,
      };
  }
  return {
    ...career,
    clubId: BRAZIL_NATIONAL_ID,
    challenge: 'Realista',
    players,
    fixtures: [...career.fixtures, ...national.fixtures],
    lineup: [...national.lineup],
    roles: { ...national.roles },
    tactic: { ...national.tactic },
    activeMatch: national.activeMatch,
    international: undefined,
  };
}

/** Devolve apenas o estado da Seleção e efeitos humanos, preservando o clube de origem. */
export function mergeNationalMatch(career: Career, projected: Career): Career {
  const national = career.national;
  if (!national) throw new Error('Não há trabalho na Seleção para atualizar.');
  const players = { ...career.players };
  for (const id of national.callups) {
    const before = players[id];
    const after = projected.players[id];
    if (before && after)
      players[id] = { ...after, clubId: before.clubId, suspension: before.suspension };
  }
  return {
    ...career,
    players,
    memories: projected.memories,
    national: {
      ...national,
      lineup: [...projected.lineup],
      roles: { ...projected.roles },
      tactic: { ...projected.tactic },
      activeMatch: projected.activeMatch,
    },
  };
}

export function beginNationalMatch(career: Career, world: World): Career {
  const c = structuredClone(career);
  const national = c.national;
  const fixture = nextNationalFixture(c);
  if (!national || !fixture || fixture.date > c.date)
    throw new Error('Não há jogo da Seleção marcado para hoje.');
  if (c.activeMatch || national.activeMatch)
    throw new Error('Conclua a partida em andamento antes de começar outra.');
  if (!nationalLineupReady(c, world))
    throw new Error('Escale onze convocados disponíveis, incluindo um goleiro, antes da partida.');
  const projection = nationalMatchCareer(c);
  national.activeMatch = beginMatch(projection, world, fixture);
  return c;
}

export function finishNationalMatch(career: Career, world: World): Career {
  const c = structuredClone(career);
  const national = c.national;
  const match = national?.activeMatch;
  const fixture = national?.fixtures.find((item) => item.id === match?.fixtureId);
  if (!national || !match || match.minute !== 90 || !fixture || fixture.result)
    throw new Error('A partida da Seleção ainda não terminou ou já foi registrada.');
  fixture.result = match;
  for (const id of Object.keys(national.suspensions))
    national.suspensions[id] = Math.max(0, national.suspensions[id] - 1);
  for (const id of Object.keys(match.minutesPlayed)) {
    const state = c.players[id];
    if (!state || !national.callups.includes(id)) continue;
    state.fitness = clamp(state.fitness - (match.energySpent[id] || 0));
    state.sharpness = clamp(state.sharpness + 2);
  }
  for (const event of match.events) {
    if (!event.playerId || event.clubId !== BRAZIL_NATIONAL_ID) continue;
    const state = c.players[event.playerId];
    if (!state) continue;
    if (event.type === 'red')
      national.suspensions[event.playerId] = (national.suspensions[event.playerId] || 0) + 1;
    if (event.type === 'injury') {
      state.injuryDays = 3 + (hash(`${match.seed}:${event.playerId}:${event.minute}`) % 25);
      if (state.clubId === c.clubId)
        notify(c, {
          kind: 'staff',
          from: 'Departamento médico',
          title: 'Lesão em jogo da Seleção',
          body: `${world.players.find((player) => player.id === event.playerId)?.name || 'O atleta'} ficará fora por ${state.injuryDays} dias.`,
          playerId: event.playerId,
        });
    }
  }
  const ownHome = fixture.homeId === BRAZIL_NATIONAL_ID;
  const rival = clubById(world, ownHome ? fixture.awayId : fixture.homeId);
  const scored = ownHome ? match.homeGoals : match.awayGoals;
  const conceded = ownHome ? match.awayGoals : match.homeGoals;
  const result = scored > conceded ? 'Venceu' : scored < conceded ? 'Perdeu para' : 'Empatou com';
  remember(c, 'marco', `${result} ${rival.name} pela Seleção (${scored} × ${conceded})`);
  notify(c, {
    kind: 'news',
    from: 'Seleção Brasileira',
    title: `Brasil ${scored} × ${conceded} ${rival.name}`,
    body: `${competitionName(fixture.cup || 'SEL')}: resultado registrado na carreira internacional.`,
  });
  delete national.activeMatch;
  return c;
}

export function simulateNationalMatch(career: Career, world: World): Career {
  let c = career;
  const national = c.national;
  if (!national) throw new Error('Você ainda não comanda a Seleção.');
  if (!nationalLineupReady(c, world)) {
    c = autoSelectNational(c, world);
    notify(c, {
      kind: 'staff',
      from: 'Seleção Brasileira',
      title: 'Convocação ajustada no avanço automático',
      body: 'O modo automático convocou atletas disponíveis para completar a escalação.',
    });
  }
  c = beginNationalMatch(c, world);
  const projection = nationalMatchCareer(c);
  let match = projection.activeMatch!;
  while (match.minute < 90) match = stepMatch(projection, world, match);
  c = mergeNationalMatch(c, { ...projection, activeMatch: match });
  return finishNationalMatch(c, world);
}
