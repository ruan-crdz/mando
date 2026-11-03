import { squad } from './matches';
import { overall } from './ratings';
import { type Career, type Position, type World } from './types';

/** Numeração típica do futebol brasileiro por posição, da mais para a menos clássica. */
const preferred: Record<Position, number[]> = {
  GK: [1, 12, 23, 31, 40, 41],
  CB: [3, 4, 2, 6, 14, 15, 25, 33, 34, 44],
  LB: [6, 16, 26, 36, 46],
  RB: [2, 13, 22, 32, 42],
  DM: [5, 15, 8, 25, 35],
  CM: [8, 5, 16, 18, 20, 21, 28],
  AM: [10, 20, 18, 14, 24],
  LW: [11, 7, 17, 27, 47],
  RW: [7, 11, 17, 19, 27],
  ST: [9, 19, 29, 30, 39, 99],
};

/**
 * Números de camisa únicos para o elenco: escolhas do manager, depois o número real
 * do snapshot, depois uma numeração plausível por posição (melhores escolhem antes).
 */
export function shirtNumbers(c: Career, world: World, clubId = c.clubId) {
  const players = squad(c, world, clubId);
  const result: Record<string, number> = {};
  const taken = new Set<number>();
  const give = (id: string, n: number | undefined) => {
    if (!n || taken.has(n) || result[id]) return;
    result[id] = n;
    taken.add(n);
  };
  for (const p of players) give(p.id, c.numbers[p.id]);
  for (const p of players) give(p.id, p.number);
  const ordered = players
    .filter((p) => !result[p.id])
    .sort((a, b) => overall(b) - overall(a));
  for (const p of ordered) {
    const n = preferred[p.position].find((n) => !taken.has(n));
    give(p.id, n ?? Array.from({ length: 99 }, (_, i) => i + 1).find((n) => !taken.has(n)));
  }
  return result;
}

/** Define o número de um atleta do clube do manager, trocando com quem já o usa. */
export function setShirtNumber(career: Career, world: World, playerId: string, n: number): Career {
  if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error('Escolha um número entre 1 e 99.');
  if (career.players[playerId]?.clubId !== career.clubId)
    throw new Error('Só é possível numerar atletas do seu elenco.');
  const current = shirtNumbers(career, world);
  const holder = Object.keys(current).find((id) => current[id] === n && id !== playerId);
  const numbers = { ...career.numbers, [playerId]: n };
  if (holder) numbers[holder] = current[playerId];
  return { ...career, numbers };
}
