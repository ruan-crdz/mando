import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { advanceStep, applyStaffPlan, createCareer } from './engine';
import { worldSchema, type Career } from './types';

const world = worldSchema.parse(
  JSON.parse(readFileSync(new URL('../../public/data/world-2026.json', import.meta.url), 'utf8')),
);
const start = () =>
  createCareer(
    world,
    {
      firstName: 'Ruan',
      lastName: 'Montanari',
      age: 30,
      nationality: 'Brasil',
      style: 'Terno azul',
      appearance: '',
    },
    'sao-paulo',
    'Amador',
    'Realista',
    3,
  );

describe('avanço contínuo e auxiliar técnico', () => {
  it('modo eventos para na primeira novidade', () => {
    let c: Career = start();
    c = { ...c, messages: c.messages.map((m) => ({ ...m, resolved: true, read: true })) };
    let stop = null;
    for (let i = 0; i < 60 && !stop; i++) ({ career: c, stop } = advanceStep(c, world, 'event'));
    expect(stop).not.toBeNull();
  });

  it('modo automático simula os próprios jogos e o auxiliar manda o relatório', () => {
    let c: Career = start();
    let played = 0;
    for (let i = 0; i < 60; i++) {
      const r = advanceStep(c, world, 'auto');
      c = r.career;
      if (r.played) played++;
    }
    expect(played).toBeGreaterThan(2);
    expect(
      c.fixtures.filter((f) => f.result && (f.homeId === c.clubId || f.awayId === c.clubId)).length,
    ).toBe(played);
    const report = c.messages.find((m) => m.id.startsWith('scout-'));
    expect(report?.body).toContain('E aí, Ruan');
    const withPlan = c.messages.find((m) => m.id.startsWith('scout-') && m.tactic);
    if (withPlan) {
      const next = applyStaffPlan(c, world, withPlan.id);
      expect(next.tactic).toEqual(withPlan.tactic);
      expect(next.lineup).toHaveLength(11);
    }
  }, 120_000);
});
