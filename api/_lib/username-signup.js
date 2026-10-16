'use strict';

const crypto = require('node:crypto');
const { configuration } = require('./supabase-admin');
const { parseBody, requestOriginIsValid, sendJson } = require('./http');
const { PASSWORD_MIN_LENGTH, validateUsername, usernameAuthEmail } = require('./username-auth');

module.exports = async function usernameSignup(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }
  if (!req.headers.origin || !requestOriginIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });

  const body = parseBody(req);
  // Quietly accept automated honeypot submissions without provisioning accounts.
  if (String(body.website || '').trim()) return sendJson(res, 201, { ok: true });

  const username = validateUsername(body.username);
  const password = String(body.password || '');
  if (!username) return sendJson(res, 400, { error: 'invalid_username' });
  if (password.length < PASSWORD_MIN_LENGTH || password.length > 128) {
    return sendJson(res, 400, { error: 'invalid_password' });
  }

  try {
    const { url, key } = configuration();
    const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',').map(value => value.trim()).filter(Boolean);
    const ipAddress = String(req.headers['x-real-ip'] || forwardedFor[forwardedFor.length - 1] || '').trim();
    if (!ipAddress) return sendJson(res, 503, { error: 'signup_unavailable' });
    const rateKey = crypto.createHmac('sha256', key).update(ipAddress).digest('hex');
    const rateResponse = await fetch(`${url}/rest/v1/rpc/consume_username_signup_rate_limit`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_rate_key: rateKey, p_limit: 5, p_window_seconds: 3600 }),
      signal: AbortSignal.timeout(10000)
    });
    if (!rateResponse.ok) {
      console.error('Username signup rate limit is unavailable:', rateResponse.status);
      return sendJson(res, 503, { error: 'signup_unavailable' });
    }
    if (await rateResponse.json() !== true) return sendJson(res, 429, { error: 'signup_rate_limited' });

    const response = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: usernameAuthEmail(username),
        password,
        email_confirm: true,
        user_metadata: { username, auth_method: 'username' },
        app_metadata: { provider: 'username' }
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (response.status === 409 || response.status === 422) {
      return sendJson(res, 409, { error: 'username_unavailable' });
    }
    if (!response.ok) {
      console.error('Username account provisioning failed:', response.status);
      return sendJson(res, 503, { error: 'signup_unavailable' });
    }
    return sendJson(res, 201, { ok: true });
  } catch (error) {
    console.error('Username account provisioning failed:', error.code || error.message);
    return sendJson(res, 503, { error: 'signup_unavailable' });
  }
};
