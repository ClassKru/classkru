// Hybrid persistence: high-write classroom data is relational; settings and legacy fallback stay in JSON.
let relationalReady = false;
let relationalBaseline = null;
let relationalWriteQueue = Promise.resolve();
const RELATIONAL_QUEUE_DB = 'classkru_hybrid_queue_v1';
const RELATIONAL_TABLES = ['classrooms', 'students', 'classroom_students', 'score_items', 'student_scores', 'attendance_records'];

function relationalClone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}
function relationalKey(parts) { return parts.map(v => String(v ?? '')).join('\u001f'); }
function relationalSame(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function relationalOperationId() {
  return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function relationalTeacherId() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) throw error;
  return data?.user?.id || null;
}

function relationalRows(state, teacherId) {
  const rows = Object.fromEntries(RELATIONAL_TABLES.map(table => [table, new Map()]));
  const put = (table, key, row) => rows[table].set(key, row);
  (state.classes || []).forEach(c => {
    if (!c?.id) return;
    put('classrooms', relationalKey([c.id]), {
      teacher_id: teacherId, id: String(c.id), subject: String(c.subject || ''), class_name: String(c.className || ''),
      academic_year: c.academicYear == null ? null : Number(c.academicYear), grade_level: c.gradeLevel || null,
      color_index: c.colorIndex == null ? null : Number(c.colorIndex), deleted_at: null
    });
    (c.students || []).forEach(s => {
      if (!s?.id) return;
      put('students', relationalKey([s.id]), {
        teacher_id: teacherId, id: String(s.id), name: String(s.name || ''), student_code: String(s.studentCode || ''),
        nickname: String(s.nickname || ''), comment: String(s.comment || ''), photo_base64: s.photoBase64 || null, deleted_at: null
      });
      put('classroom_students', relationalKey([c.id, s.id]), {
        teacher_id: teacherId, classroom_id: String(c.id), student_id: String(s.id),
        student_no: s.no == null || s.no === '' ? null : Number(s.no), deleted_at: null
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
    const scores = c.scores || {};
    (scores.items || []).forEach(item => {
      if (!item?.id) return;
      put('score_items', relationalKey([item.id]), {
        teacher_id: teacherId, id: String(item.id), classroom_id: String(c.id), name: String(item.name || ''),
        max_score: Number(item.max), item_type: String(item.type || ''), bucket: item.bucket || 'before',
        item_date: item.date || null, note: String(item.note || ''), deleted_at: null
      });
      Object.entries((scores.marks || {})[item.id] || {}).forEach(([studentId, score]) => {
        if (score === '' || score == null) return;
        put('student_scores', relationalKey([item.id, studentId]), {
          teacher_id: teacherId, score_item_id: String(item.id), student_id: String(studentId),
          score: Number(score), source: 'teacher', deleted_at: null
        });
      });
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

// Only low-write JSON-owned fields are compared here. Score values and attendance never trigger a whole-state upload.
function hybridLegacyView(state) {
  const copy = relationalClone(state || {});
  copy.classes = (copy.classes || []).map(c => ({
    id: c.id, notes: c.notes || {}, extraDays: c.extraDays || {},
    studentIds: (c.students || []).map(s => s.id), scoreItemIds: (c.scores?.items || []).map(i => i.id),
    scoreConfig: c.scores?.config || null, gradeOverride: c.scores?.gradeOverride || {}
  }));
  delete copy.lastModified;
  delete copy.scoreAuditHistory;
  return copy;
}
function hybridLegacyChanged(before, after) {
  return !relationalSame(hybridLegacyView(before), hybridLegacyView(after));
}

const RELATIONAL_CONFLICTS = {
  classrooms: 'teacher_id,id', students: 'teacher_id,id',
  classroom_students: 'teacher_id,classroom_id,student_id', score_items: 'teacher_id,id',
  student_scores: 'teacher_id,score_item_id,student_id',
  attendance_records: 'teacher_id,classroom_id,student_id,attendance_date'
};
async function relationalApply(changes) {
  for (const table of RELATIONAL_TABLES) {
    const rows = changes[table];
    if (!rows?.length) continue;
    for (let index = 0; index < rows.length; index += 250) {
      const { error } = await supabaseClient.from(table).upsert(rows.slice(index, index + 250), { onConflict: RELATIONAL_CONFLICTS[table] });
      if (error) throw error;
    }
  }
}

function relationalDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return resolve(null);
    const request = indexedDB.open(RELATIONAL_QUEUE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('writes', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function relationalQueuePut(entry) {
  const db = await relationalDb(); if (!db) return;
  await new Promise((resolve, reject) => { const request = db.transaction('writes', 'readwrite').objectStore('writes').put(entry); request.onsuccess = resolve; request.onerror = () => reject(request.error); });
  db.close();
}
async function relationalQueueDelete(id) {
  const db = await relationalDb(); if (!db) return;
  await new Promise((resolve, reject) => { const request = db.transaction('writes', 'readwrite').objectStore('writes').delete(id); request.onsuccess = resolve; request.onerror = () => reject(request.error); });
  db.close();
}
async function relationalQueueAll() {
  const db = await relationalDb(); if (!db) return [];
  const rows = await new Promise((resolve, reject) => { const request = db.transaction('writes').objectStore('writes').getAll(); request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error); });
  db.close(); return rows.sort((a, b) => a.createdAt - b.createdAt);
}
async function flushRelationalQueue() {
  if (!relationalReady || !navigator.onLine) return;
  for (const entry of await relationalQueueAll()) { await relationalApply(entry.changes); await relationalQueueDelete(entry.id); }
}

async function persistRelationalState(nextState, options = {}) {
  if (!relationalReady) return false;
  const target = relationalClone(nextState);
  const teacherId = await relationalTeacherId();
  if (!teacherId) throw new Error('Authenticated teacher required');
  const before = relationalBaseline || {};
  const changes = relationalDiff(before, target, teacherId);
  relationalBaseline = target;
  if (!Object.keys(changes).length) return true;
  const entry = { id: relationalOperationId(), createdAt: Date.now(), changes };
  await relationalQueuePut(entry);
  const write = async () => {
    updateCloudStatus('syncing', 'กำลังบันทึก...');
    await relationalApply(changes); await relationalQueueDelete(entry.id);
    updateCloudStatus('online', 'บันทึกแล้ว'); return true;
  };
  const queued = relationalWriteQueue.then(write, write);
  relationalWriteQueue = queued.catch(() => {});
  if (options.strict) return queued.catch(async error => { await relationalQueueDelete(entry.id); relationalBaseline = relationalClone(before); throw error; });
  queued.catch(error => { console.warn('Hybrid write queued for retry:', error); updateCloudStatus('offline', 'รอบันทึกเมื่อออนไลน์'); });
  return true;
}

function relationalSchemaMissing(error) {
  return ['42P01', 'PGRST205'].includes(String(error?.code || '')) || /does not exist|schema cache/i.test(String(error?.message || ''));
}

function overlayRelationalState(baseState, data) {
  const state = relationalClone(baseState || {});
  const legacyClasses = new Map((state.classes || []).map(c => [String(c.id), c]));
  const students = new Map(data.students.map(s => [s.id, s]));
  const memberships = new Map();
  data.classroom_students.forEach(m => {
    if (!memberships.has(m.classroom_id)) memberships.set(m.classroom_id, []);
    const s = students.get(m.student_id);
    if (s) memberships.get(m.classroom_id).push({ id: s.id, name: s.name, no: m.student_no,
      studentCode: s.student_code, nickname: s.nickname, comment: s.comment,
      ...(s.photo_base64 ? { photoBase64: s.photo_base64 } : {}) });
  });
  const attendance = new Map();
  data.attendance_records.forEach(r => {
    if (!attendance.has(r.classroom_id)) attendance.set(r.classroom_id, {});
    const dates = attendance.get(r.classroom_id); if (!dates[r.attendance_date]) dates[r.attendance_date] = {};
    dates[r.attendance_date][r.student_id] = r.status;
  });
  const items = new Map();
  data.score_items.forEach(i => {
    if (!items.has(i.classroom_id)) items.set(i.classroom_id, []);
    items.get(i.classroom_id).push({ id: i.id, name: i.name, max: Number(i.max_score), type: i.item_type,
      bucket: i.bucket, date: i.item_date || '', note: i.note || '' });
  });
  const marks = new Map();
  data.student_scores.forEach(s => { if (!marks.has(s.score_item_id)) marks.set(s.score_item_id, {}); marks.get(s.score_item_id)[s.student_id] = Number(s.score); });
  state.classes = data.classrooms.map(row => {
    const legacy = legacyClasses.get(row.id) || {};
    const classItems = items.get(row.id) || [];
    return { ...legacy, id: row.id, subject: row.subject, className: row.class_name, academicYear: row.academic_year,
      gradeLevel: row.grade_level, colorIndex: row.color_index,
      students: (memberships.get(row.id) || []).sort((a,b)=>(a.no||0)-(b.no||0)),
      attendance: attendance.get(row.id) || {},
      scores: { config: legacy.scores?.config, items: classItems,
        marks: Object.fromEntries(classItems.map(i => [i.id, marks.get(i.id) || {}])),
        gradeOverride: legacy.scores?.gradeOverride || {} }, notes: legacy.notes || {}, extraDays: legacy.extraDays || {} };
  });
  state.lastModified = Date.now();
  return state;
}

async function loadRelationalState(baseState) {
  const results = await Promise.all(RELATIONAL_TABLES.map(table => supabaseClient.from(table).select('*').is('deleted_at', null)));
  const failed = results.find(result => result.error); if (failed) throw failed.error;
  const data = Object.fromEntries(RELATIONAL_TABLES.map((table, index) => [table, results[index].data || []]));
  const state = overlayRelationalState(baseState, data);
  relationalBaseline = relationalClone(state);
  return state;
}

async function trySyncRelationalState(email) {
  if (!supabaseClient) return false;
  try {
    const { data: migration, error } = await supabaseClient.from('legacy_state_migrations').select('status').maybeSingle();
    if (error) throw error;
    if (migration?.status !== 'completed') return false;
    relationalReady = true;
    await flushRelationalQueue();
    const { data: legacy } = await supabaseClient.from('classmanager_profiles').select('state').eq('email', email).maybeSingle();
    const cloudState = legacy?.state || {};
    const base = (appState.lastModified || 0) > (cloudState.lastModified || 0) ? appState : cloudState;
    appState = await loadRelationalState(base);
    saveStateLocalOnly(false);
    updateCloudStatus('online', 'ข้อมูลเป็นปัจจุบัน');
    return true;
  } catch (error) {
    if (!relationalSchemaMissing(error)) console.warn('Hybrid load failed:', error);
    relationalReady = false; return false;
  }
}

async function migrateCurrentStateToRelational() {
  if (!supabaseClient || relationalReady) return false;
  try {
    const teacherId = await relationalTeacherId(); if (!teacherId) return false;
    updateCloudStatus('syncing', 'กำลังเตรียมการบันทึกแบบใหม่...');
    const changes = relationalDiff({}, appState, teacherId);
    await relationalApply(changes);
    const source = JSON.stringify(appState); let hash = 2166136261;
    for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
    const { error } = await supabaseClient.from('legacy_state_migrations').upsert({ teacher_id: teacherId,
      source_hash: (hash >>> 0).toString(16), status: 'completed',
      row_counts: Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value.length])),
      completed_at: new Date().toISOString(), error_message: null });
    if (error) throw error;
    relationalBaseline = relationalClone(appState); relationalReady = true;
    updateCloudStatus('online', 'บันทึกแล้ว'); return true;
  } catch (error) {
    if (!relationalSchemaMissing(error)) console.warn('Hybrid migration deferred:', error);
    return false;
  }
}
window.addEventListener('online', () => flushRelationalQueue().catch(error => console.warn(error)));
