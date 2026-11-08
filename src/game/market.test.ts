import { beforeEach, describe, expect, it } from 'vitest';
import { createCareer } from './engine';
import { settleFee } from './market';
import { addDays } from './random';
import {
  createLoanOffer,
  createOffer,
  dealFactor,
  loanAsk,
  loanBlock,
  loanBonusAsk,
  marketValue,
  processOffers,
} from './transfers';
import { careerSchema, type Career, type Manager } from './types';
import { createDemoWorld } from './world';

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
  career.date = '2026-01-05';
});

describe('negociação de empréstimo', () => {
  it('mantém o atleta no clube de origem até os dois lados aceitarem', () => {
    const player = world.players.find(
      (p) => p.clubId === 'palmeiras' && loanBlock(career, world, p) === null,
    )!;
    const ask = loanAsk(career, world, player, 6);
    career = createLoanOffer(career, world, player.id, {
      months: 6,
      wagePct: ask.wagePct,
      fee: ask.fee,
      bonus: loanBonusAsk(career, player),
      option: ask.option,
    });

    expect(career.players[player.id].clubId).toBe('palmeiras');
    expect(career.offers[0].status).toBe('pending');
    expect(career.offers[0].responseDate).toBe('2026-01-06');

    career.date = addDays(career.date, 1);
    processOffers(career, world);
    expect(career.offers[0].status).toBe('completed');
    expect(career.offers[0].messages?.map((message) => message.from)).toEqual([
      'me',
      'club',
      'agent',
      'system',
    ]);
    expect(career.players[player.id].clubId).toBe(career.clubId);
    expect(career.players[player.id].loanFrom).toBe('palmeiras');
    expect(career.players[player.id].loan?.option).toBe(ask.option);
    expect(() => careerSchema.parse(career)).not.toThrow();
  });

  it('permite ao clube recusar sem mover o atleta', () => {
    const player = world.players.find(
      (p) => p.clubId === 'palmeiras' && loanBlock(career, world, p) !== null,
    )!;
    career = createLoanOffer(career, world, player.id, {
      months: 6,
      wagePct: 100,
      fee: 0,
    });
    career.date = addDays(career.date, 1);
    processOffers(career, world);

    expect(career.offers[0].status).toBe('declined');
    expect(career.players[player.id].clubId).toBe('palmeiras');
    expect(career.players[player.id].loanFrom).toBeUndefined();
  });

  it('encerra o pedido se o atleta mudou de clube antes da resposta', () => {
    const player = world.players.find(
      (p) => p.clubId === 'palmeiras' && loanBlock(career, world, p) === null,
    )!;
    career = createLoanOffer(career, world, player.id, {
      months: 6,
      wagePct: 100,
      fee: 0,
    });
    career.players[player.id].clubId = 'vasco';
    career.date = addDays(career.date, 1);
    processOffers(career, world);

    expect(career.offers[0].status).toBe('declined');
    expect(career.players[player.id].clubId).toBe('vasco');
    expect(career.offers[0].messages?.at(-1)?.text).toContain('não está mais disponível');
  });
});

describe('direitos econômicos', () => {
  it('comprar fatia parcial desconta só metade da parte retida pelo vendedor', () => {
    expect(dealFactor(100)).toBe(1);
    expect(dealFactor(50)).toBe(0.75);
  });

  it('recusa proposta irrisória mesmo comprando 50% dos direitos', () => {
    career.finances[career.clubId].transferBudget = 2e8;
    career.finances[career.clubId].cash = 4e8;
    const player = [...world.players]
      .filter((p) => career.players[p.id].clubId && career.players[p.id].clubId !== career.clubId)
      .sort((a, b) => marketValue(career, b) - marketValue(career, a))[0];
    career = createOffer(career, world, player.id, 50000, 2e6, undefined, { rights: 50 });
    career.date = addDays(career.date, 1);
    processOffers(career, world);

    expect(career.offers[0].stage).toBe('club');
    expect(career.offers[0].status).toBe('rejected');
    expect(career.players[player.id].clubId).not.toBe(career.clubId);
  });

  it('conserva os titulares anteriores ao comprar uma fatia', () => {
    const player = world.players.find((p) => p.clubId === 'palmeiras')!;
    career.players[player.id].rights = 60;
    career.players[player.id].partner = 'investidor';
    const result = settleFee(career, world, {
      playerId: player.id,
      from: 'palmeiras',
      to: career.clubId,
      fee: 1000000,
      rights: 50,
    });

    expect(result.net + result.partner + result.solidarity).toBe(1000000);
    expect(career.players[player.id].rights).toBe(50);
    expect(career.players[player.id].rightsPartners).toEqual({
      palmeiras: 30,
      investidor: 20,
    });
  });
});
