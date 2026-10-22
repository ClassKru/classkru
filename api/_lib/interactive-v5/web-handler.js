'use strict';

const fs = require('node:fs');
const pathModule = require('node:path');
const { authenticatedUser } = require('../supabase-user');
const { verifySession: verifyDeveloperSession } = require('../dev-auth');
const { requestOriginIsValid, sendJson } = require('../http');
const db = require('../supabase-admin');
const storage = require('../media-db');
const { createTaskStore } = require('./cloud/task-store');
const { createCloudConversation } = require('./cloud/cloud-conversation');
const { createCloudBuild } = require('./cloud/cloud-build');
const { createPreviewTickets } = require('./cloud/preview-tickets');
const { createTeacherSettingsStore } = require('./cloud/teacher-settings');
const { createBriefVersionCatalog } = require('./cloud/brief-version-catalog');
const conversation = require('./conversation-ai/service');
const conversationConfig = require('./conversation-ai/config');
const conversationProvider = require('./conversation-ai/openrouter-provider');
const { cards } = require('./conversation-ai/card-registry');
const architect = require('./prompt-architect-ai/service');
const architectConfig = require('./prompt-architect-ai/config');
const architectProvider = require('./prompt-architect-ai/openrouter-provider');
const builder = require('./html-media-builder-ai/service');
const builderConfig = require('./html-media-builder-ai/config');
const builderProvider = require('./html-media-builder-ai/openrouter-provider');
const { createCloudArtifactStore } = require('./html-media-builder-ai/cloud-artifact-store');
const { createRuntimePreviewService, RUNTIME_CSP, runtimeCspForHost } = require('./html-media-builder-ai/runtime-preview');
const { createLocalModelCatalog } = require('./interactive-orchestrator/local-model-catalog');

const briefVersions = createBriefVersionCatalog({ root: pathModule.resolve(process.cwd(), 'brief-versions') });
const modelCatalog = createLocalModelCatalog();
const artifactStoreForTeacher = teacherId => createCloudArtifactStore({ storage, teacherId });
const taskStoreForTeacher = teacherId => createTaskStore({ db, teacherId });
const previewTickets = createPreviewTickets({
  storage,
  artifactStoreForTeacher,
  previewAllowed: async (teacherId, jobId, artifactId) => {
    const row = await taskStoreForTeacher(teacherId).findByJobId(jobId);
    return Boolean(row && !row.state.deletion_pending && (row.state.jobs || []).some(job =>
      job.id === jobId && job.state === 'succeeded' && job.artifact_id === artifactId));
  }
});

function fail(code) { return Object.assign(new Error(code), { code }); }
function pathParts(req) {
  return Array.isArray(req.query?.path) ? req.query.path : String(req.query?.path || '').split('/').filter(Boolean);
}
function bodyOf(req) {
  let body = req.body || {};
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > 32000) throw Object.assign(fail('body_too_large'), { status: 413 });
    try { body = JSON.parse(body); } catch (_) { throw fail('invalid_json'); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > 32000) throw fail('invalid_body');
  return body;
}
function errorStatus(error) {
  const code = String(error?.code || '');
  if (error.status) return error.status;
  if (['authentication_required', 'invalid_session'].includes(code)) return 401;
  if (['developer_access_required'].includes(code)) return 403;
  if (['task_conflict_or_not_found', 'conversation_request_in_progress', 'task_deletion_pending'].includes(code)) return 409;
  if (code.endsWith('_not_found')) return 404;
  if (/^(invalid_|.*_invalid$|.*_required$|brief_not_ready_for_confirmation$|revision_(scope|content)_confirmation_required$|job_not_retryable$)/.test(code)) return 400;
  return 500;
}
async function checkTeacherDatabase(teacherId) {
  db.configuration();
  const filters = { teacher_id: `eq.${teacherId}` };
  await db.selectRows('interactive_v5_tasks', { filters, limit: 1 });
  await db.selectRows('interactive_v5_settings', { filters, limit: 1 });
}

