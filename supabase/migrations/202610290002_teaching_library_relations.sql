-- Store plans and generated learning materials as relational library rows.
-- Guidance plans can share a unit record, and plans can reference saved quizzes/worksheets.
begin;

create or replace function public.classkru_guidance_unit_key(item jsonb)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select case
    when coalesce(item->>'subjectId', '') <> 'guidance'
      or (btrim(coalesce(item->>'unitNumber', '')) = '' and btrim(coalesce(item->>'unitName', '')) = '')
      then null
    else coalesce(
      nullif(btrim(item->>'unitKey'), ''),
      lower(btrim(coalesce(
        nullif(btrim(item->>'courseCode'), ''),
        nullif(btrim(item->>'courseName'), ''),
        nullif(btrim(item->>'subjectId'), ''),
        'guidance'
      ))) || '|' || lower(btrim(coalesce(item->>'grade', '')))
        || '|' || coalesce(item->>'academicYear', '')
        || '|' || lower(btrim(coalesce(nullif(btrim(item->>'semester'), ''), '1')))
        || '|' || lower(btrim(coalesce(item->>'unitNumber', '')))
        || '|' || lower(btrim(coalesce(item->>'unitName', '')))
    )
  end
$$;

create table if not exists public.lesson_units (
  teacher_id uuid not null references public.teacher_profiles(teacher_id) on delete restrict,
  unit_key text not null,
  subject_id text not null default 'guidance',
  course_name text not null default '',
  course_code text not null default '',
  grade text not null default '',
  academic_year text not null default '',
  semester text not null default '1',
  unit_number text not null default '',
  unit_name text not null default '',
  year_objective text not null default '',
  unit_objective text not null default '',
  unit_hours numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, unit_key),
  constraint lesson_units_key_not_blank check (btrim(unit_key) <> ''),
  constraint lesson_units_positive_hours check (unit_hours is null or unit_hours > 0)
);

create table if not exists public.teaching_library_items (
  teacher_id uuid not null references public.teacher_profiles(teacher_id) on delete restrict,
  id text not null,
  item_type text not null default 'other',
  title text not null default '',
  item_data jsonb not null default '{}'::jsonb,
  unit_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, id),
  foreign key (teacher_id, unit_key) references public.lesson_units(teacher_id, unit_key) on delete restrict,
  constraint teaching_library_items_id_not_blank check (btrim(id) <> ''),
  constraint teaching_library_items_type_not_blank check (btrim(item_type) <> ''),
  constraint teaching_library_items_data_object check (jsonb_typeof(item_data) = 'object')
);

create table if not exists public.lesson_plan_assets (
  teacher_id uuid not null,
  lesson_plan_id text not null,
  asset_id text not null,
  asset_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, lesson_plan_id, asset_id),
  foreign key (teacher_id, lesson_plan_id) references public.teaching_library_items(teacher_id, id) on delete restrict,
  foreign key (teacher_id, asset_id) references public.teaching_library_items(teacher_id, id) on delete restrict,
  constraint lesson_plan_assets_type_not_blank check (btrim(asset_type) <> '')
);

-- Mini Lab artifacts are stored in private object storage and V5 task state.
-- Keep their durable link to the lesson plan in the same relational catalog.
create table if not exists public.lesson_plan_media_assets (
  teacher_id uuid not null references auth.users(id) on delete cascade,
  lesson_plan_id text not null,
  conversation_id uuid not null,
  job_id uuid not null,
  artifact_id text not null,
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (teacher_id, artifact_id),
  unique (teacher_id, conversation_id, job_id),
  foreign key (teacher_id, lesson_plan_id) references public.teaching_library_items(teacher_id, id) on delete restrict,
  foreign key (teacher_id, conversation_id) references public.interactive_v5_tasks(teacher_id, id) on delete cascade,
  constraint lesson_plan_media_assets_artifact_not_blank check (btrim(artifact_id) <> '')
);

