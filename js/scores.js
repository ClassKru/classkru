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

// เปิดฮับเครื่องมือช่วยสอนจากหน้าคะแนน — เซ็ต context ห้องให้เครื่องมือ (สุ่มชื่อ ฯลฯ) ชี้ห้องคะแนนนี้
function openScoreClassTools() {
  if (scoreCurrentClassId) swipeClassId = scoreCurrentClassId;
  openToolsHub();
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
  renderScoreMatrix(c);
}

function renderScoreMatrix(c) {
  const sc = ensureScores(c);
  const wrap = document.getElementById('web-scores-matrix-wrap');
  if (!wrap) return;

  // มือถือ = โหมด "ลงมือ": การ์ดรายชื่อ → แตะเข้ากรอกทีละคน (desktop คงตารางเดิม)
  if (typeof isMobileView === 'function' && isMobileView()) return renderMobileScores(c);

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

  // คอลัมน์เรียง (บล็อกว่าง = placeholder 1 คอลัมน์) + ธงเริ่ม/ท้ายบล็อก (ตีเส้นขั้น + เกาะปุ่มเพิ่ม)
  const cols = [];
  disp.forEach(g => {
    if (g.items.length) g.items.forEach((it, idx) => cols.push({ g, it, groupStart: idx === 0, groupEnd: idx === g.items.length - 1 }));
    else cols.push({ g, placeholder: true, groupStart: true });
  });

  // ---- หัวตาราง 3 ชั้นแบบ ปพ.5 ----
  const nameCols = `<th class="sc-c-no" rowspan="3">เลขที่</th><th class="sc-c-code" rowspan="3">รหัส</th><th class="sc-c-name" rowspan="3">ชื่อ-นามสกุล</th>`;
  const sumCols = `<th rowspan="3" style="text-align:center;min-width:56px;">รวม<div style="font-weight:400;font-size:0.66rem;color:${sumW === 100 ? 'inherit' : 'var(--color-absent)'};">(${sumW})</div></th>
    <th rowspan="3" style="text-align:center;min-width:54px;">เกรด</th>
    <th class="sc-c-manage" rowspan="3" style="min-width:74px;">จัดการ</th>`;

  // ชั้น 1: คะแนนเก็บ (คลุมก่อน+หลัง, โชว์ % รวมอ่านอย่างเดียว) | สอบกลางภาค % | สอบปลายภาค %
  let r1 = '<tr>' + nameCols
    + `<th class="sc-bucket-head sc-cat-start" colspan="${collectCount}"><span class="sc-bk-name">คะแนนเก็บ</span> <span class="sc-bk-w sc-w-readonly">${collectW}%</span></th>`;
  examGroups.forEach(g => { r1 += `<th class="sc-bucket-head sc-cat-start" colspan="${cspan(g)}" rowspan="2"><span class="sc-bk-name">${g.label}</span> <span class="sc-bk-w">${wInput(g.key)}</span></th>`; });
  r1 += sumCols + '</tr>';

  // ชั้น 2: ระยะย่อย + สัดส่วน % แยก ก่อน/หลังกลางภาค
  let r2 = '<tr>';
  collectGroups.forEach(g => { r2 += `<th class="sc-phase-head sc-cat-start" colspan="${cspan(g)}"><span class="sc-bk-name">${g.label}</span> <span class="sc-bk-w">${wInput(g.key)}</span></th>`; });
  r2 += '</tr>';

  // ชั้น 3: รายการ (ชื่อ/เต็ม/ปุ่มตั้งค่า) — บล็อกว่างเป็นปุ่ม + / รายการท้ายบล็อกมีปุ่ม + ลอยเกาะขอบขวา
  let r3 = '<tr>';
  cols.forEach(({ g, it, placeholder, groupStart, groupEnd }) => {
    const cs = groupStart ? ' sc-cat-start' : '';
    if (placeholder) {
      r3 += `<th class="sc-item-head sc-item-empty${cs}"><button class="sc-add-item-btn" title="เพิ่มรายการใน ${g.label}" onclick="openScoreItemModal('${c.id}',null,'${g.key}')"><i class="hgi-stroke hgi-add-01"></i></button></th>`;
    } else {
      const nameEsc = escapeScore(it.name).replace(/"/g, '&quot;');
      // ปุ่ม + ลอยเกาะขอบขวาของรายการสุดท้ายในบล็อก (ไม่กินคอลัมน์)
      const floatAdd = groupEnd ? `<button class="sc-add-float" title="เพิ่มรายการใน ${g.label}" onclick="openScoreItemModal('${c.id}',null,'${g.key}')"><i class="hgi-stroke hgi-add-01"></i></button>` : '';
      r3 += `<th class="sc-item-head${groupEnd ? ' sc-item-last' : ''}${cs}">${floatAdd}
        <input class="sc-item-name-input" value="${nameEsc}" title="แก้ชื่อรายการ (คลิกพิมพ์)" onchange="setItemName('${c.id}','${it.id}',this)">
        <div class="sc-item-max-row" title="คะแนนเต็ม"><span class="sc-item-max-lbl">/</span><input type="number" class="sc-item-max-input" value="${it.max}" min="1" step="0.5" title="แก้คะแนนเต็ม (คลิกพิมพ์)" onchange="setItemMax('${c.id}','${it.id}',this)"><button class="sc-item-more" title="ตั้งค่ารายการ (ระยะ/ประเภท/วันที่/ลบ)" onclick="openScoreItemModal('${c.id}','${it.id}')"><i class="hgi-stroke hgi-settings-01"></i></button></div>
      </th>`;
    }
  });
  r3 += '</tr>';

  const thead = r1 + r2 + r3;

  let body = '<tbody>';
  c.students.forEach((s, index) => {
    body += `<tr>`
      + `<td class="sc-c-no">${s.no || (index + 1)}</td>`
      + `<td class="sc-c-code">${escapeScore(s.studentCode || '—')}</td>`
      + `<td class="sc-c-name">${escapeScore(s.name)}</td>`;
    cols.forEach(({ it, placeholder, groupStart }) => {
      if (placeholder) { body += `<td class="sc-cell-empty${groupStart ? ' sc-cat-start' : ''}"></td>`; return; }
      const v = clampMark((sc.marks[it.id] || {})[s.id], it.max);
      body += `<td style="text-align:center;"${groupStart ? ' class="sc-cat-start"' : ''}><input type="number" class="score-cell-input" value="${v}" min="0" max="${it.max}" step="0.5" placeholder="–"
        onchange="setScoreMark('${c.id}','${it.id}','${s.id}',this)"></td>`;
    });
    body += scoreSummaryCells(c, s);
    body += `<td class="sc-c-manage"><div class="sc-manage-actions">
      <button class="d-manage-btn" title="แก้ไขข้อมูล" onclick="currentClassId='${c.id}';openStudentDetailModal('${s.id}','${c.id}')"><i class="hgi-stroke hgi-edit-02"></i></button>
      <button class="d-manage-btn danger" title="ลบรายชื่อ" onclick="deleteStudentFromScores('${c.id}','${s.id}')"><i class="hgi-stroke hgi-delete-02"></i></button>
    </div></td>`;
    body += '</tr>';
  });
  body += '</tbody>';

  wrap.innerHTML = `<table class="score-matrix-table"><thead>${thead}</thead>${body}</table>`;
}

// เซลล์สรุปท้ายแถว (รวม / เกรด) — id ต่อคน เพื่ออัปเดตแบบไม่ re-render ทั้งตาราง
function scoreSummaryCells(c, s) {
  const r = computeStudentScore(c, s.id);
  return `<td id="sc-total-${s.id}" class="sc-total">${r.total}</td>
    <td id="sc-grade-${s.id}" class="sc-grade">${gradeCellHtml(c, s)}</td>`;
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
  renderScoreMatrix(c);
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
    renderScoreMatrix(c);
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
  renderScoreMatrix(c);
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
  renderScoreMatrix(c);
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
    saveState();
    closeScoreItemModal();
    renderScoreMatrix(c);
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
  renderScoreMatrix(c);
  showToast('บันทึกการตั้งค่าคะแนนแล้ว', 'success');
}

function closeScoreSettingsModal() {
  document.getElementById('modal-score-settings').classList.remove('show');
}

// escape เบา ๆ สำหรับข้อความในตาราง
function escapeScore(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
  return { txt: escapeScore(nick || String(s.no || (i + 1))), bg: c[0], fg: c[1] };
}
function mscGradeClass(g) {
  const n = parseFloat(g);
  if (isNaN(n)) return 'zero';
  if (n >= 3) return 'high';
  if (n >= 2) return 'mid';
  if (n >= 1) return 'low';
  return 'zero';
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
      <span class="msc-av" style="background:${av.bg};color:${av.fg};">${av.txt}</span>
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
        <span class="msc-box">
          <input type="number" class="msc-in" value="${v}" min="0" max="${it.max}" step="0.5" inputmode="decimal" placeholder="–"
            onchange="setScoreMark('${c.id}','${it.id}','${sid}',this);refreshMobileScoreSummary('${c.id}','${sid}')">
          <span class="msc-slash">/ ${it.max}</span>
        </span>
      </div>`;
    }).join('');
    return `<div class="msc-bucket">
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
    ${buckets}
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
