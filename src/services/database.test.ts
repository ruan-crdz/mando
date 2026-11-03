import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createDemoWorld } from '../game/world';
import { createCareer } from '../game/engine';

let db: PGlite;
const userA = '00000000-0000-4000-8000-000000000001';
const userB = '00000000-0000-4000-8000-000000000002';
const world = {
  ...createDemoWorld(),
  id: '10000000-0000-4000-8000-000000000001',
  mode: 'official' as const,
};
const career = createCareer(
  world,
  {
    firstName: 'Alex',
    lastName: 'Silva',
    age: 30,
    nationality: 'Brasil',
    style: 'Terno azul',
    appearance: 'Teste',
  },
  'sao-paulo',
  'Amador',
  'Realista',
  1,
);
async function identity(id: string, admin = false) {
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: id, app_metadata: { role: admin ? 'admin' : 'user' } }),
  ]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select nullif(current_setting('request.jwt.claims',true),'')::jsonb
    $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key,bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
    grant usage on schema public,auth,storage to authenticated,anon;
    insert into auth.users values('${userA}'),('${userB}');
  `);
  // PGlite has gen_random_uuid in core, but does not ship the optional pgcrypto extension.
  const migration = await readFile(
    new URL('../../supabase/migrations/202611030001_world_and_careers.sql', import.meta.url),
    'utf8',
  );
  await db.exec(
    migration.replace('create extension if not exists pgcrypto with schema extensions;', ''),
  );
  await db.exec(
    await readFile(
      new URL('../../supabase/migrations/202611030002_demo_cloud.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        '../../supabase/migrations/202611030003_explicit_save_conflicts.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});

describe('migrations PostgreSQL e isolamento', () => {
  it('recusa publicação por usuário comum', async () => {
    await identity(userA);
    await expect(
      db.query('select public.publish_world($1::jsonb)', [JSON.stringify(world)]),
    ).rejects.toThrow('Administrator');
  });
  it('importa atomicamente 40 clubes e 1.120 jogadores com autorização', async () => {
    await identity(userA, true);
    await db.query('select public.publish_world($1::jsonb)', [JSON.stringify(world)]);
    const result = await db.query<{ count: number }>(
      'select count(*)::integer as count from public.players',
    );
    expect(result.rows[0].count).toBe(1120);
  });
  it('impede mudar o snapshot publicado', async () => {
    await expect(
      db.query('update public.world_snapshots set payload = $1 where id = $2', ['{}', world.id]),
    ).rejects.toThrow('immutable');
  });
  it('salva com revisão otimista e recusa conflito', async () => {
    await identity(userA);
    const r = await db.query<{ revision: number }>(
      'select public.save_career($1,$2,$3,0) as revision',
      [career.id, world.id, JSON.stringify(career)],
    );
    expect(r.rows[0].revision).toBe(1);
    await expect(
      db.query('select public.save_career($1,$2,$3,0)', [
        career.id,
        world.id,
        JSON.stringify(career),
      ]),
    ).rejects.toMatchObject({ code: 'PT409' });
    const r2 = await db.query<{ revision: number }>(
      'select public.save_career($1,$2,$3,1) as revision',
      [career.id, world.id, JSON.stringify(career)],
    );
    expect(r2.rows[0].revision).toBe(2);
  });
  it('não permite que outro usuário sobrescreva ou leia uma carreira', async () => {
    await identity(userB);
    await expect(
      db.query('select public.save_career($1,$2,$3,2)', [
        career.id,
        world.id,
        JSON.stringify(career),
      ]),
    ).rejects.toThrow('conflict');
    await db.exec('set role authenticated');
    try {
      expect((await db.query('select id from public.career_saves')).rows).toHaveLength(0);
      expect(
        (await db.query('select career_id from public.career_player_state')).rows,
      ).toHaveLength(0);
      await expect(
        db.query(
          "insert into public.career_saves(id,user_id,world_id,state) values(gen_random_uuid(),$1,$2,'{}')",
          [userB, world.id],
        ),
      ).rejects.toThrow('permission denied');
    } finally {
      await db.exec('reset role');
    }
    await identity(userA);
    await db.exec('set role authenticated');
    try {
      expect((await db.query('select id from public.career_saves')).rows).toHaveLength(1);
    } finally {
      await db.exec('reset role');
    }
  });
  it('rejeita demo como oficial e não permite consumir IA de outro usuário', async () => {
    await identity(userA);
    await expect(
      db.query('select public.save_career($1,$2,$3,2)', [
        career.id,
        world.id,
        JSON.stringify({ ...career, mode: 'demo' }),
      ]),
    ).rejects.toThrow('Invalid');
    await expect(
      db.query("select public.claim_ai_job($1,$2,'a','message')", [userB, career.id]),
    ).rejects.toThrow('not found');
  });
  it('deduplica os jobs de IA e impõe limite diário de 30 pedidos', async () => {
    const first = await db.query<{ id: string }>(
      "select public.claim_ai_job($1,$2,'test-event','message') as id",
      [userA, career.id],
    );
    const again = await db.query<{ id: string }>(
      "select public.claim_ai_job($1,$2,'test-event','message') as id",
      [userA, career.id],
    );
    expect(again.rows[0].id).toBe(first.rows[0].id);
    await db.query("update public.ai_jobs set updated_at=now()-interval '6 minutes' where id=$1", [
      first.rows[0].id,
    ]);
    await db.query("select public.claim_ai_job($1,$2,'test-event','message')", [userA, career.id]);
    const stale = await db.query<{ status: string }>(
      'select status from public.ai_jobs where id=$1',
      [first.rows[0].id],
    );
    expect(stale.rows[0].status).toBe('failed');
    for (let i = 1; i < 30; i++)
      await db.query("select public.claim_ai_job($1,$2,$3,'message')", [
        userA,
        career.id,
        `event-${i}`,
      ]);
    await expect(
      db.query("select public.claim_ai_job($1,$2,'event-over','message')", [userA, career.id]),
    ).rejects.toThrow('Daily AI limit');
    await db.exec('set role authenticated');
    try {
      await expect(
        db.query("select public.claim_ai_job($1,$2,'event-direct','message')", [userA, career.id]),
      ).rejects.toThrow('permission denied');
    } finally {
      await db.exec('reset role');
    }
  });
  it('sincroniza demo sem permitir que ela seja relabelada como oficial', async () => {
    const demo = createDemoWorld();
    const demoCareer = createCareer(demo, career.manager, career.clubId, 'Amador', 'Realista', 2);
    await db.query(
      'insert into public.world_snapshots(id,snapshot,payload,published) values($1,$2,$3,true)',
      [demo.id, demo.snapshot, JSON.stringify(demo)],
    );
    await identity(userA);
    await db.exec('set role authenticated');
    try {
      const saved = await db.query<{ revision: number }>(
        'select public.save_career($1,$2,$3,0) as revision',
        [demoCareer.id, demo.id, JSON.stringify(demoCareer)],
      );
      expect(saved.rows[0].revision).toBe(1);
      await expect(
        db.query('select public.save_career($1,$2,$3,1)', [
          demoCareer.id,
          demo.id,
          JSON.stringify({ ...demoCareer, mode: 'official' }),
        ]),
      ).rejects.toThrow('Invalid');
      const official = await db.query(
        "select id from public.world_snapshots where published and payload->>'mode'='official'",
      );
      expect(official.rows).toHaveLength(1);
    } finally {
      await db.exec('reset role');
    }
  });
});
