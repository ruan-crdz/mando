import { worldSchema, type World } from './types';
import logos from './data/club-logos.json';

export const WORLD_2026_URL = `${import.meta.env.BASE_URL}data/world-2026.json`;

export async function loadWorld2026(): Promise<World> {
  const response = await fetch(WORLD_2026_URL, { cache: 'no-cache' });
  if (!response.ok)
    throw new Error(`Não foi possível carregar os elencos de 2026 (HTTP ${response.status}).`);
  return worldSchema.parse(await response.json());
}

export function refreshPlayerBirthYears(saved: World, latest: World): World {
  if (saved.id !== latest.id || saved.mode !== latest.mode) return saved;
  const latestPlayers = new Map(latest.players.map((player) => [player.id, player]));
  let changed = false;
  const players = saved.players.map((player) => {
    const updated = latestPlayers.get(player.id);
    if (!updated || player.birthDate.slice(0, 4) === updated.birthDate.slice(0, 4)) return player;
    changed = true;
    return { ...player, birthDate: `${updated.birthDate.slice(0, 4)}${player.birthDate.slice(4)}` };
  });
  return changed ? { ...saved, players } : saved;
}

const files: Record<string, { file: string }> = logos;
export const clubLogo = (clubId: string) =>
  files[clubId] ? `${import.meta.env.BASE_URL}assets/escudos/${files[clubId].file}` : null;
