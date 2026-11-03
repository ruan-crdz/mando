create or replace function public.save_career(p_id uuid, p_world_id uuid, p_state jsonb, p_expected_revision integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_revision integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode='42501'; end if;
  if p_state->>'id' is distinct from p_id::text or p_state->>'worldId' is distinct from p_world_id::text
    or (p_state->>'version')::integer is distinct from 1
    or jsonb_typeof(p_state->'players') is distinct from 'object'
    or jsonb_typeof(p_state->'messages') is distinct from 'array'
    or jsonb_typeof(p_state->'manager') is distinct from 'object'
    or octet_length(p_state::text) > 10000000
    or not exists(
      select 1 from public.world_snapshots
      where id=p_world_id and published
        and payload->>'mode' in ('demo', 'official')
        and payload->>'mode' = p_state->>'mode'
    ) then
    raise exception 'Invalid career state.';
  end if;
  if p_expected_revision = 0 then
    if (select count(*) from public.career_saves where user_id=auth.uid()) >= 20 then
      raise exception 'Maximum of 20 cloud careers reached.';
    end if;
    insert into public.career_saves(id,user_id,world_id,state)
      values(p_id,auth.uid(),p_world_id,p_state)
      on conflict (id) do nothing returning revision into v_revision;
  else
    update public.career_saves set state=p_state, revision=revision+1, updated_at=now()
      where id=p_id and user_id=auth.uid() and world_id=p_world_id and revision=p_expected_revision
      returning revision into v_revision;
  end if;
  if v_revision is null then
    -- PT409 reaches PostgREST as a conflict, not a retryable database failure.
    raise exception 'Save conflict. Export your local backup, then load the cloud version before synchronizing.' using errcode='PT409';
  end if;
  return v_revision;
end;
$$;
