function openOcrModal(classId) {
  ocrTargetClassId = classId;
  ocrExtractedNames = [];
  resetOcrUI();
  document.getElementById('modal-ocr-scan').classList.add('show');
}

function closeOcrModal() {
  document.getElementById('modal-ocr-scan').classList.remove('show');
  ocrTargetClassId = null;
  ocrExtractedNames = [];
}

function resetOcrModal() {
  ocrExtractedNames = [];
  resetOcrUI();
}

function resetOcrUI() {
  document.getElementById('ocr-step-upload').style.display = 'block';
  document.getElementById('ocr-step-processing').style.display = 'none';
  document.getElementById('ocr-step-results').style.display = 'none';
  document.getElementById('ocr-close-btn').style.display = 'flex';
  document.getElementById('ocr-preview-area').style.display = 'none';
  document.getElementById('ocr-progress-bar').style.width = '0%';
  document.getElementById('ocr-progress-text').innerText = 'เตรียมตัว...';
  // Reset file inputs
  const cam = document.getElementById('ocr-camera-input');
  const file = document.getElementById('ocr-file-input');
  if (cam) cam.value = '';
  if (file) file.value = '';
}

function handleOcrImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = document.getElementById('ocr-preview-img');
    img.src = e.target.result;
    document.getElementById('ocr-preview-area').style.display = 'block';

    // Auto start OCR after short delay
    setTimeout(() => startOcrProcess(e.target.result), 500);
  };
  reader.readAsDataURL(file);
}

async function startOcrProcess(imageSrc) {
  // Switch to processing step
  document.getElementById('ocr-step-upload').style.display = 'none';
  document.getElementById('ocr-step-processing').style.display = 'block';
  document.getElementById('ocr-close-btn').style.display = 'none';

  try {
    const worker = await Tesseract.createWorker('tha+eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round(m.progress * 100);
          document.getElementById('ocr-progress-bar').style.width = pct + '%';
          document.getElementById('ocr-progress-text').innerText = `กำลังอ่านข้อความ... ${pct}%`;
        } else if (m.status) {
          document.getElementById('ocr-progress-text').innerText = m.status;
        }
      }
    });

    const { data: { text } } = await worker.recognize(imageSrc);
    await worker.terminate();

    // Parse extracted text into names
    ocrExtractedNames = parseNamesFromOcrText(text);
    showOcrResults();

  } catch (err) {
    console.error('OCR Error:', err);
    showToast('เกิดข้อผิดพลาดในการสแกน: ' + err.message, 'error');
    resetOcrUI();
  }
}

function parseNamesFromOcrText(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  const names = [];

  for (const line of lines) {
    // Try to extract Thai names from each line
    // Pattern: optional number + Thai name (first + last)
    // Remove leading numbers, dots, parentheses, special chars
    let cleaned = line
      .replace(/^[\d\s\.\)\(\-\|]+/, '') // strip leading numbers/dots
      .replace(/[^\u0E00-\u0E7F\sa-zA-Z\.]/g, ' ') // keep Thai, English, spaces, dots
      .replace(/\s+/g, ' ')
      .trim();

    // Must contain Thai characters to be a name
    if (!/[\u0E00-\u0E7F]/.test(cleaned)) continue;

    // Must be at least 4 chars (shortest Thai name possible)
    if (cleaned.length < 4) continue;

    // Skip lines that look like headers or labels
    const skipWords = ['รายชื่อ', 'นักเรียน', 'ห้อง', 'วิชา', 'ครู', 'เลขที่', 'ชื่อ', 'ลำดับ', 'หมายเหตุ', 'สถานะ', 'คะแนน', 'ลายเซ็น', 'ลายมือ'];
    if (skipWords.some(w => cleaned.includes(w) && cleaned.length < 20)) continue;

    // Try to extract name parts - common formats:
    // "ด.ช. ชื่อ นามสกุล" or "เด็กชาย ชื่อ นามสกุล" or just "ชื่อ นามสกุล"
    let displayName = cleaned
      .replace(/^(ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง|นาย|น\.ส\.|นางสาว|นาง)\s*/i, '')
      .trim();

    if (displayName.length >= 3) {
      // Avoid duplicates
      if (!names.find(n => n.name === displayName)) {
        names.push({ name: displayName, checked: true });
      }
    }
  }

  return names;
}

