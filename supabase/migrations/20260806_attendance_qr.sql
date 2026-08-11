-- ClassKru QR attendance backend
-- Run this migration in the Supabase SQL Editor before using QR attendance across devices.

create extension if not exists pgcrypto;

create table if not exists public.attendance_qr_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  classroom_id text not null,
  teacher_email text not null,
  room_label text not null default '',
  date_key text not null,
  roster jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_qr_marks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_qr_sessions(id) on delete cascade,
  student_id text not null,
  student_name text not null default '',
  identity text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists attendance_qr_sessions_code_idx on public.attendance_qr_sessions(code);
create index if not exists attendance_qr_marks_session_idx on public.attendance_qr_marks(session_id);

alter table public.attendance_qr_sessions enable row level security;
alter table public.attendance_qr_marks enable row level security;

revoke all on table public.attendance_qr_sessions from anon, authenticated;
revoke all on table public.attendance_qr_marks from anon, authenticated;

create or replace function public.attendance_qr_create_session(
  p_code text,
  p_classroom_id text,
  p_teacher_email text,
  p_room_label text,
  p_date_key text,
  p_roster jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.attendance_qr_sessions;
begin
  if auth.email() is null or lower(auth.email()) <> lower(trim(p_teacher_email)) then
    raise exception 'teacher authentication required';
  end if;
  if jsonb_typeof(coalesce(p_roster, '[]'::jsonb)) <> 'array' then
    raise exception 'roster must be an array';
  end if;

  insert into public.attendance_qr_sessions (code, classroom_id, teacher_email, room_label, date_key, roster)
  values (upper(trim(p_code)), trim(p_classroom_id), lower(trim(p_teacher_email)), coalesce(p_room_label, ''), trim(p_date_key), coalesce(p_roster, '[]'::jsonb))
  returning * into result;

  return to_jsonb(result);
end;
$$;

create or replace function public.attendance_qr_get_session(p_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object(
      'code', s.code,
      'classroomId', s.classroom_id,
      'roomLabel', s.room_label,
      'dateKey', s.date_key,
      'roster', s.roster,
      'status', s.status
    ) from public.attendance_qr_sessions s where s.code = upper(trim(p_code)) and s.status = 'open'),
    '{}'::jsonb
  );
$$;

create or replace function public.attendance_qr_mark_present(
  p_code text,
  p_student_id text,
  p_identity text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.attendance_qr_sessions;
  roster_student jsonb;
  mark_row public.attendance_qr_marks;
  expected_no text;
  expected_code text;
  provided text;
begin
  select * into session_row from public.attendance_qr_sessions where code = upper(trim(p_code)) and status = 'open';
  if session_row.id is null then raise exception 'QR not found or closed'; end if;

  select item into roster_student
  from jsonb_array_elements(session_row.roster) item
  where item->>'id' = trim(p_student_id)
  limit 1;
  if roster_student is null then raise exception 'student not found in this class'; end if;

  expected_no := trim(coalesce(roster_student->>'studentNo', ''));
  expected_code := trim(coalesce(roster_student->>'studentCode', ''));
  provided := trim(coalesce(p_identity, ''));
  if (expected_no <> '' or expected_code <> '') and provided <> expected_no and provided <> expected_code then
    raise exception 'เลขที่หรือรหัสนักเรียนไม่ตรงกับรายชื่อ';
  end if;

  insert into public.attendance_qr_marks (session_id, student_id, student_name, identity)
  values (session_row.id, trim(p_student_id), coalesce(roster_student->>'name', ''), provided)
  on conflict (session_id, student_id) do update set
    identity = excluded.identity,
    updated_at = now()
  returning * into mark_row;

  return jsonb_build_object('studentId', mark_row.student_id, 'studentName', mark_row.student_name, 'updatedAt', mark_row.updated_at);
end;
$$;

create or replace function public.attendance_qr_teacher_snapshot(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.attendance_qr_sessions;
  marks_json jsonb;
begin
  select * into session_row from public.attendance_qr_sessions where code = upper(trim(p_code)) and teacher_email = lower(auth.email());
  if session_row.id is null then raise exception 'session not found or teacher authentication required'; end if;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.updated_at desc), '[]'::jsonb)
  into marks_json
  from public.attendance_qr_marks m
  where m.session_id = session_row.id;

  return jsonb_build_object(
    'code', session_row.code,
    'classroomId', session_row.classroom_id,
    'dateKey', session_row.date_key,
    'status', session_row.status,
    'marks', marks_json
  );
end;
$$;

create or replace function public.attendance_qr_close_session(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.attendance_qr_sessions;
begin
  update public.attendance_qr_sessions
  set status = 'closed', updated_at = now()
  where code = upper(trim(p_code)) and teacher_email = lower(auth.email())
  returning * into result;

  if result.id is null then raise exception 'session not found or teacher authentication required'; end if;
  return to_jsonb(result);
end;
$$;

grant execute on function public.attendance_qr_create_session(text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.attendance_qr_get_session(text) to anon, authenticated;
grant execute on function public.attendance_qr_mark_present(text, text, text) to anon, authenticated;
grant execute on function public.attendance_qr_teacher_snapshot(text) to authenticated;
grant execute on function public.attendance_qr_close_session(text) to authenticated;
