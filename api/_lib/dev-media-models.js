'use strict';

const { sendJson, parseBody, requestOriginIsValid } = require('../_lib/http');
const { verifySession } = require('../_lib/dev-auth');
const settingsStore = require('../_lib/media-model-settings');

const CATALOG_TTL = 5 * 60 * 1000;
const catalogCache = new Map();
const modelIdPattern = /^[a-z0-9][a-z0-9._/-]{1,180}(?::[a-z0-9._-]+)?$/i;

function apiKey() {
  return process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_MEDIA_PLANNER_API_KEY || process.env.OPENROUTER_MEDIA_IMAGE_API_KEY || '';
}

function safeModels(rows, kind) {
  return rows.filter(row => {
    const outputs = row.architecture?.output_modalities || [];
    return kind === 'image'
      // OpenRouter's dedicated image catalogue already contains only image models.
      ? Boolean(row.id)
      : row.id && (outputs.includes('text') || row.modality?.includes('->text'));
  }).map(row => ({
    id: String(row.id).slice(0, 200),
    name: String(row.name || row.id).slice(0, 180),
    description: String(row.description || '').slice(0, 360),
    context_length: Number(row.context_length || 0),
    modality: String(row.architecture?.modality || '').slice(0, 80),
    input_modalities: Array.isArray(row.architecture?.input_modalities) ? row.architecture.input_modalities.slice(0, 8) : [],
    output_modalities: Array.isArray(row.architecture?.output_modalities) ? row.architecture.output_modalities.slice(0, 8) : [],
    prompt_price: String(row.pricing?.prompt || ''),
    completion_price: String(row.pricing?.completion || '')
  }));
}

async function catalog(kind) {
  if (!['text', 'image'].includes(kind)) return null;
  const cached = catalogCache.get(kind);
  if (cached && Date.now() - cached.at < CATALOG_TTL) return cached.models;
  const key = apiKey();
  if (!key) {
    const error = new Error('OpenRouter model catalogue is not configured');
    error.code = 'AI_CATALOG_NOT_CONFIGURED';
    throw error;
  }
  const url = kind === 'image'
    ? 'https://openrouter.ai/api/v1/images/models'
    : 'https://openrouter.ai/api/v1/models?output_modalities=text';
  const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    const error = new Error('OpenRouter model catalogue request failed');
    error.code = response.status === 401 || response.status === 403 ? 'AI_CATALOG_AUTH_FAILED' : 'AI_CATALOG_UNAVAILABLE';
    error.status = 502;
    throw error;
  }
  const payload = await response.json();
  const models = safeModels(Array.isArray(payload.data) ? payload.data : [], kind);
  catalogCache.set(kind, { at: Date.now(), models });
  return models;
}

async function handler(req, res) {
  if (!verifySession(req).ok) return sendJson(res, 401, { error: 'authentication_required' });
  if (!requestOriginIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });
  try {
    if (req.method === 'GET') {
      if (req.query.resource === 'catalog') {
        const models = await catalog(String(req.query.kind || ''));
        if (!models) return sendJson(res, 400, { error: 'invalid_model_kind' });
        return sendJson(res, 200, { kind: req.query.kind, models });
      }
      if (req.query.resource !== 'settings') return sendJson(res, 400, { error: 'unknown_resource' });
      const settings = await settingsStore.get();
      return sendJson(res, 200, { settings, catalog_configured: Boolean(apiKey()) });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
    if (!requestOriginIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });
    const body = parseBody(req);
    if (body.action !== 'save') return sendJson(res, 400, { error: 'unknown_action' });
    const next = {};
    for (const key of ['planner_model', 'builder_model', 'image_model']) {
      const value = String(body[key] || '').trim();
      if (!modelIdPattern.test(value)) return sendJson(res, 400, { error: 'invalid_model_id' });
      next[key] = value;
    }
    const [textModels, imageModels] = await Promise.all([catalog('text'), catalog('image')]);
    const textIds = new Set(textModels.map(model => model.id));
    const imageIds = new Set(imageModels.map(model => model.id));
    if (!textIds.has(next.planner_model) || !textIds.has(next.builder_model) || !imageIds.has(next.image_model)) {
      return sendJson(res, 400, { error: 'model_not_supported_for_task' });
    }
    await settingsStore.save(next);
    const settings = await settingsStore.get();
    return sendJson(res, 200, { saved: true, settings });
  } catch (error) {
    const status = error.status || (error.code === 'SUPABASE_NOT_CONFIGURED' ? 503 : error.code === 'MEDIA_SETTINGS_NOT_INITIALIZED' ? 503 : 502);
    return sendJson(res, status, { error: error.code || 'settings_unavailable' });
  }
}

module.exports = handler;
