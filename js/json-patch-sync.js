// Granular persistence for classmanager_profiles.state.
// The canonical data remains one JSON document; only changed logical cells are sent to PostgreSQL.
let jsonPatchMode = localStorage.getItem('classkru_json_patch_v1') === '1' ? 'ready' : 'unknown';
let jsonPatchBaseline = null;
let jsonPatchTeacherKey = '';
let jsonPatchWriteQueue = Promise.resolve();
let jsonPatchSequence = 0;
const JSON_PATCH_QUEUE_DB = 'classkru_json_patch_queue_v1';
const JSON_PATCH_QUEUE_FALLBACK_KEY = 'classkru_json_patch_queue_fallback_v1';
const JSON_PATCH_TOP_KEYS = [
  'teacherName', 'profileImageBase64', 'onboarding',
  'holidays', 'timetableWeek', 'activeWebScreen'
];
const JSON_PATCH_CLASS_FIELDS = [
  'subject', 'className', 'academicYear', 'gradeLevel', 'colorIndex'
];
const JSON_PATCH_STUDENT_FIELDS = ['name', 'no', 'studentCode', 'nickname', 'comment', 'score', 'photoBase64'];
const JSON_PATCH_SCORE_ITEM_FIELDS = ['name', 'max', 'type', 'bucket', 'date', 'note'];
const JSON_PATCH_PERIOD_FIELDS = ['startTime', 'duration', 'breakTime', 'count'];
const JSON_PATCH_SCORE_CONFIG_FIELDS = ['attendanceMin', 'gradeCut'];
const JSON_PATCH_SCORE_BUCKETS = ['before', 'after', 'mid', 'final'];

