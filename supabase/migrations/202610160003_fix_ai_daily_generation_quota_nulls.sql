-- Return deterministic zero-based values for teachers with no usage row yet.
begin;

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

  select coalesce(generation_count, 0)
    into v_used
    from public.ai_daily_generation_usage
   where teacher_id = p_teacher_id
     and usage_date = p_usage_date;

  return jsonb_build_object(
    'allowed', true,
    'date', p_usage_date,
    'limit', p_daily_limit,
    'used', coalesce(v_used, 0),
    'remaining', greatest(p_daily_limit - coalesce(v_used, 0), 0)
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
    'used', coalesce(v_used, 0),
    'remaining', greatest(p_daily_limit - coalesce(v_used, 0), 0)
  );
end;
$$;

revoke all on function public.get_ai_daily_generation_quota(uuid, date, integer) from public, anon, authenticated;
revoke all on function public.release_ai_daily_generation_quota(uuid, date, integer) from public, anon, authenticated;
grant execute on function public.get_ai_daily_generation_quota(uuid, date, integer) to service_role;
grant execute on function public.release_ai_daily_generation_quota(uuid, date, integer) to service_role;

commit;
