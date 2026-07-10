function renderWebTimetable() {
  const activeWeek = appState.timetableWeek || 'A';
  const dows = [1,2,3,4,5];
  const slots = getPeriodSlots();
  const now = getNowDate();
  const nowDow = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // resolve ชื่อวิชา/ห้องจาก class ปัจจุบัน (source of truth) — กัน "undefined" และชื่อค้างตอนเปลี่ยนชื่อวิชา
  const resolveEntry = (entry) => {
    if (!entry) return null;
    const cl = appState.classes.find(x => x.id === entry.classId);
    const subject = (cl && cl.subject) || entry.subject;
    if (!subject) return null; // อ้างอิงวิชาไม่ได้เลย → ถือว่าช่องว่าง
    return { ...entry, subject, className: (cl && cl.className) || entry.className || '' };
  };

  // --- Desktop grid ---
  const container = document.getElementById('web-timetable-matrix-container');
  if (container) {
    // สีประจำวันไทย (พื้นอ่อน + ตัวอักษรเข้ม)
    let html = '<table><thead><tr><th style="width:84px;"><div style="font-size:0.8rem;font-weight:800;color:#334155;">วัน</div><div style="font-size:0.8rem;font-weight:800;color:#94a3b8;">เวลา</div></th>';
    slots.forEach(slot => { html += `<th style="min-width:104px;padding:9px 6px;"><div style="font-size:0.8rem;font-weight:800;color:#334155;">คาบ ${slot.period}</div><div style="margin-top:4px;font-size:0.8rem;font-weight:400;color:#64748b;">${slot.s}–${slot.e}</div></th>`; });
    html += '</tr></thead><tbody>';
    dows.forEach(d => {
      const dt = DAY_TINT[d] || { bg:'#eef2ff', text:'#3730a3' };
      html += `<tr><td style="font-weight:800;font-size:0.85rem;text-align:center;background-color:${dt.bg};color:${dt.text};">${DAY_NAMES[d].slice(3)}</td>`;
      slots.forEach(slot => {
        const entry = resolveEntry(appState.timetable.find(t => t.dow === d && t.period === slot.period && (t.week === undefined || t.week === activeWeek)));
        const [sH,sM] = slot.s.split(':').map(Number);
        const [eH,eM] = slot.e.split(':').map(Number);
        const isNow = d === nowDow && nowMin >= sH*60+sM && nowMin < eH*60+eM;
        const cls = entry ? (isNow ? 'has-class is-now' : 'has-class') : '';
        let cellStyle = '';
        if (entry) {
          const col = getClassColor(entry.classId);
          cellStyle = isNow
            ? `background-color:${col.text};border-color:${col.text};color:#fff;`
            : `background-color:${col.bg};border-color:${col.border};color:${col.text};`;
        }
        const label = entry ? `<strong style="font-size:0.78rem;">${entry.subject}</strong><br><span style="font-size:0.65rem;opacity:0.85;">${entry.className}</span>` : '<span style="font-size:0.75rem;color:var(--text-muted);">+</span>';
        html += `<td class="${cls}" style="${cellStyle}" onclick="openPeriodModal(${d},${slot.period})">${label}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
    const countEl = document.getElementById('timetable-period-count');
    if (countEl) countEl.innerText = `จำนวนคาบ: ${slots.length} คาบ`;
  }

  // --- Mobile view: all 5 days vertical, today first ---
  const mContainer = document.getElementById('m-timetable-days');
  if (!mContainer) return;

  const DAY_FULL = ['', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์'];

  let totalClasses = 0;
  let html = '';
  dows.forEach(d => {
    const isToday = d === nowDow;
    const classEntries = slots
      .map(slot => ({ slot, entry: resolveEntry(appState.timetable.find(t => t.dow === d && t.period === slot.period && (t.week === undefined || t.week === activeWeek))) }))
      .filter(x => x.entry);
    const classCount = classEntries.length;
    totalClasses += classCount;

    const dt = DAY_TINT[d] || { bg:'#eef2ff', text:'#3730a3' };
    const todayRing = isToday ? `box-shadow:0 0 0 2px ${dt.text};` : '';
    html += `<div class="m-tt-day" style="border-color:${dt.text}33;${todayRing}">`;
    html += `<div class="m-tt-day-header">
      <span class="m-tt-day-name" style="color:${dt.text};">${DAY_FULL[d]}${isToday ? ` <span style="font-size:0.7rem;font-weight:700;background:${dt.text};color:#fff;padding:1px 7px;border-radius:20px;margin-left:4px;">วันนี้</span>` : ''}</span>
      <span class="m-tt-day-count" style="color:${dt.text};opacity:0.72;">${classCount > 0 ? classCount + ' คาบ' : 'ไม่มีคาบ'}</span>
    </div>`;

    if (classCount === 0) {
      html += `<div class="m-tt-no-class">ไม่มีคาบเรียนวันนี้</div>`;
    } else {
      html += `<div class="m-tt-slots">`;
      classEntries.forEach(({ slot, entry }) => {
        const col = getClassColor(entry.classId);
        html += `<div class="m-tt-row">
          <div class="m-tt-time"><span>${slot.s}<br>${slot.e}</span></div>
          <div class="m-tt-body"><div class="m-tt-class" style="background:transparent;border-left:none;padding:0;"><div class="s" style="color:${col.text};">${entry.subject}</div><div class="r">${entry.className || ''}</div></div></div>
        </div>`;
      });
      html += `</div>`;
    }
    html += `</div>`;
  });
  mContainer.innerHTML = html;

  // Sync week toggle buttons
  ['a','b'].forEach(w => {
    const btn = document.getElementById(`m-btn-week-${w}`);
    if (btn) btn.classList.toggle('active', activeWeek === w.toUpperCase());
  });
  const summaryEl = document.getElementById('m-tt-summary');
  if (summaryEl) summaryEl.innerText = `สัปดาห์นี้ · ${totalClasses} คาบ`;
}

function switchTimetableWeek(week) {
  appState.timetableWeek = week;
  document.getElementById('btn-week-a').classList.toggle('active', week === 'A');
  document.getElementById('btn-week-b').classList.toggle('active', week === 'B');
  saveStateLocalOnly();
  renderWebTimetable();
}

// ==================== PERIOD SETTINGS MODAL ====================
let _psCustomDur = 50;

function openPeriodSettings() {
  const ps = appState.periodSettings || { startTime:'08:30', duration:50, breakTime:0, count:7 };
  _psCustomDur = ps.duration;
  document.getElementById('ps-start-time').value = ps.startTime;
  document.getElementById('ps-count').value = ps.count;

  // Select duration chip
  document.querySelectorAll('.ps-dur-chip').forEach(c => {
    c.classList.toggle('active', Number(c.dataset.val) === ps.duration);
  });
  // Show custom input only if not preset
  const presets = [45, 50, 55, 60];
  document.getElementById('ps-custom-dur-wrap').style.display = presets.includes(ps.duration) ? 'none' : 'flex';
  document.getElementById('ps-custom-dur').value = ps.duration;

  // Select break chip
  document.querySelectorAll('.ps-brk-chip').forEach(c => {
    c.classList.toggle('active', Number(c.dataset.val) === ps.breakTime);
  });

  document.getElementById('modal-period-settings').classList.add('show');
  renderPeriodPreview();
}

function closePeriodSettings() {
  document.getElementById('modal-period-settings').classList.remove('show');
}

function selectPsDuration(val, el) {
  document.querySelectorAll('.ps-dur-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  if (val === 'custom') {
    document.getElementById('ps-custom-dur-wrap').style.display = 'flex';
  } else {
    _psCustomDur = val;
    document.getElementById('ps-custom-dur-wrap').style.display = 'none';
    document.getElementById('ps-custom-dur').value = val;
  }
  renderPeriodPreview();
}

function selectPsBreak(val, el) {
  document.querySelectorAll('.ps-brk-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderPeriodPreview();
}

function adjustPsCount(delta) {
  const el = document.getElementById('ps-count');
  let v = Math.max(1, Math.min(16, Number(el.value) + delta));
  el.value = v;
  renderPeriodPreview();
}

function renderPeriodPreview() {
  const startTime = document.getElementById('ps-start-time').value || '08:00';
  const customVal = Number(document.getElementById('ps-custom-dur').value) || 50;
  const activeDur = document.querySelector('.ps-dur-chip.active');
  const dur = activeDur ? (activeDur.dataset.val === 'custom' ? customVal : Number(activeDur.dataset.val)) : 50;
  const activeBreak = document.querySelector('.ps-brk-chip.active');
  const brk = activeBreak ? Number(activeBreak.dataset.val) : 0;
  const count = Number(document.getElementById('ps-count').value) || 7;

  const [h, m] = startTime.split(':').map(Number);
  let cur = h * 60 + m;
  let html = '';
  for (let i = 1; i <= count; i++) {
    const sH = Math.floor(cur/60), sM = cur % 60;
    const end = cur + dur;
    const eH = Math.floor(end/60), eM = end % 60;
    const sStr = `${String(sH).padStart(2,'0')}:${String(sM).padStart(2,'0')}`;
    const eStr = `${String(eH).padStart(2,'0')}:${String(eM).padStart(2,'0')}`;
    html += `<div class="ps-preview-row"><span class="ps-preview-num">คาบ ${i}</span><span class="ps-preview-time">${sStr}–${eStr}</span></div>`;
    cur = end + brk;
  }
  document.getElementById('ps-preview').innerHTML = html;
}

function savePeriodSettings() {
  const startTime = document.getElementById('ps-start-time').value || '08:00';
  const customVal = Number(document.getElementById('ps-custom-dur').value) || 50;
  const activeDur = document.querySelector('.ps-dur-chip.active');
  const duration = activeDur ? (activeDur.dataset.val === 'custom' ? customVal : Number(activeDur.dataset.val)) : 50;
  const activeBreak = document.querySelector('.ps-brk-chip.active');
  const breakTime = activeBreak ? Number(activeBreak.dataset.val) : 0;
  const count = Math.max(1, Math.min(16, Number(document.getElementById('ps-count').value) || 7));

  appState.periodSettings = { startTime, duration, breakTime, count };
  saveState();
  closePeriodSettings();
  renderWebTimetable();
  // Also re-render home if active
  if (appState.activeWebScreen === 'dashboard') renderWebDashboard();
}


// ==================== ATTENDANCE MATRIX ====================
