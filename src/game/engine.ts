import { addDays, ageAt, clamp, hash, random } from './random';
import { bestLineup, reconcileSquad, simulateMatch, squad } from './matches';
import { createSchedule, nextFixture } from './calendar';
import { processOffers } from './transfers';
import { overall } from './ratings';
import {
  careerSchema,
  roleNames,
  type Career,
  type Manager,
  type Match,
  type Message,
  type TableRow,
  type World,
} from './types';

export function standings(career: Career, world: World, league: 'A' | 'B'): TableRow[] {
  const rows = new Map(
    world.clubs
      .filter((c) => c.league === league)
      .map((c) => [
        c.id,
        { clubId: c.id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 },
      ]),
  );
  for (const fixture of career.fixtures.filter(
    (f) => f.league === league && !f.playoff && f.result,
  )) {
    const h = rows.get(fixture.homeId)!;
    const a = rows.get(fixture.awayId)!;
    const r = fixture.result!;
    h.played++;
    a.played++;
    h.gf += r.homeGoals;
    h.ga += r.awayGoals;
    a.gf += r.awayGoals;
    a.ga += r.homeGoals;
    if (r.homeGoals === r.awayGoals) {
      h.drawn++;
      a.drawn++;
      h.points++;
      a.points++;
    } else {
      const [winner, loser] = r.homeGoals > r.awayGoals ? [h, a] : [a, h];
      winner.won++;
      winner.points += 3;
      loser.lost++;
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.won - a.won ||
      b.gf - b.ga - (a.gf - a.ga) ||
      b.gf - a.gf ||
      a.clubId.localeCompare(b.clubId),
  );
}

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
    fixtures: createSchedule(world.clubs),
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
  };
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
    body: `A temporada começa agora. ${club.league === 'A' ? 'Nossa meta é terminar entre os seis primeiros.' : 'Queremos disputar o acesso.'} Construa uma equipe equilibrada e mantenha as finanças saudáveis.`,
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
    if (e.type === 'goal') {
      s.goals++;
      s.morale = clamp(s.morale + 3);
      const ids = e.clubId === fixture.homeId ? result.homeLineup : result.awayLineup;
      const assistant = ids.filter(
        (id) => id !== e.playerId && world.players.find((p) => p.id === id)?.position !== 'GK',
      );
      if (assistant.length)
        c.players[assistant[hash(`${result.seed}:${e.minute}:assist`) % assistant.length]]
          .assists++;
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
          body: `${world.players.find((p) => p.id === e.playerId)!.name} ficará fora por ${s.injuryDays} dias.`,
          important: true,
          playerId: e.playerId,
        });
    }
  }
  const homeFinance = c.finances[fixture.homeId];
  const income = Math.round(
    world.clubs.find((club) => club.id === fixture.homeId)!.reputation *
      12000 *
      (1 + (isOurs ? 0.1 : 0)),
  );
  homeFinance.cash += income;
  homeFinance.history.push({ date: c.date, income, expenses: 0, balance: homeFinance.cash });
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
    message(c, {
      kind: 'news',
      from: 'Mando Esportes',
      title: `${world.clubs.find((club) => club.id === fixture.homeId)!.name} ${result.homeGoals} × ${result.awayGoals} ${world.clubs.find((club) => club.id === fixture.awayId)!.name}`,
      body:
        goals > 0
          ? 'Uma vitória para fortalecer o trabalho. A diretoria elogiou a equipe.'
          : goals < 0
            ? 'O resultado aumenta a cobrança por uma resposta no próximo compromisso.'
            : 'Equilíbrio em campo. A comissão já analisa os próximos ajustes.',
    });
  }
}

