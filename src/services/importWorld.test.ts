import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { createDemoWorld } from '../game/world';
import { parseWorldCsv } from './importWorld';

const demo = createDemoWorld();
const clubs = Papa.unparse(demo.clubs);
const players = Papa.unparse(
  demo.players.map(({ attributes, ...profile }) => ({ ...profile, ...attributes })),
);
describe('importação CSV', () => {
  it('valida o mundo completo sem depender de fontes externas', () => {
    const w = parseWorldCsv(
      clubs,
      players,
      'Fixture de teste interna',
      'Fixture de teste, não distribuir como dados reais',
    );
    expect(w.clubs).toHaveLength(40);
    expect(w.players).toHaveLength(1120);
    expect(w.snapshot).toBe('WORLD_SNAPSHOT_2026_01_01');
  });
  it('recusa atributos ausentes em vez de usar valores inventados', () => {
    const invalid = Papa.unparse(
      demo.players.map(({ attributes, ...profile }) => ({ ...profile, ...attributes, pace: '' })),
    );
    expect(() => parseWorldCsv(clubs, invalid, 'Teste', 'Teste')).toThrow();
  });
  it('recusa jogador sem clube e IDs duplicados', () => {
    const invalid = Papa.unparse(
      demo.players.map(({ attributes, ...profile }) => ({
        ...profile,
        ...attributes,
        clubId: 'missing',
      })),
    );
    expect(() => parseWorldCsv(clubs, invalid, 'Teste', 'Teste')).toThrow();
    expect(() =>
      parseWorldCsv(
        Papa.unparse([...demo.clubs.slice(1), demo.clubs[1]]),
        players,
        'Teste',
        'Teste',
      ),
    ).toThrow();
  });
});
