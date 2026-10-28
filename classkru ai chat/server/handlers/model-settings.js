'use strict';

const fs = require('node:fs');
const { authenticatedUser } = require('../../../api/_lib/supabase-user');
const { sendJson, parseBody, requestOriginIsValid } = require('../../../api/_lib/http');
const briefs = require('../lib/brief-store');
const { createModelCatalog, MODEL_ID } = require('../lib/model-catalog');
const navigation = require('./navigation');
const { isClassKruMediaDeveloper } = require('../../../api/_lib/classkru-developers');

const modelCatalog = createModelCatalog();

function settingsPath(brief, env) {
  const key = brief.config.modelSettingsPathEnv;
  return key ? String(env[key] || '') : '';
}

function canWriteSettings(file) {
  if (!file) return false;
  try { const stat = fs.lstatSync(file); return stat.isFile() && !stat.isSymbolicLink(); }
  catch (_) { return false; }
}

function saveConversationModel(file, modelId) {
  if (!canWriteSettings(file)) throw Object.assign(new Error('model_settings_unavailable'), { code: 'model_settings_unavailable' });
  let current;
  try { current = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (_) { throw Object.assign(new Error('model_settings_unavailable'), { code: 'model_settings_unavailable' }); }
  if (!current || typeof current !== 'object' || Array.isArray(current)) throw Object.assign(new Error('model_settings_unavailable'), { code: 'model_settings_unavailable' });
  const next = { ...current, conversation: modelId };
  try { fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf8'); }
  catch (_) { throw Object.assign(new Error('model_settings_unavailable'), { code: 'model_settings_unavailable' }); }
  return next;
}

function createHandler({ authenticate = authenticatedUser, originIsValid = requestOriginIsValid, isDeveloper = user => isClassKruMediaDeveloper(user?.email), env = process.env, listModels = options => modelCatalog.list(options) } = {}) {
  return async function handler(req, res) {
    if (!['GET', 'POST'].includes(req.method)) return sendJson(res, 405, { error: 'method_not_allowed' });
    if (!originIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });
    if (env.CLASSKRU_AI_NAV_ENABLED !== 'true') return sendJson(res, 503, { error: 'navigation_disabled' });
    if (req.method === 'POST') {
      try {
        if (Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(parseBody(req))) > 4000) return sendJson(res, 413, { error: 'request_too_large' });
      } catch (_) { return sendJson(res, 400, { error: 'invalid_request' }); }
    }
    let user;
    try { user = await authenticate(req); } catch (_) { return sendJson(res, 401, { error: 'authentication_required' }); }
    if (!user?.id) return sendJson(res, 401, { error: 'authentication_required' });
    if (!isDeveloper(user)) return sendJson(res, 403, { error: 'developer_access_required' });

    let catalog;
    try { catalog = briefs.catalog(); } catch (_) { return sendJson(res, 503, { error: 'brief_unavailable' }); }
    let brief;
    try { brief = briefs.load(catalog.activeVersion); } catch (_) { return sendJson(res, 503, { error: 'brief_unavailable' }); }
    const file = settingsPath(brief, env);
    const keyConfigured = Boolean(String(env.CLASSKRU_AI_NAV_OPENROUTER_API_KEY || env.OPENROUTER_API_KEY || '').trim());
    const provider = env.CLASSKRU_AI_NAV_PROVIDER === 'openrouter' ? 'openrouter' : 'mock';

    if (req.method === 'GET') {
      let models = [];
      let catalogAvailable = true;
      try { models = await listModels({ refresh: req.query?.refresh === '1' }); }
      catch (_) { catalogAvailable = false; }
      return sendJson(res, 200, {
        developer: true,
        provider,
        keyConfigured,
        modelId: navigation.resolveModelId(brief, env),
        settingsWritable: canWriteSettings(file),
        catalogAvailable,
        models
      });
    }

    const body = parseBody(req);
    const modelId = typeof body.modelId === 'string' ? body.modelId.trim() : '';
    if (!MODEL_ID.test(modelId)) return sendJson(res, 400, { error: 'invalid_model_id' });
    let models;
    try { models = await listModels(); }
    catch (_) { return sendJson(res, 503, { error: 'model_catalog_unavailable' }); }
    if (!models.some(model => model.id === modelId)) return sendJson(res, 400, { error: 'unsupported_model' });
    try {
      saveConversationModel(file, modelId);
      return sendJson(res, 200, { ok: true, modelId, provider, keyConfigured });
    } catch (error) {
      return sendJson(res, 503, { error: error.code || 'model_settings_unavailable' });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.saveConversationModel = saveConversationModel;
