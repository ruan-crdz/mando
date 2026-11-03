import { createClient, FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';
import { careerSchema, worldSchema, type Career, type World } from '../game/types';
import { validateCareerForWorld } from '../game/engine';
import { type Database } from '../../supabase/functions/_shared/database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const config = z
  .object({
    url: z
      .string()
      .url()
      .regex(/^https?:\/\//),
    key: z.string().min(8),
  })
  .safeParse({ url, key });
export const supabaseConfigError =
  !url && !key
    ? null
    : !config.success
      ? 'Configuração Supabase inválida. Informe uma URL válida e a publishable key juntas.'
      : null;
export const supabase = config.success
  ? createClient<Database>(config.data.url, config.data.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

function client() {
  if (!supabase) throw new Error('Supabase não configurado. Consulte a conexão no menu.');
  return supabase;
}

export async function signIn(email: string) {
  const { error } = await client().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: new URL(import.meta.env.BASE_URL, location.origin).href },
  });
  if (error) throw error;
}

export async function loadPublishedWorld(): Promise<World> {
  const { data, error } = await client()
    .from('world_snapshots')
    .select('payload')
    .eq('published', true)
    .eq('payload->>mode', 'official')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw new Error(`Nenhum snapshot oficial publicado: ${error.message}`);
  const world = worldSchema.parse(data.payload);
  if (world.mode !== 'official') throw new Error('O snapshot publicado não é um mundo oficial.');
  return world;
}

export async function saveCloud(career: Career, revision: number): Promise<number> {
  if (!z.string().uuid().safeParse(career.worldId).success)
    throw new Error(
      'Esta demonstração antiga continua disponível offline. Crie uma nova carreira para usar a nuvem.',
    );
  const { data, error } = await client().rpc('save_career', {
    p_id: career.id,
    p_world_id: career.worldId,
    p_state: career,
    p_expected_revision: revision,
  });
  if (error) throw new Error(`Falha na sincronização: ${error.message}`);
  return z.number().int().positive().parse(data);
}

export async function listCloud(): Promise<
  { career: Career; revision: number; savedAt: string; world: World }[]
> {
  const { data, error } = await client()
    .from('career_saves')
    .select('state, revision, updated_at, world_snapshots(payload)')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => {
    const relation = z.object({ payload: worldSchema }).parse(row.world_snapshots);
    const career = careerSchema.parse(row.state);
    validateCareerForWorld(career, relation.payload);
    return {
      career,
      revision: z.number().parse(row.revision),
      savedAt: row.updated_at,
      world: relation.payload,
    };
  });
}

export async function requestAi(
  careerId: string,
  eventId: string,
  kind: 'message' | 'news' | 'staff',
) {
  const { data, error } = await client().functions.invoke(`ai-${kind}`, {
    body: { careerId, eventId },
  });
  if (error) await functionFailure(error, 'Não foi possível gerar o diálogo');
  return z
    .object({ message: z.string().min(1), tone: z.string(), requires_response: z.boolean() })
    .parse(data);
}

export async function requestAvatar(careerId: string) {
  const { data, error } = await client().functions.invoke('ai-manager-avatar', {
    body: { careerId },
  });
  if (error) await functionFailure(error, 'Não foi possível gerar o retrato');
  return z.object({ url: z.string().url() }).parse(data).url;
}

async function functionFailure(error: Error, label: string): Promise<never> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    let body: unknown;
    try {
      body = await error.context.json();
    } catch (cause) {
      if (!(cause instanceof SyntaxError)) throw cause;
      throw new Error(`${label}: erro HTTP ${error.context.status} com resposta inválida.`, {
        cause,
      });
    }
    const details = z.object({ error: z.string().min(1) }).safeParse(body);
    if (details.success) throw new Error(`${label}: ${details.data.error}`);
  }
  throw new Error(`${label}: ${error.message}`);
}
