const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function seedState() {
  return {
    classes: [
      {
        id: 'c-a', academicYear: 2569, gradeLevel: 'm1', className: 'ม.1/2', subject: 'คณิตศาสตร์',
        students: [{ id: 's-a', name: 'สมชาย ใจดี', studentCode: '1001' }],
        scores: { config: {}, items: [{ id: 'work-1', name: 'บทที่ 1', max: 20, bucket: 'before' }], marks: {}, gradeOverride: {} }
      },
      {
        id: 'c-b', academicYear: 2569, gradeLevel: 'm1', className: 'ม.1/3', subject: 'คณิตศาสตร์',
        students: [{ id: 's-b', name: 'สมหญิง ใจงาม', studentCode: '1002' }],
        scores: { config: {}, items: [{ id: 'work-2', name: 'บทที่ 1', max: 10, bucket: 'before' }], marks: {}, gradeOverride: {} }
      }
    ]
  };
}

const storage = new Map([['classmanager_email', 'teacher@example.com']]);
const elements = new Map();
function mockElement(id) {
  if (!elements.has(id)) {
    const classes = new Set();
    elements.set(id, {
      id, value: '', textContent: '', innerHTML: '', disabled: false, max: '', style: { setProperty() {} },
      classList: {
        add(...names) { names.forEach(name => classes.add(name)); },
        remove(...names) { names.forEach(name => classes.delete(name)); },
        toggle(name, force) { if (force === undefined ? !classes.has(name) : force) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); }
      },
      focus() {}, select() {}
    });
  }
  return elements.get(id);
}
const context = vm.createContext({
  console: { ...console, warn() {} },
  URL,
  DOMException,
  setTimeout,
  clearTimeout,
  structuredClone,
  appState: seedState(),
  scoreCurrentClassId: null,
  quickScoreItemId: null,
  _cloudPushTimer: null,
  supabaseClient: null,
  window: { CSS: { escape: String }, isSecureContext: true },
  navigator: { userAgent: 'Mobile Safari', mediaDevices: { getUserMedia() {} } },
  document: {
    addEventListener() {},
    getElementById(id) { return mockElement(id); },
    querySelector(selector) { return mockElement(selector); },
    querySelectorAll() { return []; },
    activeElement: null,
    head: { appendChild() {} }
  },
  localStorage: {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, value); }
  },
  ensureScores(c) {
    if (!c.scores) c.scores = { config: {}, items: [], marks: {}, gradeOverride: {} };
    if (!c.scores.items) c.scores.items = [];
    if (!c.scores.marks) c.scores.marks = {};
    return c.scores;
  },
  scoreOrderedItems(c) { return c.scores.items; },
  getClassColor() { return { text: '#2563eb' }; },
  showToast() {},
  updateCloudStatus() {},
  saveStateLocalOnly() {},
  updateScoreRow() {},
  renderQuickScoreStats() {},
  renderScoreWorkspace() {}
});
context.enqueueCloudStateWrite = async (email, state) => {
  const { error } = await context.supabaseClient.from('classmanager_profiles').upsert({ email, state });
  if (error) throw error;
};

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'qr-scores.js'), 'utf8');
vm.runInContext(source, context, { filename: 'qr-scores.js' });
const run = expression => vm.runInContext(expression, context);

assert.equal(run("parseQrStudentPayload('CKSTU:s-a').legacyToken"), 's-a');
assert.equal(run("parseQrStudentPayload('https://classkru.test/card?student_id=s-a').studentId"), 's-a');
assert.equal(run("parseQrStudentPayload('{\"student_id\":\"s-a\"}').studentId"), 's-a');
assert.equal(run("parseQrStudentPayload('s-a').legacyToken"), 's-a');
assert.equal(run('QR_SCORE_SCANNER_SRC'), 'js/vendor/html5-qrcode.min.js');
assert.deepEqual(Array.from(run('qrScoreClasses().map(c => c.academicYear)')), [2569, 2569]);
assert.equal(run("getQrScoreCameraErrorInfo({ name: 'NotAllowedError' }).title"), 'ยังไม่ได้รับอนุญาตให้ใช้กล้อง');
assert.equal(run("navigator.userAgent='LINE/14.0'; navigator.mediaDevices=undefined; getQrScoreCameraErrorInfo({}).title"), 'เบราว์เซอร์ในแอปนี้ไม่รองรับกล้อง');
run("navigator.userAgent='Mobile Safari'; navigator.mediaDevices={ getUserMedia() {} }");

