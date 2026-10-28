'use strict';

const fs = require('node:fs');
const { authenticatedUser } = require('../../../api/_lib/supabase-user');
const { sendJson, parseBody, requestOriginIsValid } = require('../../../api/_lib/http');
const navigation = require('../lib/navigation');
const briefs = require('../lib/brief-store');
const openrouter = require('../lib/openrouter');
const { isClassKruMediaDeveloper } = require('../../../api/_lib/classkru-developers');
const requests = new Map();
const conversations = new Map();
const crypto = require('node:crypto');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actionIds = new Set(navigation.registry.map(entry => entry.id));
const executionResults = new Set(['navigated', 'blocked', 'failed']);
const modelIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._:-]*$/;

function resolveModelId(brief, env) {
  const settingsPathEnv = brief.config.modelSettingsPathEnv;
  const settingsPath = settingsPathEnv ? String(env[settingsPathEnv] || '') : '';
  const settingsRole = String(brief.config.modelSettingsRole || 'conversation');
  if (settingsPath) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const selected = settings?.[settingsRole];
      if (typeof selected === 'string' && modelIdPattern.test(selected)) return selected;
    } catch (_) {}
  }
  return String(env[brief.config.modelEnv] || env[brief.config.fallbackModelEnv] || '');
}

function logRecord(logger, record) {
  try { logger(JSON.stringify(record)); } catch (_) {}
}
function cleanUsage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const output = {};
  for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens', 'cost']) {
    if (value[key] == null || value[key] === '') continue;
    const number = Number(value[key]);
    if (Number.isFinite(number) && number >= 0) output[key] = number;
  }
  return Object.keys(output).length ? output : null;
}

function createHandler({ authenticate = authenticatedUser, originIsValid = requestOriginIsValid, provider, isDeveloper = user => isClassKruMediaDeveloper(user?.email), env = process.env, now = Date.now, logger = record => console.info(record) } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
    if (!originIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });
    if (env.CLASSKRU_AI_NAV_ENABLED !== 'true') return sendJson(res, 503, { error: 'navigation_disabled' });
    const body = parseBody(req);
    try {
      if (Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(body)) > 32000) return sendJson(res, 413, { error: 'request_too_large' });
    } catch { return sendJson(res, 400, { error: 'invalid_request' }); }
    let user;
    try { user = await authenticate(req); } catch { return sendJson(res, 401, { error: 'authentication_required' }); }
    if (!user?.id) return sendJson(res, 401, { error: 'authentication_required' });
    const hasDeveloperAccess = Boolean(isDeveloper(user));
    if (body.event === 'execution') {
      if (!hasDeveloperAccess) return sendJson(res, 403, { error: 'developer_access_required' });
      if (!actionIds.has(body.action) || !executionResults.has(body.result)) return sendJson(res, 400, { error: 'invalid_execution_event' });
      logRecord(logger, { event: 'classkru_ai_navigation_execution', requestId: String(body.requestId || '').slice(0, 64), briefVersion: String(body.briefVersion || '').slice(0, 40), action: body.action, result: body.result });
      return sendJson(res, 200, { ok: true });
    }
    const message = String(body.message || '').trim();
    if (message.length < 2 || message.length > 1000) return sendJson(res, 400, { error: 'invalid_message' });
    let catalog;
    try { catalog = briefs.catalog(); } catch { return sendJson(res, 503, { error: 'brief_unavailable' }); }
    const conversationId = typeof body.conversationId === 'string' && uuidPattern.test(body.conversationId)
      ? body.conversationId.toLowerCase() : body.conversationId ? '' : crypto.randomUUID();
    if (!conversationId) return sendJson(res, 400, { error: 'invalid_conversation' });
    const sessionKey = `${user.id}:${conversationId}`;
    for (const [key, session] of conversations) if (session.expiresAt <= now()) conversations.delete(key);
    const priorSession = conversations.get(sessionKey);
    const requestedVersion = body.briefVersion ? String(body.briefVersion) : null;
    if (priorSession && requestedVersion && requestedVersion !== priorSession.versionId) return sendJson(res, 409, { error: 'brief_version_changed' });
    if (requestedVersion && !hasDeveloperAccess && requestedVersion !== catalog.activeVersion) return sendJson(res, 409, { error: 'active_version_changed' });
    if (requestedVersion && hasDeveloperAccess && !catalog.versions.some(version => version.id === requestedVersion)) return sendJson(res, 400, { error: 'invalid_brief_version' });
    const versionId = priorSession?.versionId || requestedVersion || catalog.activeVersion;
    let brief;
    try { brief = briefs.load(versionId); } catch { return sendJson(res, 400, { error: 'invalid_brief_version' }); }
    conversations.set(sessionKey, { versionId, expiresAt: now() + 30 * 60 * 1000 });
    const stamp = now();
    const recent = (requests.get(user.id) || []).filter(time => stamp - time < 60000);
    if (recent.length >= 12) return sendJson(res, 429, { error: 'rate_limited' });
    recent.push(stamp);
    requests.set(user.id, recent);
    const context = {
      screen: String(body.context?.screen || '').slice(0, 40),
      selectedClassId: String(body.context?.selectedClassId || '').slice(0, 100) || null
    };
    const history = navigation.cleanHistory(body.history).slice(-Math.min(16, Number(brief.config.maxHistoryTurns) || 8));
    const requestId = crypto.randomUUID();
    const startedAt = now();
    const modelId = resolveModelId(brief, env);
    const requestEnv = { ...env, [brief.config.modelEnv]: modelId };
    try {
      let result;
      if (provider) {
        result = await provider(message, context, history, { brief, actionRegistry: navigation.registry });
      } else if (env.CLASSKRU_AI_NAV_PROVIDER === 'openrouter') {
        result = await openrouter.respond({ message, context, history, brief, actionRegistry: navigation.registry, env: requestEnv });
      } else {
        result = { answer: navigation.mockReply(message, context), usage: null, modelId: 'mock' };
      }
      const answer = navigation.validateAnswer(result?.answer || result);
      const usedModel = String(result?.modelId || modelId || 'mock');
      const tokenUsage = cleanUsage(result?.usage);
      if (hasDeveloperAccess) logRecord(logger, { event: 'classkru_ai_navigation_request', requestId, briefVersion: brief.id, modelId: usedModel, action: answer.action?.target || null, actionValidation: 'accepted', latencyMs: Math.max(0, now() - startedAt), tokenUsage, errorType: null });
      return sendJson(res, 200, { ...answer, briefVersion: brief.id, conversationId, requestId, ...(hasDeveloperAccess ? { modelId: usedModel, tokenUsage } : {}) });
    } catch (error) {
      const code = ['invalid_brief_version', 'action_not_allowed', 'invalid_ai_response', 'provider_timeout', 'provider_rate_limited', 'provider_not_configured'].includes(error?.code || error?.message)
        ? (error.code || error.message) : 'provider_unavailable';
      if (hasDeveloperAccess) logRecord(logger, { event: 'classkru_ai_navigation_request', requestId, briefVersion: brief.id, modelId: modelId || 'mock', action: null, actionValidation: code === 'action_not_allowed' ? 'rejected' : 'not_available', latencyMs: Math.max(0, now() - startedAt), tokenUsage: null, errorType: code });
      return sendJson(res, 502, { error: code });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.cleanUsage = cleanUsage;
module.exports.resolveModelId = resolveModelId;
