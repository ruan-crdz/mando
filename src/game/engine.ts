import { addDays, ageAt, clamp, hash, random } from './random';
import {
  available,
  bestLineup,
  reconcileSquad,
  simulateMatch,
  squad,
  syncBenchWithLineup,
  validateLineup,
} from './matches';
import { competitionName, createSchedule, fixtureLabel, nextFixture } from './calendar';
import { endLoan, expireThread, processOffers } from './transfers';
import { payroll, settleFee } from './market';
import { overall } from './ratings';
import { LEARNED, TRAIN_CAP, familiarity, positionNames, trainingGain } from './positions';
import { clubById, findPlayer, isForeign, knownClub } from './npc';
import { baseWorld, careerWorld } from './live';
import { scoutReport } from './scouting';
import { livingAfterMatch, livingDay, livingSeasonEnd } from './living';
import { regionOf } from './context';
import { remember } from './chronicle';
import { assistantTrainingBonus } from './squadManagement';
import {
  fitnessEffect,
  goalkeepingEffect,
  medicalEffect,
  staffLevel,
  staffPayroll,
  checkPlayerSalaryBudget,
  youthCoachEffect,
} from './staff';
import { economyMonth, trainingEffect, youthBonus } from './economy';
import {
  createCups,
  cupsFinished,
  initialQualification,
  progressCups,
  roundRobin,
  table,
  type Qualification,
} from './competitions';
import {
  attributeKeys,
  careerSchema,
  livingSchema,
  managerSchema,
  roleNames,
  type Attributes,
  type Career,
  type Manager,
  type Match,
  type Message,
  type Player,
  type PlayerState,
  type Position,
  type TableRow,
  type World,
} from './types';

export function standings(career: Career, world: World, league: 'A' | 'B'): TableRow[] {
  const live = careerWorld(world, career);
  return table(
    career.fixtures.filter((f) => f.league === league && !f.playoff),
    live.clubs.filter((c) => c.league === league).map((c) => c.id),
  );
}

export const currentLeague = (career: Career, world: World) =>
  careerWorld(world, career).clubs.find((c) => c.id === career.clubId)!.league;

function message(
  c: Career,
  data: Pick<Message, 'from' | 'title' | 'body' | 'kind'> & Partial<Message>,
) {
  c.messages.unshift({
    id: `msg-${hash(`${c.id}:${c.date}:${data.title}:${c.messages.length}`)}`,
    date: c.date,
    important: false,
    read: false,
    resolved: false,
    ...data,
  });
}

export function createCareer(
  world: World,
  manager: Manager,
  clubId: string,
  difficulty: Career['difficulty'],
  challenge: Career['challenge'],
  seed = hash(crypto.randomUUID()),
): Career {
  const club = world.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube inexistente.');
  const c: Career = {
    version: 1,
    id: crypto.randomUUID(),
    worldId: world.id,
    mode: world.mode,
    manager,
    onboarding: { contractSigned: false, tutorialComplete: false },
    clubId,
    difficulty,
    challenge,
    date: world.date,
    seed,
    players: Object.fromEntries(
      world.players.map((p) => [
        p.id,
        {
          clubId: p.clubId,
          fitness: 90,
          morale: 75,
          injuryDays: 0,
          yellow: 0,
          suspension: 0,
          growth: 0,
          minutes: 0,
          goals: 0,
          assists: 0,
          wage: p.wage,
          contractEnd: p.contractEnd,
          relationship: 65,
          benchGames: 0,
          ratingTotal: 0,
          rated: 0,
          monthlyRatingTotal: 0,
          monthlyRated: 0,
          personality: (
            ['Profissional', 'Ambicioso', 'Temperamental', 'Leal', 'Disciplinado', 'Líder'] as const
          )[hash(`${seed}:${p.id}:personality`) % 6],
          sharpness: 50,
          potentialDelta: 0,
          development: 'Equilibrado',
          role: 'Padrão',
          clause: Math.round(p.value * (2.1 + (hash(`${seed}:${p.id}:clause`) % 90) / 100)),
        },
      ]),
    ),
    finances: Object.fromEntries(
      world.clubs.map((club) => [
        club.id,
        {
          cash: club.budget * 2,
          transferBudget: club.budget,
          debt: club.debt,
          history: [],
        },
      ]),
    ),
    fixtures: createSchedule(world.clubs, 2026),
    lineup: [],
    bench: [],
    benchConfigured: false,
    savedLineups: [],
    assistantCoaches: {},
    roles: {},
    tactic: {
      formation: '4-2-3-1',
      mentality: 'Equilibrada',
      pressure: 3,
      width: 3,
      tempo: 3,
      line: 3,
    },
    messages: [],
    offers: [],
    sales: 0,
    memories: [],
    seasonEnded: false,
    promoted: [],
    relegated: [],
    season: 2026,
    leagues: {},
    youth: [],
    honours: [],
    numbers: {},
    shortlist: [],
    scouts: [],
    prospects: [],
    jobOffers: [],
    preContracts: [],
    prefs: { advance: 'day' },
    history: [],
    living: livingSchema.parse({
      managerRecord: { since: world.date },
      managerTitles: { since: world.date },
    }),
  };
  createCups(c, world, 2026, initialQualification(world));
  if (challenge === 'Do zero') c.finances[clubId].transferBudget = 0;
  if (challenge === 'Crise financeira') {
    c.finances[clubId].debt *= 1.6;
    c.finances[clubId].cash *= 0.5;
  }
  if (challenge === 'Reconstrução') {
    for (const p of squad(c, world))
      if (ageAt(p.birthDate, c.date) >= 30) c.players[p.id].fitness = 72;
    c.finances[clubId].transferBudget *= 0.6;
  }
  c.lineup = bestLineup(c, world);
  if (c.lineup.length < 11) throw new Error('O elenco não tem onze atletas disponíveis.');
  for (const role of roleNames) c.roles[role] = c.lineup[role === 'Capitão' ? 2 : 10];
  const captain = squad(c, world).sort(
    (a, b) => ageAt(b.birthDate, c.date) - ageAt(a.birthDate, c.date) || overall(b) - overall(a),
  )[0];
  c.roles['Capitão'] = captain.id;
  c.bench = squad(c, world)
    .filter((player) => !c.lineup.includes(player.id))
    .sort((a, b) => overall(b) - overall(a))
    .slice(0, 9)
    .map((player) => player.id);
  c.benchConfigured = true;
  ensureAcademy(c, world);
  captainWelcome(c, world);
  message(c, {
    from: 'Imprensa esportiva',
    kind: 'news',
    title: `Novo comando no ${club.name}`,
    body: `A chegada de ${manager.firstName} ${manager.lastName} abre um novo capítulo no clube. A torcida espera ver as primeiras escolhas dentro e fora de campo.`,
  });
  message(c, {
    from: 'Presidência',
    kind: 'board',
    title: 'Boas-vindas ao clube',
    body: `Conte com a diretoria durante esta temporada. ${club.league === 'A' ? 'Queremos terminar entre os seis primeiros.' : 'O objetivo esportivo é disputar o acesso.'} O escritório reúne mensagens, decisões e informações do clube.`,
  });
  message(c, {
    from: 'Assistente técnico',
    kind: 'staff',
    title: 'Vamos começar pelo elenco',
    body: 'A escalação e as funções da equipe estão no Central. Consulte o calendário antes de avançar o tempo; a simulação para em partidas e decisões importantes.',
  });
  message(c, {
    from: 'Comissão técnica',
    kind: 'staff',
    title: 'Rotina de trabalho',
    body: 'A equipe está pronta para iniciar os trabalhos. Acompanhe o Escritório para ler as mensagens da comissão e da diretoria.',
  });
  scoutNext(c, careerWorld(world, c));
  return careerSchema.parse(c);
}

