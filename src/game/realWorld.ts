import { worldSchema, type World } from './types';
import logos from './data/club-logos.json';

export const WORLD_2026_URL = `${import.meta.env.BASE_URL}data/world-2026.json`;

export async function loadWorld2026(): Promise<World> {
  const response = await fetch(WORLD_2026_URL);
  if (!response.ok)
    throw new Error(`Não foi possível carregar os elencos de 2026 (HTTP ${response.status}).`);
  return worldSchema.parse(await response.json());
}

const files: Record<string, { file: string }> = logos;
export const clubLogo = (clubId: string) =>
  files[clubId] ? `${import.meta.env.BASE_URL}assets/escudos/${files[clubId].file}` : null;
