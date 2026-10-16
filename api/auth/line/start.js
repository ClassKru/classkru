'use strict';

const { sendJson } = require('../../_lib/http');
const { authenticatedUser } = require('../../_lib/supabase-user');
const usernameSignup = require('../../_lib/username-signup');
const {
  LINE_AUTHORIZE_URL,
  channelId,
  requestOrigin,
  safeReturnTo,
  randomToken,
  cookie,
  redirect,
  STATE_COOKIE,
  RETURN_TO_COOKIE,
  LINK_CONTEXT_COOKIE,
  signLinkContext
} = require('../../_lib/line-auth-shared');

module.exports = async function handler(req, res) {
  if (String(req.query?.mode || '').toLowerCase() === 'username-signup') {
    return usernameSignup(req, res);
  }
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const linkMode = String(req.query?.mode || '').toLowerCase() === 'link';
    if (linkMode) {
      const user = await authenticatedUser(req);
      if (!user.id) return sendJson(res, 401, { error: 'invalid_session' });

      const origin = requestOrigin(req);
      const state = randomToken();
      const returnTo = safeReturnTo(req, req.query?.return_to);
      const returnUrl = new URL(returnTo);
      returnUrl.searchParams.set('line_link', 'start');
      const authorize = new URL(LINE_AUTHORIZE_URL);
      authorize.searchParams.set('response_type', 'code');
      authorize.searchParams.set('client_id', channelId());
      authorize.searchParams.set('redirect_uri', `${origin}/api/auth/line/callback`);
      authorize.searchParams.set('state', state);
      authorize.searchParams.set('scope', 'openid profile email');

      res.setHeader('Cache-Control', 'no-store, private');
      res.setHeader('Set-Cookie', [
        cookie(STATE_COOKIE, state),
        cookie(RETURN_TO_COOKIE, returnUrl.toString()),
        cookie(LINK_CONTEXT_COOKIE, signLinkContext({ teacherId: user.id, state }))
      ]);
      return res.status(200).json({ url: authorize.toString() });
    }

    const origin = requestOrigin(req);
    const returnTo = safeReturnTo(req, req.query?.return_to);
    const state = randomToken();
    const authorize = new URL(LINE_AUTHORIZE_URL);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('client_id', channelId());
    authorize.searchParams.set('redirect_uri', `${origin}/api/auth/line/callback`);
    authorize.searchParams.set('state', state);
    authorize.searchParams.set('scope', 'openid profile email');

    redirect(res, authorize.toString(), [
      cookie(STATE_COOKIE, state),
      cookie(RETURN_TO_COOKIE, returnTo)
    ]);
  } catch (error) {
    if (linkMode(req)) {
      const status = error.code === 'AUTHENTICATION_REQUIRED' || error.code === 'INVALID_SESSION' ? 401
        : error.code === 'LINE_NOT_CONFIGURED' ? 503 : 500;
      return sendJson(res, status, { error: error.code || 'line_link_start_failed' });
    }
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(error.code === 'LINE_NOT_CONFIGURED' ? 'LINE Login is not configured' : 'LINE Login is unavailable');
  }
};

function linkMode(req) {
  return String(req.query?.mode || '').toLowerCase() === 'link';
}