function applyMatch(c: Career, world: World, result: Match) {
  const fixture = c.fixtures.find((f) => f.id === result.fixtureId);
  if (!fixture || fixture.result || result.minute !== 90)
    throw new Error('Resultado inválido ou já registrado.');
  fixture.result = result;
  livingAfterMatch(c, world, fixture, result);
  const isOurs = fixture.homeId === c.clubId || fixture.awayId === c.clubId;
  const allIds = Object.keys(result.minutesPlayed);
  for (const clubId of [fixture.homeId, fixture.awayId]) {
    for (const p of squad(c, world, clubId)) {
      const s = c.players[p.id];
      if (!s) continue;
      if (s.suspension > 0) s.suspension--;
      if (allIds.includes(p.id)) {
        s.minutes += result.minutesPlayed[p.id];
        s.fitness = clamp(s.fitness - result.energySpent[p.id]);
        s.sharpness = clamp(s.sharpness + Math.max(2, Math.round(result.minutesPlayed[p.id] / 8)));
        s.benchGames = 0;
        const rating = result.ratings[p.id];
        if (rating) {
          s.ratingTotal = (s.ratingTotal || 0) + rating;
          s.rated = (s.rated || 0) + 1;
          s.monthlyRatingTotal += rating;
          s.monthlyRated++;
        }
        // Números do empréstimo (opção/obrigação de compra).
        if (s.loan && s.loanFrom && s.clubId === clubId) {
          s.loan.games++;
          s.loan.ratingSum += rating || 6;
        }
      } else {
        s.benchGames++;
        s.sharpness = clamp(s.sharpness - 2);
      }
    }
  }
  for (const e of result.events) {
    if (!e.playerId) continue;
    const s = c.players[e.playerId];
    if (!s) continue;
    if (e.type === 'goal') {
      s.goals++;
      s.morale = clamp(s.morale + 3);
      const helper = e.assistId ? c.players[e.assistId] : undefined;
      if (helper) helper.assists++;
    }
    if (e.type === 'yellow') {
      s.yellow++;
      if (s.yellow % 3 === 0) s.suspension++;
    }
    if (e.type === 'red') s.suspension++;
    if (e.type === 'injury') {
      s.injuryDays = 3 + (hash(`${result.seed}:${e.playerId}:${e.minute}`) % 25);
      if (s.clubId === c.clubId)
        s.injuryDays = Math.max(
          1,
          Math.round(
            s.injuryDays *
              (1 - trainingEffect().injury) *
              (1 - medicalEffect(staffLevel(c, 'medical')).days),
          ),
        );
      if (s.clubId === c.clubId)
        message(c, {
          kind: 'staff',
          from: 'Departamento médico',
          title: 'Lesão confirmada',
          body: `${findPlayer(world, e.playerId)!.name} ficará fora por ${s.injuryDays} dias.`,
          important: true,
          playerId: e.playerId,
        });
    }
  }
  const homeFinance = c.finances[fixture.homeId];
  if (homeFinance) {
    const income = Math.round(
      clubById(world, fixture.homeId).reputation *
        12000 *
        (1 + (isOurs ? 0.1 : 0)) *
        (fixture.cup && fixture.cup !== 'EST' && !fixture.cup.startsWith('EST-') ? 1.3 : 1),
    );
    homeFinance.cash += income;
    homeFinance.history.push({ date: c.date, income, expenses: 0, balance: homeFinance.cash });
  }
  if (isOurs) {
    const goals =
      fixture.homeId === c.clubId
        ? result.homeGoals - result.awayGoals
        : result.awayGoals - result.homeGoals;
    for (const p of squad(c, world))
      c.players[p.id].morale = clamp(c.players[p.id].morale + (goals > 0 ? 3 : goals < 0 ? -4 : 0));
    const label = fixtureLabel(fixture);
    message(c, {
      kind: 'news',
      from: 'Mando Esportes',
      title: `${clubById(world, fixture.homeId).name} ${result.homeGoals} × ${result.awayGoals} ${clubById(world, fixture.awayId).name}`,
      body: `${label.name} · ${label.stage}. ${
        goals > 0
          ? 'Uma vitória para fortalecer o trabalho.'
          : goals < 0
            ? 'O próximo compromisso oferece a oportunidade de resposta.'
            : 'Equilíbrio em campo. Os próximos ajustes serão feitos no time.'
      }`,
    });
  } else {
    // Partidas simuladas em segundo plano guardam apenas o essencial para manter o save leve.
    result.events = result.events.filter((e) => e.type === 'goal');
    result.homeLineup = [];
    result.awayLineup = [];
    result.replaced = [];
    result.ratings = {};
    result.minutesPlayed = {};
    result.energySpent = {};
    result.injured = [];
  }
}

function monthlyReviews(c: Career, world: World) {
  for (const p of world.players) {
    const s = c.players[p.id];
    if (s) {
      s.monthlyRatingTotal = 0;
      s.monthlyRated = 0;
    }
    if (!s || s.retired || s.clubId !== c.clubId || ageAt(p.birthDate, c.date) > 25) continue;
    const average = s.rated ? (s.ratingTotal || 0) / s.rated : 6.2;
    if (s.minutes >= 360 && average >= 7.2) s.potentialDelta = clamp(s.potentialDelta + 0.4, -8, 8);
    else if (s.minutes >= 360 && average < 6.2)
      s.potentialDelta = clamp(s.potentialDelta - 0.3, -8, 8);
    else if (s.minutes < 90) s.potentialDelta = clamp(s.potentialDelta - 0.1, -8, 8);
  }
  if (c.jobOffers.length === 0) {
    const ownRank =
      standings(c, world, world.clubs.find((club) => club.id === c.clubId)!.league).findIndex(
        (row) => row.clubId === c.clubId,
      ) + 1;
    if (ownRank > 0 && ownRank <= 3) {
      const offers = world.clubs
        .filter(
          (club) =>
            club.id !== c.clubId &&
            club.reputation > world.clubs.find((x) => x.id === c.clubId)!.reputation,
        )
        .sort((a, b) => a.reputation - b.reputation)
        .slice(0, 2);
      c.jobOffers = offers.map((club) => ({
        id: `job-${hash(`${c.id}:${c.date}:${club.id}`)}`,
        clubId: club.id,
        expires: addDays(c.date, 14),
        salary: Math.round(club.reputation * 15000),
      }));
      if (c.jobOffers.length)
        message(c, {
          kind: 'board',
          from: 'Agente',
          title: 'Propostas de outros clubes',
          body: 'Seu bom trabalho chamou atenção no mercado. Consulte as oportunidades no painel da diretoria.',
        });
    }
  }
}

function updateSeason(c: Career, world: World) {
  const y = c.season;
  const knownHonours = new Set(c.honours.map((h) => `${h.season}:${h.competition}`));
  const regularB = c.fixtures.filter((f) => f.league === 'B' && !f.playoff);
  if (regularB.length && regularB.every((f) => f.result) && !c.fixtures.some((f) => f.playoff)) {
    const table = standings(c, world, 'B');
    for (const [i, j] of [
      [2, 5],
      [3, 4],
    ]) {
      for (let leg = 0; leg < 2; leg++)
        c.fixtures.push({
          id: `${y}-B-playoff-${i}-${leg}`,
          date: leg === 0 ? `${y}-11-21` : `${y}-11-28`,
          league: 'B',
          round: 39 + leg,
          homeId: table[leg === 0 ? j : i].clubId,
          awayId: table[leg === 0 ? i : j].clubId,
          playoff: true,
        });
    }
    c.fixtures.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    message(c, {
      kind: 'news',
      from: 'Liga',
      title: 'Playoffs de acesso definidos',
      body: '3º × 6º e 4º × 5º, ida e volta. Empate no agregado favorece a melhor campanha. Campeão e vice sobem diretamente.',
    });
  }
  const playoffs = c.fixtures.filter((f) => f.playoff);
  if (playoffs.length === 4 && playoffs.every((f) => f.result) && c.promoted.length === 0) {
    const table = standings(c, world, 'B');
    c.promoted = table.slice(0, 2).map((r) => r.clubId);
    for (const rank of [2, 3]) {
      const high = table[rank].clubId;
      const pair = playoffs.filter((f) => f.homeId === high || f.awayId === high);
      const balance = pair.reduce(
        (n, f) =>
          n +
          (f.homeId === high
            ? f.result!.homeGoals - f.result!.awayGoals
            : f.result!.awayGoals - f.result!.homeGoals),
        0,
      );
      c.promoted.push(
        balance >= 0 ? high : pair[0].homeId === high ? pair[0].awayId : pair[0].homeId,
      );
    }
  }
  for (const notice of progressCups(c, world)) {
    const ours = notice.clubs.includes(c.clubId);
    if (!ours) continue;
    if (ours && notice.champion && notice.clubs[0] === c.clubId) {
      for (const p of squad(c, world)) c.players[p.id].morale = clamp(c.players[p.id].morale + 6);
    }
    message(c, {
      kind: 'news',
      from: competitionName(notice.cup),
      title: notice.title,
      body: notice.body,
    });
  }
  if (c.fixtures.every((f) => f.result) && cupsFinished(c) && !c.seasonEnded) {
    c.seasonEnded = true;
    for (const league of ['A', 'B'] as const) {
      const champion = standings(c, world, league)[0];
      if (champion && !c.honours.some((h) => h.season === y && h.competition === league))
        c.honours.push({ season: y, competition: league, clubId: champion.clubId });
    }
    // A Série C não é simulada: apenas a Série A tem rebaixamento efetivo.
    c.relegated = standings(c, world, 'A')
      .slice(-4)
      .map((r) => r.clubId);
    message(c, {
      kind: 'board',
      from: 'Presidência',
      title: `Temporada ${y} encerrada`,
      body: `O relatório final e os campeões estão na aba Temporada. Quando estiver pronto, inicie a temporada ${y + 1} pela Central.`,
      important: true,
    });
  }
  for (const honour of c.honours) {
    if (honour.clubId !== c.clubId || knownHonours.has(`${honour.season}:${honour.competition}`))
      continue;
    const titles = (c.living.managerTitles ??= { since: c.date, entries: [] });
    titles.entries.push({ ...honour, date: c.date });
    remember(c, 'titulo', `Campeão: ${competitionName(honour.competition)} ${honour.season}`);
  }
}

