// Canonical persistence for the eight ClassKru relational tables.
// localStorage remains the local-first working copy; queued writes stay in this browser only.
let relationalMode = localStorage.getItem('classkru_relational_v1') === '1' ? 'ready' : 'unknown';
let relationalBaseline = null;
let relationalTeacherIdValue = '';
let relationalTeacherEmail = '';
let relationalWriteQueue = Promise.resolve();
let relationalSequence = 0;
let relationalLegacyProbeAt = 0;
let relationalLegacyProbePromise = null;

const RELATIONAL_QUEUE_KEY = 'classkru_relational_queue_v1';
const RELATIONAL_TABLES = [
  'teacher_profiles', 'classrooms', 'students', 'classroom_students',
  'timetable_entries', 'attendance_records', 'score_items', 'student_scores'
];
const RELATIONAL_CHILD_TABLES = RELATIONAL_TABLES.slice(1);
const RELATIONAL_CONFLICTS = {
  teacher_profiles: 'teacher_id',
  classrooms: 'teacher_id,id',
  students: 'teacher_id,id',
  classroom_students: 'teacher_id,classroom_id,student_id',
  timetable_entries: 'teacher_id,week,day_of_week,period',
  attendance_records: 'teacher_id,classroom_id,student_id,attendance_date',
  score_items: 'teacher_id,classroom_id,id',
  student_scores: 'teacher_id,classroom_id,score_item_id,student_id'
};
const RELATIONAL_KEYS = Object.fromEntries(Object.entries(RELATIONAL_CONFLICTS)
  .map(([table, columns]) => [table, columns.split(',')]));
const RELATIONAL_TOP_KEYS = new Set([
  'classes', 'timetable', 'lastModified', '_deletedRecords', 'teacherName',
  'profileImageBase64', 'periodSettings', 'onboarding', 'holidays',
  'timetableWeek', 'activeWebScreen'
]);

