-- Portraits are generated during manager creation, before any career exists.
alter table public.ai_jobs alter column career_id drop not null;
create unique index if not exists ai_jobs_portrait_attempt
  on public.ai_jobs(user_id, event_id) where kind = 'portrait';
alter table public.ai_jobs drop constraint if exists ai_jobs_kind_check;
alter table public.ai_jobs add constraint ai_jobs_kind_check
  check (kind in ('message', 'news', 'staff', 'avatar', 'portrait'));

create or replace function public.claim_portrait_job(p_user_id uuid, p_attempt text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_existing public.ai_jobs;
begin
  perform pg_advisory_xact_lock(hashtextextended('portrait-global',0));
  select * into v_existing from public.ai_jobs where user_id=p_user_id and event_id=p_attempt and kind='portrait';
  if found then
    if v_existing.status = 'running' and v_existing.updated_at < now() - interval '5 minutes' then
      update public.ai_jobs set status='failed', error='Generation interrupted.', updated_at=now() where id=v_existing.id;
    end if;
    return v_existing.id;
  end if;
  if (select count(*) from public.ai_jobs where user_id=p_user_id and kind='portrait' and created_at >= now()-interval '1 day') >= 6 then
    raise exception 'Limite diário de retratos atingido (6 por dia). Tente amanhã.';
  end if;
  if (select count(*) from public.ai_jobs where kind='portrait' and created_at >= now()-interval '1 day') >= 60 then
    raise exception 'Limite global diário de retratos atingido. Tente amanhã.';
  end if;
  insert into public.ai_jobs(user_id,career_id,event_id,kind,status)
    values(p_user_id,null,p_attempt,'portrait','running') returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.claim_portrait_job(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_portrait_job(uuid,text) to service_role;

-- Guest (anonymous) accounts make sign-up free, so text generation also gets a global daily ceiling.
create or replace function public.claim_ai_job(p_user_id uuid, p_career_id uuid, p_event_id text, p_kind text)
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
  if (select count(*) from public.ai_jobs where created_at >= now()-interval '1 day') >= 1500 then
    raise exception 'Global daily AI limit reached.';
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

update storage.buckets set allowed_mime_types = array['image/png','image/webp']
  where id = 'manager-avatars';