function showOcrResults() {
  document.getElementById('ocr-step-processing').style.display = 'none';
  document.getElementById('ocr-step-results').style.display = 'block';
  document.getElementById('ocr-close-btn').style.display = 'none';
  document.getElementById('ocr-found-count').innerText = ocrExtractedNames.length;

  const listEl = document.getElementById('ocr-names-list');
  if (ocrExtractedNames.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);"><i class="hgi-stroke hgi-sad-01" style="font-size:2rem;margin-bottom:10px;display:block;"></i><p>ไม่พบรายชื่อในรูปภาพ</p><p style="font-size:0.8rem;">ลองถ่ายรูปใหม่ให้ชัดกว่านี้</p></div>';
    return;
  }

  let html = '';
  ocrExtractedNames.forEach((item, idx) => {
    html += `
      <label class="ocr-name-item">
        <span class="ocr-name-no">${idx + 1}</span>
        <input type="checkbox" id="ocr-check-${idx}" ${item.checked ? 'checked' : ''} onchange="ocrExtractedNames[${idx}].checked = this.checked">
        <span class="ocr-name-text">${item.name}</span>
      </label>`;
  });
  listEl.innerHTML = html;
}

function ocrSelectAll() {
  const allChecked = ocrExtractedNames.every(n => n.checked);
  ocrExtractedNames.forEach((n, i) => {
    n.checked = !allChecked;
    const cb = document.getElementById('ocr-check-' + i);
    if (cb) cb.checked = !allChecked;
  });
}

function confirmOcrImport() {
  const selected = ocrExtractedNames.filter(n => n.checked);
  if (selected.length === 0) {
    showToast('กรุณาเลือกอย่างน้อย 1 รายชื่อ', 'warning');
    return;
  }

  const targetClass = appState.classes.find(c => c.id === ocrTargetClassId);
  if (!targetClass) {
    showToast('ไม่พบห้องเรียน', 'error');
    return;
  }

  let imported = 0;
  selected.forEach((item) => {
    const no = targetClass.students.length + 1;
    targetClass.students.push({
      id: 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: item.name,
      no,
      score: 0,
      comment: ''
    });
    imported++;
  });

  saveState();
  showToast(`สแกนนำเข้าสำเร็จ ${imported} คน! 📷`, 'success');
  closeOcrModal();
  navigateToWebScreen(appState.activeWebScreen);
}

// ============================================================
// ====  ONBOARDING TOUR — coach marks (เฟส 0+1)          ====
// ============================================================
function isMobileView() { return window.matchMedia('(max-width: 768px)').matches; }