export function finishMatch(career: Career, world: World): Career {
  const c = structuredClone(career);
  const live = careerWorld(world, c);
  if (!c.activeMatch || c.activeMatch.minute !== 90)
    throw new Error('A partida ainda não terminou.');
  applyMatch(c, live, c.activeMatch);
  delete c.activeMatch;
  updateSeason(c, live);
  return c;
}

/** Um dia de treino na posição escolhida; avisa quando o atleta aprende a função. */
function trainPosition(c: Career, player: Player, s: PlayerState) {
  const role = s.training!;
  if (role === player.position) {
    delete s.training;
    return;
  }
  const before = familiarity(player, role, s);
  const after = Math.min(
    TRAIN_CAP,
    before +
      (s.injuryDays
        ? 0.2
        : trainingGain(ageAt(player.birthDate, c.date)) * (1 + assistantTrainingBonus(c, role))),
  );
  s.trained = { ...s.trained, [role]: Math.round(after * 10) / 10 };
  if (before < LEARNED && after >= LEARNED)
    message(c, {
      kind: 'staff',
      from: 'Auxiliar técnico',
      title: `${player.name} já joga de ${positionNames[role].toLowerCase()}`,
      body: `Depois das sessões específicas, ${player.name} entendeu a função de ${positionNames[role].toLowerCase()}. Ele já pode atuar ali sem perder rendimento.`,
      playerId: player.id,
    });
  if (after >= TRAIN_CAP) delete s.training;
}

export function hireScout(career: Career, world: World, region: string): Career {
  const c = structuredClone(career);
  if (c.scouts.length >= 3)
    throw new Error('A rede de olheiros já tem o limite de três profissionais.');
  const cost = 500000 + c.scouts.length * 250000;
  const finance = c.finances[c.clubId];
  if (finance.cash < cost) throw new Error('Caixa insuficiente para contratar um olheiro.');
  finance.cash -= cost;
  finance.history.push({ date: c.date, income: 0, expenses: cost, balance: finance.cash });
  const id = `scout-${hash(`${c.id}:${c.date}:${region}:${c.scouts.length}`)}`;
  c.scouts.push({
    id,
    name: ['Marcos Vieira', 'Renata Campos', 'Paulo Nogueira'][hash(id) % 3],
    region,
    skill: Math.min(5, 2 + Math.floor(clubById(world, c.clubId).reputation / 35)),
    progress: 0,
  });
  return careerSchema.parse(c);
}

export function fireScout(career: Career, scoutId: string): Career {
  const c = structuredClone(career);
  const index = c.scouts.findIndex((s) => s.id === scoutId);
  if (index < 0) throw new Error('Olheiro não encontrado.');
  c.scouts.splice(index, 1);
  return careerSchema.parse(c);
}

/** Muda o destino de um olheiro; a observação em andamento recomeça do zero. */
export function reassignScout(career: Career, scoutId: string, region: string): Career {
  const c = structuredClone(career);
  const scout = c.scouts.find((s) => s.id === scoutId);
  if (!scout) throw new Error('Olheiro não encontrado.');
  if (scout.region === region) return career;
  scout.region = region;
  scout.progress = 0;
  return careerSchema.parse(c);
}

export function signProspect(career: Career, prospectId: string): Career {
  const c = structuredClone(career);
  const index = c.prospects.findIndex((player) => player.id === prospectId);
  if (index < 0) throw new Error('Relatório de jovem talento não encontrado.');
  const [player] = c.prospects.splice(index, 1);
  player.clubId = c.clubId;
  c.living.academyRoster.push(player);
  c.players[player.id] = freshState(player);
  return careerSchema.parse(c);
}

function promoteYoungster(career: Career, player: Player) {
  if (ageAt(player.birthDate, career.date) < 16)
    throw new Error('Só é possível promover atletas a partir de 16 anos.');
  checkPlayerSalaryBudget(career, 5000);
  player.clubId = career.clubId;
  player.contractEnd = `${career.season + 3}-12-31`;
  player.wage = 5000;
  career.youth.push(player);
  career.players[player.id] = freshState(player);
}

export function reviewAcademyCandidate(
  career: Career,
  playerId: string,
  decision: 'promote' | 'release',
): Career {
  const c = structuredClone(career);
  const academy = c.living.academy;
  const index = academy?.candidates.findIndex((player) => player.id === playerId) ?? -1;
  if (!academy || academy.clubId !== c.clubId || index < 0)
    throw new Error('Candidato da peneira não encontrado neste clube.');
  const [player] = academy.candidates.splice(index, 1);
  if (decision === 'promote') {
    promoteYoungster(c, player);
    remember(c, 'base', `${player.name} foi promovido ao profissional após a peneira do clube`);
  }
  return careerSchema.parse(c);
}

export function playerConversation(
  career: Career,
  playerId: string,
  choice: 'praise' | 'challenge' | 'promise',
): Career {
  const player = career.players[playerId];
  if (!player || player.clubId !== career.clubId)
    throw new Error('O jogador não pertence ao seu elenco.');
  const incoming = career.messages.find(
    (item) => item.kind === 'player' && item.playerId === playerId && !item.resolved,
  );
  if (!incoming)
    throw new Error('O atleta precisa iniciar a conversa. Não há mensagem aguardando resposta.');
  const c = respondMessage(career, incoming.id, choice === 'challenge' ? 'firm' : 'support');
  if (choice === 'promise') c.players[playerId].promiseUntil = addDays(c.date, 30);
  return c;
}

export function updateManager(career: Career, manager: Manager): Career {
  const parsed = managerSchema.parse({
    ...manager,
    age: manager.birthDate ? ageAt(manager.birthDate, career.date) : manager.age,
  });
  return { ...career, manager: parsed };
}

export function promoteAcademyPlayer(career: Career, playerId: string): Career {
  const c = structuredClone(career);
  const player = c.living.academyRoster.find((item) => item.id === playerId);
  if (!player || player.clubId !== c.clubId)
    throw new Error('Atleta não encontrado na base deste clube.');
  if (ageAt(player.birthDate, c.date) < 16)
    throw new Error('Só é possível promover atletas a partir de 16 anos.');
  checkPlayerSalaryBudget(c, 5000);
  c.living.academyRoster = c.living.academyRoster.filter((item) => item.id !== playerId);
  player.contractEnd = `${c.season + 3}-12-31`;
  player.wage = 5000;
  c.youth.push(player);
  c.players[player.id].wage = player.wage;
  c.players[player.id].contractEnd = player.contractEnd;
  remember(c, 'base', `${player.name} foi promovido da base ao profissional`);
  return careerSchema.parse(c);
}

function captainWelcome(c: Career, world: World) {
  const captain = findPlayer(world, c.roles['Capitão']);
  if (!captain) throw new Error('Não foi possível identificar o capitão do clube.');
  message(c, {
    kind: 'player',
    from: captain.name,
    playerId: captain.id,
    title: 'Bem-vindo, professor!',
    body: `Olá, ${c.manager.firstName}! Sou ${captain.name}, capitão do time. Prazer em trabalhar com você. Pode contar comigo para ajudar na adaptação e representar o elenco. Vamos construir uma boa temporada juntos.`,
  });
}

export function setDevelopmentPlan(
  career: Career,
  playerId: string,
  plan: PlayerState['development'],
): Career {
  const c = structuredClone(career);
  const player = c.players[playerId];
  if (!player || player.clubId !== c.clubId)
    throw new Error('O jogador não pertence ao seu elenco.');
  player.development = plan;
  return c;
}

export function setPlayerRole(career: Career, playerId: string, role: PlayerState['role']): Career {
  const c = structuredClone(career);
  const player = c.players[playerId];
  if (!player || player.clubId !== c.clubId)
    throw new Error('O jogador não pertence ao seu elenco.');
  player.role = role;
  return c;
}

export function setReleaseClause(career: Career, playerId: string, amount: number): Career {
  const c = structuredClone(career);
  const player = c.players[playerId];
  if (!player || player.clubId !== c.clubId)
    throw new Error('O jogador não pertence ao seu elenco.');
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Informe uma multa válida.');
  player.clause = Math.round(amount);
  return c;
}

