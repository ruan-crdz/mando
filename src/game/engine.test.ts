import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, addMonths, random } from './random';
import { createDemoWorld } from './world';
import {
  advanceDay,
  createCareer,
  finishMatch,
  respondMessage,
  standings,
  validateCareerForWorld,
} from './engine';
import { available, beginMatch, simulateMatch, stepMatch, substitute } from './matches';
import {
  createOffer,
  askingPrice,
  answerIncoming,
  counterIncoming,
  respondCounter,
  negotiationOutlook,
  renewContract,
} from './transfers';
import { createSchedule, transferWindow } from './calendar';
import { overall } from './ratings';
import { careerSchema, type Career, type Manager } from './types';
import { clubRights, formingClub } from './market';

const world = createDemoWorld();
const manager: Manager = {
  firstName: 'Alex',
  lastName: 'Silva',
  age: 30,
  nationality: 'Brasil',
  style: 'Terno azul',
  appearance: 'Cabelo curto',
};
let career: Career;
beforeEach(() => {
  career = createCareer(world, manager, 'sao-paulo', 'Amador', 'Realista', 42);
});

describe('snapshot e carreira', () => {
  it('cria quarenta clubes e 1.120 atletas sintéticos explicitamente identificados', () => {
    expect(world.clubs).toHaveLength(40);
    expect(world.players).toHaveLength(1120);
    expect(world.mode).toBe('demo');
    expect(new Set(world.players.map((p) => p.id)).size).toBe(1120);
    expect(careerSchema.parse(career).date).toBe('2026-01-01');
    expect(new Set(career.lineup).size).toBe(11);
  });
  it('prepara onboarding assinável e mensagens iniciais sem bloquear o avanço', () => {
    expect(career.onboarding).toEqual({ contractSigned: false, tutorialComplete: false });
    expect(career.messages.map((message) => message.from)).toEqual(
      expect.arrayContaining([
        'Assistente técnico',
        'Presidência',
        'Imprensa esportiva',
        'Comissão técnica',
      ]),
    );
    expect(career.messages.every((message) => !message.important && !message.resolved)).toBe(true);

    const legacyCareer = { ...career };
    delete legacyCareer.onboarding;
    const legacy = careerSchema.parse({
      ...legacyCareer,
      manager: {
        firstName: 'Alex',
        lastName: 'Silva',
        age: 30,
        nationality: 'Brasil',
        style: 'Terno azul',
        appearance: 'Cabelo curto',
      },
    });
    expect(legacy.onboarding).toBeUndefined();
    expect(legacy.manager.birthDate).toBeUndefined();
  });
  it('não compartilha mutações entre saves nem altera o snapshot base', () => {
    const other = createCareer(world, manager, 'sao-paulo', 'Amador', 'Realista', 42);
    const id = career.lineup[0];
    career.players[id].morale = 1;
    expect(other.players[id].morale).toBe(75);
    expect(world.players.find((p) => p.id === id)).not.toHaveProperty('morale');
  });
  it('rejeita referências ausentes e snapshots incompatíveis no load', () => {
    expect(() => validateCareerForWorld({ ...career, worldId: 'outro' }, world)).toThrow(
      'snapshot',
    );
    career.lineup[0] = 'inexistente';
    expect(() => validateCareerForWorld(career, world)).toThrow('inconsistente');
  });
  it('modela a dificuldade sem mudar atributos ou overall', () => {
    const hard = createCareer(world, manager, 'sao-paulo', 'Profissional', 'Realista', 42);
    expect(hard.players).toEqual(career.players);
    expect(hard.lineup).toEqual(career.lineup);
  });
  it('aplica desafios financeiros verificáveis', () => {
    expect(
      createCareer(world, manager, 'sao-paulo', 'Amador', 'Do zero').finances['sao-paulo']
        .transferBudget,
    ).toBe(0);
    const crisis = createCareer(world, manager, 'sao-paulo', 'Amador', 'Crise financeira');
    expect(crisis.finances['sao-paulo'].cash).toBe(career.finances['sao-paulo'].cash / 2);
    expect(crisis.finances['sao-paulo'].debt).toBe(career.finances['sao-paulo'].debt * 1.6);
  });
});

