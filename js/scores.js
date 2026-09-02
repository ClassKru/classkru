/**
 * =========================================================
 * ClassKru — Scores (เก็บคะแนน + ตัดเกรด)
 * =========================================================
 * เพิ่มบน class เดิม (Subject Class) โดยไม่แตะระบบเช็คชื่อ
 * โครงข้อมูล: class.scores = { config, items[], marks{}, gradeOverride{} }
 * คะแนน key ด้วย student.id เดิม → forward-compatible กับ Student Master อนาคต
 */

// โครงคะแนนตาม ปพ.5: 3 หมวดน้ำหนัก (ระหว่างภาค/กลางภาค/ปลายภาค)
// item.bucket เดิม (before/after/mid/final) เข้ารหัส หมวด+ระยะ ในตัวเดียว → ไม่ต้องย้ายข้อมูล
//   before = เก็บ(ระหว่างภาค)+ก่อนกลางภาค · after = เก็บ+หลังกลางภาค · mid = สอบกลางภาค · final = สอบปลายภาค
// หมวด/ระยะ fix ตามบล็อกที่กดเพิ่ม (ดู scoreBucketLabel) — ไม่มี dropdown เลือกแล้ว

// น้ำหนักแยกราย bucket ตาม ปพ.5 (ก่อน+หลัง+กลาง+ปลาย = 100) — คะแนนเก็บ = ก่อน+หลัง
const SCORE_WK = [
  { key: 'before', label: 'ก่อนกลางภาค', group: 'collect' },
  { key: 'after',  label: 'หลังกลางภาค', group: 'collect' },
  { key: 'mid',    label: 'สอบกลางภาค',  group: 'exam' },
  { key: 'final',  label: 'สอบปลายภาค',  group: 'exam' }
];

// ประเภทรายการคะแนน (ใช้เป็น tag/ไอคอน ไม่ผูกการคำนวณ)
const SCORE_TYPES = [
  { v: 'assign',    label: 'งาน/ชิ้นงาน' },
  { v: 'quiz',      label: 'Quiz' },
  { v: 'worksheet', label: 'ใบงาน' },
  { v: 'project',   label: 'Project' },
  { v: 'midterm',   label: 'สอบกลางภาค' },
  { v: 'final',     label: 'สอบปลายภาค' }
];

const SCORE_GRADES = ['4', '3.5', '3', '2.5', '2', '1.5', '1', '0'];
let scoreWorkspaceMode = 'overview';
let quickScoreItemId = null;
let scoreCurriculumFilters = {
  subjectId: 'science',
  grade: 'M1',
  unitId: 'all',
  standardId: 'all',
  query: ''
};
let scoreIndicatorSearchOpen = false;
let scoreIndicatorEditingId = null;
let curriculumCatalogContext = 'score';

function defaultScoreConfig() {
  return {
    ratio: { before: 40, after: 30, mid: 10, final: 20 },
    gradeCut: [
      { min: 80, g: '4' }, { min: 75, g: '3.5' }, { min: 70, g: '3' }, { min: 65, g: '2.5' },
      { min: 60, g: '2' }, { min: 55, g: '1.5' }, { min: 50, g: '1' }, { min: 0, g: '0' }
    ],
    attendanceMin: 60
  };
}

// สร้าง/เติมโครง scores ให้ห้อง (idempotent) — กันของเก่าที่ยังไม่มี field
function ensureScores(c) {
  if (!c.scores) c.scores = { config: defaultScoreConfig(), items: [], marks: {}, gradeOverride: {} };
  if (!c.scores.config) c.scores.config = defaultScoreConfig();
  if (!c.scores.config.ratio) c.scores.config.ratio = defaultScoreConfig().ratio;
  // ให้ ratio เป็น 4 น้ำหนักราย bucket (before/after/mid/final) เสมอ
  const _r = c.scores.config.ratio;
  if (_r.collect !== undefined && _r.before === undefined) {
    // จากช่วงทดสอบ 3-key (collect) → ยกไปไว้ที่ก่อนกลางภาค, หลัง=0 (ครูมาปรับเอง)
    c.scores.config.ratio = { before: Number(_r.collect) || 0, after: 0, mid: Number(_r.mid) || 0, final: Number(_r.final) || 0 };
  } else {
    ['before', 'after', 'mid', 'final'].forEach(k => { if (typeof _r[k] !== 'number') _r[k] = 0; });
  }
  if (!c.scores.config.gradeCut) c.scores.config.gradeCut = defaultScoreConfig().gradeCut;
  if (typeof c.scores.config.attendanceMin !== 'number') c.scores.config.attendanceMin = 60;
  if (!c.scores.items) c.scores.items = [];
  if (!c.scores.marks) c.scores.marks = {};
  if (!c.scores.gradeOverride) c.scores.gradeOverride = {};
  return c.scores;
}

// จำกัดคะแนนไม่ให้เกินเต็ม/ติดลบ (ใช้ทั้งตอนแสดง/คำนวณ/บันทึก) — คืน '' ถ้าว่าง
function clampMark(v, max) {
  if (v === undefined || v === null || v === '') return '';
  const n = Number(v);
  if (isNaN(n)) return '';
  return Math.max(0, Math.min(n, Number(max) || 0));
}

// ==================== คำนวณ ====================
// รวมคะแนนถ่วงน้ำหนักตาม ratio → เต็ม 100
function computeStudentScore(c, sid) {
  const sc = ensureScores(c);
  const cats = {};
  let total = 0;
  SCORE_WK.forEach(b => {
    const items = sc.items.filter(i => i.bucket === b.key);
    let raw = 0, max = 0, has = false;
    items.forEach(i => {
      max += Number(i.max) || 0;
      const m = (sc.marks[i.id] || {})[sid];
      if (m !== undefined && m !== null) { raw += clampMark(m, i.max) || 0; has = true; }
    });
    const weight = Number(sc.config.ratio[b.key]) || 0;
    const scaled = max > 0 ? (raw / max) * weight : 0;
    cats[b.key] = { raw, max, scaled, has, weight };
    total += scaled;
  });
  total = Math.round(total * 100) / 100;
  return { cats, total, grade: gradeFromScore(sc.config, total) };
}

function gradeFromScore(cfg, score) {
  const cut = [...cfg.gradeCut].sort((a, b) => b.min - a.min);
  for (const c of cut) { if (score >= c.min) return c.g; }
  return '0';
}

// เกรดที่ใช้จริง (override ชนะ auto)
function effectiveGrade(c, sid) {
  const ov = ensureScores(c).gradeOverride[sid];
  return ov || computeStudentScore(c, sid).grade;
}

// เวลาเรียน (%) รายคน จาก class.attendance — ลา/มา/สาย นับเป็นมีเวลาเรียน (สอดคล้อง calculateAttendancePercentage)
function studentAttendancePct(c, sid) {
  const today = getTodayString();
  const dates = Object.keys(c.attendance || {}).filter(d => d <= today);
  let present = 0, checked = 0;
  dates.forEach(d => {
    const st = (c.attendance[d] || {})[sid];
    if (!st) return;
    checked++;
    if (st === 'present' || st === 'late' || st === 'leave') present++;
  });
  return checked > 0 ? Math.round(present / checked * 100) : null;
}

// ==================== หน้าเลือกวิชา (selection view) ====================
// หน้าเลือกวิชา (renderWebScores) ถูกยกเลิกแล้ว — เข้าคะแนนผ่านการ์ดหน้าห้องเรียนวิชาสอนเท่านั้น
// routing กลาง (navigateToWebScreen) เด้ง #scores ที่ไม่มีห้อง → หน้าห้องเรียนวิชาสอน

function goBackToWebScoresSelection() {
  // เข้าคะแนนจากการ์ดห้อง → กลับไปหน้าห้องเรียน (การ์ดคือตัวเลือกห้องอยู่แล้ว)
  navigateToWebScreen('classrooms');
}

// ==================== หน้ารายละเอียด (matrix) ====================
let scoreCurrentClassId = null;

// ทางเข้าหลักจากการ์ดห้อง (ข้างปุ่มเช็คชื่อ) → เข้าตารางคะแนนของห้องนั้นตรง ๆ
// แนบ classId ผ่าน routing กลาง → navigateToWebScreen จะเรียก viewClassScores ให้เอง
// (ไม่มีห้อง = เด้งกลับหน้าห้องเรียนวิชาสอน — เลิกหน้าเลือกวิชาแล้ว)
function openClassScores(classId) {
  navigateToWebScreen('scores', classId);
}

function viewClassScores(classId) {
  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;
  scoreCurrentClassId = classId;
  mobileScoreStudentId = null;   // เปิดห้องใหม่ = เริ่มที่หน้ารวม (การ์ดรายชื่อ) เสมอ ไม่ค้างคนเดิม
  ensureScores(c);
  document.getElementById('web-scores-selection-view').style.display = 'none';
  document.getElementById('web-scores-detail-view').style.display = 'block';
  const col = getClassColor(c.id);
  document.getElementById('web-scores-detail-title').innerHTML =
    `<span style="width:12px;height:12px;border-radius:50%;background:${col.text};flex-shrink:0;"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">${c.subject} (${c.className})</span>`;
  const scTab = document.getElementById('scores-classtab-holder');
  if (scTab) scTab.innerHTML = renderClassTabBar(classId, 'scores');
  renderScoreWorkspace(c);
}

function scoreWorkTabsHtml(c) {
  const tabs = [
    { key: 'overview', label: 'คะแนน', icon: 'hgi-table' },
    { key: 'curriculum', label: 'ตัวชี้วัดรายวิชา', icon: 'hgi-book-open-01' }
  ];
  return `<div class="score-worktabs">${tabs.map(t => `
    <button class="score-worktab${scoreWorkspaceMode === t.key ? ' active' : ''}" onclick="setScoreWorkspaceMode('${t.key}','${c.id}')">
      <i class="hgi-stroke ${t.icon}"></i><span>${t.label}</span>
    </button>`).join('')}</div>`;
}

function setScoreWorkspaceMode(mode, classId) {
  scoreWorkspaceMode = mode;
  if (mode !== 'curriculum') {
    scoreIndicatorSearchOpen = false;
    scoreIndicatorEditingId = null;
  }
  const c = appState.classes.find(x => x.id === classId);
  if (c) renderScoreWorkspace(c);
}

function renderScoreWorkspace(c) {
  const holder = document.getElementById('score-worktab-holder');
  if (holder) holder.innerHTML = scoreWorkTabsHtml(c);
  const wrap = document.getElementById('web-scores-matrix-wrap');
  if (wrap) wrap.classList.remove('msc-wrap', 'sc-matrix-wrap');
  if (scoreWorkspaceMode === 'items') return renderScoreItemsDashboard(c);
  if (scoreWorkspaceMode === 'overview') return renderScoreMatrix(c);
  if (scoreWorkspaceMode === 'quick') return renderQuickScoreEntry(c);
  return renderCurriculumCatalog(c);
}

function curriculumGradeLabel(grade) {
  if (/^M[1-6]$/.test(grade || '')) return `ม.${grade.slice(1)}`;
  if (/^P[1-6]$/.test(grade || '')) return `ป.${grade.slice(1)}`;
  return grade || '';
}

function setCurriculumCatalogSubject(subjectId) {
  const catalog = window.CKCurriculumCatalog;
  if (!catalog) return;
  const grades = catalog.getGrades(subjectId);
  scoreCurriculumFilters.subjectId = subjectId;
  scoreCurriculumFilters.grade = grades[0] || '';
  scoreCurriculumFilters.unitId = 'all';
  scoreCurriculumFilters.standardId = 'all';
  scoreCurriculumFilters.query = '';
  refreshCurriculumCatalogView();
}

function setCurriculumCatalogFilter(key, value) {
  if (!['grade', 'unitId', 'standardId'].includes(key)) return;
  scoreCurriculumFilters[key] = value;
  if (key === 'grade') {
    scoreCurriculumFilters.unitId = 'all';
    scoreCurriculumFilters.standardId = 'all';
  }
  refreshCurriculumCatalogView();
}

function setCurriculumCatalogQuery(value) {
  scoreCurriculumFilters.query = value;
  if (curriculumCatalogContext === 'main') renderMainCurriculumCatalogResults();
  else {
    const c = appState.classes.find(x => x.id === scoreCurrentClassId);
    if (c) renderCurriculumCatalogResults(c);
  }
}

function refreshCurriculumCatalogView() {
  if (curriculumCatalogContext === 'main') return renderMainCurriculumCatalog();
  const c = appState.classes.find(x => x.id === scoreCurrentClassId);
  if (c) renderCurriculumCatalog(c);
}

