'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const briefs = require('../server/lib/brief-store');
const navigation = require('../server/lib/navigation');
const openrouter = require('../server/lib/openrouter');

const registryPath = path.join(__dirname, '../assets/classkru-ai-actions.json');
const casesPath = path.join(__dirname, '../briefs/tests/navigation-v1-v2-cases.json');
const versionRegistry = JSON.parse(fs.readFileSync(path.join(__dirname, '../briefs/registry.json'), 'utf8'));
const actionRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const evaluation = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
const intents = new Set(['INFORMATION', 'EXPLANATION', 'NAVIGATION', 'UI_GUIDANCE', 'GENERAL_CHAT', 'ACTION_REQUEST', 'AMBIGUOUS', 'UNSUPPORTED']);

test('V2 is registered for Developer testing while V1 remains both active and default', () => {
  assert.equal(versionRegistry.activeVersion, 'v1');
  assert.equal(versionRegistry.defaultVersion, 'v1');
  assert.deepEqual(versionRegistry.versions.map(version => version.id), ['v1', 'v2']);
  assert.deepEqual(briefs.catalog().versions.map(version => version.id), ['v1', 'v2']);
  assert.match(briefs.load('v1').system, /ClassKru AI/);
  assert.match(briefs.load('v2').system, /INFORMATION/);
  assert.match(briefs.load('v2').navigation, /ClassKru AI Navigation Brief V2/);
});

test('V2 preserves the existing JSON response contract and navigation allowlist', () => {
  assert.deepEqual(openrouter.schema.required, ['reply', 'action']);
  assert.deepEqual(Object.keys(openrouter.schema.properties).sort(), ['action', 'reply']);
  assert.deepEqual(openrouter.schema.properties.action.properties.target.enum, actionRegistry.map(action => action.id));
  assert.deepEqual(navigation.registry.map(action => action.id), actionRegistry.map(action => action.id));
});

test('the V1/V2 comparison set has at least 50 documented cases with real registry targets only', () => {
  assert.ok(evaluation.cases.length >= 50);
  const ids = new Set();
  for (const scenario of evaluation.cases) {
    assert.ok(scenario.id && !ids.has(scenario.id), `unique case id: ${scenario.id}`);
    ids.add(scenario.id);
    assert.equal(typeof scenario.message, 'string');
    assert.ok(intents.has(scenario.expected.intent), `${scenario.id} intent`);
    assert.ok(Array.isArray(scenario.history));
    assert.ok(scenario.context && typeof scenario.context.screen === 'string');
    if (scenario.expected.actionTarget) assert.ok(actionRegistry.some(action => action.id === scenario.expected.actionTarget), `${scenario.id} target`);
    assert.deepEqual(Object.keys(scenario.results).sort(), ['mock', 'realV1', 'realV2']);
    assert.equal(scenario.results.mock, null);
    assert.equal(scenario.results.realV1, null);
    assert.equal(scenario.results.realV2, null);
  }
});

test('a mocked transport receives V2 policy and the existing strict reply/action schema', async () => {
  let requestBody;
  const result = await openrouter.respond({
    message: 'ฉันสอนวิชาอะไรบ้าง', context: { screen: 'dashboard', selectedClassId: null }, history: [],
    brief: briefs.load('v2'), actionRegistry: navigation.registry,
    env: { CLASSKRU_AI_NAV_MODEL: 'test/mock-model', CLASSKRU_AI_NAV_OPENROUTER_API_KEY: 'test-only' },
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ reply: 'ยังตรวจข้อมูลบัญชีไม่ได้ค่ะ ต้องการให้พาไปหน้าห้องเรียนไหมคะ?', action: null }) } }] }) };
    }
  });
  assert.equal(result.answer.action, null);
  assert.equal(requestBody.response_format.json_schema.schema.required.join(','), 'reply,action');
  assert.equal(requestBody.messages[0].role, 'system');
  assert.match(requestBody.messages[0].content, /INFORMATION/);
  assert.match(requestBody.messages[0].content, /ห้ามแต่งข้อมูล/);
  assert.match(requestBody.messages[0].content, /subjects/);
  assert.match(requestBody.messages[1].content, /ฉันสอนวิชาอะไรบ้าง/);
});

test('mocked AI answers for both versions remain constrained to the existing response contract', async t => {
  for (const version of ['v1', 'v2']) {
    await t.test(version, async () => {
      const brief = briefs.load(version);
      const answer = navigation.validateAnswer({
        reply: `กำลังเปิดหน้าตารางสอนค่ะ (${version})`,
        action: { type: 'navigate', target: 'timetable', highlight: false }
      });
      assert.equal(answer.action.target, 'timetable');
      assert.equal(brief.id, version);
      assert.throws(() => navigation.validateAnswer({ reply: 'เปิดหน้าแล้ว', action: { type: 'navigate', target: 'subjects' } }), /action_not_allowed/);
    });
  }
});
