const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const authSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const migrationSource = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '202610160001_teacher_login_identities.sql'), 'utf8');

const startSource = fs.readFileSync(path.join(__dirname, '..', 'api', 'auth', 'line', 'start.js'), 'utf8');
const callbackSource = fs.readFileSync(path.join(__dirname, '..', 'api', 'auth', 'line', 'callback.js'), 'utf8');
const sharedSource = fs.readFileSync(path.join(__dirname, '..', 'api', '_lib', 'line-auth-shared.js'), 'utf8');

test('LINE Login uses the server-side OAuth2 bridge and the app callback', () => {
  assert.match(authSource, /const CLASSKRU_LINE_PROVIDER = 'line'/);
  assert.match(authSource, /api\/auth\/line\/start/);
  assert.match(authSource, /getAuthRedirectTo\(\)/);
  assert.match(startSource, /LINE_AUTHORIZE_URL/);
  assert.match(callbackSource, /LINE_TOKEN_URL/);
  assert.match(callbackSource, /LINE_USERINFO_URL/);
  assert.match(sharedSource, /https:\/\/access\.line\.me\/oauth2\/v2\.1\/authorize/);
  assert.match(sharedSource, /https:\/\/api\.line\.me\/oauth2\/v2\.1\/token/);
  assert.match(sharedSource, /https:\/\/api\.line\.me\/oauth2\/v2\.1\/userinfo/);
  assert.match(indexSource, /id="btn-line"/);
  assert.match(indexSource, /onclick="loginWithLine\(\)"/);
});

test('LINE identity writes stay server-side and are not writable by arbitrary authenticated clients', () => {
  assert.match(callbackSource, /teacher_id: user\.id/);
  assert.match(migrationSource, /primary key \(teacher_id, provider\)/i);
  assert.match(migrationSource, /unique \(provider, provider_user_id\)/i);
  assert.match(migrationSource, /from auth\.identities i[\s\S]*lower\(i\.provider\) in \('line', 'custom:line'\)/i);
  assert.match(migrationSource, /revoke insert, update, delete on table public\.teacher_login_identities from authenticated/i);
  assert.doesNotMatch(authSource, /from\('teacher_login_identities'\)\.upsert/);
});

test('existing teachers can explicitly link LINE without changing teacher_id', () => {
  assert.match(authSource, /async function linkLineIdentity\(\)/);
  assert.match(authSource, /api\/auth\/line\/start\?mode=link/);
  assert.match(authSource, /Authorization: `Bearer \$\{data\.session\.access_token\}`/);
  assert.match(callbackSource, /linkContext\.teacherId/);
  assert.match(indexSource, /id="btn-link-line"/);
  assert.match(indexSource, /เชื่อม LINE เข้าบัญชีเดิม/);
});

test('LINE login keeps working when the provider does not return an email', () => {
  assert.match(authSource, /function resolveLoginEmail\(email, user = null\)/);
  assert.match(authSource, /line-\$\{stableId\}@login\.classkru\.local/);
  assert.match(authSource, /teacher_id remains the/);
});

test('LINE callback keeps identity mapping server-side and returns a Supabase magic link', () => {
  assert.match(sharedSource, /teacher_login_identities/);
  assert.match(callbackSource, /provider: 'line'/);
  assert.match(callbackSource, /admin\/generate_link/);
  assert.match(callbackSource, /type: 'magiclink'/);
});
