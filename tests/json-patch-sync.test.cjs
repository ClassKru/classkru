const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const storage = new Map();
const context = vm.createContext({
  console: { ...console, warn() {} },
  window: { addEventListener() {}, indexedDB: null },
  navigator: { onLine: true }, indexedDB: null,
  localStorage: {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  },
  crypto: { randomUUID: () => `op-${Date.now()}-${Math.random()}` },
  structuredClone: value => JSON.parse(JSON.stringify(value)),
  supabaseClient: null, updateCloudStatus() {}
});
const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'json-patch-sync.js'), 'utf8');
vm.runInContext(source, context, { filename: 'json-patch-sync.js' });
const run = code => vm.runInContext(code, context);

const base = {
  teacherName: 'ครูเอ',
  periodSettings: { startTime: '08:30', duration: 50, breakTime: 0, count: 7 },
  timetable: [{ dow: 1, period: 1, classId: 'c_1', subject: 'คณิต', className: 'ม.1/1', week: 'A' }],
  classes: [{
    id: 'c_1', subject: 'คณิต', className: 'ม.1/1', academicYear: 2569, gradeLevel: 'm1', colorIndex: 1,
    students: [{ id: 's_1', name: 'สมชาย', no: 1, studentCode: '1001' }],
    attendance: { '2026-08-24': { s_1: 'present' } }, notes: {}, extraDays: {},
    scores: {
      config: { ratio: { before: 40, after: 30, mid: 10, final: 20 }, attendanceMin: 60, gradeCut: [] },
      items: [{ id: 'sk_1', name: 'งาน 1', max: 10, type: 'work', bucket: 'before', date: '', note: '' }],
      marks: { sk_1: { s_1: 8 } }, gradeOverride: {}
    }
  }],
  lastModified: 1
};

function operations(mutator) {
  context.before = JSON.parse(JSON.stringify(base));
  context.after = JSON.parse(JSON.stringify(base));
  mutator(context.after);
  return run('buildStateOperations(before, after)');
}

let ops = operations(state => { state.classes[0].scores.marks.sk_1.s_1 = 9; state.lastModified = 2; });
assert.equal(ops.length, 1, 'one score cell produces exactly one operation');
assert.deepEqual(JSON.parse(JSON.stringify(ops[0])), { kind: 'set_score', classId: 'c_1', itemId: 'sk_1', studentId: 's_1', value: 9 });
assert.equal(JSON.stringify(ops).includes('classes'), false, 'score patch does not contain the account or classroom blob');

ops = operations(state => { state.classes[0].attendance['2026-08-24'].s_1 = 'late'; });
assert.deepEqual(JSON.parse(JSON.stringify(ops)), [{ kind: 'set_attendance', classId: 'c_1', studentId: 's_1', date: '2026-08-24', value: 'late' }]);

ops = operations(state => { state.classes[0].students[0].nickname = 'ชาย'; });
assert.equal(ops.length, 1);
assert.equal(ops[0].kind, 'set_student_field');
assert.equal(ops[0].field, 'nickname');
assert.equal(ops[0].value, 'ชาย');
assert.equal(JSON.stringify(ops).includes('photoBase64'), false, 'editing a student field never resends an unchanged photo');

ops = operations(state => { state.periodSettings.duration = 45; });
assert.equal(ops.length, 1);
assert.equal(ops[0].kind, 'set_period_setting');
assert.equal(ops[0].field, 'duration');

ops = operations(state => { state.classes[0].scores.items[0].name = 'งานใหม่'; });
assert.equal(ops.length, 1);
assert.equal(ops[0].kind, 'set_score_item_field');
assert.equal(ops[0].field, 'name');

ops = operations(state => { state.timetable[0].classId = 'c_2'; });
assert.equal(ops.length, 1);
assert.equal(ops[0].kind, 'upsert_timetable');

ops = operations(state => {
  state.classes[0].students = [];
  state.classes[0].attendance = {};
  state.classes[0].scores.marks.sk_1 = {};
});
assert.deepEqual(Array.from(ops, op => op.kind), ['remove_student'], 'student removal is one server-side archival operation');

