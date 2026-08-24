// ClassKru relational persistence. The legacy JSON remains a read fallback during rollout.
let relationalReady = false;
let relationalBaseline = null;
let relationalWriteQueue = Promise.resolve();
const RELATIONAL_QUEUE_DB = 'classkru_relational_queue_v1';
const RELATIONAL_TABLES = [
  'teacher_profiles', 'teacher_settings', 'classrooms', 'students', 'classroom_students',
  'timetable_entries', 'classroom_extra_days', 'attendance_records', 'classroom_score_settings',
  'score_items', 'student_scores', 'student_grade_overrides'
];

function relationalClone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function relationalKey(parts) { return parts.map(v => String(v ?? '')).join('\u001f'); }
function relationalSame(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

async function relationalTeacherId() {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) throw error;
  return data?.user?.id || null;
}

function relationalRows(state, teacherId) {
  const now = new Date().toISOString();
  const rows = Object.fromEntries(RELATIONAL_TABLES.map(t => [t, new Map()]));
  const put = (table, key, row) => rows[table].set(key, row);
  const ps = state.periodSettings || {};
  put('teacher_profiles', teacherId, {
    teacher_id: teacherId, display_name: String(state.teacherName || ''),
    profile_image_path: null, legacy_profile_base64: state.profileImageBase64 || null, deleted_at: null
  });
  put('teacher_settings', teacherId, {
    teacher_id: teacherId, period_start_time: ps.startTime || '08:30',
    period_duration: Number(ps.duration) || 50, period_break_time: Number(ps.breakTime) || 0,
    period_count: Number(ps.count) || 7, onboarding_done: Boolean(state.onboarding?.done),
    holidays: Array.isArray(state.holidays) ? state.holidays : []
  });

  (state.classes || []).forEach(c => {
    if (!c?.id) return;
    put('classrooms', relationalKey([c.id]), {
      teacher_id: teacherId, id: String(c.id), subject: String(c.subject || ''),
      class_name: String(c.className || ''), academic_year: c.academicYear == null ? null : Number(c.academicYear),
      grade_level: c.gradeLevel || null, color_index: c.colorIndex == null ? null : Number(c.colorIndex),
      legacy_notes: c.notes || {}, deleted_at: null
    });
    (c.students || []).forEach(s => {
      if (!s?.id) return;
      put('students', relationalKey([s.id]), {
        teacher_id: teacherId, id: String(s.id), name: String(s.name || ''),
        student_code: String(s.studentCode || ''), nickname: String(s.nickname || ''),
        comment: String(s.comment || ''), photo_path: null,
        legacy_photo_base64: s.photoBase64 || null, deleted_at: null
      });
      put('classroom_students', relationalKey([c.id, s.id]), {
        teacher_id: teacherId, classroom_id: String(c.id), student_id: String(s.id),
        student_no: s.no == null || s.no === '' ? null : Number(s.no), deleted_at: null
      });
    });
    Object.entries(c.extraDays || {}).forEach(([date, enabled]) => {
      if (enabled) put('classroom_extra_days', relationalKey([c.id, date]), {
        teacher_id: teacherId, classroom_id: String(c.id), extra_date: date, deleted_at: null
      });
    });
    Object.entries(c.attendance || {}).forEach(([date, marks]) => {
      Object.entries(marks || {}).forEach(([studentId, status]) => {
        if (!status) return;
        put('attendance_records', relationalKey([c.id, studentId, date]), {
          teacher_id: teacherId, classroom_id: String(c.id), student_id: String(studentId),
          attendance_date: date, status, source: 'teacher', deleted_at: null
        });
      });
    });
    const sc = c.scores;
    if (sc) {
      const cfg = sc.config || {};
      const ratio = cfg.ratio || { before: 40, after: 30, mid: 10, final: 20 };
      put('classroom_score_settings', relationalKey([c.id]), {
        teacher_id: teacherId, classroom_id: String(c.id), ratio_before: Number(ratio.before) || 0,
        ratio_after: Number(ratio.after) || 0, ratio_mid: Number(ratio.mid) || 0,
        ratio_final: Number(ratio.final) || 0, attendance_min: Number(cfg.attendanceMin) || 0,
        grade_cut: cfg.gradeCut || []
      });
      (sc.items || []).forEach(item => {
        if (!item?.id) return;
        put('score_items', relationalKey([item.id]), {
          teacher_id: teacherId, id: String(item.id), classroom_id: String(c.id), name: String(item.name || ''),
          max_score: Number(item.max), item_type: String(item.type || ''), bucket: item.bucket || 'before',
          item_date: item.date || null, note: String(item.note || ''), deleted_at: null
        });
        Object.entries((sc.marks || {})[item.id] || {}).forEach(([studentId, score]) => {
          if (score === '' || score == null) return;
          put('student_scores', relationalKey([item.id, studentId]), {
            teacher_id: teacherId, score_item_id: String(item.id), student_id: String(studentId),
            score: Number(score), source: 'teacher', deleted_at: null
          });
        });
      });
      Object.entries(sc.gradeOverride || {}).forEach(([studentId, grade]) => {
        if (!grade) return;
        put('student_grade_overrides', relationalKey([c.id, studentId]), {
          teacher_id: teacherId, classroom_id: String(c.id), student_id: String(studentId), grade: String(grade), deleted_at: null
        });
      });
    }
  });
  (state.timetable || []).forEach(t => {
    if (!t) return;
    const week = t.week === 'B' ? 'B' : 'A';
    put('timetable_entries', relationalKey([t.dow, t.period, week]), {
      teacher_id: teacherId, classroom_id: t.classId ? String(t.classId) : null, day_of_week: Number(t.dow),
      period: Number(t.period), week_code: week, subject_snapshot: String(t.subject || ''),
      class_name_snapshot: String(t.className || ''), deleted_at: null
    });
  });
  return rows;
}

