import { addDays, ageAt, clamp, hash, random } from './random';
import { bestLineup, reconcileSquad, simulateMatch, squad } from './matches';
import { competitionName, createSchedule, fixtureLabel, nextFixture } from './calendar';
import { expireThread, processOffers } from './transfers';
import { overall } from './ratings';
import { clubById, findPlayer, knownClub } from './npc';
import { baseWorld, careerWorld } from './live';
import {
  createCups,
  cupsFinished,
  initialQualification,
  progressCups,
  table,
  type Qualification,
} from './competitions';
import {
  attributeKeys,
  careerSchema,
  roleNames,
  type Attributes,
  type Career,
  type Manager,
  type Match,
  type Message,
  type Player,
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
    confidence: 80,
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
    history: [],
  };
  createCups(c, world, 2026, initialQualification(world));
  if (challenge === 'Do zero') c.finances[clubId].transferBudget = 0;
  if (challenge === 'Crise financeira') {
    c.finances[clubId].debt *= 1.6;
    c.finances[clubId].cash *= 0.5;
  }
  if (challenge === 'Pressão máxima') c.confidence = 60;
  if (challenge === 'Reconstrução') {
    for (const p of squad(c, world))
      if (ageAt(p.birthDate, c.date) >= 30) c.players[p.id].fitness = 72;
    c.finances[clubId].transferBudget *= 0.6;
  }
  c.lineup = bestLineup(c, world);
  if (c.lineup.length < 11) throw new Error('O elenco não tem onze atletas disponíveis.');
  for (const role of roleNames) c.roles[role] = c.lineup[role === 'Capitão' ? 2 : 10];
  message(c, {
    from: 'Presidência',
    kind: 'board',
    title: `Bem-vindo ao ${club.name}`,
    body: `A temporada começa agora. ${club.league === 'A' ? 'Nossa meta é terminar entre os seis primeiros.' : 'Queremos disputar o acesso.'} Além do Brasileirão, teremos estadual, Copa do Brasil e, se classificados, torneios continentais. Construa uma equipe equilibrada e mantenha as finanças saudáveis.`,
  });
  message(c, {
    from: 'Comissão técnica',
    kind: 'staff',
    title: 'Seu primeiro dia de trabalho',
    body: 'Revise a escalação, defina as responsabilidades e acompanhe o calendário. A simulação para em partidas e decisões importantes.',
  });
  return careerSchema.parse(c);
}