export function acceptJobOffer(career: Career, world: World, offerId: string): Career {
  const c = structuredClone(career);
  const offer = c.jobOffers.find((job) => job.id === offerId);
  if (!offer || offer.expires < c.date) throw new Error('A proposta de trabalho expirou.');
  const from = clubById(world, c.clubId).name;
  c.clubId = offer.clubId;
  c.jobOffers = [];
  for (const m of c.messages)
    if (m.kind === 'board' && m.important && !m.resolved) m.resolved = m.read = true;
  remember(c, 'cargo', `Deixou o ${from} e assumiu o ${clubById(world, c.clubId).name}`);
  c.lineup = bestLineup(c, careerWorld(world, c));
  c.bench = squad(c, careerWorld(world, c))
    .filter((player) => !c.lineup.includes(player.id))
    .sort((a, b) => overall(b) - overall(a))
    .slice(0, 9)
    .map((player) => player.id);
  c.benchConfigured = true;
  c.assistantCoaches = {};
  for (const role of roleNames) c.roles[role] = c.lineup[role === 'Capitão' ? 2 : 10];
  ensureAcademy(c, world);
  captainWelcome(c, careerWorld(world, c));
  message(c, {
    kind: 'board',
    from: 'Presidência',
    title: `Novo desafio: ${clubById(world, c.clubId).name}`,
    body: `Seu contrato foi assinado por ${offer.salary.toLocaleString('pt-BR')} por mês. A torcida espera um novo começo.`,
  });
  return c;
}

/** Decisão que trava o calendário até o jogador responder. */
export const blocks = (c: Career, m: Career['messages'][number]) => m.important && !m.resolved;

export function advanceDay(career: Career, world: World): Career {
  const c = structuredClone(career);
  ensureAcademy(c, world);
  const live = careerWorld(world, c);
  if (c.seasonEnded)
    throw new Error(
      `A temporada ${c.season} está encerrada. Inicie a temporada ${c.season + 1} pela Central.`,
    );
  if (c.activeMatch) throw new Error('Conclua a partida em andamento.');
  if (c.messages.some((m) => blocks(c, m)))
    throw new Error('Há uma decisão importante pendente no escritório.');
  const fixture = nextFixture(c);
  if (fixture && fixture.date <= c.date)
    throw new Error('Hoje é dia de jogo. Prepare a equipe e comece a partida.');
  c.date = addDays(c.date, 1);
  if (c.date.endsWith('-05-01')) runAcademyTrial(c, live);
  c.jobOffers = c.jobOffers.filter((offer) => offer.expires >= c.date);
  const ct = trainingEffect();
  const physio = fitnessEffect(staffLevel(c, 'fitness'));
  const medical = medicalEffect(staffLevel(c, 'medical'));
  const keeperCoach = goalkeepingEffect(staffLevel(c, 'goalkeeping'));
  const academyIds = new Set(c.living.academyRoster.map((player) => player.id));
  for (const player of [...live.players, ...c.living.academyRoster]) {
    const s = c.players[player.id];
    if (!s || s.retired) continue;
    const rng = random(hash(`${c.seed}:${c.date}:${player.id}`));
    if (s.loanFrom && ((s.loanUntil && s.loanUntil <= c.date) || s.contractEnd < c.date))
      endLoan(c, live, player.id);
    const own = s.clubId === c.clubId;
    const academyPlayer = academyIds.has(player.id);
    const returning = s.injuryDays === 1;
    s.injuryDays = Math.max(0, s.injuryDays - 1);
    // Recaída ao voltar de lesão: o departamento médico reduz o risco.
    if (
      own &&
      returning &&
      (hash(`${c.seed}:${c.date}:${player.id}:recaida`) % 1000) / 1000 < medical.relapse
    ) {
      s.injuryDays = 3 + (hash(`${player.id}:${c.date}:recaida`) % 5);
      message(c, {
        kind: 'staff',
        from: 'Departamento médico',
        title: `Recaída de ${player.name}`,
        body: `${player.name} sentiu de novo no retorno aos treinos e ficará mais ${s.injuryDays} dias fora. Um departamento médico melhor reduz esse risco.`,
        playerId: player.id,
      });
    }
    s.fitness = clamp(s.fitness + (s.injuryDays ? 1 : 4) + (own ? physio.recovery : 0));
    s.sharpness = clamp(s.sharpness - (s.clubId === c.clubId ? ct.decay : 0.15));
    if (s.training && s.clubId === c.clubId) trainPosition(c, player, s);
    if (s.clubId && ageAt(player.birthDate, c.date) <= 27 && s.injuryDays === 0 && rng() < 0.035) {
      const target =
        player.potential +
        s.potentialDelta +
        (hash(`${c.seed}:${player.id}:potential`) % (player.uncertainty * 2 + 1)) -
        player.uncertainty;
      const personalityBoost =
        s.personality === 'Profissional' || s.personality === 'Disciplinado' ? 1.15 : 1;
      const focusedPosition =
        (s.development === 'Ataque' && ['ST', 'LW', 'RW'].includes(player.position)) ||
        (s.development === 'Criação' && ['AM', 'CM', 'DM'].includes(player.position)) ||
        (s.development === 'Defesa' && ['GK', 'CB', 'LB', 'RB', 'DM'].includes(player.position));
      const planBoost =
        s.development === 'Equilibrado'
          ? 1
          : s.development === 'Físico'
            ? 1.15
            : focusedPosition
              ? 1.3
              : 0.85;
      if (overall(player, player.position, s) < target && s.growth < 20)
        s.growth = Math.min(
          20,
          s.growth +
            0.025 *
              (0.5 + s.minutes / 1800) *
              (s.morale / 100) *
              personalityBoost *
              planBoost *
              (s.clubId === c.clubId ? 1 + ct.growth : 1) *
              (own && player.position === 'GK' ? 1 + keeperCoach.growth : 1) *
              (own ? 1 + assistantTrainingBonus(c, s.position ?? player.position) : 1),
        );
    }
    if (academyPlayer) continue;
    if (s.promiseUntil && s.promiseUntil < c.date) {
      if (s.benchGames >= 3) {
        s.morale = clamp(s.morale - 8);
        message(c, {
          kind: 'player',
          from: player.name,
          title: 'A promessa não foi cumprida',
          body: 'Eu aceitei ficar porque você prometeu minutos. Ainda espero uma oportunidade real.',
          playerId: player.id,
        });
      }
      delete s.promiseUntil;
    }
    if (s.clubId && s.contractEnd < c.date) {
      const signed = c.preContracts.find(
        (contract) => contract.playerId === player.id && !contract.joined,
      );
      if (signed) {
        settleFee(c, live, {
          playerId: player.id,
          from: s.clubId,
          to: signed.clubId,
          fee: 0,
        });
        s.clubId = signed.clubId;
        s.wage = signed.wage;
        s.contractEnd = `${c.season + 3}-12-31`;
        signed.joined = true;
        message(c, {
          kind: 'market',
          from: 'Diretor de futebol',
          title: `${player.name} assinou pré-contrato`,
          body: 'O jogador chegou sem taxa de transferência após cumprir o contrato anterior.',
          playerId: player.id,
        });
        continue;
      }
      const oldClub = s.clubId;
      s.clubId = null;
      if (oldClub === c.clubId)
        message(c, {
          kind: 'market',
          from: 'Diretor de futebol',
          title: `Contrato encerrado: ${player.name}`,
          body: 'O atleta deixou o clube como agente livre. Renove contratos antes do vencimento.',
          important: true,
        });
    }
    if (
      s.clubId === c.clubId &&
      s.benchGames >= 5 &&
      rng() < 0.006 &&
      !c.messages.some(
        (m) =>
          m.kind === 'player' &&
          (m.date > addDays(c.date, -7) ||
            (m.playerId === player.id && (!m.resolved || m.date > addDays(c.date, -28)))),
      )
    ) {
      s.morale = clamp(s.morale - 5);
      message(c, {
        kind: 'player',
        from: player.name,
        title: 'Podemos conversar sobre meu espaço?',
        body: `Já são ${s.benchGames} partidas fora da equipe. Quero entender o que preciso fazer para receber uma oportunidade.`,
        playerId: player.id,
        important: true,
      });
    }
    playAcademyFixtures(c, live);
    if (!c.messages.some((m) => m.kind === 'player' && m.date > addDays(c.date, -7))) {
      const rng = random(hash(`${c.seed}:${c.date}:player-contact`));
      const roster = squad(c, live);
      if (rng() < 0.045 && roster.length) {
        const player = roster[Math.floor(rng() * roster.length)];
        const state = c.players[player.id];
        const last = c.fixtures
          .filter((f) => f.result && (f.homeId === c.clubId || f.awayId === c.clubId))
          .at(-1);
        const won =
          last?.result &&
          (last.homeId === c.clubId
            ? last.result.homeGoals > last.result.awayGoals
            : last.result.awayGoals > last.result.homeGoals);
        if (!c.messages.some((m) => m.kind === 'player' && m.playerId === player.id && !m.resolved))
          message(c, {
            kind: 'player',
            playerId: player.id,
            from: player.name,
            title: won ? 'Boa vitória, professor!' : 'Posso pedir um conselho?',
            body: won
              ? 'Gostei de como a equipe se comportou. Parabéns pelo trabalho, professor. Vamos manter essa união.'
              : state.morale < 60
                ? 'Não estou vivendo meu melhor momento. O que você espera de mim para eu recuperar a confiança?'
                : 'Quero evoluir e ajudar mais o time. Gostaria de ouvir seu conselho para os próximos treinos.',
          });
      }
    }
    if (s.clubId === c.clubId && rng() < 0.00045) {
      const event = hash(`${c.seed}:${c.date}:${player.id}:event`) % 3;
      if (event === 0 && s.fitness > 45) {
        s.injuryDays = Math.max(
          1,
          Math.round((2 + (hash(`${player.id}:${c.date}:injury`) % 10)) * (1 - medical.days)),
        );
        s.fitness = clamp(s.fitness - 8);
        message(c, {
          kind: 'player',
          from: player.name,
          title: 'Incômodo no treinamento',
          body: `O departamento médico identificou um problema leve. ${player.name} ficará fora por ${s.injuryDays} dias.`,
          playerId: player.id,
        });
      }
    }
  }
  for (const scout of c.scouts) {
    if (c.prospects.length >= 5) continue;
    scout.progress = Math.min(7, scout.progress + 1);
    if (scout.progress < 7) continue;
    scout.progress = 0;
    const prospect = youthPlayer(
      c,
      c.clubId,
      clubById(live, c.clubId).reputation,
      c.prospects.length + c.scouts.length,
    );
    prospect.id = `prospect-${hash(`${c.seed}:${scout.id}:${c.date}`)}`;
    prospect.name = `${prospect.name} (${scout.region})`;
    prospect.potential = Math.min(99, prospect.potential + scout.skill);
    prospect.uncertainty = Math.max(1, prospect.uncertainty - scout.skill);
    c.prospects.push(prospect);
    message(c, {
      kind: 'staff',
      from: scout.name,
      title: 'Novo talento encontrado',
      body: `A rede de ${scout.region} identificou ${prospect.name}, ${prospect.position}, com potencial estimado de ${prospect.potential}. Confira em Comissão e perfil.`,
    });
  }
  if (c.date.endsWith('-01')) {
    monthlyReviews(c, live);
    const base = baseWorld(world);
    for (const club of live.clubs) {
      const f = c.finances[club.id];
      const original = base.clubs.find((x) => x.id === club.id)!.league;
      // Receita de TV acompanha a divisão atual.
      const factor = original === club.league ? 1 : club.league === 'A' ? 1.4 : 0.6;
      const wage = payroll(c, live, club.id);
      const own = club.id === c.clubId ? economyMonth(c, live) : null;
      const income = own
        ? Math.round(own.tv * factor)
        : Math.round(club.reputation * 140000 * factor);
      const expense = wage + club.reputation * 30000 + f.debt * 0.002 + (own ? staffPayroll(c) : 0);
      f.cash += income - expense;
      f.history.push({ date: c.date, income, expenses: expense, balance: f.cash });
      f.transferBudget = Math.max(0, Math.min(f.transferBudget, f.cash));
    }
    message(c, {
      from: 'Departamento financeiro',
      kind: 'finance',
      title: 'Fechamento mensal disponível',
      body: 'Receitas de TV, salários (elenco e comissão técnica), operação e juros foram contabilizados. Acompanhe os gráficos no escritório.',
    });
  }
  livingDay(c, live);
  processOffers(c, live);
  reconcileSquad(c, live);
  for (const offer of c.offers.filter(
    (o) => o.incoming && o.status === 'pending' && o.responseDate < c.date,
  ))
    expireThread(offer, c.date, 'O prazo da proposta expirou sem resposta.');
  // Partidas geradas por copas no mesmo dia (novas fases) também são simuladas.
  for (let pass = 0; pass < 3; pass++) {
    const due = c.fixtures.filter(
      (f) => !f.result && f.date <= c.date && f.homeId !== c.clubId && f.awayId !== c.clubId,
    );
    if (!due.length) break;
    for (const f of due) applyMatch(c, live, simulateMatch(c, live, f));
    updateSeason(c, live);
  }
  updateSeason(c, live);
  scoutNext(c, live);
  return c;
}

