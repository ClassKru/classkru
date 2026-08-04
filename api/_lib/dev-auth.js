'use strict';

const crypto = require('crypto');

const COOKIE_NAME = 'classkru_dev_session';
const SESSION_SECONDS = 8 * 60 * 60;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map();

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}

function safeEqual(left, right) {
  return crypto.timingSafeEqual(digest(left), digest(right));
}

function secret() {
  return process.env.DEV_SESSION_SECRET || '';
}

function configured() {
  return Boolean(process.env.DEV_CONSOLE_PASSWORD && secret().length >= 32);
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

function createSessionToken() {
  const payload = encode(JSON.stringify({
    scope: 'classkru:developer:read',
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    nonce: crypto.randomBytes(12).toString('hex')
  }));
  return `${payload}.${sign(payload)}`;
}

function parseCookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((cookies, item) => {
    const separator = item.indexOf('=');
    if (separator < 0) return cookies;
    cookies[item.slice(0, separator).trim()] = decodeURIComponent(item.slice(separator + 1).trim());
    return cookies;
  }, {});
}

function verifySession(req) {
  if (!configured()) return { ok: false, reason: 'not_configured' };
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return { ok: false, reason: 'missing' };
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return { ok: false, reason: 'invalid' };
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (claims.scope !== 'classkru:developer:read' || claims.exp <= Math.floor(Date.now() / 1000)) {
      return { ok: false, reason: 'expired' };
    }
    return { ok: true, claims };
  } catch (_) {
    return { ok: false, reason: 'invalid' };
  }
}

function clientAddress(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function attemptState(req) {
  const key = clientAddress(req);
  const now = Date.now();
  const existing = attempts.get(key);
  if (!existing || now - existing.startedAt > ATTEMPT_WINDOW_MS) {
    const next = { count: 0, startedAt: now };
    attempts.set(key, next);
    return { key, value: next };
  }
  return { key, value: existing };
}

function checkPassword(req, candidate) {
  if (!configured()) return { ok: false, reason: 'not_configured' };
  const state = attemptState(req);
  if (state.value.count >= MAX_ATTEMPTS) return { ok: false, reason: 'rate_limited' };
  if (!safeEqual(candidate, process.env.DEV_CONSOLE_PASSWORD)) {
    state.value.count += 1;
    return { ok: false, reason: 'incorrect', attemptsLeft: Math.max(0, MAX_ATTEMPTS - state.value.count) };
  }
  attempts.delete(state.key);
  return { ok: true };
}

function sessionCookie(req, token) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const secure = protocol === 'https' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}

function clearSessionCookie(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const secure = protocol === 'https' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

module.exports = {
  checkPassword,
  clearSessionCookie,
  configured,
  createSessionToken,
  sessionCookie,
  verifySession
};