ops = operations(state => { state.classes = []; state.timetable = []; });
assert.deepEqual(Array.from(ops, op => op.kind).sort(), ['remove_class', 'remove_timetable'], 'class removal also removes its active timetable cell');

const queuedEntries = [];
const calls = [];
context.supabaseClient = {
  async rpc(name, args) {
    assert.equal(name, 'classkru_apply_state_operations');
    calls.push(JSON.parse(JSON.stringify(args.p_operations)));
    return { data: {}, error: null };
  }
};
context.testEntries = queuedEntries;
run(`jsonPatchQueuePut = async entry => testEntries.push(entry);
  jsonPatchQueueAll = async teacherKey => testEntries
    .filter(entry => entry.teacherKey === (teacherKey || jsonPatchTeacherKey))
    .sort((a, b) => a.sequence - b.sequence);
  jsonPatchQueueDelete = async id => {
    const index = testEntries.findIndex(entry => entry.id === id);
    if (index >= 0) testEntries.splice(index, 1);
  };`);
context.seed = JSON.parse(JSON.stringify(base));
run("jsonPatchMode='ready'; jsonPatchTeacherKey='teacher-a@example.com'; jsonPatchBaseline=jsonPatchClone(seed)");
context.first = JSON.parse(JSON.stringify(base));
context.first.classes[0].scores.marks.sk_1.s_1 = 9;
context.second = JSON.parse(JSON.stringify(context.first));
context.second.classes[0].attendance['2026-08-24'].s_1 = 'late';

(async () => {
  const first = run('persistJsonPatchState(first, { strict: true })');
  const second = run('persistJsonPatchState(second, { strict: true })');
  await Promise.all([first, second]);
  assert.deepEqual(calls.map(batch => batch[0].kind), ['set_score', 'set_attendance'], 'rapid patches reach Supabase in original order');
  assert.equal(queuedEntries.length, 0);

  const failedQueue = [];
  const attemptedKinds = [];
  context.testFailedQueue = failedQueue;
  run(`jsonPatchQueuePut = async entry => testFailedQueue.push(entry);
    jsonPatchQueueAll = async () => testFailedQueue.slice().sort((a, b) => a.sequence - b.sequence);
    jsonPatchQueueDelete = async id => {
      const index = testFailedQueue.findIndex(entry => entry.id === id);
      if (index >= 0) testFailedQueue.splice(index, 1);
    };`);
  context.supabaseClient = {
    async rpc(name, args) {
      attemptedKinds.push(args.p_operations[0].kind);
      return { data: null, error: new Error('offline') };
    }
  };
  run('jsonPatchBaseline=jsonPatchClone(seed); jsonPatchWriteQueue=Promise.resolve()');
  await run('persistJsonPatchState(first)').catch(() => {});
  await new Promise(resolve => setTimeout(resolve, 0));
  await run('persistJsonPatchState(second)').catch(() => {});
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(attemptedKinds, ['set_score', 'set_score'], 'a failed older patch blocks newer patches from overtaking it');
  assert.equal(failedQueue.length, 2, 'offline patches remain queued for retry');

  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '202608240002_json_patch_rpc.sql'), 'utf8');
  assert.doesNotMatch(sql, /create\s+table/i, 'migration creates no data tables');
  assert.match(sql, /for update/i, 'profile JSON row is locked during every patch');
  assert.match(sql, /lower\(email\) = lower\(auth\.email\(\)\)/i, 'RPC is scoped to the authenticated teacher');
  assert.match(sql, /Operation kind is not allowed/i, 'RPC rejects non-allowlisted operations');
  assert.match(sql, /_deletedRecords/, 'deletions are archived inside the same JSON document');
  assert.doesNotMatch(sql, /audit.*history|score_audit/i, 'no edit-history table or log is introduced');
  assert.match(sql, /revoke all on function public\.classkru_apply_state_operations\(jsonb, bigint\) from public, anon/i);

  console.log('JSON patch sync tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
