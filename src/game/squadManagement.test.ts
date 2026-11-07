import { describe, expect, it } from 'vitest';
import { careerSchema, type Career, type Manager } from './types';
import { createCareer } from './engine';
import { createDemoWorld } from './world';
import { familiarity, LEARNED, trainingGain } from './positions';
import {
  hireAssistant,
  assistantCandidates,
  lineupExport,
  lineupImportError,
  positionTrainingEta,
  selectBenchPlayer,
  syncBenchWithLineup,
} from './squadManagement';
import { ageAt } from './random';
import { staffPayroll } from './staff';

const world = createDemoWorld();
const manager: Manager = {
  firstName: 'Alex',
  lastName: 'Silva',
  age: 30,
  nationality: 'Brasil',
  style: 'Terno azul',
  appearance: 'Cabelo curto',
};
const start = () => createCareer(world, manager, 'sao-paulo', 'Amador', 'Realista', 42);

describe('gestão do elenco', () => {
  it('preenche valores seguros ao carregar uma carreira antiga', () => {
    const career = start();
    const legacySave = Object.fromEntries(
      Object.entries(career).filter(
        ([key]) => !['bench', 'benchConfigured', 'savedLineups', 'assistantCoaches'].includes(key),
      ),
    );
    const parsed = careerSchema.parse(legacySave);
    expect(parsed.bench).toEqual([]);
    expect(parsed.benchConfigured).toBe(false);
    expect(parsed.savedLineups).toEqual([]);
    expect(parsed.assistantCoaches).toEqual({});
  });

  it('limita o banco a nove atletas e rejeita titulares e atletas de outros clubes', () => {
    const career: Career = { ...start(), bench: [] };
    const candidates = world.players.filter(
      (player) => career.players[player.id]?.clubId === career.clubId,
    );
    let updated = career;
    const reserves = candidates.filter((player) => !career.lineup.includes(player.id));
    for (const player of reserves.slice(0, 9)) updated = selectBenchPlayer(updated, player.id);
    expect(updated.bench).toHaveLength(9);
    expect(() => selectBenchPlayer(updated, reserves[9].id)).toThrow(/nove/);
    expect(() => selectBenchPlayer(career, career.lineup[0])).toThrow(/titulares/);
    const foreign = world.players.find(
      (player) => career.players[player.id]?.clubId !== career.clubId,
    )!;
    expect(() => selectBenchPlayer(career, foreign.id)).toThrow(/seu elenco/);
    const fieldReserve = reserves.find((player) => player.position !== 'GK')!;
    const selected = selectBenchPlayer(career, fieldReserve.id);
    const slot = career.lineup.findIndex(
      (id) => world.players.find((player) => player.id === id)?.position !== 'GK',
    );
    const lineup = [...career.lineup];
    lineup[slot] = fieldReserve.id;
    const promoted = syncBenchWithLineup(selected, lineup);
    expect(promoted.lineup).toContain(fieldReserve.id);
    expect(promoted.bench).not.toContain(fieldReserve.id);
  });

  it('valida a escalação exportada e rejeita duplicatas e atletas estrangeiros', () => {
    const career = start();
    const data = (playerIds: string[]) =>
      JSON.stringify({
        format: 'mando-lineup',
        version: 1,
        name: 'Jogo grande',
        formation: career.tactic.formation,
        playerIds,
      });
    const exported = lineupExport('Jogo grande', career.tactic.formation, career.lineup);
    expect(lineupImportError(exported, career, world).playerIds).toEqual(career.lineup);
    expect(() =>
      lineupImportError(
        data([career.lineup[0], ...career.lineup.slice(1, 10), career.lineup[1]]),
        career,
        world,
      ),
    ).toThrow(/duplicados/);
    const foreign = world.players.find(
      (player) => career.players[player.id]?.clubId !== career.clubId,
    )!;
    expect(() =>
      lineupImportError(
        data([career.lineup[0], ...career.lineup.slice(1, 10), foreign.id]),
        career,
        world,
      ),
    ).toThrow(/não pertence/);
  });

  it('estima semanas usando a familiaridade atual e o ritmo de treino por idade', () => {
    const career = start();
    const player = world.players.find(
      (candidate) =>
        career.players[candidate.id]?.clubId === career.clubId &&
        candidate.position !== 'GK' &&
        familiarity(candidate, 'CB', career.players[candidate.id]) < LEARNED,
    )!;
    const eta = positionTrainingEta(player, career, 'CB');
    const expectedDays = Math.ceil(
      (LEARNED - eta.current) / trainingGain(ageAt(player.birthDate, career.date)),
    );
    expect(eta.days).toBe(expectedDays);
    expect(eta.weeks).toBe(Math.ceil(expectedDays / 7));
    expect(positionTrainingEta(player, career, 'GK').weeks).toBeNull();
    const injured = {
      ...career,
      players: {
        ...career.players,
        [player.id]: { ...career.players[player.id], injuryDays: 5 },
      },
    };
    expect(positionTrainingEta(player, injured, 'CB').days).toBe(
      5 +
        Math.ceil((LEARNED - eta.current - 1) / trainingGain(ageAt(player.birthDate, career.date))),
    );
  });

  it('contrata apenas um auxiliar por área com salário limitado e dados completos', () => {
    const career = start();
    const candidate = assistantCandidates(career, 'ataque')[2];
    const hired = hireAssistant(career, 'ataque', candidate.id!);
    expect(hired.assistantCoaches.ataque?.stars.ST).toBe(candidate.stars.ST);
    expect(hired.assistantCoaches.ataque?.wageWeekly).toBeLessThanOrEqual(5000);
    expect(staffPayroll(hired)).toBeGreaterThan(staffPayroll(start()));
    expect(() => hireAssistant(hired, 'ataque', candidate.id!)).toThrow(/ocupada/);
  });
});
