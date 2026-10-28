'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const briefs = require('../server/lib/brief-store');
const openrouter = require('../server/lib/openrouter');
const navigationApi = require('../server/handlers/navigation');
const versionsApi = require('../server/handlers/brief-versions');
const vercel = require('../../vercel.json');
const vercelIgnore = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', '..', '.vercelignore'), 'utf8');

const teacherId = '2f69bfa5-1522-47b2-8c27-e1a0f20e8118';

function exchange(handler, method, body, options = {}) {
  let statusCode;
  let payload;
  const res = { setHeader() {}, status(code) { statusCode = code; return this; }, json(value) { payload = value; return this; } };
  const req = { method, headers: {}, body };
  return handler(req, res).then(() => ({ statusCode, payload }));
}

test('private brief catalog loads only registered, complete versions', () => {
  const catalog = briefs.catalog();
  assert.equal(catalog.defaultVersion, 'v1');
  assert.equal(catalog.activeVersion, 'v1');
  assert.deepEqual(catalog.versions.map(version => version.id), ['v1', 'v2']);
  assert.match(briefs.load('v1').system, /ClassKru AI/);
  assert.throws(() => briefs.load('v3'), /invalid_brief_version/);
});

test('private brief files are excluded from static deployment and bundled only into AI functions', () => {
  assert.match(vercelIgnore, /^classkru ai chat\/briefs\/$/m);
  assert.ok(vercel.functions['api/media-studio/index.js'].includeFiles.includes('classkru ai chat/briefs/**'));
  for (const route of ['navigation', 'brief-versions', 'model-settings']) {
    assert.ok(vercel.rewrites.some(rule => rule.source === `/api/ai/${route}` && rule.destination === `/api/media-studio?action=classkru-ai&path=${route}`));
  }
});

test('AI gateway rejects unknown routes and preserves endpoint enablement checks', async () => {
  const gateway = require('../server/handlers/gateway');
  for (const route of ['unknown', '__proto__']) {
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await gateway({ method: 'GET', query: { path: route } }, res);
    assert.equal(res.code, 404);
  }
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await gateway({ method: 'GET', query: { path: 'navigation' } }, res);
  assert.equal(res.code, 405);
});

test('developer version catalog is private and returns metadata only', async () => {
  const env = { CLASSKRU_AI_NAV_ENABLED: 'true' };
  const handler = versionsApi.createHandler({ authenticate: async () => ({ id: teacherId, email: 'classkru.dev@gmail.com' }), originIsValid: () => true, env });
  const result = await exchange(handler, 'GET');
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.activeVersion, 'v1');
  assert.deepEqual(result.payload.versions.map(version => version.id), ['v1', 'v2']);
  assert.equal(JSON.stringify(result.payload).includes('System Prompt'), false);
  const denied = versionsApi.createHandler({ authenticate: async () => ({ id: 'another-teacher', email: 'teacher@example.test' }), originIsValid: () => true, env });
  assert.equal((await exchange(denied, 'GET')).statusCode, 403);
});

test('navigation uses the same server-side Mini Lab developer account check', async () => {
  const handler = navigationApi.createHandler({
    authenticate: async () => ({ id: teacherId, email: 'classkru.dev@gmail.com' }), originIsValid: () => true,
    env: { CLASSKRU_AI_NAV_ENABLED: 'true' },
    provider: async () => ({ reply: 'พร้อมทดสอบค่ะ', action: null }), logger: () => {}
  });
  const response = await exchange(handler, 'POST', { message: 'ทดสอบระบบ' });
  assert.equal(response.statusCode, 200);
  assert.equal(Object.hasOwn(response.payload, 'modelId'), true);
});

test('ordinary teachers cannot request an experimental brief version', async () => {
  let providerCalled = false;
  const handler = navigationApi.createHandler({
    authenticate: async () => ({ id: `teacher-${Date.now()}-${Math.random()}` }), originIsValid: () => true,
    env: { CLASSKRU_AI_NAV_ENABLED: 'true' }, provider: async () => { providerCalled = true; return { reply: 'ok', action: null }; }
  });
  const result = await exchange(handler, 'POST', { message: 'สวัสดี', briefVersion: 'v2' });
  assert.equal(result.statusCode, 409);
  assert.equal(result.payload.error, 'active_version_changed');
  assert.equal(providerCalled, false);
});

