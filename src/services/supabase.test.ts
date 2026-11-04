import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { FunctionsHttpError } from '@supabase/supabase-js';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@supabase/supabase-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/supabase-js')>()),
  createClient: () => ({
    functions: { invoke },
    auth: { getSession: async () => ({ data: { session: { user: { id: 'guest' } } } }) },
  }),
}));

let api: typeof import('./supabase');
beforeAll(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key');
  api = await import('./supabase');
});
beforeEach(() => invoke.mockReset());
const manager = {
  firstName: 'Ruan',
  lastName: 'Montanari',
  age: 34,
  style: 'Terno',
  appearance: '',
};
afterAll(() => vi.unstubAllEnvs());

it('preserva a explicação do servidor para diálogos e retratos', async () => {
  invoke.mockImplementation(async () => ({
    data: null,
    error: new FunctionsHttpError(
      Response.json({ error: 'Confira o limite de faturamento da API.' }, { status: 429 }),
    ),
  }));
  await expect(api.requestAi('career', 'event', 'staff')).rejects.toThrow(
    'Não foi possível gerar o diálogo: Confira o limite de faturamento da API.',
  );
  await expect(api.requestPortrait(manager)).rejects.toThrow(
    'Não foi possível gerar o retrato: Confira o limite de faturamento da API.',
  );
});

it('expõe uma resposta HTTP inválida como falha, não como sucesso', async () => {
  invoke.mockResolvedValue({
    data: null,
    error: new FunctionsHttpError(new Response('invalid-json', { status: 502 })),
  });
  await expect(api.requestPortrait(manager)).rejects.toThrow('erro HTTP 502 com resposta inválida');
});

it('mantém a validação de respostas bem-sucedidas', async () => {
  invoke.mockResolvedValue({
    data: { message: 'Professor, vamos ao trabalho.', tone: 'neutral', requires_response: false },
    error: null,
  });
  await expect(api.requestAi('career', 'event', 'staff')).resolves.toMatchObject({
    message: 'Professor, vamos ao trabalho.',
  });
  invoke.mockResolvedValue({ data: { url: 'https://example.test/portrait.png' }, error: null });
  await expect(api.requestPortrait(manager)).resolves.toBe('https://example.test/portrait.png');
});
