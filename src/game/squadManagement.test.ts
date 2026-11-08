import { describe, expect, it } from 'vitest';
import { careerSchema, type Career, type Manager } from './types';
import { createCareer } from './engine';
import { createDemoWorld } from './world';
import { familiarity, LEARNED, trainingGain } from './positions';
import {
  hireAssistant,
  fireAssistant,
  assistantTrainingBonus,
  assistantCandidates,
  lineupExport,
  lineupImportError,
  positionTrainingEta,
  selectBenchPlayer,
  swapBenchPlayers,
  syncBenchWithLineup,
} from './squadManagement';
import { ageAt } from './random';
import { assistantPayroll, salaryBudgets, setAssistantSalaryBudget, staffPayroll } from './staff';

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

  it('troca a ordem de dois reservas sem alterar titulares ou o elenco do banco', () => {
    const career = start();
    const original = [...career.bench];
    const updated = swapBenchPlayers(career, original[0], original[3]);
    const expected = [...original];
    [expected[0], expected[3]] = [expected[3], expected[0]];
    expect(updated.bench).toEqual(expected);
    expect(updated.lineup).toEqual(career.lineup);
    expect(career.bench).toEqual(original);
    expect(() => swapBenchPlayers(career, career.lineup[0], original[0])).toThrow(/banco/);
    expect(() => swapBenchPlayers(career, original[0], original[0])).toThrow(/diferentes/);
    const lineup = [...updated.lineup];
    lineup[10] = updated.bench[3];
    const replaced = syncBenchWithLineup(updated, lineup);
    expect(replaced.bench[3]).toBe(updated.lineup[10]);
    expect(replaced.bench.filter((id) => replaced.lineup.includes(id))).toEqual([]);
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

  it('contrata vários auxiliares por setor sem repetir a identidade em outro cargo', () => {
    const career = setAssistantSalaryBudget(start(), 100000);
    const candidate = assistantCandidates(career, 'ataque')[2];
    const hired = hireAssistant(career, 'ataque', candidate.id!);
    expect(hired.assistantCoaches[candidate.id!].stars.ST).toBe(candidate.stars.ST);
    expect(hired.assistantCoaches[candidate.id!].area).toBe('ataque');
    expect(staffPayroll(hired)).toBeGreaterThan(staffPayroll(start()));
    expect(() => hireAssistant(hired, 'defesa', candidate.id!)).toThrow(/já está contratado/);
    expect(assistantCandidates(hired, 'meio').some((item) => item.name === candidate.name)).toBe(
      false,
    );
    let updated = hired;
    for (const coach of assistantCandidates(hired, 'ataque').slice(0, 5))
      updated = hireAssistant(updated, 'ataque', coach.id!);
    expect(Object.values(updated.assistantCoaches)).toHaveLength(6);
    expect(Object.values(updated.assistantCoaches).every((coach) => coach.area === 'ataque')).toBe(
      true,
    );
    const fired = fireAssistant(updated, candidate.id!);
    expect(assistantPayroll(fired)).toBeLessThan(assistantPayroll(updated));
    expect(assistantCandidates(fired, 'defesa').some((item) => item.id === candidate.id)).toBe(
      true,
    );
  });

  it('mantém vinte identidades e características estáveis entre setores e temporadas', () => {
    const career = start();
    const candidates = assistantCandidates(career, 'ataque');
    expect(candidates).toHaveLength(20);
    expect(new Set(candidates.map((coach) => coach.id)).size).toBe(20);
    expect(new Set(candidates.map((coach) => coach.name)).size).toBe(20);
    expect(assistantCandidates({ ...career, season: 2027 }, 'goleiro')).toEqual(candidates);
  });

  it('redistribui o limite salarial sem gastar caixa e respeita os compromissos', () => {
    const career = start();
    const before = salaryBudgets(career);
    const updated = setAssistantSalaryBudget(career, 20000);
    const after = salaryBudgets(updated);
    expect(after.players + after.assistants).toBe(before.players + before.assistants);
    expect(after.players).toBe(before.players - 20000);
    expect(updated.finances[career.clubId].cash).toBe(career.finances[career.clubId].cash);
    expect(() => setAssistantSalaryBudget(career, before.available + 1)).toThrow(
      /salários dos jogadores/,
    );
    const candidate = assistantCandidates(career, 'ataque')[0];
    expect(() => hireAssistant(career, 'ataque', candidate.id!)).toThrow(/Orçamento salarial/);
    const hired = hireAssistant(updated, 'ataque', candidate.id!);
    expect(() => setAssistantSalaryBudget(hired, 0)).toThrow(/salários dos auxiliares/);
    expect(careerSchema.parse(hired).finances[career.clubId].assistantWageBudget).toBe(20000);
  });

  it('regulariza auxiliares legados duplicados e rejeita identidades novas repetidas', () => {
    const career = start();
    const coach = assistantCandidates(career, 'ataque')[0];
    career.assistantCoaches = {
      ataque: { ...coach, id: 'old-ataque' },
      meio: { ...coach, id: 'old-meio' },
    };
    const migrated = careerSchema.parse(career);
    expect(Object.values(migrated.assistantCoaches)).toHaveLength(1);
    expect(migrated.assistantCoaches.ataque.area).toBe('ataque');
    expect(migrated.messages[0].title).toBe('Cargos dos auxiliares regularizados');
    expect(careerSchema.parse(migrated).messages).toHaveLength(migrated.messages.length);
    expect(() =>
      careerSchema.parse({
        ...career,
        assistantCoaches: {
          first: { ...coach, area: 'ataque' },
          second: { ...coach, area: 'meio', name: 'Nome alterado' },
        },
      }),
    ).toThrow(/mais de um cargo/);
  });

  it('aplica somente o melhor bônus do setor responsável pela posição', () => {
    const career = setAssistantSalaryBudget(start(), 50000);
    const candidates = assistantCandidates(career, 'ataque');
    const hired = hireAssistant(career, 'ataque', candidates[4].id!);
    expect(assistantTrainingBonus(hired, 'ST')).toBeGreaterThan(0);
    expect(assistantTrainingBonus(hired, 'CM')).toBe(0);
    const second = hireAssistant(hired, 'ataque', candidates[0].id!);
    expect(assistantTrainingBonus(second, 'ST')).toBe(assistantTrainingBonus(hired, 'ST'));
  });
});
