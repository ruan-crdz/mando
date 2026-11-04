import { describe, expect, it } from 'vitest';
import { advanceDay, createCareer, reviewAcademyCandidate, validateCareerForWorld } from './engine';
import { ageAt } from './random';
import { type Manager } from './types';
import { createDemoWorld } from './world';

const world = createDemoWorld();
const manager: Manager = {
  firstName: 'Alex',
  lastName: 'Silva',
  age: 30,
  nationality: 'Brasil',
  style: 'Terno azul',
  appearance: '',
};

describe('peneira anual', () => {
  it('revela candidatos avaliáveis sem alterar o snapshot e promove somente os escolhidos', () => {
    let career = createCareer(world, manager, 'sao-paulo', 'Amador', 'Realista', 42);
    career.date = '2026-04-30';
    career.fixtures = career.fixtures.map((fixture) => ({ ...fixture, date: '2026-12-29' }));
    career = advanceDay(career, world);

    const candidates = career.living.academy!.candidates;
    expect(candidates.length).toBeGreaterThanOrEqual(3);
    expect(candidates.every((candidate) => ageAt(candidate.birthDate, career.date) >= 16)).toBe(true);
    expect(world.players.some((player) => player.id === candidates[0].id)).toBe(false);
    const promoted = candidates[0];
    const released = candidates[1];

    career = reviewAcademyCandidate(career, promoted.id, 'promote');
    career = reviewAcademyCandidate(career, released.id, 'release');

    expect(career.youth.some((player) => player.id === promoted.id)).toBe(true);
    expect(career.players[promoted.id].clubId).toBe(career.clubId);
    expect(career.players[promoted.id].wage).toBe(5000);
    expect(career.youth.some((player) => player.id === released.id)).toBe(false);
    expect(career.living.academy!.candidates.some((player) => player.id === released.id)).toBe(false);
    expect(() => validateCareerForWorld(career, world)).not.toThrow();
  });
});
