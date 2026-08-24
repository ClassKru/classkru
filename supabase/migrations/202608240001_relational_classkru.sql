begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.teacher_profiles (
  teacher_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  profile_image_path text,
  legacy_profile_base64 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.teacher_settings (
  teacher_id uuid primary key references auth.users(id) on delete cascade,
  period_start_time time not null default '08:30',
  period_duration integer not null default 50 check (period_duration between 1 and 240),
  period_break_time integer not null default 0 check (period_break_time between 0 and 120),
  period_count integer not null default 7 check (period_count between 1 and 16),
  onboarding_done boolean not null default false,
  holidays jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classrooms (
  teacher_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  subject text not null,
  class_name text not null,
  academic_year integer,
  grade_level text,
  color_index integer,
  legacy_notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, id)
);

create table if not exists public.students (
  teacher_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  student_code text not null default '',
  nickname text not null default '',
  comment text not null default '',
  photo_path text,
  legacy_photo_base64 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, id)
);

create table if not exists public.classroom_students (
  teacher_id uuid not null,
  classroom_id text not null,
  student_id text not null,
  student_no integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, classroom_id, student_id),
  foreign key (teacher_id, classroom_id) references public.classrooms(teacher_id, id),
  foreign key (teacher_id, student_id) references public.students(teacher_id, id)
);

create table if not exists public.timetable_entries (
  teacher_id uuid not null,
  classroom_id text,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  period integer not null check (period >= 1),
  week_code text not null default 'A' check (week_code in ('A','B')),
  subject_snapshot text not null default '',
  class_name_snapshot text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, day_of_week, period, week_code),
  foreign key (teacher_id, classroom_id) references public.classrooms(teacher_id, id)
);

create table if not exists public.classroom_extra_days (
  teacher_id uuid not null,
  classroom_id text not null,
  extra_date date not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, classroom_id, extra_date),
  foreign key (teacher_id, classroom_id) references public.classrooms(teacher_id, id)
);

create table if not exists public.attendance_records (
  teacher_id uuid not null,
  classroom_id text not null,
  student_id text not null,
  attendance_date date not null,
  status text not null check (status in ('present','late','absent','leave')),
  source text not null default 'teacher',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, classroom_id, student_id, attendance_date),
  foreign key (teacher_id, classroom_id, student_id)
    references public.classroom_students(teacher_id, classroom_id, student_id)
);

create table if not exists public.classroom_score_settings (
  teacher_id uuid not null,
  classroom_id text not null,
  ratio_before numeric not null default 40,
  ratio_after numeric not null default 30,
  ratio_mid numeric not null default 10,
  ratio_final numeric not null default 20,
  attendance_min numeric not null default 60,
  grade_cut jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (teacher_id, classroom_id),
  foreign key (teacher_id, classroom_id) references public.classrooms(teacher_id, id),
  check (ratio_before + ratio_after + ratio_mid + ratio_final = 100)
);

create table if not exists public.score_items (
  teacher_id uuid not null,
  id text not null,
  classroom_id text not null,
  name text not null,
  max_score numeric not null check (max_score > 0),
  item_type text not null default '',
  bucket text not null check (bucket in ('before','after','mid','final')),
  item_date date,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, id),
  foreign key (teacher_id, classroom_id) references public.classrooms(teacher_id, id)
);

create table if not exists public.student_scores (
  teacher_id uuid not null,
  score_item_id text not null,
  student_id text not null,
  score numeric not null check (score >= 0),
  version bigint not null default 1,
  source text not null default 'teacher',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, score_item_id, student_id),
  foreign key (teacher_id, score_item_id) references public.score_items(teacher_id, id),
  foreign key (teacher_id, student_id) references public.students(teacher_id, id)
);

create table if not exists public.student_grade_overrides (
  teacher_id uuid not null,
  classroom_id text not null,
  student_id text not null,
  grade text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, classroom_id, student_id),
  foreign key (teacher_id, classroom_id, student_id)
    references public.classroom_students(teacher_id, classroom_id, student_id)
);

create table if not exists public.legacy_state_migrations (
  teacher_id uuid primary key references auth.users(id) on delete cascade,
  source_hash text not null,
  status text not null check (status in ('running','completed','failed')),
  row_counts jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists classroom_students_active_no_idx
  on public.classroom_students (teacher_id, classroom_id, student_no)
  where deleted_at is null and student_no is not null;
create index if not exists classrooms_search_idx on public.classrooms (teacher_id, academic_year, grade_level, class_name) where deleted_at is null;
create index if not exists students_code_idx on public.students (teacher_id, student_code) where deleted_at is null;
create index if not exists students_name_trgm_idx on public.students using gin (lower(name) gin_trgm_ops) where deleted_at is null;
create index if not exists attendance_class_date_idx on public.attendance_records (teacher_id, classroom_id, attendance_date) where deleted_at is null;
create index if not exists attendance_student_date_idx on public.attendance_records (teacher_id, student_id, attendance_date desc) where deleted_at is null;
create index if not exists score_items_class_idx on public.score_items (teacher_id, classroom_id, bucket, item_date) where deleted_at is null;
create index if not exists student_scores_student_idx on public.student_scores (teacher_id, student_id) where deleted_at is null;

do $$
declare t text;
begin
  foreach t in array array[
    'teacher_profiles','teacher_settings','classrooms','students','classroom_students',
    'timetable_entries','classroom_extra_days','attendance_records','classroom_score_settings',
    'score_items','student_scores','student_grade_overrides','legacy_state_migrations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists classkru_owner_all on public.%I', t);
    execute format(
      'create policy classkru_owner_all on public.%I for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid())', t
    );
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;

create or replace function public.classkru_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'teacher_profiles','teacher_settings','classrooms','students','classroom_students',
    'timetable_entries','attendance_records','classroom_score_settings','score_items',
    'student_scores','student_grade_overrides'
  ] loop
    execute format('drop trigger if exists classkru_touch_updated_at on public.%I', t);
    execute format('create trigger classkru_touch_updated_at before update on public.%I for each row execute function public.classkru_touch_updated_at()', t);
  end loop;
end $$;

commit;