function relationalDiff(before, after, teacherId) {
  const oldRows = relationalRows(before || {}, teacherId);
  const newRows = relationalRows(after || {}, teacherId);
  const changes = {};
  RELATIONAL_TABLES.forEach(table => {
    const list = [];
    newRows[table].forEach((row, key) => {
      if (!oldRows[table].has(key) || !relationalSame(oldRows[table].get(key), row)) list.push(row);
    });
    oldRows[table].forEach((row, key) => {
      if (!newRows[table].has(key)) list.push({ ...row, deleted_at: new Date().toISOString() });
    });
    if (list.length) changes[table] = list;
  });
  return changes;
}

const RELATIONAL_CONFLICTS = {
  teacher_profiles: 'teacher_id', teacher_settings: 'teacher_id', classrooms: 'teacher_id,id',
  students: 'teacher_id,id', classroom_students: 'teacher_id,classroom_id,student_id',
  timetable_entries: 'teacher_id,day_of_week,period,week_code',
  classroom_extra_days: 'teacher_id,classroom_id,extra_date',
  attendance_records: 'teacher_id,classroom_id,student_id,attendance_date',
  classroom_score_settings: 'teacher_id,classroom_id', score_items: 'teacher_id,id',
  student_scores: 'teacher_id,score_item_id,student_id',
  student_grade_overrides: 'teacher_id,classroom_id,student_id'
};

async function relationalApply(changes) {
  // Dependency order is deliberate; soft deletes are updates and remain recoverable.
  for (const table of RELATIONAL_TABLES) {
    const rows = changes[table];
    if (!rows?.length) continue;
    for (let i = 0; i < rows.length; i += 250) {
      const { error } = await supabaseClient.from(table).upsert(rows.slice(i, i + 250), { onConflict: RELATIONAL_CONFLICTS[table] });
      if (error) throw error;
    }
  }
}

function relationalDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return resolve(null);
    const req = indexedDB.open(RELATIONAL_QUEUE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('writes', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function relationalQueuePut(entry) {
  const db = await relationalDb();
  if (!db) return;
  await new Promise((resolve, reject) => {
    const req = db.transaction('writes', 'readwrite').objectStore('writes').put(entry);
    req.onsuccess = resolve; req.onerror = () => reject(req.error);
  });
  db.close();
}

async function relationalQueueDelete(id) {
  const db = await relationalDb();
  if (!db) return;
  await new Promise((resolve, reject) => {
    const req = db.transaction('writes', 'readwrite').objectStore('writes').delete(id);
    req.onsuccess = resolve; req.onerror = () => reject(req.error);
  });
  db.close();
}

async function relationalQueueAll() {
  const db = await relationalDb();
  if (!db) return [];
  const rows = await new Promise((resolve, reject) => {
    const req = db.transaction('writes').objectStore('writes').getAll();
    req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error);
  });
  db.close();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

async function flushRelationalQueue() {
  if (!relationalReady || !navigator.onLine) return;
  for (const item of await relationalQueueAll()) {
    await relationalApply(item.changes);
    await relationalQueueDelete(item.id);
  }
}

async function persistRelationalState(nextState, options = {}) {
  if (!relationalReady) return false;
  const targetState = relationalClone(nextState);
  const teacherId = await relationalTeacherId();
  if (!teacherId) throw new Error('Authenticated teacher required');
  const before = relationalBaseline || {};
  const changes = relationalDiff(before, targetState, teacherId);
  relationalBaseline = targetState;
  if (!Object.keys(changes).length) return true;
  const entry = { id: crypto.randomUUID(), createdAt: Date.now(), changes };
  await relationalQueuePut(entry);
  const write = async () => {
    updateCloudStatus('syncing', 'กำลังบันทึก...');
    await relationalApply(changes);
    await relationalQueueDelete(entry.id);
    updateCloudStatus('online', 'บันทึกแล้ว');
    return true;
  };
  const queued = relationalWriteQueue.then(write, write);
  relationalWriteQueue = queued.catch(() => {});
  if (options.strict) return queued.catch(async error => {
    await relationalQueueDelete(entry.id);
    relationalBaseline = relationalClone(before);
    throw error;
  });
  queued.catch(err => {
    console.warn('Relational write queued for retry:', err);
    updateCloudStatus('offline', 'รอบันทึกเมื่อออนไลน์');
  });
  return true;
}

function relationalSchemaMissing(error) {
  return ['42P01', 'PGRST205', '42883'].includes(String(error?.code || '')) || /does not exist|schema cache/i.test(String(error?.message || ''));
}

async function loadRelationalState() {
  const teacherId = await relationalTeacherId();
  const queries = RELATIONAL_TABLES.map(table => {
    let q = supabaseClient.from(table).select('*');
    if (!['teacher_settings', 'classroom_score_settings'].includes(table)) q = q.is('deleted_at', null);
    return q;
  });
  const results = await Promise.all(queries);
  const failed = results.find(r => r.error);
  if (failed) throw failed.error;
  const data = Object.fromEntries(RELATIONAL_TABLES.map((t, i) => [t, results[i].data || []]));
  const profile = data.teacher_profiles[0];
  const settings = data.teacher_settings[0];
  const state = {
    classes: [], timetable: [], timetableWeek: 'A', activeWebScreen: appState.activeWebScreen || 'dashboard',
    holidays: settings?.holidays || appState.holidays || [], lastModified: Date.now()
  };
  state.teacherName = profile?.display_name || '';
  if (profile?.legacy_profile_base64) state.profileImageBase64 = profile.legacy_profile_base64;
  state.periodSettings = {
    startTime: String(settings?.period_start_time || '08:30').slice(0, 5), duration: settings?.period_duration || 50,
    breakTime: settings?.period_break_time || 0, count: settings?.period_count || 7
  };
  state.onboarding = { done: Boolean(settings?.onboarding_done) };
  const students = new Map(data.students.map(s => [s.id, s]));
  const memberships = new Map();
  data.classroom_students.forEach(m => {
    if (!memberships.has(m.classroom_id)) memberships.set(m.classroom_id, []);
    const s = students.get(m.student_id);
    if (s) memberships.get(m.classroom_id).push({ id: s.id, name: s.name, no: m.student_no,
      studentCode: s.student_code, nickname: s.nickname, comment: s.comment,
      ...(s.legacy_photo_base64 ? { photoBase64: s.legacy_photo_base64 } : {}) });
  });
  const attendance = new Map();
  data.attendance_records.forEach(r => {
    if (!attendance.has(r.classroom_id)) attendance.set(r.classroom_id, {});
    const byDate = attendance.get(r.classroom_id);
    if (!byDate[r.attendance_date]) byDate[r.attendance_date] = {};
    byDate[r.attendance_date][r.student_id] = r.status;
  });
  const extras = new Map();
  data.classroom_extra_days.forEach(r => {
    if (!extras.has(r.classroom_id)) extras.set(r.classroom_id, {});
    extras.get(r.classroom_id)[r.extra_date] = true;
  });
  const scoreSettings = new Map(data.classroom_score_settings.map(s => [s.classroom_id, s]));
  const scoreItems = new Map();
  data.score_items.forEach(i => {
    if (!scoreItems.has(i.classroom_id)) scoreItems.set(i.classroom_id, []);
    scoreItems.get(i.classroom_id).push({ id: i.id, name: i.name, max: Number(i.max_score), type: i.item_type,
      bucket: i.bucket, date: i.item_date || '', note: i.note || '' });
  });
  const marks = new Map();
  data.student_scores.forEach(s => {
    if (!marks.has(s.score_item_id)) marks.set(s.score_item_id, {});
    marks.get(s.score_item_id)[s.student_id] = Number(s.score);
  });
  const overrides = new Map();
  data.student_grade_overrides.forEach(g => {
    if (!overrides.has(g.classroom_id)) overrides.set(g.classroom_id, {});
    overrides.get(g.classroom_id)[g.student_id] = g.grade;
  });
  state.classes = data.classrooms.map(c => {
    const cfg = scoreSettings.get(c.id);
    const items = scoreItems.get(c.id) || [];
    return { id: c.id, subject: c.subject, className: c.class_name, academicYear: c.academic_year,
      gradeLevel: c.grade_level, colorIndex: c.color_index, students: (memberships.get(c.id) || []).sort((a,b)=>(a.no||0)-(b.no||0)),
      attendance: attendance.get(c.id) || {}, extraDays: extras.get(c.id) || {}, notes: c.legacy_notes || {},
      scores: { config: { ratio: { before: Number(cfg?.ratio_before ?? 40), after: Number(cfg?.ratio_after ?? 30),
        mid: Number(cfg?.ratio_mid ?? 10), final: Number(cfg?.ratio_final ?? 20) },
        attendanceMin: Number(cfg?.attendance_min ?? 60), gradeCut: cfg?.grade_cut || [] },
        items, marks: Object.fromEntries(items.map(i => [i.id, marks.get(i.id) || {}])), gradeOverride: overrides.get(c.id) || {} }
    };
  });
  state.timetable = data.timetable_entries.map(t => ({ dow: t.day_of_week, period: t.period,
    classId: t.classroom_id || '', subject: t.subject_snapshot, className: t.class_name_snapshot, week: t.week_code }));
  relationalBaseline = relationalClone(state);
  return state;
}

async function trySyncRelationalState() {
  if (!supabaseClient) return false;
  try {
    const { data, error } = await supabaseClient.from('legacy_state_migrations').select('status').maybeSingle();
    if (error) throw error;
    if (data?.status !== 'completed') return false;
    relationalReady = true;
    await flushRelationalQueue();
    appState = await loadRelationalState();
    saveStateLocalOnly(false);
    updateCloudStatus('online', 'ข้อมูลเป็นปัจจุบัน');
    return true;
  } catch (error) {
    if (!relationalSchemaMissing(error)) console.warn('Relational load failed:', error);
    return false;
  }
}

async function migrateCurrentStateToRelational() {
  if (!supabaseClient || relationalReady) return false;
  try {
    const teacherId = await relationalTeacherId();
    if (!teacherId) return false;
    updateCloudStatus('syncing', 'กำลังเตรียมข้อมูลรูปแบบใหม่...');
    const changes = relationalDiff({}, appState, teacherId);
    await relationalApply(changes);
    const source = JSON.stringify(appState);
    let hash = 2166136261;
    for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
    const counts = Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.length]));
    const { error } = await supabaseClient.from('legacy_state_migrations').upsert({
      teacher_id: teacherId, source_hash: (hash >>> 0).toString(16), status: 'completed',
      row_counts: counts, completed_at: new Date().toISOString(), error_message: null
    });
    if (error) throw error;
    relationalBaseline = relationalClone(appState);
    relationalReady = true;
    updateCloudStatus('online', 'บันทึกแล้ว');
    return true;
  } catch (error) {
    if (!relationalSchemaMissing(error)) console.warn('Relational migration deferred:', error);
    return false;
  }
}

window.addEventListener('online', () => flushRelationalQueue().catch(err => console.warn(err)));
