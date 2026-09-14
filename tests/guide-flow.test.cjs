const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'js', 'extras.js'), 'utf8');

const addStudentGuide = js.match(/'add-student': \[([\s\S]*?)\n  \],\n  checkin:/)?.[1];
assert.ok(addStudentGuide, 'add-student guide definition exists');
assert.match(addStudentGuide, /advance: 'action:student-modal-opened'/, 'guide waits for the student form to open');
assert.match(addStudentGuide, /นำเข้า Excel/, 'guide presents Excel import as a fast alternative');
assert.match(addStudentGuide, /นำเข้า Excel[^\n]*ถ้ามีรายชื่อพร้อมอยู่แล้ว/, 'mobile guide explains when to choose Excel import');
assert.match(addStudentGuide, /target: '#modal-student \.bottom-sheet'/, 'guide explains the student form');
assert.match(addStudentGuide, /target: '#input-student-name'[\s\S]*allowInteraction: true/, 'teacher can type into the guided name field');
assert.match(addStudentGuide, /target: '#btn-student-submit'[\s\S]*advance: 'action:student-added'/, 'guide waits for a successful student save');
assert.match(addStudentGuide, /target: '\.student-roster-card'[\s\S]*before: prepareStudentGuideResult/, 'guide resumes on the saved student roster');
assert.match(addStudentGuide, /target: '#btn-students-import-excel'[\s\S]*desktopOnly: true/, 'desktop guide points to the fast Excel import option');
assert.match(addStudentGuide, /target: '#btn-students-actions-mobile'[\s\S]*mobileOnly: true/, 'mobile guide points to the fast import menu');

console.log('guide flow tests passed');
