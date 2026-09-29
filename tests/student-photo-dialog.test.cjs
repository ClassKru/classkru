const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'css/06-attendance.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Both visibility states and the panel styling must apply outside mobile media queries.
for (const selector of ['.student-detail-photo-source-sheet', '.student-detail-photo-source-sheet.show', '.student-detail-photo-source-panel']) {
  const start = css.indexOf(selector + ' {');
  assert.ok(start >= 0, selector + ' exists');
  let depth = 0;
  for (const char of css.slice(0, start)) {
    if (char === '{') depth++;
    if (char === '}') depth--;
  }
  assert.equal(depth, 0, selector + ' applies on desktop as well as mobile');
}
assert.match(css, /\.student-detail-photo-source-sheet\s*\{\s*display:\s*none;/);
assert.match(css, /\.student-detail-photo-source-sheet\.show\s*\{\s*display:\s*flex;/);

const classes = new Set();
const attributes = {};
const sheet = {
  classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
  setAttribute: (key, value) => { attributes[key] = value; }
};
let selectedInput;
const context = vm.createContext({
  localStorage: { getItem: () => '1' },
  document: { getElementById: id => id === 'student-detail-photo-source-sheet' ? sheet : { click() { selectedInput = id; } } }
});
vm.runInContext(fs.readFileSync(path.join(root, 'js/attendance.js'), 'utf8'), context);
vm.runInContext('openStudentDetailPhoto()', context);
assert.ok(classes.has('show'));
assert.equal(attributes['aria-hidden'], 'false');
vm.runInContext("chooseStudentDetailPhotoSource('gallery')", context);
assert.ok(!classes.has('show'));
assert.equal(attributes['aria-hidden'], 'true');
assert.equal(selectedInput, 'student-detail-photo-input');
vm.runInContext('openStudentDetailPhoto(); closeStudentDetailPhotoSource()', context);
assert.ok(!classes.has('show'));
console.log('student photo dialog tests passed');
