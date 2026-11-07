import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  advanceDay,
  createCareer,
  finishMatch,
  respondMessage,
  validateCareerForWorld,
} from './engine';
import { bestLineup, simulateMatch, syncBenchWithLineup } from './matches';
import { nextFixture } from './calendar';
import { careerWorld } from './live';
import { overall } from './ratings';
import { worldSchema, type Career } from './types';
import logos from './data/club-logos.json';
import faces from './data/player-faces.json';

const world = worldSchema.parse(
  JSON.parse(readFileSync(new URL('../../public/data/world-2026.json', import.meta.url), 'utf8')),
);

describe('mundo Brasileirão 2026', () => {
  it('traz os 40 clubes e os 1.758 atletas reais com elencos jogáveis', () => {
    expect(world.mode).toBe('official');
    expect(world.clubs).toHaveLength(40);
    expect(world.players).toHaveLength(1758);
    const names = world.players.map((p) => p.name);
    for (const star of ['Giorgian De Arrascaeta', 'Neymar', 'Lucas Moura', 'Vitor Roque'])
      expect(names).toContain(star);
    for (const club of world.clubs) {
      const squad = world.players.filter((p) => p.clubId === club.id);
      for (const pos of ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'])
        expect(
          squad.some((p) => p.position === pos),
          `${club.name} ${pos}`,
        ).toBe(true);
    }
    const lucas = world.players.find((p) => p.name === 'Lucas Moura')!;
    expect(lucas.position).toBe('RW');
    expect(overall(lucas)).toBe(79);
  });
  it('tem um escudo local válido para cada clube', () => {
    const files: Record<string, { file: string }> = logos;
    for (const club of world.clubs) {
      expect(files[club.id], club.name).toBeDefined();
      expect(
        existsSync(new URL(`../../public/assets/escudos/${files[club.id].file}`, import.meta.url)),
      ).toBe(true);
    }
  });
  it('tem rosto local para a maioria dos atletas e todos apontam para atletas reais', () => {
    const ids = new Set(world.players.map((p) => p.id));
    expect(faces.length / world.players.length).toBeGreaterThan(0.55);
    for (const id of faces) {
      expect(ids.has(id), id).toBe(true);
      expect(
        existsSync(new URL(`../../public/assets/jogadores/${id}.webp`, import.meta.url)),
        id,
      ).toBe(true);
    }
  });
  it('joga uma temporada completa com o elenco real', () => {
    let c: Career = createCareer(
      world,
      {
        firstName: 'Alex',
        lastName: 'Silva',
        age: 30,
        nationality: 'Brasil',
        style: 'Terno azul',
        appearance: '',
      },
      'sao-paulo',
      'Amador',
      'Realista',
      11,
    );
    for (let guard = 0; guard < 800 && !c.seasonEnded; guard++) {
      for (const m of c.messages.filter((m) => m.important && !m.resolved))
        c = respondMessage(c, m.id);
      const f = nextFixture(c);
      if (f && f.date <= c.date) {
        const live = careerWorld(world, c);
        c = syncBenchWithLineup(c, bestLineup(c, live));
        c = finishMatch({ ...c, activeMatch: simulateMatch(c, live, f) }, live);
        continue;
      }
      c = advanceDay(c, world);
    }
    expect(c.seasonEnded).toBe(true);
    expect(c.promoted).toHaveLength(4);
    expect(JSON.stringify(c).length).toBeLessThan(6_000_000);
    expect(() => validateCareerForWorld(c, world)).not.toThrow();
  }, 240_000);
});
