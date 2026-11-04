import { formations, type Formation } from './types';

const line = (role: string, formation: Formation) => {
  if (formation === '3-5-2' && (role === 'LB' || role === 'RB')) return 1;
  if (['LB', 'CB', 'RB'].includes(role)) return 0;
  if (['DM', 'CM', 'LM', 'RM'].includes(role)) return 1;
  if (['AM', 'LW', 'RW'].includes(role)) return 2;
  return 3;
};

/**
 * Posições (em %) de cada função da formação num campo vertical, com o goleiro
 * embaixo (y≈87) e o ataque em cima (y≈12).
 */
export function pitchCoordinates(formation: Formation) {
  const roles = formations[formation];
  return roles.map((role, i) => {
    if (i === 0) return { x: 50, y: 87 };
    const category = line(role, formation);
    const group = roles
      .map((r, j) => ({ r, j }))
      .filter(({ r, j }) => j > 0 && line(r, formation) === category);
    return {
      x: ((group.findIndex(({ j }) => j === i) + 1) * 100) / (group.length + 1),
      y: [68, 49, 30, 12][category],
    };
  });
}

/** Mesmas posições num campo horizontal: o mandante ataca para a direita. */
export function horizontalCoordinates(formation: Formation, away: boolean) {
  return pitchCoordinates(formation).map(({ x, y }) => {
    const depth = 4 + ((100 - y) / 100) * 44;
    return { x: away ? 100 - depth : depth, y: away ? 100 - x : x };
  });
}
