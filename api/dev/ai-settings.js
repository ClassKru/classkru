'use strict';

const crypto = require('crypto');
const { sendJson, parseBody, requestOriginIsValid } = require('../_lib/http');
const { verifySession } = require('../_lib/dev-auth');
const { selectRows, mutateRows } = require('../_lib/supabase-admin');
const config = require('../_lib/ai-config');

const OPENAI_URL = 'https://api.openai.com/v1';
const SETTINGS_TABLE = 'developer_ai_settings';

function encrypt(value) {
  const key = config.encryptionKey();
  if (!key) throw Object.assign(new Error('encryption_not_configured'), { code: 'encryption_not_configured' });
  if (!key) throw Object.assign(new Error('encryption_not_configured'), { code: 'encryption_not_configured' });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(part => part.toString('base64url')).join('.');
}

async function settings() {
  const rows = await selectRows(SETTINGS_TABLE, { filters: { id: 'eq.media_ai' }, limit: 1 });
  return rows[0] || null;
}

function modelName(value) {
  const model = String(value || '').trim();
  if (!model || model.length > 120 || !/^[\w./:-]+$/.test(model)) {
    throw Object.assign(new Error('invalid_model'), { code: 'invalid_model' });
  }
  return model;
}

async function getModels(row) {
  const apiKey = row?.encrypted_api_key ? config.decrypt(row.encrypted_api_key) : process.env.OPENAI_API_KEY;
  if (!apiKey) return { models: [], configured: false };
  const response = await fetch(`${OPENAI_URL}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw Object.assign(new Error('model_catalog_unavailable'), { code: 'model_catalog_unavailable', status: 502 });
  const payload = await response.json();
  const models = (payload.data || []).map(item => item.id).filter(id => typeof id === 'string').sort();
  return { models, configured: true };
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return sendJson(res, 405, { error: 'method_not_allowed' });
  if (!requestOriginIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });
  if (!verifySession(req).ok) return sendJson(res, 401, { error: 'authentication_required' });
  try {
    if (req.method === 'GET') {
      const row = await settings();
      if (req.query.action === 'models') return sendJson(res, 200, await getModels(row));
      return sendJson(res, 200, {
        provider: 'openai',
        planner_model: row?.planner_model || process.env.OPENAI_MEDIA_STUDIO_MODEL || 'gpt-5.6-luna',
        builder_model: row?.builder_model || process.env.OPENAI_MEDIA_STUDIO_MODEL || 'gpt-5.6-luna',
        has_api_key: Boolean(row?.encrypted_api_key || process.env.OPENAI_API_KEY),
        encryption_configured: Boolean(config.encryptionKey()),
        saved: Boolean(row)
      });
    }

    if (!requestOriginIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });
    const body = parseBody(req);
    const row = await settings();
    if (body.action === 'clear_key') {
      if (row) await mutateRows(SETTINGS_TABLE, 'PATCH', { query: { id: 'eq.media_ai' }, body: { encrypted_api_key: '', updated_at: new Date().toISOString() } });
      return sendJson(res, 200, { saved: Boolean(row) });
    }
    const planner = modelName(body.planner_model);
    const builder = modelName(body.builder_model);
    const submittedKey = String(body.api_key || '').trim();
    if (submittedKey.length > 300) return sendJson(res, 400, { error: 'invalid_api_key' });
    const encrypted = submittedKey ? encrypt(submittedKey) : row?.encrypted_api_key;
    if (!encrypted && !process.env.OPENAI_API_KEY) return sendJson(res, 400, { error: 'api_key_required' });
    if (encrypted) {
      await mutateRows(SETTINGS_TABLE, 'POST', {
        query: { on_conflict: 'id' }, prefer: 'resolution=merge-duplicates,return=representation',
        body: { id: 'media_ai', provider: 'openai', encrypted_api_key: encrypted, planner_model: planner, builder_model: builder, updated_at: new Date().toISOString() }
      });
    } else {
      await mutateRows(SETTINGS_TABLE, 'POST', {
        query: { on_conflict: 'id' }, prefer: 'resolution=merge-duplicates,return=representation',
        body: { id: 'media_ai', provider: 'openai', encrypted_api_key: '', planner_model: planner, builder_model: builder, updated_at: new Date().toISOString() }
      });
    }
    return sendJson(res, 200, { saved: true, planner_model: planner, builder_model: builder, has_api_key: Boolean(encrypted || process.env.OPENAI_API_KEY) });
  } catch (error) {
    const code = error.code || 'settings_unavailable';
    const status = error.status || (['invalid_model'].includes(code) ? 400 : code === 'encryption_not_configured' ? 503 : code === 'SUPABASE_NOT_CONFIGURED' ? 503 : 502);
    return sendJson(res, status, { error: code });
  }
};
