'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const briefs = require('../server/lib/brief-store');
const navigation = require('../server/lib/navigation');
const openrouter = require('../server/lib/openrouter');

test('V3 is a compact Developer test brief and keeps V1 as production default', () => {
  const v1 = briefs.load('v1');
  const v2 = briefs.load('v2');
  const v3 = briefs.load('v3');
  assert.equal(briefs.catalog().activeVersion, 'v1');
  assert.equal(briefs.catalog().defaultVersion, 'v1');
  assert.ok(v3.system.length + v3.navigation.length < v2.system.length + v2.navigation.length);
  assert.match(v3.system, /ประวัติ/);
  assert.match(v3.navigation, /ข้อมูลบัญชี/);
  assert.equal(v1.id, 'v1');
});

test('V3 builds a smaller model context, omits the classroom ID, and preserves follow-up history', async () => {
  const history = [
    { role: 'assistant', content: 'ต้องการให้พาไปหน้าห้องเรียนไหมคะ?' },
    { role: 'user', content: 'พาไปเลย' }
  ];
  let requestBody;
  const result = await openrouter.respond({
    message: 'พาไปเลย',
    context: { screen: 'dashboard', selectedClassId: 'teacher-private-class-id' },
    history,
    brief: briefs.load('v3'),
    actionRegistry: navigation.registry,
    env: { CLASSKRU_AI_NAV_MODEL: 'test/mock-model', CLASSKRU_AI_NAV_OPENROUTER_API_KEY: 'test-only' },
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ reply: 'กำลังเปิดหน้าห้องเรียนค่ะ', action: { type: 'navigate', target: 'classrooms', highlight: false } }) } }] })
      };
    }
  });

  const system = requestBody.messages[0].content;
  assert.equal(result.answer.action.target, 'classrooms');
  assert.ok(system.includes('"hasSelectedClass":true'));
  assert.ok(!system.includes('teacher-private-class-id'));
  assert.deepEqual(requestBody.messages.slice(1, 3), [
    { role: 'assistant', content: history[0].content },
    { role: 'user', content: history[1].content }
  ]);
  assert.equal(requestBody.response_format.json_schema.schema.required.join(','), 'reply,action');

  const registryText = system.match(/Action Registry ที่อนุญาต: (\[[^\n]*\])/);
  assert.ok(registryText);
  const sentActions = JSON.parse(registryText[1]);
  assert.equal(sentActions.length, navigation.registry.length);
  assert.ok(sentActions.every(action => !Object.hasOwn(action, 'screen')));
  assert.ok(sentActions.every(action => navigation.registry.some(entry => entry.id === action.id)));
});

test('V2 prompt construction remains on its existing path', async () => {
  let requestBody;
  await openrouter.respond({
    message: 'พาไปหน้าตารางสอน',
    context: { screen: 'dashboard', selectedClassId: 'v2-context-id' },
    history: [],
    brief: briefs.load('v2'),
    actionRegistry: navigation.registry,
    env: { CLASSKRU_AI_NAV_MODEL: 'test/mock-model', CLASSKRU_AI_NAV_OPENROUTER_API_KEY: 'test-only' },
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ reply: 'กำลังเปิดหน้าตารางสอนค่ะ', action: { type: 'navigate', target: 'timetable', highlight: false } }) } }] }) };
    }
  });
  const allowedActions = navigation.registry.map(({ id, screen, label, requiresClass }) => ({ id, screen, label, requiresClass: Boolean(requiresClass) }));
  const expectedSystemPrompt = [
    briefs.load('v2').system,
    briefs.load('v2').navigation,
    `\nบริบทปัจจุบัน (ข้อมูลอ้างอิงเท่านั้น): ${JSON.stringify({ screen: 'dashboard', selectedClassId: 'v2-context-id' })}\nAction Registry ที่อนุญาต (เลือก target จาก id เท่านั้น): ${JSON.stringify(allowedActions)}\nส่งกลับ JSON ตาม schema; เมื่อไม่ควรนำทางให้ action เป็น null.\n`
  ].join('\n\n');
  assert.equal(requestBody.messages[0].content, expectedSystemPrompt);
});
