import { describe, expect, it } from 'vitest';
import { createDemoWorld } from './world';
import { advanceDay, createCareer } from './engine';
import { careerWorld } from './live';
import { overall } from './ratings';
import {
  familiarity,
  LEARNED,
  naturalFamiliarity,
  positionPenalty,
  setMainPosition,
  setTraining,
} from './positions';
import { type Manager } from './types';

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
const striker = () => {
  const c = start();
  const p = world.players.find((p) => c.players[p.id]?.clubId === c.clubId && p.position === 'ST')!;
  return { c, p };
};

describe('posições e familiaridade', () => {
  it('goleiro na linha é desastre; vizinhas perdem pouco', () => {
    expect(naturalFamiliarity('GK', 'ST')).toBe(5);
    expect(naturalFamiliarity('ST', 'AM')).toBeGreaterThan(naturalFamiliarity('ST', 'CB'));
    expect(naturalFamiliarity('LB', 'RB')).toBeLessThan(naturalFamiliarity('LB', 'CB') + 30);
  });

  it('secundária pesquisada e treino reduzem a perda de overall', () => {
    const { c, p } = striker();
    const raw = familiarity(p, 'AM');
    expect(familiarity({ ...p, secondary: ['AM'] }, 'AM')).toBe(92);
    expect(familiarity(p, 'AM', { ...c.players[p.id], trained: { AM: 90 } })).toBe(
      Math.max(raw, 90),
    );
    expect(overall(p, 'GK')).toBeLessThan(overall(p, 'ST') - 15);
    expect(positionPenalty(100)).toBe(0);
  });

  it('treino diário evolui a função até ficar apto e permite virar principal', () => {
    const { c, p } = striker();
    expect(() => setMainPosition(c, p, 'CB')).toThrow(/Treine/);
    expect(() => setTraining(c, p, 'GK')).toThrow();
    let career = setTraining(c, p, 'CB');
    expect(career.players[p.id].training).toBe('CB');
    const before = familiarity(p, 'CB', career.players[p.id]);
    for (let i = 0; i < 3; i++) career = advanceDay(career, careerWorld(world, career));
    const after = familiarity(p, 'CB', career.players[p.id]);
    expect(after).toBeGreaterThan(before);
    career = {
      ...career,
      players: { ...career.players, [p.id]: { ...career.players[p.id], trained: { CB: LEARNED } } },
    };
    career = setMainPosition(career, p, 'CB');
    const live = careerWorld(world, career).players.find((x) => x.id === p.id)!;
    expect(live.position).toBe('CB');
    expect(live.secondary).toContain('ST');
  });
});
