'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createCloudBuild, RETRYABLE } = require('../api/_lib/interactive-v5/cloud/cloud-build');
const { createOpenRouterProvider } = require('../api/_lib/interactive-v5/prompt-architect-ai/openrouter-provider');
const { createOpenRouterProvider: createHtmlBuilderProvider } = require('../api/_lib/interactive-v5/html-media-builder-ai/openrouter-provider');
const { normalizeSpecification } = require('../api/_lib/interactive-v5/prompt-architect-ai/contracts');
const { validateBuildSpecification } = require('../api/_lib/interactive-v5/html-media-builder-ai/contracts');
const architectConfig = require('../api/_lib/interactive-v5/prompt-architect-ai/config');

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

test('V5 library includes saved conversations without media and omits tasks pending deletion', async () => {
  const conversation = {
    id: 'conversation-unsaved',
    status: 'draft',
    created_at: '2026-10-22T01:00:00.000Z',
    draft: { topic: 'วัฏจักรน้ำ' },
    turns: [{ role: 'teacher', content: 'อยากสอนเรื่องวัฏจักรน้ำ ป.6' }]
  };
  const store = createStore({ id: conversation.id, state: { conversation, jobs: [], active_operation: null } });
  store.list = async () => [
    { id: conversation.id, created_at: conversation.created_at, updated_at: conversation.created_at, state: { conversation, jobs: [], active_operation: null } },
    { id: 'conversation-deleting', state: { conversation: { id: 'conversation-deleting', draft: { topic: 'ไม่ควรแสดง' } }, jobs: [], deletion_pending: true } }
  ];
  const build = createCloudBuild({ store, conversationClient: {}, architectClient: {}, builderClient: {} });

  assert.deepEqual(await build.library(), [{
    type: 'conversation',
    id: 'conversation-unsaved',
    conversation_id: 'conversation-unsaved',
    job_id: null,
    title: 'วัฏจักรน้ำ',
    created_at: '2026-10-22T01:00:00.000Z'
  }]);
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

test('Prompt Architect classifies provider errors without logging response text', async () => {
  const diagnostics = [];
  const provider = createOpenRouterProvider({
    fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'Provider returned an error', code: 400, metadata: { provider_name: 'OpenAI', raw: JSON.stringify({ error: { message: "Invalid schema: 'minItems' is not permitted", type: 'invalid_request_error', param: 'response_format', code: 'invalid_json_schema' } }) } } }) }),
    logger: { error: (...args) => diagnostics.push(args) }
  });

  await assert.rejects(
    provider.respond({ config: { apiKey: 'private-test-key', modelId: 'openai/gpt-6-luna', timeoutMs: 1000, maxTokens: 100 }, request: { systemPrompt: 'private prompt', messages: [] } }),
    error => error.code === 'prompt_architect_provider_unavailable'
  );
  assert.deepEqual(diagnostics, [[
    '[interactive-v5 prompt architect] OpenRouter request failed',
    {
      kind: 'http', status: 400, category: 'structured_output', field: 'minitems',
      error_fields: ['code', 'message', 'metadata'], metadata_fields: ['provider_name', 'raw'],
      raw_fields: ['error'], raw_error_fields: ['code', 'type', 'param', 'message'], provider: 'OpenAI'
    }
  ]]);
  assert.equal(JSON.stringify(diagnostics).includes('private'), false);
  assert.equal(JSON.stringify(diagnostics).includes('Invalid schema'), false);
});
test('HTML Builder recovers a valid artifact from provider prose, code fences, and content parts', async () => {
  const artifact = { title: 'เกมพยัญชนะ', summary: 'ฝึกจับคู่', html: '<!doctype html><html lang="th"><head><title>เกม</title></head><body>พร้อม</body></html>' };
  let calls = 0;
  const provider = createHtmlBuilderProvider({ fetchImpl: async () => {
    calls++;
    return ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: [{ type: 'text', text: `ผลลัพธ์\n\`\`\`json\n${JSON.stringify(artifact)}\n\`\`\`` }] } }], usage: { total_tokens: 123 } })
    });
  } });
  const result = await provider.respond({ config: { apiKey: 'test-key', modelId: 'test/model', timeoutMs: 1000, maxTokens: 100 }, request: { systemPrompt: '', messages: [] } });
  assert.deepEqual(result.data, artifact);
  assert.equal(calls, 1);
});

test('V5 marks recoverable Builder output failures as retryable jobs', () => {
  assert.equal(RETRYABLE.has('html_builder_invalid_response'), true);
  assert.equal(RETRYABLE.has('artifact_response_invalid'), true);
  assert.equal(RETRYABLE.has('artifact_validation_failed'), true);
});