/** Simula o jogo do dia sem interação (modo automático). */
export function simulateOwnMatch(career: Career, world: World): Career {
  const c = structuredClone(career);
  const live = careerWorld(world, c);
  const fixture = nextFixture(c);
  if (!fixture || fixture.date > c.date) throw new Error('Não há partida hoje.');
  try {
    validateLineup(c, live);
  } catch (error) {
    Object.assign(c, syncBenchWithLineup(c, bestLineup(c, live)));
    validateLineup(c, live);
    message(c, {
      kind: 'staff',
      from: 'Assistente técnico',
      title: 'Escalação ajustada no modo automático',
      body: `${error instanceof Error ? error.message : String(error)} O auxiliar reorganizou os titulares e o banco para esta partida.`,
    });
  }
  c.activeMatch = simulateMatch(c, live, fixture);
  return finishMatch(c, world);
}

export type AdvanceStop = 'match' | 'decision' | 'message' | 'season' | null;

/**
 * Um passo do avanço contínuo. "event" para em qualquer novidade; "auto" simula
 * os próprios jogos, responde as decisões com apoio e só para no fim da temporada.
 */
export function advanceStep(
  career: Career,
  world: World,
  mode: 'event' | 'auto',
): { career: Career; stop: AdvanceStop; played?: string } {
  if (career.seasonEnded) return { career, stop: 'season' };
  let c = career;
  if (mode === 'auto')
    for (const m of c.messages.filter((m) => m.important && !m.resolved))
      c = respondMessage(c, m.id, 'support');
  else if (c.messages.some((m) => blocks(c, m))) return { career: c, stop: 'decision' };
  const fixture = nextFixture(c);
  if (fixture && fixture.date <= c.date) {
    if (mode === 'event') return { career: c, stop: 'match' };
    c = simulateOwnMatch(c, world);
    return {
      career: c,
      stop: c.seasonEnded ? 'season' : null,
      played: fixture.id,
    };
  }
  const known = new Set(c.messages.map((m) => m.id));
  c = advanceDay(c, world);
  if (c.seasonEnded) return { career: c, stop: 'season' };
  if (mode === 'auto') return { career: c, stop: null };
  const next = nextFixture(c);
  if (next && next.date <= c.date) return { career: c, stop: 'match' };
  if (c.messages.some((m) => blocks(c, m))) return { career: c, stop: 'decision' };
  if (c.messages.some((m) => !known.has(m.id))) return { career: c, stop: 'message' };
  return { career: c, stop: null };
}

/** Aplica o plano sugerido pelo auxiliar; trocar o desenho refaz a escalação. */
export function applyStaffPlan(career: Career, world: World, id: string): Career {
  const plan = career.messages.find((m) => m.id === id)?.tactic;
  if (!plan) throw new Error('Essa mensagem não tem um plano de jogo.');
  const c = structuredClone(career);
  const live = careerWorld(world, c);
  const changed = plan.formation !== c.tactic.formation;
  c.tactic = { ...plan };
  if (changed)
    Object.assign(c, syncBenchWithLineup(c, bestLineup(c, live, c.clubId, plan.formation)));
  return c;
}

/** O auxiliar manda o relatório do adversário até dois dias antes de cada jogo. */
function scoutNext(c: Career, world: World) {
  const fixture = nextFixture(c);
  if (!fixture || fixture.date > addDays(c.date, 2) || c.seasonEnded) return;
  if (c.messages.some((m) => m.id === `scout-${fixture.id}`)) return;
  try {
    const report = scoutReport(c, world, fixture);
    if (report) message(c, report);
  } catch {
    // Relatório é opcional; nunca bloqueia o avanço do calendário.
  }
}

const youthFirst = [
  'Arthur',
  'Breno',
  'Caio',
  'Danilo',
  'Enzo',
  'Felipe',
  'Gabriel',
  'Henrique',
  'Igor',
  'João',
  'Kauã',
  'Lucas',
  'Miguel',
  'Nicolas',
  'Otávio',
  'Pedro',
  'Rafael',
  'Samuel',
  'Thiago',
  'Vinícius',
];
const youthLast = [
  'Almeida',
  'Barbosa',
  'Campos',
  'Dias',
  'Esteves',
  'Farias',
  'Gomes',
  'Lima',
  'Machado',
  'Neves',
  'Oliveira',
  'Pereira',
  'Queiroz',
  'Ribeiro',
  'Santos',
  'Teixeira',
  'Vieira',
];
const youthRoles: Position[] = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];