describe('calendário nacional', () => {
  it('gera 38 rodadas, 380 jogos por divisão e dois encontros por par', () => {
    const fixtures = createSchedule(world.clubs);
    expect(fixtures).toHaveLength(760);
    for (const league of ['A', 'B']) {
      const leagueFixtures = fixtures.filter((f) => f.league === league);
      expect(leagueFixtures).toHaveLength(380);
      expect(new Set(leagueFixtures.map((f) => f.round)).size).toBe(38);
      for (const club of world.clubs.filter((c) => c.league === league)) {
        expect(leagueFixtures.filter((f) => f.homeId === club.id)).toHaveLength(19);
        expect(leagueFixtures.filter((f) => f.awayId === club.id)).toHaveLength(19);
        expect(
          new Set(leagueFixtures.filter((f) => f.homeId === club.id).map((f) => f.awayId)).size,
        ).toBe(19);
      }
    }
    expect(fixtures.filter((f) => f.league === 'A').at(-1)?.date).toBe('2026-12-02');
    expect(fixtures.filter((f) => f.league === 'B')[0].date).toBe('2026-03-21');
  });
  it('respeita os limites inclusivos das duas janelas', () => {
    for (const d of ['2026-01-05', '2026-03-03', '2026-07-20', '2026-09-11'])
      expect(transferWindow(d)).toBe(true);
    for (const d of ['2026-01-04', '2026-03-04', '2026-07-19', '2026-09-12'])
      expect(transferWindow(d)).toBe(false);
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });
  it('para no dia de jogo e em mensagens importantes', () => {
    career.date = career.fixtures.find(
      (f) => f.homeId === career.clubId || f.awayId === career.clubId,
    )!.date;
    expect(() => advanceDay(career, world)).toThrow('dia de jogo');
    career.date = '2026-01-01';
    career.messages[0].important = true;
    expect(() => advanceDay(career, world)).toThrow('pendente');
    expect(advanceDay(respondMessage(career, career.messages[0].id), world).date).toBe(
      '2026-01-02',
    );
  });
  it('processa folha mensal, recupera fadiga e preserva o objeto original', () => {
    career.date = '2026-01-31';
    career.fixtures = career.fixtures.map((f) => ({
      ...f,
      date: f.date <= '2026-02-01' ? '2026-02-02' : f.date,
    }));
    career.players[career.lineup[0]].fitness = 50;
    const before = career.finances[career.clubId].history.length;
    const next = advanceDay(career, world);
    expect(next.date).toBe('2026-02-01');
    expect(next.finances[career.clubId].history).toHaveLength(before + 1);
    // Recuperação realista: muito desgastado recupera rápido (~8–13 pontos no dia).
    expect(next.players[career.lineup[0]].fitness).toBeGreaterThan(57);
    expect(next.players[career.lineup[0]].fitness).toBeLessThan(65);
    expect(career.players[career.lineup[0]].fitness).toBe(50);
  });
});