test('V5 requires a concrete 3D scene brief before a Three.js build can start', () => {
  const brief = { schema_version: '1.1', brief_id: 'brief-3d', revision: 1, media_intent: { type: null, type_requirement: 'open', interaction_preference: 'ai_decides' } };
  const specification = {
    schema_version: '1.1', brief_ref: { brief_id: 'brief-3d', revision: 1 },
    media: { title: 'เรียงพยัญชนะไทย', format: 'single-page-html', presentation_type: 'game', rendering_strategy: 'html-css-three-js', presentation_strategy: 'บัตรพยัญชนะลอยในห้องเรียน', design_rationale: 'ให้เห็นลำดับผ่านตำแหน่งในฉาก' },
    three_d_scene: { scene: 'ห้องเรียนที่มีบัตรพยัญชนะลอยตามลำดับ', learning_focus: 'ตำแหน่งซ้ายไปขวาช่วยให้เห็นลำดับ ก–ฮ', objects: ['บัตรพยัญชนะ', 'รางลำดับ'], camera: 'มุมมองด้านหน้าเห็นรางครบ', learner_action: 'เลือกบัตรตามลำดับ', fallback: 'รางบัตรพยัญชนะ 2D ที่เลือกและเรียงได้' },
    learning_design: { intent: 'เรียงพยัญชนะไทย', objective_alignment: ['เรียง ก–ฮ ได้'], learner_experience: ['เลือกบัตร', 'ตรวจลำดับ'], academic_rules: ['ใช้ลำดับพยัญชนะไทย'] },
    interaction: { requirement: 'required', primary_action: 'เลือกบัตร', media_response: 'บัตรเลื่อนไปยังราง', states: ['เริ่มต้น'], feedback_rules: ['บอกว่าลำดับถูกหรือผิด'] },
    content: { key_concepts: ['พยัญชนะไทย'], teacher_review_required: [] },
    ui: { components: ['ฉาก', 'ปุ่มเริ่มใหม่'], responsive_viewports: ['390x844'], accessibility_requirements: ['ควบคุมด้วยแป้นพิมพ์'] },
    html_requirements: { single_page: true, document_structure: ['doctype'], max_html_characters: 30000 },
    runtime_requirements: { network: 'deny', persistent_storage: 'deny', external_dependencies: 'deny', allowed_browser_apis: [] },
    acceptance_criteria: ['เรียงบัตรได้']
  };
  const normalized = normalizeSpecification(specification, brief);
  assert.equal(normalized.three_d_scene.scene, specification.three_d_scene.scene);
  assert.equal(validateBuildSpecification(normalized).three_d_scene.fallback, specification.three_d_scene.fallback);
  assert.throws(() => normalizeSpecification({ ...specification, three_d_scene: null }, brief), error => error.code === 'build_specification_invalid');
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

test('Prompt Architect disables GPT-6 reasoning by default so the structured answer is not consumed by hidden reasoning', async () => {
  assert.equal(architectConfig.fromEnvironment({}).reasoningEffort, 'none');
  assert.equal(architectConfig.fromEnvironment({ ARCHITECT_MODEL_ID: 'google/gemini-2.5-flash' }).reasoningEffort, null);
  assert.equal(architectConfig.fromEnvironment({ ARCHITECT_REASONING_EFFORT: 'low' }).reasoningEffort, 'low');

  let requestBody;
  const provider = createOpenRouterProvider({ fetchImpl: async (_url, request) => {
    requestBody = JSON.parse(request.body);
    return { ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }], usage: {} }) };
  } });
  await provider.respond({ config: { apiKey: 'test-key', modelId: 'openai/gpt-6-luna', reasoningEffort: 'none', timeoutMs: 1000, maxTokens: 100 }, request: { systemPrompt: '', messages: [] } });
  assert.deepEqual(requestBody.reasoning, { effort: 'none' });
});

test('Prompt Architect classifies a missing response after token exhaustion as truncated output', async () => {
  const provider = createOpenRouterProvider({ fetchImpl: async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ finish_reason: 'length', message: { content: null } }], usage: {} })
  }) });
  await assert.rejects(
    provider.respond({ config: { apiKey: 'test-key', modelId: 'test/model', timeoutMs: 1000, maxTokens: 100 }, request: { systemPrompt: '', messages: [] } }),
    error => error.code === 'prompt_architect_invalid_response' && error.attempts.every(attempt => attempt.reason === 'truncated_output')
  );
});

