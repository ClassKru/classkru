const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  PASSWORD_MIN_LENGTH,
  validateUsername,
  usernameAuthEmail
} = require('../api/_lib/username-auth');
const handler = require('../api/_lib/username-signup');
const sourceRoot = path.join(__dirname, '..');
const authSource = fs.readFileSync(path.join(sourceRoot, 'js', 'auth.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(sourceRoot, 'index.html'), 'utf8');

function mockResponse() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; }
  };
}

test('username validation accepts Thai and Latin names but rejects email syntax and unsafe forms', () => {
  assert.equal(validateUsername('  ครูสมชาย  '), 'ครูสมชาย');
  assert.equal(validateUsername('Teacher_01'), 'teacher_01');
  assert.equal(validateUsername('ครู@โรงเรียน'), null);
  assert.equal(validateUsername('ab'), null);
  assert.equal(validateUsername('name..bad'), null);
  assert.equal(validateUsername('name-'), null);
});

test('username auth aliases are deterministic, opaque, and internal-only', () => {
  const first = usernameAuthEmail('ครูสมชาย');
  assert.equal(first, usernameAuthEmail(' ครูสมชาย '));
  assert.match(first, /^user-[a-f0-9]{32}@username\.classkru\.local$/);
  assert.equal(usernameAuthEmail('not@a-username'), null);
  assert.equal(PASSWORD_MIN_LENGTH, 8);
});

test('username signup provisions a confirmed internal Supabase user without an email address', async () => {
  const previousKey = process.env.SUPABASE_SECRET_KEY;
  const previousFetch = global.fetch;
  process.env.SUPABASE_SECRET_KEY = 'test-secret';
  let request;
  let rateRequest;
  global.fetch = async (url, options) => {
    if (String(url).includes('consume_username_signup_rate_limit')) {
      rateRequest = { url, options, body: JSON.parse(options.body) };
      return { ok: true, status: 200, json: async () => true };
    }
    request = { url, options, body: JSON.parse(options.body) };
    return { ok: true, status: 201 };
  };
  try {
    const res = mockResponse();
    await handler({
      method: 'POST',
      headers: { host: 'classkru.com', origin: 'https://classkru.com', 'x-forwarded-proto': 'https', 'x-real-ip': '203.0.113.7' },
      body: { username: 'ครูสมชาย', password: 'secure-pass-123' }
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.payload.ok, true);
    assert.match(rateRequest.url, /consume_username_signup_rate_limit$/);
    assert.equal(rateRequest.body.p_limit, 5);
    assert.match(rateRequest.body.p_rate_key, /^[a-f0-9]{64}$/);
    assert.match(request.url, /\/auth\/v1\/admin\/users$/);
    assert.equal(request.body.email, usernameAuthEmail('ครูสมชาย'));
    assert.equal(request.body.email_confirm, true);
    assert.equal(request.body.user_metadata.username, 'ครูสมชาย');
    assert.equal(request.body.user_metadata.auth_method, 'username');
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previousKey;
  }
});

test('username signup validates inputs and rejects cross-origin requests before provisioning', async () => {
  const previousFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; return { ok: true, status: 201 }; };
  try {
    const validHeaders = { host: 'classkru.com', origin: 'https://classkru.com', 'x-forwarded-proto': 'https', 'x-real-ip': '203.0.113.8' };
    const invalid = mockResponse();
    await handler({ method: 'POST', headers: validHeaders, body: { username: 'x', password: '12345678' } }, invalid);
    assert.equal(invalid.statusCode, 400);

    const weakPassword = mockResponse();
    await handler({ method: 'POST', headers: validHeaders, body: { username: 'teacher', password: '1234567' } }, weakPassword);
    assert.equal(weakPassword.statusCode, 400);

    const crossOrigin = mockResponse();
    await handler({
      method: 'POST',
      headers: { host: 'classkru.com', origin: 'https://other.example', 'x-forwarded-proto': 'https' },
      body: { username: 'teacher', password: 'secure-pass-123' }
    }, crossOrigin);
    assert.equal(crossOrigin.statusCode, 403);
    assert.equal(called, false);

    const missingOrigin = mockResponse();
    await handler({ method: 'POST', headers: { host: 'classkru.com', 'x-real-ip': '203.0.113.8' }, body: { username: 'teacher', password: 'secure-pass-123' } }, missingOrigin);
    assert.equal(missingOrigin.statusCode, 403);
    assert.equal(called, false);
  } finally {
    global.fetch = previousFetch;
  }
});

test('username signup fails closed when its rate limit is exhausted or unavailable', async () => {
  const previousKey = process.env.SUPABASE_SECRET_KEY;
  const previousFetch = global.fetch;
  process.env.SUPABASE_SECRET_KEY = 'test-secret';
  let adminCalled = false;
  const req = {
    method: 'POST',
    headers: { host: 'classkru.com', origin: 'https://classkru.com', 'x-forwarded-proto': 'https', 'x-real-ip': '203.0.113.9' },
    body: { username: 'newteacher', password: 'secure-pass-123' }
  };
  try {
    global.fetch = async url => String(url).includes('consume_username_signup_rate_limit')
      ? { ok: true, status: 200, json: async () => false }
      : (adminCalled = true, { ok: true, status: 201 });
    const limited = mockResponse();
    await handler(req, limited);
    assert.equal(limited.statusCode, 429);
    assert.equal(adminCalled, false);

    global.fetch = async url => String(url).includes('consume_username_signup_rate_limit')
      ? { ok: false, status: 500 }
      : (adminCalled = true, { ok: true, status: 201 });
    const unavailable = mockResponse();
    await handler(req, unavailable);
    assert.equal(unavailable.statusCode, 503);
    assert.equal(adminCalled, false);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previousKey;
  }
});

test('login accepts a username without @ while preserving existing email/password logins', () => {
  assert.match(authSource, /async function authEmailForIdentifier\(identifier\)/);
  assert.match(authSource, /if \(value\.includes\('@'\)\) return value\.toLowerCase\(\)/);
  assert.match(authSource, /signInWithPassword\(\{ email, password: inp\.password \}\)/);
  assert.match(authSource, /async function linkGoogleIdentity\(\)/);
  assert.match(authSource, /auth\.linkIdentity\(\{[\s\S]*provider: 'google'/);
  assert.match(authSource, /async function linkLineIdentity\(\)/);
  assert.match(fs.readFileSync(path.join(sourceRoot, 'vercel.json'), 'utf8'), /\/api\/auth\/username.*api\/auth\/line\/start\?mode=username-signup/);
  assert.equal(fs.existsSync(path.join(sourceRoot, 'api', 'auth', 'username.js')), false);
  assert.match(indexSource, /<input type="text" id="login-email"[^>]*autocomplete="username"/);
  assert.match(indexSource, /id="btn-link-google"/);
  assert.match(indexSource, /id="btn-link-line"/);
});