function withFallback(config, env, extraKeys = []) {
  return { ...config, apiKey: config.apiKey || extraKeys.map(key => env[key]).find(value => typeof value === 'string' && value.trim()) || '' };
}
function withCloudTimeout(config, maxMs, maxRetries) {
  return { ...config, timeoutMs: Math.min(config.timeoutMs, maxMs), ...(Number.isInteger(maxRetries) ? { maxRetries: Math.min(config.maxRetries, maxRetries) } : {}) };
}
function providerForRole(provider, role, modelId, env) {
  return Object.freeze({ respond(input) {
    const selectedConfig = { ...input.config, modelId };
    if (role === 'conversation') {
      selectedConfig.reasoningEffort = conversationConfig.fromEnvironment({ ...env, CONVERSATION_MODEL_ID: modelId }).reasoningEffort;
    }
    if (role === 'architect') {
      selectedConfig.reasoningEffort = architectConfig.fromEnvironment({ ...env, ARCHITECT_MODEL_ID: modelId }).reasoningEffort;
    }
    return provider.respond({ ...input, config: selectedConfig });
  } });
}

function createServices(teacherId, env = process.env) {
  const settings = createTeacherSettingsStore({
    db,
    teacherId,
    defaults: {
      conversation: conversationConfig.fromEnvironment(env).modelId,
      architect: architectConfig.fromEnvironment(env).modelId,
      builder: builderConfig.fromEnvironment(env).modelId
    },
    briefVersions
  });
  return settings.getModels().then(async models => {
    const version = await settings.getBriefVersion();
    const artifactStore = artifactStoreForTeacher(teacherId);
    const runtime = createRuntimePreviewService({ artifactStore, runtimeBasePath: '/api/v5/runtime' });
    const conversationClient = conversation.createConversationService({
      provider: providerForRole(conversationProvider.createOpenRouterProvider(), 'conversation', models.conversation, env),
      config: withFallback(conversationConfig.fromEnvironment(env), env, ['CONVERSATION_OPENROUTER_API_KEY', 'OPENROUTER_MEDIA_PLANNER_API_KEY', 'OPENROUTER_API_KEY']),
      buildRequest: briefVersions.builder(version, 'conversation')
    });
    const architectClient = architect.createPromptArchitectService({
      provider: providerForRole(architectProvider.createOpenRouterProvider(), 'architect', models.architect, env),
      config: withCloudTimeout(withFallback(architectConfig.fromEnvironment(env), env, ['ARCHITECT_OPENROUTER_API_KEY', 'OPENROUTER_MEDIA_PLANNER_API_KEY', 'OPENROUTER_API_KEY']), 60000),
      buildRequest: briefVersions.builder(version, 'architect')
    });
    const builderClient = builder.createHtmlMediaBuilderService({
      provider: providerForRole(builderProvider.createOpenRouterProvider(), 'builder', models.builder, env),
      config: withCloudTimeout(withFallback(builderConfig.fromEnvironment(env), env, ['BUILDER_OPENROUTER_API_KEY', 'OPENROUTER_MEDIA_PLANNER_API_KEY', 'OPENROUTER_API_KEY']), 75000, 1),
      artifactStore,
      runtimePreview: runtime,
      buildRequest: briefVersions.builder(version, 'builder')
    });
    const store = taskStoreForTeacher(teacherId);
    return {
      settings,
      store,
      conversation: createCloudConversation({ store, conversationClient, teacherId }),
      build: createCloudBuild({ store, conversationClient, architectClient, builderClient, artifactStore })
    };
  });
}

