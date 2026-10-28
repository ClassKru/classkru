'use strict';

const { authenticatedUser } = require('../../../api/_lib/supabase-user');
const { sendJson, parseBody, requestOriginIsValid } = require('../../../api/_lib/http');
const cloudSettings = require('../lib/cloud-model-settings');
const { catalog } = require('../lib/brief-store');
const { isClassKruMediaDeveloper } = require('../../../api/_lib/classkru-developers');

function createHandler({ authenticate = authenticatedUser, originIsValid = requestOriginIsValid, isDeveloper = user => isClassKruMediaDeveloper(user?.email), env = process.env, cloudStore = cloudSettings.createStore() } = {}) {
  return async function handler(req, res) {
    if (!['GET', 'POST'].includes(req.method)) return sendJson(res, 405, { error: 'method_not_allowed' });
    if (!originIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });
    if (env.CLASSKRU_AI_NAV_ENABLED !== 'true') return sendJson(res, 503, { error: 'navigation_disabled' });
    let user;
    try { user = await authenticate(req); } catch { return sendJson(res, 401, { error: 'authentication_required' }); }
    if (!user?.id) return sendJson(res, 401, { error: 'authentication_required' });
    if (!isDeveloper(user)) return sendJson(res, 403, { error: 'developer_access_required' });
    try {
      const available = catalog();
      const cloud = cloudSettings.enabled(env);
      if (req.method === 'POST') {
        const body = parseBody(req);
        if (Buffer.byteLength(JSON.stringify(body)) > 4000) return sendJson(res, 413, { error: 'request_too_large' });
        if (!available.versions.some(item => item.id === body.briefVersion)) return sendJson(res, 400, { error: 'invalid_brief_version' });
        if (cloud) await cloudStore.saveBrief(user.id, body.briefVersion);
        return sendJson(res, 200, { ok: true, selectedVersion: body.briefVersion });
      }
      const saved = cloud ? await cloudStore.getBrief(user.id) : null;
      const selectedVersion = available.versions.some(item => item.id === saved) ? saved : null;
      return sendJson(res, 200, { developer: true, activeVersion: available.activeVersion, selectedVersion, versions: available.versions });
    } catch { return sendJson(res, 503, { error: 'brief_unavailable' }); }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
