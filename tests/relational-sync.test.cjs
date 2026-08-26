const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const storage = new Map();
const context = vm.createContext({
  console,
  setTimeout,
  clearTimeout,
  structuredClone,
  Date,
  Math,
  Promise,
  Map,
  Set,
  JSON,
  Object,
  Array,
  Number,
  String,
  localStorage: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  },
  navigator: { onLine: true },
  window: { addEventListener() {} },
  updateCloudStatus() {}
});
context.globalThis = context;

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'relational-sync.js'), 'utf8');
vm.runInContext(source, context, { filename: 'relational-sync.js' });
const run = code => vm.runInContext(code, context);

const seed = {
  teacherName: 'ครูเอ',
  periodSettings: { startTime: '08:30', duration: 50, breakTime: 0, count: 7 },
  onboarding: { done: true },
  holidays: [],
  timetableWeek: 'A',
  activeWebScreen: 'scores',
  lastModified: 100,
  classes: [{
    id: 'class-old-id', subject: 'วิทยาศาสตร์', className: 'ม.1/1', academicYear: 2569,
    gradeLevel: 'ม.1', colorIndex: 2, notes: {}, extraDays: {},
    students: [{ id: 'student-old-id', name: 'เด็กหญิงทดสอบ', no: 1, studentCode: '1001', nickname: 'เอ', comment: '', score: 0 }],
    attendance: { '2026-08-26': { 'student-old-id': 'present' } },
    scores: {
      config: { ratio: { before: 40, after: 30, mid: 10, final: 20 }, attendanceMin: 60, gradeCut: [] },
      items: [{ id: 'score-old-id', name: 'งาน 1', max: 10, type: 'assign', bucket: 'before', date: '2026-08-26', note: '' }],
      marks: { 'score-old-id': { 'student-old-id': 5 } },
      gradeOverride: {}
    }
  }],
  timetable: [{ week: 'A', dow: 1, period: 1, classId: 'class-old-id', subject: 'วิทยาศาสตร์', className: 'ม.1/1' }]
};
context.seed = structuredClone(seed);

function operations(before, after) {
  context.before = structuredClone(before);
  context.after = structuredClone(after);
  return run("relationalDiff(before, after, '00000000-0000-0000-0000-000000000001', 'teacher@example.com')");
}

{
  const next = structuredClone(seed);
  next.classes[0].scores.marks['score-old-id']['student-old-id'] = 8;
  next.lastModified = 200;
  const result = operations(seed, next);
  assert.equal(result.length, 1, 'one score edit must produce one database operation');
  assert.equal(result[0].table, 'student_scores');
  assert.deepEqual(Object.keys(result[0].values), ['score']);
  assert.equal(result[0].values.score, 8);
}

{
  const next = structuredClone(seed);
  next.classes[0].attendance['2026-08-27'] = { 'student-old-id': 'late' };
  next.lastModified = 201;
  const result = operations(seed, next);
  assert.equal(result.length, 1, 'one attendance mark must produce one database operation');
  assert.equal(result[0].type, 'upsert');
  assert.equal(result[0].table, 'attendance_records');
  assert.equal(result[0].row.status, 'late');
}

{
  const next = structuredClone(seed);
  next.classes[0].students[0].nickname = 'บี';
  next.lastModified = 202;
  const result = operations(seed, next);
  assert.equal(result.length, 1);
  assert.equal(result[0].table, 'students');
  assert.deepEqual(Object.keys(result[0].values), ['nickname']);
}

{
  const next = structuredClone(seed);
  next.classes[0].scores.gradeOverride['student-old-id'] = '3.5';
  const result = operations(seed, next);
  assert.equal(result.length, 1);
  assert.equal(result[0].table, 'classroom_students');
  assert.deepEqual(Object.keys(result[0].values), ['grade_override']);
}

{
  const next = structuredClone(seed);
  next.classes[0].students = [];
  const result = operations(seed, next);
  const affected = new Set(result.map(operation => operation.table));
  assert.ok(affected.has('students'));
  assert.ok(affected.has('classroom_students'));
  assert.ok(affected.has('attendance_records'));
  assert.ok(affected.has('student_scores'));
  assert.ok(result.every(operation => operation.type === 'update'));
  assert.ok(result.every(operation => Object.keys(operation.values).includes('deleted_at')));
}

