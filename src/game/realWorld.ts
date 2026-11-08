import { worldSchema, type World } from './types';
import logos from './data/club-logos.json';
import birthYears from './data/player-birth-years.json';

const correctedBirthYears: Partial<Record<string, string>> = birthYears;

export const WORLD_2026_URL = `${import.meta.env.BASE_URL}data/world-2026.json`;

export async function loadWorld2026(): Promise<World> {
  const response = await fetch(WORLD_2026_URL, { cache: 'no-cache' });
  if (!response.ok)
    throw new Error(`Não foi possível carregar os elencos de 2026 (HTTP ${response.status}).`);
  return applyPlayerBirthYearCorrections(worldSchema.parse(await response.json()));
}

export function applyPlayerBirthYearCorrections(saved: World): World {
  let changed = false;
  const players = saved.players.map((player) => {
    const year = correctedBirthYears[player.id];
    if (!year || player.birthDate.slice(0, 4) === year) return player;
    changed = true;
    return { ...player, birthDate: `${year}${player.birthDate.slice(4)}` };
  });
  return changed ? { ...saved, players } : saved;
}

const files: Record<string, { file: string }> = logos;
export const clubLogo = (clubId: string) =>
  files[clubId] ? `${import.meta.env.BASE_URL}assets/escudos/${files[clubId].file}` : null;
