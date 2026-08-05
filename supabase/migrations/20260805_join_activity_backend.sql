-- ClassKru QR join activity backend
-- Run this migration in the Supabase SQL Editor before enabling remote mode.

create extension if not exists pgcrypto;

create table if not exists public.join_activity_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  classroom_id text not null,
  teacher_email text not null,
  room_label text not null default '',
  question text not null default '',
  answer_type text not null default 'choice' check (answer_type in ('short', 'choice', 'scale')),
  options jsonb not null default '[]'::jsonb,
  phase text not null default 'waiting' check (phase in ('waiting', 'question', 'closed')),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  question_started_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.join_activity_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.join_activity_sessions(id) on delete cascade,
  participant_key text not null,
  participant_token text not null,
  first_name text not null,
  nickname text not null default '',
  student_no text not null default '',
  student_code text not null default '',
  status text not null default 'new' check (status in ('new', 'existing', 'imported')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, participant_key)
);

create table if not exists public.join_activity_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.join_activity_sessions(id) on delete cascade,
  participant_id uuid not null references public.join_activity_participants(id) on delete cascade,
  answer text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, participant_id)
);

create index if not exists join_activity_sessions_code_idx on public.join_activity_sessions(code);
create index if not exists join_activity_participants_session_idx on public.join_activity_participants(session_id);
create index if not exists join_activity_answers_session_idx on public.join_activity_answers(session_id);

alter table public.join_activity_sessions enable row level security;
alter table public.join_activity_participants enable row level security;
alter table public.join_activity_answers enable row level security;

-- All access goes through the narrowly scoped functions below. This keeps
-- participant names and answer data out of anonymous table queries.
revoke all on table public.join_activity_sessions from anon, authenticated;
revoke all on table public.join_activity_participants from anon, authenticated;
revoke all on table public.join_activity_answers from anon, authenticated;

create or replace function public.join_activity_create_session(
  p_code text,
  p_classroom_id text,
  p_room_label text,
  p_question text,
  p_answer_type text,
  p_options jsonb,
  p_teacher_email text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.join_activity_sessions;
begin
  if auth.email() is null or lower(auth.email()) <> lower(trim(p_teacher_email)) then
    raise exception 'teacher authentication required';
  end if;

  insert into public.join_activity_sessions (code, classroom_id, teacher_email, room_label, question, answer_type, options)
  values (trim(p_code), trim(p_classroom_id), lower(trim(p_teacher_email)), coalesce(p_room_label, ''), coalesce(p_question, ''), p_answer_type, coalesce(p_options, '[]'::jsonb))
  returning * into result;

  return to_jsonb(result);
end;
$$;

create or replace function public.join_activity_update_session(
  p_code text,
  p_question text,
  p_answer_type text,
  p_options jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.join_activity_sessions;
begin
  update public.join_activity_sessions
  set question = coalesce(p_question, question),
      answer_type = coalesce(p_answer_type, answer_type),
      options = coalesce(p_options, options),
      updated_at = now()
  where code = trim(p_code) and teacher_email = lower(auth.email()) and status = 'open'
  returning * into result;

  if result.id is null then raise exception 'session not found or teacher authentication required'; end if;
  return to_jsonb(result);
end;
$$;

create or replace function public.join_activity_set_phase(
  p_code text,
  p_phase text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.join_activity_sessions;
begin
  update public.join_activity_sessions
  set phase = p_phase,
      question_started_at = case when p_phase = 'question' then now() else question_started_at end,
      updated_at = now()
  where code = trim(p_code) and teacher_email = lower(auth.email()) and status = 'open'
  returning * into result;

  if result.id is null then raise exception 'session not found or teacher authentication required'; end if;
  return to_jsonb(result);
end;
$$;

create or replace function public.join_activity_get_session(p_code text)
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
      'question', s.question,
      'answerType', s.answer_type,
      'options', s.options,
      'phase', s.phase,
      'status', s.status,
      'createdAt', s.created_at,
      'questionStartedAt', s.question_started_at
    ) from public.join_activity_sessions s where s.code = trim(p_code) and s.status = 'open'),
    '{}'::jsonb
  );
