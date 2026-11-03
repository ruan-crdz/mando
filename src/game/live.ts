import { type Career, type Player, type World } from './types';

const BASE = Symbol('base-world');
const cache = new WeakMap<World, { key: string; value: World }>();

export const baseWorld = (world: World): World =>
  (world as World & { [BASE]?: World })[BASE] || world;

/**
 * Mundo visto pela carreira: snapshot imutável + divisões atuais + atletas da base.
 * O snapshot original nunca é alterado.
 */
export function careerWorld(world: World, career: Pick<Career, 'leagues' | 'youth'>): World {
  const base = baseWorld(world);
  const leagues = career.leagues || {};
  const youth: Player[] = career.youth || [];
  const changed = Object.entries(leagues).filter(
    ([id, league]) => base.clubs.find((c) => c.id === id)?.league !== league,
  );
  if (!changed.length && !youth.length) return base;
  const key = `${changed.map(([id, l]) => id + l).join(',')}|${youth.length}|${youth.at(-1)?.id}`;
  const hit = cache.get(base);
  if (hit && hit.key === key) return hit.value;
  const value = {
    ...base,
    clubs: base.clubs.map((c) => (leagues[c.id] ? { ...c, league: leagues[c.id] } : c)),
    players: youth.length ? [...base.players, ...youth] : base.players,
  } as World;
  Object.defineProperty(value, BASE, { value: base, enumerable: false });
  cache.set(base, { key, value });
  return value;
}
