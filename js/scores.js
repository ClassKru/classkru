/**
 * =========================================================
 * ClassKru — Scores (เก็บคะแนน + ตัดเกรด)
 * =========================================================
 * เพิ่มบน class เดิม (Subject Class) โดยไม่แตะระบบเช็คชื่อ
 * โครงข้อมูล: class.scores = { config, items[], marks{}, gradeOverride{} }
 * คะแนน key ด้วย student.id เดิม → forward-compatible กับ Student Master อนาคต
 */

// ช่องคะแนนตาม ปพ.5 (bucket) — ลำดับคงที่
const SCORE_BUCKETS = [
  { key: 'before', label: 'ก่อนกลางภาค' },
  { key: 'mid',    label: 'กลางภาค' },
  { key: 'after',  label: 'หลังกลางภาค' },
  { key: 'final',  label: 'ปลายภาค' }
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
    ratio: { before: 25, mid: 20, after: 25, final: 30 },
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
  if (!c.scores.config.gradeCut) c.scores.config.gradeCut = defaultScoreConfig().gradeCut;
  if (typeof c.scores.config.attendanceMin !== 'number') c.scores.config.attendanceMin = 60;
  if (!c.scores.items) c.scores.items = [];
  if (!c.scores.marks) c.scores.marks = {};
  if (!c.scores.gradeOverride) c.scores.gradeOverride = {};
  return c.scores;
}