test('developer version selection is checked on every navigation request and pins its conversation', async () => {
  const records = [];
  let calls = 0;
  const handler = navigationApi.createHandler({
    authenticate: async () => ({ id: teacherId }), originIsValid: () => true,
    isDeveloper: user => user.id === teacherId,
    env: { CLASSKRU_AI_NAV_ENABLED: 'true' },
    provider: async message => { calls++; return { answer: { reply: `ตอบ ${message}`, action: null }, modelId: 'mock-test', usage: { prompt_tokens: 4 } }; },
    logger: record => records.push(JSON.parse(record))
  });
  const id = '5bbd9a7e-6a75-4bbc-a945-59f1ad1b7771';
  const first = await exchange(handler, 'POST', { message: 'เริ่มทดสอบ', briefVersion: 'v1', conversationId: id });
  assert.equal(first.statusCode, 200);
  assert.equal(first.payload.briefVersion, 'v1');
  assert.equal(first.payload.conversationId, id);
  assert.equal(first.payload.modelId, 'mock-test');
  const mismatch = await exchange(handler, 'POST', { message: 'เปลี่ยน prompt กลางคุย', briefVersion: 'v2', conversationId: id });
  assert.equal(mismatch.statusCode, 409);
  assert.equal(mismatch.payload.error, 'brief_version_changed');
  assert.equal(calls, 1);
  assert.equal(records[0].briefVersion, 'v1');
  assert.equal(Object.hasOwn(records[0], 'message'), false);
});

test('OpenRouter receives server credentials, selected brief, strict actions, and privacy routing', async () => {
  let request;
  const modelResponse = { reply: 'จะพาไปหน้าเช็กชื่อค่ะ', action: { type: 'navigate', target: 'checkin', highlight: true } };
  const result = await openrouter.respond({
    message: 'อยากเช็กชื่อ', context: { screen: 'dashboard', selectedClassId: 'class-x' }, history: [],
    brief: briefs.load('v1'), actionRegistry: require('../server/lib/navigation').registry,
    env: { CLASSKRU_AI_NAV_OPENROUTER_API_KEY: 'secret-server-key', CLASSKRU_AI_NAV_MODEL: 'provider/model' },
    fetchImpl: async (_url, options) => {
      request = { headers: options.headers, body: JSON.parse(options.body) };
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(modelResponse) } }], usage: { prompt_tokens: 12, completion_tokens: 9 } }) };
    }
  });
  assert.equal(request.headers.Authorization, 'Bearer secret-server-key');
  assert.equal(request.body.model, 'provider/model');
  assert.equal(request.body.provider.data_collection, 'deny');
  assert.equal(request.body.response_format.json_schema.strict, true);
  assert.ok(request.body.response_format.json_schema.schema.properties.action.properties.target.enum.includes('checkin'));
  assert.equal(JSON.stringify(result).includes('secret-server-key'), false);
  assert.deepEqual(result.usage, { prompt_tokens: 12, completion_tokens: 9 });
});

test('OpenRouter timeout and malformed responses are reported without actions', async () => {
  const args = { message: 'สวัสดี', context: {}, history: [], brief: briefs.load('v1'), actionRegistry: require('../server/lib/navigation').registry, env: { OPENROUTER_API_KEY: 'test', OPENROUTER_MODEL: 'provider/model' } };
  await assert.rejects(openrouter.respond({ ...args, fetchImpl: async () => { const error = new Error('timeout'); error.name = 'TimeoutError'; throw error; } }), error => error.code === 'provider_timeout');
  await assert.rejects(openrouter.respond({ ...args, fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'not json' } }] }) }) }), error => error.code === 'invalid_ai_response');
});

