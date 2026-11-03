// Gera dist-edge/world-2026.sql para publicar o snapshot Brasileirão 2026 no Supabase.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const world = JSON.parse(
  await readFile(path.join(root, 'public', 'data', 'world-2026.json'), 'utf8'),
);
if (world.mode !== 'official' || world.clubs.length !== 40)
  throw new Error('world-2026.json inválido. Rode npm run build:world.');
const payload = JSON.stringify(world).replaceAll("'", "''");
const sql = `do $seed$
declare v_payload jsonb := '${payload}'::jsonb; v_snapshot_id uuid := (v_payload->>'id')::uuid;
begin
  if exists(select 1 from public.world_snapshots where id=v_snapshot_id) then
    if exists(select 1 from public.world_snapshots where id=v_snapshot_id and payload=v_payload) then
      return;
    end if;
    raise exception 'Snapshot % já existe com outros dados. Gere um novo ID.', v_snapshot_id;
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
select count(*) as players from public.players where snapshot_id='${world.id}';
`;
await mkdir(path.join(root, 'dist-edge'), { recursive: true });
await writeFile(path.join(root, 'dist-edge', 'world-2026.sql'), sql, 'utf8');
console.log(`Generated dist-edge/world-2026.sql (${(sql.length / 1e6).toFixed(2)} MB).`);
