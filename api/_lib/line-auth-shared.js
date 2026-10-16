'use strict';

const crypto = require('node:crypto');
const { configuration, selectRows, mutateRows } = require('./supabase-admin');

const DEFAULT_LINE_CHANNEL_ID = '2012040900';
const LINE_AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const LINE_USERINFO_URL = 'https://api.line.me/oauth2/v2.1/userinfo';
const STATE_COOKIE = 'classkru_line_state';
const RETURN_TO_COOKIE = 'classkru_line_return_to';
const LINK_CONTEXT_COOKIE = 'classkru_line_link_context';
const COOKIE_MAX_AGE = 600;

function channelId() {
  return String(process.env.LINE_CHANNEL_ID || DEFAULT_LINE_CHANNEL_ID).trim();
}

function channelSecret() {
  const value = String(process.env.LINE_CHANNEL_SECRET || '').trim();
  if (!value) {
    const error = new Error('LINE channel secret is not configured');
    error.code = 'LINE_NOT_CONFIGURED';
    throw error;
  }
  return value;
}

function requestOrigin(req) {
  const protocol = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host) throw new Error('Request host is missing');
  return `${protocol}://${host}`;
}

function safeReturnTo(req, value) {
  const origin = requestOrigin(req);
  try {
    const candidate = new URL(String(value || '/index.html'), origin);
    if (candidate.origin !== origin) return `${origin}/index.html`;
    return `${candidate.origin}${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch (_) {
    return `${origin}/index.html`;
  }
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  return Object.fromEntries(raw.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const separator = part.indexOf('=');
    return separator < 0 ? [part, ''] : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
  }));
}

function cookie(name, value, maxAge = COOKIE_MAX_AGE) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/api/auth/line; HttpOnly; Secure; SameSite=Lax`;
}

function clearAuthCookies() {
  return [
    cookie(STATE_COOKIE, '', 0),
    cookie(RETURN_TO_COOKIE, '', 0),
    cookie(LINK_CONTEXT_COOKIE, '', 0)
  ];
}

function redirect(res, location, cookies = []) {
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.statusCode = 302;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', location);
  res.end();
}

function errorRedirect(returnTo, code) {
  const url = new URL(returnTo);
  url.searchParams.set('line_auth_error', code);
  return url.toString();
}

function linkRedirect(returnTo, code) {
  const url = new URL(returnTo);
  url.searchParams.delete('line_link');
  url.searchParams.set('line_link', code);
  return url.toString();
}

function signLinkContext({ teacherId, state }) {
  const payload = Buffer.from(JSON.stringify({
    teacherId: String(teacherId || ''),
    state: String(state || ''),
    expiresAt: Date.now() + COOKIE_MAX_AGE * 1000
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', channelSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyLinkContext(value, state) {
  const parts = String(value || '').split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = crypto.createHmac('sha256', channelSecret()).update(payload).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length
    || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.teacherId || !data.state || data.state !== String(state || '') || Number(data.expiresAt) < Date.now()) return null;
    return data;
  } catch (_) {
    return null;
  }
}

async function lineRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch (_) { payload = { raw: text }; }
  if (!response.ok) {
    const error = new Error(`LINE request failed (${response.status})`);
    error.code = 'LINE_REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function supabaseAuthRequest(path, options = {}) {
  const { url, key } = configuration();
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const response = await fetch(`${url}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch (_) { payload = { raw: text }; }
  if (!response.ok) {
    const error = new Error(`Supabase Auth request failed (${response.status})`);
    error.code = 'SUPABASE_AUTH_REQUEST_FAILED';
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function syntheticEmail(lineUserId) {
  const digest = crypto.createHash('sha256').update(lineUserId).digest('hex').slice(0, 40);
  return `line-${digest}@login.classkru.local`;
}

async function findLineIdentity(lineUserId) {
  const rows = await selectRows('teacher_login_identities', {
    select: 'teacher_id,provider_email',
    limit: 1,
    filters: { provider: 'eq.line', provider_user_id: `eq.${lineUserId}` }
  });
  return rows[0] || null;
}

async function saveLineIdentity(identity) {
  return mutateRows('teacher_login_identities', 'POST', {
    query: { on_conflict: 'provider,provider_user_id' },
    body: [identity]
  });
}

module.exports = {
  DEFAULT_LINE_CHANNEL_ID,
  LINE_AUTHORIZE_URL,
  LINE_TOKEN_URL,
  LINE_USERINFO_URL,
  STATE_COOKIE,
  RETURN_TO_COOKIE,
  LINK_CONTEXT_COOKIE,
  COOKIE_MAX_AGE,
  channelId,
  channelSecret,
  requestOrigin,
  safeReturnTo,
  randomToken,
  parseCookies,
  cookie,
  clearAuthCookies,
  redirect,
  errorRedirect,
  linkRedirect,
  signLinkContext,
  verifyLinkContext,
  lineRequest,
  supabaseAuthRequest,
  syntheticEmail,
  findLineIdentity,
  saveLineIdentity
};
