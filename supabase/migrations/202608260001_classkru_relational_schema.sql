-- ClassKru canonical relational storage (exactly eight application tables).
-- Safe transition: the legacy classmanager_profiles.state JSON is read but never changed or deleted.
-- Idempotent seed behavior: rerunning this migration inserts only rows that are still missing.
begin;

create table if not exists public.teacher_profiles (
  teacher_id uuid primary key references auth.users(id) on delete restrict,
  email text not null,
  teacher_name text not null default '',
  profile_image_base64 text,
  period_settings jsonb not null default '{"startTime":"08:30","duration":50,"breakTime":0,"count":7}'::jsonb,
  onboarding jsonb not null default '{}'::jsonb,
  holidays jsonb not null default '[]'::jsonb,
  timetable_week text not null default 'A',
  active_web_screen text not null default 'dashboard',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint teacher_profiles_email_unique unique (email),
  constraint teacher_profiles_period_settings_object check (jsonb_typeof(period_settings) = 'object'),
  constraint teacher_profiles_onboarding_object check (jsonb_typeof(onboarding) = 'object'),
  constraint teacher_profiles_holidays_array check (jsonb_typeof(holidays) = 'array')
);

create table if not exists public.classrooms (
  teacher_id uuid not null references public.teacher_profiles(teacher_id) on delete restrict,
  id text not null,
  subject text not null default '',
  class_name text not null default '',
  academic_year integer,
  grade_level text,
  color_index integer,
  sort_order integer not null default 0,
  notes jsonb not null default '{}'::jsonb,
  extra_days jsonb not null default '{}'::jsonb,
  score_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, id),
  constraint classrooms_id_not_blank check (btrim(id) <> ''),
  constraint classrooms_notes_object check (jsonb_typeof(notes) = 'object'),
  constraint classrooms_extra_days_object check (jsonb_typeof(extra_days) = 'object'),
  constraint classrooms_score_config_object check (jsonb_typeof(score_config) = 'object')
);

create table if not exists public.students (
  teacher_id uuid not null references public.teacher_profiles(teacher_id) on delete restrict,
  id text not null,
  name text not null default '',
  student_code text not null default '',
  nickname text not null default '',
  comment text not null default '',
  photo_base64 text,
  legacy_score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, id),
  constraint students_id_not_blank check (btrim(id) <> '')
);

create table if not exists public.classroom_students (
  teacher_id uuid not null,
  classroom_id text not null,
  student_id text not null,
  student_no integer,
  sort_order integer not null default 0,
  grade_override text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, classroom_id, student_id),
  foreign key (teacher_id, classroom_id) references public.classrooms(teacher_id, id) on delete restrict,
  foreign key (teacher_id, student_id) references public.students(teacher_id, id) on delete restrict,
  constraint classroom_students_no_positive check (student_no is null or student_no > 0)
);

create table if not exists public.timetable_entries (
  teacher_id uuid not null references public.teacher_profiles(teacher_id) on delete restrict,
  week text not null default 'A',
  day_of_week smallint not null,
  period smallint not null,
  classroom_id text,
  subject_snapshot text not null default '',
  class_name_snapshot text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, week, day_of_week, period),
  foreign key (teacher_id, classroom_id) references public.classrooms(teacher_id, id) on delete restrict,
  constraint timetable_entries_week_not_blank check (btrim(week) <> ''),
  constraint timetable_entries_day_range check (day_of_week between 0 and 6),
  constraint timetable_entries_period_positive check (period > 0)
);

create table if not exists public.attendance_records (
  teacher_id uuid not null,
  classroom_id text not null,
  student_id text not null,
  attendance_date date not null,
  status text not null,
  source text not null default 'teacher',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, classroom_id, student_id, attendance_date),
  foreign key (teacher_id, classroom_id, student_id)
    references public.classroom_students(teacher_id, classroom_id, student_id) on delete restrict,
  constraint attendance_records_status_check check (status in ('present', 'late', 'absent', 'leave'))
);

create table if not exists public.score_items (
  teacher_id uuid not null,
  classroom_id text not null,
  id text not null,
  name text not null default '',
  max_score numeric not null,
  item_type text not null default '',
  bucket text not null default 'before',
  item_date date,
  note text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, classroom_id, id),
  foreign key (teacher_id, classroom_id) references public.classrooms(teacher_id, id) on delete restrict,
  constraint score_items_id_not_blank check (btrim(id) <> ''),
  constraint score_items_max_positive check (max_score > 0),
  constraint score_items_bucket_check check (bucket in ('before', 'after', 'mid', 'final'))
);