function curriculumSubjectRailHtml(catalog) {
  return `<div class="curriculum-subject-rail" aria-label="เลือกกลุ่มสาระ">
    ${catalog.subjects.map(subject => {
      const active = subject.id === scoreCurriculumFilters.subjectId;
      const count = subject.dataset?.indicators.length || 0;
      return `<button class="curriculum-subject-btn${active ? ' active' : ''}" type="button" onclick="setCurriculumCatalogSubject('${subject.id}')" aria-pressed="${active}">
        <span class="curriculum-subject-code">${subject.code}</span>
        <span class="curriculum-subject-copy"><strong>${escapeScore(subject.shortName)}</strong><small>${subject.available ? `${count} ตัวชี้วัด` : 'รอเพิ่มข้อมูล'}</small></span>
      </button>`;
    }).join('')}
  </div>`;
}

function renderMainCurriculumCatalog() {
  curriculumCatalogContext = 'main';
  const wrap = document.getElementById('main-curriculum-catalog');
  const catalog = window.CKCurriculumCatalog;
  if (!wrap) return;
  if (!catalog) {
    wrap.innerHTML = '<div class="score-empty-panel"><strong>ยังไม่พบข้อมูลหลักสูตร</strong><span>กรุณาเปิดหน้านี้ใหม่อีกครั้ง</span></div>';
    return;
  }
  const subject = catalog.getSubject(scoreCurriculumFilters.subjectId);
  const grades = catalog.getGrades(subject.id);
  if (subject.available && !grades.includes(scoreCurriculumFilters.grade)) scoreCurriculumFilters.grade = grades[0] || '';
  const grade = scoreCurriculumFilters.grade;
  const units = catalog.getUnits(subject.id, grade);
  const standards = catalog.getStandards(subject.id, grade);
  const stats = catalog.getStats();
  wrap.innerHTML = `<section class="curriculum-browser main-curriculum-browser">
    <header class="curriculum-browser-head"><div><span class="score-mode-label">ข้อมูลหลักสูตร</span><h3>คลังตัวชี้วัด</h3><p>อ่านรายละเอียดและค้นหาตัวชี้วัดจากฐานข้อมูล ClassKru</p></div><div class="curriculum-database-stat"><strong>${stats.indicators}</strong><span>ตัวชี้วัดพร้อมใช้</span></div></header>
    ${curriculumSubjectRailHtml(catalog)}
    ${subject.available ? `<div class="curriculum-filter-bar">
      <label><span>ระดับชั้น</span><select onchange="setCurriculumCatalogFilter('grade',this.value)">${grades.map(value => `<option value="${value}"${value === grade ? ' selected' : ''}>${curriculumGradeLabel(value)}</option>`).join('')}</select></label>
      <label><span>หน่วย / สาระ</span><select onchange="setCurriculumCatalogFilter('unitId',this.value)"><option value="all">ทุกหน่วย</option>${units.map(unit => `<option value="${unit.id}"${unit.id === scoreCurriculumFilters.unitId ? ' selected' : ''}>${escapeScore(unit.title)} (${unit.indicatorCount})</option>`).join('')}</select></label>
      <label><span>มาตรฐาน</span><select onchange="setCurriculumCatalogFilter('standardId',this.value)"><option value="all">ทุกมาตรฐาน</option>${standards.map(standard => `<option value="${standard.id}"${standard.id === scoreCurriculumFilters.standardId ? ' selected' : ''}>${escapeScore(standard.code)} · ${escapeScore(standard.title)}</option>`).join('')}</select></label>
      <label class="curriculum-search"><span>ค้นหา</span><div><i class="hgi-stroke hgi-search-01"></i><input type="search" value="${escapeScore(scoreCurriculumFilters.query).replace(/"/g,'&quot;')}" placeholder="รหัสหรือคำสำคัญ" oninput="setCurriculumCatalogQuery(this.value)"></div></label>
    </div><div id="main-curriculum-results"></div>` : curriculumUnavailableHtml(subject,catalog)}
  </section>`;
  if (subject.available) renderMainCurriculumCatalogResults();
}

function renderMainCurriculumCatalogResults() {
  renderCurriculumCatalogResults(null, 'main-curriculum-results');
}

function renderCurriculumCatalog(c) {
  curriculumCatalogContext = 'score';
  const wrap = document.getElementById('web-scores-matrix-wrap');
  const catalog = window.CKCurriculumCatalog;
  if (!wrap) return;
  if (!catalog) {
    wrap.innerHTML = '<div class="score-empty-panel"><strong>ยังไม่พบข้อมูลหลักสูตร</strong><span>กรุณาเปิดหน้านี้ใหม่อีกครั้ง</span></div>';
    return;
  }

  const subject = catalog.getSubject(scoreCurriculumFilters.subjectId);
  const grades = catalog.getGrades(subject.id);
  if (subject.available && !grades.includes(scoreCurriculumFilters.grade)) {
    scoreCurriculumFilters.grade = grades[0] || '';
  }
  const grade = scoreCurriculumFilters.grade;
  const units = catalog.getUnits(subject.id, grade);
  const standards = catalog.getStandards(subject.id, grade);
  const board = getScoreIndicatorBoard(c);
  wrap.innerHTML = `<section class="curriculum-browser indicator-workspace">
    <header class="curriculum-browser-head">
      <div>
        <span class="score-mode-label">เชื่อมงานกับหลักสูตร</span>
        <h3>ตัวชี้วัดรายวิชา</h3>
        <p>เลือกงานที่ใช้ประเมินแต่ละตัวชี้วัด ระบบจะรวมคะแนนเต็มให้อัตโนมัติ</p>
      </div>
      <button class="btn btn-primary indicator-add-btn" type="button" onclick="openScoreIndicatorSearch('${c.id}')"><i class="hgi-stroke hgi-add-01"></i> เพิ่มตัวชี้วัด</button>
    </header>
    <div class="indicator-selected-head"><span>เลือกแล้ว</span><strong>${board.length} ตัวชี้วัด</strong></div>
    <div id="score-indicator-list" class="score-indicator-list"></div>
    ${scoreIndicatorSearchOpen && subject.available ? `<div class="indicator-search-overlay" onclick="if(event.target===this) closeScoreIndicatorSearch('${c.id}')">
      <section class="indicator-search-panel">
        <header><div><span>คลังหลักสูตร ClassKru</span><h3>เพิ่มตัวชี้วัด</h3></div><button type="button" onclick="closeScoreIndicatorSearch('${c.id}')" aria-label="ปิด"><i class="hgi-stroke hgi-cancel-01"></i></button></header>
        <label class="indicator-search-main"><i class="hgi-stroke hgi-search-01"></i><input type="search" value="${escapeScore(scoreCurriculumFilters.query).replace(/"/g, '&quot;')}" placeholder="ค้นหารหัสหรือคำสำคัญ เช่น เซลล์" oninput="setCurriculumCatalogQuery(this.value)" autofocus></label>
        <details class="indicator-search-filters"><summary><i class="hgi-stroke hgi-filter"></i> ตัวกรองเพิ่มเติม</summary>
          <div class="curriculum-filter-bar">
            <label><span>ระดับชั้น</span><select onchange="setCurriculumCatalogFilter('grade',this.value)">${grades.map(value => `<option value="${value}"${value === grade ? ' selected' : ''}>${curriculumGradeLabel(value)}</option>`).join('')}</select></label>
            <label><span>หน่วย / สาระ</span><select onchange="setCurriculumCatalogFilter('unitId',this.value)"><option value="all">ทุกหน่วย</option>${units.map(unit => `<option value="${unit.id}"${unit.id === scoreCurriculumFilters.unitId ? ' selected' : ''}>${escapeScore(unit.title)} (${unit.indicatorCount})</option>`).join('')}</select></label>
            <label><span>มาตรฐาน</span><select onchange="setCurriculumCatalogFilter('standardId',this.value)"><option value="all">ทุกมาตรฐาน</option>${standards.map(standard => `<option value="${standard.id}"${standard.id === scoreCurriculumFilters.standardId ? ' selected' : ''}>${escapeScore(standard.code)} · ${escapeScore(standard.title)}</option>`).join('')}</select></label>
          </div>
        </details>
        <div id="curriculum-catalog-results" class="indicator-search-results"></div>
      </section>
    </div>` : ''}
    ${scoreIndicatorSearchOpen && !subject.available ? curriculumUnavailableHtml(subject, catalog) : ''}
    ${scoreIndicatorEditingId ? scoreIndicatorEditorHtml(c, scoreIndicatorEditingId) : ''}
  </section>`;

  renderScoreIndicatorList(c);
  if (scoreIndicatorSearchOpen && subject.available) renderCurriculumCatalogResults(c);
}

function getScoreIndicatorBoard(c) {
  const sc = ensureScores(c);
  if (!Array.isArray(sc.config.indicatorBoard)) sc.config.indicatorBoard = [];
  return sc.config.indicatorBoard;
}

function addScoreIndicatorBlock(classId, subjectId, indicatorId) {
  const c = appState.classes.find(x => x.id === classId);
  const catalog = window.CKCurriculumCatalog;
  if (!c || !catalog) return;
  const indicator = catalog.getSubject(subjectId).dataset?.indicators.find(item => item.id === indicatorId);
  if (!indicator) return;
  const board = getScoreIndicatorBoard(c);
  if (board.some(item => item.indicatorId === indicatorId)) {
    showToast('เลือกตัวชี้วัดนี้ไว้แล้ว', 'warning');
    return;
  }
  const offset = board.length % 5;
  board.push({ indicatorId, subjectId, itemIds: [], maxScore: 10, x: 18 + offset * 24, y: 18 + offset * 24 });
  saveState();
  scoreIndicatorSearchOpen = false;
  scoreCurriculumFilters.query = '';
  renderCurriculumCatalog(c);
}

function openScoreIndicatorSearch(classId) {
  scoreIndicatorSearchOpen = true;
  scoreIndicatorEditingId = null;
  const c = appState.classes.find(x => x.id === classId);
  if (c) {
    const gradeMatch = `${c.gradeLevel || ''} ${c.className || ''}`.match(/(?:ม\.?|M)\s*([1-6])/i);
    const classGrade = gradeMatch ? `M${gradeMatch[1]}` : '';
    const grades = window.CKCurriculumCatalog?.getGrades(scoreCurriculumFilters.subjectId) || [];
    if (grades.includes(classGrade)) scoreCurriculumFilters.grade = classGrade;
    renderCurriculumCatalog(c);
    setTimeout(() => document.querySelector('.indicator-search-main input')?.focus(), 0);
  }
}

function closeScoreIndicatorSearch(classId) {
  scoreIndicatorSearchOpen = false;
  scoreCurriculumFilters.query = '';
  const c = appState.classes.find(x => x.id === classId);
  if (c) renderCurriculumCatalog(c);
}

function openScoreIndicatorEditor(classId, indicatorId) {
  scoreIndicatorSearchOpen = false;
  scoreIndicatorEditingId = indicatorId;
  const c = appState.classes.find(x => x.id === classId);
  if (c) renderCurriculumCatalog(c);
}

function closeScoreIndicatorEditor(classId) {
  scoreIndicatorEditingId = null;
  const c = appState.classes.find(x => x.id === classId);
  if (c) renderCurriculumCatalog(c);
}

function removeScoreIndicatorBlock(classId, indicatorId) {
  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;
  c.scores.config.indicatorBoard = getScoreIndicatorBoard(c).filter(item => item.indicatorId !== indicatorId);
  if (scoreIndicatorEditingId === indicatorId) scoreIndicatorEditingId = null;
  saveState();
  renderCurriculumCatalog(c);
}

