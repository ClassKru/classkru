'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Media V2 requests a strict artifact schema and reports incomplete provider output', async t => {
  const names = ['OPENROUTER_MEDIA_PLANNER_API_KEY', 'OPENROUTER_API_KEY', 'OPENROUTER_SITE_URL'];
  const old = Object.fromEntries(names.map(name => [name, process.env[name]]));
  t.after(() => {
    for (const name of names) {
      if (old[name] === undefined) delete process.env[name];
      else process.env[name] = old[name];
    }
  });
  process.env.OPENROUTER_MEDIA_PLANNER_API_KEY = 'v2-test-secret';
  const { artifactSchema, callOpenRouter } = require('../api/_lib/media-lab-v2-ai');
  let request;
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    request = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        choices: [{ finish_reason: 'length', message: { content: '{"title":"ทดสอบ"' } }],
        usage: { prompt_tokens: 10, completion_tokens: 14, total_tokens: 24 }
      })
    };
  });
  const result = await callOpenRouter('test/model', 'build', { maxTokens: 14000, temperature: 0.25, jsonMode: true });
  assert.equal(request.response_format.type, 'json_schema');
  assert.equal(request.response_format.json_schema.strict, true);
  assert.deepEqual(request.response_format.json_schema.schema, artifactSchema);
  assert.deepEqual(request.provider, { data_collection: 'deny', require_parameters: true });
  assert.equal(request.max_tokens, 14000);
  assert.ok(!JSON.stringify(request).includes('v2-test-secret'));
  assert.equal(result.finishReason, 'length');
  assert.equal(result.responseChars, 16);
  assert.equal(result.usage.total_tokens, 24);
  fetchMock.mock.restore();
});

test('Media V2 keeps ordinary conversation output free from the artifact schema', async t => {
  const old = process.env.OPENROUTER_MEDIA_PLANNER_API_KEY;
  process.env.OPENROUTER_MEDIA_PLANNER_API_KEY = 'v2-test-secret';
  t.after(() => {
    if (old === undefined) delete process.env.OPENROUTER_MEDIA_PLANNER_API_KEY;
    else process.env.OPENROUTER_MEDIA_PLANNER_API_KEY = old;
  });
  const { callOpenRouter } = require('../api/_lib/media-lab-v2-ai');
  let request;
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: 'คำตอบ' } }] }) };
  });
  const result = await callOpenRouter('test/model', 'chat', { maxTokens: 700, temperature: 0.5, systemPrompt: 'system' });
  assert.equal(request.response_format, undefined);
  assert.deepEqual(request.provider, { data_collection: 'deny' });
  assert.equal(request.messages[0].role, 'system');
  assert.equal(result.finishReason, 'stop');
  assert.equal(result.text, 'คำตอบ');
  fetchMock.mock.restore();
});

test('Media V2 reuses the Studio OpenRouter key and accepts compatible text parts', async t => {
  const oldPlannerKey = process.env.OPENROUTER_MEDIA_PLANNER_API_KEY;
  const oldSharedKey = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MEDIA_PLANNER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'shared-studio-key';
  t.after(() => {
    if (oldPlannerKey === undefined) delete process.env.OPENROUTER_MEDIA_PLANNER_API_KEY;
    else process.env.OPENROUTER_MEDIA_PLANNER_API_KEY = oldPlannerKey;
    if (oldSharedKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = oldSharedKey;
  });
  const { callOpenRouter } = require('../api/_lib/media-lab-v2-ai');
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer shared-studio-key');
    return { ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: [{ type: 'text', text: 'ข้อความจากผู้ให้บริการ' }] } }] }) };
  });
  t.after(() => fetchMock.mock.restore());
  const result = await callOpenRouter('test/model', 'chat', { maxTokens: 700, temperature: 0.5 });
  assert.equal(result.text, 'ข้อความจากผู้ให้บริการ');
});