function youthPlayer(
  c: Career,
  clubId: string,
  reputation: number,
  index: number,
  forced?: Position,
  state?: string,
): Player {
  const season = c.season + 1;
  const rng = random(hash(`${c.seed}:${season}:${clubId}:youth:${index}`));
  const drawn = youthRoles[Math.floor(rng() * youthRoles.length)];
  const position = forced || drawn;
  const base = Math.round(reputation * 0.62 + rng() * 10);
  // Cada região revela um perfil: drible no Nordeste, força no Sul, passe no Sudeste, fôlego no Norte.
  const region = state ? regionOf(state) : '';
  const boost: Partial<Record<keyof Attributes, number>> =
    region === 'Nordeste'
      ? { dribbling: 6, pace: 5, acceleration: 4 }
      : region === 'Sul'
        ? { strength: 6, heading: 6, marking: 3 }
        : region === 'Sudeste'
          ? { shortPass: 5, vision: 5, control: 3 }
          : region === 'Norte'
            ? { stamina: 7, pace: 3 }
            : region === 'Centro-Oeste'
              ? { tackling: 4, interception: 4 }
              : {};
  const names =
    region === 'Nordeste'
      ? [...youthFirst, 'Wesley', 'Kaio', 'Ítalo', 'Wendel', 'Jhonata']
      : region === 'Sul'
        ? [...youthFirst, 'Matheus', 'Eduardo', 'Guilherme', 'Bruno']
        : youthFirst;
  const attributes = Object.fromEntries(
    attributeKeys.map((key) => {
      const gk = ['handling', 'diving', 'reflexes'].includes(key);
      const v =
        gk !== (position === 'GK')
          ? 10 + Math.round(rng() * 15)
          : base - 7 + Math.round(rng() * 14);
      return [key, Math.max(8, Math.min(90, v + (gk ? 0 : boost[key] || 0)))];
    }),
  ) as Attributes;
  return {
    id: `y${season}-${clubId}-${index}`,
    clubId,
    name: `${names[Math.floor(rng() * names.length)]} ${youthLast[Math.floor(rng() * youthLast.length)]}`,
    birthDate: `${season - 17}-${String(1 + Math.floor(rng() * 12)).padStart(2, '0')}-10`,
    nationality: 'Brasil',
    position,
    foot: rng() > 0.72 ? 'E' : 'D',
    potential: Math.min(92, base + 12 + Math.round(rng() * 14)),
    uncertainty: 6,
    value: 250000 + Math.round(rng() * 1500000),
    wage: 15000,
    contractEnd: `${season + 3}-12-31`,
    attributes,
  };
}

export function ensureAcademy(c: Career, world: World) {
  const club = clubById(world, c.clubId);
  if (!c.benchConfigured) {
    c.bench = squad(c, careerWorld(world, c))
      .filter((player) => !c.lineup.includes(player.id) && available(c, player.id))
      .sort(
        (a, b) => overall(b, b.position, c.players[b.id]) - overall(a, a.position, c.players[a.id]),
      )
      .slice(0, 9)
      .map((player) => player.id);
    c.benchConfigured = true;
  }
  const initialized = c.living.academyInitializedClubs.includes(club.id);
  const currentCalendar = c.living.academyFixtures.some(
    (fixture) =>
      fixture.date.startsWith(String(c.season)) &&
      (fixture.homeId === club.id || fixture.awayId === club.id),
  );
  if (initialized && currentCalendar) return c;
  const departing = c.living.academyRoster.filter(
    (player) => player.clubId === club.id && ageAt(player.birthDate, c.date) > 20,
  );
  c.living.academyRoster = c.living.academyRoster.filter((player) => !departing.includes(player));
  for (const player of departing) delete c.players[player.id];
  const roster = c.living.academyRoster.filter((player) => player.clubId === club.id);
  const positions: Position[] = [
    'GK',
    'GK',
    'CB',
    'CB',
    'CB',
    'LB',
    'RB',
    'DM',
    'DM',
    'CM',
    'CM',
    'AM',
    'LW',
    'RW',
    'ST',
    'ST',
    'CM',
    'AM',
  ];
  for (let index = roster.length; index < 18; index++) {
    const player = youthPlayer(
      c,
      club.id,
      club.reputation,
      200 + index,
      positions[index],
      club.state,
    );
    player.id = `academy-roster-${club.id}-${c.season}-${index}`;
    player.birthDate = `${c.season - 14 - (index % 4)}-01-01`;
    player.wage = 1500;
    player.contractEnd = `${c.season + 5}-12-31`;
    c.living.academyRoster.push(player);
    c.players[player.id] = freshState(player);
  }
  if (!initialized) c.living.academyInitializedClubs.push(club.id);
  const members = [
    club.id,
    ...world.clubs
      .filter((item) => item.id !== club.id)
      .sort(
        (a, b) =>
          Math.abs(a.reputation - club.reputation) - Math.abs(b.reputation - club.reputation),
      )
      .slice(0, 7)
      .map((item) => item.id),
  ];
  const rounds = roundRobin(members);
  const start = `${c.season}-03-01`;
  const saturday = addDays(start, (6 - new Date(`${start}T12:00:00Z`).getUTCDay() + 7) % 7);
  c.living.academyFixtures = [
    ...rounds,
    ...rounds.map((pairs) => pairs.map(([home, away]): [string, string] => [away, home])),
  ].flatMap((pairs, round) =>
    pairs.map(([homeId, awayId]) => ({
      id: `academy-cup-${c.season}-${homeId}-${awayId}`,
      date: addDays(saturday, round * 7),
      homeId,
      awayId,
    })),
  );
  return c;
}

function playAcademyFixtures(c: Career, world: World) {
  for (const fixture of c.living.academyFixtures) {
    if (fixture.date > c.date || fixture.homeGoals !== undefined) continue;
    const rng = random(hash(`${c.seed}:${fixture.id}`));
    const roster = c.living.academyRoster
      .filter(
        (player) =>
          player.clubId === c.clubId &&
          c.players[player.id].injuryDays === 0 &&
          ageAt(player.birthDate, c.date) <= 20,
      )
      .sort(
        (a, b) => overall(b, b.position, c.players[b.id]) - overall(a, a.position, c.players[a.id]),
      );
    const keeper = roster.find((player) => player.position === 'GK');
    const lineup = [
      ...(keeper ? [keeper] : []),
      ...roster.filter((player) => player.position !== 'GK').slice(0, 10),
    ];
    const own = fixture.homeId === c.clubId || fixture.awayId === c.clubId;
    const strength = (clubId: string) =>
      clubId === c.clubId && lineup.length
        ? lineup.reduce(
            (total, player) =>
              total +
              overall(player, player.position, c.players[player.id]) *
                (0.8 + c.players[player.id].fitness / 500),
            0,
          ) / lineup.length
        : clubById(world, clubId).reputation * 0.62 + 4;
    const poisson = (lambda: number) => {
      let goals = -1,
        product = 1;
      do {
        goals++;
        product *= rng();
      } while (product > Math.exp(-lambda));
      return goals;
    };
    fixture.homeGoals = poisson(
      clamp(1.4 + (strength(fixture.homeId) - strength(fixture.awayId)) * 0.045, 0.25, 3.5),
    );
    fixture.awayGoals = poisson(
      clamp(1.2 + (strength(fixture.awayId) - strength(fixture.homeId)) * 0.045, 0.25, 3.5),
    );
    if (!own) continue;
    if (lineup.length < 11) {
      fixture.homeGoals = fixture.homeId === c.clubId ? 0 : 3;
      fixture.awayGoals = fixture.homeId === c.clubId ? 3 : 0;
      message(c, {
        kind: 'staff',
        from: 'Categorias de base',
        title: 'W.O. no torneio de base',
        body: 'A base não tinha onze atletas saudáveis. Reforce a captação antes de promover mais jogadores.',
      });
      continue;
    }
    const goals = fixture.homeId === c.clubId ? fixture.homeGoals : fixture.awayGoals;
    const conceded = fixture.homeId === c.clubId ? fixture.awayGoals : fixture.homeGoals;
    const attackers = lineup.filter((player) => ['ST', 'LW', 'RW', 'AM'].includes(player.position));
    for (const player of lineup) {
      const state = c.players[player.id];
      state.minutes += 90;
      state.rated = (state.rated ?? 0) + 1;
      const rating = clamp(
        6 +
          (goals - conceded) * 0.2 +
          (player.position === 'GK' ? (conceded === 0 ? 0.8 : -conceded * 0.15) : 0),
        3,
        9,
      );
      state.ratingTotal = (state.ratingTotal ?? 0) + rating;
      state.monthlyRated = (state.monthlyRated ?? 0) + 1;
      state.monthlyRatingTotal = (state.monthlyRatingTotal ?? 0) + rating;
      state.fitness = clamp(state.fitness - 12);
      state.sharpness = clamp(state.sharpness + 10);
    }
    for (let goal = 0; goal < goals && attackers.length; goal++)
      c.players[attackers[Math.floor(rng() * attackers.length)].id].goals++;
    message(c, {
      kind: 'staff',
      from: 'Categorias de base',
      title: 'Resultado do torneio de base',
      body: `${clubById(world, fixture.homeId).name} ${fixture.homeGoals} × ${fixture.awayGoals} ${clubById(world, fixture.awayId).name}. Os participantes ganharam 90 minutos de experiência e ritmo. Confira tabela e calendário na Academia.`,
    });
  }
}