function updateSeason(c: Career, world: World) {
  const regularB = c.fixtures.filter((f) => f.league === 'B' && !f.playoff);
  if (regularB.every((f) => f.result) && !c.fixtures.some((f) => f.playoff)) {
    const table = standings(c, world, 'B');
    for (const [i, j] of [
      [2, 5],
      [3, 4],
    ]) {
      for (let leg = 0; leg < 2; leg++)
        c.fixtures.push({
          id: `B-playoff-${i}-${leg}`,
          date: leg === 0 ? '2026-11-21' : '2026-11-28',
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
  if (c.fixtures.every((f) => f.result) && !c.seasonEnded) {
    c.seasonEnded = true;
    c.relegated = ['A', 'B'].flatMap((league) =>
      standings(c, world, league as 'A' | 'B')
        .slice(-4)
        .map((r) => r.clubId),
    );
    message(c, {
      kind: 'board',
      from: 'Presidência',
      title: 'Temporada encerrada',
      body: 'O relatório final está disponível na aba Temporada. Este ciclo cobre 2026; novas temporadas e divisões inferiores ainda não estão habilitadas.',
      important: true,
    });
  }
}

export function finishMatch(career: Career, world: World): Career {
  const c = structuredClone(career);
  if (!c.activeMatch || c.activeMatch.minute !== 90)
    throw new Error('A partida ainda não terminou.');
  applyMatch(c, world, c.activeMatch);
  delete c.activeMatch;
  updateSeason(c, world);
  return c;
}

export function advanceDay(career: Career, world: World): Career {
  const c = structuredClone(career);
  if (c.seasonEnded)
    throw new Error('A temporada 2026 está encerrada. Veja seu relatório na aba Temporada.');
  if (c.activeMatch) throw new Error('Conclua a partida em andamento.');
  if (c.messages.some((m) => m.important && !m.resolved))
    throw new Error('Há uma decisão importante pendente no escritório.');
  const fixture = nextFixture(c);
  if (fixture && fixture.date <= c.date)
    throw new Error('Hoje é dia de jogo. Prepare a equipe e comece a partida.');
  c.date = addDays(c.date, 1);
  for (const player of world.players) {
    const s = c.players[player.id];
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
    for (const club of world.clubs) {
      const f = c.finances[club.id];
      const wage = squad(c, world, club.id).reduce((sum, p) => sum + c.players[p.id].wage, 0);
      const income = club.reputation * 140000;
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
  processOffers(c, world);
  reconcileSquad(c, world);
  for (const offer of c.offers.filter(
    (o) => o.incoming && o.status === 'pending' && o.responseDate < c.date,
  ))
    offer.status = 'declined';
  for (const f of c.fixtures.filter(
    (f) => !f.result && f.date <= c.date && f.homeId !== c.clubId && f.awayId !== c.clubId,
  )) {
    applyMatch(c, world, simulateMatch(c, world, f));
  }
  updateSeason(c, world);
  return c;
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
  if (c.worldId !== world.id || c.mode !== world.mode)
    throw new Error('O save pertence a outro snapshot.');
  const playerIds = new Set(world.players.map((p) => p.id));
  const clubIds = new Set(world.clubs.map((club) => club.id));
  if (
    !clubIds.has(c.clubId) ||
    Object.keys(c.players).length !== playerIds.size ||
    Object.entries(c.players).some(
      ([id, s]) => !playerIds.has(id) || (s.clubId !== null && !clubIds.has(s.clubId)),
    ) ||
    c.lineup.some((id) => !playerIds.has(id)) ||
    Object.keys(c.finances).length !== 40 ||
    Object.keys(c.finances).some((id) => !clubIds.has(id)) ||
    new Set(c.fixtures.map((f) => f.id)).size !== c.fixtures.length ||
    c.fixtures.some(
      (f) => !clubIds.has(f.homeId) || !clubIds.has(f.awayId) || f.homeId === f.awayId,
    ) ||
    c.date < world.date ||
    c.date > '2026-12-31'
  )
    throw new Error('Save inconsistente com os clubes, jogadores ou calendário do snapshot.');
  return c;
}