function createInteractiveV5Handler({ authenticate = authenticatedUser, originIsValid = requestOriginIsValid, respond = sendJson, env = process.env, checkDatabase = checkTeacherDatabase, storageIsReady = () => storage.checkBucket(), servicesForTeacher = createServices } = {}) {
  return async function handle(req, res) {
    if (env.INTERACTIVE_V5_WEB_ENABLED !== 'true') return respond(res, 503, { error: 'interactive_v5_not_enabled' });
    const parts = pathParts(req);
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) return respond(res, 405, { error: 'method_not_allowed' });

    if (req.method === 'GET' && parts.length === 1 && ['three', 'three-module', 'three-core'].includes(parts[0])) {
      try {
        const filename = parts[0] === 'three-core' ? 'three.core.js' : 'three.module.js';
        const source = fs.readFileSync(pathModule.join(pathModule.dirname(require.resolve('three')), filename), 'utf8');
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.status(200).send(source);
      } catch (_) { return respond(res, 503, { error: 'three_runtime_unavailable' }); }
    }
    if (req.method === 'GET' && parts[0] === 'preview' && parts.length === 2) {
      try {
        const preview = await previewTickets.load(parts[1]);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Content-Security-Policy', runtimeCspForHost(req.headers?.host, preview.csp || RUNTIME_CSP));
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        return res.status(200).send(preview.html);
      } catch (_) { return respond(res, 404, { error: 'preview_not_found' }); }
    }
    if (!originIsValid(req)) return respond(res, 403, { error: 'invalid_origin' });
    try {
      const user = await authenticate(req);
      if (!user?.id) return respond(res, 401, { error: 'authentication_required' });

      if (req.method === 'GET' && parts.length === 1 && parts[0] === 'status') {
        const commonKey = Boolean(env.OPENROUTER_API_KEY);
        const plannerKey = Boolean(env.OPENROUTER_MEDIA_PLANNER_API_KEY);
        const readiness = {
          conversation_configured: Boolean(env.CONVERSATION_OPENROUTER_API_KEY || plannerKey || commonKey),
          architect_configured: Boolean(env.ARCHITECT_OPENROUTER_API_KEY || plannerKey || commonKey),
          builder_configured: Boolean(env.BUILDER_OPENROUTER_API_KEY || plannerKey || commonKey)
        };
        let databaseReady = false;
        try { await checkDatabase(user.id); databaseReady = true; } catch (_) { /* expose readiness, not database details */ }
        let storageReady = false;
        try { storageReady = Boolean(await storageIsReady()); } catch (_) { /* expose readiness, not storage details */ }
        const aiConfigured = Object.values(readiness).every(Boolean);
        return respond(res, 200, { mode: 'live', show_task_usage: false, ...readiness, ai_configured: aiConfigured, database_ready: databaseReady, storage_ready: storageReady, ready: aiConfigured && databaseReady && storageReady });
      }
      if (req.method === 'GET' && parts.length === 1 && parts[0] === 'cards') {
        return respond(res, 200, { cards: cards.map(({ id, group, title, description }) => ({ id, group, title, description })) });
      }
      if (!await storageIsReady()) return respond(res, 503, { error: 'storage_not_configured' });

      const developerOnlyRoute = parts.length === 1 && ['models', 'model-settings', 'brief-versions'].includes(parts[0]);
      if (developerOnlyRoute && !verifyDeveloperSession(req).ok) {
        return respond(res, 403, { error: 'developer_access_required' });
      }

      const services = await servicesForTeacher(user.id, env);
      if (req.method === 'GET' && parts.length === 1 && parts[0] === 'models') {
        const models = await modelCatalog.list({ refresh: req.query?.refresh === '1' });
        return respond(res, 200, { models, default_models: services.settings.defaults() });
      }
      if (req.method === 'GET' && parts.length === 1 && parts[0] === 'model-settings') {
        return respond(res, 200, { models: await services.settings.getModels(), default_models: services.settings.defaults() });
      }
      if (req.method === 'POST' && parts.length === 1 && parts[0] === 'model-settings') {
        const body = bodyOf(req);
        return respond(res, 200, { models: await services.settings.saveModels(body.models) });
      }
      if (req.method === 'GET' && parts.length === 1 && parts[0] === 'brief-versions') {
        return respond(res, 200, briefVersions.status(await services.settings.getBriefVersion()));
      }
      if (req.method === 'POST' && parts.length === 1 && parts[0] === 'brief-versions') {
        const body = bodyOf(req);
        const selected = await services.settings.saveBriefVersion(body.version);
        return respond(res, 200, briefVersions.status(selected));
      }
      if (req.method === 'GET' && parts.length === 1 && parts[0] === 'library') {
        return respond(res, 200, { items: await services.build.library() });
      }
      if (req.method === 'GET' && parts[0] === 'conversations' && parts.length === 3 && parts[2] === 'usage') {
        return respond(res, 200, { mode: 'live', usage: { call_count: 0, by_service: [] } });
      }
      if (req.method === 'POST' && parts.length === 1 && parts[0] === 'idea-discovery') {
        const body = bodyOf(req);
        const result = await services.conversation.startIdeaDiscovery({
          subjects: [], subjectStatus: 'unavailable', startKey: body.start_key,
          message: body.message, mediaMode: body.media_mode
        });
        return respond(res, 201, result);
      }
      if (parts[0] === 'conversations') {
        const body = req.method === 'POST' ? bodyOf(req) : {};
        if (req.method === 'POST' && parts.length === 1) return respond(res, 201, { conversation: await services.conversation.start(body.card_context || null, body.start_key || null, body.media_mode) });
        if (req.method === 'GET' && parts.length === 2) return respond(res, 200, { conversation: await services.conversation.get(parts[1]) });
        if (req.method === 'POST' && parts.length === 3 && parts[2] === 'card-context') return respond(res, 200, { conversation: await services.conversation.changeCards(parts[1], body.card_context || {}) });
        if (req.method === 'POST' && parts.length === 3 && parts[2] === 'messages') return respond(res, 200, { conversation: await services.conversation.send(parts[1], body.message, body.request_key || require('node:crypto').randomUUID()) });
        if (req.method === 'POST' && parts.length === 3 && parts[2] === 'confirm') return respond(res, 202, await services.build.confirm({ conversationId: parts[1], editedDraft: body.edited_draft, parentJobId: body.parent_job_id, idempotencyKey: body.idempotency_key }));
      }
      if (parts[0] === 'jobs' && parts.length >= 2) {
        if (req.method === 'GET' && parts.length === 2) return respond(res, 200, { job: await services.build.get(parts[1]) });
        if (req.method === 'DELETE' && parts.length === 2) return respond(res, 200, await services.build.deleteTask(parts[1]));
        if (req.method === 'POST' && parts.length === 3 && parts[2] === 'preview') {
          const artifact = await services.build.preview(parts[1]);
          const ticket = await previewTickets.issue(user.id, artifact.id, parts[1]);
          return respond(res, 200, { preview_url: `/api/v5/preview/${ticket.id}`, expires_at: ticket.expires_at });
        }
        if (req.method === 'POST' && parts.length === 3 && parts[2] === 'process') return respond(res, 200, { job: await services.build.process(parts[1]) });
        if (req.method === 'POST' && parts.length === 3 && parts[2] === 'retry') return respond(res, 200, { job: await services.build.retry(parts[1]) });
        if (req.method === 'POST' && parts.length === 3 && parts[2] === 'revise') {
          const body = bodyOf(req);
          return respond(res, 202, await services.build.revise({ parentJobId: parts[1], instruction: body.instruction, idempotencyKey: body.idempotency_key, confirmedScope: body.confirmed_scope === true }));
        }
      }
      return respond(res, 404, { error: 'not_found' });
    } catch (error) {
      const code = typeof error?.code === 'string' && /^[a-z0-9_]+$/i.test(error.code) ? error.code.toLowerCase() : 'server_unavailable';
      return respond(res, errorStatus(error), { error: code });
    }
  };
}

const defaultHandler = createInteractiveV5Handler();
module.exports = defaultHandler;
module.exports.createInteractiveV5Handler = createInteractiveV5Handler;

