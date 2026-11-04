import { beforeEach, describe, expect, it } from 'vitest';
import { matchConditions } from './context';
import { createCareer } from './engine';
import { beginMatch, shoutFromSideline, stepMatch, substitute } from './matches';
import { careerSchema, type Career, type Fixture, type Manager } from './types';
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
let fixture: Fixture;

beforeEach(() => {
  career = createCareer(world, manager, 'sao-paulo', 'Amador', 'Realista', 42);
  fixture = career.fixtures.find(
    (item) => item.homeId === career.clubId || item.awayId === career.clubId,
  )!;
  career.activeMatch = beginMatch(career, world, fixture);
});

describe('ambiente e decisões durante a partida', () => {
  it('gera clima, gramado e arbitragem determinísticos para a mesma partida', () => {
    const first = matchConditions(career, world, fixture);
    expect(matchConditions(career, world, fixture)).toEqual(first);
    expect(first.weather).toBeTruthy();
    expect(first.pitch).toBeTruthy();
    expect(first.referee?.strictness).toBeGreaterThanOrEqual(1);
    expect(first.referee?.strictness).toBeLessThanOrEqual(5);
  });

  it('aplica a instrução de pressão e respeita o intervalo entre comandos', () => {
    const original = career;
    career = shoutFromSideline(career, 'pressionar');
    expect(career.activeMatch?.shout).toEqual({ kind: 'pressionar', until: 10 });
    expect(() => shoutFromSideline(career, 'acalmar')).toThrow('Aguarde');

    const regular = stepMatch(original, world, original.activeMatch!);
    const instructed = stepMatch(career, world, career.activeMatch!);
    const playerId = career.lineup[1];
    expect(instructed.energySpent[playerId]).toBeCloseTo(regular.energySpent[playerId] * 1.08);
  });

  it('não mantém atleta expulso em campo nem permite substituí-lo', () => {
    const playerId = career.lineup[1];
    const reserve = world.players.find(
      (player) => player.clubId === career.clubId && !career.lineup.includes(player.id),
    )!;
    career.activeMatch!.dismissed.push(playerId);
    const next = stepMatch(career, world, career.activeMatch!);

    expect(next.minutesPlayed[playerId]).toBeUndefined();
    expect(() => substitute(career, world, playerId, reserve.id)).toThrow('Substituição inválida');
  });

  it('carrega partidas antigas sem a lista de expulsos', () => {
    const { dismissed: _dismissed, ...legacyMatch } = career.activeMatch!;
    const loaded = careerSchema.parse({ ...career, activeMatch: legacyMatch });
    expect(loaded.activeMatch?.dismissed).toEqual([]);
  });
});
