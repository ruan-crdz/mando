import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyPlayerBirthYearCorrections } from './realWorld';
import { ageAt } from './random';
import { worldSchema } from './types';

const world = worldSchema.parse(
  JSON.parse(readFileSync(new URL('../../public/data/world-2026.json', import.meta.url), 'utf8')),
);

describe('correções de ano de nascimento nos saves antigos', () => {
  it('corrige por ID do atleta mesmo quando o snapshot antigo tem outro ID', () => {
    const saved = structuredClone(world);
    saved.id = 'legacy-world';
    const player = saved.players.find((p) => p.id === 'MANDO26_53FF89C17A9B7')!;
    player.birthDate = '1998-05-06';
    const corrected = applyPlayerBirthYearCorrections(saved);
    const thiago = corrected.players.find((p) => p.id === player.id)!;

    expect(thiago.birthDate).toBe('1984-05-06');
    expect(ageAt(thiago.birthDate, '2026-01-01')).toBe(42);
    expect(ageAt(thiago.birthDate, '2028-12-01')).toBe(44);
    expect(corrected.id).toBe(saved.id);
    expect(thiago).toEqual({ ...player, birthDate: '1984-05-06' });
    expect(saved.players.find((p) => p.id === player.id)!.birthDate).toBe('1998-05-06');
  });

  it('não altera os jogadores gerados nem repete uma correção já aplicada', () => {
    const generated = {
      ...world.players[0],
      id: 'academy-roster-2030-0',
      birthDate: '2013-01-01',
    };
    const saved = { ...world, players: [...world.players, generated] };
    const corrected = applyPlayerBirthYearCorrections(saved);

    expect(corrected).toBe(saved);
    expect(corrected.players.at(-1)).toBe(generated);
    expect(applyPlayerBirthYearCorrections(corrected)).toBe(corrected);
  });
});
