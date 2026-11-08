import { beforeEach, describe, expect, it } from 'vitest';
import { createCareer } from './engine';
import {
  assistantSubstitutionSuggestion,
  beginMatch,
  shoutFromSideline,
  stepMatch,
  substitute,
} from './matches';
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

describe('decisões durante a partida', () => {
  it('prioriza lesão, explica o ganho e respeita banco, ignorados e trocas restantes', () => {
    const outgoing = career.lineup[1];
    career.activeMatch!.injured.push(outgoing);
    const suggestion = assistantSubstitutionSuggestion(career, world);
    expect(suggestion?.outgoing).toBe(outgoing);
    expect(career.bench).toContain(suggestion?.incoming);
    expect(suggestion?.detail).toContain('Ganho estimado');
    expect(suggestion?.contextKey).toBeTruthy();
    expect(assistantSubstitutionSuggestion(career, world, new Set([outgoing]))).toBeNull();
    career.activeMatch!.usedSubs = 5;
    expect(assistantSubstitutionSuggestion(career, world)).toBeNull();
  });

  it('preserva a última troca antes dos 75 minutos, exceto em lesão', () => {
    const outgoing = career.lineup[1];
    career.activeMatch!.minute = 68;
    career.activeMatch!.usedSubs = 4;
    career.activeMatch!.energySpent[outgoing] = 16;
    career.players[outgoing].fitness = 65;
    expect(assistantSubstitutionSuggestion(career, world)).toBeNull();
    career.activeMatch!.injured.push(outgoing);
    expect(assistantSubstitutionSuggestion(career, world)?.outgoing).toBe(outgoing);
  });

  it('rejeita substituto fora do banco configurado', () => {
    const unselected = world.players.find(
      (player) =>
        career.players[player.id]?.clubId === career.clubId &&
        !career.lineup.includes(player.id) &&
        !career.bench.includes(player.id),
    )!;
    expect(() => substitute(career, world, career.lineup[1], unselected.id)).toThrow(
      'Substituição inválida',
    );
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
    const { dismissed, ...legacyMatch } = career.activeMatch!;
    expect(dismissed).toEqual([]);
    const loaded = careerSchema.parse({ ...career, activeMatch: legacyMatch });
    expect(loaded.activeMatch?.dismissed).toEqual([]);
  });
});
