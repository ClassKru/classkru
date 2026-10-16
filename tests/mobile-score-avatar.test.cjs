const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const scoreSource = fs.readFileSync(path.join(root, 'js/scores.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/07-scores.css'), 'utf8');
const helperStart = scoreSource.indexOf('const MSC_DEFAULT_AVATAR_IMAGES = [');
const helperEnd = scoreSource.indexOf('\nfunction mscAvatar(s, i)', helperStart);
assert.notEqual(helperStart, -1, 'mobile default avatar list exists');
assert.notEqual(helperEnd, -1, 'mobile default avatar helper ends before the initials helper');

const context = {};
vm.runInNewContext(
  `${scoreSource.slice(helperStart, helperEnd)}\nthis.mscAvatarImageSource = mscAvatarImageSource;`,
  context
);

test('mobile score cards use deterministic cartoon portraits and preserve uploaded photos', () => {
  assert.equal(context.mscAvatarImageSource({ no: 1 }, 8), '/assets/student-avatar-cartoon-v2-1.png');
  assert.equal(context.mscAvatarImageSource({ no: 11 }, 0), '/assets/student-avatar-cartoon-v3-1.png');
  assert.equal(context.mscAvatarImageSource({ no: 'unknown' }, 2), '/assets/student-avatar-cartoon-v2-3.png');
  assert.equal(context.mscAvatarImageSource({ no: 1, photoBase64: 'data:image/png;base64,custom' }, 0), 'data:image/png;base64,custom');
});

test('all twenty mobile score portraits are bundled and the image treatment is mobile-only', () => {
  const imagePaths = Array.from(scoreSource.matchAll(/'((?:\/assets\/student-avatar-cartoon-v[23]-\d\.png))'/g), match => match[1]);
  assert.equal(imagePaths.length, 20);
  assert.equal(new Set(imagePaths).size, 20);
  for (const imagePath of imagePaths) {
    assert.ok(fs.existsSync(path.join(root, imagePath.slice(1))), `${imagePath} should exist`);
  }

  assert.match(scoreSource, /<img class="msc-av msc-avatar-image[^"]*" src="\$\{escapeScoreAttr\(mscAvatarImageSource\(s, i\)\)\}"/,
    'mobile score roster renders the cartoon portrait');
  assert.match(css, /@media \(max-width: 768px\) \{[\s\S]*?\.msc-avatar-image \{[\s\S]*?object-fit: contain;/,
    'portrait styling is scoped to mobile');
});

console.log('mobile score avatar tests passed');
