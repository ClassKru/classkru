-- Media Studio: server writes only; owner-scoped reads; atomic queue/quotas.
begin;
create table public.media_projects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  context jsonb not null default '{}',
  plan jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.media_projects (teacher_id, updated_at desc);
create table public.media_turns (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.media_projects(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('teacher','assistant')),
  message text not null check (octet_length(message) <= 24000),
  created_at timestamptz not null default now()
);
create index on public.media_turns (project_id, id);
create table public.media_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.media_projects(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  kind text not null check (kind in ('plan','build')),
  message text not null check (char_length(message) between 3 and 6000),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  claim_token uuid,
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (teacher_id, request_key)
);
create index on public.media_jobs (status, created_at);
create index on public.media_jobs (teacher_id, created_at);
create table public.media_versions (
  id uuid primary key,
  project_id uuid not null references public.media_projects(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null unique references public.media_jobs(id),
  title text not null,
  summary text not null,
  storage_path text not null unique,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  review jsonb not null,
  created_at timestamptz not null default now()
);
create index on public.media_versions (project_id, created_at desc);
-- Public/preview tokens are opaque capabilities, never the teacher session.
-- Bundles remain private even after publishing, so revocation works on future loads.
create table public.media_links (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.media_projects(id) on delete cascade,
  version_id uuid not null references public.media_versions(id) on delete cascade,
  token text not null unique check (token ~ '^[a-f0-9]{64}$'),
  kind text not null check (kind in ('preview','published')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.media_links (project_id, created_at desc);
create table public.media_events (
  id bigint generated always as identity primary key,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.media_projects(id) on delete cascade,
  action text not null,
  version_id uuid,
  created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['media_projects','media_turns','media_jobs','media_versions','media_links','media_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('create policy owner_read on public.%I for select to authenticated using (teacher_id = (select auth.uid()))', t);
  end loop;
end $$;
grant usage, select on sequence public.media_turns_id_seq, public.media_events_id_seq to service_role;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media-bundles','media-bundles',false,524288,array['application/json'])
on conflict (id) do update set public=false,file_size_limit=524288,allowed_mime_types=array['application/json'];
-- Deny browser access even if an older, permissive policy covers every bucket.
-- Restrictive policies AND with existing policies; other buckets are unchanged.
create policy media_bundles_server_only on storage.objects as restrictive
  for all to anon,authenticated
  using (bucket_id <> 'media-bundles') with check (bucket_id <> 'media-bundles');

create function public.media_create_project(p_teacher uuid, p_title text, p_context jsonb)
returns public.media_projects language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.media_projects;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_teacher::text, 1));
  if (select count(*) from media_projects where teacher_id=p_teacher) >= 100 then raise exception 'project_limit'; end if;
  insert into media_projects(teacher_id,title,context) values(p_teacher,p_title,p_context) returning * into result;
  return result;
end $$;

create function public.media_enqueue(p_teacher uuid,p_project uuid,p_kind text,p_message text,p_key uuid)
returns public.media_jobs language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.media_jobs;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_teacher::text, 1));
  if not exists(select 1 from media_projects where id=p_project and teacher_id=p_teacher and not archived) then raise exception 'not_found'; end if;
  select * into result from media_jobs where teacher_id=p_teacher and request_key=p_key;
  if found then return result; end if;
  -- Expired executions fail explicitly; they are never retried invisibly/charged twice.
  update media_jobs set status='failed',error_code='job_expired',finished_at=now()
    where teacher_id=p_teacher and ((status='running' and started_at < now()-interval '5 minutes') or (status='queued' and created_at < now()-interval '24 hours'));
  if exists(select 1 from media_jobs where project_id=p_project and status in ('queued','running')) then raise exception 'project_busy'; end if;
  if (select count(*) from media_jobs where teacher_id=p_teacher and status in ('queued','running')) >= 3 then raise exception 'queue_limit'; end if;
  if (select count(*) from media_jobs where teacher_id=p_teacher and created_at > now()-interval '24 hours') >= 40 then raise exception 'daily_limit'; end if;
  if p_kind='build' and (select count(*) from media_versions where project_id=p_project) >= 30 then raise exception 'version_limit'; end if;
  insert into media_jobs(teacher_id,project_id,kind,message,request_key) values(p_teacher,p_project,p_kind,p_message,p_key) returning * into result;
  insert into media_turns(teacher_id,project_id,role,message) values(p_teacher,p_project,'teacher',p_message);
  update media_projects set updated_at=now() where id=p_project;
  return result;
end $$;

create function public.media_claim(p_teacher uuid,p_job uuid,p_claim uuid)
returns setof public.media_jobs language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(1909202601);
  update media_jobs set status='failed',error_code='job_expired',finished_at=now()
    where status='running' and started_at < now()-interval '5 minutes';
  if (select count(*) from media_jobs where status='running') >= 2 then return; end if;
  if exists(select 1 from media_jobs where teacher_id=p_teacher and status='running') then return; end if;
  return query update media_jobs set status='running',started_at=now(),claim_token=p_claim
    where id=p_job and teacher_id=p_teacher and status='queued' returning *;
end $$;

create function public.media_finish(p_teacher uuid,p_job uuid,p_claim uuid,p_message text,p_plan jsonb,p_version jsonb)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare job public.media_jobs;
begin
  select * into job from media_jobs where id=p_job and teacher_id=p_teacher and status='running' and claim_token=p_claim for update;
  if not found then return false; end if;
  if p_version is not null then
    insert into media_versions(id,project_id,teacher_id,job_id,title,summary,storage_path,sha256,review)
    values ((p_version->>'id')::uuid,job.project_id,p_teacher,p_job,p_version->>'title',p_version->>'summary',p_version->>'storage_path',p_version->>'sha256',p_version->'review');
  end if;
  if p_plan is not null then update media_projects set plan=p_plan where id=job.project_id; end if;
  insert into media_turns(teacher_id,project_id,role,message) values(p_teacher,job.project_id,'assistant',p_message);
  update media_projects set updated_at=now() where id=job.project_id;
  update media_jobs set status='succeeded',finished_at=now() where id=p_job;
  return true;
end $$;

-- These RPCs accept an owner ID only from the authenticated server, never a client.
revoke all on function public.media_create_project(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.media_enqueue(uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.media_claim(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.media_finish(uuid,uuid,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.media_create_project(uuid,text,jsonb), public.media_enqueue(uuid,uuid,text,text,uuid), public.media_claim(uuid,uuid,uuid), public.media_finish(uuid,uuid,uuid,text,jsonb,jsonb) to service_role;
create function public.media_publish(p_teacher uuid,p_version uuid,p_token text)
returns public.media_links language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.media_versions; result public.media_links;
begin
  select mv.* into v from media_versions mv join media_projects mp on mp.id=mv.project_id
    where mv.id=p_version and mv.teacher_id=p_teacher and not mp.archived for update of mp;
  if not found then raise exception 'not_found'; end if;
  if v.review->>'browser_check' <> 'passed' then raise exception 'review_required'; end if;
  select * into result from media_links where version_id=p_version and teacher_id=p_teacher and kind='published' and revoked_at is null limit 1;
  if found then return result; end if;
  insert into media_links(teacher_id,project_id,version_id,token,kind) values(p_teacher,v.project_id,p_version,p_token,'published') returning * into result;
  insert into media_events(teacher_id,project_id,version_id,action) values(p_teacher,v.project_id,p_version,'publish');
  return result;
end $$;
create function public.media_archive(p_teacher uuid,p_project uuid,p_archived boolean)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update media_projects set archived=p_archived,updated_at=now() where id=p_project and teacher_id=p_teacher;
  if not found then raise exception 'not_found'; end if;
  if p_archived then
    update media_links set revoked_at=now() where project_id=p_project and revoked_at is null;
    update media_jobs set status='failed',error_code='project_archived',finished_at=now() where project_id=p_project and status in ('queued','running');
  end if;
  insert into media_events(teacher_id,project_id,action) values(p_teacher,p_project,case when p_archived then 'archive' else 'restore' end);
  return true;
end $$;
revoke all on function public.media_publish(uuid,uuid,text), public.media_archive(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.media_publish(uuid,uuid,text), public.media_archive(uuid,uuid,boolean) to service_role;
commit;
