'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createCloudBuild } = require('../api/_lib/interactive-v5/cloud/cloud-build');
const { createOpenRouterProvider } = require('../api/_lib/interactive-v5/prompt-architect-ai/openrouter-provider');

function createStore(initial) {
  const rows = new Map([[initial.id, { ...initial, revision: 0 }]]);
  const clone = value => structuredClone(value);
  return {
    async get(id) { const row = rows.get(id); return row ? clone(row) : null; },
    async list() { return [...rows.values()].map(clone); },
    async findByJobId(jobId) { return [...rows.values()].find(row => row.state.jobs.some(job => job.id === jobId)) ? clone([...rows.values()].find(row => row.state.jobs.some(job => job.id === jobId))) : null; },
    async update(id, revision, state) {
      const row = rows.get(id);
      if (!row || row.revision !== revision) throw Object.assign(new Error('task_conflict_or_not_found'), { code: 'task_conflict_or_not_found' });
      const updated = { ...row, state: clone(state), revision: revision + 1 };
      rows.set(id, updated);
      return clone(updated);
    },
    async delete(id, revision) { const row = rows.get(id); if (!row || row.revision !== revision) throw new Error('conflict'); rows.delete(id); return true; }
  };
}

test('V5 cloud build exposes a process operation and persists a successful artifact', async () => {
  const conversation = { id: 'conversation-1', status: 'draft', draft: {} };
  const store = createStore({ id: 'conversation-1', state: { conversation, jobs: [], active_operation: null } });
  let buildCalls = 0;
  const build = createCloudBuild({
    store,
    conversationClient: { confirm: () => ({ brief: { learning: { topic: 'แรงโน้มถ่วง' } }, conversation: { ...conversation, status: 'confirmed' } }) },
    architectClient: { createSpecification: async () => ({ specification: { media: { title: 'ทดลองแรงโน้มถ่วง' } } }) },
    builderClient: { build: async () => { buildCalls++; return { artifact_id: 'artifact-1' }; } },
    artifactStore: { deleteValidated: async () => true },
    idFactory: (() => { let id = 0; return () => `job-${++id}`; })()
  });

  const accepted = await build.confirm({ conversationId: 'conversation-1', editedDraft: {}, idempotencyKey: 'request-1' });
  assert.equal(accepted.job.state, 'queued');
  const result = await build.process(accepted.job.id);
  assert.equal(result.state, 'succeeded');
  assert.equal(result.artifact_id, 'artifact-1');
  assert.equal(buildCalls, 1);
  assert.equal((await build.get(accepted.job.id)).state, 'succeeded');
});

test('V5 cloud retry queues a retryable failure and processes it without relying on method binding', async () => {
  const job = { id: 'job-retry', state: 'retryable_failed', error: { code: 'html_builder_timeout' }, specification: { media: { title: 'ทดลอง' } }, brief: {} };
  const store = createStore({ id: 'conversation-1', state: { conversation: { id: 'conversation-1' }, jobs: [job], active_operation: null } });
  const build = createCloudBuild({
    store,
    conversationClient: {}, architectClient: {},
    builderClient: { build: async () => ({ artifact_id: 'artifact-retry' }) },
    artifactStore: { deleteValidated: async () => true }
  });
  const result = await build.retry(job.id);
  assert.equal(result.state, 'succeeded');
  assert.equal(result.artifact_id, 'artifact-retry');
});

test('V5 cloud build preserves safe Architect response diagnostics without provider usage or response text', async () => {
  const conversation = { id: 'conversation-diagnostics', status: 'draft', draft: {} };
  const store = createStore({ id: conversation.id, state: { conversation, jobs: [], active_operation: null } });
  const build = createCloudBuild({
    store,
    conversationClient: { confirm: () => ({ brief: { learning: { topic: 'เศษส่วน' } }, conversation: { ...conversation, status: 'confirmed' } }) },
    architectClient: { createSpecification: async () => { throw Object.assign(new Error('provider detail should not persist'), { code: 'prompt_architect_invalid_response', attempts: [
      { reason: 'invalid_json', finish_reason: 'stop', usage: { total_tokens: 123, cost: 4.5 }, response: '{secret provider response}' },
      { reason: 'truncated_output', finish_reason: 'length', usage: { total_tokens: 456, cost: 9.1 } }
    ] }); } },
    builderClient: { build: async () => assert.fail('Builder must not run when Architect fails') },
    artifactStore: { deleteValidated: async () => true }
  });

  const accepted = await build.confirm({ conversationId: conversation.id, editedDraft: {}, idempotencyKey: 'request-diagnostics' });
  const failed = await build.process(accepted.job.id);
  assert.equal(failed.state, 'retryable_failed');
  assert.deepEqual(failed.error, {
    code: 'prompt_architect_invalid_response', retryable: true,
    attempts: [
      { reason: 'invalid_json', finish_reason: 'stop' },
      { reason: 'truncated_output', finish_reason: 'length' }
    ]
  });
  assert.equal(JSON.stringify(failed.error).includes('provider response'), false);
  assert.equal(JSON.stringify(failed.error).includes('cost'), false);
});

test('Prompt Architect can recover a JSON object wrapped in provider-added text and code fences', async () => {
  const provider = createOpenRouterProvider({ fetchImpl: async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: 'Specification follows:\n```json\n{"title":"curly } brace","nested":{"ok":true}}\n```\nDone.' } }], usage: {} })
  }) });
  const result = await provider.respond({ config: { apiKey: 'test-key', modelId: 'test/model', timeoutMs: 1000, maxTokens: 100 }, request: { systemPrompt: '', messages: [] } });
  assert.deepEqual(result.data, { title: 'curly } brace', nested: { ok: true } });
  assert.equal(result.attempts[0].reason, 'parsed');
});

test('Prompt Architect identifies output truncation across its two formatting attempts', async () => {
  const provider = createOpenRouterProvider({ fetchImpl: async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '{"schema_version":"1.1"' } }], usage: {} })
  }) });
  await assert.rejects(
    provider.respond({ config: { apiKey: 'test-key', modelId: 'test/model', timeoutMs: 1000, maxTokens: 100 }, request: { systemPrompt: '', messages: [] } }),
    error => error.code === 'prompt_architect_invalid_response' && error.attempts.length === 2 && error.attempts.every(attempt => attempt.reason === 'truncated_output' && attempt.finish_reason === 'length')
  );
});