run('renderQrScoreSetup()');
assert.equal(mockElement('qr-score-class').disabled, false, 'classroom picker is loaded from real classroom data');
assert.equal(mockElement('qr-score-task').disabled, true, 'task stays locked until a classroom is selected');
assert.equal(mockElement('qr-score-start-btn').disabled, true);
mockElement('qr-score-class').value = 'c-a';
run('qrScoreClassChanged()');
assert.equal(mockElement('qr-score-task').disabled, false);
mockElement('qr-score-task').value = run("qrScoreTaskValue('c-a','work-1')");
run('qrScoreTaskChanged()');
assert.equal(mockElement('qr-score-start-btn').disabled, false, 'scanner starts only after the full real-data context is selected');
assert.equal(mockElement('qr-score-max').textContent, '/20', 'setup preview shows the real assignment maximum after the editable score position');
assert.equal(mockElement('qr-score-default-score').disabled, false, 'default score becomes editable after selecting a real assignment');

run("qrScoreState.classId = 'c-a'");
assert.equal(run("findQrScoreStudent(parseQrStudentPayload('s-a')).classroom.id"), 'c-a');
assert.equal(run("findQrScoreStudent(parseQrStudentPayload('s-b')).classroom.id"), 'c-b');
assert.equal(run("findQrScoreStudent(parseQrStudentPayload('1001')).student.id"), 's-a');

run("qrScoreState.blockedCode = 's-a'; qrScoreState.lastSeenAt = Date.now() - 1300; noteQrScoreNoCode()");
assert.equal(run("qrScoreState.blockedCode"), null, 'same QR unlocks only after it leaves the camera long enough');
run("qrScoreState.blockedCode = 's-a'; qrScoreState.lastSeenAt = Date.now(); noteQrScoreNoCode()");
assert.equal(run("qrScoreState.blockedCode"), 's-a', 'same QR remains locked while the camera still sees it');

assert.equal(run("validateQrScore(appState.classes[0], appState.classes[0].scores.items[0], appState.classes[0].students[0], 21)"), 'คะแนนต้องไม่เกิน 20');
assert.equal(run("validateQrScore(appState.classes[0], appState.classes[0].scores.items[0], appState.classes[0].students[0], -1)"), 'คะแนนต้องไม่ติดลบ');
assert.equal(run("validateQrScore(appState.classes[0], appState.classes[0].scores.items[0], appState.classes[0].students[0], 8)"), '');

run("qrScoreState.classId='c-a'; qrScoreState.itemId='work-1'; qrScoreState.defaultScore='8'; qrScoreState.phase='scanning'; qrScoreState.blockedCode=null; handleQrScoreDecoded('CKSTU:s-a')");
assert.equal(run('qrScoreState.phase'), 'editing');
assert.equal(run('qrScoreState.studentId'), 's-a');
assert.equal(mockElement('qr-score-max-label').textContent, '/20', 'score entry always shows the assignment maximum');
assert.equal(mockElement('qr-score-new-score').value, '8', 'editable setup score becomes the default for an unscored student');
run("qrScoreState.phase='scanning'; qrScoreState.blockedCode=null; handleQrScoreDecoded('CKSTU:s-b')");
assert.equal(run('qrScoreState.phase'), 'error');
assert.equal(run('qrScoreState.studentId'), null, 'wrong-room QR must never select a student for saving');

context.supabaseClient = { from: () => ({ upsert: async () => ({ error: null }) }) };
(async () => {
  mockElement('qr-score-default-score').value = '21';
  await run("beginQrScoreScan('c-a','work-1')");
  assert.equal(mockElement('qr-score-setup-error').textContent, 'คะแนนต้องอยู่ระหว่าง 0–20');
  mockElement('qr-score-default-score').value = '';

  const result = await run("persistQrScore('c-a','work-1','s-a',8)");
  assert.equal(result.success, true);
  assert.equal(run("appState.classes[0].scores.marks['work-1']['s-a']"), 8);
  assert.equal(run("appState.scoreAuditHistory[0].old_score"), null);
  assert.equal(run("appState.scoreAuditHistory[0].new_score"), 8);

  const updated = await run("persistQrScore('c-a','work-1','s-a',9)");
  assert.equal(updated.success, true);
  assert.equal(updated.old_score, 8);
  assert.equal(run("appState.scoreAuditHistory[1].old_score"), 8);
  assert.equal(run("appState.classes[0].scores.marks['work-1']['s-a']"), 9);

  context.supabaseClient = { from: () => ({ upsert: async () => ({ error: new Error('database unavailable') }) }) };
  const failed = await run("persistQrScore('c-a','work-1','s-a',10)");
  assert.equal(failed.success, false);
  assert.equal(run("appState.classes[0].scores.marks['work-1']['s-a']"), 9, 'failed commit must keep the previous score');
  console.log('qr-scores tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
