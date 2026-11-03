create extension if not exists pgcrypto with schema extensions;

create table public.world_snapshots (
  id uuid primary key,
  snapshot text not null check (snapshot = 'WORLD_SNAPSHOT_2026_01_01'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.clubs (
  snapshot_id uuid not null references public.world_snapshots(id),
  id text not null,
  name text not null,
  league text not null check (league in ('A', 'B')),
  profile jsonb not null,
  primary key (snapshot_id, id)
);

create table public.players (
  snapshot_id uuid not null,
  id text not null,
  club_id text not null,
  name text not null,
  profile jsonb not null,
  attributes jsonb not null,
  primary key (snapshot_id, id),
  foreign key (snapshot_id, club_id) references public.clubs(snapshot_id, id)
);

create table public.career_saves (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  world_id uuid not null references public.world_snapshots(id),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index career_saves_owner on public.career_saves(user_id, updated_at desc);

create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  career_id uuid not null references public.career_saves(id) on delete cascade,
  event_id text not null,
  kind text not null check (kind in ('message', 'news', 'staff', 'avatar')),
  status text not null check (status in ('running', 'completed', 'failed')),
  output jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(career_id, event_id, kind)
);
create index ai_jobs_daily on public.ai_jobs(user_id, created_at);

alter table public.world_snapshots enable row level security;
alter table public.clubs enable row level security;
alter table public.players enable row level security;
alter table public.career_saves enable row level security;
alter table public.ai_jobs enable row level security;
create policy "Published worlds can be read by signed-in users" on public.world_snapshots
  for select to authenticated using (published);
create policy "Published clubs can be read" on public.clubs for select to authenticated
  using (exists(select 1 from public.world_snapshots w where w.id = snapshot_id and w.published));
create policy "Published players can be read" on public.players for select to authenticated
  using (exists(select 1 from public.world_snapshots w where w.id = snapshot_id and w.published));
create policy "Users read only their own careers" on public.career_saves
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users read only their own generated stories" on public.ai_jobs
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.world_snapshots, public.clubs, public.players, public.career_saves, public.ai_jobs from anon, authenticated;
grant select on public.world_snapshots, public.clubs, public.players, public.career_saves, public.ai_jobs to authenticated;

create function public.reject_published_world_changes() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.published then raise exception 'Published snapshots are immutable. Publish a new snapshot ID.'; end if;
  return new;
end;
$$;
create trigger world_immutable before update or delete on public.world_snapshots
  for each row execute function public.reject_published_world_changes();

create function public.publish_world(p_payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_club jsonb;
  v_player jsonb;
  v_attribute text;
  v_keys text[] := array['pace','acceleration','finishing','shortPass','longPass','vision',
    'dribbling','control','strength','stamina','positioning','marking','tackling',
    'interception','heading','composure','reflexes','handling','diving'];
begin
  if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role', '') <> 'admin' then
    raise exception 'Administrator permission required.' using errcode = '42501';
  end if;
  if octet_length(p_payload::text) > 8000000
    or p_payload->>'snapshot' is distinct from 'WORLD_SNAPSHOT_2026_01_01'
    or p_payload->>'date' is distinct from '2026-01-01'
    or p_payload->>'mode' is distinct from 'official'
    or length(coalesce(p_payload->>'source', '')) < 3
    or length(coalesce(p_payload->>'license', '')) < 3
    or jsonb_typeof(p_payload->'clubs') is distinct from 'array'
    or jsonb_typeof(p_payload->'players') is distinct from 'array' then
    raise exception 'Invalid official snapshot or missing provenance.';
  end if;
  if jsonb_array_length(p_payload->'clubs') <> 40
    or jsonb_array_length(p_payload->'players') not between 720 and 3000
    or (select count(*) from jsonb_array_elements(p_payload->'clubs') c where c->>'league' = 'A') <> 20
    or (select count(*) from jsonb_array_elements(p_payload->'clubs') c where c->>'league' = 'B') <> 20 then
    raise exception 'Expected 20 clubs in each division and 18-75 athletes per club.';
  end if;
  v_id := (p_payload->>'id')::uuid;
  insert into public.world_snapshots(id, snapshot, payload)
    values(v_id, 'WORLD_SNAPSHOT_2026_01_01', p_payload);
  for v_club in select value from jsonb_array_elements(p_payload->'clubs') loop
    if length(coalesce(v_club->>'id','')) = 0 or length(coalesce(v_club->>'name','')) < 2
      or v_club->>'color' !~ '^#[0-9a-fA-F]{6}$'
      or (v_club->>'budget')::numeric < 0 or (v_club->>'debt')::numeric < 0
      or (v_club->>'reputation')::integer not between 1 and 99 then
      raise exception 'Invalid club profile.';
    end if;
    insert into public.clubs(snapshot_id,id,name,league,profile)
      values(v_id,v_club->>'id',v_club->>'name',v_club->>'league',v_club);
  end loop;
  for v_player in select value from jsonb_array_elements(p_payload->'players') loop
    if length(coalesce(v_player->>'id','')) = 0 or length(coalesce(v_player->>'name','')) < 2
      or coalesce(v_player->>'position','') not in ('GK','CB','LB','RB','DM','CM','AM','LW','RW','ST')
      or (v_player->>'birthDate')::date >= date '2026-01-01'
      or (v_player->>'contractEnd')::date <= date '2026-01-01'
      or (v_player->>'value')::numeric < 0 or (v_player->>'wage')::numeric < 0
      or (v_player->>'potential')::integer not between 1 and 99 then
      raise exception 'Invalid player profile.';
    end if;
    foreach v_attribute in array v_keys loop
      if coalesce((v_player->'attributes'->>v_attribute)::integer,0) not between 1 and 99 then
        raise exception 'Invalid attribute % for %',v_attribute,v_player->>'name';
      end if;
    end loop;
    insert into public.players(snapshot_id,id,club_id,name,profile,attributes)
      values(v_id,v_player->>'id',v_player->>'clubId',v_player->>'name',v_player - 'attributes',v_player->'attributes');
  end loop;
  if exists (
    select 1 from public.clubs c where c.snapshot_id = v_id and (
      (select count(*) from public.players p where p.snapshot_id=v_id and p.club_id=c.id) not between 18 and 75
      or (select count(*) from public.players p where p.snapshot_id=v_id and p.club_id=c.id and p.profile->>'position'='GK') < 2
    )
  ) then raise exception 'Each club needs 18-75 players and at least two goalkeepers.'; end if;
  update public.world_snapshots set published = true where id = v_id;
  return v_id;
end;
$$;
revoke all on function public.publish_world(jsonb) from public, anon;
grant execute on function public.publish_world(jsonb) to authenticated;

create function public.save_career(p_id uuid, p_world_id uuid, p_state jsonb, p_expected_revision integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_revision integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode='42501'; end if;
  if p_state->>'id' is distinct from p_id::text or p_state->>'worldId' is distinct from p_world_id::text
    or p_state->>'mode' is distinct from 'official' or (p_state->>'version')::integer is distinct from 1
    or jsonb_typeof(p_state->'players') is distinct from 'object'
    or jsonb_typeof(p_state->'messages') is distinct from 'array'
    or jsonb_typeof(p_state->'manager') is distinct from 'object'
    or octet_length(p_state::text) > 10000000
    or not exists(select 1 from public.world_snapshots where id=p_world_id and published) then
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
    raise exception 'Save conflict. Export your local backup, then load the cloud version before synchronizing.' using errcode='40001';
  end if;
  return v_revision;
end;
$$;
revoke all on function public.save_career(uuid,uuid,jsonb,integer) from public,anon;
grant execute on function public.save_career(uuid,uuid,jsonb,integer) to authenticated;

create function public.claim_ai_job(p_user_id uuid, p_career_id uuid, p_event_id text, p_kind text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_existing public.ai_jobs;
begin
  if not exists(select 1 from public.career_saves where id=p_career_id and user_id=p_user_id) then
    raise exception 'Career not found.' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  select * into v_existing from public.ai_jobs where career_id=p_career_id and event_id=p_event_id and kind=p_kind;
  if found then
    if v_existing.status = 'running' and v_existing.updated_at < now() - interval '5 minutes' then
      update public.ai_jobs set status='failed', error='Generation interrupted. Explicit retry required.', updated_at=now() where id=v_existing.id;
      return v_existing.id;
    end if;
    return v_existing.id;
  end if;
  if (select count(*) from public.ai_jobs where user_id=p_user_id and created_at >= date_trunc('day',now())) >= 30 then
    raise exception 'Daily AI limit reached (30 requests per user).';
  end if;
  if p_kind = 'avatar' and exists(select 1 from public.ai_jobs where user_id=p_user_id and kind='avatar' and created_at >= now()-interval '1 day') then
    raise exception 'Avatar limit reached (one per day).';
  end if;
  insert into public.ai_jobs(user_id,career_id,event_id,kind,status)
    values(p_user_id,p_career_id,p_event_id,p_kind,'running') returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.claim_ai_job(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_ai_job(uuid,uuid,text,text) to service_role;

create view public.career_player_state with (security_invoker = true) as
  select s.id as career_id, p.key as player_id, p.value as state
  from public.career_saves s cross join lateral jsonb_each(s.state->'players') p;
create view public.messages with (security_invoker = true) as
  select s.id as career_id, m.value as message
  from public.career_saves s cross join lateral jsonb_array_elements(s.state->'messages') m;
create view public.ai_memories with (security_invoker = true) as
  select s.id as career_id, m.value as memory
  from public.career_saves s cross join lateral jsonb_array_elements(s.state->'memories') m;
grant select on public.career_player_state,public.messages,public.ai_memories to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('manager-avatars','manager-avatars',false,5242880,array['image/png'])
  on conflict(id) do nothing;
create policy "Users read their own manager portraits" on storage.objects for select to authenticated
  using(bucket_id='manager-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