function formatIndicatorScore(value) {
  const rounded = Math.round((Number(value) || 0) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function indicatorItemProgress(c, item) {
  const students = Array.isArray(c.students) ? c.students : [];
  const marks = ensureScores(c).marks[item.id] || {};
  const obtained = students.reduce((sum, student) => {
    const value = marks[student.id];
    return sum + (value === '' || value == null ? 0 : Number(value) || 0);
  }, 0);
  const filled = students.filter(student => marks[student.id] !== '' && marks[student.id] != null).length;
  return { current: students.length ? obtained / students.length : 0, max: Number(item.max) || 0, filled, total: students.length };
}

function indicatorConfiguredMax(block) {
  const value = Number(block.maxScore);
  return Number.isFinite(value) && value > 0 ? value : 10;
}

function indicatorScoreProgress(c, block) {
  const selected = new Set(block.itemIds || []);
  const items = ensureScores(c).items.filter(item => selected.has(item.id));
  const raw = items.reduce((summary, item) => {
    const progress = indicatorItemProgress(c, item);
    summary.current += progress.current;
    summary.rawMax += progress.max;
    summary.filled += progress.filled;
    summary.total += progress.total;
    return summary;
  }, { current: 0, rawMax: 0, filled: 0, total: 0 });
  const max = indicatorConfiguredMax(block);
  return { ...raw, current: raw.rawMax ? raw.current / raw.rawMax * max : 0, max };
}

function setIndicatorMaxScore(classId, indicatorId, value) {
  const c = appState.classes.find(x => x.id === classId);
  const block = c && getScoreIndicatorBoard(c).find(item => item.indicatorId === indicatorId);
  const maxScore = Number(value);
  if (!block || !Number.isFinite(maxScore) || maxScore <= 0) {
    showToast('คะแนนเต็มตัวชี้วัดต้องมากกว่า 0', 'warning');
    return;
  }
  block.maxScore = maxScore;
  saveState();
  renderCurriculumCatalog(c);
}

function toggleIndicatorItem(classId, indicatorId, itemId, checked) {
  const c = appState.classes.find(x => x.id === classId);
  const block = c && getScoreIndicatorBoard(c).find(item => item.indicatorId === indicatorId);
  if (!block) return;
  const ids = new Set(Array.isArray(block.itemIds) ? block.itemIds : []);
  checked ? ids.add(itemId) : ids.delete(itemId);
  block.itemIds = Array.from(ids);
  saveState();
  renderScoreIndicatorList(c);
  const progress = indicatorScoreProgress(c, block);
  const editorTotal = document.querySelector('.indicator-editor-total');
  if (editorTotal && scoreIndicatorEditingId === indicatorId) editorTotal.innerHTML = `<span>เลือกแล้ว ${block.itemIds.length} งาน</span><strong>${formatIndicatorScore(progress.current)} / ${formatIndicatorScore(progress.max)} คะแนน</strong>`;
}

function renderScoreIndicatorList(c) {
  const holder = document.getElementById('score-indicator-list');
  const catalog = window.CKCurriculumCatalog;
  if (!holder || !catalog) return;
  const board = getScoreIndicatorBoard(c);
  if (!board.length) {
    holder.innerHTML = `<div class="indicator-list-empty"><i class="hgi-stroke hgi-book-open-01"></i><strong>ยังไม่ได้เลือกตัวชี้วัด</strong><span>เริ่มจากเพิ่มตัวชี้วัด แล้วเลือกงานที่ใช้ประเมิน</span><button class="btn btn-primary" type="button" onclick="openScoreIndicatorSearch('${c.id}')"><i class="hgi-stroke hgi-add-01"></i> เพิ่มตัวชี้วัด</button></div>`;
    return;
  }
  holder.classList.add('indicator-mini-canvas');
  holder.innerHTML = board.map((block, index) => {
    const subject = catalog.getSubject(block.subjectId);
    const indicator = subject.dataset?.indicators.find(item => item.id === block.indicatorId);
    if (!indicator) return '';
    const selected = new Set(block.itemIds || []);
    const linkedItems = ensureScores(c).items.filter(item => selected.has(item.id));
    const progress = indicatorScoreProgress(c, block);
    const x = Number.isFinite(Number(block.x)) ? Number(block.x) : 18 + (index % 4) * 228;
    const y = Number.isFinite(Number(block.y)) ? Number(block.y) : 18 + Math.floor(index / 4) * 146;
    return `<article class="indicator-map-group" data-indicator-id="${escapeScoreAttr(block.indicatorId)}" style="left:${Math.max(0,x)}px;top:${Math.max(0,y)}px">
      <div class="indicator-mini-block">
        <header class="indicator-mini-drag"><i class="hgi-stroke hgi-drag-drop-vertical"></i><strong>${escapeScore(indicator.code)}</strong><span>ลากเพื่อย้าย</span></header>
        <div class="indicator-mini-content"><span>${escapeScore(indicator.text)}</span><div class="indicator-live-score"><small>คะแนนที่ได้ปัจจุบัน</small><strong>${formatIndicatorScore(progress.current)} <em>/ ${formatIndicatorScore(progress.max)}</em></strong></div><footer><b>${selected.size} งาน</b><b>กรอก ${progress.filled}/${progress.total}</b><button type="button" onclick="openScoreIndicatorEditor('${c.id}','${block.indicatorId}')"><i class="hgi-stroke hgi-edit-02"></i> แก้ไข</button></footer></div>
      </div>
      <div class="indicator-job-branches">${linkedItems.length ? linkedItems.map(item => { const itemProgress = indicatorItemProgress(c,item); const weight = progress.rawMax ? Math.round(itemProgress.max / progress.rawMax * 100) : 0; return `<div class="indicator-job-node"><span>${escapeScore(item.name)}</span><strong>${formatIndicatorScore(itemProgress.current)} <em>/ ${formatIndicatorScore(itemProgress.max)}</em></strong><small>กรอก ${itemProgress.filled}/${itemProgress.total} · สัดส่วน ${weight}%</small></div>`; }).join('') : `<button class="indicator-branch-empty" type="button" onclick="openScoreIndicatorEditor('${c.id}','${block.indicatorId}')"><i class="hgi-stroke hgi-add-01"></i> เลือกงาน</button>`}</div>
    </article>`;
  }).join('');
  enableScoreIndicatorMiniDragging(c, holder);
}

function enableScoreIndicatorMiniDragging(c, canvas) {
  canvas.querySelectorAll('.indicator-mini-drag').forEach(handle => {
    handle.onpointerdown = event => {
      const el = handle.closest('.indicator-map-group');
      const block = getScoreIndicatorBoard(c).find(item => item.indicatorId === el.dataset.indicatorId);
      if (!block) return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      const startX = event.clientX, startY = event.clientY;
      const originX = Number(el.style.left.replace('px','')) || 0;
      const originY = Number(el.style.top.replace('px','')) || 0;
      handle.onpointermove = move => {
        block.x = Math.max(0, Math.min(canvas.clientWidth - el.offsetWidth, originX + move.clientX - startX));
        block.y = Math.max(0, Math.min(canvas.clientHeight - el.offsetHeight, originY + move.clientY - startY));
        el.style.left = `${block.x}px`;
        el.style.top = `${block.y}px`;
      };
      handle.onpointerup = () => {
        handle.onpointermove = null;
        handle.onpointerup = null;
        if (block.x === undefined) block.x = originX;
        if (block.y === undefined) block.y = originY;
        saveState();
      };
    };
  });
}

function scoreIndicatorEditorHtml(c, indicatorId) {
  const catalog = window.CKCurriculumCatalog;
  const block = getScoreIndicatorBoard(c).find(item => item.indicatorId === indicatorId);
  if (!catalog || !block) return '';
  const subject = catalog.getSubject(block.subjectId);
  const indicator = subject.dataset?.indicators.find(item => item.id === indicatorId);
  if (!indicator) return '';
  const selected = new Set(block.itemIds || []);
  return `<div class="indicator-editor-overlay" onclick="if(event.target===this) closeScoreIndicatorEditor('${c.id}')"><section class="indicator-editor-panel">
    <header><div><strong>${escapeScore(indicator.code)}</strong><h3>งานที่ใช้ประเมิน</h3></div><button type="button" onclick="closeScoreIndicatorEditor('${c.id}')" aria-label="ปิด"><i class="hgi-stroke hgi-cancel-01"></i></button></header>
    <p>${escapeScore(indicator.text)}</p>
    <label class="indicator-max-field"><span>คะแนนเต็มของตัวชี้วัด</span><input type="number" min="0.5" step="0.5" value="${escapeScoreAttr(indicatorConfiguredMax(block))}" onchange="setIndicatorMaxScore('${c.id}','${block.indicatorId}',this.value)"></label>
    <div class="indicator-editor-total"><span>เลือกแล้ว ${selected.size} งาน</span><strong>${formatIndicatorScore(indicatorScoreProgress(c,block).current)} / ${formatIndicatorScore(indicatorScoreProgress(c,block).max)} คะแนน</strong></div>
    <div class="indicator-linked-items">${c.scores.items.length ? c.scores.items.map(item => `<label><input type="checkbox"${selected.has(item.id) ? ' checked' : ''} onchange="toggleIndicatorItem('${c.id}','${block.indicatorId}','${item.id}',this.checked)"><span>${escapeScore(item.name)}</span><small>${item.max} คะแนน</small></label>`).join('') : '<div class="indicator-no-items">ยังไม่มีงานในรายวิชานี้ กรุณาเพิ่มงานในแท็บคะแนนก่อน</div>'}</div>
    <footer><button class="indicator-remove-btn" type="button" onclick="removeScoreIndicatorBlock('${c.id}','${block.indicatorId}')"><i class="hgi-stroke hgi-delete-02"></i> นำตัวชี้วัดออก</button><button class="btn btn-primary" type="button" onclick="closeScoreIndicatorEditor('${c.id}')">เสร็จแล้ว</button></footer>
  </section></div>`;
}

function curriculumUnavailableHtml(subject, catalog) {
  const available = catalog.subjects.filter(item => item.available);
  return `<div class="curriculum-unavailable">
    <span class="curriculum-unavailable-icon"><i class="hgi-stroke hgi-book-02"></i></span>
    <div><h4>กำลังเตรียมข้อมูล${escapeScore(subject.name)}</h4>
      <p>มีตัวเลือกกลุ่มสาระไว้แล้ว แต่ยังไม่นำข้อความตัวชี้วัดมาแสดงจนกว่าจะตรวจสอบกับเอกสารทางการครบถ้วน</p>
      <span>ขณะนี้เปิดดูได้: ${available.map(item => escapeScore(item.name)).join(', ')}</span>
    </div>
  </div>`;
}

function renderCurriculumCatalogResults(c, holderId = 'curriculum-catalog-results') {
  const holder = document.getElementById(holderId);
  const catalog = window.CKCurriculumCatalog;
  if (!holder || !catalog) return;
  const subject = catalog.getSubject(scoreCurriculumFilters.subjectId);
  const results = catalog.search(scoreCurriculumFilters);
  const unitMap = new Map(catalog.getUnits(subject.id, scoreCurriculumFilters.grade).map(unit => [unit.id, unit]));
  const source = subject.dataset?.source;

  holder.innerHTML = `<div class="curriculum-results-head">
    <div><strong>พบ ${results.length} ตัวชี้วัด</strong><span>${escapeScore(subject.name)} · ${curriculumGradeLabel(scoreCurriculumFilters.grade)}</span></div>
    ${source?.url ? `<a href="${source.url}" target="_blank" rel="noopener"><i class="hgi-stroke hgi-book-open-01"></i> เอกสารต้นฉบับ</a>` : ''}
  </div>
  ${results.length ? `<div class="curriculum-indicator-list">${results.map(item => {
    const unit = unitMap.get(item.unitId);
    const standard = catalog.getStandard(subject.id, item.standard);
    return `<article class="curriculum-indicator-row">
      <div class="curriculum-indicator-code"><strong>${escapeScore(item.code)}</strong><span>${escapeScore(standard?.title || '')}</span></div>
      <div class="curriculum-indicator-text"><p>${escapeScore(item.text)}</p><span><i class="hgi-stroke hgi-book-02"></i> ${escapeScore(unit?.title || 'ไม่ระบุหน่วย')} · ${escapeScore(standard?.strand || '')}</span></div>
      ${c ? `<button class="curriculum-readonly-badge curriculum-pick-btn" type="button" onclick="addScoreIndicatorBlock('${c.id}','${subject.id}','${item.id}')"><i class="hgi-stroke hgi-add-01"></i> เลือก</button>` : '<span class="curriculum-readonly-badge">ดูข้อมูล</span>'}
    </article>`;
  }).join('')}</div>` : `<div class="curriculum-no-results"><i class="hgi-stroke hgi-search-01"></i><strong>ไม่พบตัวชี้วัด</strong><span>ลองเปลี่ยนหน่วย มาตรฐาน หรือคำค้นหา</span></div>`}`;
}

function quickScoreCompletion(sc, item, students) {
  const marks = sc.marks[item.id] || {};
  const filled = students.filter(s => marks[s.id] !== undefined && marks[s.id] !== null && marks[s.id] !== '').length;
  const values = students.map(s => clampMark(marks[s.id], item.max)).filter(v => v !== '');
  const avg = values.length ? Math.round((values.reduce((a, v) => a + Number(v), 0) / values.length) * 10) / 10 : '—';
  return { filled, total: students.length, avg };
}

function renderQuickScoreStats(c, itemId) {
  const c2 = appState.classes.find(x => x.id === c.id);
  if (!c2) return;
  const sc = ensureScores(c2);
  const item = sc.items.find(i => i.id === itemId);
  if (!item) return;
  const stat = quickScoreCompletion(sc, item, c2.students);
  const pct = stat.total ? Math.round((stat.filled / stat.total) * 100) : 0;
  const fillEl = document.getElementById('score-quick-progress-fill');
  const countEl = document.getElementById('score-quick-count');
  const avgEl = document.getElementById('score-quick-avg');
  if (fillEl) fillEl.style.width = pct + '%';
  if (countEl) countEl.innerText = `${stat.filled}/${stat.total}`;
  if (avgEl) avgEl.innerText = String(stat.avg);
}

function setQuickScoreMark(classId, itemId, sid, el) {
  setScoreMark(classId, itemId, sid, el);
  const c = appState.classes.find(x => x.id === classId);
  if (c) renderQuickScoreStats(c, itemId);
}

function renderQuickScoreEntry(c) {
  const sc = ensureScores(c);
  const wrap = document.getElementById('web-scores-matrix-wrap');
  if (!wrap) return;
  if (c.students.length === 0) {
    wrap.innerHTML = '<div class="empty-state">ห้องนี้ยังไม่มีนักเรียน — เพิ่มรายชื่อในเมนูนักเรียนก่อน</div>';
    return;
  }
  const items = scoreOrderedItems(c);
  if (items.length === 0) {
    wrap.innerHTML = `<div class="score-empty-panel">
      <i class="hgi-stroke hgi-task-add-01"></i>
      <strong>ยังไม่มีงานให้กรอกคะแนน</strong>
      <span>เริ่มจากเพิ่มงานหรือชิ้นงาน 1 รายการ แล้วครูจะกรอกคะแนนทั้งห้องได้จากหน้านี้</span>
      <button class="btn btn-primary" onclick="openScoreItemModal('${c.id}',null,'before')"><i class="hgi-stroke hgi-add-01"></i> เพิ่มงานแรก</button>
    </div>`;
    return;
  }
  if (!quickScoreItemId || !items.some(i => i.id === quickScoreItemId)) quickScoreItemId = items[0].id;
  const item = items.find(i => i.id === quickScoreItemId) || items[0];
  const stat = quickScoreCompletion(sc, item, c.students);
  const pct = stat.total ? Math.round((stat.filled / stat.total) * 100) : 0;
  const options = items.map(i => `<option value="${i.id}" ${i.id === item.id ? 'selected' : ''}>${escapeScore(i.name)} / ${i.max}</option>`).join('');
  const rows = c.students.map((s, idx) => {
    const v = clampMark((sc.marks[item.id] || {})[s.id], item.max);
    const av = mscAvatar(s, idx);
    return `<div class="score-quick-row">
      <div class="score-quick-student">
        <span class="score-quick-avatar" style="background:${av.bg};color:${av.fg};">${av.txt}</span>
        <div><strong>${escapeScore(s.name)}</strong><span>เลขที่ ${s.no || (idx + 1)}${s.studentCode ? ` · รหัส ${escapeScore(s.studentCode)}` : ''}</span></div>
      </div>
      <label class="score-quick-input">
        <input type="number" value="${v}" min="0" max="${item.max}" step="0.5" inputmode="decimal" placeholder="–"
          data-class-id="${escapeScoreAttr(c.id)}" data-item-id="${escapeScoreAttr(item.id)}" data-student-id="${escapeScoreAttr(s.id)}"
          onchange="setQuickScoreMark('${c.id}','${item.id}','${s.id}',this)">
        <span>/ ${item.max}</span>
      </label>
    </div>`;
  }).join('');
  wrap.innerHTML = `<section class="score-quick-shell">
    <div class="score-quick-head">
      <div>
        <span class="score-mode-label">กรอกคะแนนทีละงาน</span>
        <h3>${escapeScore(item.name)}</h3>
        <p>${scoreBucketLabel(item.bucket)} · เต็ม ${item.max} คะแนน</p>
      </div>
      <div class="score-quick-controls">
        <select class="form-control" onchange="quickScoreItemId=this.value;renderQuickScoreEntry(appState.classes.find(c=>c.id==='${c.id}'))">${options}</select>
        <button class="btn" onclick="openScoreItemModal('${c.id}','${item.id}')"><i class="hgi-stroke hgi-settings-01"></i> ตั้งค่า</button>
        <button class="btn btn-primary" onclick="openScoreItemModal('${c.id}',null,'${item.bucket}')"><i class="hgi-stroke hgi-add-01"></i> เพิ่มงาน</button>
      </div>
    </div>
    <div class="score-quick-summary">
      <div><span>กรอกแล้ว</span><strong id="score-quick-count">${stat.filled}/${stat.total}</strong></div>
      <div><span>เฉลี่ย</span><strong id="score-quick-avg">${stat.avg}</strong></div>
      <div class="score-quick-progress"><div id="score-quick-progress-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="score-quick-list">${rows}</div>
  </section>`;
}

function renderScoreItemsDashboard(c) {
  const sc = ensureScores(c);
  const wrap = document.getElementById('web-scores-matrix-wrap');
  if (!wrap) return;
  const items = scoreOrderedItems(c);
  if (items.length === 0) {
    wrap.innerHTML = `<div class="score-empty-panel">
      <i class="hgi-stroke hgi-task-add-01"></i>
      <strong>ยังไม่มีงาน/ชิ้นงาน</strong>
      <span>เพิ่มงานเพื่อเริ่มเก็บคะแนน และข้อมูลจะไปขึ้นทั้งกรอกเร็วกับภาพรวม ปพ.5</span>
      <button class="btn btn-primary" onclick="openScoreItemModal('${c.id}',null,'before')"><i class="hgi-stroke hgi-add-01"></i> เพิ่มงาน</button>
    </div>`;
    return;
  }
  const cards = items.map(it => {
    const stat = quickScoreCompletion(sc, it, c.students);
    const pct = stat.total ? Math.round((stat.filled / stat.total) * 100) : 0;
    return `<article class="score-item-card">
      <div><span>${scoreBucketLabel(it.bucket)}</span><strong>${escapeScore(it.name)}</strong><p>เต็ม ${it.max} คะแนน${it.date ? ` · ${escapeScore(it.date)}` : ''}</p></div>
      <div class="score-item-meter"><div style="width:${pct}%"></div></div>
      <footer><span>กรอกแล้ว ${stat.filled}/${stat.total}</span><button onclick="quickScoreItemId='${it.id}';setScoreWorkspaceMode('quick','${c.id}')">กรอกคะแนน</button><button onclick="openScoreItemModal('${c.id}','${it.id}')">ตั้งค่า</button></footer>
    </article>`;
  }).join('');
  wrap.innerHTML = `<section class="score-items-shell">
    <div class="score-items-head"><div><span class="score-mode-label">งานทั้งหมด</span><h3>${items.length} รายการคะแนน</h3></div><button class="btn btn-primary" onclick="openScoreItemModal('${c.id}',null,'before')"><i class="hgi-stroke hgi-add-01"></i> เพิ่มงาน</button></div>
    <div class="score-item-grid">${cards}</div>
  </section>`;
}

function renderScoreMatrix(c) {
  const sc = ensureScores(c);
  const wrap = document.getElementById('web-scores-matrix-wrap');
  if (!wrap) return;
  wrap.classList.remove('msc-wrap');

  // มือถือ = โหมด "ลงมือ": การ์ดรายชื่อ → แตะเข้ากรอกทีละคน (desktop คงตารางเดิม)
  if (typeof isMobileView === 'function' && isMobileView()) return renderMobileScores(c);
  wrap.classList.add('sc-matrix-wrap');

  if (c.students.length === 0) {
    wrap.innerHTML = '<div class="empty-state">ห้องนี้ยังไม่มีนักเรียน — เพิ่มรายชื่อในเมนูจัดการรายชื่อเด็กก่อน</div>';
    return;
  }

  // จัดกลุ่มแบบ ปพ.5 — แสดงครบ 4 บล็อกเสมอ (ว่างก็มีปุ่มเพิ่ม): คะแนนเก็บ(ก่อน/หลัง) | สอบกลางภาค | สอบปลายภาค
  const disp = SCORE_WK.map(b => ({ key: b.key, label: b.label, group: b.group, items: sc.items.filter(i => i.bucket === b.key) }));
  const collectGroups = disp.filter(g => g.group === 'collect');
  const examGroups = disp.filter(g => g.group === 'exam');
  const cspan = (g) => g.items.length || 1;                       // บล็อกว่าง = 1 คอลัมน์ placeholder (ปุ่มเพิ่มลอยเกาะขอบ ไม่กินคอลัมน์)
  const collectCount = collectGroups.reduce((a, g) => a + cspan(g), 0);
  const collectW = (Number(sc.config.ratio.before) || 0) + (Number(sc.config.ratio.after) || 0);
  const sumW = SCORE_WK.reduce((a, b) => a + (Number(sc.config.ratio[b.key]) || 0), 0);

  // ช่องแก้สัดส่วน % ราย bucket (ก่อน/หลัง/กลาง/ปลาย) — คลิกพิมพ์
  const wInput = (bk) => {
    const w = Number(sc.config.ratio[bk]) || 0;
    return `<input type="number" class="sc-weight-input" value="${w}" min="0" max="100" title="แก้สัดส่วน % (คลิกพิมพ์)" onclick="event.stopPropagation()" onchange="setCatWeight('${c.id}','${bk}',this)">%`;
  };

  // ปุ่ม + เพิ่มรายการ — วางต่อท้ายรายการสุดท้ายของบล็อก ชิดขอบขวา "ด้านใน" เส้นแบ่ง
  // ต้องอยู่ในขอบเท่านั้น: เวอร์ชันแรกวางล้ำออกไปนอกขอบ (right ติดลบ) เลยไปนั่งในเขต
  // บล็อกถัดไป อ่านแล้วงงว่าเพิ่มให้บล็อกไหน — อยู่ในขอบ = เป็นของบล็อกนี้ ไม่ต้องตีความ
  const addBtn = g => `<button class="sc-add-last" title="เพิ่มรายการใน ${g.label}" onclick="event.stopPropagation();openScoreItemModal('${c.id}',null,'${g.key}')"><i class="hgi-stroke hgi-add-01"></i></button>`;

  // คอลัมน์เรียง (บล็อกว่าง = placeholder 1 คอลัมน์) + ธงเริ่ม/ท้ายบล็อก (ตีเส้นขั้น + เกาะปุ่มเพิ่ม)
  const cols = [];
  disp.forEach(g => {
    if (g.items.length) g.items.forEach((it, idx) => cols.push({ g, it, groupStart: idx === 0, groupEnd: idx === g.items.length - 1 }));
    else cols.push({ g, placeholder: true, groupStart: true });
  });

  // ---- หัวตาราง 3 ชั้นแบบ ปพ.5 ----
  const nameCols = `<th class="sc-c-no" rowspan="3">เลขที่</th><th class="sc-c-code" rowspan="3">รหัส</th><th class="sc-c-name" rowspan="3">ชื่อ-นามสกุล</th>`;
  // sc-cat-start บนคอลัมน์สรุป = เส้นคั่นหนา 2px ชุดเดียวกับขอบหมวด
  // ให้ขอบท้าย "สอบปลายภาค" และเส้นระหว่าง รวม | เกรด | จัดการ หนาเท่ากัน
  const sumCols = `<th class="sc-cat-start" rowspan="3" style="text-align:center;min-width:56px;">รวม<div style="font-weight:400;font-size:0.66rem;color:${sumW === 100 ? 'inherit' : 'var(--color-absent)'};">(${sumW})</div></th>
    <th class="sc-cat-start" rowspan="3" style="text-align:center;min-width:54px;">เกรด</th>
    <th class="sc-c-manage sc-cat-start" rowspan="3" style="min-width:74px;">จัดการ</th>`;

  // ชั้น 1: คะแนนเก็บ (คลุมก่อน+หลัง, โชว์ % รวมอ่านอย่างเดียว) | สอบกลางภาค % | สอบปลายภาค %
  let r1 = '<tr>' + nameCols
    + `<th class="sc-bucket-head sc-cat-start sc-group-collect" colspan="${collectCount}"><span class="sc-bk-name">คะแนนเก็บ</span> <span class="sc-bk-w sc-w-readonly">${collectW}%</span></th>`;
  examGroups.forEach(g => { r1 += `<th class="sc-bucket-head sc-cat-start sc-group-${g.key}" colspan="${cspan(g)}" rowspan="2"><span class="sc-bk-name">${g.label}</span> <span class="sc-bk-w">${wInput(g.key)}</span></th>`; });
  r1 += sumCols + '</tr>';

  // ชั้น 2: ระยะย่อย + สัดส่วน % แยก ก่อน/หลังกลางภาค
  let r2 = '<tr>';
  collectGroups.forEach(g => { r2 += `<th class="sc-phase-head sc-cat-start sc-group-${g.key}" colspan="${cspan(g)}"><span class="sc-bk-name">${g.label}</span> <span class="sc-bk-w">${wInput(g.key)}</span></th>`; });
  r2 += '</tr>';

  // ชั้น 3: รายการ (ชื่อ/เต็ม/ปุ่มตั้งค่า) — บล็อกว่างเป็นปุ่ม + / รายการท้ายบล็อกมีปุ่ม + ชิดขอบในขวา
  let r3 = '<tr>';
  cols.forEach(({ g, it, placeholder, groupStart, groupEnd }, colIdx) => {
    const cs = groupStart ? ` sc-cat-start sc-group-${g.key}` : '';
    if (placeholder) {
      r3 += `<th class="sc-item-head sc-item-empty${cs}"><button class="sc-add-item-btn" title="เพิ่มรายการใน ${g.label}" onclick="openScoreItemModal('${c.id}',null,'${g.key}')"><i class="hgi-stroke hgi-add-01"></i></button></th>`;
    } else {
      const nameEsc = escapeScore(it.name).replace(/"/g, '&quot;');
      r3 += `<th class="sc-item-head${groupEnd ? ' sc-item-last' : ''}${cs}" data-score-col="${colIdx}">${groupEnd ? addBtn(g) : ''}
        <input class="sc-item-name-input" value="${nameEsc}" title="แก้ชื่อรายการ (คลิกพิมพ์)" onchange="setItemName('${c.id}','${it.id}',this)">
        <div class="sc-item-max-row" title="คะแนนเต็ม"><span class="sc-item-max-lbl">/</span><input type="number" class="sc-item-max-input" value="${it.max}" min="1" step="0.5" title="แก้คะแนนเต็ม (คลิกพิมพ์)" onchange="setItemMax('${c.id}','${it.id}',this)"><button class="sc-item-qr" title="กรอกงานนี้ด้วย QR" onclick="openQrScoreScanner('${c.id}','${it.id}')"><i class="hgi-stroke hgi-qr-code"></i></button><button class="sc-item-more" title="ตั้งค่ารายการ (ระยะ/ประเภท/วันที่/ลบ)" onclick="openScoreItemModal('${c.id}','${it.id}')"><i class="hgi-stroke hgi-settings-01"></i></button></div>
      </th>`;
    }
  });
  r3 += '</tr>';

  const thead = r1 + r2 + r3;

  let body = '<tbody>';
  c.students.forEach((s, index) => {
    const studentNo = s.no || (index + 1);
    const studentName = escapeScore(s.name);
    body += `<tr data-score-row="${index}">`
      + `<td class="sc-c-no">${studentNo}</td>`
      + `<td class="sc-c-code">${escapeScore(s.studentCode || '—')}</td>`
      + `<td class="sc-c-name" title="${escapeScoreAttr(s.name)}">${studentName}</td>`;
    // data-r/data-c = พิกัดแถว-คอลัมน์ ใช้หาช่องถัดไปตอนกด Enter/ลูกศร (ดู bindScoreCellKeys)
    cols.forEach(({ g, it, placeholder, groupStart }, colIdx) => {
      const cs = groupStart ? ` sc-cat-start sc-group-${g.key}` : '';
      if (placeholder) { body += `<td class="sc-cell-empty${cs}"></td>`; return; }
      const v = clampMark((sc.marks[it.id] || {})[s.id], it.max);
      body += `<td class="sc-score-cell${cs}" data-score-col="${colIdx}"><input type="number" class="score-cell-input" value="${v}" min="0" max="${it.max}" step="0.5" placeholder="–"
        data-r="${index}" data-c="${colIdx}" data-student-no="${escapeScoreAttr(studentNo)}" data-student-name="${escapeScoreAttr(s.name)}"
        data-class-id="${escapeScoreAttr(c.id)}" data-item-id="${escapeScoreAttr(it.id)}" data-student-id="${escapeScoreAttr(s.id)}"
        data-item-name="${escapeScoreAttr(it.name)}" data-max-score="${escapeScoreAttr(it.max)}"
        aria-label="คะแนน ${escapeScoreAttr(it.name)} ของ ${escapeScoreAttr(s.name)} เต็ม ${escapeScoreAttr(it.max)}" aria-describedby="score-focus-context"
        onchange="setScoreMark('${c.id}','${it.id}','${s.id}',this)"></td>`;
    });
    body += scoreSummaryCells(c, s);
    body += `<td class="sc-c-manage sc-cat-start"><div class="sc-manage-actions">
      <button class="d-manage-btn" title="แก้ไขข้อมูล" onclick="currentClassId='${c.id}';openStudentDetailModal('${s.id}','${c.id}')"><i class="hgi-stroke hgi-edit-02"></i></button>
      <button class="d-manage-btn danger" title="ลบรายชื่อ" onclick="deleteStudentFromScores('${c.id}','${s.id}')"><i class="hgi-stroke hgi-delete-02"></i></button>
    </div></td>`;
    body += '</tr>';
  });
  body += '</tbody>';

  wrap.innerHTML = `<div class="score-matrix-scroll">
    <div class="score-focus-context" id="score-focus-context" role="status" aria-live="polite">
      <span class="sc-focus-kicker"><i class="hgi-stroke hgi-edit-02"></i> กำลังกรอก</span>
      <span class="sc-focus-empty">เลือกช่องคะแนนเพื่อเริ่มกรอก</span>
      <span class="sc-focus-detail" hidden><strong class="sc-focus-student"></strong><span class="sc-focus-divider" aria-hidden="true"></span><span class="sc-focus-item"></span></span>
    </div>
    <table class="score-matrix-table"><thead>${thead}</thead>${body}</table>
  </div>`;
  prepareScoreFocusTable(wrap.querySelector('.score-matrix-table'));
  bindScoreCellKeys();
}

// ==================== คีย์บอร์ด: กรอกไล่ "ลงคอลัมน์" ====================
// ครูตรวจงานทีละชิ้น — ปึกใบงานที่ 1 ของทั้งห้องเรียงตามเลขที่ แล้วนั่งกรอกไล่ลง
// คอลัมน์เดียวตั้งแต่คนที่ 1 ถึงคนสุดท้าย แต่ตารางเรียงเป็นแถวต่อคน Tab เลยพาไป
// "ขวา" (คนเดิม รายการถัดไป) ซึ่งตรงข้ามกับที่ครูต้องการ ของเดิมไม่มีทางลงคอลัมน์
// ด้วยคีย์บอร์ดเลย = ต้องคลิกเมาส์ทีละช่อง 40 ครั้ง ต่อ 1 รายการคะแนน
//   Enter / ↓ = คนถัดไป ช่องเดิม · ↑ = คนก่อนหน้า · ←/→ = รายการก่อนหน้า/ถัดไป
//   Tab / Shift+Tab ยังทำงานตามลำดับช่องเหมือนเดิม
let scKeysBound = false;

// Cache จุดที่ต้องไฮไลต์ไว้ครั้งเดียวต่อการ render เพื่อไม่ query ทั้งตารางทุกครั้งที่ย้ายช่อง
function prepareScoreFocusTable(table) {
  if (!table) return;
  const columns = new Map();
  table.querySelectorAll('[data-score-col]').forEach(el => {
    const key = el.dataset.scoreCol;
    if (!columns.has(key)) columns.set(key, []);
    columns.get(key).push(el);
  });
  const inputs = Array.from(table.querySelectorAll('.score-cell-input'));
  const inputsByPosition = new Map(inputs.map(el => [`${el.dataset.r}:${el.dataset.c}`, el]));
  table._scoreFocusRefs = { columns, inputs, inputsByPosition, activeColumn: [], activeRow: null, activeCell: null };
}

function updateScoreFocus(el) {
  const table = el.closest('.score-matrix-table');
  if (!table) return;
  const refs = table._scoreFocusRefs;
  if (!refs) return;

  refs.activeColumn.forEach(node => node.classList.remove('is-active-column', 'is-active-header'));
  if (refs.activeRow) {
    refs.activeRow.classList.remove('is-active-row');
    refs.activeRow.querySelectorAll('.is-active-student').forEach(node => node.classList.remove('is-active-student'));
  }
  if (refs.activeCell) refs.activeCell.classList.remove('is-active-cell');

  const row = el.closest('tr');
  const cell = el.closest('.sc-score-cell');
  const column = refs.columns.get(el.dataset.c) || [];
  const columnHeaders = column.filter(node => node.matches('th'));
  columnHeaders.forEach(node => node.classList.add('is-active-header'));
  if (row) {
    row.classList.add('is-active-row');
    row.querySelectorAll('.sc-c-no, .sc-c-code, .sc-c-name').forEach(node => node.classList.add('is-active-student'));
  }
  if (cell) cell.classList.add('is-active-cell');
  table.classList.add('has-active-score');
  refs.activeColumn = columnHeaders;
  refs.activeRow = row;
  refs.activeCell = cell;

  const context = table.parentElement.querySelector('.score-focus-context');
  if (!context) return;
  context.classList.add('has-focus');
  context.querySelector('.sc-focus-empty').hidden = true;
  context.querySelector('.sc-focus-detail').hidden = false;
  context.querySelector('.sc-focus-student').textContent = `เลขที่ ${el.dataset.studentNo} • ${el.dataset.studentName}`;
  context.querySelector('.sc-focus-item').textContent = `${el.dataset.itemName} • เต็ม ${el.dataset.maxScore}`;
}

function clearScoreFocus(table) {
  const refs = table && table._scoreFocusRefs;
  if (!refs) return;
  refs.activeColumn.forEach(node => node.classList.remove('is-active-header'));
  if (refs.activeRow) {
    refs.activeRow.classList.remove('is-active-row');
    refs.activeRow.querySelectorAll('.is-active-student').forEach(node => node.classList.remove('is-active-student'));
  }
  if (refs.activeCell) refs.activeCell.classList.remove('is-active-cell');
  refs.activeColumn = [];
  refs.activeRow = null;
  refs.activeCell = null;
  table.classList.remove('has-active-score');
  const context = table.parentElement.querySelector('.score-focus-context');
  if (context) {
    context.classList.remove('has-focus');
    context.querySelector('.sc-focus-empty').hidden = false;
    context.querySelector('.sc-focus-detail').hidden = true;
  }
}

function focusScoreCell(el) {
  if (!el) return false;
  el.focus({ preventScroll: true });
  el.select();
  el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  return true;
}

const scWheelSaveTimers = new WeakMap();

function scoreInputBounds(el) {
  const min = Number(el.min);
  const max = Number(el.max);
  const step = Number(el.step);
  return {
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : Infinity,
    step: Number.isFinite(step) && step > 0 ? step : 1
  };
}

function normalizedScoreInputValue(el, value) {
  const bounds = scoreInputBounds(el);
  const clamped = Math.max(bounds.min, Math.min(bounds.max, Number(value) || 0));
  return Math.round(clamped * 1000) / 1000;
}

function adjustScoreInput(el, direction) {
  const bounds = scoreInputBounds(el);
  const current = el.value === '' ? bounds.min : Number(el.value);
  const next = normalizedScoreInputValue(el, current + (direction * bounds.step));
  el.value = String(next);
  return next;
}

function queueScoreInputSave(el) {
  clearTimeout(scWheelSaveTimers.get(el));
  scWheelSaveTimers.set(el, setTimeout(() => {
    if (el.isConnected) el.dispatchEvent(new Event('change', { bubbles: true }));
    scWheelSaveTimers.delete(el);
  }, 180));
}

function bindScoreCellKeys() {
  if (scKeysBound) return;
  scKeysBound = true;
  document.addEventListener('pointerdown', event => {
    const scoreCell = event.target.closest && event.target.closest('.sc-score-cell');
    if (scoreCell) {
      const input = scoreCell.querySelector('.score-cell-input');
      if (input && event.target !== input) {
        event.preventDefault();
        focusScoreCell(input);
      }
      return;
    }
    const active = document.activeElement;
    if (active && active.classList && active.classList.contains('score-cell-input')) {
      const table = active.closest('.score-matrix-table');
      active.blur();
      clearScoreFocus(table);
    }
  });
  document.addEventListener('focusin', event => {
    const el = event.target;
    if (!el.classList || !el.classList.contains('score-cell-input')) return;
    updateScoreFocus(el);
    // รอ click จบก่อนค่อย select เพื่อให้แตะ/คลิกคะแนนเดิมแล้วพิมพ์ทับได้ทันที
    setTimeout(() => { if (document.activeElement === el) el.select(); }, 0);
  });
  document.addEventListener('focusout', event => {
    const el = event.target;
    if (!el.classList || !el.classList.contains('score-cell-input')) return;
    const table = el.closest('.score-matrix-table');
    setTimeout(() => {
      const active = document.activeElement;
      if (!active || !active.classList || !active.classList.contains('score-cell-input') || active.closest('.score-matrix-table') !== table) {
        clearScoreFocus(table);
      }
    }, 0);
  });
  document.addEventListener('wheel', event => {
    const el = event.target;
    if (!el.classList || !el.classList.contains('score-cell-input') || document.activeElement !== el || event.deltaY === 0) return;
    event.preventDefault();
    // ทุก wheel event = 1 step เพื่อให้ผู้ใช้ที่หมุนเร็วปรับคะแนนต่อเนื่องได้โดยไม่ตกหล่น
    // การบันทึกยัง debounce แยกด้านล่าง จึงไม่เขียนข้อมูลถี่ตามความเร็วของลูกกลิ้ง
    adjustScoreInput(el, event.deltaY < 0 ? 1 : -1);
    queueScoreInputSave(el);
  }, { passive: false });
  document.addEventListener('keydown', event => {
    const el = event.target;
    if (!el.classList || !el.classList.contains('score-cell-input')) return;
    let next = null;
    const table = el.closest('.score-matrix-table');
    const refs = table && table._scoreFocusRefs;
    if (event.key === 'Tab') {
      const cells = refs ? refs.inputs : [];
      const index = cells.indexOf(el);
      next = cells[index + (event.shiftKey ? -1 : 1)] || null;
    } else if (event.key === 'Enter' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const step = (event.key === 'ArrowUp' || (event.key === 'Enter' && event.shiftKey)) ? -1 : 1;
      next = refs ? refs.inputsByPosition.get(`${Number(el.dataset.r) + step}:${el.dataset.c}`) : null;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const step = event.key === 'ArrowLeft' ? -1 : 1;
      next = refs ? refs.inputsByPosition.get(`${el.dataset.r}:${Number(el.dataset.c) + step}`) : null;
    } else return;
    // ลูกศรบน input type=number ปกติอาจเปลี่ยนค่า/เลื่อน caret — กันไว้เพื่อใช้ย้ายช่องทั้ง 4 ทิศทาง
    event.preventDefault();
    // คลุมเลขเดิมไว้ให้ด้วย พิมพ์ทับได้เลยไม่ต้องลบก่อน (ช่องส่วนใหญ่มีเลขอยู่แล้ว)
    if (next) focusScoreCell(next);
    else el.blur();   // สุดคอลัมน์ = จบ (blur ยิง onchange ให้ช่องสุดท้ายด้วย)
  });
}

// เซลล์สรุปท้ายแถว (รวม / เกรด) — id ต่อคน เพื่ออัปเดตแบบไม่ re-render ทั้งตาราง
function scoreSummaryCells(c, s) {
  const r = computeStudentScore(c, s.id);
  return `<td id="sc-total-${s.id}" class="sc-total sc-cat-start">${r.total}</td>
    <td id="sc-grade-${s.id}" class="sc-grade sc-cat-start">${gradeCellHtml(c, s)}</td>`;
}

// เกรดที่คำนวณได้ (override ยังใช้ได้จากข้อมูลเดิม แต่ไม่มีตัวแก้ inline แล้ว — ปรับเกณฑ์ที่หน้าตั้งค่า)
function gradeCellHtml(c, s) {
  const ov = ensureScores(c).gradeOverride[s.id];
  const eff = ov || computeStudentScore(c, s.id).grade;
  const ovMark = ov ? ' <span class="sc-ov-tag">แก้แล้ว</span>' : '';
  return `<span class="sc-grade-val g-c-${mscGradeClass(eff)}">${eff}</span>${ovMark}`;
}

// อัปเดตเฉพาะเซลล์สรุปของนักเรียนคนเดียว (กันเสียโฟกัส/ตำแหน่ง scroll)
function updateScoreRow(c, sid) {
  const s = c.students.find(x => x.id === sid);
  if (!s) return;
  const r = computeStudentScore(c, sid);
  const totalEl = document.getElementById(`sc-total-${sid}`);
  const gradeEl = document.getElementById(`sc-grade-${sid}`);
  if (totalEl) totalEl.innerText = r.total;
  if (gradeEl) gradeEl.innerHTML = gradeCellHtml(c, s);
}

// ==================== แก้ไขคะแนน ====================
function setScoreMark(classId, itemId, sid, el) {
  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;
  const sc = ensureScores(c);
  const item = sc.items.find(i => i.id === itemId);
  const raw = (el && typeof el === 'object') ? el.value : el;   // รับ element (เขียนค่ากลับได้) หรือค่าตรง
  const clamped = clampMark(raw, item ? item.max : Infinity);
  const n = clamped === '' ? null : clamped;
  if (el && typeof el === 'object') el.value = n === null ? '' : n;  // กันช่องโชว์ค่าเกินเต็ม
  if (!sc.marks[itemId]) sc.marks[itemId] = {};
  if (n === null) delete sc.marks[itemId][sid];
  else sc.marks[itemId][sid] = n;
  saveState();
  updateScoreRow(c, sid);
  notifyTourAction('score-mark-saved');
}

// แก้สัดส่วน % ของหมวด inline จากหัวตาราง (เตือนไม่บล็อกถ้ารวม≠100)
function setCatWeight(classId, catKey, el) {
  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;
  const cfg = ensureScores(c).config;
  let v = Number(el.value);
  if (isNaN(v) || v < 0) v = 0;
  if (v > 100) v = 100;
  el.value = v;
  cfg.ratio[catKey] = v;
  saveState();
  renderScoreWorkspace(c);
  const sum = SCORE_WK.reduce((a, b) => a + (Number(cfg.ratio[b.key]) || 0), 0);
  if (sum !== 100) showToast(`สัดส่วนรวม ${sum}% (ควรเป็น 100%)`, 'warning');
}

function setGradeOverride(classId, sid, val) {
  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;
  const sc = ensureScores(c);
  if (!val) delete sc.gradeOverride[sid];
  else sc.gradeOverride[sid] = val;
  saveState();
  updateScoreRow(c, sid);
}

// ลบนักเรียนจากหน้าคะแนน — ลบจาก c.students ชุดเดียว → ลิ้งกับเช็คชื่ออัตโนมัติ + ล้างคะแนน/override ของคนนั้น
function deleteStudentFromScores(classId, sid) {
  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;
  const s = c.students.find(x => x.id === sid);
  if (!s) return;
  showConfirm(`ลบ "${s.name}" ออกจากห้องนี้? ข้อมูลเช็คชื่อและคะแนนของคนนี้จะหายไปด้วย`, () => {
    c.students = c.students.filter(x => x.id !== sid);
    c.students.forEach((st, i) => st.no = i + 1);
    Object.keys(c.attendance || {}).forEach(d => { delete c.attendance[d][sid]; });
    const sc = ensureScores(c);
    Object.keys(sc.marks).forEach(itemId => { delete sc.marks[itemId][sid]; });
    delete sc.gradeOverride[sid];
    saveState();
    showToast('ลบนักเรียนแล้ว', 'success');
    renderScoreWorkspace(c);
  }, { title: `ลบ "${s.name}"?`, icon: '🗑️', okText: 'ลบ' });
}

// แก้ชื่อรายการ inline จากหัวตาราง (ลิงก์ข้อมูลเดียวกับ modal/ตั้งค่า)
function setItemName(classId, itemId, el) {
  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;
  const it = ensureScores(c).items.find(i => i.id === itemId);
  if (!it) return;
  const v = el.value.trim();
  if (!v) { el.value = it.name; showToast('ชื่อรายการห้ามว่าง', 'warning'); return; }
  it.name = v;
  saveState();  // ชื่อไม่กระทบคำนวณ → ไม่ต้อง re-render
}

// แก้คะแนนเต็ม inline จากหัวตาราง → clamp คะแนน/รวม/เกรดใหม่
function setItemMax(classId, itemId, el) {
  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;
  const it = ensureScores(c).items.find(i => i.id === itemId);
  if (!it) return;
  const v = Number(el.value);
  if (isNaN(v) || v <= 0) { el.value = it.max; showToast('คะแนนเต็มต้องมากกว่า 0', 'warning'); return; }
  it.max = v;
  saveState();
  renderScoreWorkspace(c);
}

// ==================== รายการคะแนน (item CRUD) ====================
let editingScoreItemId = null;
let editingScoreBucket = 'before';   // หมวด/ระยะ fix ตามบล็อกที่กดเพิ่ม (แทน dropdown)

// ป้ายหมวดคะแนน (ปพ.5) จาก bucket — โชว์เป็น read-only ใน modal
function scoreBucketLabel(bk) {
  return { before: 'คะแนนเก็บ · ก่อนกลางภาค', after: 'คะแนนเก็บ · หลังกลางภาค', mid: 'สอบกลางภาค', final: 'สอบปลายภาค' }[bk] || bk;
}

function openScoreItemModal(classId, itemId, presetBucket) {
  scoreCurrentClassId = classId;
  editingScoreItemId = itemId || null;
  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;
  const sc = ensureScores(c);
  const it = itemId ? sc.items.find(i => i.id === itemId) : null;

  document.getElementById('input-score-name').value = it ? it.name : '';
  document.getElementById('input-score-max').value = it ? it.max : 10;
  document.getElementById('input-score-date').value = it ? (it.date || '') : '';
  document.getElementById('input-score-note').value = it ? (it.note || '') : '';

  const typeSel = document.getElementById('input-score-type');
  typeSel.innerHTML = SCORE_TYPES.map(t => `<option value="${t.v}" ${it && it.type === t.v ? 'selected' : ''}>${t.label}</option>`).join('');
  // หมวด fix ตามบล็อกที่กด (หรือ bucket เดิมของรายการ) — ไม่มี dropdown ให้เลือกแล้ว
  editingScoreBucket = it ? it.bucket : (presetBucket || 'before');
  document.getElementById('score-bucket-label').innerText = scoreBucketLabel(editingScoreBucket);

  document.querySelector('#modal-score-item h3').innerText = it ? 'แก้ไขรายการคะแนน' : 'เพิ่มรายการคะแนน';
  document.getElementById('btn-score-item-delete').style.display = it ? 'inline-flex' : 'none';
  document.getElementById('btn-score-item-submit').innerText = it ? 'บันทึก' : 'เพิ่ม';
  document.getElementById('modal-score-item').classList.add('show');
  if (!itemId) notifyTourAction('score-item-modal-opened');
}

function closeScoreItemModal() {
  document.getElementById('modal-score-item').classList.remove('show');
  editingScoreItemId = null;
}

function saveScoreItem() {
  const c = appState.classes.find(x => x.id === scoreCurrentClassId);
  if (!c) return;
  const sc = ensureScores(c);
  const name = document.getElementById('input-score-name').value.trim();
  const max = Number(document.getElementById('input-score-max').value);
  if (!name) { showToast('กรุณากรอกชื่อรายการ', 'warning'); return; }
  if (!max || max <= 0) { showToast('คะแนนเต็มต้องมากกว่า 0', 'warning'); return; }
  const type = document.getElementById('input-score-type').value;
  // หมวด/ระยะ fix ตามบล็อกที่กดเพิ่ม (bucket = before/after/mid/final เดิม — คงรูปแบบข้อมูล)
  const bucket = editingScoreBucket;
  const date = document.getElementById('input-score-date').value;
  const note = document.getElementById('input-score-note').value.trim();

  if (editingScoreItemId) {
    const it = sc.items.find(i => i.id === editingScoreItemId);
    if (it) { it.name = name; it.max = max; it.type = type; it.bucket = bucket; it.date = date; it.note = note; }
  } else {
    sc.items.push({ id: 'sk_' + Date.now(), name, max, type, bucket, date, note });
  }
  saveState();
  closeScoreItemModal();
  if (!quickScoreItemId && sc.items.length) quickScoreItemId = sc.items[sc.items.length - 1].id;
  renderScoreWorkspace(c);
  notifyTourAction('score-item-saved');
}

function deleteScoreItem() {
  if (!editingScoreItemId) return;
  const c = appState.classes.find(x => x.id === scoreCurrentClassId);
  if (!c) return;
  const sc = ensureScores(c);
  const it = sc.items.find(i => i.id === editingScoreItemId);
  showConfirm(`ลบรายการ "${it ? it.name : ''}" และคะแนนทั้งหมดในรายการนี้?`, () => {
    sc.items = sc.items.filter(i => i.id !== editingScoreItemId);
    delete sc.marks[editingScoreItemId];
    if (quickScoreItemId === editingScoreItemId) quickScoreItemId = null;
    saveState();
    closeScoreItemModal();
    renderScoreWorkspace(c);
  }, { title: 'ลบรายการคะแนน', icon: '🗑️', okText: 'ลบ' });
}

// ==================== ตั้งค่า (สัดส่วน / เกณฑ์เกรด / เวลาเรียนขั้นต่ำ) ====================
function openScoreSettingsModal() {
  const c = appState.classes.find(x => x.id === scoreCurrentClassId);
  if (!c) return;
  const cfg = ensureScores(c).config;
  document.getElementById('input-ratio-before').value = cfg.ratio.before;
  document.getElementById('input-ratio-after').value = cfg.ratio.after;
  document.getElementById('input-ratio-mid').value = cfg.ratio.mid;
  document.getElementById('input-ratio-final').value = cfg.ratio.final;
  document.getElementById('input-att-min').value = cfg.attendanceMin;
  renderGradeCutInputs(cfg);
  updateRatioSum();
  document.getElementById('modal-score-settings').classList.add('show');
}

function renderGradeCutInputs(cfg) {
  const box = document.getElementById('grade-cut-inputs');
  box.innerHTML = cfg.gradeCut.map(gc =>
    `<div style="display:flex;align-items:center;gap:8px;">
      <span style="width:34px;font-weight:800;text-align:right;">${gc.g}</span>
      <span style="font-size:0.8rem;color:var(--text-muted);">ตั้งแต่</span>
      <input type="number" class="form-control grade-cut-min" data-g="${gc.g}" value="${gc.min}" min="0" max="100" style="width:80px;padding:6px 8px;">
      <span style="font-size:0.8rem;color:var(--text-muted);">คะแนนขึ้นไป</span>
    </div>`
  ).join('');
}

function updateRatioSum() {
  const sum = ['before', 'after', 'mid', 'final']
    .reduce((a, k) => a + (Number(document.getElementById('input-ratio-' + k).value) || 0), 0);
  const el = document.getElementById('ratio-sum-label');
  el.innerText = `รวม ${sum}%`;
  el.style.color = sum === 100 ? 'var(--color-present)' : 'var(--color-absent)';
}

function saveScoreSettings() {
  const c = appState.classes.find(x => x.id === scoreCurrentClassId);
  if (!c) return;
  const cfg = ensureScores(c).config;
  const ratio = {
    before: Number(document.getElementById('input-ratio-before').value) || 0,
    after: Number(document.getElementById('input-ratio-after').value) || 0,
    mid: Number(document.getElementById('input-ratio-mid').value) || 0,
    final: Number(document.getElementById('input-ratio-final').value) || 0
  };
  const sum = ratio.before + ratio.after + ratio.mid + ratio.final;
  if (sum !== 100) { showToast('สัดส่วนคะแนนต้องรวมได้ 100%', 'warning'); return; }
  cfg.ratio = ratio;
  cfg.attendanceMin = Number(document.getElementById('input-att-min').value) || 0;
  const cuts = [];
  document.querySelectorAll('.grade-cut-min').forEach(inp => {
    cuts.push({ g: inp.getAttribute('data-g'), min: Number(inp.value) || 0 });
  });
  cfg.gradeCut = cuts;
  saveState();
  document.getElementById('modal-score-settings').classList.remove('show');
  renderScoreWorkspace(c);
  showToast('บันทึกการตั้งค่าคะแนนแล้ว', 'success');
}

function closeScoreSettingsModal() {
  document.getElementById('modal-score-settings').classList.remove('show');
}

// escape เบา ๆ สำหรับข้อความในตาราง
function escapeScore(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeScoreAttr(v) {
  return escapeScore(v).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ==================== มือถือ: การ์ดรายชื่อ → กรอกทีละคน ====================
// จำคนที่เปิดกรอกอยู่ เพื่อให้ตอน re-render (เพิ่ม/ลบรายการผ่าน modal) กลับมาหน้ารายคนเดิม ไม่เด้งไปรายชื่อ
let mobileScoreStudentId = null;

// พาเลตต์ avatar (พื้นอ่อน+ตัวอักษรเข้ม จับคู่กัน) — วนตามลำดับนักเรียน
const MSC_AV = [
  ['#eaf3de', '#3b6d11'], ['#e1f5ee', '#0f6e56'], ['#e6f1fb', '#185fa5'],
  ['#fbeaf0', '#993556'], ['#faeeda', '#854f0b'], ['#eeedfe', '#534ab7']
];
function mscAvatar(s, i) {
  // การ์ดรายชื่อ (วงกลมใหญ่) = ชื่อเล่นถ้ามี ไม่มีก็เลขที่
  const nick = (s.nickname || '').trim();
  const c = MSC_AV[i % MSC_AV.length];
  const txt = nick || String(s.no || (i + 1));
  const cls = txt.length > 5 ? ' is-tiny' : (txt.length > 3 ? ' is-small' : '');
  return { txt: escapeScore(txt), cls, bg: c[0], fg: c[1] };
}
function mscGradeClass(g) {
  const n = parseFloat(g);
  if (isNaN(n)) return 'zero';
  if (n >= 3) return 'high';
  if (n >= 2) return 'mid';
  if (n >= 1) return 'low';
  return 'zero';
}

const MSC_SLIDE_PX_PER_STEP = 16;
let mscSlideBound = false;
let mscSlideGesture = null;

function finishMobileScoreSlide(state, shouldSave) {
  if (!state) return;
  state.control.classList.remove('is-slide-active');
  if (state.active) {
    state.handle.dataset.slideSuppressUntil = String(Date.now() + 500);
    if (shouldSave && state.changed) {
      requestMobileScoreSave(state.input);
    } else if (state.changed) {
      restoreMobileScoreInput(state.input);
    }
    try { state.handle.releasePointerCapture(state.pointerId); } catch (_) {}
  }
  delete state.control.dataset.slideValue;
  if (mscSlideGesture === state) mscSlideGesture = null;
}

function bindMobileScoreSlide() {
  if (mscSlideBound) return;
  mscSlideBound = true;
  document.addEventListener('pointerdown', event => {
    const handle = event.target.closest && event.target.closest('.msc-slide-handle');
    if (!handle || event.button !== 0) return;
    const control = handle.closest('.msc-score-control');
    const input = control && control.querySelector('.msc-in');
    if (!input) return;
    event.preventDefault();
    if (mscSlideGesture) finishMobileScoreSlide(mscSlideGesture, false);
    const bounds = scoreInputBounds(input);
    const startValue = input.value === '' ? bounds.min : Number(input.value);
    const state = {
      control, handle, input, bounds, pointerId: event.pointerId, startY: event.clientY,
      startValue, active: true, changed: false, lastValue: startValue
    };
    mscSlideGesture = state;
    state.control.classList.add('is-slide-active');
    state.control.dataset.slideValue = input.value === '' ? '–' : input.value;
    input.blur();
    try { state.handle.setPointerCapture(state.pointerId); } catch (_) {}
    if (navigator.vibrate) navigator.vibrate(8);
  });
  document.addEventListener('pointermove', event => {
    const state = mscSlideGesture;
    if (!state || event.pointerId !== state.pointerId) return;
    const distance = event.clientY - state.startY;
    event.preventDefault();
    // ใช้ทิศทางเดียวกับลูกกลิ้งเมาส์: ลากขึ้น = เพิ่มคะแนน, ลากลง = ลดคะแนน
    const steps = -Math.trunc(distance / MSC_SLIDE_PX_PER_STEP);
    const next = normalizedScoreInputValue(state.input, state.startValue + (steps * state.bounds.step));
    if (next === state.lastValue) return;
    state.lastValue = next;
    state.changed = true;
    state.input.value = String(next);
    state.control.dataset.slideValue = String(next);
    if (navigator.vibrate) navigator.vibrate(5);
  }, { passive: false });
  document.addEventListener('pointerup', event => {
    const state = mscSlideGesture;
    if (!state || event.pointerId !== state.pointerId) return;
    if (state.active) event.preventDefault();
    finishMobileScoreSlide(state, true);
  });
  document.addEventListener('pointercancel', event => {
    const state = mscSlideGesture;
    if (state && event.pointerId === state.pointerId) finishMobileScoreSlide(state, false);
  });
  document.addEventListener('contextmenu', event => {
    if (event.target.closest && event.target.closest('.msc-slide-handle')) event.preventDefault();
  });
  document.addEventListener('click', event => {
    const handle = event.target.closest && event.target.closest('.msc-slide-handle');
    if (handle && Number(handle.dataset.slideSuppressUntil || 0) > Date.now()) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

function restoreMobileScoreInput(input) {
  if (!input) return;
  input.value = input.dataset.committedValue || '';
}

function requestMobileScoreSave(input) {
  if (!input) return;
  const previous = input.dataset.committedValue || '';
  const next = clampMark(input.value, Number(input.max));
  input.value = next;
  if (String(next) === previous) return;

  const itemName = input.dataset.itemName || 'รายการนี้';
  const displayPrevious = previous === '' ? 'ยังไม่กรอก' : previous;
  const displayNext = next === '' ? 'ล้างคะแนน' : `${next} คะแนน`;
  showConfirm(
    `เปลี่ยน “${escapeScore(itemName)}” จาก ${displayPrevious} เป็น ${displayNext}?`,
    () => {
      setScoreMark(input.dataset.classId, input.dataset.itemId, input.dataset.studentId, input);
      input.dataset.committedValue = input.value;
      refreshMobileScoreSummary(input.dataset.classId, input.dataset.studentId);
      const control = input.closest('.msc-score-control');
      if (control) {
        control.classList.add('is-slide-saved');
        setTimeout(() => control.classList.remove('is-slide-saved'), 420);
      }
      showToast('บันทึกคะแนนแล้ว', 'success', 1500);
    },
    {
      title: 'ยืนยันการบันทึกคะแนน',
      icon: '✓',
      okText: 'ยืนยันบันทึก',
      okSafe: true,
      onCancel: () => restoreMobileScoreInput(input)
    }
  );
}

function renderMobileScores(c) {
  const wrap = document.getElementById('web-scores-matrix-wrap');
  if (!wrap) return;
  wrap.classList.add('msc-wrap');
  if (c.students.length === 0) {
    mobileScoreStudentId = null;
    wrap.innerHTML = '<div class="empty-state">ห้องนี้ยังไม่มีนักเรียน — เพิ่มรายชื่อในเมนูจัดการรายชื่อเด็กก่อน</div>';
    return;
  }
  if (mobileScoreStudentId && c.students.some(s => s.id === mobileScoreStudentId)) {
    renderMobileStudentPanel(c, mobileScoreStudentId);
  } else {
    mobileScoreStudentId = null;
    renderMobileScoreGrid(c);
  }
}

function renderMobileScoreGrid(c) {
  const wrap = document.getElementById('web-scores-matrix-wrap');
  if (!wrap) return;
  const cards = c.students.map((s, i) => {
    const av = mscAvatar(s, i);
    return `<button class="msc-card" onclick="openMobileStudentScores('${c.id}','${s.id}')">
      <span class="msc-av${av.cls}" style="background:${av.bg};color:${av.fg};">${av.txt}</span>
      <span class="msc-no">เลขที่ ${s.no || (i + 1)}</span>
      <span class="msc-name">${escapeScore(s.name)}</span>
    </button>`;
  }).join('');
  wrap.innerHTML = `<div class="msc-grid">${cards}</div>`;
}

function openMobileStudentScores(classId, sid) {
  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;
  mobileScoreStudentId = sid;
  renderMobileStudentPanel(c, sid);
  const wrap = document.getElementById('web-scores-matrix-wrap');
  if (wrap) wrap.scrollTop = 0;
  notifyTourAction('mobile-score-student-opened');
}

function backToMobileScoreGrid(classId) {
  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;
  mobileScoreStudentId = null;
  renderMobileScoreGrid(c);
}

// การ์ดสรุป (คะแนนรวม + เกรด) — แยกออกมาเพื่ออัปเดตสดโดยไม่ re-render ทั้งหน้า (กันเสียโฟกัสช่องกรอก)
function mobileScoreSummaryHtml(c, sid) {
  const r = computeStudentScore(c, sid);
  const eff = effectiveGrade(c, sid);
  const pct = Math.max(0, Math.min(100, r.total));
  return `<div class="msc-sum-left">
      <div class="msc-sum-lbl">คะแนนรวม</div>
      <div class="msc-sum-total"><b>${r.total}</b><span>/ 100</span></div>
      <div class="msc-bar"><div class="msc-bar-fill" style="width:${pct}%;"></div></div>
    </div>
    <div class="msc-sum-grade">
      <div class="msc-sum-lbl">เกรด</div>
      <div class="msc-grade-badge msc-g-${mscGradeClass(eff)}">${eff}</div>
    </div>`;
}

function refreshMobileScoreSummary(classId, sid) {
  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;
  const box = document.getElementById('msc-summary');
  if (box) box.innerHTML = mobileScoreSummaryHtml(c, sid);
}

function renderMobileStudentPanel(c, sid) {
  const wrap = document.getElementById('web-scores-matrix-wrap');
  if (!wrap) return;
  const s = c.students.find(x => x.id === sid);
  if (!s) { backToMobileScoreGrid(c.id); return; }
  const sc = ensureScores(c);
  const idx = c.students.findIndex(x => x.id === sid);
  const av = mscAvatar(s, idx);

  const buckets = SCORE_WK.map(b => {
    const items = sc.items.filter(i => i.bucket === b.key);
    const w = Number(sc.config.ratio[b.key]) || 0;
    const rows = items.map(it => {
      const v = clampMark((sc.marks[it.id] || {})[sid], it.max);
      return `<div class="msc-row">
        <span class="msc-row-name" title="ตั้งค่ารายการ" onclick="openScoreItemModal('${c.id}','${it.id}')">${escapeScore(it.name)}</span>
        <span class="msc-score-control">
          <span class="msc-box">
            <input type="number" class="msc-in" value="${v}" min="0" max="${it.max}" step="0.5" inputmode="decimal" placeholder="–"
              data-class-id="${escapeScoreAttr(c.id)}" data-item-id="${escapeScoreAttr(it.id)}" data-student-id="${escapeScoreAttr(sid)}"
              data-item-name="${escapeScoreAttr(it.name)}" data-committed-value="${v}"
              onchange="requestMobileScoreSave(this)">
            <span class="msc-slash">/ ${it.max}</span>
          </span>
          <button type="button" class="msc-slide-handle" aria-label="ลากขึ้นเพื่อเพิ่มคะแนน ลากลงเพื่อลดคะแนน">
            <span class="msc-slide-grip" aria-hidden="true"><i></i><i></i><i></i></span>
          </button>
        </span>
      </div>`;
    }).join('');
    return `<div class="msc-bucket msc-bucket-${b.key}">
      <div class="msc-bhead"><span class="msc-blabel">${b.label}</span><span class="msc-bweight">${w}%</span></div>
      ${rows}
      <button class="msc-add" onclick="openScoreItemModal('${c.id}',null,'${b.key}')"><i class="hgi-stroke hgi-add-01"></i> เพิ่มรายการ</button>
    </div>`;
  }).join('');

  wrap.innerHTML = `<div class="msc-panel">
    <button class="msc-back" onclick="backToMobileScoreGrid('${c.id}')"><i class="hgi-stroke hgi-arrow-left-01"></i> รายชื่อ</button>
    <div class="msc-shead">
      <span class="msc-av msc-av-sm" style="background:${av.bg};color:${av.fg};">${s.no || (idx + 1)}</span>
      <div class="msc-shead-txt"><div class="msc-sname">${escapeScore(s.name)}</div></div>
    </div>
    <div class="msc-summary" id="msc-summary">${mobileScoreSummaryHtml(c, sid)}</div>
    <div class="msc-gesture-hint"><i class="hgi-stroke hgi-tap-02"></i><span><b>ปรับคะแนนแบบเร็ว</b> ลากแถบด้านขวาขึ้นเพื่อเพิ่ม · ลากลงเพื่อลด · จากนั้นกดยืนยันการบันทึก</span></div>
    ${buckets}
    ${mobileStudentNavHtml(c, idx)}
  </div>`;
  bindMobileScoreSlide();
}

// แถบข้ามคนท้ายหน้ากรอกรายคน — ของเดิมต้องย้อนกลับไปหน้ารายชื่อแล้วแตะคนถัดไป
// (2 แตะต่อ 1 คน = 80 แตะต่อห้อง) ปุ่มนี้ทำให้ไล่กรอกทั้งห้องรวดเดียวได้
function mobileStudentNavHtml(c, idx) {
  const prev = c.students[idx - 1];
  const next = c.students[idx + 1];
  const btn = (stu, label, dir) => stu
    ? `<button class="msc-nav-btn" onclick="openMobileStudentScores('${c.id}','${stu.id}')">${dir === 'prev' ? '<i class="hgi-stroke hgi-arrow-left-01"></i> ' : ''}${label}${dir === 'next' ? ' <i class="hgi-stroke hgi-arrow-right-01"></i>' : ''}</button>`
    : `<button class="msc-nav-btn" disabled>${dir === 'prev' ? '<i class="hgi-stroke hgi-arrow-left-01"></i> ' : ''}${label}${dir === 'next' ? ' <i class="hgi-stroke hgi-arrow-right-01"></i>' : ''}</button>`;
  return `<div class="msc-nav">
    ${btn(prev, 'คนก่อน', 'prev')}
    <span class="msc-nav-pos">${idx + 1} / ${c.students.length}</span>
    ${btn(next, 'คนถัดไป', 'next')}
  </div>`;
}


// ==================================================================
// ==========  นำเข้า / ส่งออก / เทมเพลต คะแนน (ปพ.5)  =============
// ==================================================================
// โครงคอลัมน์ (round-trip): เลขที่ | เลขประจำตัว | ชื่อ-สกุล | [รายการคะแนนราย bucket] | รวม | ระดับผลการเรียน
//  · export/template ใช้โครงเดียวกัน (template = ช่องคะแนนว่าง) → ครูกรอกแล้ว import กลับได้ทันที
//  · import จับคู่คอลัมน์ด้วย "ชื่อรายการ" ให้ตรงกับ item ในห้อง — คอลัมน์รวม/เกรด อ่านอย่างเดียว ไม่ import

const SC_BUCKET_GROUP_LABEL = {
  before: 'คะแนนเก็บก่อนกลางภาค',
  after:  'คะแนนเก็บหลังกลางภาค',
  mid:    'สอบกลางภาค',
  final:  'สอบปลายภาค'
};

// รายการคะแนนเรียงตามลำดับ bucket (ก่อน→หลัง→กลาง→ปลาย)
function scoreOrderedItems(c) {
  const sc = ensureScores(c);
  const items = [];
  ['before', 'after', 'mid', 'final'].forEach(bk => {
    sc.items.filter(i => i.bucket === bk).forEach(it => items.push(it));
  });
  return items;
}

function scoreFileBase(c) {
  const safe = (String(c.subject || 'คะแนน') + '_' + String(c.className || '')).replace(/[\\/:*?"<>|]/g, '').trim();
  return safe || 'คะแนน';
}

// สร้างตาราง 2 มิติ (AOA) + merge สำหรับ xlsx — ใช้ร่วม export/template (withData=false → ช่องว่าง)
function buildScoreSheet(c, withData) {
  const sc = ensureScores(c);
  const items = scoreOrderedItems(c);
  const idCols = ['เลขที่', 'เลขประจำตัว', 'ชื่อ-สกุล'];
  const nID = idCols.length;
  const width = nID + items.length + 2;   // + รวม + เกรด

  // แถว 0: ป้ายกลุ่ม (merge เหนือรายการของ bucket เดียวกัน) — ช่องระบุตัวตน/สรุปเว้นว่าง
  const groupRow = new Array(width).fill('');
  const merges = [];
  let ci = nID;
  ['before', 'after', 'mid', 'final'].forEach(bk => {
    const cnt = items.filter(i => i.bucket === bk).length;
    if (cnt === 0) return;
    groupRow[ci] = SC_BUCKET_GROUP_LABEL[bk];
    if (cnt > 1) merges.push({ s: { r: 0, c: ci }, e: { r: 0, c: ci + cnt - 1 } });
    ci += cnt;
  });

  // แถว 1: หัวคอลัมน์เครื่องอ่านได้ · แถว 2: คะแนนเต็ม
  const headRow = [...idCols, ...items.map(i => i.name), 'รวม', 'ระดับผลการเรียน'];
  const maxRow  = ['คะแนนเต็ม', '', '', ...items.map(i => Number(i.max) || 0), 100, ''];

  const aoa = [groupRow, headRow, maxRow];
  c.students.forEach((s, idx) => {
    const row = [s.no || (idx + 1), s.studentCode || '', s.name];
    items.forEach(it => {
      const v = withData ? clampMark((sc.marks[it.id] || {})[s.id], it.max) : '';
      row.push(v === '' ? '' : Number(v));
    });
    row.push(withData ? computeStudentScore(c, s.id).total : '');
    row.push(withData ? effectiveGrade(c, s.id) : '');
    aoa.push(row);
  });

  const cols = [{ wch: 6 }, { wch: 12 }, { wch: 24 }, ...items.map(() => ({ wch: 9 })), { wch: 8 }, { wch: 12 }];
  return { aoa, merges, cols };
}

// คะแนนราย "ส่วน" (ถ่วงน้ำหนักตาม ratio แล้ว) — ใช้กับฟอร์มราชการ: keys=['before','after'] = หน่วยการเรียน
function _writeSheet(c, built, suffix, okMsg) {
  const ws = XLSX.utils.aoa_to_sheet(built.aoa);
  if (built.merges && built.merges.length) ws['!merges'] = built.merges;
  ws['!cols'] = built.cols;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'คะแนน');
  XLSX.writeFile(wb, `${scoreFileBase(c)}_${suffix}.xlsx`);
  showToast(okMsg, 'success');
}

// ---- ส่งออก Excel (ตารางคะแนนรายชิ้น + คะแนนเต็ม — ไว้เก็บบันทึก/พิมพ์) ----
function exportScoresExcel() {
  const c = appState.classes.find(x => x.id === scoreCurrentClassId);
  if (!c) { showToast('ยังไม่ได้เลือกห้อง', 'warning'); return; }
  if (!c.students.length) { showToast('ห้องนี้ยังไม่มีนักเรียน', 'warning'); return; }
  try { _writeSheet(c, buildScoreSheet(c, true), 'คะแนน', 'ส่งออก Excel เรียบร้อย'); closeScoreExportMenu(); }
  catch (err) { showToast('ส่งออกไม่ได้: ' + err.message, 'error'); }
}

// ---- ส่งออก PDF (พิมพ์ผ่านเบราว์เซอร์ → Save as PDF) ----
function exportScoresPDF() {
  const c = appState.classes.find(x => x.id === scoreCurrentClassId);
  if (!c) { showToast('ยังไม่ได้เลือกห้อง', 'warning'); return; }
  if (!c.students.length) { showToast('ห้องนี้ยังไม่มีนักเรียน', 'warning'); return; }
  const sc = ensureScores(c);
  const r = sc.config.ratio;
  const items = scoreOrderedItems(c);

  // หัวกลุ่ม (colspan ตามจำนวนรายการใน bucket)
  let grpTh = '';
  ['before', 'after', 'mid', 'final'].forEach(bk => {
    const cnt = items.filter(i => i.bucket === bk).length;
    if (cnt === 0) return;
    grpTh += `<th colspan="${cnt}" class="grp">${SC_BUCKET_GROUP_LABEL[bk]}</th>`;
  });
  const itemTh = items.map(i => `<th class="it">${escapeScore(i.name)}</th>`).join('');
  const maxTh = items.map(i => `<th class="mx">${Number(i.max) || 0}</th>`).join('');
  const bodyRows = c.students.map((s, idx) => {
    const cells = items.map(it => { const v = clampMark((sc.marks[it.id] || {})[s.id], it.max); return `<td>${v === '' ? '' : v}</td>`; }).join('');
    return `<tr><td>${s.no || (idx + 1)}</td><td>${escapeScore(s.studentCode || '')}</td><td class="nm">${escapeScore(s.name)}</td>${cells}<td class="tt">${computeStudentScore(c, s.id).total}</td><td class="gd">${escapeScore(effectiveGrade(c, s.id))}</td></tr>`;
  }).join('');
  const ratioTxt = `คะแนนเก็บ ${(Number(r.before) || 0) + (Number(r.after) || 0)}% · สอบกลางภาค ${Number(r.mid) || 0}% · สอบปลายภาค ${Number(r.final) || 0}%`;
  const css = `*{box-sizing:border-box;} body{font-family:'Sarabun','TH Sarabun New',system-ui,sans-serif;color:#111;margin:16px;}
  h2{margin:0 0 2px;font-size:18px;} .sub{color:#555;font-size:12px;margin-bottom:10px;}
  table{width:100%;border-collapse:collapse;font-size:11px;} th,td{border:1px solid #999;padding:3px 4px;text-align:center;}
  thead th{background:#eef5f2;} th.grp{background:#e3f4ec;} td.nm{text-align:left;white-space:nowrap;} td.tt{font-weight:700;background:#f3faf6;}
  td.gd{font-weight:700;} tbody tr:nth-child(even) td{background:#fbfcfc;} @page{size:A4 landscape;margin:10mm;}`;
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeScore(scoreFileBase(c))}_คะแนน</title><style>${css}</style></head><body>
  <h2>บันทึกคะแนน — ${escapeScore(c.subject || '')} ${escapeScore(c.className || '')}</h2>
  <div class="sub">สัดส่วนคะแนน: ${ratioTxt} · จำนวนนักเรียน ${c.students.length} คน</div>
  <table><thead>
    <tr><th rowspan="2">เลขที่</th><th rowspan="2">เลขประจำตัว</th><th rowspan="2">ชื่อ-สกุล</th>${grpTh}<th rowspan="2">รวม</th><th rowspan="2">ระดับ<br>ผลการเรียน</th></tr>
    <tr>${itemTh}</tr>
    <tr><th colspan="3" style="text-align:right">คะแนนเต็ม</th>${maxTh}<th>100</th><th></th></tr>
  </thead><tbody>${bodyRows}</tbody></table>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { showToast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ — อนุญาต popup แล้วลองใหม่', 'warning'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch (e) {} }, 350);
  closeScoreExportMenu();
}

// ---- เมนูส่งออก (mini modal) ----
function openScoreExportMenu() {
  const c = appState.classes.find(x => x.id === scoreCurrentClassId);
  if (!c) { showToast('ยังไม่ได้เลือกห้อง', 'warning'); return; }
  document.getElementById('modal-score-export').classList.add('show');
}
function closeScoreExportMenu() {
  const m = document.getElementById('modal-score-export');
  if (m) m.classList.remove('show');
}