// ==================== คำนวณ ====================
// รวมคะแนนถ่วงน้ำหนักตาม ratio → เต็ม 100
function computeStudentScore(c, sid) {
  const sc = ensureScores(c);
  const buckets = {};
  let total = 0;
  SCORE_BUCKETS.forEach(b => {
    const items = sc.items.filter(i => i.bucket === b.key);
    let raw = 0, max = 0, has = false;
    items.forEach(i => {
      max += Number(i.max) || 0;
      const m = (sc.marks[i.id] || {})[sid];
      if (m !== undefined && m !== null) { raw += Number(m); has = true; }
    });
    const weight = Number(sc.config.ratio[b.key]) || 0;
    const scaled = max > 0 ? (raw / max) * weight : 0;
    buckets[b.key] = { raw, max, scaled, has, weight };
    total += scaled;
  });
  total = Math.round(total * 100) / 100;
  return { buckets, total, grade: gradeFromScore(sc.config, total) };
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
function renderWebScores() {
  const sel = document.getElementById('web-scores-selection-view');
  const detail = document.getElementById('web-scores-detail-view');
  if (sel) sel.style.display = 'block';
  if (detail) detail.style.display = 'none';
  const list = document.getElementById('web-scores-class-list');
  if (!list) return;
  list.innerHTML = '';
  if (appState.classes.length === 0) {
    list.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">ยังไม่มีห้องเรียน — เพิ่มห้องเรียนวิชาสอนก่อน</div>';
    return;
  }
  appState.classes.forEach(c => {
    const sc = ensureScores(c);
    const col = getClassColor(c.id);
    list.innerHTML += `<div class="card" style="padding:20px;cursor:pointer;border-top:4px solid ${col.text};" onclick="viewClassScores('${c.id}')">
      <strong style="font-size:1.05rem;">${c.subject}</strong>
      <span class="subtitle">${c.className} · <span style="font-weight:700;color:var(--text-main);">${c.students.length}</span> คน</span>
      <div style="margin-top:10px;font-size:0.82rem;color:var(--text-muted);"><i class="hgi-stroke hgi-task-01"></i> รายการคะแนน <strong style="color:${col.text};">${sc.items.length}</strong> รายการ</div>
    </div>`;
  });
}

function goBackToWebScoresSelection() {
  // เข้าคะแนนจากการ์ดห้อง → กลับไปหน้าห้องเรียน (การ์ดคือตัวเลือกห้องอยู่แล้ว)
  navigateToWebScreen('classrooms');
}

// ==================== หน้ารายละเอียด (matrix) ====================
let scoreCurrentClassId = null;

// ทางเข้าหลักจากการ์ดห้อง (ข้างปุ่มเช็คชื่อ) → เข้าตารางคะแนนของห้องนั้นตรง ๆ
function openClassScores(classId) {
  navigateToWebScreen('scores');
  viewClassScores(classId);
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
  ensureScores(c);
  document.getElementById('web-scores-selection-view').style.display = 'none';
  document.getElementById('web-scores-detail-view').style.display = 'block';
  const col = getClassColor(c.id);
  document.getElementById('web-scores-detail-title').innerHTML =
    `<span style="width:12px;height:12px;border-radius:50%;background:${col.text};flex-shrink:0;"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">${c.subject} (${c.className})</span>`;
  renderScoreMatrix(c);
}

function renderScoreMatrix(c) {
  const sc = ensureScores(c);
  const wrap = document.getElementById('web-scores-matrix-wrap');
  if (!wrap) return;

  if (c.students.length === 0) {
    wrap.innerHTML = '<div class="empty-state">ห้องนี้ยังไม่มีนักเรียน — เพิ่มรายชื่อในเมนูจัดการรายชื่อเด็กก่อน</div>';
    return;
  }

  const groups = SCORE_BUCKETS
    .map(b => ({ b, items: sc.items.filter(i => i.bucket === b.key) }))
    .filter(g => g.items.length > 0);

  if (groups.length === 0) {
    wrap.innerHTML = `<div class="empty-state" style="padding:32px 16px;">
      <i class="hgi-stroke hgi-task-add-01" style="font-size:2rem;display:block;margin-bottom:10px;opacity:0.5;"></i>
      ยังไม่มีรายการคะแนน<br><span style="font-size:0.82rem;">กด "เพิ่มรายการคะแนน" ด้านบนเพื่อเริ่ม เช่น ใบงานที่ 1, Quiz, สอบปลายภาค</span>
    </div>`;
    return;
  }

  // แถวหัว 2 ชั้น: ชั้นบน = ช่อง (bucket) + น้ำหนัก, ชั้นล่าง = รายการ
  let head1 = '<tr><th class="sc-sticky" rowspan="2" style="min-width:160px;">นักเรียน</th>';
  let head2 = '<tr>';
  groups.forEach(g => {
    const w = Number(sc.config.ratio[g.b.key]) || 0;
    head1 += `<th class="sc-bucket-head" colspan="${g.items.length}">${g.b.label} <span style="font-weight:400;">${w}%</span></th>`;
    g.items.forEach(it => {
      head2 += `<th class="sc-item-head" style="text-align:center;min-width:66px;" title="แก้ไขรายการ" onclick="openScoreItemModal('${c.id}','${it.id}')">
        <div style="white-space:nowrap;">${escapeScore(it.name)}</div>
        <div style="font-weight:400;color:var(--text-muted);">เต็ม ${it.max}</div>
      </th>`;
    });
  });
  head1 += `<th rowspan="2" style="text-align:center;min-width:74px;">รวม<div style="font-weight:400;font-size:0.66rem;">(100)</div></th>
    <th rowspan="2" style="text-align:center;min-width:70px;">เวลาเรียน</th>
    <th rowspan="2" style="text-align:center;min-width:132px;">เกรด</th></tr>`;
  head2 += '</tr>';

  let body = '<tbody>';
  c.students.forEach(s => {
    body += `<tr><td class="sc-sticky"><span class="sc-no">${s.no || '-'}.</span>${escapeScore(s.name)}</td>`;
    groups.forEach(g => {
      g.items.forEach(it => {
        const v = (sc.marks[it.id] || {})[s.id];
        body += `<td style="text-align:center;"><input type="number" class="score-cell-input" value="${v === undefined || v === null ? '' : v}" min="0" max="${it.max}" step="0.5" placeholder="–"
          onchange="setScoreMark('${c.id}','${it.id}','${s.id}',this.value)"></td>`;
      });
    });
    body += scoreSummaryCells(c, s);
    body += '</tr>';
  });
  body += '</tbody>';

  wrap.innerHTML = `<table class="score-matrix-table"><thead>${head1}${head2}</thead>${body}</table>`;
}

// เซลล์สรุปท้ายแถว (รวม / เวลาเรียน / เกรด) — id ต่อคน เพื่ออัปเดตแบบไม่ re-render ทั้งตาราง
function scoreSummaryCells(c, s) {
  const r = computeStudentScore(c, s.id);
  const att = studentAttendancePct(c, s.id);
  const attMin = c.scores.config.attendanceMin;
  const attTxt = att === null ? '-' : `${att}%`;
  const isMs = att !== null && att < attMin;
  return `<td id="sc-total-${s.id}" class="sc-total">${r.total}</td>
    <td id="sc-att-${s.id}" class="sc-att" style="color:${isMs ? 'var(--color-absent)' : 'var(--text-main)'};">${attTxt}${isMs ? ' <span style="font-size:0.66rem;">(มส.)</span>' : ''}</td>
    <td id="sc-grade-${s.id}" class="sc-grade">${gradeCellHtml(c, s)}</td>`;
}

function gradeCellHtml(c, s) {
  const ov = ensureScores(c).gradeOverride[s.id];
  const auto = computeStudentScore(c, s.id).grade;
  const eff = ov || auto;
  let opts = `<option value="">อัตโนมัติ (${auto})</option>`;
  SCORE_GRADES.forEach(g => { opts += `<option value="${g}" ${ov === g ? 'selected' : ''}>${g}</option>`; });
  const ovMark = ov ? ' <span class="sc-ov-tag">แก้แล้ว</span>' : '';
  return `<span class="sc-grade-val">${eff}</span>${ovMark}
    <select class="score-grade-sel" onchange="setGradeOverride('${c.id}','${s.id}',this.value)">${opts}</select>`;
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
function setScoreMark(classId, itemId, sid, val) {
  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;
  const sc = ensureScores(c);
  const item = sc.items.find(i => i.id === itemId);
  let n = (val === '' || val === null) ? null : Number(val);
  if (n !== null) {
    if (isNaN(n)) n = null;
    else n = Math.max(0, item ? Math.min(n, Number(item.max)) : n);
  }
  if (!sc.marks[itemId]) sc.marks[itemId] = {};
  if (n === null) delete sc.marks[itemId][sid];
  else sc.marks[itemId][sid] = n;
  saveState();
  updateScoreRow(c, sid);
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

// ==================== รายการคะแนน (item CRUD) ====================
let editingScoreItemId = null;

function openScoreItemModal(classId, itemId) {
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
  const bucketSel = document.getElementById('input-score-bucket');
  bucketSel.innerHTML = SCORE_BUCKETS.map(b => `<option value="${b.key}" ${it && it.bucket === b.key ? 'selected' : ''}>${b.label}</option>`).join('');

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
  const bucket = document.getElementById('input-score-bucket').value;
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
  document.getElementById('input-ratio-mid').value = cfg.ratio.mid;
  document.getElementById('input-ratio-after').value = cfg.ratio.after;
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
  const sum = ['before', 'mid', 'after', 'final']
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
    mid: Number(document.getElementById('input-ratio-mid').value) || 0,
    after: Number(document.getElementById('input-ratio-after').value) || 0,
    final: Number(document.getElementById('input-ratio-final').value) || 0
  };
  const sum = ratio.before + ratio.mid + ratio.after + ratio.final;
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
