'use strict';

const { sendJson, requestOriginIsValid } = require('../_lib/http');
const { clearSessionCookie } = require('../_lib/dev-auth');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
  if (!requestOriginIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });
  res.setHeader('Set-Cookie', clearSessionCookie(req));
  return sendJson(res, 200, { authenticated: false });
};
