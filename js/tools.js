// ==================== เครื่องมือช่วยสอน (Teaching Tools Hub) ====================
// ฮับแบบ registry — เพิ่มเครื่องมือใหม่ = push เข้า TEACHING_TOOLS + เขียน handler (status:'ready')
// ไม่ต้องแตะโครง ฮับ render กริดจากลิสต์เอง (ดู OWNERSHIP.md — ไฟล์นี้เพิ่มเครื่องมือได้อิสระ)

const TEACHING_TOOLS = [
  { id:'random-name',   name:'สุ่มรายชื่อ',  desc:'สุ่มผู้ตอบคำถาม',   icon:'hgi-shuffle',        tint:'green',  status:'ready', open: openRandomNameTool },
  { id:'random-group',  name:'สุ่มจับกลุ่ม',  desc:'แบ่งกลุ่มอัตโนมัติ', icon:'hgi-user-group',     tint:'blue',   status:'soon' },
  { id:'timer',         name:'จับเวลา',      desc:'จับเวลากิจกรรม',    icon:'hgi-timer-02',       tint:'amber',  status:'soon' },
  { id:'countdown',     name:'นับถอยหลัง',   desc:'ตั้งเวลากิจกรรม',    icon:'hgi-alarm-clock',    tint:'coral',  status:'soon' },
  { id:'random-number', name:'สุ่มตัวเลข',    desc:'สุ่มเลข / หัวข้อ',   icon:'hgi-dice-faces-05',  tint:'purple', status:'soon' },
  { id:'noise',         name:'วัดเสียงห้อง',  desc:'คุมระดับเสียง',      icon:'hgi-volume-high',    tint:'pink',   status:'soon' },
  { id:'scoreboard',    name:'กระดานคะแนน',  desc:'สะสมแต้มพฤติกรรม',   icon:'hgi-award-01',       tint:'gray',   status:'soon' },
];

// ---------- Hub ----------
function openToolsHub() {
  let ov = document.getElementById('tools-hub-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'tools-hub-overlay';
    ov.className = 'modal-overlay';
    ov.style.zIndex = '9500';
    ov.onclick = (e) => { if (e.target === ov) closeToolsHub(); };
    document.body.appendChild(ov);
  }
  const cards = TEACHING_TOOLS.map(t => {
    const ready = t.status === 'ready';
    const click = ready ? `onclick="runTool('${t.id}')"` : `onclick="showToast('เครื่องมือนี้กำลังพัฒนา เร็วๆ นี้')"`;
    return `<div class="tool-card ${ready ? 'ready' : 'soon'}" ${click}>
        ${ready ? '' : '<span class="tool-soon-badge">เร็วๆ นี้</span>'}
        <span class="tool-icon tint-${t.tint}"><i class="hgi-stroke ${t.icon}"></i></span>
        <div class="tool-name">${t.name}</div>
        <div class="tool-desc">${t.desc}</div>
      </div>`;
  }).join('');
  ov.innerHTML = `<div class="bottom-sheet tools-hub-sheet">
      <div class="modal-header">
        <h3><i class="hgi-stroke hgi-magic-wand-01" style="color:var(--primary);margin-right:6px;"></i>เครื่องมือช่วยสอน</h3>
        <button class="btn btn-text" onclick="closeToolsHub()"><i class="hgi-stroke hgi-cancel-01"></i></button>
      </div>
      <p class="tools-hub-sub">เลือกเครื่องมือมาใช้หน้าชั้นได้ทันที</p>
      <div class="tools-grid">${cards}</div>
      <p class="tools-hub-foot">เพิ่มเครื่องมือใหม่ได้เรื่อยๆ</p>
    </div>`;
  ov.classList.add('show');
}
function closeToolsHub() {
  const ov = document.getElementById('tools-hub-overlay');
  if (ov) ov.classList.remove('show');
}
function runTool(id) {
  const t = TEACHING_TOOLS.find(x => x.id === id);
  closeToolsHub();
  if (t && typeof t.open === 'function') t.open();
}

// ---------- เครื่องมือ: สุ่มรายชื่อ ----------
let _rnMode = 'all';   // 'all' | 'present'
let _rnUsed = [];      // id ที่สุ่มไปแล้ว (โหมดสุ่มไม่ซ้ำ)

function _rnClass() { return appState.classes.find(x => x.id === swipeClassId) || null; }
function _rnIsPresent(s) { const st = swipeResults[s.id]; return st === 'present' || st === 'late'; }
function _rnPool() {
  const c = _rnClass();
  if (!c || !c.students) return [];
  return _rnMode === 'present' ? c.students.filter(_rnIsPresent) : c.students.slice();
}