create table if not exists public.student_scores (
  teacher_id uuid not null,
  classroom_id text not null,
  score_item_id text not null,
  student_id text not null,
  score numeric not null,
  source text not null default 'teacher',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, classroom_id, score_item_id, student_id),
  foreign key (teacher_id, classroom_id, score_item_id)
    references public.score_items(teacher_id, classroom_id, id) on delete restrict,
  foreign key (teacher_id, classroom_id, student_id)
    references public.classroom_students(teacher_id, classroom_id, student_id) on delete restrict,
  constraint student_scores_nonnegative check (score >= 0)
);

-- Search and ownership indexes. Primary keys already cover teacher_id as their leading column.
create index if not exists classrooms_teacher_year_grade_idx
  on public.classrooms (teacher_id, academic_year, grade_level, class_name)
  where deleted_at is null;
create index if not exists classrooms_teacher_subject_idx
  on public.classrooms (teacher_id, lower(subject))
  where deleted_at is null;
create index if not exists students_teacher_code_idx
  on public.students (teacher_id, student_code)
  where deleted_at is null and student_code <> '';
create index if not exists students_teacher_name_idx
  on public.students (teacher_id, lower(name) text_pattern_ops)
  where deleted_at is null;
create index if not exists classroom_students_class_no_idx
  on public.classroom_students (teacher_id, classroom_id, student_no)
  where deleted_at is null;
create index if not exists classroom_students_student_idx
  on public.classroom_students (teacher_id, student_id)
  where deleted_at is null;
create index if not exists timetable_entries_class_idx
  on public.timetable_entries (teacher_id, classroom_id)
  where deleted_at is null;
create index if not exists attendance_records_class_date_idx
  on public.attendance_records (teacher_id, classroom_id, attendance_date)
  where deleted_at is null;
create index if not exists attendance_records_student_date_idx
  on public.attendance_records (teacher_id, student_id, attendance_date desc)
  where deleted_at is null;
create index if not exists score_items_class_bucket_idx
  on public.score_items (teacher_id, classroom_id, bucket, item_date)
  where deleted_at is null;
create index if not exists student_scores_student_idx
  on public.student_scores (teacher_id, student_id)
  where deleted_at is null;

create or replace function public.classkru_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'teacher_profiles', 'classrooms', 'students', 'classroom_students',
    'timetable_entries', 'attendance_records', 'score_items', 'student_scores'
  ] loop
    execute format('drop trigger if exists classkru_touch_updated_at on public.%I', v_table);
    execute format('create trigger classkru_touch_updated_at before update on public.%I for each row execute function public.classkru_touch_updated_at()', v_table);
  end loop;
end
$$;

-- Seed the eight tables from every legacy JSON profile. Existing relational rows always win.
insert into public.teacher_profiles (
  teacher_id, email, teacher_name, profile_image_base64, period_settings,
  onboarding, holidays, timetable_week, active_web_screen, preferences
)
select
  u.id,
  lower(u.email),
  coalesce(p.state->>'teacherName', ''),
  nullif(p.state->>'profileImageBase64', ''),
  case when jsonb_typeof(p.state->'periodSettings') = 'object'
    then p.state->'periodSettings' else '{"startTime":"08:30","duration":50,"breakTime":0,"count":7}'::jsonb end,
  case when jsonb_typeof(p.state->'onboarding') = 'object' then p.state->'onboarding' else '{}'::jsonb end,
  case when jsonb_typeof(p.state->'holidays') = 'array' then p.state->'holidays' else '[]'::jsonb end,
  coalesce(nullif(p.state->>'timetableWeek', ''), 'A'),
  coalesce(nullif(p.state->>'activeWebScreen', ''), 'dashboard'),
  p.state - 'classes' - 'timetable' - 'lastModified' - '_deletedRecords'
    - 'teacherName' - 'profileImageBase64' - 'periodSettings' - 'onboarding'
    - 'holidays' - 'timetableWeek' - 'activeWebScreen'
from public.classmanager_profiles p
join auth.users u on lower(u.email) = lower(p.email)
where jsonb_typeof(p.state) = 'object'
on conflict (teacher_id) do nothing;

