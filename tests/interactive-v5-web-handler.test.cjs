'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createInteractiveV5Handler } = require('../api/_lib/interactive-v5/web-handler');
const { RUNTIME_CSP, createRuntimePreviewService, instrumentRuntimeHtml, runtimeCspForHost } = require('../api/_lib/interactive-v5/html-media-builder-ai/runtime-preview');

function response() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.payload = value; return this; },
    send(value) { this.payload = value; return this; }
  };
}

function request(path, method = 'GET') { return { method, query: { path }, headers: {} }; }

test('V5 landing reset and saved-work controls do not remain locked by a stale task state', () => {
  const clientScript = fs.readFileSync(path.join(__dirname, '..', 'v5.js'), 'utf8');
  const showHome = clientScript.slice(clientScript.indexOf('function showHome('), clientScript.indexOf('async function continueLast('));
  const library = clientScript.slice(clientScript.indexOf('async function refreshLibrary('), clientScript.indexOf('function openLibrary('));

  assert.doesNotMatch(showHome, /dataset\.view === 'landing'\) \{ window\.scrollTo\(0, 0\); return; \}/);
  assert.match(showHome, /state\.conversation = null; state\.job = null; state\.previewJob = null;/);
  assert.match(showHome, /renderBrief\(null\); renderBuildStatus\(null\);/);
  assert.doesNotMatch(library, /edit\.addEventListener\('click', async \(\) => \{\s*if \(state\.busy\) return;/);
  assert.match(library, /edit\.textContent = 'กำลังเปิด…';/);
  assert.match(library, /#library-status'\)\.textContent = `\$\{isConversationOnly/);
});

test('V5 web gateway stays disabled until its explicit feature flag is enabled', async () => {
  let authenticated = false;
  const handler = createInteractiveV5Handler({ env: {}, authenticate: async () => { authenticated = true; return { id: 'teacher' }; } });
  const res = response();
  await handler(request('status'), res);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.payload, { error: 'interactive_v5_not_enabled' });
  assert.equal(authenticated, false);
});

test('V5 status requires an authenticated, same-origin request and reports server-side readiness only', async () => {
  const handler = createInteractiveV5Handler({
    env: { INTERACTIVE_V5_WEB_ENABLED: 'true', OPENROUTER_API_KEY: 'server-key' },
    authenticate: async () => ({ id: 'teacher-id' }),
    originIsValid: () => true,
    checkDatabase: async () => true,
    storageIsReady: () => true
  });
  const res = response();
  await handler(request('status'), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, {
    mode: 'live', show_task_usage: false,
    conversation_configured: true, architect_configured: true, builder_configured: true,
    ai_configured: true, database_ready: true, storage_ready: true, ready: true
  });
});

test('V5 gateway rejects an invalid origin before accessing account data', async () => {
  let authenticated = false;
  const handler = createInteractiveV5Handler({
    env: { INTERACTIVE_V5_WEB_ENABLED: 'true' },
    originIsValid: () => false,
    authenticate: async () => { authenticated = true; return { id: 'teacher-id' }; }
  });
  const res = response();
  await handler(request('status'), res);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, { error: 'invalid_origin' });
  assert.equal(authenticated, false);
});

