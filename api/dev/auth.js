'use strict';

const { sendJson, parseBody, requestOriginIsValid } = require('../_lib/http');
const {
  checkPassword,
  clearSessionCookie,
  configured,
  createSessionToken,
  sessionCookie,
  verifySession
} = require('../_lib/dev-auth');

module.exports = function handler(req, res) {
  const action = String(req.query?.action || '').toLowerCase();

  if (action === 'session') {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
    const session = verifySession(req);
    return sendJson(res, 200, {
      authenticated: session.ok,
      configured: configured(),
      expiresAt: session.ok ? session.claims.exp : null
    });
  }

  if (!['login', 'logout'].includes(action)) return sendJson(res, 404, { error: 'unknown_action' });
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
  if (!requestOriginIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });

  if (action === 'logout') {
    res.setHeader('Set-Cookie', clearSessionCookie(req));
    return sendJson(res, 200, { authenticated: false });
  }

  const password = String(parseBody(req).password || '').slice(0, 160);
  const result = checkPassword(req, password);
  if (!result.ok) {
    const status = result.reason === 'not_configured' ? 503 : result.reason === 'rate_limited' ? 429 : 401;
    return sendJson(res, status, { error: result.reason, attemptsLeft: result.attemptsLeft });
  }
  res.setHeader('Set-Cookie', sessionCookie(req, createSessionToken()));
  return sendJson(res, 200, { authenticated: true, expiresIn: 28800 });
};