function runAcademyTrial(career: Career, world: World) {
  if (career.living.academy?.season === career.season) return;
  const club = world.clubs.find((item) => item.id === career.clubId);
  if (!club) throw new Error('Não foi possível organizar a peneira do clube.');
  const expired = career.living.academy?.candidates.length || 0;
  const coordinator = youthCoachEffect(staffLevel(career, 'youth'));
  const bonus = youthBonus() + coordinator.potential;
  const candidates = Array.from({ length: 3 + coordinator.extra }, (_, index) => {
    const player = youthPlayer(
      career,
      club.id,
      club.reputation,
      100 + index,
      undefined,
      club.state,
    );
    player.id = `academy-${career.season}-${club.id}-${index}`;
    player.birthDate = `${career.season - 17}${player.birthDate.slice(4)}`;
    player.potential = Math.min(94, player.potential + bonus);
    return player;
  });
  career.living.academy = { clubId: club.id, season: career.season, candidates };
  const expiredNotice = expired
    ? ` ${expired} candidato(s) da peneira anterior deixaram a avaliação.`
    : '';
  message(career, {
    kind: 'staff',
    from: 'Categorias de base',
    title: 'Peneira anual concluída',
    body: `${candidates.length} candidatos aguardam sua avaliação em Academia → Captação e peneira.${expiredNotice}`,
  });
}

/** Fecha a temporada encerrada e prepara a seguinte com acesso, vagas continentais e base. */
export function startNextSeason(career: Career, world: World): Career {
  const c = structuredClone(career);
  if (!c.seasonEnded) throw new Error('A temporada ainda não terminou.');
  const base = baseWorld(world);
  const live = careerWorld(base, c);
  const y = c.season;
  const next = `${y + 1}-01-01`;
  livingSeasonEnd(c, y);
  const tableA = standings(c, base, 'A');
  const tableB = standings(c, base, 'B');
  const league = live.clubs.find((x) => x.id === c.clubId)!.league;
  c.history.push({
    season: y,
    clubId: c.clubId,
    league,
    position: (league === 'A' ? tableA : tableB).findIndex((r) => r.clubId === c.clubId) + 1,
    trophies: c.honours
      .filter((h) => h.season === y && h.clubId === c.clubId)
      .map((h) => h.competition),
  });
  if (c.relegated.includes(c.clubId))
    remember(c, 'derrota', `Rebaixamento com o ${clubById(live, c.clubId).name} na temporada ${y}`);
  if (c.promoted.includes(c.clubId))
    remember(c, 'vitoria', `Acesso com o ${clubById(live, c.clubId).name} na temporada ${y}`);
  // Vagas continentais e Supercopa pela campanha encerrada.
  const a = tableA.map((r) => r.clubId);
  const cdb = c.honours.find((h) => h.season === y && h.competition === 'CDB')?.clubId;
  const lib = [...new Set([...(cdb ? [cdb] : []), ...a.slice(0, 6)])];
  for (const id of a) if (lib.length < 7 && !lib.includes(id)) lib.push(id);
  const q: Qualification = {
    LIB: lib,
    SUL: a.filter((id) => !lib.includes(id)).slice(0, 6),
    SUP: [a[0], cdb && cdb !== a[0] ? cdb : a[1]],
  };
  const relegated = new Set(c.relegated);
  const promoted = new Set(c.promoted);
  c.leagues = Object.fromEntries(
    live.clubs.map((x) => [x.id, relegated.has(x.id) ? 'B' : promoted.has(x.id) ? 'A' : x.league]),
  ) as Career['leagues'];
  const ourLeague = c.leagues[c.clubId];
  c.date = next;
  // Atletas: zera estatísticas, envelhece e renova/aposenta pelos clubes da engine.
  const freeAgents: Player[] = [];
  const academyIds = new Set(c.living.academyRoster.map((player) => player.id));
  for (const p of [...live.players, ...c.living.academyRoster]) {
    const s = c.players[p.id];
    if (!s || s.retired) continue;
    Object.assign(s, {
      goals: 0,
      assists: 0,
      minutes: 0,
      yellow: 0,
      suspension: 0,
      ratingTotal: 0,
      rated: 0,
      monthlyRatingTotal: 0,
      monthlyRated: 0,
      benchGames: 0,
      fitness: 90,
      sharpness: 50,
      injuryDays: Math.max(0, s.injuryDays - 20),
      morale: clamp(Math.round(s.morale + (70 - s.morale) * 0.5)),
    });
    if (academyIds.has(p.id)) continue;
    const age = ageAt(p.birthDate, next);
    if (s.loanFrom && ((s.loanUntil && s.loanUntil <= next) || s.contractEnd < next))
      endLoan(c, live, p.id);
    const preContract = c.preContracts.find(
      (contract) => contract.playerId === p.id && !contract.joined,
    );
    if (preContract && s.contractEnd < next) {
      if (s.clubId)
        settleFee(c, live, { playerId: p.id, from: s.clubId, to: preContract.clubId, fee: 0 });
      else {
        s.rights = 100;
        delete s.partner;
        delete s.rightsPartners;
      }
      s.clubId = preContract.clubId;
      s.wage = preContract.wage;
      s.contractEnd = `${y + 3}-12-31`;
      preContract.joined = true;
      message(c, {
        kind: 'market',
        from: 'Diretor de futebol',
        title: `${p.name} assinou pré-contrato`,
        body: 'O jogador chegou sem taxa de transferência após cumprir o contrato anterior.',
        playerId: p.id,
      });
    }
    if (age >= 31) s.growth = Math.max(-20, s.growth - Math.min(3, (age - 30) * 0.6));
    if (s.clubId && s.clubId !== c.clubId && age >= 35) {
      s.clubId = null;
      s.retired = true;
      continue;
    }
    if (isForeign(s.clubId) && s.contractEnd < next) s.clubId = null;
    if (s.clubId === c.clubId && s.contractEnd < next) {
      s.clubId = null;
      message(c, {
        kind: 'market',
        from: 'Diretor de futebol',
        title: `Contrato encerrado: ${p.name}`,
        body: 'O atleta deixou o clube como agente livre. Renove contratos antes do vencimento.',
        playerId: p.id,
      });
    }
    if (s.clubId && s.clubId !== c.clubId && s.contractEnd < next) {
      if (age < 34) s.contractEnd = `${y + 2}-12-31`;
      else s.clubId = null;
    }
    if (!s.clubId && !s.retired) {
      if (age >= 36) s.retired = true;
      else freeAgents.push(p);
    }
  }
  freeAgents.sort(
    (x, z) => overall(z, z.position, c.players[z.id]) - overall(x, x.position, c.players[x.id]),
  );
  for (const club of live.clubs) {
    if (club.id === c.clubId) continue;
    const roster = squad(c, live, club.id);
    let count = roster.length;
    let keepers = roster.filter((p) => p.position === 'GK').length;
    while ((count < 22 || keepers < 2) && freeAgents.length) {
      const i = keepers < 2 ? freeAgents.findIndex((p) => p.position === 'GK') : 0;
      if (i < 0) break;
      const [signed] = freeAgents.splice(i, 1);
      const s = c.players[signed.id];
      s.clubId = club.id;
      s.rights = 100;
      delete s.partner;
      delete s.rightsPartners;
      s.contractEnd = `${y + 2}-12-31`;
      count++;
      if (signed.position === 'GK') keepers++;
    }
  }
  // Categorias de base: três atletas por clube principal.
  const revealed: Player[] = [];
  const baseBonus = youthBonus();
  const coordinator = youthCoachEffect(staffLevel(c, 'youth'));
  for (const club of live.clubs) {
    const count = club.id === c.clubId ? 3 + coordinator.extra : 3;
    for (let i = 0; i < count; i++) {
      const p = youthPlayer(c, club.id, club.reputation, i, undefined, club.state);
      if (club.id === c.clubId)
        p.potential = Math.min(94, p.potential + baseBonus + coordinator.potential);
      if (club.id === c.clubId) c.living.academyRoster.push(p);
      else c.youth.push(p);
      c.players[p.id] = freshState(p);
      if (club.id === c.clubId) revealed.push(p);
    }
  }
  if (revealed.length) {
    const like = (p: Player) =>
      live.players
        .filter(
          (x) =>
            x.position === p.position && ageAt(x.birthDate, next) >= 24 && c.players[x.id]?.clubId,
        )
        .sort(
          (a, b) => Math.abs(a.potential - p.potential) - Math.abs(b.potential - p.potential),
        )[0];
    const region = regionOf(live.clubs.find((x) => x.id === c.clubId)!.state);
    message(c, {
      kind: 'staff',
      from: 'Categorias de base',
      title: 'A base revelou novos talentos',
      body:
        revealed
          .map(
            (p) =>
              `${p.name} (${p.position}, potencial ~${p.potential}${like(p) ? `, lembra ${like(p)!.name}` : ''})`,
          )
          .join('; ') + `. Perfil típico da garotada do ${region}.`,
    });
    remember(c, 'base', `Base revelou ${revealed.map((p) => p.name).join(', ')}`);
  }
  const nextWorld = careerWorld(base, c);
  // O elenco do usuário precisa de 18 atletas e dois goleiros para jogar.
  const ours = squad(c, nextWorld, c.clubId);
  const needed = Math.max(0, 18 - ours.length);
  const needGk = Math.max(0, 2 - ours.filter((p) => p.position === 'GK').length);
  if (needed || needGk) {
    const extra = Array.from({ length: Math.max(needed, needGk) }, (_, i) =>
      youthPlayer(c, c.clubId, 60, 10 + i, i < needGk ? 'GK' : undefined),
    );
    for (const p of extra) {
      p.potential = Math.min(94, p.potential + baseBonus + coordinator.potential);
      c.youth.push(p);
      c.players[p.id] = freshState(p);
    }
    message(c, {
      kind: 'staff',
      from: 'Categorias de base',
      title: 'Garotos promovidos ao profissional',
      body: `${extra.length} atletas da base foram integrados para completar o elenco mínimo.`,
    });
  }
  c.season = y + 1;
  c.date = next;
  ensureAcademy(c, live);
  c.seasonEnded = false;
  c.promoted = [];
  c.relegated = [];
  c.offers = [];
  c.messages = c.messages.filter((m) => !m.resolved || m.date >= `${y}-11-01`).slice(0, 80);
  for (const m of c.messages) if (m.important) m.resolved = true;
  c.fixtures = createSchedule(nextWorld.clubs, y + 1);
  createCups(c, nextWorld, y + 1, q);
  for (const club of base.clubs) {
    const f = c.finances[club.id];
    f.transferBudget = Math.max(
      0,
      Math.min(
        f.cash,
        club.budget *
          (c.leagues[club.id] === club.league ? 1 : c.leagues[club.id] === 'A' ? 1.3 : 0.6),
      ),
    );
    f.history = f.history.slice(-24);
  }
  if (c.challenge === 'Do zero') c.finances[c.clubId].transferBudget = 0;
  const preparedWorld = careerWorld(base, c);
  reconcileSquad(c, preparedWorld);
  if (c.lineup.length !== 11)
    Object.assign(c, syncBenchWithLineup(c, bestLineup(c, preparedWorld)));
  const reserves = squad(c, preparedWorld)
    .filter((player) => !c.lineup.includes(player.id) && available(c, player.id))
    .sort(
      (a, b) => overall(b, b.position, c.players[b.id]) - overall(a, a.position, c.players[a.id]),
    );
  c.bench = [...new Set([...c.bench, ...reserves.map((player) => player.id)])].slice(0, 9);
  c.benchConfigured = true;
  const goal =
    ourLeague === 'A'
      ? lib.includes(c.clubId)
        ? 'Brigar pelo título e ir longe na Libertadores.'
        : 'Terminar entre os seis primeiros da Série A.'
      : 'Conquistar o acesso à Série A.';
  message(c, {
    kind: 'board',
    from: 'Presidência',
    title: `Temporada ${y + 1}: novos objetivos`,
    body: `${goal} ${promoted.has(c.clubId) ? 'Parabéns pelo acesso: a receita de TV aumentou.' : relegated.has(c.clubId) ? 'O rebaixamento reduziu nossas receitas; precisamos voltar imediatamente.' : ''} Revise o elenco e os contratos vencidos. Novos talentos aguardam sua avaliação na Academia.`.trim(),
  });
  return careerSchema.parse(c);
}

