import { assertEquals, assertMatch } from 'jsr:@std/assert@1';
import { handle } from './handler.ts';

const userId = '00000000-0000-4000-8000-000000000001';
const careerId = '00000000-0000-4000-8000-000000000002';
const jobId = '00000000-0000-4000-8000-000000000003';
function configure() {
  Deno.env.set('ALLOWED_ORIGINS', 'http://localhost:5173');
  Deno.env.set('SUPABASE_URL', 'https://test-project.supabase.co');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-only-not-a-real-key');
  Deno.env.set('OPENAI_API_KEY', 'test-only-not-a-real-key');
  Deno.env.delete('OPENAI_IMAGE_MODEL');
}
function request(body: unknown = { careerId, eventId: 'event-1' }) {
  return new Request('https://edge.test/ai-message', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:5173',
      'content-type': 'application/json',
      authorization: 'Bearer test-jwt',
    },
    body: JSON.stringify(body),
  });
}
const json = (body: unknown, status = 200) => Response.json(body, { status });
const engineEvent = {
  id: 'event-1',
  from: 'Auxiliar',
  title: 'Plano do jogo',
  body: 'Precisamos descansar o time.',
  kind: 'staff',
  important: true,
};
const state = {
  date: '2026-01-01',
  manager: {
    firstName: 'Alex',
    lastName: 'Silva',
    age: 30,
    style: 'Terno azul',
    appearance: 'Cabelo curto',
  },
  messages: [engineEvent],
  memories: [],
};

Deno.test(
  'CORS, preflight e autenticação são verificados antes de qualquer chamada paga',
  async () => {
    configure();
    const oldFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = () => {
      calls++;
      throw new Error('Nenhuma chamada externa deveria ocorrer.');
    };
    try {
      const options = await handle(
        new Request('https://edge.test', {
          method: 'OPTIONS',
          headers: { origin: 'http://localhost:5173' },
        }),
        'message',
      );
      assertEquals(options.status, 204);
      const denied = await handle(
        new Request('https://edge.test', {
          method: 'POST',
          headers: { origin: 'https://untrusted.test' },
        }),
        'message',
      );
      assertEquals(denied.status, 403);
      const unauth = await handle(
        new Request('https://edge.test', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }),
        'message',
      );
      assertEquals(unauth.status, 401);
      assertEquals(calls, 0);
    } finally {
      globalThis.fetch = oldFetch;
    }
  },
);

Deno.test('gera texto estruturado sem delegar alterações de estado para IA', async () => {
  configure();
  const oldFetch = globalThis.fetch;
  let paidCalls = 0;
  const changes: unknown[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/auth/v1/user')
      return json({ id: userId, aud: 'authenticated', role: 'authenticated' });
    if (url.pathname === '/rest/v1/career_saves') {
      assertEquals(url.searchParams.get('user_id'), `eq.${userId}`);
      return json({ state });
    }
    if (url.pathname === '/rest/v1/rpc/claim_ai_job') return json(jobId);
    if (url.pathname === '/rest/v1/ai_jobs' && init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body));
      changes.push(body);
      return json(body.status ? null : [{ id: jobId }]);
    }
    if (url.pathname === '/rest/v1/ai_jobs')
      return json({ status: 'running', output: null, created_at: new Date().toISOString() });
    if (url.pathname === '/v1/responses') {
      paidCalls++;
      const body = JSON.parse(String(init?.body));
      assertEquals(body.store, false);
      assertEquals(body.text.format.strict, true);
      assertMatch(body.instructions, /Nunca altere moral/);
      return json({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  message: 'Professor, precisamos dar um descanso ao elenco.',
                  tone: 'concerned',
                  requires_response: false,
                }),
              },
            ],
          },
        ],
      });
    }
    throw new Error(`Chamada inesperada: ${url.pathname}`);
  };
  try {
    const response = await handle(request(), 'staff');
    assertEquals(response.status, 200);
    const output = await response.json();
    assertEquals(output.requires_response, true);
    assertEquals(paidCalls, 1);
    assertEquals(Object.keys(output).sort(), ['message', 'requires_response', 'tone']);
    assertEquals(changes.length, 2);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

Deno.test(
  'resposta em cache não chama OpenAI novamente e job em andamento não é cancelado',
  async () => {
    configure();
    const oldFetch = globalThis.fetch;
    let complete = true;
    let mutations = 0;
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname === '/auth/v1/user')
        return json({ id: userId, aud: 'authenticated', role: 'authenticated' });
      if (url.pathname === '/rest/v1/career_saves') return json({ state });
      if (url.pathname === '/rest/v1/rpc/claim_ai_job') return json(jobId);
      if (url.pathname === '/rest/v1/ai_jobs' && init?.method === 'PATCH') {
        mutations++;
        return json([]);
      }
      if (url.pathname === '/rest/v1/ai_jobs')
        return json({
          status: complete ? 'completed' : 'running',
          output: complete
            ? { message: 'Texto já gerado.', tone: 'neutral', requires_response: true }
            : { lease: 'other-request' },
          created_at: new Date().toISOString(),
        });
      throw new Error('Cache não deve consumir a OpenAI.');
    };
    try {
      assertEquals((await handle(request(), 'staff')).status, 200);
      assertEquals(mutations, 0);
      complete = false;
      assertEquals((await handle(request(), 'staff')).status, 409);
      assertEquals(mutations, 1);
    } finally {
      globalThis.fetch = oldFetch;
    }
  },
);

Deno.test('erros do provedor são acionáveis sem expor o corpo privado', async () => {
  configure();
  const oldFetch = globalThis.fetch;
  const oldLog = console.error;
  const logs: unknown[][] = [];
  console.error = (...args: unknown[]) => logs.push(args);
  try {
    for (const scenario of [
      { code: 'billing_hard_limit_reached', upstream: 400, status: 429, message: /faturamento/ },
      { code: null, upstream: 403, status: 502, message: /verificação da organização/ },
      { code: 'private-sentinel', upstream: 400, status: 502, message: /não concluiu/ },
    ]) {
      globalThis.fetch = async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (url.pathname === '/auth/v1/user') return json({ id: userId, aud: 'authenticated' });
        if (url.pathname === '/rest/v1/career_saves') return json({ state });
        if (url.pathname === '/rest/v1/rpc/claim_ai_job') return json(jobId);
        if (url.pathname === '/rest/v1/ai_jobs' && init?.method === 'PATCH') {
          const change = JSON.parse(String(init.body));
          return json(change.status ? null : [{ id: jobId }]);
        }
        if (url.pathname === '/rest/v1/ai_jobs')
          return json({ status: 'running', output: null, created_at: new Date().toISOString() });
        if (url.pathname === '/v1/images/generations') {
          const body = JSON.parse(String(init?.body));
          assertEquals(body.model, 'gpt-image-2.5-flare');
          assertEquals(body.quality, 'low');
          return json(
            { error: { code: scenario.code, message: 'private-sentinel' } },
            scenario.upstream,
          );
        }
        throw new Error(`Chamada inesperada: ${url.pathname}`);
      };
      const response = await handle(request({ careerId }), 'avatar');
      assertEquals(response.status, scenario.status);
      const output = await response.json();
      assertMatch(output.error, scenario.message);
      assertEquals(JSON.stringify(output).includes('private-sentinel'), false);
    }
    assertEquals(JSON.stringify(logs).includes('private-sentinel'), false);
  } finally {
    globalThis.fetch = oldFetch;
    console.error = oldLog;
  }
});