insert into public.classrooms (
  teacher_id, id, subject, class_name, academic_year, grade_level,
  color_index, sort_order, notes, extra_days, score_config
)
select
  u.id,
  c.value->>'id',
  coalesce(c.value->>'subject', ''),
  coalesce(c.value->>'className', ''),
  case when c.value->>'academicYear' ~ '^-?[0-9]+$' then (c.value->>'academicYear')::integer end,
  nullif(c.value->>'gradeLevel', ''),
  case when c.value->>'colorIndex' ~ '^-?[0-9]+$' then (c.value->>'colorIndex')::integer end,
  c.position - 1,
  case when jsonb_typeof(c.value->'notes') = 'object' then c.value->'notes' else '{}'::jsonb end,
  case when jsonb_typeof(c.value->'extraDays') = 'object' then c.value->'extraDays' else '{}'::jsonb end,
  case when jsonb_typeof(c.value->'scores'->'config') = 'object' then c.value->'scores'->'config' else '{}'::jsonb end
from public.classmanager_profiles p
join auth.users u on lower(u.email) = lower(p.email)
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p.state->'classes') = 'array' then p.state->'classes' else '[]'::jsonb end
) with ordinality c(value, position)
where coalesce(c.value->>'id', '') <> ''
on conflict (teacher_id, id) do nothing;

insert into public.students (
  teacher_id, id, name, student_code, nickname, comment, photo_base64, legacy_score
)
select distinct on (u.id, s.value->>'id')
  u.id,
  s.value->>'id',
  coalesce(s.value->>'name', ''),
  coalesce(s.value->>'studentCode', ''),
  coalesce(s.value->>'nickname', ''),
  coalesce(s.value->>'comment', ''),
  nullif(s.value->>'photoBase64', ''),
  case when s.value->>'score' ~ '^-?[0-9]+([.][0-9]+)?$' then (s.value->>'score')::numeric end
from public.classmanager_profiles p
join auth.users u on lower(u.email) = lower(p.email)
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p.state->'classes') = 'array' then p.state->'classes' else '[]'::jsonb end
) c(value)
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(c.value->'students') = 'array' then c.value->'students' else '[]'::jsonb end
) s(value)
where coalesce(s.value->>'id', '') <> ''
order by u.id, s.value->>'id'
on conflict (teacher_id, id) do nothing;

insert into public.classroom_students (
  teacher_id, classroom_id, student_id, student_no, sort_order, grade_override
)
select
  u.id,
  c.value->>'id',
  s.value->>'id',
  case when s.value->>'no' ~ '^[0-9]+$' and (s.value->>'no')::integer > 0 then (s.value->>'no')::integer end,
  s.position - 1,
  nullif(c.value->'scores'->'gradeOverride'->>(s.value->>'id'), '')
from public.classmanager_profiles p
join auth.users u on lower(u.email) = lower(p.email)
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p.state->'classes') = 'array' then p.state->'classes' else '[]'::jsonb end
) c(value)
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(c.value->'students') = 'array' then c.value->'students' else '[]'::jsonb end
) with ordinality s(value, position)
join public.classrooms cr on cr.teacher_id = u.id and cr.id = c.value->>'id'
join public.students st on st.teacher_id = u.id and st.id = s.value->>'id'
where coalesce(s.value->>'id', '') <> ''
on conflict (teacher_id, classroom_id, student_id) do nothing;

insert into public.timetable_entries (
  teacher_id, week, day_of_week, period, classroom_id, subject_snapshot, class_name_snapshot
)
select distinct on (u.id, (t.value->>'dow')::smallint, (t.value->>'period')::smallint)
  u.id,
  'A',
  (t.value->>'dow')::smallint,
  (t.value->>'period')::smallint,
  cr.id,
  coalesce(t.value->>'subject', cr.subject, ''),
  coalesce(t.value->>'className', cr.class_name, '')
from public.classmanager_profiles p
join auth.users u on lower(u.email) = lower(p.email)
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p.state->'timetable') = 'array' then p.state->'timetable' else '[]'::jsonb end
) with ordinality t(value, position)
left join public.classrooms cr on cr.teacher_id = u.id and cr.id = nullif(t.value->>'classId', '')
where t.value->>'dow' ~ '^[0-6]$'
  and t.value->>'period' ~ '^[0-9]+$'
  and (t.value->>'period')::integer > 0
order by u.id, (t.value->>'dow')::smallint, (t.value->>'period')::smallint, t.position
on conflict (teacher_id, week, day_of_week, period) do nothing;

insert into public.attendance_records (
  teacher_id, classroom_id, student_id, attendance_date, status
)
select
  u.id,
  c.value->>'id',
  mark.key,
  to_date(day.key, 'YYYY-MM-DD'),
  mark.value #>> '{}'