test('developer execution logs accept only registry actions and bounded outcomes', async () => {
  const logs = [];
  const handler = navigationApi.createHandler({ authenticate: async () => ({ id: teacherId }), originIsValid: () => true, isDeveloper: user => user.id === teacherId, env: { CLASSKRU_AI_NAV_ENABLED: 'true' }, logger: record => logs.push(JSON.parse(record)) });
  const denied = navigationApi.createHandler({ authenticate: async () => ({ id: 'teacher' }), originIsValid: () => true, env: { CLASSKRU_AI_NAV_ENABLED: 'true' } });
  assert.equal((await exchange(denied, 'POST', { event: 'execution', action: 'checkin', result: 'navigated' })).statusCode, 403);
  assert.equal((await exchange(handler, 'POST', { event: 'execution', action: 'checkin', result: 'navigated', requestId: 'r1', briefVersion: 'v1' })).statusCode, 200);
  assert.equal(logs[0].action, 'checkin');
  assert.equal(logs[0].result, 'navigated');
});

test('navigation API applies a per-teacher request limit', async () => {
  const handler = navigationApi.createHandler({
    authenticate: async () => ({ id: 'rate-limit-teacher' }), originIsValid: () => true,
    env: { CLASSKRU_AI_NAV_ENABLED: 'true' }, now: () => 1_000_000,
    provider: async () => ({ reply: 'รับทราบค่ะ', action: null })
  });
  const outcomes = [];
  for (let index = 0; index < 13; index++) outcomes.push(await exchange(handler, 'POST', { message: `คำถามที่ ${index}` }));
  assert.ok(outcomes.slice(0, 12).every(result => result.statusCode === 200));
  assert.equal(outcomes[12].statusCode, 429);
});

test('brief selector appears only after server-confirmed developer access and hides on auth change', async () => {
  const createElement = () => {
    const listeners = new Map();
    const attributes = {};
    const node = {
      hidden: false, textContent: '', children: [], childElementCount: 0,
      addEventListener(name, callback) { listeners.set(name, callback); },
      fire(name, event = {}) { listeners.get(name)?.(event); },
      setAttribute(name, value) { attributes[name] = value; },
      getAttribute(name) { return attributes[name]; },
      appendChild(child) { this.children.push(child); this.childElementCount = this.children.length; },
      replaceChildren() { this.children = []; this.childElementCount = 0; },
      querySelectorAll() { return this.children; },
      querySelector(selector) { return selector.includes('selected') ? this.children.find(child => child.getAttribute('aria-selected') === 'true') : null; },
      focus() {}, contains() { return true; }
    };
    return node;
  };
  const elements = Object.fromEntries(['ck-ai-brief-controls', 'ck-ai-brief-toggle', 'ck-ai-brief-menu'].map(id => [id, createElement()]));
  const documentListeners = new Map();
  const document = {
    readyState: 'complete', getElementById: id => elements[id], createElement,
    addEventListener: (name, callback) => documentListeners.set(name, callback)
  };
  let authListener;
  let isAuthedDeveloper = true;
  const window = {
    isClassKruMediaDeveloper: () => isAuthedDeveloper,
    configureClassKruAiDeveloper(enabled, version) { this.classKruAiDeveloper = enabled; if (enabled) this.setClassKruAiBriefVersion(version); },
    setClassKruAiBriefVersion(version) { this.classKruAiBriefVersion = version; }
  };
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../frontend/js/classkru-ai-brief-selector.js'), 'utf8');
  require('node:vm').runInNewContext(source, {
    document, window,
    supabaseClient: { auth: { getSession: async () => ({ data: { session: { access_token: 'teacher-token' } } }), onAuthStateChange: callback => { authListener = callback; } } },
    fetch: async () => isAuthedDeveloper
      ? { ok: true, json: async () => ({ developer: true, activeVersion: 'v1', versions: [{ id: 'v1', label: 'V1 · Production' }, { id: 'v2', label: 'V2 · Test' }] }) }
      : { ok: false },
    AbortSignal: { timeout: () => ({}) }
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements['ck-ai-brief-controls'].hidden, false);
  assert.equal(elements['ck-ai-brief-menu'].children.length, 2);
  elements['ck-ai-brief-menu'].children[1].fire('click');
  assert.equal(window.classKruAiBriefVersion, 'v2');
  isAuthedDeveloper = false;
  authListener('SIGNED_OUT', null);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements['ck-ai-brief-controls'].hidden, true);
  assert.equal(window.classKruAiDeveloper, false);
});
