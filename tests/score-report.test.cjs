const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const wrap = { innerHTML: '' };
const context = vm.createContext({ console, window: {}, document: { getElementById: () => wrap } });
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../js/scores.js'), 'utf8'), context);
const workspaceTabs = context.scoreWorkTabsHtml({ id: 'test-class' });
assert.match(workspaceTabs, /class="score-worktabs-shell"[\s\S]*class="score-worktabs" role="tablist"/);
assert.match(workspaceTabs, /class="score-worktab active"/);
assert.doesNotMatch(workspaceTabs, /ck-classtab/);
assert.doesNotMatch(workspaceTabs, /score-worktab-scroll-cue|scrollScoreWorkspaceTabs/);
assert.deepEqual(Array.from(workspaceTabs.matchAll(/data-score-worktab="([^"]+)"/g), match => match[1]), [
  'overview', 'report-students', 'report-items', 'report-summary', 'curriculum', 'pp5'
]);
assert.match(workspaceTabs, /<span>กรอกคะแนน<\/span>/);
assert.match(workspaceTabs, /<span>สรุปคะแนน<\/span>/);
assert.match(workspaceTabs, /คะแนนชิ้นงาน/);
assert.doesNotMatch(workspaceTabs, /<span>คะแนนรายคน<\/span>/);
assert.doesNotMatch(workspaceTabs, /<span>คะแนน<\/span>/);
assert.doesNotMatch(workspaceTabs, /การส่งงาน/);
assert.match(workspaceTabs, /สรุปผล/);
assert.match(workspaceTabs, /ตัวชี้วัดรายวิชา/);
assert.match(workspaceTabs, /ปพ\.5/);
assert.equal((workspaceTabs.match(/data-tooltip="อยู่ระหว่างพัฒนา"/g) || []).length, 2);
const c = { students: [{ id: 'b', no: 2, name: 'นักเรียนสอง' }, { id: 'a', no: 1, name: 'นักเรียนหนึ่ง' }, { id: 'c', no: 3, name: 'นักเรียนสาม' }], scores: {
  items: [{ id: 'x', name: '<งาน>', max: 10, bucket: 'after' }, { id: 'y', name: 'งาน 2', max: 20, bucket: 'before' }, { id: 'z', name: 'ว่าง', max: 10, bucket: 'mid' }],
  marks: { x: { a: 0, b: 10, c: '', removed: 10 }, y: { a: 10, b: null, c: ' ' } }
} };
let rows = context.scoreReportRows(c);
assert.deepEqual(Array.from(rows, row => row.item.id), ['y', 'x', 'z']);
assert.equal(rows[0].count, 1);
assert.equal(rows[0].average, 10);
assert.equal(rows[0].percent, 50);
assert.equal(rows[1].percent, 50);
assert.equal(rows[1].count, 2);
assert.equal(rows[2].percent, null);
assert.deepEqual([0, 49.9, 50, 59.9, 60, 69.9, 70, 79.9, 80, 100].map(value => context.scoreReportPercentTone(value)), [
  'tone-0', 'tone-0', 'tone-1', 'tone-1', 'tone-2', 'tone-2', 'tone-3', 'tone-3', 'tone-4', 'tone-4'
]);
assert.equal(context.scoreReportPercentTone(null), '');
context.renderScoreReport(c);
assert.match(wrap.innerHTML, /&lt;งาน&gt;/);
assert.match(wrap.innerHTML, /มีคะแนน 2\/3 คน/);
assert.match(wrap.innerHTML, /score-report-item-average/);
assert.doesNotMatch(wrap.innerHTML, /score-report-horizontal-axis/);
assert.match(wrap.innerHTML, /aria-haspopup="dialog"/);
assert.match(wrap.innerHTML, /--score-report-target:50%/);
assert.match(wrap.innerHTML, /score-report-bar tone-1/);
assert.ok(wrap.innerHTML.indexOf('title="งาน 2"') < wrap.innerHTML.indexOf('title="&lt;งาน&gt;"'));
assert.equal(context.scoreReportDistribution(c, c.scores.items[0])[0].count, 1);
assert.equal(context.scoreReportDistribution(c, c.scores.items[0])[4].count, 1);
assert.equal(context.scoreReportDistribution(c, c.scores.items[1])[1].count, 1);
assert.deepEqual(Array.from(context.scoreReportDistribution(c, c.scores.items[0]), group => group.label), ['ต่ำกว่า 50%', '50–59%', '60–69%', '70–79%', '80–100%']);
assert.match(context.scoreReportDistributionContent(c, c.scores.items[0]), /score-report-pie/);
assert.match(context.scoreReportDistributionContent(c, c.scores.items[0]), /score-report-band-card tone-0/);
assert.match(context.scoreReportDistributionContent(c, c.scores.items[0]), /aria-controls="score-report-band-student-detail"/);
assert.match(context.scoreReportDistributionContent(c, c.scores.items[0]), /นักเรียน 1 คน/);
assert.equal(context.scoreReportDistributionStudents(c, c.scores.items[0], 0)[0].student.name, 'นักเรียนหนึ่ง');
assert.equal(context.scoreReportDistributionStudents(c, c.scores.items[0], 4)[0].student.name, 'นักเรียนสอง');
assert.match(context.scoreReportDistributionBandDetail(c, c.scores.items[0], 0), /นักเรียนหนึ่ง/);
assert.match(context.scoreReportDistributionBandDetail(c, c.scores.items[0], 0), /0 \/ 10 คะแนน/);
assert.match(context.scoreReportDistributionContent(c, c.scores.items[0]), /คะแนนเฉลี่ย 5 \/ 10 คะแนน/);
assert.match(context.scoreReportStudentChart(c), /score-report-student-matrix/);
assert.match(context.scoreReportStudentChart(c), /score-report-student-cards/);
assert.match(context.scoreReportStudentChart(c), /class="score-report-student-card score-report-student-open" data-student="a"/);
assert.match(context.scoreReportStudentChart(c), /ดูรายละเอียดคะแนน นักเรียนหนึ่ง เลขที่ 1/);
assert.match(context.scoreReportStudentChart(c), /มีคะแนนแล้ว/);
assert.match(context.scoreReportStudentChart(c), /ยังไม่มีคะแนน/);
assert.match(context.scoreReportStudentChart(c), /ชิ้นที่ 1/);
assert.match(context.scoreReportStudentChart(c), /score-report-student-item-open/);
assert.match(context.scoreReportStudentChart(c), /score-report-missing-dialog/);
assert.match(context.scoreReportStudentChart(c), /title="กดเพื่อดูสถานะคะแนนของ งาน 2"/);
assert.match(context.scoreReportStudentChart(c), /รวม \(100\)/);
assert.match(context.scoreReportStudentChart(c), /<th scope="col" class="score-report-student-grade">เกรด<\/th>/);
assert.match(context.scoreReportStudentChart(c), /score-report-student-grade-pending/);
assert.ok(context.scoreReportStudentChart(c).indexOf('data-item="y"') < context.scoreReportStudentChart(c).indexOf('data-item="x"'));
assert.match(context.scoreReportMissingDetail(c, c.scores.items[0]), /นักเรียนสาม/);
assert.match(context.scoreReportMissingDetail(c, c.scores.items[0]), /รายชื่อที่ยังไม่มีคะแนน/);
assert.match(context.scoreReportMissingDetail(c, c.scores.items[0]), /--av-bg:/);
assert.doesNotMatch(context.scoreReportMissingDetail(c, c.scores.items[0]), /นักเรียนหนึ่ง|นักเรียนสอง/);
assert.match(context.scoreReportMissingDetail(c, c.scores.items[1]), /นักเรียนสอง/);
assert.match(context.scoreReportMissingDetail(c, c.scores.items[1]), /นักเรียนสาม/);
assert.match(context.scoreReportMissingDetail(c, c.scores.items[2]), /ยังไม่มีคะแนน<\/span><strong>3<small> คน/);
assert.match(context.scoreReportMissingDetail(c, c.scores.items[2]), /สถานะนี้อ้างอิงจากการบันทึกคะแนน/);
assert.match(context.scoreReportMissingDetail(c, c.scores.items[2]), /score-report-missing-stats/);
assert.ok(context.scoreReportStudentChart(c).indexOf('data-student="a"') < context.scoreReportStudentChart(c).indexOf('data-student="b"'));
const scoreCss = fs.readFileSync(require('node:path').join(__dirname, '../css/07-scores.css'), 'utf8');
const scoreHtml = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
assert.match(scoreHtml, /js\/scores\.js\?v=517/);
assert.match(scoreCss, /@media \(max-width: 720px\)[\s\S]*?\.score-report-student-cards \{ display: grid;/);
assert.match(scoreCss, /@media \(max-width: 720px\)[\s\S]*?\.score-report-student-matrix-scroll \{ display: none;/);
assert.match(scoreCss, /\.score-worktabs \{[^}]*gap: 4px;[^}]*padding: 4px;/);
assert.match(scoreCss, /\.score-worktab \{[^}]*min-height: 42px;[^}]*border-radius: var\(--radius-btn\)/);
assert.match(scoreCss, /\.score-worktab \{[^}]*font-size: 0\.9rem;[^}]*font-weight: 600;[^}]*padding: 7px 17px/);
assert.match(scoreCss, /#score-worktab-holder \.score-worktabs \{[\s\S]*?display: flex;[\s\S]*?flex-wrap: nowrap;[\s\S]*?overflow-x: auto;[\s\S]*?scroll-snap-type: none;/);
assert.match(scoreCss, /\.score-worktabs-shell \{ display: contents; \}/);
assert.match(scoreCss, /#score-worktab-holder \.score-worktabs-shell \{[\s\S]*?border: 1px solid var\(--border-color\);[\s\S]*?background: var\(--bg-light\);/);
assert.match(scoreCss, /#score-worktab-holder \.score-worktab \{[\s\S]*?flex: 0 0 132px;[\s\S]*?width: 132px;[\s\S]*?min-height: 38px;[\s\S]*?padding: 4px 6px;/);
assert.match(scoreCss, /#score-worktab-holder \.score-worktabs::-webkit-scrollbar-thumb \{ border-radius: 999px; background: var\(--primary-light-border\); \}/);
assert.match(scoreCss, /#score-worktab-holder \.score-worktab > i:not\(\.score-worktab-lock\) \{ display: none; \}/);
assert.match(scoreCss, /#web-scores-detail-title \{[^}]*font-size: \.88rem !important; font-weight: 700 !important/);
assert.match(fs.readFileSync(require('node:path').join(__dirname, '../js/scores.js'), 'utf8'), /function revealActiveScoreWorkspaceTab\(holder\)[\s\S]*?bar\.scrollLeft = right - bar\.clientWidth/);
const completeStudentChart = context.scoreReportStudentChart({
  students: [{ id: 'full', no: 1, name: 'คะแนนครบ' }],
  scores: {
    config: { ratio: { before: 100, after: 0, mid: 0, final: 0 } },
    items: [{ id: 'all', name: 'งานรวม', max: 100, bucket: 'before' }],
    marks: { all: { full: 92 } }
  }
});
assert.match(completeStudentChart, /class="score-report-student-total" title="92 จาก 100 คะแนน">92<\/td>/);
assert.match(completeStudentChart, /class="score-report-student-grade-badge">4<\/span>/);
const gradeClass = {
  students: [{id:'a',no:1,name:'นักเรียนเอ'},{id:'b',no:2,name:'นักเรียนบี'},{id:'c',no:3,name:'นักเรียนซี'},{id:'d',no:4,name:'นักเรียนดี'},{id:'e',no:5,name:'นักเรียนอี'}],
  scores: {
    config: { ratio: { before:100, after:0, mid:0, final:0 }, gradeCut: [
      {min:80,g:'4'},{min:75,g:'3.5'},{min:70,g:'3'},{min:65,g:'2.5'},
      {min:60,g:'2'},{min:55,g:'1.5'},{min:50,g:'1'},{min:0,g:'0'}
    ] },
    items: [{id:'final-work',name:'งานสรุป',max:100,bucket:'before'}],
    marks: {'final-work': {a:100,b:75,c:65,d:0}}
  }
};
const classSummary = context.scoreReportClassSummary(gradeClass);
assert.match(classSummary, /นักเรียนทั้งหมด<\/span><strong>5<\/strong>/);
assert.match(classSummary, /คะแนนครบ<\/span><strong>4<\/strong>/);
assert.match(classSummary, /คะแนนยังไม่ครบ<\/span><strong>1<\/strong>/);
assert.match(classSummary, /คะแนนเฉลี่ย<\/span><strong>60<\/strong>/);
assert.match(classSummary, /class="score-report-grade-slice tone-0"[^>]*role="button"[^>]*data-grade="4"/);
assert.match(classSummary, /class="score-report-grade-legend-button tone-0" data-grade="4"[^>]*>.*เกรด 4.*นักเรียน 1 คน/s);
assert.match(classSummary, /class="score-report-grade-legend-button tone-1" data-grade="3\.5"[^>]*>.*เกรด 3\.5.*นักเรียน 1 คน/s);
assert.match(classSummary, /class="score-report-grade-legend-button tone-3" data-grade="2\.5"[^>]*>.*เกรด 2\.5.*นักเรียน 1 คน/s);
assert.match(classSummary, /class="score-report-grade-legend-button tone-7" data-grade="0"[^>]*>.*เกรด 0.*นักเรียน 1 คน/s);
assert.match(classSummary, /เกรด 0 นับเฉพาะผู้ที่มีคะแนนครบ/);
assert.match(classSummary, /score-report-grade-chart-layout/);
assert.match(classSummary, /score-report-grade-donut-center"[^>]*><strong>4 \/ 5<small> คน<\/small><\/strong><span>คะแนนครบ/);
assert.match(classSummary, /กดส่วนกราฟหรือแถวเกรดเพื่อดูรายชื่อ/);
assert.match(classSummary, /score-report-grade-dialog/);
const gradeDetail = context.scoreReportGradeDetail(gradeClass, '4');
assert.match(gradeDetail, /รายชื่อนักเรียนที่ได้เกรด 4/);
assert.match(gradeDetail, /score-report-grade-detail-grade tone-0/);
assert.match(gradeDetail, /score-report-grade-detail-count[^>]*><span>จำนวนนักเรียน<\/span><strong>1 คน/);
assert.match(gradeDetail, /นักเรียนเอ/);
assert.match(gradeDetail, /--av-bg:/);
assert.doesNotMatch(context.scoreReportGradeDetail(gradeClass, '3'), /นักเรียนเอ/);
c.scores.marks.x.b = 0;
assert.equal(context.scoreReportRows(c)[1].percent, 0);
c.scores.items[0].max = 0;
assert.equal(context.scoreReportRows(c)[1].percent, null);
c.students = [];
context.renderScoreReport(c);
assert.match(wrap.innerHTML, /ห้องนี้ยังไม่มีนักเรียน/);
c.scores.items = [];
context.renderScoreReport(c);
assert.match(wrap.innerHTML, /ยังไม่มีชิ้นงาน/);
console.log('Score report tests passed');
