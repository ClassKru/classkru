'use strict';

const { authenticatedUser } = require('../../../api/_lib/supabase-user');
const { sendJson, requestOriginIsValid } = require('../../../api/_lib/http');
const { catalog } = require('../lib/brief-store');
const { isClassKruMediaDeveloper } = require('../../../api/_lib/classkru-developers');

function createHandler({ authenticate = authenticatedUser, originIsValid = requestOriginIsValid, isDeveloper = user => isClassKruMediaDeveloper(user?.email), env = process.env } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
    if (!originIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });
    if (env.CLASSKRU_AI_NAV_ENABLED !== 'true') return sendJson(res, 503, { error: 'navigation_disabled' });
    let user;
    try { user = await authenticate(req); } catch { return sendJson(res, 401, { error: 'authentication_required' }); }
    if (!user?.id) return sendJson(res, 401, { error: 'authentication_required' });
    if (!isDeveloper(user)) return sendJson(res, 403, { error: 'developer_access_required' });
    try {
      const available = catalog();
      return sendJson(res, 200, { developer: true, activeVersion: available.activeVersion, versions: available.versions });
    } catch { return sendJson(res, 503, { error: 'brief_unavailable' }); }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
