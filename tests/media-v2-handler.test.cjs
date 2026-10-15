'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

function html(title = 'สื่อทดสอบ', body = '<button type="button">ทดลอง</button>') {
  return '<!doctype html><html><head><title>' + title + '</title></head><body>' + body + '</body></html>';
}
function providerResponse(content, { status = 200, finish = 'stop' } = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => status >= 200 && status < 300
    ? { choices: [{ finish_reason: finish, message: { content } }], usage: { prompt_tokens: 20, completion_tokens: 40, total_tokens: 60 } }
    : { error: { message: 'mocked provider failure' } } };
}

test('Media V2 preserves the Brief, preflights complexity, and bounds provider/repair retries using mocks', async t => {
  const userId = crypto.randomUUID();
  const root = 'users/' + userId + '/mini-lab-v2';
  const objects = new Map();
  const storage = {
    configured: () => true,
    list: async (prefix, { search = '', offset = 0, limit = 1000, order = 'desc' } = {}) => [...objects.keys()]
      .map((key, sequence) => ({ key, sequence }))
      .filter(row => row.key.startsWith(prefix + '/'))
      .map(row => ({ name: row.key.slice(prefix.length + 1), id: row.key, sequence: row.sequence }))
      .filter(row => row.name.includes(search))
      .sort((a, b) => (a.sequence - b.sequence) * (order === 'asc' ? 1 : -1))
      .slice(offset, offset + limit)
      .map(({ name, id }) => ({ name, id })),
    documents: async (prefix, options = {}) => (await storage.list(prefix, options)).map(row => objects.get(prefix + '/' + row.name)),
    get: async name => objects.get(name) || null,
    put: async (name, value) => { if (objects.has(name)) return false; objects.set(name, value); return true; },
    remove: async name => { objects.delete(name); }
  };

  const storagePath = require.resolve('../api/_lib/media-db');
  const userPath = require.resolve('../api/_lib/supabase-user');
  const handlerPath = require.resolve('../api/_lib/media-lab-v2-handler');
  const priorCache = new Map([storagePath, userPath, handlerPath].map(path => [path, require.cache[path]]));
  const oldKey = process.env.OPENROUTER_MEDIA_PLANNER_API_KEY;
  process.env.OPENROUTER_MEDIA_PLANNER_API_KEY = 'mock-only-not-a-real-key';
  require.cache[storagePath] = { id: storagePath, filename: storagePath, loaded: true, exports: storage };
  require.cache[userPath] = { id: userPath, filename: userPath, loaded: true, exports: { authenticatedUser: async () => ({ id: userId, email: 'teacher@example.test' }) } };
  delete require.cache[handlerPath];
  t.after(() => {
    if (oldKey === undefined) delete process.env.OPENROUTER_MEDIA_PLANNER_API_KEY;
    else process.env.OPENROUTER_MEDIA_PLANNER_API_KEY = oldKey;
    for (const [path, cached] of priorCache) { if (cached) require.cache[path] = cached; else delete require.cache[path]; }
  });

  let providerCalls = 0;
  let requests = [];
  let replies = [];
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    providerCalls++;
    requests.push(JSON.parse(options.body));
    const next = replies.shift();
    if (next instanceof Error) throw next;
    return next || providerResponse(JSON.stringify({ title: 'mock', summary: 'mock summary', html: html() }));
  });
  t.after(() => fetchMock.mock.restore());
  const handler = require('../api/_lib/media-lab-v2-handler');
  async function call(path, method = 'POST', body = {}) {
    const res = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await handler({ method, headers: { host: 'classkru.test', origin: 'https://classkru.test', authorization: 'Bearer fixture' }, query: { path }, body }, res);
    return res;
  }
  async function seed(content, { brief = null, assistant = false } = {}) {
    const id = crypto.randomUUID(), created = Date.now();
    objects.set(root + '/sessions/' + id + '_index_' + created + '_' + crypto.randomUUID() + '.json', {
      id, title: 'งานทดสอบ', created_at: new Date(created).toISOString(), updated_at: new Date(created).toISOString(), brief
    });
    objects.set(root + '/messages/' + id + '_message_' + crypto.randomUUID() + '.json', {
      id: crypto.randomUUID(), session_id: id, role: 'teacher', kind: 'v2_chat', content, created_at: new Date(created).toISOString()
    });
    if (assistant) {
      const messageId = crypto.randomUUID();
      objects.set(root + '/messages/' + id + '_message_' + crypto.randomUUID() + '.json', {
        id: messageId, session_id: id, role: 'assistant', kind: 'v2_chat', content: 'เสนอแนวทางสื่อหนึ่งแบบ\n[ทางเลือก]ใช้แถบเลื่อนทดลองแรงเสียดทานทีละปัจจัย[/ทางเลือก]', created_at: new Date(created + 1).toISOString()
      });
      return { id, messageId };
    }
    return { id };
  }
  const artifact = (page = html()) => JSON.stringify({ title: 'สื่อทดสอบ', summary: 'ทดลองใน Runtime', html: page });

  const complex = await seed('Make 4 scenes with a 3D simulation slider, quiz, drag and drop, timer, images, audio, video, and load a CDN.');
  const callsBeforeComplex = providerCalls;
  const blocked = await call('sessions/' + complex.id + '/build');
  assert.equal(blocked.statusCode, 409);
  assert.equal(blocked.body.error_category, 'complexity_exceeded');
  assert.equal(providerCalls, callsBeforeComplex, 'Complexity rejection must happen before any AI request');
  const blockedSession = await call('sessions/' + complex.id, 'GET');
  assert.equal(blockedSession.body.session.latest_build.error_category, 'complexity_exceeded');

  const selected = await seed('อยากทดลองแรงเสียดทานด้วย slider', { assistant: true });
  const selectedDirection = 'ใช้แถบเลื่อนทดลองแรงเสียดทานทีละปัจจัย';
  const savedBrief = await call('sessions/' + selected.id + '/brief', 'POST', { message_id: selected.messageId, direction: selectedDirection });
  assert.equal(savedBrief.statusCode, 200);
  assert.equal(savedBrief.body.brief.selected_direction, selectedDirection);

  replies = [providerResponse('', { status: 429 }), providerResponse(artifact())];
  requests = [];
  const retried = await call('sessions/' + selected.id + '/build');
  assert.equal(retried.statusCode, 200);
  assert.equal(providerCalls, callsBeforeComplex + 2);
  assert.ok(requests[0].messages.at(-1).content.includes(selectedDirection));
  const successBuild = objects.get(root + '/builds/' + selected.id + '_build_' + retried.body.build_id + '.json');
  assert.equal(successBuild.retry_count, 1);
  assert.equal(successBuild.status, 'passed');
  assert.equal(successBuild.provider, 'openrouter');
  assert.equal(successBuild.response_status, 200);
  assert.equal(successBuild.input_tokens, 20);
  assert.equal(successBuild.output_tokens, 40);
  assert.equal(Number.isFinite(successBuild.duration_ms), true);
  assert.equal(successBuild.validation_result.ok, true);
  assert.equal(successBuild.output_size, objects.get('mini-lab-v2/runtime/' + retried.body.run.id + '.json').html.length);

  const truncated = await seed('ทดลองการเรียงลำดับเหตุการณ์');
  replies = [providerResponse('{"title":"ตัด', { finish: 'length' }), providerResponse(artifact())];
  requests = [];
  const compacted = await call('sessions/' + truncated.id + '/build');
  assert.equal(compacted.statusCode, 200);
  assert.equal(requests.length, 2);
  assert.ok(requests[1].messages.at(-1).content.includes('COMPACT REBUILD'));

  const brokenJs = await seed('สื่อฝึกคณิตศาสตร์แบบง่าย');
  replies = [providerResponse(artifact(html('ผิด', '<script>let = ;</script>'))), providerResponse(artifact())];
  const repairedJs = await call('sessions/' + brokenJs.id + '/build');
  assert.equal(repairedJs.statusCode, 200);
  const jsBuild = objects.get(root + '/builds/' + brokenJs.id + '_build_' + repairedJs.body.build_id + '.json');
  assert.equal(jsBuild.repair_count, 1);

  const brokenHtml = await seed('สื่อฝึกอ่าน');
  replies = [providerResponse(JSON.stringify({ title: 'ขาดเอกสาร', summary: 'broken', html: '<div>ไม่ใช่เอกสารเต็ม</div>' })), providerResponse(artifact())];
  const repairedHtml = await call('sessions/' + brokenHtml.id + '/build');
  assert.equal(repairedHtml.statusCode, 200);

  const timedOut = await seed('สื่อฝึกคำศัพท์อย่างง่าย', { brief: { selected_direction: 'แนวทางคงเดิมเมื่อ Build ล้มเหลว' } });
  replies = [new DOMException('mock timeout', 'TimeoutError'), new DOMException('mock timeout', 'TimeoutError'), new DOMException('mock timeout', 'TimeoutError')];
  const callsBeforeTimeout = providerCalls;
  const timeoutResult = await call('sessions/' + timedOut.id + '/build');
  assert.equal(timeoutResult.statusCode, 502);
  assert.equal(timeoutResult.body.error_category, 'timeout');
  assert.equal(providerCalls - callsBeforeTimeout, 3, 'Transient retries must stop at the configured limit');
  const timeoutBuild = objects.get(root + '/builds/' + timedOut.id + '_build_' + timeoutResult.body.build_id + '.json');
  assert.equal(timeoutBuild.retry_count, 2);
  const failedSession = await call('sessions/' + timedOut.id, 'GET');
  assert.equal(failedSession.body.session.messages.some(message => message.role === 'teacher'), true, 'Conversation/Brief context must survive a failed build');
  assert.equal(failedSession.body.session.brief.selected_direction, 'แนวทางคงเดิมเมื่อ Build ล้มเหลว');

  const malformed = await seed('สื่อคำศัพท์');
  replies = [providerResponse('not json')];
  const malformedResult = await call('sessions/' + malformed.id + '/build');
  assert.equal(malformedResult.body.error_category, 'invalid_response_schema');

  replies = [providerResponse(artifact())];
  const runtimeRepair = await call('sessions/' + selected.id + '/runtime-error', 'POST', { run_id: retried.body.run.id });
  assert.equal(runtimeRepair.statusCode, 200);
  assert.notEqual(runtimeRepair.body.run.id, retried.body.run.id);
  const callsAfterRuntimeRepair = providerCalls;
  const duplicateRuntimeRepair = await call('sessions/' + selected.id + '/runtime-error', 'POST', { run_id: retried.body.run.id });
  assert.equal(duplicateRuntimeRepair.statusCode, 409);
  assert.equal(providerCalls, callsAfterRuntimeRepair, 'Runtime repair must be capped at one attempt per run');
});