const Tour = {
  steps: [], i: -1, active: false, opts: {},
  _clickEl: null, _clickHandler: null, _reposition: null,

  start(steps, opts = {}) {
    // กรอง step ตาม device (มือถือ/คอม เช็คชื่อคนละแบบ)
    this.steps = steps.filter(s => {
      if (s.mobileOnly && !isMobileView()) return false;
      if (s.desktopOnly && isMobileView()) return false;
      return true;
    });
    this.opts = opts; this.i = -1; this.active = true;
    this._buildDom();
    this.next();
  },

  _buildDom() {
    if (document.getElementById('tour-root')) return;
    const root = document.createElement('div');
    root.id = 'tour-root';
    root.innerHTML =
      '<div class="tour-mask" data-m="top"></div>' +
      '<div class="tour-mask" data-m="bottom"></div>' +
      '<div class="tour-mask" data-m="left"></div>' +
      '<div class="tour-mask" data-m="right"></div>' +
      '<div class="tour-ring" id="tour-ring"></div>' +
      '<div class="tour-bubble" id="tour-bubble"></div>';
    document.body.appendChild(root);
    this._reposition = () => { if (this.active) this._place(); };
    window.addEventListener('resize', this._reposition);
    window.addEventListener('scroll', this._reposition, true);
  },

  _show() { const r = document.getElementById('tour-root'); if (r) r.style.display = ''; },
  _hide() { const r = document.getElementById('tour-root'); if (r) r.style.display = 'none'; },

  next() {
    this._detachAdvance();
    this.i++;
    if (this.i >= this.steps.length) return this.end(true);
    this._show();
    const step = this.steps[this.i];
    const run = () => { this._place(); this._attachAdvance(step); };
    if (step.before) { try { step.before(); } catch (e) {} }
    if (step.nav) navigateToWebScreen(step.nav);
    setTimeout(run, (step.nav || step.before) ? 320 : 60);
  },

  _target(step) {
    if (!step || !step.target) return null;
    // selector อาจแมตช์หลายตัว (เช่นปุ่มเดียวกันทั้งฝั่งมือถือ+เดสก์ท็อป) — เลือกตัวแรกที่ "มองเห็นจริง"
    // ข้ามตัวที่ถูกซ่อน (display:none → rect 0×0) ไม่งั้นจะไฮไลต์ไม่ขึ้น
    const els = document.querySelectorAll(step.target);
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el;
    }
    return els[0] || null;
  },

  _place() {
    const step = this.steps[this.i]; if (!step) return;
    const el = this._target(step);
    const ring = document.getElementById('tour-ring');
    const masks = [...document.querySelectorAll('.tour-mask')];
    if (el && (el.getBoundingClientRect().top < 0 || el.getBoundingClientRect().bottom > window.innerHeight)) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    let r = el ? el.getBoundingClientRect() : null;
    if (r && r.width === 0 && r.height === 0) r = null;
    const W = window.innerWidth, H = window.innerHeight, pad = 6;
    if (r) {
      const x = r.left - pad, y = r.top - pad, w = r.width + pad * 2, h = r.height + pad * 2;
      masks[0].style.cssText = `left:0;top:0;width:100%;height:${Math.max(0, y)}px`;
      masks[1].style.cssText = `left:0;top:${y + h}px;width:100%;height:${Math.max(0, H - (y + h))}px`;
      masks[2].style.cssText = `left:0;top:${y}px;width:${Math.max(0, x)}px;height:${h}px`;
      masks[3].style.cssText = `left:${x + w}px;top:${y}px;width:${Math.max(0, W - (x + w))}px;height:${h}px`;
      ring.style.cssText = `display:block;left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    } else {
      masks[0].style.cssText = 'left:0;top:0;width:100%;height:100%';
      masks[1].style.display = 'none'; masks[2].style.display = 'none'; masks[3].style.display = 'none';
      ring.style.display = 'none';
    }
    this._renderBubble(step, r);
  },

  _renderBubble(step, r) {
    const bubble = document.getElementById('tour-bubble');
    const total = this.steps.length, n = this.i + 1, last = this.i === this.steps.length - 1;
    const body = (isMobileView() && step.mobileBody) ? step.mobileBody : (step.body || '');
    const gated = step.advance && step.advance.indexOf('action') === 0;
    const advBtn = (!step.advance || step.advance === 'next')
      ? `<button class="btn btn-primary" style="padding:8px 18px;font-size:0.85rem;" onclick="Tour.next()">${last ? 'เสร็จสิ้น' : 'ถัดไป'}</button>`
      : `<button style="background:none;border:none;color:var(--text-muted);font-size:0.8rem;cursor:pointer;text-decoration:underline;" onclick="Tour.next()">ข้ามขั้นนี้ →</button>`;
    const hint = gated ? '<span style="font-size:0.78rem;color:var(--primary);font-weight:700;"><i class="hgi-stroke hgi-cursor-magic-selection-02"></i> ทำตามขั้นตอนได้เลย</span>' : '';
    const backBtn = this.i > 0 ? `<button onclick="Tour.prev()" style="background:none;border:none;color:var(--text-muted);font-size:0.8rem;cursor:pointer;display:inline-flex;align-items:center;gap:3px;"><i class="hgi-stroke hgi-arrow-left-01"></i> ย้อนกลับ</button>` : '<span></span>';
    bubble.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:0.72rem;font-weight:700;color:var(--text-muted);">ขั้นที่ ${n}/${total}</span>
        <button onclick="Tour.skip()" style="background:none;border:none;color:var(--text-muted);font-size:0.78rem;cursor:pointer;">ข้ามทั้งหมด</button>
      </div>` +
      (step.title ? `<div style="font-weight:800;font-size:1rem;margin-bottom:6px;color:var(--text-main);">${step.title}</div>` : '') +
      `<div style="font-size:0.87rem;color:var(--text-main);line-height:1.65;">${body}</div>` +
      (hint ? `<div style="margin-top:12px;">${hint}</div>` : '') +
      `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;">${backBtn}<div style="margin-left:auto;">${advBtn}</div></div>`;
    bubble.style.display = 'block';
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight, W = window.innerWidth, H = window.innerHeight, m = 12;
    let bx, by;
    if (r) {
      if (r.bottom + bh + m < H) by = r.bottom + m;
      else if (r.top - bh - m > 0) by = r.top - bh - m;
      else by = Math.max(m, (H - bh) / 2);
      bx = Math.min(Math.max(m, r.left + r.width / 2 - bw / 2), W - bw - m);
    } else { bx = (W - bw) / 2; by = (H - bh) / 2; }
    bubble.style.left = bx + 'px'; bubble.style.top = by + 'px';
  },

  _attachAdvance(step) {
    // step ที่ต้องกดเป้าจริง (click/action): ซ่อน overlay ตอนกด เพื่อให้ modal/หน้าถัดไปใช้งานได้
    const gated = step.advance === 'click' || (step.advance && step.advance.indexOf('action') === 0);
    if (gated) {
      const el = this._target(step);
      if (el) {
        this._clickEl = el;
        this._clickHandler = () => {
          this._hide();
          if (step.advance === 'click') setTimeout(() => this.next(), 120);
        };
        el.addEventListener('click', this._clickHandler);
      }
    }
  },

  _detachAdvance() {
    if (this._clickEl && this._clickHandler) this._clickEl.removeEventListener('click', this._clickHandler);
    this._clickEl = null; this._clickHandler = null;
  },

  // เรียกจากจุดที่ผู้ใช้ทำ action สำเร็จ (สร้างห้อง/เพิ่มนักเรียน/เปิดเช็คชื่อ)
  action(name) {
    if (!this.active) return;
    const step = this.steps[this.i];
    if (step && step.advance === 'action:' + name) setTimeout(() => this.next(), 400);
  },

  prev() {
    if (this.i <= 0) return;
    this.i -= 2; // next() จะ +1 → กลับไปขั้นก่อนหน้า
    this.next();
  },

  skip() { this.end(false); },

  end(completed) {
    this.active = false;
    this._detachAdvance();
    const root = document.getElementById('tour-root'); if (root) root.remove();
    if (this._reposition) {
      window.removeEventListener('resize', this._reposition);
      window.removeEventListener('scroll', this._reposition, true);
    }
    if (this.opts.onEnd) this.opts.onEnd(completed);
  }
};