function relationalClone(value) {
  if (value === undefined) return undefined;
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function relationalSame(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function relationalKey(parts) {
  return parts.map(value => String(value ?? '')).join('\u001f');
}

function relationalOperationId() {
  relationalSequence += 1;
  return globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `row_${Date.now()}_${relationalSequence}_${Math.random().toString(36).slice(2)}`;
}

function relationalQueueRows() {
  try {
    const rows = JSON.parse(localStorage.getItem(RELATIONAL_QUEUE_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch (_) {
    return [];
  }
}

function relationalQueuePut(entry) {
  const rows = relationalQueueRows();
  const index = rows.findIndex(row => row.id === entry.id);
  if (index >= 0) rows[index] = entry;
  else rows.push(entry);
  localStorage.setItem(RELATIONAL_QUEUE_KEY, JSON.stringify(rows));
}

function relationalQueueDelete(id) {
  const rows = relationalQueueRows().filter(row => row.id !== id);
  localStorage.setItem(RELATIONAL_QUEUE_KEY, JSON.stringify(rows));
}

function relationalQueueAll(teacherId = relationalTeacherIdValue) {
  return relationalQueueRows()
    .filter(row => row.teacherId === teacherId)
    .sort((a, b) => Number(a.createdAt) - Number(b.createdAt)
      || Number(a.sequence) - Number(b.sequence)
      || String(a.id).localeCompare(String(b.id)));
}

function relationalPreferences(state) {
  return Object.fromEntries(Object.entries(state || {})
    .filter(([key]) => !RELATIONAL_TOP_KEYS.has(key)));
}

function relationalRows(state, teacherId, email = relationalTeacherEmail) {
  const safeState = state || {};
  const rows = Object.fromEntries(RELATIONAL_TABLES.map(table => [table, new Map()]));
  const put = (table, keyParts, row) => rows[table].set(relationalKey(keyParts), row);

  put('teacher_profiles', [teacherId], {
    teacher_id: teacherId,
    email: String(email || '').trim().toLowerCase(),
    teacher_name: String(safeState.teacherName || ''),
    profile_image_base64: safeState.profileImageBase64 || null,
    period_settings: safeState.periodSettings || { startTime: '08:30', duration: 50, breakTime: 0, count: 7 },
    onboarding: safeState.onboarding && typeof safeState.onboarding === 'object' ? safeState.onboarding : {},
    holidays: Array.isArray(safeState.holidays) ? safeState.holidays : [],
    timetable_week: 'A',
    active_web_screen: safeState.activeWebScreen || 'dashboard',
    preferences: relationalPreferences(safeState),
    deleted_at: null
  });

  (Array.isArray(safeState.classes) ? safeState.classes : []).forEach((classroom, classIndex) => {
    if (!classroom?.id) return;
    const classroomId = String(classroom.id);
    const scoreState = classroom.scores || {};
    put('classrooms', [classroomId], {
      teacher_id: teacherId,
      id: classroomId,
      subject: String(classroom.subject || ''),
      class_name: String(classroom.className || ''),
      academic_year: classroom.academicYear === '' || classroom.academicYear == null
        ? null : Number(classroom.academicYear),
      grade_level: classroom.gradeLevel || null,
      color_index: classroom.colorIndex === '' || classroom.colorIndex == null
        ? null : Number(classroom.colorIndex),
      sort_order: classIndex,
      notes: classroom.notes && typeof classroom.notes === 'object' ? classroom.notes : {},
      extra_days: classroom.extraDays && typeof classroom.extraDays === 'object' ? classroom.extraDays : {},
      score_config: scoreState.config && typeof scoreState.config === 'object' ? scoreState.config : {},
      deleted_at: null
    });

    const studentIds = new Set();
    (Array.isArray(classroom.students) ? classroom.students : []).forEach((student, studentIndex) => {
      if (!student?.id) return;
      const studentId = String(student.id);
      studentIds.add(studentId);
      if (!rows.students.has(relationalKey([studentId]))) {
        put('students', [studentId], {
          teacher_id: teacherId,
          id: studentId,
          name: String(student.name || ''),
          student_code: String(student.studentCode || ''),
          nickname: String(student.nickname || ''),
          comment: String(student.comment || ''),
          photo_base64: student.photoBase64 || null,
          legacy_score: student.score === '' || student.score == null ? null : Number(student.score),
          deleted_at: null
        });
      }
      put('classroom_students', [classroomId, studentId], {
        teacher_id: teacherId,
        classroom_id: classroomId,
        student_id: studentId,
        student_no: student.no === '' || student.no == null ? null : Number(student.no),
        sort_order: studentIndex,
        grade_override: scoreState.gradeOverride?.[studentId] || null,
        deleted_at: null
      });
    });

    Object.entries(classroom.attendance || {}).forEach(([date, marks]) => {
      Object.entries(marks || {}).forEach(([studentId, status]) => {
        if (!studentIds.has(String(studentId)) || !status) return;
        put('attendance_records', [classroomId, studentId, date], {
          teacher_id: teacherId,
          classroom_id: classroomId,
          student_id: String(studentId),
          attendance_date: date,
          status,
          source: 'teacher',
          deleted_at: null
        });
      });
    });

    (Array.isArray(scoreState.items) ? scoreState.items : []).forEach((item, itemIndex) => {
      if (!item?.id) return;
      const itemId = String(item.id);
      put('score_items', [classroomId, itemId], {
        teacher_id: teacherId,
        classroom_id: classroomId,
        id: itemId,
        name: String(item.name || ''),
        max_score: Number(item.max),
        item_type: String(item.type || ''),
        bucket: item.bucket || 'before',
        item_date: item.date || null,
        note: String(item.note || ''),
        sort_order: itemIndex,
        deleted_at: null
      });
      Object.entries((scoreState.marks || {})[itemId] || {}).forEach(([studentId, score]) => {
        if (!studentIds.has(String(studentId)) || score === '' || score == null) return;
        put('student_scores', [classroomId, itemId, studentId], {
          teacher_id: teacherId,
          classroom_id: classroomId,
          score_item_id: itemId,
          student_id: String(studentId),
          score: Number(score),
          source: 'teacher',
          deleted_at: null
        });
      });
    });
  });

  (Array.isArray(safeState.timetable) ? safeState.timetable : []).forEach(entry => {
    const dow = Number(entry?.dow);
    const period = Number(entry?.period);
    if (!Number.isInteger(dow) || !Number.isInteger(period)) return;
    put('timetable_entries', ['A', dow, period], {
      teacher_id: teacherId,
      week: 'A',
      day_of_week: dow,
      period,
      classroom_id: entry.classId || null,
      subject_snapshot: String(entry.subject || ''),
      class_name_snapshot: String(entry.className || ''),
      deleted_at: null
    });
  });
  return rows;
}

function relationalDiff(beforeState, afterState, teacherId, email = relationalTeacherEmail) {
  const before = beforeState == null
    ? Object.fromEntries(RELATIONAL_TABLES.map(table => [table, new Map()]))
    : relationalRows(beforeState, teacherId, email);
  const after = relationalRows(afterState || {}, teacherId, email);
  const operations = [];
  const deletedAt = new Date().toISOString();

  RELATIONAL_TABLES.forEach(table => {
    const keyColumns = RELATIONAL_KEYS[table];
    after[table].forEach((nextRow, rowKey) => {
      const oldRow = before[table].get(rowKey);
      if (!oldRow) {
        operations.push({ type: 'upsert', table, row: nextRow });
        return;
      }
      const values = {};
      Object.entries(nextRow).forEach(([column, value]) => {
        if (keyColumns.includes(column) || relationalSame(oldRow[column], value)) return;
        values[column] = value;
      });
      if (Object.keys(values).length) {
        operations.push({
          type: 'update', table,
          key: Object.fromEntries(keyColumns.map(column => [column, nextRow[column]])),
          values
        });
      }
    });
    if (table === 'teacher_profiles') return;
    before[table].forEach((oldRow, rowKey) => {
      if (after[table].has(rowKey)) return;
      operations.push({
        type: 'update', table,
        key: Object.fromEntries(keyColumns.map(column => [column, oldRow[column]])),
        values: { deleted_at: deletedAt }
      });
    });
  });
  return operations;
}

async function relationalApplyOperation(operation) {
  if (!supabaseClient) throw new Error('Supabase client unavailable');
  if (!RELATIONAL_TABLES.includes(operation.table)) throw new Error('Unknown relational table');
  if (operation.type === 'upsert') {
    const { error } = await supabaseClient.from(operation.table).upsert(operation.row, {
      onConflict: RELATIONAL_CONFLICTS[operation.table]
    });
    if (error) throw error;
    return;
  }
  let query = supabaseClient.from(operation.table).update(operation.values);
  Object.entries(operation.key || {}).forEach(([column, value]) => {
    query = query.eq(column, value);
  });
  const { error } = await query;
  if (error) throw error;
}

async function relationalApplyOperations(operations) {
  const list = operations || [];
  for (let index = 0; index < list.length;) {
    const operation = list[index];
    if (operation.type !== 'upsert') {
      await relationalApplyOperation(operation);
      index += 1;
      continue;
    }
    const rows = [];
    const table = operation.table;
    while (index < list.length && list[index].type === 'upsert' && list[index].table === table && rows.length < 200) {
      rows.push(list[index].row);
      index += 1;
    }
    const { error } = await supabaseClient.from(table).upsert(rows, { onConflict: RELATIONAL_CONFLICTS[table] });
    if (error) throw error;
  }
}

async function flushRelationalQueue() {
  if (relationalMode !== 'ready' || !relationalTeacherIdValue || !navigator.onLine) return false;
  const entries = relationalQueueAll();
  for (const entry of entries) {
    await relationalApplyOperations(entry.operations);
    relationalQueueDelete(entry.id);
  }
  return true;
}

function persistRelationalOperations(operations) {
  if (!operations?.length) return Promise.resolve(true);
  const entry = {
    id: relationalOperationId(),
    teacherId: relationalTeacherIdValue,
    createdAt: Date.now(),
    sequence: relationalSequence,
    operations
  };
  let queueError = null;
  try {
    relationalQueuePut(entry);
  } catch (error) {
    queueError = error;
  }
  const write = async () => {
    if (!navigator.onLine) throw new Error('Offline; relational changes retained for retry');
    updateCloudStatus('syncing', 'กำลังบันทึก...');
    if (queueError) {
      await flushRelationalQueue();
      await relationalApplyOperations(operations);
    } else {
      await flushRelationalQueue();
    }
    updateCloudStatus('online', 'บันทึกแล้ว');
    return true;
  };
  const queued = relationalWriteQueue.then(write, write);
  relationalWriteQueue = queued.catch(() => {});
  return queued;
}

function persistRelationalState(nextState, options = {}) {
  if (relationalMode !== 'ready' || !relationalTeacherIdValue) return Promise.resolve(false);
  const target = relationalClone(nextState);
  const before = relationalBaseline;
  const operations = relationalDiff(before, target, relationalTeacherIdValue, relationalTeacherEmail);
  relationalBaseline = target;
  if (!operations.length) return Promise.resolve(true);

  const entry = {
    id: relationalOperationId(),
    teacherId: relationalTeacherIdValue,
    createdAt: Date.now(),
    sequence: relationalSequence,
    operations
  };
  let queueError = null;
  try {
    relationalQueuePut(entry);
  } catch (error) {
    queueError = error;
  }

  const write = async () => {
    if (!navigator.onLine) {
      if (queueError) throw new Error(`Local write queue unavailable: ${queueError.message || queueError}`);
      throw new Error('Offline; relational changes retained for retry');
    }
    updateCloudStatus('syncing', 'กำลังบันทึก...');
    if (queueError) {
      await flushRelationalQueue();
      await relationalApplyOperations(operations);
    }
    else await flushRelationalQueue();
    if (queueError) relationalQueueDelete(entry.id);
    updateCloudStatus('online', 'บันทึกแล้ว');
    return true;
  };
  const queued = relationalWriteQueue.then(write, write);
  relationalWriteQueue = queued.catch(() => {});
  if (options.strict) {
    return queued.catch(error => {
      relationalQueueDelete(entry.id);
      if (relationalSame(relationalBaseline, target)) relationalBaseline = relationalClone(before);
      throw error;
    });
  }
  return queued.catch(error => {
    console.warn('Relational write retained for retry:', error);
    updateCloudStatus('offline', navigator.onLine ? 'บันทึกไม่สำเร็จ' : 'รอบันทึกเมื่อออนไลน์');
    return false;
  });
}

function relationalSchemaMissing(error) {
  return ['42P01', 'PGRST205'].includes(String(error?.code || ''))
    || /teacher_profiles.*(does not exist|schema cache|not find)/i.test(String(error?.message || ''));
}

async function relationalAuthenticatedTeacher() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error('Authenticated teacher required');
  return data.user;
}

async function detectRelationalMode(email) {
  if (!supabaseClient || !email) return relationalMode;
  relationalTeacherEmail = String(email).trim().toLowerCase();
  try {
    const user = await relationalAuthenticatedTeacher();
    relationalTeacherIdValue = user.id;
    const { error } = await supabaseClient.from('teacher_profiles')
      .select('teacher_id').eq('teacher_id', user.id).limit(1);
    if (error) throw error;
    relationalMode = 'ready';
    localStorage.setItem('classkru_relational_v1', '1');
    await flushRelationalQueue();
  } catch (error) {
    if (relationalSchemaMissing(error)) {
      relationalMode = 'legacy';
      localStorage.removeItem('classkru_relational_v1');
    } else {
      console.warn('Relational capability check deferred:', error);
    }
  }
  return relationalMode;
}

function relationalMaxModified(data) {
  let latest = 0;
  RELATIONAL_TABLES.forEach(table => {
    (data[table] || []).forEach(row => {
      const value = Date.parse(row.updated_at || row.created_at || '');
      if (Number.isFinite(value)) latest = Math.max(latest, value);
    });
  });
  return latest;
}

function relationalStateFromRows(data) {
  const profile = (data.teacher_profiles || [])[0];
  if (!profile) return null;
  const state = relationalClone(profile.preferences || {});
  state.teacherName = profile.teacher_name || '';
  if (profile.profile_image_base64) state.profileImageBase64 = profile.profile_image_base64;
  state.periodSettings = profile.period_settings || { startTime: '08:30', duration: 50, breakTime: 0, count: 7 };
  state.onboarding = profile.onboarding || {};
  state.holidays = Array.isArray(profile.holidays) ? profile.holidays : [];
  state.timetableWeek = 'A';
  state.activeWebScreen = profile.active_web_screen || 'dashboard';

  const students = new Map((data.students || []).map(row => [String(row.id), row]));
  const membershipsByClass = new Map();
  (data.classroom_students || []).forEach(row => {
    if (!membershipsByClass.has(String(row.classroom_id))) membershipsByClass.set(String(row.classroom_id), []);
    membershipsByClass.get(String(row.classroom_id)).push(row);
  });
  const attendanceByClass = new Map();
  (data.attendance_records || []).forEach(row => {
    const classId = String(row.classroom_id);
    if (!attendanceByClass.has(classId)) attendanceByClass.set(classId, {});
    const attendance = attendanceByClass.get(classId);
    if (!attendance[row.attendance_date]) attendance[row.attendance_date] = {};
    attendance[row.attendance_date][String(row.student_id)] = row.status;
  });
  const itemsByClass = new Map();
  (data.score_items || []).forEach(row => {
    const classId = String(row.classroom_id);
    if (!itemsByClass.has(classId)) itemsByClass.set(classId, []);
    itemsByClass.get(classId).push(row);
  });
  const marksByItem = new Map();
  (data.student_scores || []).forEach(row => {
    const key = relationalKey([row.classroom_id, row.score_item_id]);
    if (!marksByItem.has(key)) marksByItem.set(key, {});
    marksByItem.get(key)[String(row.student_id)] = Number(row.score);
  });

  state.classes = (data.classrooms || [])
    .slice().sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map(classroom => {
      const classId = String(classroom.id);
      const gradeOverride = {};
      const classStudents = (membershipsByClass.get(classId) || [])
        .slice().sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
        .map(membership => {
          const student = students.get(String(membership.student_id));
          if (!student) return null;
          if (membership.grade_override) gradeOverride[String(student.id)] = membership.grade_override;
          const result = {
            id: String(student.id),
            name: student.name || '',
            no: membership.student_no,
            studentCode: student.student_code || '',
            nickname: student.nickname || '',
            comment: student.comment || '',
            score: student.legacy_score == null ? 0 : Number(student.legacy_score)
          };
          if (student.photo_base64) result.photoBase64 = student.photo_base64;
          return result;
        }).filter(Boolean);
      const items = (itemsByClass.get(classId) || [])
        .slice().sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
        .map(item => ({
          id: String(item.id), name: item.name || '', max: Number(item.max_score),
          type: item.item_type || '', bucket: item.bucket || 'before',
          date: item.item_date || '', note: item.note || ''
        }));
      return {
        id: classId,
        subject: classroom.subject || '',
        className: classroom.class_name || '',
        academicYear: classroom.academic_year,
        gradeLevel: classroom.grade_level,
        colorIndex: classroom.color_index,
        students: classStudents,
        attendance: attendanceByClass.get(classId) || {},
        notes: classroom.notes || {},
        extraDays: classroom.extra_days || {},
        scores: {
          config: classroom.score_config || {},
          items,
          marks: Object.fromEntries(items.map(item => [item.id, marksByItem.get(relationalKey([classId, item.id])) || {}])),
          gradeOverride
        }
      };
    });

  state.timetable = (data.timetable_entries || [])
    .slice().sort((a, b) => Number(a.day_of_week) - Number(b.day_of_week) || Number(a.period) - Number(b.period))
    .map(entry => ({
      week: 'A', dow: Number(entry.day_of_week), period: Number(entry.period),
      classId: entry.classroom_id || '', subject: entry.subject_snapshot || '',
      className: entry.class_name_snapshot || ''
    }));
  state.lastModified = relationalMaxModified(data);
  return state;
}

async function relationalFetchTable(table, pageSize = 1000) {
  const rows = [];
  for (let from = 0;; from += pageSize) {
    const { data, error } = await supabaseClient.from(table).select('*')
      .eq('teacher_id', relationalTeacherIdValue).is('deleted_at', null)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function relationalFetchRows() {
  const results = await Promise.all(RELATIONAL_TABLES.map(table => relationalFetchTable(table)));
  return Object.fromEntries(RELATIONAL_TABLES.map((table, index) => [table, results[index]]));
}

async function loadRelationalState() {
  const data = await relationalFetchRows();
  const state = relationalStateFromRows(data);
  if (state) relationalBaseline = relationalClone(state);
  return state;
}

async function seedRelationalState(state) {
  relationalBaseline = null;
  await persistRelationalState(state, { strict: true });
  return loadRelationalState();
}

function initializeRelationalBaseline(state, email) {
  relationalBaseline = relationalClone(state || {});
  if (email) relationalTeacherEmail = String(email).trim().toLowerCase();
}

function probeRelationalAfterLegacySave(email) {
  if (!email || relationalMode !== 'legacy' || !navigator.onLine) return;
  const now = Date.now();
  if (relationalLegacyProbePromise || now - relationalLegacyProbeAt < 30000) return;
  relationalLegacyProbeAt = now;
  relationalLegacyProbePromise = trySyncRelationalState(email)
    .catch(error => console.warn('Relational activation deferred:', error))
    .finally(() => { relationalLegacyProbePromise = null; });
}

async function trySyncRelationalState(email) {
  if (!supabaseClient) return false;
  const localStateBeforeSync = relationalClone(appState);
  const localBaselineBeforeSync = relationalClone(relationalBaseline);
  await detectRelationalMode(email);
  if (relationalMode !== 'ready') return false;
  try {
    updateCloudStatus('syncing', 'กำลังตรวจข้อมูลล่าสุด...');
    let state = await loadRelationalState();
    if (!state) {
      const { data: legacy, error } = await supabaseClient.from('classmanager_profiles')
        .select('state').eq('email', email).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      const legacyState = legacy?.state;
      const localState = relationalClone(appState);
      const source = legacyState && ((legacyState.lastModified || 0) >= (localState.lastModified || 0)
        || ((legacyState.classes || []).length && !(localState.classes || []).length))
        ? legacyState : localState;
      state = await seedRelationalState(source || {});
    } else {
      const cutoverKey = `classkru_relational_cutover_v1_${relationalTeacherIdValue}`;
      if (localStorage.getItem(cutoverKey) !== '1') {
        const { data: legacy, error } = await supabaseClient.from('classmanager_profiles')
          .select('state').eq('email', email).maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        if ((legacy?.state?.lastModified || 0) > (state.lastModified || 0)) {
          const legacyOperations = relationalDiff(state, legacy.state, relationalTeacherIdValue, relationalTeacherEmail);
          await persistRelationalOperations(legacyOperations);
          state = await loadRelationalState();
        }
        localStorage.setItem(cutoverKey, '1');
      }

      // Preserve edits made in this tab while capability detection/loading was in progress.
      if (localBaselineBeforeSync && !relationalSame(localBaselineBeforeSync, localStateBeforeSync)) {
        const pendingOperations = relationalDiff(
          localBaselineBeforeSync, localStateBeforeSync,
          relationalTeacherIdValue, relationalTeacherEmail
        );
        await persistRelationalOperations(pendingOperations);
        state = await loadRelationalState();
      }
    }
    appState = state;
    appState.classes = Array.isArray(appState.classes) ? appState.classes : [];
    appState.timetable = normalizeTimetableEntries(appState.timetable);
    appState.timetableWeek = 'A';
    pruneEmptyAttendance();
    saveStateLocalOnly(false);
    updateProfileImages();
    navigateToWebScreen(pendingDeepLink || appState.activeWebScreen || 'dashboard', pendingDeepLinkParam);
    updateCloudStatus('online', 'ข้อมูลเป็นปัจจุบัน');
    return true;
  } catch (error) {
    console.warn('Relational sync failed:', error);
    updateCloudStatus('offline', navigator.onLine ? 'บันทึกไม่สำเร็จ' : 'รอบันทึกเมื่อออนไลน์');
    return true;
  }
}

async function forcePullRelationalState() {
  if (relationalMode !== 'ready') return false;
  await flushRelationalQueue();
  const state = await loadRelationalState();
  if (!state) return false;
  appState = state;
  saveStateLocalOnly(false);
  return true;
}

window.addEventListener('online', () => {
  if (relationalMode !== 'ready') return;
  relationalWriteQueue = relationalWriteQueue
    .then(() => flushRelationalQueue())
    .then(() => updateCloudStatus('online', 'บันทึกแล้ว'))
    .catch(error => {
      console.warn('Relational retry failed:', error);
      updateCloudStatus('offline', 'บันทึกไม่สำเร็จ');
    });
});