function jsonPatchClone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function jsonPatchSame(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function jsonPatchId(prefix) {
  return globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${prefix}_${Date.now()}_${++jsonPatchSequence}_${Math.random().toString(36).slice(2)}`;
}

function jsonPatchMap(rows) {
  return new Map((Array.isArray(rows) ? rows : []).filter(row => row?.id != null).map(row => [String(row.id), row]));
}

function jsonPatchTimetableMap(rows) {
  return new Map((Array.isArray(rows) ? rows : []).map(row => [`${Number(row?.dow)}:${Number(row?.period)}`, row]));
}

function jsonPatchFallbackRows() {
  try {
    const rows = JSON.parse(localStorage.getItem(JSON_PATCH_QUEUE_FALLBACK_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch (_) {
    return [];
  }
}

function jsonPatchPushValueOperation(operations, kind, identity, before, after) {
  if (jsonPatchSame(before, after)) return;
  operations.push(after === undefined ? { kind: `unset_${kind}`, ...identity } : { kind: `set_${kind}`, ...identity, value: after });
}

function buildStateOperations(beforeState, afterState) {
  const before = beforeState || {};
  const after = afterState || {};
  const operations = [];

  JSON_PATCH_TOP_KEYS.forEach(key => {
    if (jsonPatchSame(before[key], after[key])) return;
    operations.push(after[key] === undefined
      ? { kind: 'unset_top', key }
      : { kind: 'set_top', key, value: after[key] });
  });
  if (after.periodSettings === undefined) {
    if (before.periodSettings !== undefined) operations.push({ kind: 'unset_top', key: 'periodSettings' });
  } else if (before.periodSettings === undefined || typeof before.periodSettings !== 'object') {
    operations.push({ kind: 'set_top', key: 'periodSettings', value: after.periodSettings });
  } else {
    JSON_PATCH_PERIOD_FIELDS.forEach(field => {
      jsonPatchPushValueOperation(operations, 'period_setting', { field }, before.periodSettings?.[field], after.periodSettings?.[field]);
    });
  }

  const beforeTimetable = jsonPatchTimetableMap(before.timetable);
  const afterTimetable = jsonPatchTimetableMap(after.timetable);
  afterTimetable.forEach((entry, key) => {
    if (!beforeTimetable.has(key) || !jsonPatchSame(beforeTimetable.get(key), entry)) {
      operations.push({ kind: 'upsert_timetable', entry });
    }
  });
  beforeTimetable.forEach((entry, key) => {
    if (!afterTimetable.has(key)) operations.push({ kind: 'remove_timetable', dow: Number(entry.dow), period: Number(entry.period) });
  });

  const beforeClasses = jsonPatchMap(before.classes);
  const afterClasses = jsonPatchMap(after.classes);
  afterClasses.forEach((nextClass, classId) => {
    const oldClass = beforeClasses.get(classId);
    if (!oldClass) {
      operations.push({ kind: 'upsert_class', class: nextClass });
      return;
    }

    JSON_PATCH_CLASS_FIELDS.forEach(field => {
      if (jsonPatchSame(oldClass[field], nextClass[field])) return;
      operations.push(nextClass[field] === undefined
        ? { kind: 'unset_class_field', classId, field }
        : { kind: 'set_class_field', classId, field, value: nextClass[field] });
    });
    ['notes', 'extraDays'].forEach(field => {
      const oldMap = oldClass[field] || {};
      const nextMap = nextClass[field] || {};
      new Set([...Object.keys(oldMap), ...Object.keys(nextMap)]).forEach(mapKey => {
        jsonPatchPushValueOperation(operations, 'class_map_value', { classId, field, mapKey }, oldMap[mapKey], nextMap[mapKey]);
      });
    });

    const oldStudents = jsonPatchMap(oldClass.students);
    const nextStudents = jsonPatchMap(nextClass.students);
    nextStudents.forEach((student, studentId) => {
      if (!oldStudents.has(studentId)) {
        operations.push({ kind: 'upsert_student', classId, student });
        return;
      }
      const oldStudent = oldStudents.get(studentId);
      JSON_PATCH_STUDENT_FIELDS.forEach(field => {
        jsonPatchPushValueOperation(operations, 'student_field', { classId, studentId, field }, oldStudent[field], student[field]);
      });
    });

    const oldAttendance = oldClass.attendance || {};
    const nextAttendance = nextClass.attendance || {};
    const attendanceDates = new Set([...Object.keys(oldAttendance), ...Object.keys(nextAttendance)]);
    attendanceDates.forEach(date => {
      const oldMarks = oldAttendance[date] || {};
      const nextMarks = nextAttendance[date] || {};
      const studentIds = new Set([...Object.keys(oldMarks), ...Object.keys(nextMarks)]);
      studentIds.forEach(studentId => {
        if (!nextStudents.has(String(studentId))) return;
        jsonPatchPushValueOperation(operations, 'attendance', { classId, studentId, date }, oldMarks[studentId], nextMarks[studentId]);
      });
    });

    const oldScores = oldClass.scores || {};
    const nextScores = nextClass.scores || {};
    const oldConfig = oldScores.config || {};
    const nextConfig = nextScores.config || {};
    JSON_PATCH_SCORE_CONFIG_FIELDS.forEach(field => {
      jsonPatchPushValueOperation(operations, 'score_config_field', { classId, field }, oldConfig[field], nextConfig[field]);
    });
    const oldRatio = oldConfig.ratio || {};
    const nextRatio = nextConfig.ratio || {};
    JSON_PATCH_SCORE_BUCKETS.forEach(bucket => {
      jsonPatchPushValueOperation(operations, 'score_ratio', { classId, bucket }, oldRatio[bucket], nextRatio[bucket]);
    });
    const oldOverrides = oldScores.gradeOverride || {};
    const nextOverrides = nextScores.gradeOverride || {};
    new Set([...Object.keys(oldOverrides), ...Object.keys(nextOverrides)]).forEach(studentId => {
      if (!nextStudents.has(String(studentId))) return;
      jsonPatchPushValueOperation(operations, 'grade_override', { classId, studentId }, oldOverrides[studentId], nextOverrides[studentId]);
    });

    const oldItems = jsonPatchMap(oldScores.items);
    const nextItems = jsonPatchMap(nextScores.items);
    nextItems.forEach((item, itemId) => {
      if (!oldItems.has(itemId)) {
        operations.push({ kind: 'upsert_score_item', classId, item });
        return;
      }
      const oldItem = oldItems.get(itemId);
      JSON_PATCH_SCORE_ITEM_FIELDS.forEach(field => {
        jsonPatchPushValueOperation(operations, 'score_item_field', { classId, itemId, field }, oldItem[field], item[field]);
      });
    });
    nextItems.forEach((item, itemId) => {
      const oldMarks = (oldScores.marks || {})[itemId] || {};
      const nextMarks = (nextScores.marks || {})[itemId] || {};
      new Set([...Object.keys(oldMarks), ...Object.keys(nextMarks)]).forEach(studentId => {
        if (!nextStudents.has(String(studentId))) return;
        jsonPatchPushValueOperation(operations, 'score', { classId, itemId, studentId }, oldMarks[studentId], nextMarks[studentId]);
      });
    });
    oldItems.forEach((item, itemId) => {
      if (!nextItems.has(itemId)) operations.push({ kind: 'remove_score_item', classId, itemId });
    });
    oldStudents.forEach((student, studentId) => {
      if (!nextStudents.has(studentId)) operations.push({ kind: 'remove_student', classId, studentId });
    });
  });
  beforeClasses.forEach((oldClass, classId) => {
    if (!afterClasses.has(classId)) operations.push({ kind: 'remove_class', classId });
  });
  return operations;
}

function jsonPatchDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return resolve(null);
    const request = indexedDB.open(JSON_PATCH_QUEUE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('writes', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function jsonPatchQueuePut(entry) {
  const db = await jsonPatchDb();
  if (!db) {
    const rows = jsonPatchFallbackRows();
    const index = rows.findIndex(row => row.id === entry.id);
    if (index >= 0) rows[index] = entry; else rows.push(entry);
    localStorage.setItem(JSON_PATCH_QUEUE_FALLBACK_KEY, JSON.stringify(rows));
    return;
  }
  await new Promise((resolve, reject) => {
    const request = db.transaction('writes', 'readwrite').objectStore('writes').put(entry);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  db.close();
}

async function jsonPatchQueueDelete(id) {
  const db = await jsonPatchDb();
  if (!db) {
    const rows = jsonPatchFallbackRows().filter(row => row.id !== id);
    localStorage.setItem(JSON_PATCH_QUEUE_FALLBACK_KEY, JSON.stringify(rows));
    return;
  }
  await new Promise((resolve, reject) => {
    const request = db.transaction('writes', 'readwrite').objectStore('writes').delete(id);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  db.close();
}

async function jsonPatchQueueAll(teacherKey = jsonPatchTeacherKey) {
  const db = await jsonPatchDb();
  let rows;
  if (!db) {
    rows = jsonPatchFallbackRows();
  } else {
    rows = await new Promise((resolve, reject) => {
      const request = db.transaction('writes').objectStore('writes').getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    db.close();
  }
  return rows
    .filter(row => row.teacherKey === teacherKey)
    .sort((a, b) => a.createdAt - b.createdAt || a.sequence - b.sequence || a.id.localeCompare(b.id));
}

async function jsonPatchRpc(operations) {
  if (!supabaseClient) throw new Error('Supabase client unavailable');
  const { data, error } = await supabaseClient.rpc('classkru_apply_state_operations', {
    p_operations: operations,
    p_client_modified: Date.now()
  });
  if (error) throw error;
  return data;
}

async function flushJsonPatchQueue() {
  if (jsonPatchMode !== 'ready' || !jsonPatchTeacherKey || !navigator.onLine) return false;
  const entries = await jsonPatchQueueAll();
  for (const entry of entries) {
    await jsonPatchRpc(entry.operations);
    await jsonPatchQueueDelete(entry.id);
  }
  return true;
}

function persistJsonPatchState(nextState, options = {}) {
  if (jsonPatchMode !== 'ready' || !jsonPatchTeacherKey) return Promise.resolve(false);
  const target = jsonPatchClone(nextState);
  const before = jsonPatchBaseline || {};
  const operations = buildStateOperations(before, target);
  jsonPatchBaseline = target;
  if (!operations.length) return Promise.resolve(true);

  const createdAt = Date.now();
  const entries = [];
  for (let index = 0; index < operations.length; index += 200) {
    entries.push({
      id: jsonPatchId('patch'), teacherKey: jsonPatchTeacherKey,
      createdAt, sequence: ++jsonPatchSequence, operations: operations.slice(index, index + 200)
    });
  }
  const write = async () => {
    let queueError = null;
    try {
      for (const entry of entries) await jsonPatchQueuePut(entry);
    } catch (error) {
      queueError = error;
    }
    if (!navigator.onLine) {
      if (queueError) throw new Error(`Offline queue unavailable: ${queueError.message || queueError}`);
      throw new Error('Offline; patch retained for retry');
    }
    updateCloudStatus('syncing', 'กำลังบันทึก...');
    if (queueError) {
      // Online writes can still complete if browser storage is unavailable.
      for (const entry of entries) await jsonPatchRpc(entry.operations);
      for (const entry of entries) await jsonPatchQueueDelete(entry.id).catch(() => {});
    } else {
      await flushJsonPatchQueue();
    }
    updateCloudStatus('online', 'บันทึกแล้ว');
    return true;
  };
  const queued = jsonPatchWriteQueue.then(write, write);
  jsonPatchWriteQueue = queued.catch(() => {});
  if (options.strict) {
    return queued.catch(async error => {
      for (const entry of entries) await jsonPatchQueueDelete(entry.id).catch(() => {});
      if (jsonPatchSame(jsonPatchBaseline, target)) jsonPatchBaseline = jsonPatchClone(before);
      throw error;
    });
  }
  return queued.catch(error => {
    console.warn('JSON patch retained for retry:', error);
    updateCloudStatus('offline', navigator.onLine ? 'บันทึกไม่สำเร็จ' : 'รอบันทึกเมื่อออนไลน์');
    return false;
  });
}

function jsonPatchFunctionMissing(error) {
  return ['42883', 'PGRST202'].includes(String(error?.code || ''))
    || /classkru_patch_capabilities.*(not find|does not exist)|schema cache/i.test(String(error?.message || ''));
}

async function detectJsonPatchMode(email) {
  if (!supabaseClient || !email) return jsonPatchMode;
  jsonPatchTeacherKey = String(email).trim().toLowerCase();
  try {
    const { data, error } = await supabaseClient.rpc('classkru_patch_capabilities');
    if (error) throw error;
    if (Number(data?.version) !== 1) throw new Error('Unsupported JSON patch protocol');
    jsonPatchMode = 'ready';
    localStorage.setItem('classkru_json_patch_v1', '1');
    await flushJsonPatchQueue();
  } catch (error) {
    if (jsonPatchFunctionMissing(error)) {
      jsonPatchMode = 'legacy';
      localStorage.removeItem('classkru_json_patch_v1');
    } else {
      console.warn('JSON patch capability check deferred:', error);
    }
  }
  return jsonPatchMode;
}

function initializeJsonPatchBaseline(state, email) {
  jsonPatchBaseline = jsonPatchClone(state || {});
  if (email) jsonPatchTeacherKey = String(email).trim().toLowerCase();
}

window.addEventListener('online', () => {
  if (jsonPatchMode === 'ready') {
    jsonPatchWriteQueue = jsonPatchWriteQueue
      .then(() => flushJsonPatchQueue())
      .then(() => updateCloudStatus('online', 'บันทึกแล้ว'))
      .catch(error => {
        console.warn('JSON patch retry failed:', error);
        updateCloudStatus('offline', 'บันทึกไม่สำเร็จ');
      });
  }
});
