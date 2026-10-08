const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/08-responsive-toast.css'), 'utf8');

assert.match(html, /id="btn-add-class-header" aria-label="เพิ่มห้องเรียน"/);
assert.match(html, /08-responsive-toast\.css\?v=503/);
assert.match(css, /@media \(max-width: 768px\)[\s\S]*?#web-screen-classrooms > \.card:first-child[\s\S]*?#btn-add-class-header[\s\S]*?#web-screen-classrooms \.ck-classroom-filter-controls \{ display: grid;/);
assert.match(css, /#web-screen-classrooms \.ck-classroom-filter-field select \{ width: 100%; min-width: 0; height: 36px;/);

console.log('Mobile classroom layout checks passed');
