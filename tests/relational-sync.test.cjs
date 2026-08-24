const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({
  console, window: { addEventListener() {} }, navigator: { onLine: true },
  indexedDB: null, crypto: { randomUUID: () => 'op-1' }, appState: {},
  structuredClone: value => JSON.parse(JSON.stringify(value)),
  supabaseClient: null, updateCloudStatus() {}, saveStateLocalOnly() {}
});
const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'relational-sync.js'), 'utf8');
vm.runInContext(source, context, { filename: 'relational-sync.js' });
const run = code => vm.runInContext(code, context);

const base = {
  teacherName: 'ครูเอ', periodSettings: { startTime: '08:30', duration: 50, breakTime: 0, count: 7 },
  classes: [{
    id: 'c_1', subject: 'คณิต', className: 'ม.1/1', academicYear: 2569, gradeLevel: 'm1', colorIndex: 1,
    students: [{ id: 's_1', name: 'สมชาย', no: 1, studentCode: '1001' }],
    attendance: { '2026-08-24': { s_1: 'present' } }, extraDays: {},
    scores: { config: { ratio: { before: 40, after: 30, mid: 10, final: 20 }, attendanceMin: 60, gradeCut: [] },
      items: [{ id: 'sk_1', name: 'งาน 1', max: 10, type: 'work', bucket: 'before', date: '', note: '' }],
      marks: { sk_1: { s_1: 8 } }, gradeOverride: {} }
  }], timetable: []
};
context.before = base;
context.after = JSON.parse(JSON.stringify(base));
context.after.classes[0].scores.marks.sk_1.s_1 = 9;
let diff = run("relationalDiff(before, after, '00000000-0000-0000-0000-000000000001')");
assert.deepEqual(Object.keys(diff), ['student_scores'], 'one score edit changes only the score table');
assert.equal(diff.student_scores.length, 1);
assert.equal(diff.student_scores[0].score, 9);

context.after = JSON.parse(JSON.stringify(base));
context.after.classes[0].attendance['2026-08-24'].s_1 = 'late';
diff = run("relationalDiff(before, after, '00000000-0000-0000-0000-000000000001')");
assert.deepEqual(Object.keys(diff), ['attendance_records'], 'one attendance edit changes only the attendance table');

context.after = JSON.parse(JSON.stringify(base));
context.after.classes[0].students = [];
context.after.classes[0].attendance = {};
context.after.classes[0].scores.marks = { sk_1: {} };
diff = run("relationalDiff(before, after, '00000000-0000-0000-0000-000000000001')");
assert.ok(diff.students[0].deleted_at, 'removed students are soft-deleted');
assert.ok(diff.classroom_students[0].deleted_at, 'removed memberships are soft-deleted');
assert.ok(diff.attendance_records[0].deleted_at, 'attendance remains recoverable after removal');
assert.ok(diff.student_scores[0].deleted_at, 'scores remain recoverable after removal');

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '202608240001_relational_classkru.sql'), 'utf8');
assert.equal((sql.match(/create table if not exists public\./g) || []).length, 13, 'schema has 12 app tables and one migration ledger');
assert.match(sql, /force row level security/);
assert.match(sql, /teacher_id = auth\.uid\(\)/);
assert.doesNotMatch(sql, /score_audit_log/);

console.log('relational sync tests passed');
