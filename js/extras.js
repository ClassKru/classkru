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
      if (typeof s.skipIf === 'function' && s.skipIf()) return false;
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
    return null;
  },

  _place() {
    const step = this.steps[this.i]; if (!step) return;
    const el = this._target(step);
    const ring = document.getElementById('tour-ring');
    const masks = [...document.querySelectorAll('.tour-mask')];
    const maskPointer = step.allowInteraction ? ';pointer-events:none' : '';
    if (step.target && !el) {
      setTimeout(() => this.next(), 0);
      return;
    }
    if (el && (el.getBoundingClientRect().top < 0 || el.getBoundingClientRect().bottom > window.innerHeight)) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    let r = el ? el.getBoundingClientRect() : null;
    if (r && r.width === 0 && r.height === 0) r = null;
    const W = window.innerWidth, H = window.innerHeight, pad = 6;
    if (r) {
      const x = r.left - pad, y = r.top - pad, w = r.width + pad * 2, h = r.height + pad * 2;
      if (step.noMask) {
        masks.forEach(mask => { mask.style.display = 'none'; });
      } else {
        masks[0].style.cssText = `left:0;top:0;width:100%;height:${Math.max(0, y)}px${maskPointer}`;
        masks[1].style.cssText = `left:0;top:${y + h}px;width:100%;height:${Math.max(0, H - (y + h))}px${maskPointer}`;
        masks[2].style.cssText = `left:0;top:${y}px;width:${Math.max(0, x)}px;height:${h}px${maskPointer}`;
        masks[3].style.cssText = `left:${x + w}px;top:${y}px;width:${Math.max(0, W - (x + w))}px;height:${h}px${maskPointer}`;
      }
      ring.style.cssText = `display:block;left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    } else {
      masks[0].style.cssText = `left:0;top:0;width:100%;height:100%${maskPointer}`;
      masks[1].style.display = 'none'; masks[2].style.display = 'none'; masks[3].style.display = 'none';
      ring.style.display = 'none';
    }
    this._renderBubble(step, r);
  },

  _renderBubble(step, r) {
    const bubble = document.getElementById('tour-bubble');
    if (step.bubble === false) {
      bubble.style.display = 'none';
      return;
    }
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
    const gated = step.blockTarget || step.advance === 'click' || (step.advance && step.advance.indexOf('action') === 0);
    if (gated) {
      if (step.waitForActionOnly) return;
      const el = this._target(step);
      if (el) {
        this._clickEl = el;
        this._clickHandler = event => {
          if (step.blockTarget) {
            event.preventDefault();
            event.stopPropagation();
            this.next();
            return;
          }
          if (step.hideOnClick !== false) this._hide();
          if (step.advance === 'click') setTimeout(() => this.next(), 120);
        };
        el.addEventListener('click', this._clickHandler, !!step.blockTarget);
      }
    }
  },

  _detachAdvance() {
    if (this._clickEl && this._clickHandler) {
      this._clickEl.removeEventListener('click', this._clickHandler);
      this._clickEl.removeEventListener('click', this._clickHandler, true);
    }
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

function hasAnyClass() {
  return !!((appState.classes || []).length);
}

function getGuideClassId() {
  const classes = appState.classes || [];
  const validId = id => id && classes.some(c => c.id === id);
  if (typeof currentClassId !== 'undefined' && validId(currentClassId)) return currentClassId;
  if (typeof scoreCurrentClassId !== 'undefined' && validId(scoreCurrentClassId)) return scoreCurrentClassId;
  if (typeof swipeClassId !== 'undefined' && validId(swipeClassId)) return swipeClassId;
  return (appState.classes && appState.classes[0] && appState.classes[0].id) || null;
}

function guideNeedsClass(key) {
  return ['students', 'add-student', 'checkin', 'scores', 'reports', 'add-period'].includes(key);
}

function guideNeedsStudent(key) {
  return ['scores', 'reports'].includes(key);
}

function guideClassHasStudents(classId) {
  const c = (appState.classes || []).find(room => room.id === classId);
  return !!(c && c.students && c.students.length);
}

function notifyTourAction(name) {
  if (typeof Tour !== 'undefined' && Tour && typeof Tour.action === 'function') {
    Tour.action(name);
  }
}

function prepareStudentGuideResult() {
  const searchInput = document.getElementById('web-student-search-input');
  if (searchInput && searchInput.value) searchInput.value = '';
  if (typeof renderWebStudents === 'function') renderWebStudents();
}

const GUIDE_STEPS = {
  classrooms: [
  { nav: 'classrooms', target: '#btn-add-class-header', title: 'เริ่มจากสร้างห้องเรียน',
    body: 'กดปุ่มนี้เพื่อเปิดฟอร์มสร้างวิชา/ห้องเรียนแรกของคุณ',
    advance: 'action:class-modal-opened', skipIf: hasAnyClass },
  { target: '#modal-class .bottom-sheet',
    advance: 'action:class-created', waitForActionOnly: true, bubble: false, allowInteraction: true, noMask: true },
  { nav: 'classrooms', target: '.ck-class-card', title: 'การ์ดห้องเรียน',
    body: 'กรอบนี้คือการ์ดของห้องเรียนหนึ่งห้อง ใช้ดูชื่อวิชา ชั้น จำนวนเด็ก และภาพรวมการเข้าเรียน<br><br>หลังจบทัวร์ แตะการ์ดเพื่อเข้าไปจัดการรายชื่อนักเรียนได้',
    blockTarget: true },
  { nav: 'classrooms', target: '.ck-class-actions', title: 'ปุ่มลัดของห้อง',
    body: 'กรอบนี้รวมปุ่มที่ใช้บ่อยของห้อง:<div class="tour-action-chips"><span><i class="hgi-stroke hgi-award-01"></i> คะแนน</span><span><i class="hgi-stroke hgi-task-done-01"></i> เช็คชื่อ</span><span><i class="hgi-stroke hgi-user-multiple"></i> รายชื่อนักเรียน</span><span><i class="hgi-stroke hgi-pie-chart"></i> การเข้าเรียน</span></div>',
    blockTarget: true },
  { nav: 'classrooms', target: '.ck-class-students-btn', title: 'เข้าหน้ารายชื่อนักเรียน',
    body: 'ก่อนเช็คชื่อหรือเก็บคะแนน ให้เริ่มจากปุ่ม “รายชื่อนักเรียน” ของห้องนี้<br><br>กดปุ่มนี้เพื่อเข้าไปเพิ่มรายชื่อคนแรก',
    advance: 'action:students-opened' },
  { target: '#btn-add-student-roster', title: 'เพิ่มนักเรียนคนแรก',
    body: 'กด “เพิ่มนักเรียน” เพื่อเปิดฟอร์มกรอกข้อมูลรายคน',
    desktopOnly: true,
    advance: 'action:student-modal-opened' },
  { target: '#btn-students-actions-mobile', title: 'เปิดเมนูจัดการรายชื่อ',
    body: 'บนมือถือ ปุ่มเพิ่มนักเรียนจะอยู่ในเมนูนี้ เพื่อให้หน้าจอไม่รก',
    mobileOnly: true,
    advance: 'action:student-menu-opened' },
  { target: '#ck-class-menu button:first-child', title: 'เลือกเพิ่มนักเรียน',
    body: 'แตะ “เพิ่มนักเรียน” เพื่อเปิดฟอร์มกรอกข้อมูลรายคน',
    mobileOnly: true,
    advance: 'action:student-modal-opened' },
  { target: '#input-student-name', title: 'ลองกรอกชื่อนักเรียน 1 คน',
    body: 'เลขที่จะเติมให้แล้ว ให้ลองกรอกชื่อ-นามสกุลนักเรียนสัก 1 คนก่อน ช่องอื่นค่อยเติมภายหลังได้' },
  { target: '#btn-student-submit', title: 'บันทึกรายชื่อแรก',
    body: 'กด “เพิ่ม” เพื่อบันทึก รายชื่อนี้จะถูกนำไปใช้ต่อในเช็คชื่อ คะแนน และรายงาน',
    advance: 'action:student-added', hideOnClick: false },
  { target: '.student-roster-card', title: 'มีนักเรียนในห้องแล้ว', before: prepareStudentGuideResult,
    body: 'เมื่อเพิ่มสำเร็จ การ์ดนักเรียนจะแสดงตรงนี้ เท่านี้ห้องก็พร้อมไปเช็คชื่อหรือเก็บคะแนนต่อแล้ว',
    blockTarget: true }
  ],
  dashboard: [
    { nav: 'dashboard', target: '#home-date-card', title: 'หน้าแรกคือภาพรวมวันนี้',
      body: 'ดูวันที่ สรุปมา/สาย/ขาด/ลา และภาพรวมงานที่ต้องทำวันนี้จากตรงนี้',
      blockTarget: true },
    { target: '#home-next-card-area', title: 'คาบถัดไป',
      body: 'ถ้าลงตารางสอนไว้ ระบบจะดึงคาบถัดไปมาให้กดเช็คชื่อได้เร็วขึ้น',
      blockTarget: true },
    { target: '.home-schedule-card', title: 'ตารางวันนี้',
      body: 'การ์ดคาบสอนช่วยให้เห็นทั้งวันแบบเร็ว ๆ คาบไหนเช็คแล้วหรือยังไม่เช็คจะสังเกตได้จากสถานะ',
      blockTarget: true }
  ],
  students: [
    { nav: 'students', target: '#web-students-detail-title', title: 'รายชื่อนักเรียนของห้อง',
      body: 'หน้านี้คือฐานข้อมูลนักเรียนของห้องที่เลือก ใช้เพิ่ม แก้ไข ค้นหา และเตรียม QR',
      blockTarget: true },
    { target: '.students-action-btns', title: 'ปุ่มเพิ่มนักเรียน',
      body: 'เพิ่มทีละคน พิมพ์ QR หรือนำเข้าจาก Excel ได้จากแถวปุ่มนี้',
      blockTarget: true },
    { target: '#web-students-list, #web-students-empty-state', title: 'พื้นที่รายชื่อ',
      body: 'เมื่อมีนักเรียนแล้ว รายชื่อจะขึ้นตรงนี้ ถ้ายังว่างให้เริ่มจากปุ่ม “เพิ่มนักเรียน” ด้านบน',
      blockTarget: true }
  ],
  'add-student': [
    { nav: 'classrooms', target: '.ck-class-students-btn', title: 'เข้ารายชื่อนักเรียนของห้อง',
      body: 'เริ่มจากปุ่ม “รายชื่อนักเรียน” บนการ์ดห้อง เพื่อเข้าไปจัดการรายชื่อของห้องนี้',
      advance: 'action:students-opened' },
    { target: '#btn-add-student-roster', title: 'เริ่มเพิ่มนักเรียน',
      body: 'กดปุ่มนี้เพื่อเพิ่มนักเรียนทีละคน เหมาะกับเริ่มต้นหรือเพิ่มเด็กใหม่ระหว่างเทอม',
      desktopOnly: true,
      advance: 'action:student-modal-opened' },
    { target: '#btn-students-actions-mobile', title: 'เปิดเมนูจัดการรายชื่อ',
      body: 'บนมือถือปุ่มเพิ่มนักเรียนจะอยู่ในเมนูนี้ เพื่อให้หัวจอไม่รกเกินไป',
      mobileOnly: true,
      advance: 'action:student-menu-opened' },
    { target: '#ck-class-menu button:first-child', title: 'เลือกเพิ่มนักเรียน',
      body: 'แตะ “เพิ่มนักเรียน” เพื่อเปิดฟอร์มเพิ่มรายชื่อทีละคน',
      mobileOnly: true,
      advance: 'action:student-modal-opened' },
    { target: '#modal-student .bottom-sheet', title: 'ฟอร์มเพิ่มนักเรียน',
      body: 'เลขที่จะเติมให้ถัดจากคนล่าสุดโดยอัตโนมัติ ส่วนช่องที่สำคัญที่สุดคือชื่อ-นามสกุล',
      blockTarget: true },
    { target: '#input-student-name', title: 'กรอกชื่อ-นามสกุล',
      body: 'ช่องนี้จำเป็นต้องกรอกก่อนบันทึก ส่วนรหัส ชื่อเล่น และหมายเหตุเป็นข้อมูลเสริม ใส่ภายหลังได้' },
    { target: '#btn-student-submit', title: 'บันทึกรายชื่อ',
      body: 'เมื่อกรอกชื่อแล้ว กด “เพิ่ม” เพื่อบันทึกนักเรียนเข้าห้องนี้ ระบบจะนำไปใช้ต่อในเช็คชื่อ คะแนน และรายงาน',
      advance: 'action:student-added', hideOnClick: false },
    { target: '.student-roster-card', title: 'เพิ่มแล้วจะอยู่ตรงนี้', before: prepareStudentGuideResult,
      body: 'รายชื่อที่เพิ่มจะแสดงในพื้นที่นี้ ถ้ามีนักเรียนหลายคน ใช้นำเข้า Excel ได้จากปุ่มด้านบนบนจอใหญ่',
      blockTarget: true }
  ],
  checkin: [
    { before: ensureCheckinOpen, target: '#swipe-card', title: 'การ์ดเช็คชื่อ',
      body: 'ทีละคน ชัด ๆ แตะหรือปัดการ์ดเพื่อบันทึกสถานะ เหมาะกับมือถือเวลาอยู่หน้าห้อง',
      mobileOnly: true, blockTarget: true },
    { before: ensureCheckinOpen, target: '.swipe-action-buttons', title: 'ปุ่มสถานะ',
      body: 'ถ้าไม่อยากปัด ใช้ปุ่ม มา · สาย · ขาด · ลา ได้เลย และมีปุ่มย้อนเมื่อกดพลาด',
      mobileOnly: true, blockTarget: true },
    { before: ensureCheckinOpen, target: '.swipe-summary-pills', title: 'สรุปเช็คชื่อ',
      body: 'ดูจำนวนมา สาย ขาด ลา ของคาบนี้แบบทันทีหลังเช็ค',
      mobileOnly: true, blockTarget: true },
    { before: ensureCheckinOpen, target: '.d-attendance-table, .d-col-status', title: 'เช็คชื่อบนจอใหญ่',
      body: 'บนเว็บ/เดสก์ท็อปจะเห็นเป็นตาราง กดสถานะในแต่ละแถวเพื่อเช็คชื่อเร็ว ๆ',
      desktopOnly: true, blockTarget: true }
  ],
  scores: [
    { nav: 'scores', target: '#web-scores-detail-title', title: 'คะแนนของห้อง',
      body: 'ใช้จัดงาน เก็บคะแนน และดูภาพรวมคะแนนของนักเรียนในห้องนี้',
      blockTarget: true },
    { target: '#score-worktab-holder', title: 'เลือกหมวดงาน',
      body: 'สลับดูงานแต่ละหมวด เช่น งานเดี่ยว เก็บคะแนน หรือสอบ เพื่อไม่ให้ตารางรก',
      blockTarget: true },
    { target: '.score-items-head .btn-primary, .score-empty-panel .btn-primary', title: 'เพิ่มงานคะแนน',
      body: 'เริ่มจากเพิ่มงานหนึ่งชิ้น แล้วจึงกรอกคะแนนรายคน หรือใช้ QR คะแนนเมื่อต้องการเก็บเร็ว',
      blockTarget: true },
    { target: '#web-scores-matrix-wrap, .score-empty-panel', title: 'ตารางคะแนน',
      body: 'พื้นที่นี้จะแสดงคะแนนของนักเรียนตามงานที่สร้างไว้ เหมาะกับจอใหญ่สำหรับตรวจภาพรวม',
      blockTarget: true }
  ],
  timetable: [
    { nav: 'timetable', target: '#web-timetable-matrix-container, #m-timetable-days', title: 'ตารางสอนของคุณ',
      body: 'ลงคาบสอนไว้เพื่อให้หน้าแรกเตือนคาบถัดไป และช่วยเปิดเช็คชื่อได้ตรงเวลา',
      blockTarget: true },
    { target: '#web-timetable-matrix-container td[onclick^="openPeriodModal"], .m-tt-add-btn, .m-tt-day-add', title: 'เพิ่มคาบสอน',
      body: 'กดช่องว่างหรือปุ่มเพิ่มคาบ แล้วเลือกวิชา/ห้องให้ตรงกับตารางจริง',
      blockTarget: true },
    { target: '#tt-desktop-controls', title: 'จัดการตาราง',
      body: 'บนจอใหญ่มีปุ่มนำเข้าและตั้งค่าคาบเรียน ช่วยจัดตารางจำนวนมากได้เร็วขึ้น',
      desktopOnly: true, blockTarget: true }
  ],
  'add-period': [
    { nav: 'timetable', target: '#web-timetable-matrix-container td[onclick^="openPeriodModal"], .m-tt-add-btn, .m-tt-day-add, .m-tt-no-class', title: 'เลือกช่องคาบสอน',
      body: 'เริ่มจากกดช่องว่างในตาราง หรือปุ่ม “เพิ่มคาบ” บนมือถือ เพื่อเปิดฟอร์มเพิ่มคาบ',
      advance: 'action:period-modal-opened' },
    { target: '#modal-period .period-editor-sheet', title: 'ฟอร์มเพิ่มคาบ',
      body: 'คาบสอนประกอบด้วยวัน เวลา และวิชา/ห้องเรียน เลือกให้ตรงกับตารางจริงของครู',
      blockTarget: true },
    { target: '#input-period-subject', title: 'เลือกวิชา',
      body: 'บนจอใหญ่ให้เลือกวิชาก่อน ระบบจะกรองห้องที่อยู่ในวิชานั้นให้',
      desktopOnly: true },
    { target: '#input-period-class', title: 'เลือกห้อง',
      body: 'เลือกห้องเรียนที่จะสอนในคาบนี้ เช่น ม.1/1 หรือ ม.2/1',
      desktopOnly: true },
    { target: '#input-period-mobile-day, #input-period-mobile-slot', title: 'เลือกวันและคาบ',
      body: 'บนมือถือเลือกวันและคาบจากช่องนี้ ถ้ากดจากปุ่มของวัน ระบบจะตั้งค่าเริ่มต้นให้แล้ว',
      mobileOnly: true },
    { target: '#input-period-mobile-class', title: 'เลือกวิชาและห้อง',
      body: 'บนมือถือเลือกครั้งเดียวได้ทั้งวิชาและห้อง เพื่อลดขั้นตอนตอนใช้งานจริง',
      mobileOnly: true },
    { target: '#btn-period-save', title: 'บันทึกคาบ',
      body: 'กดบันทึกคาบ เมื่อเลือกวิชา/ห้องแล้ว หน้าแรกจะใช้ข้อมูลนี้เพื่อเตือนคาบถัดไป',
      advance: 'action:period-added' },
    { nav: 'dashboard', target: '#home-next-card-area, #home-date-card', title: 'ผลลัพธ์บนหน้าแรก',
      body: 'หลังเพิ่มคาบ ตารางวันนี้และคาบถัดไปจะถูกใช้ช่วยเตือน และเปิดเช็คชื่อได้เร็วขึ้น',
      blockTarget: true }
  ],
  reports: [
    { nav: 'reports', target: '#web-rep-detail-class-title, #web-reports-class-list', title: 'รายงานของห้อง',
      body: 'ดูสรุปวันนี้ รายคาบ รายภาค และส่งออกข้อมูลสำหรับงานเอกสาร',
      blockTarget: true },
    { target: '.report-tabs', title: 'เลือกมุมมองรายงาน',
      body: 'สลับแท็บเพื่อดูรายงานแบบที่ต้องการ โดยไม่ต้องเปลี่ยนเมนูหลัก',
      blockTarget: true },
    { target: '#web-rep-today-pills, #web-rep-today-progress', title: 'สรุปภาพรวม',
      body: 'ดูจำนวนและเปอร์เซ็นต์การเข้าเรียน ช่วยจับปัญหาได้เร็ว',
      blockTarget: true },
    { target: '.ck-btn-pdf', title: 'ส่งออกเอกสาร',
      body: 'เมื่อข้อมูลพร้อม ใช้ปุ่มส่งออกเพื่อเก็บไฟล์รายงานหรือส่งต่อได้',
      blockTarget: true }
  ],
  tools: [
    { nav: 'tools', target: '.teaching-tools-context', title: 'เลือกห้องก่อนใช้เครื่องมือ',
      body: 'เครื่องมือบางอย่างต้องรู้ว่ากำลังใช้กับห้องไหน เพื่อดึงรายชื่อและข้อมูลได้ถูกต้อง',
      blockTarget: true },
    { target: '#teaching-tools-grid', title: 'เครื่องมือช่วยสอน',
      body: 'เลือกเครื่องมือที่เหมาะกับกิจกรรมในห้อง เช่น สุ่มชื่อ จับเวลา หรือเครื่องมือหน้าชั้นเรียน',
      blockTarget: true },
    { target: '#teaching-tools-grid .tool-card.ready', title: 'เปิดใช้เครื่องมือ',
      body: 'แตะการ์ดเครื่องมือเพื่อเริ่มใช้งานได้ทันที เครื่องมือที่ยังไม่พร้อมจะมีสถานะบอกไว้',
      blockTarget: true }
  ],
  games: [
    { nav: 'games', target: '.games-hero', title: 'เกมการศึกษา',
      body: 'หน้านี้รวมกิจกรรมเกมสำหรับใช้เสริมการสอน เลือกตามสถานการณ์ในห้องเรียน',
      blockTarget: true },
    { target: '.game-card .games-play-button', title: 'เริ่มเกม',
      body: 'กดปุ่มเริ่มในเกมที่ต้องการ แล้วเลือกห้องหรือข้อมูลที่เกี่ยวข้องตามขั้นตอน',
      blockTarget: true }
  ]
};

const GUIDE_SCREEN_MAP = {
  dashboard: 'dashboard',
  classrooms: 'classrooms',
  students: 'students',
  'add-student': 'classrooms',
  checkin: 'checkin',
  scores: 'scores',
  timetable: 'timetable',
  'add-period': 'timetable',
  reports: 'reports',
  tools: 'tools',
  games: 'games'
};

let pendingGuideKey = null;
let pendingGuideClearTimer = null;

function setPendingGuide(key) {
  pendingGuideKey = key;
  clearTimeout(pendingGuideClearTimer);
  pendingGuideClearTimer = setTimeout(() => {
    if (pendingGuideKey === key) pendingGuideKey = null;
  }, 1600);
}

function clearPendingGuide(key) {
  if (!key || pendingGuideKey === key) pendingGuideKey = null;
  clearTimeout(pendingGuideClearTimer);
}

function getGuidesSeen() {
  appState.onboarding = appState.onboarding || {};
  appState.onboarding.guidesSeen = appState.onboarding.guidesSeen || {};
  return appState.onboarding.guidesSeen;
}

function markGuideSeen(key) {
  const seen = getGuidesSeen();
  seen[key] = true;
  if (key === 'classrooms' || key === 'add-student') {
    seen.students = true;
    seen['add-student'] = true;
  }
  if (key === 'timetable' || key === 'add-period') {
    seen['add-period'] = true;
  }
  saveState();
}

function startGuide(key = 'classrooms', opts = {}) {
  const steps = GUIDE_STEPS[key];
  if (!steps) return;

  if (guideNeedsClass(key) && !hasAnyClass()) {
    if (!opts.auto) showToast('เริ่มจากสร้างห้องเรียนก่อน แล้วค่อยเปิดไกด์นี้นะครับ', 'info');
    navigateToWebScreen('classrooms');
    return;
  }

  const cid = getGuideClassId();
  if (guideNeedsStudent(key) && !guideClassHasStudents(cid)) {
    if (!opts.auto) {
      showToast('เพิ่มรายชื่อนักเรียนก่อน แล้วค่อยดูไกด์คะแนน/รายงานนะครับ', 'info');
      startGuide('add-student', { delay: 500 });
      return;
    }
    if (cid) navigateToWebScreen('students', cid);
    return;
  }

  clearTimeout(window.__ckClassroomsGuideTimer);
  setPendingGuide(key);
  markGuideSeen(key);
  if (Tour.active) Tour.end(false);
  if (typeof closePublicHelp === 'function') closePublicHelp();

  if (key === 'checkin') {
    if (cid) openSwipeAttendance(cid);
  } else if (['students', 'scores', 'reports'].includes(key)) {
    navigateToWebScreen(key, cid);
  } else {
    navigateToWebScreen(GUIDE_SCREEN_MAP[key] || key);
  }

  window.__ckClassroomsGuideTimer = setTimeout(() => {
    clearPendingGuide(key);
    Tour.start(steps, {
      guideKey: key,
      onEnd: completed => {
        markGuideSeen(key);
        if (typeof opts.onEnd === 'function') opts.onEnd(completed);
      }
    });
  }, opts.delay || 360);
}

function startClassroomsGuide(opts = {}) {
  startGuide('classrooms', opts);
}

function maybeStartClassroomsGuide() {
  maybeStartScreenGuide('classrooms');
}

function maybeStartScreenGuide(screenId) {
  const key = GUIDE_SCREEN_MAP[screenId];
  if (!key || key === 'help' || Tour.active || pendingGuideKey) return;
  const welcome = document.getElementById('modal-welcome');
  if (welcome && welcome.classList.contains('show')) return;
  if (guideNeedsClass(key) && !hasAnyClass()) return;
  if (guideNeedsStudent(key) && !guideClassHasStudents(getGuideClassId())) return;
  const seen = getGuidesSeen();
  if (seen[key]) return;
  seen[key] = true;
  saveState();
  clearTimeout(window.__ckClassroomsGuideTimer);
  window.__ckClassroomsGuideTimer = setTimeout(() => startGuide(key, { auto: true, delay: 80 }), 500);
}

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
  startGuide('classrooms', { onEnd: finishOnboarding });
}

// เปิดทัวร์ซ้ำจากศูนย์ช่วยเหลือ — เดิมทัวร์เปิดได้ครั้งเดียวตอนยังไม่มีห้องเรียน
// ครูที่ใช้ไปแล้วจะไม่มีทางกลับมาดูได้อีก ทั้งที่ toast บอกว่าเปิดซ้ำได้
function replayMainTour() {
  if (typeof closePublicHelp === 'function') closePublicHelp();
  startGuide('classrooms');
}

function finishOnboarding(completed) {
  appState.onboarding = { ...(appState.onboarding || {}), done: true };
  saveState();
  if (completed) showToast('พร้อมใช้งานแล้ว 🎉 ดูทัวร์ซ้ำได้ที่ ศูนย์ช่วยเหลือ', 'success');
}

function skipOnboarding() {
  document.getElementById('modal-welcome').classList.remove('show');
  appState.onboarding = { ...(appState.onboarding || {}), done: true };
  saveState();
}