function openRandomNameTool() {
  const c = _rnClass();
  if (!c || !c.students || c.students.length === 0) { showToast('ยังไม่มีรายชื่อนักเรียนในห้องนี้'); return; }
  _rnMode = 'all'; _rnUsed = [];
  let ov = document.getElementById('random-name-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'random-name-overlay';
    ov.className = 'modal-overlay';
    ov.style.zIndex = '9600';
    ov.onclick = (e) => { if (e.target === ov) closeRandomName(); };
    document.body.appendChild(ov);
  }
  ov.innerHTML = `<div class="bottom-sheet rn-sheet">
      <div class="modal-header">
        <h3><i class="hgi-stroke hgi-shuffle" style="color:var(--primary);margin-right:6px;"></i>สุ่มรายชื่อ</h3>
        <button class="btn btn-text" onclick="closeRandomName()"><i class="hgi-stroke hgi-cancel-01"></i></button>
      </div>
      <div class="rn-seg-wrap">
        <button class="rn-seg on" data-mode="all" onclick="_rnSetMode('all')">ทั้งห้อง <b id="rn-count-all">0</b></button>
        <button class="rn-seg" data-mode="present" onclick="_rnSetMode('present')">เฉพาะคนมา <b id="rn-count-present">0</b></button>
      </div>
      <div class="rn-stage">
        <div class="rn-reveal-no" id="rn-reveal-no">–</div>
        <div class="rn-reveal-name" id="rn-reveal-name">กดสุ่มเลย</div>
        <div class="rn-hint" id="rn-hint">เลขที่ · ชื่อ จะเด้งขึ้นตรงนี้</div>
      </div>
      <button class="btn btn-primary rn-spin" id="rn-spin" onclick="_rnSpin()"><i class="hgi-stroke hgi-shuffle"></i> สุ่ม</button>
      <label class="rn-nodup-row"><input type="checkbox" id="rn-nodup" checked> สุ่มไม่ซ้ำ (จนครบห้องแล้วเริ่มใหม่)</label>
    </div>`;
  ov.classList.add('show');
  _rnRenderCounts();
}
function closeRandomName() {
  const ov = document.getElementById('random-name-overlay');
  if (ov) ov.classList.remove('show');
}
function _rnSetMode(m) {
  _rnMode = m; _rnUsed = [];
  document.querySelectorAll('#random-name-overlay .rn-seg').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  _rnRenderCounts();
  const h = document.getElementById('rn-hint'); if (h) h.textContent = 'พร้อมสุ่มใหม่';
}
function _rnRenderCounts() {
  const c = _rnClass(); if (!c || !c.students) return;
  const a = document.getElementById('rn-count-all'), p = document.getElementById('rn-count-present');
  if (a) a.textContent = c.students.length;
  if (p) p.textContent = c.students.filter(_rnIsPresent).length;
}
function _rnSpin() {
  const hint = document.getElementById('rn-hint');
  const nodup = document.getElementById('rn-nodup');
  const total = _rnPool().length;
  if (total === 0) { if (hint) hint.textContent = _rnMode === 'present' ? 'ยังไม่มีคนเช็คว่ามา' : 'ไม่มีรายชื่อในห้อง'; return; }
  let pool = _rnPool();
  const noDup = nodup ? nodup.checked : true;
  if (noDup) {
    let left = pool.filter(s => _rnUsed.indexOf(s.id) < 0);
    if (left.length === 0) { _rnUsed = []; left = pool; if (hint) hint.textContent = 'ครบทุกคนแล้ว เริ่มรอบใหม่'; }
    pool = left;
  } else if (hint) { hint.textContent = ''; }

  const spin = document.getElementById('rn-spin');
  const noEl = document.getElementById('rn-reveal-no');
  const nameEl = document.getElementById('rn-reveal-name');
  const ticks = 16;
  let i = 0;
  spin.disabled = true; spin.style.opacity = '.6';
  const step = () => {
    const r = pool[Math.floor(Math.random() * pool.length)];
    noEl.textContent = (r.no !== null && r.no !== undefined && r.no !== '') ? r.no : '–';
    nameEl.textContent = r.name || '(ไม่มีชื่อ)';
    i++;
    if (i >= ticks) {
      spin.disabled = false; spin.style.opacity = '1';
      if (noDup) { _rnUsed.push(r.id); if (hint) hint.textContent = `สุ่มแล้ว ${_rnUsed.length}/${total} คน`; }
      else if (hint) { hint.textContent = 'สุ่มอีกได้เลย'; }
      return;
    }
    setTimeout(step, 45 + i * 7); // ค่อยๆ ช้าลง (ease-out) ให้ลุ้น
  };
  step();
}
