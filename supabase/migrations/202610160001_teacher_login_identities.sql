-- Store external login identities separately from the ClassKru teacher identity.
-- Billing and application data continue to use auth.users.id as teacher_id.
begin;

create table if not exists public.teacher_login_identities (
  teacher_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_user_id text not null,
  provider_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (teacher_id, provider),
  constraint teacher_login_identities_provider_user_unique unique (provider, provider_user_id),
  constraint teacher_login_identities_provider_not_blank check (btrim(provider) <> ''),
  constraint teacher_login_identities_user_id_not_blank check (btrim(provider_user_id) <> '')
);

create index if not exists teacher_login_identities_provider_user_idx
  on public.teacher_login_identities (provider, provider_user_id);

-- Preserve LINE users created by the previous Supabase Custom OIDC login flow.
insert into public.teacher_login_identities (teacher_id, provider, provider_user_id, provider_email)
select i.user_id,
       'line',
       coalesce(nullif(i.identity_data->>'sub', ''), nullif(i.identity_data->>'user_id', ''), nullif(i.provider_id, '')),
       nullif(lower(i.identity_data->>'email'), '')
from auth.identities i
where lower(i.provider) in ('line', 'custom:line')
  and coalesce(nullif(i.identity_data->>'sub', ''), nullif(i.identity_data->>'user_id', ''), nullif(i.provider_id, '')) is not null
on conflict do nothing;

alter table public.teacher_login_identities enable row level security;
alter table public.teacher_login_identities force row level security;

drop policy if exists teacher_login_identities_select on public.teacher_login_identities;
create policy teacher_login_identities_select on public.teacher_login_identities
  for select to authenticated using (teacher_id = (select auth.uid()));

drop policy if exists teacher_login_identities_insert on public.teacher_login_identities;
drop policy if exists teacher_login_identities_update on public.teacher_login_identities;
revoke all on table public.teacher_login_identities from anon;
revoke insert, update, delete on table public.teacher_login_identities from authenticated;
grant select on table public.teacher_login_identities to authenticated;

-- A server-only, atomic per-IP limit protects the public username signup route.
create table if not exists public.username_signup_rate_limits (
  rate_key text primary key check (rate_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);
alter table public.username_signup_rate_limits enable row level security;
alter table public.username_signup_rate_limits force row level security;
revoke all on table public.username_signup_rate_limits from anon, authenticated;

create or replace function public.consume_username_signup_rate_limit(
  p_rate_key text,
  p_limit integer default 5,
  p_window_seconds integer default 3600
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  allowed boolean;
begin
  if p_rate_key !~ '^[a-f0-9]{64}$' or p_limit < 1 or p_window_seconds < 60 then
    return false;
  end if;

  delete from public.username_signup_rate_limits
  where updated_at < now() - interval '7 days';

  insert into public.username_signup_rate_limits (rate_key, window_started_at, request_count, updated_at)
  values (p_rate_key, now(), 1, now())
  on conflict (rate_key) do update set
    window_started_at = case
      when public.username_signup_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then now()
      else public.username_signup_rate_limits.window_started_at
    end,
    request_count = case
      when public.username_signup_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then 1
      else public.username_signup_rate_limits.request_count + 1
    end,
    updated_at = now()
  returning request_count <= p_limit into allowed;

  return coalesce(allowed, false);
end;
$$;
revoke all on function public.consume_username_signup_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_username_signup_rate_limit(text, integer, integer) to service_role;

commit;
