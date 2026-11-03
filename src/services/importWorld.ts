import Papa from 'papaparse';
import {
  attributeKeys,
  clubSchema,
  playerSchema,
  SNAPSHOT,
  worldSchema,
  type World,
} from '../game/types';
import { supabase } from './supabase';

function parseCsv(text: string): Record<string, string>[] {
  if (new TextEncoder().encode(text).length > 8000000)
    throw new Error('CSV acima do limite de 8 MB.');
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (s) => s.trim(),
  });
  if (result.errors.length) throw new Error(`CSV inválido: ${result.errors[0].message}`);
  if (!result.data.length) throw new Error('CSV sem registros.');
  return result.data;
}

const numeric = (row: Record<string, string>, key: string) =>
  row[key]?.trim() ? Number(row[key]) : NaN;

export function parseWorldCsv(
  clubText: string,
  playerText: string,
  source: string,
  license: string,
): World {
  const clubs = parseCsv(clubText).map((r) =>
    clubSchema.parse({
      ...r,
      budget: numeric(r, 'budget'),
      debt: numeric(r, 'debt'),
      reputation: numeric(r, 'reputation'),
    }),
  );
  const players = parseCsv(playerText).map((r) =>
    playerSchema.parse({
      ...r,
      potential: numeric(r, 'potential'),
      uncertainty: numeric(r, 'uncertainty'),
      value: numeric(r, 'value'),
      wage: numeric(r, 'wage'),
      attributes: Object.fromEntries(
        attributeKeys.map((key) => [key, r[key]?.trim() ? Number(r[key]) : NaN]),
      ),
    }),
  );
  return worldSchema.parse({
    id: crypto.randomUUID(),
    snapshot: SNAPSHOT,
    date: '2026-01-01',
    mode: 'official',
    source,
    license,
    clubs,
    players,
  });
}

export async function publishWorld(world: World) {
  if (!supabase) throw new Error('Configure o Supabase antes de publicar.');
  const { error } = await supabase.rpc('publish_world', { p_payload: worldSchema.parse(world) });
  if (error) throw new Error(`Publicação recusada: ${error.message}`);
}
