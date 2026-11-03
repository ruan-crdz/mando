-- Run as postgres in SQL Editor. All synthetic fixtures are rolled back.
begin;

do $test$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  world_id uuid := gen_random_uuid();
  v_career_id uuid := gen_random_uuid();
  state jsonb;
  revision integer;
  job_id uuid;
begin
  insert into auth.users(id) values(user_a), (user_b);
  insert into public.world_snapshots(id, snapshot, payload, published)
    values(world_id, 'WORLD_SNAPSHOT_2026_01_01', '{"testOnly":true,"mode":"official"}', true);
  state := jsonb_build_object(
    'id', v_career_id, 'worldId', world_id, 'mode', 'official', 'version', 1,
    'players', '{}'::jsonb, 'messages', '[{"id":"hosted-test"}]'::jsonb,
    'manager', '{}'::jsonb, 'memories', '[]'::jsonb
  );
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  revision := public.save_career(v_career_id, world_id, state, 0);
  if revision <> 1 then raise exception 'Initial revision assertion failed'; end if;
  revision := public.save_career(v_career_id, world_id, state, 1);
  if revision <> 2 then raise exception 'Updated revision assertion failed'; end if;
  begin
    perform public.save_career(v_career_id, world_id, state, 1);
    raise exception 'Stale write was accepted';
  exception when serialization_failure then null;
  end;
  if (select count(*) from public.career_saves where id = v_career_id) <> 1 then
    raise exception 'Owner cannot read their save';
  end if;
  if (select count(*) from public.messages where public.messages.career_id = v_career_id) <> 1 then
    raise exception 'Owner cannot read their messages';
  end if;

  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  if exists(select 1 from public.career_saves where id = v_career_id) then
    raise exception 'RLS exposed another user''s save';
  end if;
  if exists(select 1 from public.messages where public.messages.career_id = v_career_id) then
    raise exception 'View exposed another user''s messages';
  end if;
  begin
    perform public.save_career(v_career_id, world_id, state, 2);
    raise exception 'Another user overwrote a save';
  exception when serialization_failure then null;
  end;
  if has_function_privilege('authenticated',
    'public.claim_ai_job(uuid,uuid,text,text)', 'execute') then
    raise exception 'Authenticated users can bypass the AI handler';
  end if;
  execute 'reset role';

  job_id := public.claim_ai_job(user_a, v_career_id, 'hosted-test', 'message');
  if job_id is distinct from public.claim_ai_job(user_a, v_career_id, 'hosted-test', 'message') then
    raise exception 'AI job deduplication failed';
  end if;
  if not exists(select 1 from storage.buckets where id = 'manager-avatars' and not public) then
    raise exception 'Avatar bucket is missing or public';
  end if;
end;
$test$;

rollback;
select 'PASS: save revisions, stale/foreign writes, owner RLS, AI permissions/deduplication and private storage. Fixtures rolled back.' as result;
