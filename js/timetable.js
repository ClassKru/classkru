function renderWebTimetable() {
  appState.timetableWeek = 'A';
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
    let html = '<table><thead><tr><th style="width:84px;"><div style="font-size:0.8rem;font-weight:700;color:var(--timetable-header-strong);">วัน</div><div style="font-size:0.78rem;font-weight:600;color:var(--timetable-header-muted);">เวลา</div></th>';
    slots.forEach(slot => { html += `<th style="min-width:104px;padding:9px 6px;"><div style="font-size:0.8rem;font-weight:700;color:var(--timetable-header-strong);">คาบ ${slot.period}</div><div style="margin-top:4px;font-size:0.78rem;font-weight:400;color:var(--timetable-header-muted);">${slot.s}–${slot.e}</div></th>`; });
    html += '</tr></thead><tbody>';
    dows.forEach(d => {
      const dt = DAY_TINT[d] || { bg:'#eef2ff', text:'#3730a3' };
      html += `<tr><td class="timetable-day-cell" style="font-weight:700;font-size:0.84rem;text-align:center;--timetable-day-surface:${dt.bg};--timetable-day-accent:${dt.text};">${DAY_NAMES[d].slice(3)}</td>`;
      slots.forEach(slot => {
        const entry = resolveEntry((appState.timetable || []).find(t => timetableEntryMatches(t, d, slot.period)));
        const [sH,sM] = slot.s.split(':').map(Number);
        const [eH,eM] = slot.e.split(':').map(Number);
        const isNow = d === nowDow && nowMin >= sH*60+sM && nowMin < eH*60+eM;
        const cls = entry ? (isNow ? 'has-class is-now' : 'has-class') : '';
        let cellStyle = '';
        if (entry) {
          const col = getClassColor(entry.classId);
          cellStyle = isNow
            ? `--timetable-subject-accent:${col.text};background-color:${col.text};border-color:${col.text};color:#fff;`
            : `--timetable-subject-accent:${col.text};--timetable-subject-surface:${col.bg};`;
        }
        const label = entry ? `<strong style="font-size:0.76rem;font-weight:700;">${entry.subject}</strong><br><span style="font-size:0.64rem;opacity:0.78;">${entry.className}</span>` : '<span style="font-size:0.72rem;color:var(--timetable-empty);font-weight:600;">+</span>';
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
      .map(slot => ({ slot, entry: resolveEntry((appState.timetable || []).find(t => timetableEntryMatches(t, d, slot.period))) }))
      .filter(x => x.entry);
    const classCount = classEntries.length;
    totalClasses += classCount;

    const dt = DAY_TINT[d] || { bg:'#eef2ff', text:'#3730a3' };
    const todayRing = isToday ? `box-shadow:0 0 0 2px ${dt.text};` : '';
    html += `<section class="m-tt-day${isToday ? ' is-today' : ''}" style="border-color:${dt.text}33;${todayRing}">`;
    html += `<div class="m-tt-day-header">
      <div class="m-tt-day-title"><span class="m-tt-day-name" style="color:${dt.text};">${DAY_FULL[d]}${isToday ? ` <span class="m-tt-today-badge" style="background:${dt.text};">วันนี้</span>` : ''}</span><span class="m-tt-day-count" style="color:${dt.text};">${classCount > 0 ? classCount + ' คาบ' : 'ยังไม่มีคาบ'}</span></div>
      <button type="button" class="m-tt-day-add" style="color:${dt.text};border-color:${dt.text}44;background:${dt.bg};" onclick="openMobileTimetableQuickAdd(${d})" aria-label="เพิ่มคาบ${DAY_FULL[d]}"><i class="hgi-stroke hgi-add-01"></i><span>เพิ่มคาบ</span></button>
    </div>`;

    if (classCount === 0) {
      html += `<button type="button" class="m-tt-no-class" onclick="openMobileTimetableQuickAdd(${d})"><i class="hgi-stroke hgi-calendar-add-01"></i><span>แตะเพื่อเพิ่มคาบแรกของวันนี้</span></button>`;
    } else {
      html += `<div class="m-tt-slots">`;
      classEntries.forEach(({ slot, entry }) => {
        const col = getClassColor(entry.classId);
        html += `<button type="button" class="m-tt-row" onclick="openPeriodModal(${d},${slot.period})" aria-label="แก้ไข ${timetableEscape(entry.subject)} ${timetableEscape(entry.className || '')} คาบ ${slot.period}">
          <div class="m-tt-time"><span>${slot.s}<br>${slot.e}</span></div>
          <div class="m-tt-body"><div class="m-tt-class" style="background:transparent;border-left:none;padding:0;"><div class="s" style="color:${col.text};">${timetableEscape(entry.subject)}</div><div class="r">${timetableEscape(entry.className || '')} · คาบ ${slot.period}</div></div></div>
          <i class="hgi-stroke hgi-arrow-right-01 m-tt-row-arrow" aria-hidden="true"></i>
        </button>`;
      });
      html += `</div>`;
    }
    html += `</section>`;
  });
  mContainer.innerHTML = html;

  const summaryEl = document.getElementById('m-tt-summary');
  if (summaryEl) summaryEl.innerText = `สัปดาห์นี้ · ${totalClasses} คาบ`;
}

function timetableEscape(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function findFirstAvailablePeriod(dow) {
  const slots = getPeriodSlots();
  const free = slots.find(slot => !(appState.timetable || []).some(entry => timetableEntryMatches(entry, dow, slot.period)));
  return free ? Number(free.period) : null;
}

function openMobileTimetableQuickAdd(preferredDow) {
  const today = getNowDate().getDay();
  const preferred = Number(preferredDow);
  const startDow = preferred || (today >= 1 && today <= 5 ? today : 1);
  const daysToCheck = preferred ? [startDow] : [startDow, 1, 2, 3, 4, 5].filter((d, index, list) => list.indexOf(d) === index);
  const availableDay = daysToCheck.find(d => findFirstAvailablePeriod(d) !== null);
  if (!availableDay) {
    showToast(preferred ? 'วันนี้มีครบทุกคาบแล้ว แตะคาบเดิมเพื่อแก้ไข' : 'ตารางสอนครบทุกคาบแล้ว แตะคาบเดิมเพื่อแก้ไข', 'info');
    return;
  }
  if (!appState.classes.length) {
    showToast('กรุณาสร้างห้องเรียนก่อนเพิ่มตารางสอน', 'warning');
    return;
  }
  openPeriodModal(availableDay, findFirstAvailablePeriod(availableDay));
}

function populateMobilePeriodEditor(selectedClassId) {
  const daySelect = document.getElementById('input-period-mobile-day');
  const periodSelect = document.getElementById('input-period-mobile-slot');
  const classSelect = document.getElementById('input-period-mobile-class');
  if (!daySelect || !periodSelect || !classSelect) return;

  const dayLabels = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];
  daySelect.innerHTML = [1, 2, 3, 4, 5].map(d => `<option value="${d}"${d === Number(currentEditDow) ? ' selected' : ''}>วัน${dayLabels[d]}</option>`).join('');

  periodSelect.innerHTML = getPeriodSlots().map(slot => {
    const entry = (appState.timetable || []).find(t => timetableEntryMatches(t, currentEditDow, slot.period));
    const currentClass = entry && appState.classes.find(c => c.id === entry.classId);
    const occupied = currentClass ? ` · ${currentClass.subject} ${currentClass.className}` : (entry ? ` · ${entry.subject || 'มีคาบแล้ว'}` : ' · ว่าง');
    return `<option value="${slot.period}"${slot.period === Number(currentEditPeriod) ? ' selected' : ''}>คาบ ${slot.period} · ${slot.s}–${slot.e}${timetableEscape(occupied)}</option>`;
  }).join('');

  const classes = [...appState.classes].sort((a, b) => {
    const bySubject = String(a.subject || '').localeCompare(String(b.subject || ''), 'th');
    return bySubject || String(a.className || '').localeCompare(String(b.className || ''), 'th', { numeric: true });
  });
  classSelect.innerHTML = '<option value="">-- เลือกวิชาและห้อง --</option>' + classes.map(c =>
    `<option value="${timetableEscape(c.id)}"${c.id === selectedClassId ? ' selected' : ''}>${timetableEscape(c.subject || 'ไม่ระบุวิชา')} · ${timetableEscape(c.className || 'ไม่ระบุห้อง')}</option>`
  ).join('');
}

function switchMobilePeriodSlot() {
  const dow = Number(document.getElementById('input-period-mobile-day')?.value);
  const period = Number(document.getElementById('input-period-mobile-slot')?.value);
  if (dow && period) openPeriodModal(dow, period);
}

// ==================== PERIOD SETTINGS MODAL ====================
function openPeriodSettings() {
  const ps = appState.periodSettings || { startTime:'08:30', duration:50, breakTime:0, count:7 };
  document.getElementById('ps-start-time').value = ps.startTime;
  document.getElementById('ps-duration').value = ps.duration;
  document.getElementById('ps-break').value = ps.breakTime;
  document.getElementById('ps-count').value = ps.count;
  document.getElementById('modal-period-settings').classList.add('show');
  renderPeriodPreview();
}
function closePeriodSettings() { document.getElementById('modal-period-settings').classList.remove('show'); }
function readPeriodSettings() {
  const startTime = document.getElementById('ps-start-time').value;
  const inputs = ['ps-duration','ps-break','ps-count'].map(id => document.getElementById(id).value);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || inputs.some(v => !/^\d+$/.test(v))) return null;
  const [duration, breakTime, count] = inputs.map(Number);
  if (duration < 10 || duration > 120 || breakTime < 0 || breakTime > 120 || count < 1 || count > 16) return null;
  const [hour, minute] = startTime.split(':').map(Number);
  if (hour * 60 + minute + duration * count + breakTime * (count - 1) > 1439) return null;
  return { startTime, duration, breakTime, count };
}
function renderPeriodPreview() {
  const ps = readPeriodSettings();
  const preview = document.getElementById('ps-preview');
  const error = document.getElementById('ps-settings-error');
  document.getElementById('ps-save').disabled = !ps;
  if (!ps) { preview.innerHTML = ''; error.textContent = 'ตรวจสอบเวลาและจำนวนคาบ โดยคาบสุดท้ายต้องสิ้นสุดภายในวันเดียวกัน'; return; }
  error.textContent = '';
  const [h,m] = ps.startTime.split(':').map(Number);
  const format = n => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  let current = h * 60 + m;
  preview.innerHTML = Array.from({length:ps.count}, (_,i) => {
    const start = current, end = start + ps.duration;
    current = end + ps.breakTime;
    return `<div class="ps-preview-row"><span class="ps-preview-num">คาบ ${i+1}</span><span class="ps-preview-time">${format(start)}–${format(end)}</span></div>`;
  }).join('');
}
function savePeriodSettings() {
  const ps = readPeriodSettings();
  if (!ps) { renderPeriodPreview(); return; }
  const hidden = (appState.timetable || []).filter(item => Number(item.period) > ps.count).length;
  if (hidden && !confirm(`มีคาบสอน ${hidden} รายการที่อยู่นอกจำนวนคาบใหม่ รายการเหล่านี้จะไม่แสดงในตาราง แต่ยังเก็บไว้และจะแสดงอีกเมื่อเพิ่มจำนวนคาบ ต้องการบันทึกหรือไม่?`)) return;
  appState.periodSettings = ps;
  saveState();
  closePeriodSettings();
  renderWebTimetable();
  if (appState.activeWebScreen === 'dashboard') renderWebDashboard();
}


// ==================== ATTENDANCE MATRIX ====================
