'use strict';

const { sendJson } = require('../_lib/http');
const { configured, verifySession } = require('../_lib/dev-auth');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
  const session = verifySession(req);
  return sendJson(res, 200, {
    authenticated: session.ok,
    configured: configured(),
    expiresAt: session.ok ? session.claims.exp : null
  });
};
