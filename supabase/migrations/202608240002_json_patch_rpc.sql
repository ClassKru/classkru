-- Granular, conflict-safe updates for the existing classmanager_profiles.state JSON (protocol v1).
-- This migration creates functions only: no data tables, no data rewrite, and no JSON migration.
-- Rollback: deploy the legacy-capable frontend first, then DROP the four functions created below.
-- Existing profile JSON remains unchanged by both installation and rollback.
begin;

create or replace function public.classkru_json_array_index(p_array jsonb, p_id text)
returns integer
language sql
immutable
security invoker
set search_path = public
as $$
  select (ordinality - 1)::integer
  from jsonb_array_elements(case when jsonb_typeof(p_array) = 'array' then p_array else '[]'::jsonb end)
       with ordinality as item(value, ordinality)
  where item.value->>'id' = p_id
  limit 1
$$;

create or replace function public.classkru_timetable_index(p_array jsonb, p_dow integer, p_period integer)
returns integer
language sql
immutable
security invoker
set search_path = public
as $$
  select (ordinality - 1)::integer
  from jsonb_array_elements(case when jsonb_typeof(p_array) = 'array' then p_array else '[]'::jsonb end)
       with ordinality as item(value, ordinality)
  where (item.value->>'dow')::integer = p_dow
    and (item.value->>'period')::integer = p_period
  limit 1
$$;

create or replace function public.classkru_patch_capabilities()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if auth.email() is null then
    raise exception 'Authenticated teacher required' using errcode = '42501';
  end if;
  return jsonb_build_object('version', 1, 'storage', 'classmanager_profiles.state');
end
$$;