function applyMatch(c: Career, world: World, result: Match) {
  const fixture = c.fixtures.find((f) => f.id === result.fixtureId);
  if (!fixture || fixture.result || result.minute !== 90)
    throw new Error('Resultado inválido ou já registrado.');
  fixture.result = result;
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
        s.benchGames = 0;
        result.ratings[p.id] = clamp(
          (result.ratings[p.id] || 6.5) + (p.position === 'GK' ? 0.2 : 0),
          1,
          10,
        );
      } else s.benchGames++;
    }
  }
  for (const e of result.events) {
    if (!e.playerId) continue;
    const s = c.players[e.playerId];
    if (!s) continue;
    if (e.type === 'goal') {
      s.goals++;
      s.morale = clamp(s.morale + 3);
      const ids = e.clubId === fixture.homeId ? result.homeLineup : result.awayLineup;
      const assistant = ids.filter(
        (id) => id !== e.playerId && findPlayer(world, id)?.position !== 'GK',
      );
      const helper =
        assistant.length &&
        c.players[assistant[hash(`${result.seed}:${e.minute}:assist`) % assistant.length]];
      if (helper) helper.assists++;
    }
    if (e.type === 'yellow') {
      s.yellow++;
      if (s.yellow % 3 === 0) s.suspension++;
    }
    if (e.type === 'injury') {
      s.injuryDays = 3 + (hash(`${result.seed}:${e.playerId}:${e.minute}`) % 25);
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
    const expectation =
      c.challenge === 'Pressão máxima' ? 2 : c.difficulty === 'Iniciante' ? 0.5 : 1;
    c.confidence = clamp(
      c.confidence + (goals > 0 ? 2 : goals < 0 ? -3 * expectation : -expectation),
    );
    for (const p of squad(c, world))
      c.players[p.id].morale = clamp(c.players[p.id].morale + (goals > 0 ? 3 : goals < 0 ? -4 : 0));
    const label = fixtureLabel(fixture);
    message(c, {
      kind: 'news',
      from: 'Mando Esportes',
      title: `${clubById(world, fixture.homeId).name} ${result.homeGoals} × ${result.awayGoals} ${clubById(world, fixture.awayId).name}`,
      body: `${label.name} · ${label.stage}. ${
        goals > 0
          ? 'Uma vitória para fortalecer o trabalho. A diretoria elogiou a equipe.'
          : goals < 0
            ? 'O resultado aumenta a cobrança por uma resposta no próximo compromisso.'
            : 'Equilíbrio em campo. A comissão já analisa os próximos ajustes.'
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
  }
}

function updateSeason(c: Career, world: World) {
  const y = c.season;
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
    const national = notice.champion && !notice.cup.startsWith('EST-');
    if (!ours && !national) continue;
    if (ours && notice.champion && notice.clubs[0] === c.clubId) {
      c.confidence = clamp(c.confidence + 8);
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

export function advanceDay(career: Career, world: World): Career {
  const c = structuredClone(career);
  const live = careerWorld(world, c);
  if (c.seasonEnded)
    throw new Error(
      `A temporada ${c.season} está encerrada. Inicie a temporada ${c.season + 1} pela Central.`,
    );
  if (c.activeMatch) throw new Error('Conclua a partida em andamento.');
  if (c.messages.some((m) => m.important && !m.resolved))
    throw new Error('Há uma decisão importante pendente no escritório.');
  const fixture = nextFixture(c);
  if (fixture && fixture.date <= c.date)
    throw new Error('Hoje é dia de jogo. Prepare a equipe e comece a partida.');
  c.date = addDays(c.date, 1);
  for (const player of live.players) {
    const s = c.players[player.id];
    if (!s || s.retired) continue;
    const rng = random(hash(`${c.seed}:${c.date}:${player.id}`));
    s.injuryDays = Math.max(0, s.injuryDays - 1);
    s.fitness = clamp(s.fitness + (s.injuryDays ? 1 : 4));
    if (s.clubId && ageAt(player.birthDate, c.date) <= 27 && s.injuryDays === 0 && rng() < 0.035) {
      const target =
        player.potential +
        (hash(`${c.seed}:${player.id}:potential`) % (player.uncertainty * 2 + 1)) -
        player.uncertainty;
      if (overall(player, player.position, s) < target && s.growth < 20)
        s.growth = Math.min(20, s.growth + 0.025 * (0.5 + s.minutes / 1800) * (s.morale / 100));
    }
    if (s.clubId && s.contractEnd < c.date) {
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
      rng() < 0.06 &&
      !c.messages.some((m) => m.playerId === player.id && !m.resolved)
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
  }
  if (c.date.endsWith('-01')) {
    const base = baseWorld(world);
    for (const club of live.clubs) {
      const f = c.finances[club.id];
      const original = base.clubs.find((x) => x.id === club.id)!.league;
      // Receita de TV e patrocínio acompanha a divisão atual.
      const factor = original === club.league ? 1 : club.league === 'A' ? 1.4 : 0.6;
      const wage = squad(c, live, club.id).reduce((sum, p) => sum + c.players[p.id].wage, 0);
      const income = Math.round(club.reputation * 140000 * factor);
      const expense = wage + club.reputation * 30000 + f.debt * 0.002;
      f.cash += income - expense;
      f.history.push({ date: c.date, income, expenses: expense, balance: f.cash });
      f.transferBudget = Math.max(0, Math.min(f.transferBudget, f.cash));
    }
    message(c, {
      from: 'Departamento financeiro',
      kind: 'finance',
      title: 'Fechamento mensal disponível',
      body: 'Receitas de patrocínio, salários, operação e juros foram contabilizados. Acompanhe os gráficos no escritório.',
    });
  }
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
  return c;
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
): Player {
  const season = c.season + 1;
  const rng = random(hash(`${c.seed}:${season}:${clubId}:youth:${index}`));
  const drawn = youthRoles[Math.floor(rng() * youthRoles.length)];
  const position = forced || drawn;
  const base = Math.round(reputation * 0.62 + rng() * 10);
  const attributes = Object.fromEntries(
    attributeKeys.map((key) => {
      const gk = ['handling', 'diving', 'reflexes'].includes(key);
      const v =
        gk !== (position === 'GK')
          ? 10 + Math.round(rng() * 15)
          : base - 7 + Math.round(rng() * 14);
      return [key, Math.max(8, Math.min(90, v))];
    }),
  ) as Attributes;
  return {
    id: `y${season}-${clubId}-${index}`,
    clubId,
    name: `${youthFirst[Math.floor(rng() * youthFirst.length)]} ${youthLast[Math.floor(rng() * youthLast.length)]}`,
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

/** Fecha a temporada encerrada e prepara a seguinte com acesso, vagas continentais e base. */
export function startNextSeason(career: Career, world: World): Career {
  const c = structuredClone(career);
  if (!c.seasonEnded) throw new Error('A temporada ainda não terminou.');
  const base = baseWorld(world);
  const live = careerWorld(base, c);
  const y = c.season;
  const next = `${y + 1}-01-01`;
  const tableA = standings(c, base, 'A');
  const tableB = standings(c, base, 'B');
  const league = live.clubs.find((x) => x.id === c.clubId)!.league;
  c.history.push({
    season: y,
    league,
    position: (league === 'A' ? tableA : tableB).findIndex((r) => r.clubId === c.clubId) + 1,
    confidence: c.confidence,
    trophies: c.honours
      .filter((h) => h.season === y && h.clubId === c.clubId)
      .map((h) => h.competition),
  });
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
  // Atletas: zera estatísticas, envelhece e renova/aposenta pelos clubes da engine.
  const freeAgents: Player[] = [];
  for (const p of live.players) {
    const s = c.players[p.id];
    if (!s || s.retired) continue;
    Object.assign(s, {
      goals: 0,
      assists: 0,
      minutes: 0,
      yellow: 0,
      suspension: 0,
      benchGames: 0,
      fitness: 90,
      injuryDays: Math.max(0, s.injuryDays - 20),
      morale: clamp(Math.round(s.morale + (70 - s.morale) * 0.5)),
    });
    const age = ageAt(p.birthDate, next);
    if (age >= 31) s.growth = Math.max(-20, s.growth - Math.min(3, (age - 30) * 0.6));
    if (s.clubId && s.clubId !== c.clubId && age >= 35) {
      s.clubId = null;
      s.retired = true;
      continue;
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
      s.contractEnd = `${y + 2}-12-31`;
      count++;
      if (signed.position === 'GK') keepers++;
    }
  }
  // Categorias de base: três atletas por clube principal.
  for (const club of live.clubs) {
    for (let i = 0; i < 3; i++) {
      const p = youthPlayer(c, club.id, club.reputation, i);
      c.youth.push(p);
      c.players[p.id] = freshState(p);
    }
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
  reconcileSquad(c, nextWorld);
  if (c.lineup.length !== 11) c.lineup = bestLineup(c, nextWorld);
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
    body: `${goal} ${promoted.has(c.clubId) ? 'Parabéns pelo acesso: a receita de TV aumentou.' : relegated.has(c.clubId) ? 'O rebaixamento reduziu nossas receitas; precisamos voltar imediatamente.' : ''} Revise o elenco: atletas da base foram integrados e contratos vencidos já saíram.`.trim(),
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
  const playerIds = new Set(live.players.map((p) => p.id));
  const clubIds = new Set(base.clubs.map((club) => club.id));
  if (
    !clubIds.has(c.clubId) ||
    Object.keys(c.players).length !== playerIds.size ||
    Object.entries(c.players).some(
      ([id, s]) => !playerIds.has(id) || (s.clubId !== null && !clubIds.has(s.clubId)),
    ) ||
    c.lineup.some((id) => !playerIds.has(id)) ||
    Object.keys(c.finances).length !== 40 ||
    Object.keys(c.finances).some((id) => !clubIds.has(id)) ||
    Object.keys(c.leagues).some((id) => !clubIds.has(id)) ||
    new Set(c.fixtures.map((f) => f.id)).size !== c.fixtures.length ||
    c.fixtures.some(
      (f) => !knownClub(base, f.homeId) || !knownClub(base, f.awayId) || f.homeId === f.awayId,
    ) ||
    c.date < base.date ||
    c.date > `${c.season}-12-31`
  )
    throw new Error('Save inconsistente com os clubes, jogadores ou calendário do snapshot.');
  return c;
}