$$;

create or replace function public.join_activity_register(
  p_code text,
  p_participant_key text,
  p_participant_token text,
  p_first_name text,
  p_nickname text,
  p_student_no text,
  p_student_code text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.join_activity_sessions;
  participant_row public.join_activity_participants;
begin
  select * into session_row from public.join_activity_sessions where code = trim(p_code) and status = 'open';
  if session_row.id is null then raise exception 'activity not found or closed'; end if;
  if nullif(trim(p_first_name), '') is null then raise exception 'name is required'; end if;

  insert into public.join_activity_participants (session_id, participant_key, participant_token, first_name, nickname, student_no, student_code)
  values (session_row.id, trim(p_participant_key), trim(p_participant_token), trim(p_first_name), coalesce(trim(p_nickname), ''), coalesce(trim(p_student_no), ''), coalesce(trim(p_student_code), ''))
  on conflict (session_id, participant_key) do update set
    first_name = excluded.first_name,
    nickname = excluded.nickname,
    student_no = excluded.student_no,
    student_code = excluded.student_code,
    updated_at = now()
  returning * into participant_row;

  return jsonb_build_object('id', participant_row.id, 'participantToken', participant_row.participant_token, 'phase', session_row.phase);
end;
$$;

create or replace function public.join_activity_submit_answer(
  p_code text,
  p_participant_id uuid,
  p_participant_token text,
  p_answer text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.join_activity_sessions;
  participant_row public.join_activity_participants;
  answer_row public.join_activity_answers;
begin
  select * into session_row from public.join_activity_sessions where code = trim(p_code) and status = 'open';
  if session_row.id is null or session_row.phase <> 'question' then raise exception 'question is not open'; end if;
  select * into participant_row from public.join_activity_participants where id = p_participant_id and session_id = session_row.id and participant_token = p_participant_token;
  if participant_row.id is null then raise exception 'participant verification failed'; end if;
  if nullif(trim(p_answer), '') is null then raise exception 'answer is required'; end if;

  insert into public.join_activity_answers (session_id, participant_id, answer)
  values (session_row.id, participant_row.id, trim(p_answer))
  on conflict (session_id, participant_id) do update set answer = excluded.answer, updated_at = now()
  returning * into answer_row;

  return jsonb_build_object('id', answer_row.id, 'answer', answer_row.answer, 'updatedAt', answer_row.updated_at);
end;
$$;

create or replace function public.join_activity_teacher_snapshot(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.join_activity_sessions;
  participants_json jsonb;
  answers_json jsonb;
begin
  select * into session_row from public.join_activity_sessions where code = trim(p_code) and teacher_email = lower(auth.email());
  if session_row.id is null then raise exception 'session not found or teacher authentication required'; end if;

  select coalesce(jsonb_agg(to_jsonb(p) - 'participant_token' order by p.created_at), '[]'::jsonb)
    into participants_json from public.join_activity_participants p where p.session_id = session_row.id;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at), '[]'::jsonb)
    into answers_json from public.join_activity_answers a where a.session_id = session_row.id;

  return jsonb_build_object(
    'code', session_row.code,
    'classroomId', session_row.classroom_id,
    'roomLabel', session_row.room_label,
    'question', session_row.question,
    'answerType', session_row.answer_type,
    'options', session_row.options,
    'phase', session_row.phase,
    'status', session_row.status,
    'createdAt', session_row.created_at,
    'questionStartedAt', session_row.question_started_at,
    'participants', participants_json,
    'answers', answers_json
  );
end;
$$;

grant execute on function public.join_activity_create_session(text, text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.join_activity_update_session(text, text, text, jsonb) to authenticated;
grant execute on function public.join_activity_set_phase(text, text) to authenticated;
grant execute on function public.join_activity_get_session(text) to anon, authenticated;
grant execute on function public.join_activity_register(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.join_activity_submit_answer(text, uuid, text, text) to anon, authenticated;
grant execute on function public.join_activity_teacher_snapshot(text) to authenticated;
