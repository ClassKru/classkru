const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const repo = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(repo, 'js', 'auth.js'), 'utf8');

function loadRedirectHelper(location) {
  const context = {
    window: { location },
    document: {
      getElementById() { return null; },
      querySelector() { return null; }
    },
    localStorage: { getItem() { return null; } },
    console,
    Set
  };
  vm.runInNewContext(`${source}\nthis.getAuthRedirectTo = getAuthRedirectTo;`, context);
  return context.getAuthRedirectTo();
}

test('Google OAuth returns to the login entry on the production domain', () => {
  assert.equal(loadRedirectHelper({
    protocol: 'https:',
    hostname: 'www.classkru.com',
    origin: 'https://www.classkru.com',
    search: '?media_test=1'
  }), 'https://www.classkru.com/index.html?media_test=1');
});

test('the apex domain is normalized to the public www domain', () => {
  assert.equal(loadRedirectHelper({
    protocol: 'https:',
    hostname: 'classkru.com',
    origin: 'https://classkru.com',
    search: ''
  }), 'https://www.classkru.com/index.html');
});

test('local development keeps its own origin and callback path', () => {
  assert.equal(loadRedirectHelper({
    protocol: 'http:',
    hostname: 'localhost',
    origin: 'http://localhost:8000',
    search: ''
  }), 'http://localhost:8000/index.html');
});

test('the landing page forwards OAuth responses to the SPA entry', () => {
  const home = fs.readFileSync(path.join(repo, 'home.html'), 'utf8');
  assert.match(home, /access_token/);
  assert.match(home, /location\.replace\(`index\.html\$\{location\.search\}\$\{location\.hash\}`\)/);
});