function freshState(p: Player) {
  return {
    clubId: p.clubId,
    fitness: 90,
    morale: 75,
    injuryDays: 0,
    yellow: 0,
    suspension: 0,
    growth: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    wage: p.wage,
    contractEnd: p.contractEnd,
    relationship: 65,
    benchGames: 0,
    ratingTotal: 0,
    rated: 0,
    monthlyRatingTotal: 0,
    monthlyRated: 0,
    personality: (
      ['Profissional', 'Ambicioso', 'Temperamental', 'Leal', 'Disciplinado', 'Líder'] as const
    )[hash(`${p.id}:personality`) % 6],
    sharpness: 50,
    potentialDelta: 0,
    development: 'Equilibrado' as const,
    role: 'Padrão' as const,
    clause: Math.round(p.value * (2.1 + (hash(`${p.id}:clause`) % 90) / 100)),
  };
}

export function respondMessage(career: Career, id: string, choice: 'support' | 'firm' = 'support') {
  const c = structuredClone(career);
  const m = c.messages.find((m) => m.id === id);
  if (!m) throw new Error('Mensagem não encontrada.');
  if (m.resolved) return c;
  m.read = true;
  m.resolved = true;
  m.choice = choice;
  if (m.kind === 'player' && m.playerId) {
    const s = c.players[m.playerId];
    const sensitivity =
      c.difficulty === 'Profissional' ? 1.3 : c.difficulty === 'Iniciante' ? 0.7 : 1;
    s.morale = clamp(s.morale + (choice === 'support' ? 5 : -5) * sensitivity);
    s.relationship = clamp(s.relationship + (choice === 'support' ? 4 : -3));
    s.benchGames = 0;
    c.memories.push({
      playerId: m.playerId,
      date: c.date,
      text:
        choice === 'support'
          ? 'O manager ouviu minha preocupação e ofereceu apoio, sem prometer uma vaga.'
          : 'O manager cobrou mais dedicação para conquistar espaço.',
    });
  }
  return c;
}

export function validateCareerForWorld(career: Career, world: World) {
  const c = careerSchema.parse(career);
  const base = baseWorld(world);
  if (c.worldId !== base.id || c.mode !== base.mode)
    throw new Error('O save pertence a outro snapshot.');
  const live = careerWorld(base, c);
  const allPlayers = [...live.players, ...c.living.academyRoster];
  const playerIds = new Set(allPlayers.map((p) => p.id));
  const professionalIds = new Set(live.players.map((player) => player.id));
  const clubIds = new Set(base.clubs.map((club) => club.id));
  const academy = c.living.academy;
  if (
    !clubIds.has(c.clubId) ||
    allPlayers.length !== playerIds.size ||
    Object.keys(c.players).length !== playerIds.size ||
    Object.entries(c.players).some(
      ([id, s]) =>
        !playerIds.has(id) || (s.clubId !== null && !clubIds.has(s.clubId) && !isForeign(s.clubId)),
    ) ||
    c.lineup.some((id) => !professionalIds.has(id)) ||
    c.living.academyRoster.some(
      (player) => !clubIds.has(player.clubId) || player.birthDate >= c.date,
    ) ||
    Object.keys(c.finances).length !== 40 ||
    Object.keys(c.finances).some((id) => !clubIds.has(id)) ||
    Object.keys(c.leagues).some((id) => !clubIds.has(id)) ||
    new Set(c.fixtures.map((f) => f.id)).size !== c.fixtures.length ||
    c.fixtures.some(
      (f) => !knownClub(base, f.homeId) || !knownClub(base, f.awayId) || f.homeId === f.awayId,
    ) ||
    Boolean(
      academy &&
      (academy.clubId !== c.clubId ||
        academy.season > c.season ||
        new Set(academy.candidates.map((player) => player.id)).size !== academy.candidates.length ||
        academy.candidates.some(
          (player) =>
            player.clubId !== academy.clubId ||
            playerIds.has(player.id) ||
            c.prospects.some((prospect) => prospect.id === player.id) ||
            player.birthDate >= c.date,
        )),
    ) ||
    c.date < base.date ||
    c.date > `${c.season}-12-31`
  )
    throw new Error('Save inconsistente com os clubes, jogadores ou calendário do snapshot.');
  return c;
}