from public.classmanager_profiles p
join auth.users u on lower(u.email) = lower(p.email)
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p.state->'classes') = 'array' then p.state->'classes' else '[]'::jsonb end
) c(value)
cross join lateral jsonb_each(
  case when jsonb_typeof(c.value->'attendance') = 'object' then c.value->'attendance' else '{}'::jsonb end
) day(key, value)
cross join lateral jsonb_each(
  case when jsonb_typeof(day.value) = 'object' then day.value else '{}'::jsonb end
) mark(key, value)
join public.classroom_students cs
  on cs.teacher_id = u.id and cs.classroom_id = c.value->>'id' and cs.student_id = mark.key
where day.key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  and mark.value #>> '{}' in ('present', 'late', 'absent', 'leave')
on conflict (teacher_id, classroom_id, student_id, attendance_date) do nothing;

insert into public.score_items (
  teacher_id, classroom_id, id, name, max_score, item_type, bucket, item_date, note, sort_order
)
select
  u.id,
  c.value->>'id',
  item.value->>'id',
  coalesce(item.value->>'name', ''),
  (item.value->>'max')::numeric,
  coalesce(item.value->>'type', ''),
  coalesce(nullif(item.value->>'bucket', ''), 'before'),
  case when item.value->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then to_date(item.value->>'date', 'YYYY-MM-DD') end,
  coalesce(item.value->>'note', ''),
  item.position - 1
from public.classmanager_profiles p
join auth.users u on lower(u.email) = lower(p.email)
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p.state->'classes') = 'array' then p.state->'classes' else '[]'::jsonb end
) c(value)
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(c.value->'scores'->'items') = 'array' then c.value->'scores'->'items' else '[]'::jsonb end
) with ordinality item(value, position)
join public.classrooms cr on cr.teacher_id = u.id and cr.id = c.value->>'id'
where coalesce(item.value->>'id', '') <> ''
  and item.value->>'max' ~ '^[0-9]+([.][0-9]+)?$'
  and (item.value->>'max')::numeric > 0
  and coalesce(nullif(item.value->>'bucket', ''), 'before') in ('before', 'after', 'mid', 'final')
on conflict (teacher_id, classroom_id, id) do nothing;

insert into public.student_scores (
  teacher_id, classroom_id, score_item_id, student_id, score
)
select
  u.id,
  c.value->>'id',
  item.value->>'id',
  mark.key,
  (mark.value #>> '{}')::numeric
from public.classmanager_profiles p
join auth.users u on lower(u.email) = lower(p.email)
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p.state->'classes') = 'array' then p.state->'classes' else '[]'::jsonb end
) c(value)
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(c.value->'scores'->'items') = 'array' then c.value->'scores'->'items' else '[]'::jsonb end
) item(value)
cross join lateral jsonb_each(
  case when jsonb_typeof(jsonb_extract_path(c.value, 'scores', 'marks', item.value->>'id')) = 'object'
    then jsonb_extract_path(c.value, 'scores', 'marks', item.value->>'id') else '{}'::jsonb end
) mark(key, value)
join public.score_items si
  on si.teacher_id = u.id and si.classroom_id = c.value->>'id' and si.id = item.value->>'id'
join public.classroom_students cs
  on cs.teacher_id = u.id and cs.classroom_id = c.value->>'id' and cs.student_id = mark.key
where mark.value #>> '{}' ~ '^[0-9]+([.][0-9]+)?$'
  and (mark.value #>> '{}')::numeric >= 0
on conflict (teacher_id, classroom_id, score_item_id, student_id) do nothing;

-- RLS is enabled only after the legacy seed so the migration never depends on auth.uid().
-- Every application row is owned directly by the authenticated teacher; physical DELETE is denied.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'teacher_profiles', 'classrooms', 'students', 'classroom_students',
    'timetable_entries', 'attendance_records', 'score_items', 'student_scores'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
    execute format('drop policy if exists classkru_teacher_select on public.%I', v_table);
    execute format('drop policy if exists classkru_teacher_insert on public.%I', v_table);
    execute format('drop policy if exists classkru_teacher_update on public.%I', v_table);
    execute format('drop policy if exists classkru_teacher_delete on public.%I', v_table);
    execute format('create policy classkru_teacher_select on public.%I for select to authenticated using (teacher_id = (select auth.uid()))', v_table);
    execute format('create policy classkru_teacher_insert on public.%I for insert to authenticated with check (teacher_id = (select auth.uid()))', v_table);
    execute format('create policy classkru_teacher_update on public.%I for update to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()))', v_table);
    execute format('revoke all on table public.%I from anon', v_table);
    execute format('revoke delete on table public.%I from authenticated', v_table);
    execute format('grant select, insert, update on table public.%I to authenticated', v_table);
  end loop;
end
$$;

commit;
