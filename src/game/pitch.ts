import { formations, type Formation } from './types';

export const formationRows: Record<Formation, readonly number[]> = {
  '4-2-3-1': [4, 2, 3, 1],
  '4-3-3': [4, 3, 3],
  '4-4-2': [4, 4, 2],
  '3-5-2': [3, 5, 2],
  '4-1-4-1': [4, 1, 4, 1],
  '4-3-2-1': [4, 3, 2, 1],
  '4-4-2 losango': [4, 1, 2, 1, 2],
  '3-4-3': [3, 4, 3],
  '3-4-2-1': [3, 4, 2, 1],
  '5-3-2': [5, 3, 2],
  '5-4-1': [5, 4, 1],
};

/**
 * Posições (em %) de cada função da formação num campo vertical, com o goleiro
 * embaixo (y≈87) e o ataque em cima (y≈12).
 */
export function pitchCoordinates(formation: Formation) {
  const roles = formations[formation];
  const rows = formationRows[formation];
  return roles.map((_, i) => {
    if (i === 0) return { x: 50, y: 87 };
    let first = 1;
    for (let row = 0; row < rows.length; row++) {
      const count = rows[row];
      if (i < first + count)
        return {
          x:
            (((row === rows.length - 1 &&
            count === 3 &&
            roles.slice(first, first + count).some((role) => role === 'LW')
              ? roles[i] === 'LW'
                ? 0
                : roles[i] === 'RW'
                  ? 2
                  : 1
              : i - first) +
              1) *
              100) /
            (count + 1),
          y: 69 - (row * 57) / (rows.length - 1),
        };
      first += count;
    }
    throw new Error(`Formação ${formation} não tem coordenadas para o atleta ${i}.`);
  });
}

/** Mesmas posições num campo horizontal: o mandante ataca para a direita. */
export function horizontalCoordinates(formation: Formation, away: boolean) {
  return pitchCoordinates(formation).map(({ x, y }) => {
    const depth = 4 + ((100 - y) / 100) * 44;
    return { x: away ? 100 - depth : depth, y: away ? 100 - x : x };
  });
}
