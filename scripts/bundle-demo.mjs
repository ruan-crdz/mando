import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({ root, server: { middlewareMode: true } });
try {
  const { createDemoWorld } = await server.ssrLoadModule(
    path.join(root, 'src', 'game', 'world.ts'),
  );
  const world = createDemoWorld();
  if (world.mode !== 'demo') throw new Error('Only the synthetic demonstration can be seeded.');
  const payload = JSON.stringify(world).replaceAll("'", "''");
  const sql = `begin;
do $seed$
declare v_payload jsonb := '${payload}'::jsonb; v_snapshot_id uuid := (v_payload->>'id')::uuid;
begin
  if exists(select 1 from public.world_snapshots where id=v_snapshot_id) then
    if exists(select 1 from public.world_snapshots where id=v_snapshot_id and payload=v_payload) then
      return;
    end if;
    raise exception 'Demo snapshot ID already exists with different data. Use a new version ID.';
  end if;
  insert into public.world_snapshots(id,snapshot,payload)
    values(v_snapshot_id,v_payload->>'snapshot',v_payload);
  insert into public.clubs(snapshot_id,id,name,league,profile)
    select v_snapshot_id,c->>'id',c->>'name',c->>'league',c from jsonb_array_elements(v_payload->'clubs') c;
  insert into public.players(snapshot_id,id,club_id,name,profile,attributes)
    select v_snapshot_id,p->>'id',p->>'clubId',p->>'name',p-'attributes',p->'attributes'
    from jsonb_array_elements(v_payload->'players') p;
  update public.world_snapshots set published=true where id=v_snapshot_id;
end;
$seed$;
commit;
select 'Synthetic demo published separately from official worlds.' as result;
`;
  const output = path.join(root, 'dist-edge');
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'demo-world.sql'), sql, 'utf8');
  console.log('Generated dist-edge/demo-world.sql (synthetic data only).');
} finally {
  await server.close();
}