create index if not exists teaching_library_items_lookup_idx
  on public.teaching_library_items (teacher_id, item_type, updated_at desc)
  where deleted_at is null;
create index if not exists teaching_library_items_unit_idx
  on public.teaching_library_items (teacher_id, unit_key)
  where deleted_at is null and unit_key is not null;
create index if not exists lesson_plan_assets_asset_idx
  on public.lesson_plan_assets (teacher_id, asset_id)
  where deleted_at is null;
create index if not exists lesson_plan_media_assets_plan_idx
  on public.lesson_plan_media_assets (teacher_id, lesson_plan_id, created_at desc)
  where deleted_at is null;

alter table public.lesson_units enable row level security;
alter table public.teaching_library_items enable row level security;
alter table public.lesson_plan_assets enable row level security;
alter table public.lesson_plan_media_assets enable row level security;

drop policy if exists lesson_units_teacher_access on public.lesson_units;
create policy lesson_units_teacher_access on public.lesson_units
  for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
drop policy if exists teaching_library_items_teacher_access on public.teaching_library_items;
create policy teaching_library_items_teacher_access on public.teaching_library_items
  for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
drop policy if exists lesson_plan_assets_teacher_access on public.lesson_plan_assets;
create policy lesson_plan_assets_teacher_access on public.lesson_plan_assets
  for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
drop policy if exists lesson_plan_media_assets_teacher_read on public.lesson_plan_media_assets;
create policy lesson_plan_media_assets_teacher_read on public.lesson_plan_media_assets
  for select to authenticated using (teacher_id = auth.uid());

grant select, insert, update, delete on public.lesson_units, public.teaching_library_items, public.lesson_plan_assets to authenticated;
grant select on public.lesson_plan_media_assets to authenticated;
grant select, insert, update, delete on public.lesson_plan_media_assets to service_role;
revoke all on public.lesson_units, public.teaching_library_items, public.lesson_plan_assets from anon;
revoke all on public.lesson_plan_media_assets from public, anon;
revoke all on function public.classkru_guidance_unit_key(jsonb) from public, anon, authenticated;

drop trigger if exists lesson_units_touch_updated_at on public.lesson_units;
create trigger lesson_units_touch_updated_at before update on public.lesson_units
  for each row execute function public.classkru_touch_updated_at();
drop trigger if exists teaching_library_items_touch_updated_at on public.teaching_library_items;
create trigger teaching_library_items_touch_updated_at before update on public.teaching_library_items
  for each row execute function public.classkru_touch_updated_at();
drop trigger if exists lesson_plan_assets_touch_updated_at on public.lesson_plan_assets;
create trigger lesson_plan_assets_touch_updated_at before update on public.lesson_plan_assets
  for each row execute function public.classkru_touch_updated_at();
drop trigger if exists lesson_plan_media_assets_touch_updated_at on public.lesson_plan_media_assets;
create trigger lesson_plan_media_assets_touch_updated_at before update on public.lesson_plan_media_assets
  for each row execute function public.classkru_touch_updated_at();

