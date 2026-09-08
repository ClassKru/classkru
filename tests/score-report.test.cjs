const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const wrap = { innerHTML: '' };
const context = vm.createContext({ console, window: {}, document: { getElementById: () => wrap } });
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../js/scores.js'), 'utf8'), context);
const c = { students: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], scores: {
  items: [{ id: 'x', name: '<งาน>', max: 10 }, { id: 'y', name: 'งาน 2', max: 20 }, { id: 'z', name: 'ว่าง', max: 10 }],
  marks: { x: { a: 0, b: 10, c: '', removed: 10 }, y: { a: 10, b: null, c: ' ' } }
} };
let rows = context.scoreReportRows(c);
assert.equal(rows[0].count, 2);
assert.equal(rows[0].average, 5);
assert.equal(rows[0].percent, 50);
assert.equal(rows[1].percent, 50);
assert.equal(rows[1].count, 1);
assert.equal(rows[2].percent, null);
context.renderScoreReport(c);
assert.match(wrap.innerHTML, /&lt;งาน&gt;/);
assert.match(wrap.innerHTML, /มีคะแนน 2\/3 คน/);
assert.match(wrap.innerHTML, /width:50%/);
c.scores.marks.x.b = 0;
assert.equal(context.scoreReportRows(c)[0].percent, 0);
c.scores.items[0].max = 0;
assert.equal(context.scoreReportRows(c)[0].percent, null);
c.students = [];
context.renderScoreReport(c);
assert.match(wrap.innerHTML, /ห้องนี้ยังไม่มีนักเรียน/);
c.scores.items = [];
context.renderScoreReport(c);
assert.match(wrap.innerHTML, /ยังไม่มีชิ้นงาน/);
console.log('Score report tests passed');
