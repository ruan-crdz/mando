import { type Career, type Player, type World } from './types';

const BASE = Symbol('base-world');
const cache = new WeakMap<World, { key: string; value: World }>();

export const baseWorld = (world: World): World =>
  (world as World & { [BASE]?: World })[BASE] || world;

/**
 * Mundo visto pela carreira: snapshot imutável + divisões atuais + atletas da base.
 * O snapshot original nunca é alterado.
 */
export function careerWorld(
  world: World,
  career: Pick<Career, 'leagues' | 'youth'> & Partial<Pick<Career, 'players'>>,
): World {
  const base = baseWorld(world);
  const leagues = career.leagues || {};
  const youth: Player[] = career.youth || [];
  const changed = Object.entries(leagues).filter(
    ([id, league]) => base.clubs.find((c) => c.id === id)?.league !== league,
  );
  // Mudanças de posição principal feitas pelo treinador.
  const moved = Object.entries(career.players || {}).filter(([, s]) => s.position);
  if (!changed.length && !youth.length && !moved.length) return base;
  const key = `${changed.map(([id, l]) => id + l).join(',')}|${youth.length}|${youth.at(-1)?.id}|${moved.map(([id, s]) => id + s.position).join(',')}`;
  const positions = new Map(moved.map(([id, s]) => [id, s.position!]));
  const move = (p: Player): Player => {
    const to = positions.get(p.id);
    if (!to || to === p.position) return p;
    return {
      ...p,
      position: to,
      secondary: [p.position, ...(p.secondary || [])].filter((x) => x !== to).slice(0, 3),
    };
  };
  const hit = cache.get(base);
  if (hit && hit.key === key) return hit.value;
  const value = {
    ...base,
    clubs: base.clubs.map((c) => (leagues[c.id] ? { ...c, league: leagues[c.id] } : c)),
    players: (youth.length ? [...base.players, ...youth] : base.players).map((p) =>
      positions.size ? move(p) : p,
    ),
  } as World;
  Object.defineProperty(value, BASE, { value: base, enumerable: false });
  cache.set(base, { key, value });
  return value;
}
