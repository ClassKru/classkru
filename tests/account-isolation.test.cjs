const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const core = fs.readFileSync(path.join(__dirname, '..', 'js', 'core.js'), 'utf8');
const auth = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth.js'), 'utf8');
assert.match(core, /const STORAGE_KEY_PREFIX = 'classkru_mobile_v4'/);
assert.match(core, /`\$\{STORAGE_KEY_PREFIX\}_\$\{encodeURIComponent\(normalized\)\}`/);
assert.match(auth, /setStateStorageKey\(email\);\s*initAppState\(email\);/);
assert.doesNotMatch(auth, /initAppState\(\);/);
assert.match(auth, /resetOnboardingCheck\(\);/);
assert.match(fs.readFileSync(path.join(__dirname, '..', 'js', 'extras.js'), 'utf8'), /function resetOnboardingCheck\(\)/);

const storage = new Map();
const context = { encodeURIComponent, localStorage: {
  setItem(key, value) { storage.set(key, value); },
  getItem(key) { return storage.get(key) || null; }
} };
const setKey = Function('localStorage', `const STORAGE_KEY_PREFIX = 'classkru_mobile_v4'; let STORAGE_KEY = ''; ${core.match(/function setStateStorageKey\(email\) \{[\s\S]*?\n\}/)[0]}; return setStateStorageKey;`)(context.localStorage);
assert.equal(setKey('Teacher.One@example.com'), 'classkru_mobile_v4_teacher.one%40example.com');
assert.equal(setKey('second@example.com'), 'classkru_mobile_v4_second%40example.com');
assert.notEqual('classkru_mobile_v4_teacher.one%40example.com', 'classkru_mobile_v4_second%40example.com');
assert.match(fs.readFileSync(path.join(__dirname, '..', 'js', 'shared-utils.js'), 'utf8'), /function initAppStateDefault\(\) \{[\s\S]*?appState = \{[\s\S]*?activeWebScreen: 'dashboard'/);
console.log('account isolation tests passed');