-- Copy existing library content before removing the legacy JSON key from preferences.
with library_items as (
  select p.teacher_id, entry.value as item_data,
         public.classkru_guidance_unit_key(entry.value) as unit_key
  from public.teacher_profiles p
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(p.preferences->'mediaLibrary') = 'array' then p.preferences->'mediaLibrary' else '[]'::jsonb end
  ) as entry(value)
  where jsonb_typeof(entry.value) = 'object' and coalesce(entry.value->>'id', '') <> ''
), unit_rows as (
  select distinct on (teacher_id, unit_key)
    teacher_id, unit_key,
    coalesce(nullif(item_data->>'courseName', ''), '') as course_name,
    coalesce(nullif(item_data->>'courseCode', ''), '') as course_code,
    coalesce(nullif(item_data->>'grade', ''), '') as grade,
    coalesce(nullif(item_data->>'academicYear', ''), '') as academic_year,
    coalesce(nullif(item_data->>'semester', ''), '1') as semester,
    coalesce(nullif(item_data->>'unitNumber', ''), '') as unit_number,
    coalesce(nullif(item_data->>'unitName', ''), '') as unit_name,
    coalesce(nullif(item_data->>'yearObjective', ''), '') as year_objective,
    coalesce(nullif(item_data->>'unitObjective', ''), '') as unit_objective,
    case
      when coalesce(item_data->>'unitHours', '') ~ '^([0-9]+)([.][0-9]+)?$'
        then case when (item_data->>'unitHours')::numeric > 0 then (item_data->>'unitHours')::numeric end
    end as unit_hours,
    item_data->>'createdAt' as item_created_at,
    item_data->>'id' as item_id
  from library_items
  where unit_key is not null
  order by teacher_id, unit_key, item_data->>'createdAt' desc nulls last, item_data->>'id' desc
)
insert into public.lesson_units (
  teacher_id, unit_key, subject_id, course_name, course_code, grade, academic_year,
  semester, unit_number, unit_name, year_objective, unit_objective, unit_hours
)
select teacher_id, unit_key, 'guidance', course_name, course_code, grade, academic_year,
       semester, unit_number, unit_name, year_objective, unit_objective, unit_hours
from unit_rows
on conflict (teacher_id, unit_key) do nothing;

insert into public.teaching_library_items (teacher_id, id, item_type, title, item_data, unit_key)
select p.teacher_id,
       entry.value->>'id',
       coalesce(nullif(entry.value->>'type', ''), 'other'),
       coalesce(nullif(entry.value->>'title', ''), nullif(entry.value->'plan'->>'title', ''), nullif(entry.value->>'topic', ''), ''),
       entry.value,
       public.classkru_guidance_unit_key(entry.value)
from public.teacher_profiles p
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p.preferences->'mediaLibrary') = 'array' then p.preferences->'mediaLibrary' else '[]'::jsonb end
) as entry(value)
where jsonb_typeof(entry.value) = 'object' and coalesce(entry.value->>'id', '') <> ''
on conflict (teacher_id, id) do nothing;

with edges as (
  select plan.teacher_id, plan.id as lesson_plan_id, refs.asset_id, refs.asset_type
  from public.teaching_library_items plan
  cross join lateral (
    select jsonb_array_elements_text(
      case when jsonb_typeof(plan.item_data->'linkedWorksheetIds') = 'array' then plan.item_data->'linkedWorksheetIds' else '[]'::jsonb end
    ) as asset_id, 'worksheet'::text as asset_type
    union all
    select jsonb_array_elements_text(
      case when jsonb_typeof(plan.item_data->'linkedQuizIds') = 'array' then plan.item_data->'linkedQuizIds' else '[]'::jsonb end
    ) as asset_id, 'quiz'::text as asset_type
  ) refs
  where plan.item_type = 'lesson_plan'
  union all
  select asset.teacher_id, asset.item_data->>'lessonPlanId', asset.id, asset.item_type
  from public.teaching_library_items asset
  where asset.item_type in ('worksheet', 'quiz') and coalesce(asset.item_data->>'lessonPlanId', '') <> ''
)
insert into public.lesson_plan_assets (teacher_id, lesson_plan_id, asset_id, asset_type)
select distinct edges.teacher_id, edges.lesson_plan_id, edges.asset_id, edges.asset_type
from edges
join public.teaching_library_items plan on plan.teacher_id = edges.teacher_id and plan.id = edges.lesson_plan_id and plan.item_type = 'lesson_plan'
join public.teaching_library_items asset on asset.teacher_id = edges.teacher_id and asset.id = edges.asset_id
where edges.lesson_plan_id <> '' and edges.asset_id <> ''
on conflict (teacher_id, lesson_plan_id, asset_id) do nothing;

update public.teacher_profiles
set preferences = preferences - 'mediaLibrary', updated_at = now()
where preferences ? 'mediaLibrary';

commit;