describe('engine matemática da partida', () => {
  it('reproduz eventos, placar e estatísticas com a mesma seed', () => {
    const f = career.fixtures.find((f) => f.homeId === career.clubId)!;
    const a = simulateMatch(career, world, f);
    const b = simulateMatch(career, world, f);
    expect(a).toEqual(b);
    expect(a.minute).toBe(90);
    expect(a.home.possession + a.away.possession).toBe(100);
    expect(a.events.filter((e) => e.type === 'goal')).toHaveLength(a.homeGoals + a.awayGoals);
    expect(a.home.xg).toBeGreaterThanOrEqual(0);
    expect(a.homeGoals).toBeLessThanOrEqual(a.home.shots);
  });
  it('mantém a sequência após salvar e carregar uma partida no minuto 30', () => {
    const f = career.fixtures.find((f) => f.homeId === career.clubId)!;
    let m = beginMatch(career, world, f);
    for (let i = 0; i < 30; i++) m = stepMatch(career, world, m);
    const loaded = careerSchema.parse({ ...career, activeMatch: m });
    expect(stepMatch(loaded, world, loaded.activeMatch!)).toEqual(stepMatch(career, world, m));
  });
  it('impede titulares lesionados e duplicados', () => {
    const f = career.fixtures.find((f) => f.homeId === career.clubId)!;
    career.players[career.lineup[3]].injuryDays = 2;
    expect(available(career, career.lineup[3])).toBe(false);
    expect(() => beginMatch(career, world, f)).toThrow('lesionado');
    career.players[career.lineup[3]].injuryDays = 0;
    career.lineup[2] = career.lineup[3];
    expect(() => beginMatch(career, world, f)).toThrow('diferentes');
  });
  it('permite cinco substituições mas não reentrada', () => {
    const f = career.fixtures.find((f) => f.homeId === career.clubId)!;
    career.activeMatch = beginMatch(career, world, f);
    const out = career.lineup[3];
    const reserve = world.players.find(
      (p) => career.bench.includes(p.id) && p.position !== 'GK' && !career.lineup.includes(p.id),
    )!;
    career = substitute(career, world, out, reserve.id);
    expect(career.activeMatch!.usedSubs).toBe(1);
    expect(career.bench).not.toContain(reserve.id);
    expect(career.bench).toContain(out);
    expect(() => substitute(career, world, reserve.id, out)).toThrow('inválida');
    career.activeMatch!.usedSubs = 5;
    expect(() => substitute(career, world, reserve.id, out)).toThrow('cinco');
  });
  it('contabiliza exatamente os minutos de titulares e substitutos', () => {
    const fixture = career.fixtures.find((f) => f.homeId === career.clubId)!;
    career.activeMatch = beginMatch(career, world, fixture);
    const outgoing = career.lineup[3];
    const incoming = world.players.find(
      (p) => career.bench.includes(p.id) && p.position !== 'GK' && !career.lineup.includes(p.id),
    )!.id;
    for (let i = 0; i < 30; i++) {
      career.activeMatch = stepMatch(career, world, career.activeMatch);
    }
    career = substitute(career, world, outgoing, incoming);
    for (let i = 0; i < 60; i++) {
      career.activeMatch = stepMatch(career, world, career.activeMatch!);
    }
    const updated = finishMatch(career, world);
    expect(updated.players[outgoing].minutes).toBe(30);
    expect(updated.players[incoming].minutes).toBe(60);
    expect(updated.players[incoming].fitness).toBeLessThan(90);
    expect(updated.players[outgoing].fitness).toBeGreaterThan(updated.players[incoming].fitness);
  });
  it('registra resultado, gols, finanças e classificação uma única vez', () => {
    const f = career.fixtures.find((f) => f.homeId === career.clubId && f.league === 'A')!;
    const before = career.finances[career.clubId].history.length;
    career.date = f.date;
    career.activeMatch = simulateMatch(career, world, f);
    const c = finishMatch(career, world);
    expect(c.fixtures.find((fixture) => fixture.id === f.id)?.result).toBeDefined();
    expect(standings(c, world, 'A').find((r) => r.clubId === career.clubId)!.played).toBe(1);
    expect(c.finances[career.clubId].history).toHaveLength(before + 1);
    expect(() => finishMatch(c, world)).toThrow('não terminou');
    expect(career.activeMatch).toBeDefined();
  });
  it('calcula overall por atributos relevantes e não por uma penalidade fixa', () => {
    const p = structuredClone(world.players.find((p) => p.position === 'ST')!);
    p.attributes.finishing = 95;
    p.attributes.positioning = 90;
    p.attributes.composure = 90;
    p.attributes.marking = 10;
    p.attributes.tackling = 10;
    p.attributes.interception = 10;
    expect(overall(p, 'ST')).toBeGreaterThan(overall(p, 'CB') + 25);
    expect(overall(p, 'GK')).toBeLessThan(40);
    const rng = random(1);
    expect([rng(), rng()]).toEqual([
      random(1)(),
      (() => {
        const r = random(1);
        r();
        return r();
      })(),
    ]);
  });
});