// เปิดหน้าเช็คชื่อของห้องในทัวร์ให้แน่ใจ (กันกรณี overlay ถูกปิดไปแล้ว)
function ensureCheckinOpen() {
  const cid = swipeClassId || (appState.classes[0] && appState.classes[0].id);
  const ov = document.getElementById('swipe-overlay');
  if (cid && ov && !ov.classList.contains('show')) openSwipeAttendance(cid);
}

// ---- ลำดับทัวร์หลัก (เฟส 1+2) ----
const MAIN_TOUR_STEPS = [
  { nav: 'classrooms', target: '#btn-add-class-header', title: 'สร้างห้องเรียนแรก',
    body: 'แตะปุ่มนี้เพื่อสร้างวิชา/ห้องที่คุณสอน แล้วกรอกชื่อวิชากับห้อง เสร็จแล้วกด “เพิ่มห้องเรียน”',
    advance: 'action:class-created' },
  { target: '.ck-checkin-btn', title: 'เข้าห้องเพื่อเพิ่มนักเรียน',
    body: 'เยี่ยมมาก! ต่อไปแตะปุ่ม “เช็คชื่อ” ของห้องนี้ เพื่อเข้าไปเพิ่มรายชื่อนักเรียน',
    advance: 'action:opened-checkin' },
  { target: '[onclick="addStudentFromSwipe()"]', title: 'เพิ่มรายชื่อนักเรียน',
    body: 'เพิ่มนักเรียนได้ 2 แบบ: <b>พิมพ์เอง</b> ทีละคน หรือ <b>นำเข้าจาก Excel</b> — ลองเพิ่มสัก 1 คนดู',
    advance: 'action:student-added' },
  // วิธีเช็คชื่อ (มือถือ) แบบ 1: ปัดการ์ด — ไฮไลต์การ์ด + สัญลักษณ์ทิศ (ไม่บังคับเช็คจริง)
  { target: '#swipe-card', title: 'วิธีที่ 1: ปัดการ์ด', mobileOnly: true, before: ensureCheckinOpen,
    body: 'ปัดหรือแตะการ์ดของนักเรียนที่แสดงอยู่:<div style="display:flex;justify-content:space-around;text-align:center;margin-top:14px;font-weight:800;font-size:0.82rem;"><div style="color:var(--color-leave)"><div style="font-size:1.6rem;line-height:1">←</div>ปัดซ้าย<br>ลา</div><div style="color:var(--color-present)"><div style="font-size:1.6rem;line-height:1">👆</div>แตะ<br>มา</div><div style="color:var(--color-absent)"><div style="font-size:1.6rem;line-height:1">→</div>ปัดขวา<br>ขาด</div></div>' },
  // วิธีเช็คชื่อ (มือถือ) แบบ 2: ปุ่มด้านล่าง — ไฮไลต์ (วงๆ) ที่แถบปุ่ม
  { target: '.swipe-action-buttons', title: 'วิธีที่ 2: กดปุ่มด้านล่าง', mobileOnly: true, before: ensureCheckinOpen,
    body: 'ไม่ถนัดปัด? กดปุ่มเหล่านี้เพื่อเลือกสถานะได้เลย:<br><b style="color:var(--color-present)">มา</b> · <b style="color:var(--color-late-text)">สาย</b> · <b style="color:var(--color-absent)">ขาด</b> · <b style="color:var(--color-leave)">ลา</b><br>ปุ่ม “ย้อน” ไว้แก้ถ้ากดพลาด' },
  // วิธีเช็คชื่อ (คอม) — แค่อธิบาย ไม่บังคับเช็คจริง
  { target: '.d-col-status', title: 'วิธีเช็คชื่อ', desktopOnly: true, before: ensureCheckinOpen,
    body: 'แต่ละแถวมีปุ่มสถานะ กดเพื่อบันทึกการเข้าเรียนของนักเรียน:<br><b style="color:var(--color-present)">มา</b> / สาย / ขาด / ลา' },
  // สอนลงตารางสอนเอง (คอม) — แตะช่องในตาราง แล้วเลือกวิชา/ห้องที่เพิ่งสร้าง
  { nav: 'timetable', target: '#web-timetable-matrix-container td[onclick^="openPeriodModal"]', title: 'ลงตารางสอน (ไม่บังคับ)', desktopOnly: true,
    body: 'แตะช่องในตารางเพื่อลงคาบสอน แล้วเลือก<b>วิชา/ห้อง</b>ที่คุณเพิ่งสร้าง<br><br>ลงไว้แล้วหน้าแรกจะ<b>เตือนคาบถัดไป</b>ให้อัตโนมัติ · ยังไม่พร้อมก็ข้ามได้',
    advance: 'action:period-added' },
  // แนะนำปุ่มลัดบนหน้าตาราง (Week A/B + จัดการคาบ) — แค่ให้รู้จัก เดี๋ยวครูกลับมาปรับเองทีหลัง
  { target: '#tt-desktop-controls', title: 'ปุ่มลัดบนหน้าตาราง', desktopOnly: true,
    body: 'รู้จักไว้นิดหน่อย เดี๋ยวกลับมาปรับทีหลังได้:<br>• <b>Week A / B</b> — สลับตารางสัปดาห์คู่/คี่ (ถ้าโรงเรียนใช้ระบบนี้)<br>• <b>จัดการคาบ</b> — ตั้งเวลาเริ่ม จำนวนคาบ และเวลาพัก' },
  // ตารางสอน (มือถือ) — หน้ามือถือดูอย่างเดียว ลงคาบทำบนคอม
  { nav: 'timetable', title: 'ตารางสอน (ไม่บังคับ)', mobileOnly: true,
    body: 'ถ้าลงตารางสอนไว้ หน้าแรกจะ<b>เตือนคาบถัดไป</b>ให้อัตโนมัติ<br><br>💡 แนะนำจัดตารางบน<b>คอมพิวเตอร์</b> (แตะช่องลงคาบได้ง่ายกว่า) · ยังไม่พร้อมก็ข้ามได้ เช็คชื่อได้เลย' },
  // หน้าแรก = ศูนย์รวม (อธิบายคาบถัดไป/เตือน/เช็คแล้ว)
  { nav: 'dashboard', target: '#home-date-card', title: 'หน้าแรก = ศูนย์รวมของคุณ',
    body: 'เมื่อมีตารางสอนแล้ว ทุกวันหน้านี้จะบอก:<br>• <b>คาบถัดไป</b>ใกล้ถึงยัง — แตะการ์ดคาบเพื่อไปเช็คชื่อได้ทันที<br>• ถ้า<b>ลืมเช็ค</b> จะมีแจ้งเตือนขึ้นให้<br>• คาบที่<b>เช็คแล้ว</b> จะโชว์สถานะให้เห็น<br><br>พร้อมแล้ว ลุยกันเลย! 🎉' }
];

let onboardingChecked = false;
function maybeStartOnboarding() {
  if (onboardingChecked) return;
  onboardingChecked = true;
  const done = appState.onboarding && appState.onboarding.done;
  if (!done && (appState.classes || []).length === 0) {
    document.getElementById('modal-welcome').classList.add('show');
  }
}

function startMainTour() {
  document.getElementById('modal-welcome').classList.remove('show');
  Tour.start(MAIN_TOUR_STEPS, { onEnd: finishOnboarding });
}

function finishOnboarding(completed) {
  appState.onboarding = { done: true };
  saveState();
  if (completed) showToast('พร้อมใช้งานแล้ว 🎉 เปิดคู่มือซ้ำได้ที่ปุ่ม ? มุมจอ', 'success');
}

function skipOnboarding() {
  document.getElementById('modal-welcome').classList.remove('show');
  appState.onboarding = { done: true };
  saveState();
}
