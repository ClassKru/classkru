-- Durable Mini Lab V5 state. V2 and prior V4 prototype data are untouched.
begin;

create table if not exists public.interactive_v5_tasks (
  teacher_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  revision bigint not null default 0 check (revision >= 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (teacher_id, id)
);

create index if not exists interactive_v5_tasks_teacher_updated_idx
  on public.interactive_v5_tasks (teacher_id, updated_at desc);
create index if not exists interactive_v5_tasks_jobs_idx
  on public.interactive_v5_tasks using gin ((state->'jobs') jsonb_path_ops);

create table if not exists public.interactive_v5_settings (
  teacher_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now()
);

-- Every request is scoped to the authenticated teacher by the server. Browser
-- sessions must never access these tables directly; only the service role may.
alter table public.interactive_v5_tasks enable row level security;
alter table public.interactive_v5_settings enable row level security;
revoke all on table public.interactive_v5_tasks, public.interactive_v5_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.interactive_v5_tasks, public.interactive_v5_settings to service_role;

commit;