describe('mercado e relações', () => {
  it('aceita proposta fora da janela, mas não acima do orçamento', () => {
    const p = world.players.find((p) => p.clubId === 'palmeiras' && p.position === 'ST')!;
    expect(() => createOffer(career, world, p.id, 1e12, 100000)).toThrow('orçamento');
  });
  it('responde no dia seguinte e conclui a negociação sem depender de IA', () => {
    career.date = '2026-01-05';
    const p = world.players.find((p) => p.clubId === 'palmeiras' && p.position === 'ST')!;
    const fee = Math.ceil(askingPrice(career, world, p));
    career = createOffer(career, world, p.id, fee, p.wage * 2);
    expect(career.offers[0].status).toBe('pending');
    career = advanceDay(career, world);
    expect(career.offers[0].status).toBe('completed');
    expect(career.players[p.id].clubId).toBe(career.clubId);
    expect(career.finances[career.clubId].transferBudget).toBe(
      world.clubs.find((c) => c.id === career.clubId)!.budget - fee,
    );
    expect(career.messages[0].title).toContain('Negociação');
  });
  it('luvas compensam salário menor e o contrato respeita os anos oferecidos', () => {
    career.date = '2026-01-05';
    const p = world.players.find((p) => p.clubId === 'palmeiras' && p.position === 'ST')!;
    const fee = Math.ceil(askingPrice(career, world, p));
    const wage = Math.round(career.players[p.id].wage * 0.95);
    const low = negotiationOutlook(career, world, p, fee, wage, undefined, 2, 0);
    const bonus = career.players[p.id].wage * 12 * 2 * 0.3;
    const high = negotiationOutlook(career, world, p, fee, wage, undefined, 2, bonus);
    expect(high.player).toBeGreaterThan(low.player);
    expect(high.club).toBe(100);
    const cash = career.finances[career.clubId].cash;
    career = createOffer(career, world, p.id, fee, wage, undefined, { years: 2, bonus });
    career = advanceDay(advanceDay(career, world), world);
    expect(career.offers[0].status).toBe('completed');
    expect(career.players[p.id].contractEnd).toBe('2028-12-31');
    expect(career.finances[career.clubId].cash).toBeLessThanOrEqual(cash - fee - bonus);
  });
  it('não duplica a conclusão nem deixa saldo negativo por propostas simultâneas', () => {
    career.date = '2026-01-05';
    const p = world.players.find((p) => p.clubId === 'palmeiras' && p.position === 'ST')!;
    career = createOffer(career, world, p.id, Math.ceil(askingPrice(career, world, p)), p.wage * 2);
    career.finances[career.clubId].cash = 0;
    career = advanceDay(advanceDay(career, world), world);
    expect(career.offers[0].status).toBe('rejected');
    expect(career.players[p.id].clubId).toBe('palmeiras');
    expect(career.messages[0].body).toContain('orçamento');
  });
  it('clube vendedor nunca pede menos do que foi oferecido e mantém uma única conversa', () => {
    career.date = '2026-01-05';
    const p = world.players.find((p) => p.clubId === 'palmeiras' && p.position === 'ST')!;
    const minimum = askingPrice(career, world, p);
    const fee = Math.round(minimum * 0.8);
    career = createOffer(career, world, p.id, fee, p.wage * 2);
    career = advanceDay(career, world);
    const offer = career.offers[0];
    expect(offer.status).toBe('countered');
    expect(offer.counter!.fee!).toBeGreaterThan(fee);
    expect(offer.counter!.fee!).toBeLessThanOrEqual(Math.ceil(minimum / 100000) * 100000);
    const firstAsk = offer.counter!.fee!;
    career = createOffer(career, world, p.id, fee + 100000, p.wage * 2);
    expect(career.offers).toHaveLength(1);
    career = advanceDay(career, world);
    expect(career.offers[0].counter!.fee!).toBeLessThanOrEqual(firstAsk);
    expect(career.offers[0].counter!.fee!).toBeGreaterThan(fee + 100000);
    const kinds = career.offers[0].messages!.map((m) => `${m.from}:${m.kind}`);
    expect(kinds).toEqual(['me:offer', 'club:counter', 'me:offer', 'club:counter']);
    career = respondCounter(career, world, career.offers[0].id, true);
    expect(career.offers[0].status).toBe('completed');
    expect(career.players[p.id].clubId).toBe(career.clubId);
  });
  it('oferta acima do pedido é aceita e proposta ridícula é recusada', () => {
    career.date = '2026-01-05';
    const [a, b] = world.players.filter((p) => p.clubId === 'palmeiras' && p.position !== 'GK');
    career = createOffer(
      career,
      world,
      a.id,
      Math.ceil(askingPrice(career, world, a) * 1.05),
      a.wage * 2,
    );
    career = createOffer(career, world, b.id, 1000, b.wage * 2);
    career = advanceDay(career, world);
    expect(career.offers[0].status).toBe('completed');
    expect(career.offers[1].status).toBe('rejected');
    expect(career.offers[1].messages![1].kind).toBe('reject');
  });
  it('agente devolve contraproposta de salário depois do acordo entre clubes', () => {
    career.date = '2026-01-05';
    const p = world.players.find((p) => p.clubId === 'palmeiras' && p.position === 'ST')!;
    const wage = Math.round(career.players[p.id].wage * 0.85);
    career = createOffer(career, world, p.id, Math.ceil(askingPrice(career, world, p)), wage);
    career = advanceDay(career, world);
    const offer = career.offers[0];
    expect(offer.stage).toBe('player');
    expect(offer.status).toBe('countered');
    expect(offer.counter!.wage!).toBeGreaterThan(wage);
    career = respondCounter(career, world, offer.id, true);
    expect(career.offers[0].status).toBe('completed');
  });
  it('contraproposta em venda melhora a oferta recebida ou fecha o negócio', () => {
    career.date = '2026-01-05';
    const p = career.lineup[10];
    career.offers.push({
      id: 'received',
      playerId: p,
      fromClubId: 'palmeiras',
      toClubId: career.clubId,
      fee: 1000000,
      wage: 500000,
      date: career.date,
      responseDate: '2026-01-12',
      incoming: true,
      status: 'pending',
      minimum: 2000000,
    });
    const c = counterIncoming(career, world, 'received', 2600000);
    const offer = c.offers.find((o) => o.id === 'received')!;
    expect(offer.status).toBe('pending');
    expect(offer.fee).toBeGreaterThan(1000000);
    expect(offer.fee).toBeLessThan(2600000);
    const sold = counterIncoming(career, world, 'received', 1500000);
    expect(sold.offers.find((o) => o.id === 'received')!.status).toBe('completed');
  });
  it('aceita oferta recebida, contabiliza vendas e impede aceitar de novo', () => {
    career.date = '2026-01-05';
    const p = world.players.find((player) => {
      const former = formingClub(career, world, player.id);
      return (
        career.players[player.id]?.clubId === career.clubId &&
        player.position !== 'GK' &&
        clubRights(career, player.id) === 100 &&
        former &&
        former !== career.clubId &&
        former !== 'palmeiras'
      );
    })!.id;
    career.offers.push({
      id: 'received',
      playerId: p,
      fromClubId: 'palmeiras',
      toClubId: career.clubId,
      fee: 1000000,
      wage: 500000,
      date: career.date,
      responseDate: '2026-01-12',
      incoming: true,
      status: 'pending',
      minimum: 1000000,
    });
    const c = answerIncoming(career, world, 'received', true);
    expect(c.players[p].clubId).toBe('palmeiras');
    expect(c.sales).toBe(950000);
    expect(() => answerIncoming(c, world, 'received', true)).toThrow('disponível');
  });
  it('renova contrato com custo real e salva memórias de respostas', () => {
    const id = career.lineup[10];
    const old = career.finances[career.clubId].cash;
    const updated = renewContract(career, world, id);
    expect(updated.players[id].contractEnd).toBe(addMonths(career.players[id].contractEnd, 36));
    expect(updated.finances[career.clubId].cash).toBeLessThan(old);
    const short = renewContract(career, world, id, 6);
    expect(short.players[id].contractEnd).toBe(addMonths(career.players[id].contractEnd, 6));
    expect(short.finances[career.clubId].cash).toBeGreaterThan(
      updated.finances[career.clubId].cash,
    );
    expect(() => renewContract(career, world, id, 3)).toThrow('6 meses');
    updated.messages.push({
      id: 'request',
      from: 'Atleta',
      title: 'Quero jogar',
      body: 'Quero jogar',
      kind: 'player',
      playerId: id,
      date: career.date,
      important: true,
      resolved: false,
      read: false,
    });
    const answered = respondMessage(updated, 'request', 'support');
    expect(answered.memories.at(-1)?.playerId).toBe(id);
    expect(respondMessage(answered, 'request').memories).toEqual(answered.memories);
  });
});

