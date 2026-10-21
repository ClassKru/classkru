'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createCloudBuild } = require('../api/_lib/interactive-v5/cloud/cloud-build');

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
