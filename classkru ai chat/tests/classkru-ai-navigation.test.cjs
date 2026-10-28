'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { mockReply, validateAnswer, registry, cleanHistory } = require('../server/lib/navigation');
const { createHandler } = require('../server/handlers/navigation');

function exchange(body, options = {}) {
  let statusCode;
  let payload;
  const res = {
    setHeader() {},
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return this; }
  };
  const req = { method: 'POST', headers: {}, body };
  const handler = createHandler({
    authenticate: options.authenticate || (async () => ({ id: 'teacher-test' })),
    originIsValid: options.originIsValid || (() => true),
    provider: options.provider || mockReply,
    env: { CLASSKRU_AI_NAV_ENABLED: options.disabled ? 'false' : 'true' }
  });
  return handler(req, res).then(() => ({ statusCode, payload }));
}

test('Thai questions and read-only navigation resolve to registered actions', () => {
  const examples = [
    ['ClassKru ทำอะไรได้บ้าง?', null],
    ['พาไปหน้าเช็กชื่อ', 'checkin'],
    ['อยากสร้างรายวิชา', 'add_class'],
    ['เพิ่มนักเรียนยังไง?', 'add_student']
  ];
  for (const [question, target] of examples) {
    const answer = validateAnswer(mockReply(question, { selectedClassId: 'owned-class' }));
    assert.equal(answer.action?.target || null, target);
    if (target) assert.ok(registry.some(entry => entry.id === target));
  }
});

test('class-dependent request falls back to choosing a classroom', () => {
  assert.equal(mockReply('พาไปหน้าเช็กชื่อ').action.target, 'classrooms');
  assert.equal(mockReply('เพิ่มนักเรียนยังไง?').action.target, 'classrooms');
});

test('unregistered commands and executable text cannot become actions', () => {
  assert.throws(() => validateAnswer({ reply: 'done', action: { type: 'navigate', target: 'delete_student' } }), /action_not_allowed/);
  assert.throws(() => validateAnswer({ reply: 'done', action: { type: 'javascript', target: 'dashboard', code: 'alert(1)' } }), /action_not_allowed/);
});

test('history is bounded before it reaches the provider', () => {
  const history = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(900) }));
  const cleaned = cleanHistory(history);
  assert.equal(cleaned.length, 8);
  assert.ok(cleaned.every(turn => turn.content.length === 800));
});

test('API denies access without a teacher session and when disabled', async () => {
  assert.equal((await exchange({ message: 'พาไปหน้าเช็กชื่อ' }, { authenticate: async () => null })).statusCode, 401);
  assert.equal((await exchange({ message: 'พาไปหน้าเช็กชื่อ' }, { disabled: true })).payload.error, 'navigation_disabled');
});

test('API handles unavailable provider without navigating or mutating', async () => {
  const result = await exchange({ message: 'พาไปหน้าเช็กชื่อ' }, { provider: async () => { throw new Error('offline'); } });
  assert.equal(result.statusCode, 502);
  assert.equal(result.payload.error, 'provider_unavailable');
  assert.equal(result.payload.action, undefined);
});

test('API rejects a provider action outside the registry', async () => {
  const result = await exchange({ message: 'ลบข้อมูล' }, { provider: async () => ({ reply: 'ลบแล้ว', action: { type: 'navigate', target: 'delete_all' } }) });
  assert.equal(result.statusCode, 502);
  assert.equal(result.payload.error, 'action_not_allowed');
});

test('API response is read-only guidance for an owned classroom context', async () => {
  const result = await exchange({ message: 'พาไปหน้าเช็กชื่อ', context: { screen: 'dashboard', selectedClassId: 'owned-class' } });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.payload.action, { type: 'navigate', target: 'checkin', highlight: true });
});

test('browser executor rejects unregistered or unowned destinations before routing', async () => {
  const navigationCalls = [];
  const element = () => ({ style: {}, hidden: true, append() {}, addEventListener() {}, setAttribute() {} });
  const document = { createElement: element, body: { append() {} }, querySelector: () => null };
  const appState = { activeWebScreen: 'dashboard', classes: [] };
  const window = { addEventListener() {} };
  const source = fs.readFileSync(path.join(__dirname, '../frontend/js/classkru-ai-actions.js'), 'utf8');
  vm.runInNewContext(source, {
    document, window, appState, location: { hash: '' }, currentClassId: 'outside-class',
    fetch: async () => ({ ok: true, json: async () => registry }),
    navigateToWebScreen: (screen, classId) => { navigationCalls.push([screen, classId]); appState.activeWebScreen = screen; },
    getScreenFromHash: () => 'dashboard', cancelAnimationFrame() {}, requestAnimationFrame() {}
  });
  assert.equal((await window.ClassKruAiActions.execute({ type: 'navigate', target: 'delete_all' })).reason, 'action_not_allowed');
  assert.equal((await window.ClassKruAiActions.execute({ type: 'navigate', target: 'checkin' })).reason, 'class_required');
  assert.equal(navigationCalls.length, 0);
  appState.classes.push({ id: 'outside-class' });
  assert.equal((await window.ClassKruAiActions.execute({ type: 'navigate', target: 'checkin' })).ok, true);
  assert.equal(navigationCalls[0][0], 'checkin');
  assert.equal(navigationCalls[0][1], 'outside-class');
});