{
  const rows = run("relationalRows(seed, '00000000-0000-0000-0000-000000000001', 'teacher@example.com')");
  const plain = {};
  for (const table of run('RELATIONAL_TABLES')) {
    plain[table] = [...rows[table].values()].map(row => ({ ...row, created_at: '2026-08-26T00:00:00.000Z', updated_at: '2026-08-26T00:00:00.000Z' }));
  }
  context.roundTripRows = plain;
  const restored = run('relationalStateFromRows(roundTripRows)');
  assert.equal(restored.classes[0].id, 'class-old-id');
  assert.equal(restored.classes[0].students[0].id, 'student-old-id');
  assert.equal(restored.classes[0].scores.items[0].id, 'score-old-id');
  assert.equal(restored.classes[0].scores.marks['score-old-id']['student-old-id'], 5);
  assert.equal(restored.classes[0].attendance['2026-08-26']['student-old-id'], 'present');
}

{
  storage.clear();
  run("relationalQueuePut({ id: 'a', teacherId: 'teacher-a', createdAt: 1, sequence: 1, operations: [] })");
  run("relationalQueuePut({ id: 'b', teacherId: 'teacher-b', createdAt: 1, sequence: 1, operations: [] })");
  assert.deepEqual(run("relationalQueueAll('teacher-a').map(row => row.id)"), ['a']);
  assert.deepEqual(run("relationalQueueAll('teacher-b').map(row => row.id)"), ['b']);
}

async function testOrderedWrites() {
  storage.clear();
  const captured = [];
  context.supabaseClient = {
    from(table) {
      return {
        upsert(rows) {
          const list = Array.isArray(rows) ? rows : [rows];
          list.forEach(row => captured.push({ table, score: row.score }));
          return Promise.resolve({ error: null });
        },
        update(values) {
          const key = {};
          const builder = {
            eq(column, value) { key[column] = value; return builder; },
            then(resolve) {
              captured.push({ table, score: values.score, key });
              resolve({ error: null });
            }
          };
          return builder;
        }
      };
    }
  };
  run("relationalMode='ready'; relationalTeacherIdValue='00000000-0000-0000-0000-000000000001'; relationalTeacherEmail='teacher@example.com'; relationalBaseline=relationalClone(seed); relationalWriteQueue=Promise.resolve()");
  const first = structuredClone(seed);
  first.classes[0].scores.marks['score-old-id']['student-old-id'] = 7;
  const second = structuredClone(first);
  second.classes[0].scores.marks['score-old-id']['student-old-id'] = 9;
  context.firstWrite = first;
  context.secondWrite = second;
  await Promise.all([
    run('persistRelationalState(firstWrite, { strict: true })'),
    run('persistRelationalState(secondWrite, { strict: true })')
  ]);
  assert.deepEqual(captured.filter(row => row.table === 'student_scores').map(row => row.score), [7, 9]);
  assert.equal(run("relationalQueueAll('00000000-0000-0000-0000-000000000001').length"), 0);
}

{
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '202608260001_classkru_relational_schema.sql'), 'utf8');
  const created = [...sql.matchAll(/create table if not exists public\.([a-z_]+)/gi)].map(match => match[1]);
  assert.deepEqual(created, [
    'teacher_profiles', 'classrooms', 'students', 'classroom_students',
    'timetable_entries', 'attendance_records', 'score_items', 'student_scores'
  ]);
  assert.match(sql, /primary key \(teacher_id, classroom_id, score_item_id, student_id\)/i);
  assert.match(sql, /foreign key \(teacher_id, classroom_id, student_id\)[\s\S]*classroom_students/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /teacher_id = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /revoke delete on table public\.%I from authenticated/i);
  assert.doesNotMatch(sql, /create policy classkru_teacher_delete/i);
  assert.match(sql, /where deleted_at is null/i);
  assert.match(sql, /on conflict \(teacher_id, id\) do nothing/i);
  assert.doesNotMatch(sql, /update\s+public\.classmanager_profiles/i);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.classmanager_profiles/i);
  assert.doesNotMatch(sql, /create table[^;]*(offline|backup|audit|migration)/i);
}

testOrderedWrites().then(() => console.log('relational-sync tests passed'));
