-- Daily AI generation quota for teacher-owned worksheet and quiz drafts.
begin;

create table if not exists public.ai_daily_generation_usage (
  teacher_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  generation_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (teacher_id, usage_date),
  constraint ai_daily_generation_usage_count_nonnegative check (generation_count >= 0)
);

create index if not exists ai_daily_generation_usage_date_idx
  on public.ai_daily_generation_usage (usage_date desc, teacher_id);

alter table public.ai_daily_generation_usage enable row level security;
revoke all on table public.ai_daily_generation_usage from anon, authenticated;

create or replace function public.get_ai_daily_generation_quota(
  p_teacher_id uuid,
  p_usage_date date,
  p_daily_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_used integer := 0;
begin
  if p_teacher_id is null or p_usage_date is null or p_daily_limit < 1 then
    raise exception 'invalid_ai_quota_arguments';
  end if;

  select generation_count
    into v_used
    from public.ai_daily_generation_usage
   where teacher_id = p_teacher_id
     and usage_date = p_usage_date;

  return jsonb_build_object(
    'allowed', true,
    'date', p_usage_date,
    'limit', p_daily_limit,
    'used', v_used,
    'remaining', greatest(p_daily_limit - v_used, 0)
  );
end;
$$;

create or replace function public.consume_ai_daily_generation_quota(
  p_teacher_id uuid,
  p_usage_date date,
  p_daily_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_used integer;
begin
  if p_teacher_id is null or p_usage_date is null or p_daily_limit < 1 then
    raise exception 'invalid_ai_quota_arguments';
  end if;

  insert into public.ai_daily_generation_usage (teacher_id, usage_date, generation_count)
  values (p_teacher_id, p_usage_date, 0)
  on conflict (teacher_id, usage_date) do nothing;

  update public.ai_daily_generation_usage
     set generation_count = generation_count + 1,
         updated_at = now()
   where teacher_id = p_teacher_id
     and usage_date = p_usage_date
     and generation_count < p_daily_limit
  returning generation_count into v_used;

  if v_used is null then
    select generation_count
      into v_used
      from public.ai_daily_generation_usage
     where teacher_id = p_teacher_id
       and usage_date = p_usage_date;

    return jsonb_build_object(
      'allowed', false,
      'date', p_usage_date,
      'limit', p_daily_limit,
      'used', coalesce(v_used, 0),
      'remaining', greatest(p_daily_limit - coalesce(v_used, 0), 0)
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'date', p_usage_date,
    'limit', p_daily_limit,
    'used', v_used,
    'remaining', greatest(p_daily_limit - v_used, 0)
  );
end;
$$;

create or replace function public.release_ai_daily_generation_quota(
  p_teacher_id uuid,
  p_usage_date date,
  p_daily_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_used integer := 0;
begin
  if p_teacher_id is null or p_usage_date is null or p_daily_limit < 1 then
    raise exception 'invalid_ai_quota_arguments';
  end if;

  update public.ai_daily_generation_usage
     set generation_count = greatest(generation_count - 1, 0),
         updated_at = now()
   where teacher_id = p_teacher_id
     and usage_date = p_usage_date
  returning generation_count into v_used;

  return jsonb_build_object(
    'allowed', true,
    'date', p_usage_date,
    'limit', p_daily_limit,
    'used', v_used,
    'remaining', greatest(p_daily_limit - v_used, 0)
  );
end;
$$;

revoke all on function public.get_ai_daily_generation_quota(uuid, date, integer) from public, anon, authenticated;
revoke all on function public.consume_ai_daily_generation_quota(uuid, date, integer) from public, anon, authenticated;
revoke all on function public.release_ai_daily_generation_quota(uuid, date, integer) from public, anon, authenticated;
grant execute on function public.get_ai_daily_generation_quota(uuid, date, integer) to service_role;
grant execute on function public.consume_ai_daily_generation_quota(uuid, date, integer) to service_role;
grant execute on function public.release_ai_daily_generation_quota(uuid, date, integer) to service_role;

comment on table public.ai_daily_generation_usage is
  'Server-enforced daily generation count for AI worksheet and quiz drafts.';

commit;