describe('playoffs da Série B', () => {
  it('cria duas séries de ida e volta entre 3º/6º e 4º/5º', () => {
    // Isola o Brasileirão: as copas têm testes próprios em season.test.ts.
    career.fixtures = career.fixtures.filter((f) => f.league);
    for (const f of career.fixtures) {
      f.result = {
        fixtureId: f.id,
        seed: 1,
        minute: 90,
        homeGoals: 0,
        awayGoals: 0,
        home: { shots: 0, xg: 0, possession: 50, passes: 0 },
        away: { shots: 0, xg: 0, possession: 50, passes: 0 },
        events: [],
        homeLineup: [],
        awayLineup: [],
        ratings: {},
        minutesPlayed: {},
        energySpent: {},
        injured: [],
        usedSubs: 0,
        dismissed: [],
        replaced: [],
      };
    }
    career.date = '2026-11-14';
    const c = advanceDay(career, world);
    const playoffs = c.fixtures.filter((f) => f.playoff);
    const table = standings(c, world, 'B');
    expect(playoffs).toHaveLength(4);
    expect(playoffs[0].homeId).toBe(table[5].clubId);
    expect(playoffs[0].awayId).toBe(table[2].clubId);
    expect(playoffs[2].homeId).toBe(table[2].clubId);
    for (const f of playoffs) f.result = { ...career.fixtures[0].result!, fixtureId: f.id };
    // Avisos de fim de contrato exigem resposta antes de seguir o calendário.
    for (const m of c.messages) if (m.contract) m.resolved = true;
    c.date = '2026-11-28';
    const final = advanceDay(c, world);
    expect(final.promoted).toEqual(table.slice(0, 4).map((r) => r.clubId));
    expect(final.seasonEnded).toBe(true);
    // Série C não é simulada: só a Série A tem rebaixamento efetivo.
    expect(final.relegated).toHaveLength(4);
  });
});