test('V5 status fails readiness when its Supabase migration is missing without exposing database details', async () => {
  const handler = createInteractiveV5Handler({
    env: { INTERACTIVE_V5_WEB_ENABLED: 'true', OPENROUTER_API_KEY: 'server-key' },
    authenticate: async () => ({ id: 'teacher-id' }),
    originIsValid: () => true,
    checkDatabase: async () => { throw new Error('relation public.interactive_v5_tasks does not exist'); },
    storageIsReady: () => true
  });
  const res = response();
  await handler(request('status'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.database_ready, false);
  assert.equal(res.payload.ready, false);
  assert.equal(JSON.stringify(res.payload).includes('does not exist'), false);
});

test('V5 status fails readiness when the configured Storage bucket is missing or unsafe without exposing details', async () => {
  const handler = createInteractiveV5Handler({
    env: { INTERACTIVE_V5_WEB_ENABLED: 'true', OPENROUTER_API_KEY: 'server-key' },
    authenticate: async () => ({ id: 'teacher-id' }),
    originIsValid: () => true,
    checkDatabase: async () => true,
    storageIsReady: async () => { throw Object.assign(new Error('private storage diagnostic'), { code: 'storage_bucket_unsafe' }); }
  });
  const res = response();
  await handler(request('status'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.storage_ready, false);
  assert.equal(res.payload.ready, false);
  assert.equal(JSON.stringify(res.payload).includes('private storage diagnostic'), false);
});

test('V5 blocks non-status API requests when async Storage readiness is false', async () => {
  let servicesCreated = false;
  const handler = createInteractiveV5Handler({
    env: { INTERACTIVE_V5_WEB_ENABLED: 'true' },
    authenticate: async () => ({ id: 'teacher-id' }),
    originIsValid: () => true,
    storageIsReady: async () => false,
    servicesForTeacher: async () => { servicesCreated = true; throw new Error('services must not be created'); }
  });
  const res = response();
  await handler(request('model-settings'), res);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.payload, { error: 'storage_not_configured' });
  assert.equal(servicesCreated, false);
});

test('V5 serves the pinned Three.js module with anonymous CORS for sandboxed previews', async () => {
  let authenticated = false;
  const handler = createInteractiveV5Handler({
    env: { INTERACTIVE_V5_WEB_ENABLED: 'true' },
    authenticate: async () => { authenticated = true; return { id: 'teacher-id' }; }
  });
  const res = response();
  await handler(request('three'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['access-control-allow-origin'], '*');
  assert.match(res.headers['content-type'], /^text\/javascript/);
  assert.match(res.payload, /three\.core\.js/);
  assert.equal(authenticated, false);
});

test('V5 sandbox CSP allows only its exact ClassKru or project Vercel origin for Three.js modules', () => {
  const productionPolicy = runtimeCspForHost('www.classkru.com:443');
  assert.match(productionPolicy, /script-src 'unsafe-inline' 'self' https:\/\/www\.classkru\.com/);
  assert.match(productionPolicy, /connect-src 'none'/);
  assert.match(productionPolicy, /sandbox allow-scripts/);

  const previewPolicy = runtimeCspForHost('classkru-git-main-classkru-dev.vercel.app');
  assert.match(previewPolicy, /https:\/\/classkru-git-main-classkru-dev\.vercel\.app/);
  assert.equal(runtimeCspForHost('attacker.example'), RUNTIME_CSP);
});

test('runtime preview adds privacy-safe diagnostics before artifact scripts without loosening its sandbox', async () => {
  const artifactHtml = '<!doctype html><html><head><title>Preview</title></head><body><script>throw new Error("private artifact detail")</script></body></html>';
  const runtime = createRuntimePreviewService({
    artifactStore: { getValidated: async () => ({ id: 'artifact-1', html: artifactHtml }) }
  });
  const preview = await runtime.loadPreview('artifact-1');
  assert.ok(preview.html.indexOf('data-v5-runtime-diagnostics') < preview.html.indexOf('<script>throw'));
  assert.match(preview.html, /unhandledrejection/);
  assert.match(preview.html, /securitypolicyviolation/);
  assert.match(preview.html, /webgl_context_unavailable/);
  assert.doesNotMatch(preview.html, /event\.message|reason\.message/);
  assert.equal(preview.content_security_policy, RUNTIME_CSP);
  assert.equal(preview.iframe_sandbox, 'allow-scripts');
  assert.equal(preview.html.includes('private artifact detail'), true);
});

test('runtime diagnostics are not duplicated and support fragments without a head element', () => {
  const instrumented = instrumentRuntimeHtml('<body><main>Preview</main></body>');
  assert.ok(instrumented.indexOf('<body>') < instrumented.indexOf('data-v5-runtime-diagnostics'));
  assert.equal(instrumentRuntimeHtml(instrumented), instrumented);
});
