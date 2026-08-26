-- Production-safe smoke test for the eight ClassKru relational tables.
-- Run with a database owner/Management API connection. Every write is rolled back.

begin;

do $$
declare
  v_function regprocedure;
begin
  if (select count(*) from public.teacher_profiles where deleted_at is null) < 2 then
    raise exception 'RLS smoke test requires at least two active teacher profiles';
  end if;

  foreach v_function in array array[
    'public.join_activity_create_session(text,text,text,text,text,jsonb,text)'::regprocedure,
    'public.join_activity_update_session(text,text,text,jsonb)'::regprocedure,
    'public.join_activity_set_phase(text,text)'::regprocedure,
    'public.join_activity_teacher_snapshot(text)'::regprocedure,
    'public.attendance_qr_create_session(text,text,text,text,text,jsonb)'::regprocedure,
    'public.attendance_qr_teacher_snapshot(text)'::regprocedure,
    'public.attendance_qr_close_session(text)'::regprocedure
  ] loop
    if has_function_privilege('anon', v_function, 'execute') then
      raise exception 'anon can execute teacher-only RPC %', v_function;
    end if;
    if not has_function_privilege('authenticated', v_function, 'execute') then
      raise exception 'authenticated cannot execute teacher RPC %', v_function;
    end if;
  end loop;

  foreach v_function in array array[
    'public.join_activity_get_session(text)'::regprocedure,
    'public.join_activity_register(text,text,text,text,text,text,text)'::regprocedure,
    'public.join_activity_submit_answer(text,uuid,text,text)'::regprocedure,
    'public.attendance_qr_get_session(text)'::regprocedure,
    'public.attendance_qr_mark_present(text,text,text)'::regprocedure
  ] loop
    if not has_function_privilege('anon', v_function, 'execute') then
      raise exception 'anon cannot execute student QR RPC %', v_function;
    end if;
    if not has_function_privilege('authenticated', v_function, 'execute') then
      raise exception 'authenticated cannot execute student QR RPC %', v_function;
    end if;
  end loop;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select teacher_id::text from public.teacher_profiles where deleted_at is null order by teacher_id limit 1),
  true
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('request.jwt.claim.sub'),
    'role', 'authenticated'
  )::text,
  true
);

select set_config(
  'classkru.other_teacher',
  (
    select teacher_id::text
    from public.teacher_profiles
    where deleted_at is null
      and teacher_id <> current_setting('request.jwt.claim.sub')::uuid
    order by teacher_id
    limit 1
  ),
  true
);

set local role authenticated;

do $$
declare
  v_teacher_id uuid := auth.uid();
  v_classroom_id constant text := '__classkru_rls_smoke_class__';
  v_student_id constant text := '__classkru_rls_smoke_student__';
  v_score_item_id constant text := '__classkru_rls_smoke_score__';
  v_rows integer;
begin
  if v_teacher_id is null then
    raise exception 'auth.uid() was not populated for the authenticated-role probe';
  end if;

  if exists (
    select 1 from public.teacher_profiles where teacher_id <> v_teacher_id
  ) then
    raise exception 'RLS exposed another teacher profile';
  end if;

  insert into public.classrooms (
    teacher_id, id, subject, class_name, academic_year, grade_level
  ) values (
    v_teacher_id, v_classroom_id, 'RLS smoke test', 'RLS smoke test', 2000, 'TEST'
  );

  insert into public.students (
    teacher_id, id, name, student_code
  ) values (
    v_teacher_id, v_student_id, 'RLS smoke student', 'RLS-SMOKE'
  );

  insert into public.classroom_students (
    teacher_id, classroom_id, student_id, student_no
  ) values (
    v_teacher_id, v_classroom_id, v_student_id, 1
  );

  insert into public.score_items (
    teacher_id, classroom_id, id, name, max_score, bucket
  ) values (
    v_teacher_id, v_classroom_id, v_score_item_id, 'RLS smoke score', 10, 'before'
  );

  insert into public.student_scores (
    teacher_id, classroom_id, score_item_id, student_id, score
  ) values (
    v_teacher_id, v_classroom_id, v_score_item_id, v_student_id, 1
  );

  update public.student_scores
  set score = 2
  where teacher_id = v_teacher_id
    and classroom_id = v_classroom_id
    and score_item_id = v_score_item_id
    and student_id = v_student_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Granular score update affected % rows instead of 1', v_rows;
  end if;

  insert into public.attendance_records (
    teacher_id, classroom_id, student_id, attendance_date, status
  ) values (
    v_teacher_id, v_classroom_id, v_student_id, date '2000-01-01', 'present'
  );

  update public.attendance_records
  set status = 'late'
  where teacher_id = v_teacher_id
    and classroom_id = v_classroom_id
    and student_id = v_student_id
    and attendance_date = date '2000-01-01';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Granular attendance update affected % rows instead of 1', v_rows;
  end if;

  insert into public.timetable_entries (
    teacher_id, week, day_of_week, period, classroom_id,
    subject_snapshot, class_name_snapshot
  ) values (
    v_teacher_id, '__RLS_SMOKE__', 0, 1, v_classroom_id,
    'RLS smoke test', 'RLS smoke test'
  );

  update public.timetable_entries
  set deleted_at = now()
  where teacher_id = v_teacher_id
    and week = '__RLS_SMOKE__'
    and day_of_week = 0
    and period = 1;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Soft delete affected % rows instead of 1', v_rows;
  end if;

  begin
    delete from public.student_scores
    where teacher_id = v_teacher_id
      and classroom_id = v_classroom_id
      and score_item_id = v_score_item_id
      and student_id = v_student_id;
    raise exception 'Physical DELETE unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.classrooms (
      teacher_id, id, subject, class_name
    ) values (
      current_setting('classkru.other_teacher')::uuid,
      '__classkru_cross_tenant_smoke__',
      'must be denied',
      'must be denied'
    );
    raise exception 'Cross-tenant INSERT unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  if not exists (
    select 1
    from public.student_scores
    where teacher_id = v_teacher_id
      and classroom_id = v_classroom_id
      and score_item_id = v_score_item_id
      and student_id = v_student_id
      and score = 2
  ) then
    raise exception 'Score row was not readable after granular update';
  end if;

  if not exists (
    select 1
    from public.attendance_records
    where teacher_id = v_teacher_id
      and classroom_id = v_classroom_id
      and student_id = v_student_id
      and attendance_date = date '2000-01-01'
      and status = 'late'
  ) then
    raise exception 'Attendance row was not readable after granular update';
  end if;
end;
$$;

rollback;

select 'CLASSKRU_RELATIONAL_RLS_SMOKE_OK' as result;