create or replace function public.classkru_apply_state_operations(
  p_operations jsonb,
  p_client_modified bigint default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_state jsonb;
  v_profile_email text;
  v_operation jsonb;
  v_kind text;
  v_key text;
  v_class_id text;
  v_student_id text;
  v_item_id text;
  v_date text;
  v_class_index integer;
  v_student_index integer;
  v_item_index integer;
  v_timetable_index integer;
  v_class jsonb;
  v_students jsonb;
  v_attendance jsonb;
  v_day jsonb;
  v_scores jsonb;
  v_items jsonb;
  v_marks jsonb;
  v_item_marks jsonb;
  v_overrides jsonb;
  v_timetable jsonb;
  v_entry jsonb;
  v_item jsonb;
  v_value jsonb;
  v_status text;
  v_score numeric;
  v_max numeric;
  v_archive jsonb;
  v_server_modified bigint;
begin
  if auth.email() is null then
    raise exception 'Authenticated teacher required' using errcode = '42501';
  end if;
  if p_operations is null or jsonb_typeof(p_operations) <> 'array' then
    raise exception 'p_operations must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_operations) > 500 then
    raise exception 'A patch is limited to 500 operations' using errcode = '54000';
  end if;

  select coalesce(state::jsonb, '{}'::jsonb), email
    into v_state, v_profile_email
  from public.classmanager_profiles
  where lower(email) = lower(auth.email())
  for update;

  if not found then
    raise exception 'Teacher profile does not exist' using errcode = 'P0002';
  end if;
  if jsonb_typeof(coalesce(v_state->'classes', '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid state.classes' using errcode = '22023';
  end if;
  if jsonb_array_length(p_operations) = 0 then
    return v_state;
  end if;

  for v_operation in select value from jsonb_array_elements(p_operations)
  loop
    v_kind := v_operation->>'kind';
    if v_kind is null then
      raise exception 'Operation kind is required' using errcode = '22023';
    end if;

    if v_kind in ('set_top', 'unset_top') then
      v_key := v_operation->>'key';
      if not (v_key = any(array[
        'teacherName', 'profileImageBase64', 'periodSettings', 'onboarding',
        'holidays', 'timetableWeek', 'activeWebScreen'
      ])) then
        raise exception 'Top-level field is not allowed: %', coalesce(v_key, '') using errcode = '22023';
      end if;
      if v_kind = 'set_top' then
        if not (v_operation ? 'value') then raise exception 'Operation value is required' using errcode = '22023'; end if;
        v_state := jsonb_set(v_state, array[v_key], v_operation->'value', true);
      else
        v_state := v_state - v_key;
      end if;
      continue;
    end if;

    if v_kind in ('set_period_setting', 'unset_period_setting') then
      v_key := v_operation->>'field';
      if not (v_key = any(array['startTime', 'duration', 'breakTime', 'count'])) then
        raise exception 'Period setting is not allowed: %', coalesce(v_key, '') using errcode = '22023';
      end if;
      v_value := case when jsonb_typeof(v_state->'periodSettings') = 'object' then v_state->'periodSettings' else '{}'::jsonb end;
      if v_kind = 'set_period_setting' then
        if not (v_operation ? 'value') then raise exception 'Operation value is required' using errcode = '22023'; end if;
        v_value := jsonb_set(v_value, array[v_key], v_operation->'value', true);
      else v_value := v_value - v_key;
      end if;
      v_state := jsonb_set(v_state, '{periodSettings}', v_value, true);
      continue;
    end if;

    if v_kind in ('upsert_timetable', 'remove_timetable') then
      v_timetable := case when jsonb_typeof(v_state->'timetable') = 'array' then v_state->'timetable' else '[]'::jsonb end;
      if v_kind = 'upsert_timetable' then
        v_entry := v_operation->'entry';
        if jsonb_typeof(v_entry) <> 'object'
           or not (v_entry ? 'dow') or not (v_entry ? 'period')
           or (v_entry->>'dow')::integer < 0 or (v_entry->>'dow')::integer > 6
           or (v_entry->>'period')::integer < 1 then
          raise exception 'Invalid timetable entry' using errcode = '22023';
        end if;
        v_timetable_index := public.classkru_timetable_index(v_timetable, (v_entry->>'dow')::integer, (v_entry->>'period')::integer);
        if v_timetable_index is null then v_timetable := v_timetable || jsonb_build_array(v_entry);
        else v_timetable := jsonb_set(v_timetable, array[v_timetable_index::text], v_entry, false);
        end if;
      else
        if not (v_operation ? 'dow') or not (v_operation ? 'period') then raise exception 'Timetable key is required' using errcode = '22023'; end if;
        v_timetable_index := public.classkru_timetable_index(v_timetable, (v_operation->>'dow')::integer, (v_operation->>'period')::integer);
        if v_timetable_index is not null then
          v_archive := jsonb_build_object('type', 'timetable', 'deletedAt', now(), 'record', v_timetable->v_timetable_index);
          v_state := jsonb_set(v_state, '{_deletedRecords}',
            coalesce(case when jsonb_typeof(v_state->'_deletedRecords') = 'array' then v_state->'_deletedRecords' end, '[]'::jsonb) || jsonb_build_array(v_archive), true);
          v_timetable := v_timetable - v_timetable_index;
        end if;
      end if;
      v_state := jsonb_set(v_state, '{timetable}', v_timetable, true);
      continue;
    end if;

    if v_kind = 'upsert_class' then
      v_class := v_operation->'class';
      v_class_id := v_class->>'id';
      if jsonb_typeof(v_class) <> 'object' or coalesce(v_class_id, '') = '' then
        raise exception 'Class object with id is required' using errcode = '22023';
      end if;
      v_class_index := public.classkru_json_array_index(v_state->'classes', v_class_id);
      if v_class_index is null then
        v_state := jsonb_set(v_state, '{classes}', (v_state->'classes') || jsonb_build_array(v_class), true);
      else
        v_state := jsonb_set(v_state, array['classes', v_class_index::text], v_class, false);
      end if;
      continue;
    end if;

    v_class_id := v_operation->>'classId';
    if coalesce(v_class_id, '') = '' then raise exception 'classId is required' using errcode = '22023'; end if;
    v_class_index := public.classkru_json_array_index(v_state->'classes', v_class_id);

    if v_kind = 'remove_class' then
      if v_class_index is not null then
        v_class := v_state->'classes'->v_class_index;
        v_archive := jsonb_build_object('type', 'class', 'deletedAt', now(), 'classId', v_class_id, 'record', v_class);
        v_state := jsonb_set(v_state, '{_deletedRecords}',
          coalesce(case when jsonb_typeof(v_state->'_deletedRecords') = 'array' then v_state->'_deletedRecords' end, '[]'::jsonb) || jsonb_build_array(v_archive), true);
        v_state := jsonb_set(v_state, '{classes}', (v_state->'classes') - v_class_index, true);
        v_timetable := case when jsonb_typeof(v_state->'timetable') = 'array' then v_state->'timetable' else '[]'::jsonb end;
        select coalesce(jsonb_agg(value), '[]'::jsonb) into v_timetable
        from jsonb_array_elements(v_timetable) where value->>'classId' is distinct from v_class_id;
        v_state := jsonb_set(v_state, '{timetable}', v_timetable, true);
      end if;
      continue;
    end if;

    if v_class_index is null then raise exception 'Class not found: %', v_class_id using errcode = 'P0002'; end if;
    v_class := v_state->'classes'->v_class_index;

    if v_kind in ('set_class_field', 'unset_class_field') then
      v_key := v_operation->>'field';
      if not (v_key = any(array['subject', 'className', 'academicYear', 'gradeLevel', 'colorIndex'])) then
        raise exception 'Class field is not allowed: %', coalesce(v_key, '') using errcode = '22023';
      end if;
      if v_kind = 'set_class_field' then
        if not (v_operation ? 'value') then raise exception 'Operation value is required' using errcode = '22023'; end if;
        v_class := jsonb_set(v_class, array[v_key], v_operation->'value', true);
      else v_class := v_class - v_key;
      end if;
    elsif v_kind in ('set_class_map_value', 'unset_class_map_value') then
      v_key := v_operation->>'field'; v_date := v_operation->>'mapKey';
      if not (v_key = any(array['notes', 'extraDays'])) or coalesce(v_date, '') = '' then
        raise exception 'Class map field or key is not allowed' using errcode = '22023';
      end if;
      v_value := case when jsonb_typeof(v_class->v_key) = 'object' then v_class->v_key else '{}'::jsonb end;
      if v_kind = 'set_class_map_value' then
        if not (v_operation ? 'value') then raise exception 'Operation value is required' using errcode = '22023'; end if;
        v_value := jsonb_set(v_value, array[v_date], v_operation->'value', true);
      else v_value := v_value - v_date;
      end if;
      v_class := jsonb_set(v_class, array[v_key], v_value, true);
    elsif v_kind = 'upsert_student' then
      v_value := v_operation->'student';
      v_student_id := v_value->>'id';
      if jsonb_typeof(v_value) <> 'object' or coalesce(v_student_id, '') = '' then raise exception 'Student object with id is required' using errcode = '22023'; end if;
      v_students := case when jsonb_typeof(v_class->'students') = 'array' then v_class->'students' else '[]'::jsonb end;
      v_student_index := public.classkru_json_array_index(v_students, v_student_id);
      if v_student_index is null then v_students := v_students || jsonb_build_array(v_value);
      else v_students := jsonb_set(v_students, array[v_student_index::text], v_value, false);
      end if;
      v_class := jsonb_set(v_class, '{students}', v_students, true);
    elsif v_kind in ('set_student_field', 'unset_student_field') then
      v_student_id := v_operation->>'studentId'; v_key := v_operation->>'field';
      if not (v_key = any(array['name', 'no', 'studentCode', 'nickname', 'comment', 'score', 'photoBase64'])) then
        raise exception 'Student field is not allowed: %', coalesce(v_key, '') using errcode = '22023';
      end if;
      v_students := case when jsonb_typeof(v_class->'students') = 'array' then v_class->'students' else '[]'::jsonb end;
      v_student_index := public.classkru_json_array_index(v_students, v_student_id);
      if v_student_index is null then raise exception 'Student not found: %', v_student_id using errcode = 'P0002'; end if;
      v_value := v_students->v_student_index;
      if v_kind = 'set_student_field' then
        if not (v_operation ? 'value') then raise exception 'Operation value is required' using errcode = '22023'; end if;
        v_value := jsonb_set(v_value, array[v_key], v_operation->'value', true);
      else v_value := v_value - v_key;
      end if;
      v_students := jsonb_set(v_students, array[v_student_index::text], v_value, false);
      v_class := jsonb_set(v_class, '{students}', v_students, true);
    elsif v_kind = 'remove_student' then
      v_student_id := v_operation->>'studentId';
      v_students := case when jsonb_typeof(v_class->'students') = 'array' then v_class->'students' else '[]'::jsonb end;
      v_student_index := public.classkru_json_array_index(v_students, v_student_id);
      if v_student_index is not null then
        v_archive := jsonb_build_object(
          'type', 'student', 'deletedAt', now(), 'classId', v_class_id, 'studentId', v_student_id,
          'record', v_students->v_student_index,
          'attendance', coalesce((select jsonb_object_agg(key, value->v_student_id) from jsonb_each(coalesce(v_class->'attendance', '{}'::jsonb)) where value ? v_student_id), '{}'::jsonb),
          'scores', coalesce((select jsonb_object_agg(key, value->v_student_id) from jsonb_each(coalesce(v_class->'scores'->'marks', '{}'::jsonb)) where value ? v_student_id), '{}'::jsonb),
          'gradeOverride', v_class->'scores'->'gradeOverride'->v_student_id
        );
        v_state := jsonb_set(v_state, '{_deletedRecords}',
          coalesce(case when jsonb_typeof(v_state->'_deletedRecords') = 'array' then v_state->'_deletedRecords' end, '[]'::jsonb) || jsonb_build_array(v_archive), true);
        v_students := v_students - v_student_index;
        v_class := jsonb_set(v_class, '{students}', v_students, true);
        v_attendance := coalesce(v_class->'attendance', '{}'::jsonb);
        select coalesce(jsonb_object_agg(key, value - v_student_id) filter (where value - v_student_id <> '{}'::jsonb), '{}'::jsonb)
          into v_attendance from jsonb_each(v_attendance);
        v_class := jsonb_set(v_class, '{attendance}', v_attendance, true);
        v_scores := coalesce(v_class->'scores', '{}'::jsonb);
        v_marks := coalesce(v_scores->'marks', '{}'::jsonb);
        select coalesce(jsonb_object_agg(key, value - v_student_id), '{}'::jsonb) into v_marks from jsonb_each(v_marks);
        v_scores := jsonb_set(v_scores, '{marks}', v_marks, true);
        v_scores := jsonb_set(v_scores, '{gradeOverride}', coalesce(v_scores->'gradeOverride', '{}'::jsonb) - v_student_id, true);
        v_class := jsonb_set(v_class, '{scores}', v_scores, true);
      end if;
    elsif v_kind in ('set_attendance', 'unset_attendance') then
      v_student_id := v_operation->>'studentId'; v_date := v_operation->>'date';
      if coalesce(v_student_id, '') = '' or coalesce(v_date, '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Valid studentId and date are required' using errcode = '22023'; end if;
      if public.classkru_json_array_index(coalesce(v_class->'students', '[]'::jsonb), v_student_id) is null then raise exception 'Student not found: %', v_student_id using errcode = 'P0002'; end if;
      v_attendance := coalesce(v_class->'attendance', '{}'::jsonb); v_day := coalesce(v_attendance->v_date, '{}'::jsonb);
      if v_kind = 'set_attendance' then
        v_status := v_operation->>'value';
        if v_status is null or not (v_status = any(array['present', 'late', 'absent', 'leave'])) then raise exception 'Invalid attendance status' using errcode = '22023'; end if;
        v_day := jsonb_set(v_day, array[v_student_id], to_jsonb(v_status), true);
        v_attendance := jsonb_set(v_attendance, array[v_date], v_day, true);
      elsif v_day ? v_student_id then
        v_archive := jsonb_build_object('type', 'attendance', 'deletedAt', now(), 'classId', v_class_id, 'studentId', v_student_id, 'date', v_date, 'record', v_day->v_student_id);
        v_state := jsonb_set(v_state, '{_deletedRecords}',
          coalesce(case when jsonb_typeof(v_state->'_deletedRecords') = 'array' then v_state->'_deletedRecords' end, '[]'::jsonb) || jsonb_build_array(v_archive), true);
        v_day := v_day - v_student_id;
        if v_day = '{}'::jsonb then v_attendance := v_attendance - v_date; else v_attendance := jsonb_set(v_attendance, array[v_date], v_day, true); end if;
      end if;
      v_class := jsonb_set(v_class, '{attendance}', v_attendance, true);
    elsif v_kind in ('set_score_config_field', 'unset_score_config_field') then
      v_key := v_operation->>'field';
      if not (v_key = any(array['attendanceMin', 'gradeCut'])) then raise exception 'Score config field is not allowed' using errcode = '22023'; end if;
      v_scores := coalesce(v_class->'scores', '{}'::jsonb); v_value := coalesce(v_scores->'config', '{}'::jsonb);
      if v_kind = 'set_score_config_field' then
        if not (v_operation ? 'value') then raise exception 'Operation value is required' using errcode = '22023'; end if;
        v_value := jsonb_set(v_value, array[v_key], v_operation->'value', true);
      else v_value := v_value - v_key; end if;
      v_scores := jsonb_set(v_scores, '{config}', v_value, true);
      v_class := jsonb_set(v_class, '{scores}', v_scores, true);
    elsif v_kind in ('set_score_ratio', 'unset_score_ratio') then
      v_key := v_operation->>'bucket';
      if not (v_key = any(array['before', 'after', 'mid', 'final'])) then raise exception 'Score ratio bucket is not allowed' using errcode = '22023'; end if;
      v_scores := coalesce(v_class->'scores', '{}'::jsonb); v_value := coalesce(v_scores->'config', '{}'::jsonb);
      v_marks := coalesce(v_value->'ratio', '{}'::jsonb);
      if v_kind = 'set_score_ratio' then
        if jsonb_typeof(v_operation->'value') <> 'number' then raise exception 'Score ratio must be numeric' using errcode = '22023'; end if;
        v_marks := jsonb_set(v_marks, array[v_key], v_operation->'value', true);
      else v_marks := v_marks - v_key; end if;
      v_value := jsonb_set(v_value, '{ratio}', v_marks, true); v_scores := jsonb_set(v_scores, '{config}', v_value, true);
      v_class := jsonb_set(v_class, '{scores}', v_scores, true);
    elsif v_kind in ('set_grade_override', 'unset_grade_override') then
      v_student_id := v_operation->>'studentId';
      if public.classkru_json_array_index(coalesce(v_class->'students', '[]'::jsonb), v_student_id) is null then raise exception 'Student not found: %', v_student_id using errcode = 'P0002'; end if;
      v_scores := coalesce(v_class->'scores', '{}'::jsonb); v_overrides := coalesce(v_scores->'gradeOverride', '{}'::jsonb);
      if v_kind = 'set_grade_override' then
        if not (v_operation ? 'value') then raise exception 'Operation value is required' using errcode = '22023'; end if;
        v_overrides := jsonb_set(v_overrides, array[v_student_id], v_operation->'value', true);
      else v_overrides := v_overrides - v_student_id; end if;
      v_scores := jsonb_set(v_scores, '{gradeOverride}', v_overrides, true); v_class := jsonb_set(v_class, '{scores}', v_scores, true);
    elsif v_kind = 'upsert_score_item' then
      v_item := v_operation->'item'; v_item_id := v_item->>'id';
      if jsonb_typeof(v_item) <> 'object' or coalesce(v_item_id, '') = '' or jsonb_typeof(v_item->'max') <> 'number' or (v_item->>'max')::numeric <= 0 then
        raise exception 'Valid score item is required' using errcode = '22023';
      end if;
      if (v_item->>'bucket') is null or not ((v_item->>'bucket') = any(array['before', 'after', 'mid', 'final'])) then raise exception 'Invalid score bucket' using errcode = '22023'; end if;
      v_scores := coalesce(v_class->'scores', '{}'::jsonb); v_items := case when jsonb_typeof(v_scores->'items') = 'array' then v_scores->'items' else '[]'::jsonb end;
      v_item_index := public.classkru_json_array_index(v_items, v_item_id);
      if v_item_index is null then v_items := v_items || jsonb_build_array(v_item); else v_items := jsonb_set(v_items, array[v_item_index::text], v_item, false); end if;
      v_scores := jsonb_set(v_scores, '{items}', v_items, true); v_class := jsonb_set(v_class, '{scores}', v_scores, true);
    elsif v_kind in ('set_score_item_field', 'unset_score_item_field') then
      v_item_id := v_operation->>'itemId'; v_key := v_operation->>'field';
      if not (v_key = any(array['name', 'max', 'type', 'bucket', 'date', 'note'])) then raise exception 'Score item field is not allowed' using errcode = '22023'; end if;
      v_scores := coalesce(v_class->'scores', '{}'::jsonb); v_items := coalesce(v_scores->'items', '[]'::jsonb);
      v_item_index := public.classkru_json_array_index(v_items, v_item_id);
      if v_item_index is null then raise exception 'Score item not found: %', v_item_id using errcode = 'P0002'; end if;
      v_item := v_items->v_item_index;
      if v_kind = 'set_score_item_field' then
        if not (v_operation ? 'value') then raise exception 'Operation value is required' using errcode = '22023'; end if;
        if v_key = 'max' and (jsonb_typeof(v_operation->'value') <> 'number' or (v_operation->>'value')::numeric <= 0) then raise exception 'Score maximum must be positive' using errcode = '22023'; end if;
        if v_key = 'bucket' and not ((v_operation->>'value') = any(array['before', 'after', 'mid', 'final'])) then raise exception 'Invalid score bucket' using errcode = '22023'; end if;
        v_item := jsonb_set(v_item, array[v_key], v_operation->'value', true);
      else v_item := v_item - v_key;
      end if;
      v_items := jsonb_set(v_items, array[v_item_index::text], v_item, false);
      v_scores := jsonb_set(v_scores, '{items}', v_items, true); v_class := jsonb_set(v_class, '{scores}', v_scores, true);
    elsif v_kind = 'remove_score_item' then
      v_item_id := v_operation->>'itemId'; v_scores := coalesce(v_class->'scores', '{}'::jsonb);
      v_items := case when jsonb_typeof(v_scores->'items') = 'array' then v_scores->'items' else '[]'::jsonb end;
      v_item_index := public.classkru_json_array_index(v_items, v_item_id);
      if v_item_index is not null then
        v_archive := jsonb_build_object('type', 'score_item', 'deletedAt', now(), 'classId', v_class_id, 'itemId', v_item_id,
          'record', v_items->v_item_index, 'scores', v_scores->'marks'->v_item_id);
        v_state := jsonb_set(v_state, '{_deletedRecords}',
          coalesce(case when jsonb_typeof(v_state->'_deletedRecords') = 'array' then v_state->'_deletedRecords' end, '[]'::jsonb) || jsonb_build_array(v_archive), true);
        v_items := v_items - v_item_index; v_scores := jsonb_set(v_scores, '{items}', v_items, true);
        v_scores := jsonb_set(v_scores, '{marks}', coalesce(v_scores->'marks', '{}'::jsonb) - v_item_id, true);
        v_class := jsonb_set(v_class, '{scores}', v_scores, true);
      end if;
    elsif v_kind in ('set_score', 'unset_score') then
      v_item_id := v_operation->>'itemId'; v_student_id := v_operation->>'studentId';
      if public.classkru_json_array_index(coalesce(v_class->'students', '[]'::jsonb), v_student_id) is null then raise exception 'Student not found: %', v_student_id using errcode = 'P0002'; end if;
      v_scores := coalesce(v_class->'scores', '{}'::jsonb); v_items := coalesce(v_scores->'items', '[]'::jsonb);
      v_item_index := public.classkru_json_array_index(v_items, v_item_id);
      if v_item_index is null then raise exception 'Score item not found: %', v_item_id using errcode = 'P0002'; end if;
      v_marks := coalesce(v_scores->'marks', '{}'::jsonb); v_item_marks := coalesce(v_marks->v_item_id, '{}'::jsonb);
      if v_kind = 'set_score' then
        if jsonb_typeof(v_operation->'value') <> 'number' then raise exception 'Score must be numeric' using errcode = '22023'; end if;
        v_score := (v_operation->>'value')::numeric; v_max := (v_items->v_item_index->>'max')::numeric;
        if v_score < 0 or v_score > v_max then raise exception 'Score must be between 0 and %', v_max using errcode = '22023'; end if;
        v_item_marks := jsonb_set(v_item_marks, array[v_student_id], to_jsonb(v_score), true);
      elsif v_item_marks ? v_student_id then
        v_archive := jsonb_build_object('type', 'score', 'deletedAt', now(), 'classId', v_class_id, 'itemId', v_item_id, 'studentId', v_student_id, 'record', v_item_marks->v_student_id);
        v_state := jsonb_set(v_state, '{_deletedRecords}',
          coalesce(case when jsonb_typeof(v_state->'_deletedRecords') = 'array' then v_state->'_deletedRecords' end, '[]'::jsonb) || jsonb_build_array(v_archive), true);
        v_item_marks := v_item_marks - v_student_id;
      end if;
      v_marks := jsonb_set(v_marks, array[v_item_id], v_item_marks, true);
      v_scores := jsonb_set(v_scores, '{marks}', v_marks, true); v_class := jsonb_set(v_class, '{scores}', v_scores, true);
    else
      raise exception 'Operation kind is not allowed: %', v_kind using errcode = '22023';
    end if;

    v_state := jsonb_set(v_state, array['classes', v_class_index::text], v_class, false);
  end loop;

  v_server_modified := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  if p_client_modified is not null then v_server_modified := greatest(v_server_modified, p_client_modified); end if;
  v_state := jsonb_set(v_state, '{lastModified}', to_jsonb(v_server_modified), true);

  update public.classmanager_profiles
  set state = v_state,
      updated_at = now()
  where email = v_profile_email
    and lower(email) = lower(auth.email());

  if not found then raise exception 'Teacher profile update was denied' using errcode = '42501'; end if;
  return v_state;
end
$$;

revoke all on function public.classkru_json_array_index(jsonb, text) from public, anon, authenticated;
revoke all on function public.classkru_timetable_index(jsonb, integer, integer) from public, anon, authenticated;
revoke all on function public.classkru_patch_capabilities() from public, anon;
revoke all on function public.classkru_apply_state_operations(jsonb, bigint) from public, anon;
grant execute on function public.classkru_patch_capabilities() to authenticated;
grant execute on function public.classkru_apply_state_operations(jsonb, bigint) to authenticated;
grant execute on function public.classkru_json_array_index(jsonb, text) to authenticated;
grant execute on function public.classkru_timetable_index(jsonb, integer, integer) to authenticated;

commit;
