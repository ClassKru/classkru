// ==================== SCHEDULE GUARD (กันเช็คชื่อผิดวัน) ====================
let activeQrAttendance = null;
let qrAttendancePollTimer = null;
let swipeDoneFinishReadyAt = 0;

const SWIPE_EDIT_STATUS = {
  present: { label: 'มา', icon: 'hgi-tick-02' },
  late: { label: 'สาย', icon: 'hgi-clock-01' },
  absent: { label: 'ขาด', icon: 'hgi-cancel-01' },
  leave: { label: 'ลา', icon: 'hgi-file-02' }
};

function escapeAttendanceHtml(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

// วันในสัปดาห์ที่ห้องนี้มีคาบตามตาราง
function classScheduledDoWs(classId) {
  const set = new Set();
  (appState.timetable || []).forEach(t => { if (t.classId === classId) set.add(t.dow); });
  return set;
}

function isClassScheduledOn(classId, dateObj) {
  return classScheduledDoWs(classId).has(dateObj.getDay());
}

// อนุญาตให้เช็คไหม: มีคาบตามตาราง หรือเคยยืนยันเป็นคาบเสริมของวันนั้นแล้ว
function isSwipeDateAllowed() {
  const c = appState.classes.find(x => x.id === swipeClassId);
  if (!c) return true;
  const dObj = swipeSelectedDate || getNowDate();
  if (isClassScheduledOn(swipeClassId, dObj)) return true;
  const dateKey = getTodayString(dObj);
  return !!(c.extraDays && c.extraDays[dateKey]);
}

// เรียกก่อนบันทึกทุกครั้ง: ถ้าวันนี้ไม่มีคาบและยังไม่ยืนยันคาบเสริม → ถามยืนยันก่อน
function ensureSwipeDateAllowed(onOk) {
  if (isSwipeDateAllowed()) { onOk(); return; }
  const c = appState.classes.find(x => x.id === swipeClassId);
  if (!c) return;
  const dObj = swipeSelectedDate || getNowDate();
  const dateKey = getTodayString(dObj);
  const dayName = (typeof DAY_NAMES !== 'undefined') ? DAY_NAMES[dObj.getDay()] : '';
  showConfirm(
    `<b>${dayName}</b> ห้องนี้ไม่มีคาบสอนตามตารางเรียน<br>ต้องการบันทึกเป็น <b>คาบเสริม / ชดเชย</b> ใช่หรือไม่?`,
    () => {
      if (!c.extraDays) c.extraDays = {};
      c.extraDays[dateKey] = true;
      saveState();
      updateSwipeScheduleWarning();
      onOk();
    },
    { title: 'ไม่มีคาบตามตาราง', icon: '<i class="hgi-stroke hgi-alert-02" style="color:#F59E0B;"></i>', okText: 'ใช่ เพิ่มเป็นคาบเสริม', okSafe: true }
  );
}

// แถบเตือน/สถานะคาบเสริม เหนือการ์ดเช็คชื่อ
function updateSwipeScheduleWarning() {
  const el = document.getElementById('swipe-schedule-warning');
  if (!el) return;
  const c = appState.classes.find(x => x.id === swipeClassId);
  if (!c) { el.style.display = 'none'; return; }
  const dObj = swipeSelectedDate || getNowDate();
  const dateKey = getTodayString(dObj);
  if (isClassScheduledOn(swipeClassId, dObj)) { el.style.display = 'none'; return; }
  const isExtra = !!(c.extraDays && c.extraDays[dateKey]);
  el.style.display = 'flex';
  if (isExtra) {
    el.className = 'swipe-schedule-warning is-extra';
    el.innerHTML = `<i class="hgi-stroke hgi-calendar-add-01"></i><span>วันนี้บันทึกเป็น <b>คาบเสริม / ชดเชย</b></span><button onclick="cancelSwipeExtraDay()">ยกเลิกคาบเสริม</button>`;
  } else {
    el.className = 'swipe-schedule-warning';
    el.innerHTML = `<i class="hgi-stroke hgi-alert-02"></i><span>วันนี้ห้องนี้ <b>ไม่มีคาบสอนตามตาราง</b> — เช็กว่าเลือกวันถูกไหม</span><button onclick="ensureSwipeDateAllowed(updateSwipeScheduleWarning)">เพิ่มเป็นคาบเสริม</button>`;
  }
}

function cancelSwipeExtraDay() {
  const c = appState.classes.find(x => x.id === swipeClassId);
  if (!c || !c.extraDays) return;
  const dateKey = getTodayString(swipeSelectedDate || getNowDate());
  showConfirm('ยกเลิกการบันทึกวันนี้เป็นคาบเสริม? (ผลเช็คชื่อที่บันทึกไว้จะยังอยู่)', () => {
    delete c.extraDays[dateKey];
    saveState();
    updateSwipeScheduleWarning();
  }, { title: 'ยกเลิกคาบเสริม', icon: '<i class="hgi-stroke hgi-calendar-remove-01"></i>', okText: 'ยกเลิกคาบเสริม' });
}

function toggleSwipeCalendar() {
  const popup = document.getElementById('swipe-calendar-popup');
  if (!popup) return;
  if (popup.style.display === 'none' || !popup.style.display) {
    const d = swipeSelectedDate || getNowDate();
    swipeCalViewYear = d.getFullYear();
    swipeCalViewMonth = d.getMonth();
    renderSwipeCalendar();
    popup.style.display = 'block';
    setTimeout(() => {
      document.addEventListener('click', closeSwipeCalOnOutside);
    }, 10);
  } else {
    closeSwipeCalendar();
  }
}

function closeSwipeCalendar() {
  const popup = document.getElementById('swipe-calendar-popup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', closeSwipeCalOnOutside);
}

function closeSwipeCalOnOutside(e) {
  const popup = document.getElementById('swipe-calendar-popup');
  const btn = document.getElementById('swipe-date-btn');
  if (btn && btn.contains(e.target)) return;
  if (popup && !popup.contains(e.target)) closeSwipeCalendar();
}

function renderSwipeCalendar() {
  const popup = document.getElementById('swipe-calendar-popup');
  if (!popup) return;
  const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const today = getNowDate();
  const todayStr = getTodayString(today);
  const selectedStr = swipeSelectedDate ? getTodayString(swipeSelectedDate) : todayStr;

  const firstDay = new Date(swipeCalViewYear, swipeCalViewMonth, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(swipeCalViewYear, swipeCalViewMonth + 1, 0).getDate();
  const thaiYear = swipeCalViewYear + 543;

  let html = `<div class="cal-header">
    <button class="cal-nav-btn" onclick="swipeCalNavMonth(-1);event.stopPropagation();"><i class="hgi-stroke hgi-arrow-left-01"></i></button>
    <span class="cal-header-title">${thaiMonths[swipeCalViewMonth]} ${thaiYear}</span>
    <button class="cal-nav-btn" onclick="swipeCalNavMonth(1);event.stopPropagation();"><i class="hgi-stroke hgi-arrow-right-01"></i></button>
  </div><div class="cal-grid">`;

  ['อา','จ','อ','พ','พฤ','ศ','ส'].forEach(d => { html += `<div class="cal-dow">${d}</div>`; });
  for (let i = 0; i < startDow; i++) html += '<div></div>';

  const scheduledDoWs = classScheduledDoWs(swipeClassId);

  for (let d = 1; d <= daysInMonth; d++) {
    const dObj = new Date(swipeCalViewYear, swipeCalViewMonth, d);
    const dStr = getTodayString(dObj);
    const dow = dObj.getDay();
    const isWknd = dow === 0 || dow === 6;
    const isTdy = dStr === todayStr;
    const isSel = dStr === selectedStr && !isTdy;
    const hasCls = scheduledDoWs.has(dow);

    let cls = 'cal-day';
    if (isTdy) cls += ' today';
    else if (isSel) cls += ' selected';
    if (isWknd && !isTdy && !isSel) cls += ' weekend';
    if (hasCls) cls += ' has-class';

    html += `<div class="${cls}" onclick="selectSwipeCalDate(${swipeCalViewYear},${swipeCalViewMonth},${d});event.stopPropagation();">${d}</div>`;
  }
  html += `</div><button class="cal-today-btn" onclick="selectSwipeCalToday();event.stopPropagation();">วันนี้</button>`;
  popup.innerHTML = html;
}

function swipeCalNavMonth(delta) {
  swipeCalViewMonth += delta;
  if (swipeCalViewMonth > 11) { swipeCalViewMonth = 0; swipeCalViewYear++; }
  if (swipeCalViewMonth < 0) { swipeCalViewMonth = 11; swipeCalViewYear--; }
  renderSwipeCalendar();
}

function selectSwipeCalDate(y, m, d) {
  swipeSelectedDate = new Date(y, m, d);
  closeSwipeCalendar();
  updateSwipeDateDisplay();
  loadSwipeForDate();
}

function selectSwipeCalToday() {
  swipeSelectedDate = getNowDate();
  closeSwipeCalendar();
  updateSwipeDateDisplay();
  loadSwipeForDate();
}

// สีประจำวันแบบไทย (อา จ อ พ พฤ ศ ส) — ใช้ระบายขอบ+ตัวอักษรปุ่มวันที่
const THAI_DAY_COLORS = ['#e5544b', '#e0a81a', '#d4547e', '#22a565', '#f97316', '#3b7fd4', '#8b5cf6'];

function updateSwipeDateDisplay() {
  const d = swipeSelectedDate || getNowDate();
  const thaiMonthsShort = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const el = document.getElementById('swipe-date-display');
  if (el) el.innerHTML = `${d.getDate()} ${thaiMonthsShort[d.getMonth()]}<span class="ck-date-year"> ${d.getFullYear() + 543}</span>`;
  // ขอบ + ตัวอักษรตามสีประจำวัน
  const btn = document.getElementById('swipe-date-btn');
  if (btn) {
    const col = THAI_DAY_COLORS[d.getDay()];
    btn.style.borderColor = col;
    btn.style.color = col;
  }
}


function openSwipeAttendance(classId, forDate, options = {}) {
  swipeClassId = classId;
  swipeStudentIndex = 0;
  swipeResults = {};
  swipeHistory = [];
  swipeDoneFinishReadyAt = 0;

  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;

  if (options.returnTo) {
    setCheckinReturnTarget(options.returnTo);
  } else if (appState.activeWebScreen !== 'checkin') {
    clearCheckinReturnTarget();
  }

  // ใช้วันที่ที่ส่งเข้ามา (เช่น วันที่เลือกจากปฏิทินหน้าหลัก) ไม่งั้น default เป็นวันนี้
  swipeSelectedDate = forDate ? new Date(forDate) : getNowDate();
  updateSwipeDateDisplay();

  // Load existing attendance for today
  const dateKey = getTodayString(swipeSelectedDate);
  const existing = (c.attendance || {})[dateKey];
  if (existing) {
    swipeResults = { ...existing };
    swipeHistory = Object.entries(existing).map(([sid, st]) => ({ studentId: sid, status: st }));
  }

  // Update UI info — จุดสีประจำห้องหน้าชื่อวิชา
  const swipeCol = getClassColor(c.id);
  document.getElementById('swipe-class-title').innerHTML =
    `<span style="width:12px;height:12px;border-radius:50%;background:${swipeCol.text};flex-shrink:0;"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">${c.subject} (${c.className})</span>`;
  document.getElementById('swipe-class-meta').innerText = `${c.students.length} คน`;

  const ckTab = document.getElementById('checkin-classtab-holder');
  if (ckTab) ckTab.innerHTML = renderClassTabBar(classId, 'checkin');

  // Show overlay
  document.getElementById('swipe-overlay').classList.add('show');

  renderSwipeCard();
  updateSwipeSummary();
  updateSwipeScheduleWarning();

  // ทำให้ URL / sidebar / ชื่อหน้า ตรงกับหน้าที่เห็น (เช็คชื่อเป็นหน้าจริงแล้ว ไม่ใช่ overlay ลอย)
  applyCheckinRoute(classId);

  Tour.action('opened-checkin');
}

function closeSwipeAttendance() {
  stopQrAttendancePolling();
  document.getElementById('swipe-overlay').classList.remove('show');
  // ออกจากหน้าเช็คชื่อ → กลับไปหน้าที่มา (URL ต้องเปลี่ยนตามด้วย ไม่งั้นค้างที่ #checkin)
  // ถ้ามาถึงตรงนี้เพราะ hash เปลี่ยนไปหน้าอื่นอยู่แล้ว (กดปุ่ม back) ก็ไม่ต้องสั่งซ้ำ
  const stillOnCheckin = parseHash().screen === 'checkin';
  if (stillOnCheckin) {
    const returnTarget = consumeCheckinReturnTarget();
    if (navigateToCheckinReturnTarget(returnTarget)) return;
    // มือถือ: กลับหน้าห้องเรียนเสมอ ให้ทางออกของทุกแท็บในห้องเป็นทางเดียวกัน
    // (บนมือถือหน้าเช็คชื่อไม่มีแถบแท็บแล้ว การ์ดห้องคือทางแยกไปแท็บอื่น)
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    navigateToWebScreen(isMobile ? 'classrooms' : (screenBeforeCheckin || 'classrooms'));
    return;
  }
  // Refresh current screen
  const screen = appState.activeWebScreen;
  if (screen === 'classrooms') renderWebClassrooms();
  else if (screen === 'attendance') loadWebAttendanceMatrix();
  else if (screen === 'dashboard') renderWebDashboard();
}

function finishSwipeAttendance() {
  if (Date.now() < swipeDoneFinishReadyAt) return;
  const classId = swipeClassId;
  stopQrAttendancePolling();
  document.getElementById('swipe-overlay').classList.remove('show');
  if (classId) switchClassTab('reports', classId);
  else navigateToWebScreen('classrooms');
}

function finishSwipeAttendanceFromDone(event) {
  if (event) event.stopPropagation();
  finishSwipeAttendance();
}

function isSwipeAttendanceComplete() {
  const c = appState.classes.find(x => x.id === swipeClassId);
  return !!(c && c.students.length > 0 && c.students.every(s => swipeResults[s.id]));
}

function finishMobileSwipeAttendanceSoon() {
  // Mobile should stay on the completion summary so teachers can review or edit
  // the last marks. Leaving the screen now requires tapping "เสร็จสิ้น".
  return;
}

// เพิ่ม/นำเข้านักเรียนจากหน้าเช็คชื่อ (ใช้ห้องปัจจุบันของหน้าเช็คชื่อ)
function addStudentFromSwipe() {
  if (!swipeClassId) return;
  currentClassId = swipeClassId;
  openStudentModal();
}
function importStudentsFromSwipe() {
  if (!swipeClassId) return;
  currentClassId = swipeClassId;
  triggerDirectClassExcelImport(swipeClassId);
}

function makeQrAttendanceCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'QA';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getQrAttendanceLink(code) {
  const base = window.location.href.split('#')[0].replace(/index\.html(?:\?.*)?$/, '');
  return `${base.replace(/\/?$/, '/') }attendance-qr.html?code=${encodeURIComponent(code)}`;
}

function qrEscapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

function buildQrAttendanceRoster(c) {
  return (c.students || []).map(s => ({
    id: String(s.id || ''),
    name: String(s.name || '').trim(),
    nickname: String(s.nickname || '').trim(),
    studentNo: String(s.no || s.number || s.studentNo || '').trim(),
    studentCode: String(s.code || s.studentCode || '').trim()
  })).filter(s => s.id && s.name);
}

async function qrAttendanceRpc(name, args) {
  if (!supabaseClient) throw new Error('ยังเชื่อมต่อ Supabase ไม่ได้');
  const { data, error } = await supabaseClient.rpc(name, args);
  if (error) throw error;
  return data;
}

function getQrAttendanceErrorMessage(err, fallback) {
  const msg = String(err?.message || '');
  const code = String(err?.code || '');
  if (code === '42883' || /function .* does not exist|could not find the function/i.test(msg)) {
    return 'ยังไม่ได้รัน migration attendance QR ใน Supabase';
  }
  if (code === '42501' || /permission denied|not authorized|execute/i.test(msg)) {
    return 'Supabase ยังไม่ได้ grant สิทธิ์ให้ฟังก์ชัน QR attendance';
  }
  if (code === '23505' || /duplicate key|unique constraint/i.test(msg)) {
    return 'รหัส QR ซ้ำ กำลังลองสร้างใหม่';
  }
  if (/teacher authentication required|jwt|not authenticated|session not found/i.test(msg)) {
    return 'สิทธิ์ครูไม่พร้อม กรุณาเข้าสู่ระบบใหม่แล้วเปิด QR อีกครั้ง';
  }
  if (/failed to fetch|networkerror|load failed|timeout/i.test(msg)) {
    return 'เชื่อมต่อ Supabase ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
  }
  return msg || fallback;
}

function setQrAttendanceStatus(text, type = 'info') {
  const el = document.getElementById('qr-attendance-status');
  if (!el) return;
  el.textContent = text;
  el.className = `qr-attendance-status ${type}`;
}

function renderQrAttendanceList(marks) {
  const list = document.getElementById('qr-attendance-list');
  const presentEl = document.getElementById('qr-attendance-present');
  const rosterEl = document.getElementById('qr-attendance-roster');
  const c = appState.classes.find(x => x.id === swipeClassId);
  const rosterCount = c ? (c.students || []).length : 0;
  if (presentEl) presentEl.textContent = marks.length;
  if (rosterEl) rosterEl.textContent = rosterCount;
  if (!list) return;
  if (marks.length === 0) {
    list.innerHTML = '<div class="qr-attendance-empty">ยังไม่มีนักเรียนเช็คชื่อผ่าน QR</div>';
    return;
  }
  list.innerHTML = marks.map(mark => {
    const name = qrEscapeHtml(mark.student_name || mark.studentName || 'นักเรียน');
    const timeText = mark.updated_at ? new Date(mark.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';
    return `<div class="qr-attendance-row"><strong>${name}</strong><span>${timeText || 'เช็คชื่อแล้ว'}</span></div>`;
  }).join('');
}

function applyQrAttendanceMarks(marks) {
  const c = appState.classes.find(x => x.id === swipeClassId);
  if (!c) return 0;
  let changed = 0;
  marks.forEach(mark => {
    const sid = mark.student_id || mark.studentId;
    if (!sid || !c.students.some(s => s.id === sid)) return;
    if (!swipeResults[sid]) {
      swipeResults[sid] = 'present';
      swipeHistory.push({ studentId: sid, status: 'present' });
      changed++;
    }
  });
  if (changed) {
    autoSaveAttendance();
    updateSwipeSummary();
    renderDesktopSwipeTable();
    renderSwipeCard();
  }
  return changed;
}

async function pollQrAttendance() {
  if (!activeQrAttendance || !activeQrAttendance.code) return;
  try {
    const snapshot = await qrAttendanceRpc('attendance_qr_teacher_snapshot', { p_code: activeQrAttendance.code });
    const marks = Array.isArray(snapshot?.marks) ? snapshot.marks : [];
    const changed = applyQrAttendanceMarks(marks);
    renderQrAttendanceList(marks);
    const suffix = changed ? ` · รับใหม่ ${changed} คน` : '';
    setQrAttendanceStatus(`เปิดรับเช็คชื่ออยู่${suffix}`, 'success');
  } catch (err) {
    console.warn('QR attendance poll error:', err);
    setQrAttendanceStatus('ดึงผลเช็คชื่อไม่ได้ กรุณาตรวจว่า migration ถูกติดตั้งแล้ว', 'warning');
  }
}

function startQrAttendancePolling() {
  stopQrAttendancePolling();
  pollQrAttendance();
  qrAttendancePollTimer = setInterval(pollQrAttendance, 2500);
}

function stopQrAttendancePolling() {
  if (qrAttendancePollTimer) clearInterval(qrAttendancePollTimer);
  qrAttendancePollTimer = null;
}

async function openQrAttendanceModal() {
  const c = appState.classes.find(x => x.id === swipeClassId);
  if (!c) return;
  if (!isSwipeDateAllowed()) { ensureSwipeDateAllowed(openQrAttendanceModal); return; }
  if (!supabaseClient) { showToast('ต้องออนไลน์ก่อนจึงจะใช้ QR เช็คชื่อได้', 'warning'); return; }
  if (!localStorage.getItem('classmanager_email')) { showToast('กรุณาเข้าสู่ระบบก่อนใช้ QR เช็คชื่อ', 'warning'); return; }
  if (!c.students || c.students.length === 0) { showToast('ต้องมีรายชื่อนักเรียนก่อนเปิด QR', 'warning'); return; }

  const modal = document.getElementById('modal-qr-attendance');
  if (modal) modal.classList.add('show');
  renderQrAttendanceList([]);
  setQrAttendanceStatus('กำลังสร้าง QR...', 'info');

  const dateKey = getTodayString(swipeSelectedDate || getNowDate());
  const existingIsSame = activeQrAttendance &&
    activeQrAttendance.classId === swipeClassId &&
    activeQrAttendance.dateKey === dateKey;

  try {
    if (!existingIsSame) {
      const email = localStorage.getItem('classmanager_email');
      let createdCode = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = makeQrAttendanceCode();
        try {
          await qrAttendanceRpc('attendance_qr_create_session', {
            p_code: code,
            p_classroom_id: c.id,
            p_teacher_email: email,
            p_room_label: `${c.subject || 'วิชา'} (${c.className || 'ห้องเรียน'})`,
            p_date_key: dateKey,
            p_roster: buildQrAttendanceRoster(c)
          });
          createdCode = code;
          break;
        } catch (err) {
          const isDuplicate = String(err?.code || '') === '23505' || /duplicate key|unique constraint/i.test(String(err?.message || ''));
          if (!isDuplicate || attempt === 4) throw err;
        }
      }
      activeQrAttendance = { code: createdCode, classId: c.id, dateKey };
    }

    const link = getQrAttendanceLink(activeQrAttendance.code);
    const qrImg = document.getElementById('qr-attendance-img');
    const codeEl = document.getElementById('qr-attendance-code');
    const linkEl = document.getElementById('qr-attendance-link');
    if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(link)}`;
    if (codeEl) codeEl.textContent = activeQrAttendance.code;
    if (linkEl) {
      linkEl.href = link;
      linkEl.textContent = link;
    }
    startQrAttendancePolling();
  } catch (err) {
    console.warn('QR attendance create error:', err);
    setQrAttendanceStatus(getQrAttendanceErrorMessage(err, 'สร้าง QR ไม่สำเร็จ'), 'warning');
  }
}

function closeQrAttendanceModal() {
  document.getElementById('modal-qr-attendance')?.classList.remove('show');
}

async function closeActiveQrAttendanceSession() {
  if (!activeQrAttendance || !activeQrAttendance.code) {
    closeQrAttendanceModal();
    return;
  }
  try {
    await qrAttendanceRpc('attendance_qr_close_session', { p_code: activeQrAttendance.code });
    setQrAttendanceStatus('ปิด QR แล้ว', 'info');
    activeQrAttendance = null;
    stopQrAttendancePolling();
    closeQrAttendanceModal();
    showToast('ปิด QR เช็คชื่อแล้ว', 'success');
  } catch (err) {
    console.warn('QR attendance close error:', err);
    showToast('ปิด QR ไม่สำเร็จ', 'error');
  }
}

async function copyQrAttendanceLink() {
  if (!activeQrAttendance || !activeQrAttendance.code) return;
  const link = getQrAttendanceLink(activeQrAttendance.code);
  try {
    await navigator.clipboard.writeText(link);
    showToast('คัดลอกลิงก์ QR แล้ว', 'success');
  } catch (err) {
    showToast(link, 'info', 5000);
  }
}

// แก้ไขข้อมูลนักเรียนของการ์ดที่กำลังแสดงอยู่ (หน้าเช็คชื่อมือถือ)
// event.stopPropagation() กันไม่ให้การแตะปุ่มไปโดน onSwipeCardTap (เช็ค "มา")
function editCurrentSwipeStudent(event) {
  if (event) event.stopPropagation();
  const c = appState.classes.find(x => x.id === swipeClassId);
  if (!c) return;
  const student = c.students[swipeStudentIndex];
  if (!student) return;
  openStudentDetailModal(student.id, swipeClassId);
}

function openSwipeStudentPhoto(event) {
  if (event) event.stopPropagation();
  if (!ensureStudentPhotoPermission()) return;
  document.getElementById('swipe-student-photo-input')?.click();
}

// รูปนักเรียนเป็นข้อมูลส่วนบุคคล: ให้ครูรับทราบหน้าที่และยืนยันสิทธิ์ก่อนใช้ฟีเจอร์ทดลองครั้งแรก
function ensureStudentPhotoPermission() {
  const key = 'classkru_photo_notice_ack_v1';
  if (localStorage.getItem(key) === '1') return true;
  const accepted = window.confirm(
    'รูปนักเรียนเป็นข้อมูลส่วนบุคคล\n\n' +
    'โปรดใช้เฉพาะรูปที่ได้รับอนุญาตจากผู้ปกครองหรือผู้มีสิทธิ์ และใช้เพื่อช่วยจัดการชั้นเรียนเท่านั้น\n\n' +
    'อ่านนโยบายความเป็นส่วนตัวได้ที่หน้าแรกของ ClassKru\n\n' +
    'ต้องการเพิ่มรูปต่อหรือไม่?'
  );
  if (accepted) localStorage.setItem(key, '1');
  return accepted;
}

function processStudentPhotoFile(file, student, onDone) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const max = 256;
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = max;
      canvas.height = max;
      canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, max, max);
      student.photoBase64 = canvas.toDataURL('image/jpeg', 0.78);
      onDone();
    };
    img.onerror = () => showToast('เปิดรูปไม่สำเร็จ', 'error');
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function handleSwipeStudentPhoto(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('กรุณาเลือกไฟล์รูปภาพ', 'warning');
    event.target.value = '';
    return;
  }
  const c = appState.classes.find(x => x.id === swipeClassId);
  const student = c && c.students[swipeStudentIndex];
  if (!student) return;

  processStudentPhotoFile(file, student, () => {
    saveState();
    renderSwipeCard();
    showToast('บันทึกรูปนักเรียนแล้ว', 'success');
  });
  event.target.value = '';
}

function openStudentDetailPhoto(event) {
  if (event) event.stopPropagation();
  if (!ensureStudentPhotoPermission()) return;
  document.getElementById('student-detail-photo-input')?.click();
}

function handleStudentDetailPhoto(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('กรุณาเลือกไฟล์รูปภาพ', 'warning');
    event.target.value = '';
    return;
  }
  const c = appState.classes.find(x => x.id === currentClassId);
  const student = c && c.students.find(x => x.id === detailedStudentId);
  if (!student) return;
  processStudentPhotoFile(file, student, () => {
    const preview = document.getElementById('student-detail-photo-preview');
    if (preview) { preview.src = student.photoBase64; preview.style.display = 'block'; }
    saveState();
    if (swipeClassId === currentClassId) renderSwipeCard();
    showToast('บันทึกรูปนักเรียนแล้ว', 'success');
  });
  event.target.value = '';
}

function removeStudentDetailPhoto(event) {
  if (event) event.stopPropagation();
  const c = appState.classes.find(x => x.id === currentClassId);
  const student = c && c.students.find(x => x.id === detailedStudentId);
  if (!student || !student.photoBase64) return;
  if (!window.confirm('ต้องการลบรูปนักเรียนนี้หรือไม่?')) return;
  delete student.photoBase64;
  const preview = document.getElementById('student-detail-photo-preview');
  const removeButton = document.getElementById('student-detail-photo-remove');
  if (preview) { preview.src = ''; preview.style.display = 'none'; }
  if (removeButton) removeButton.style.display = 'none';
  saveState();
  if (swipeClassId === currentClassId) renderSwipeCard();
  showToast('ลบรูปนักเรียนแล้ว', 'success');
}
// รีเฟรชหน้าเช็คชื่อถ้ากำลังเปิดอยู่ (หลังเพิ่ม/นำเข้านักเรียน)
function refreshSwipeIfOpen() {
  const ov = document.getElementById('swipe-overlay');
  if (ov && ov.classList.contains('show') && swipeClassId) {
    const c = appState.classes.find(x => x.id === swipeClassId);
    if (c) document.getElementById('swipe-class-meta').innerText = `${c.students.length} คน`;
    renderSwipeCard();
    updateSwipeSummary();
  }
}

function mobileCheckinTap() {
  if (appState.classes.length === 0) {
    showToast('กรุณาเพิ่มห้องเรียนก่อน', 'info');
    navigateToWebScreen('classrooms');
    return;
  }
  if (appState.classes.length === 1) {
    openSwipeAttendance(appState.classes[0].id);
    return;
  }
  showMobileClassPicker();
}

// popup เลือกห้อง — ใช้ร่วมกันหลายที่ (เช็คชื่อ/คะแนน) ปลายทางส่งเข้ามาทาง onPick
// เก็บ callback ไว้ในตัวแปรเพราะ onclick ใน HTML string ส่งฟังก์ชันตรงๆ ไม่ได้
let __ckPickerOnPick = null;
function ckPickerChoose(classId) {
  const ov = document.querySelector('.ck-confirm-overlay');
  if (ov) ov.remove();
  const cb = __ckPickerOnPick;
  __ckPickerOnPick = null;
  if (cb) cb(classId);
}

function showMobileClassPicker(opts) {
  const o = opts || {};
  __ckPickerOnPick = o.onPick || (id => openSwipeAttendance(id));
  const headIcon = o.icon || 'hgi-task-done-01';
  const overlay = document.createElement('div');
  overlay.className = 'ck-confirm-overlay';
  // ใช้ลำดับเดียวกับหน้าห้องเรียนหลัก เพื่อไม่ให้ popup นี้ดูเหมือนข้อมูลคนละชุด
  // และสร้างรายการใหม่ทุกครั้งที่เปิด เพื่ออ่านข้อมูลห้องล่าสุดจาก appState
  const classes = typeof sortClassroomsForDisplay === 'function'
    ? sortClassroomsForDisplay(appState.classes || [])
    : [...(appState.classes || [])];
  const items = classes.map(c => {
    const pct = calculateAttendancePercentage(c);
    const year = getClassAcademicYear(c);
    return `<div onclick="ckPickerChoose('${c.id}')"
      style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border-color);cursor:pointer;transition:background 0.15s;"
      onmouseover="this.style.background='var(--primary-light)'" onmouseout="this.style.background=''">
      <div>
        <div style="font-weight:800;font-size:0.95rem;display:flex;align-items:center;gap:10px;"><span style="width:12px;height:12px;border-radius:50%;background:${getClassColor(c.id).text};flex-shrink:0;"></span>${c.subject}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;margin-left:22px;">ปี ${year} · ${c.className} · ${c.students.length} คน</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:0.78rem;font-weight:700;color:var(--primary);">${pct}%</span>
        <i class="hgi-stroke hgi-arrow-right-01" style="color:var(--text-muted);font-size:0.75rem;"></i>
      </div>
    </div>`;
  }).join('');

  overlay.innerHTML = `
    <div class="ck-confirm-box" style="padding:0;overflow:hidden;width:360px;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border-color);">
        <div style="font-size:1rem;font-weight:800;"><i class="hgi-stroke ${headIcon}" style="color:var(--primary);margin-right:8px;"></i>เลือกห้องเรียน</div>
        <button onclick="this.closest('.ck-confirm-overlay').remove()" style="border:none;background:none;font-size:1.2rem;cursor:pointer;color:var(--text-muted);">✕</button>
      </div>
      <div style="max-height:60vh;overflow-y:auto;">${items}</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function showSwipeClassPicker() {
  showMobileClassPicker();
}

function loadSwipeForDate() {
  const c = appState.classes.find(x => x.id === swipeClassId);
  if (!c) return;
  const dateKey = getTodayString(swipeSelectedDate || getNowDate());
  const existing = (c.attendance || {})[dateKey];
  swipeResults = existing ? { ...existing } : {};
  swipeHistory = existing ? Object.entries(existing).map(([sid, st]) => ({ studentId: sid, status: st })) : [];
  swipeStudentIndex = 0;
  renderSwipeCard();
  updateSwipeSummary();
  updateSwipeScheduleWarning();
}

function renderSwipeCard() {
  const c = appState.classes.find(x => x.id === swipeClassId);
  if (!c) return;
  renderDesktopSwipeTable(); // ล้าง/รีเฟรชตารางเดสก์ท็อปตามห้องปัจจุบันเสมอ (กันค้างรายชื่อห้องก่อนหน้าเมื่อห้องนี้ 0 คน)
  if (c.students.length === 0) {
    document.getElementById('swipe-card').style.display = 'none';
    document.getElementById('swipe-done-state').style.display = 'flex';
    document.getElementById('swipe-done-state').innerHTML = `
      <i class="hgi-stroke hgi-user-block-01" style="font-size:3rem;color:var(--text-muted);margin-bottom:12px;"></i>
      <h3 style="color:var(--text-muted);">ยังไม่มีนักเรียนในห้องนี้</h3>
      <p style="font-size:0.82rem;color:var(--text-muted);margin-top:8px;">เพิ่มรายชื่อเองทีละคน หรือนำเข้าจากไฟล์ Excel</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:16px;">
        <button class="btn btn-primary" style="padding:10px 20px;display:inline-flex;align-items:center;gap:8px;" onclick="addStudentFromSwipe()">
          <i class="hgi-stroke hgi-user-add-01"></i> เพิ่มนักเรียน
        </button>
        <button class="btn" style="padding:10px 20px;background-color:#E8F5E9;color:#2E7D32;border:1px solid #C8E6C9;display:inline-flex;align-items:center;gap:8px;" onclick="importStudentsFromSwipe()">
          <i class="hgi-stroke hgi-google-sheet"></i> นำเข้านักเรียน
        </button>
      </div>`;
    return;
  }

  const card = document.getElementById('swipe-card');
  const doneState = document.getElementById('swipe-done-state');

  // Find next unchecked student
  let found = false;
  for (let i = 0; i < c.students.length; i++) {
    const idx = (swipeStudentIndex + i) % c.students.length;
    if (!swipeResults[c.students[idx].id]) {
      swipeStudentIndex = idx;
      found = true;
      break;
    }
  }

  if (!found) {
    card.style.display = 'none';
    const shouldDelayFinish = doneState.style.display !== 'flex';
    doneState.style.display = 'flex';
    if (shouldDelayFinish) swipeDoneFinishReadyAt = Date.now() + 900;
    const isFinishWaiting = Date.now() < swipeDoneFinishReadyAt;
    const checked = Object.keys(swipeResults).length;
    const present = Object.values(swipeResults).filter(s => s === 'present').length;
    const late = Object.values(swipeResults).filter(s => s === 'late').length;
    const absent = Object.values(swipeResults).filter(s => s === 'absent').length;
    const leave = Object.values(swipeResults).filter(s => s === 'leave').length;
    doneState.innerHTML = `
      <i class="hgi-stroke hgi-checkmark-circle-02" style="font-size:3.5rem;color:var(--primary);margin-bottom:14px;"></i>
      <h3 style="font-size:1.3rem;font-weight:800;color:var(--text-main);">เช็คชื่อครบแล้ว!</h3>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-top:4px;">${c.students.length} คน · ${getTodayString(swipeSelectedDate || getNowDate())}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:14px;">
        <span class="summary-pill" style="background:var(--color-present-bg);color:var(--color-present);">มา ${present}</span>
        <span class="summary-pill" style="background:var(--color-late-bg);color:var(--color-late-text);">สาย ${late}</span>
        <span class="summary-pill" style="background:var(--color-absent-bg);color:var(--color-absent);">ขาด ${absent}</span>
        <span class="summary-pill" style="background:var(--color-leave-bg);color:var(--color-leave);">ลา ${leave}</span>
      </div>
      <button class="swipe-edit-done-btn" onclick="openSwipeMobileEdit()">
        <i class="hgi-stroke hgi-edit-02"></i> แก้ไขรายคน
      </button>
      <button id="swipe-done-finish-btn" class="btn btn-primary" style="margin-top:20px;padding:12px 32px;font-size:0.95rem;font-weight:700;" onclick="finishSwipeAttendanceFromDone(event)" ${isFinishWaiting ? 'disabled' : ''}>
        <i class="hgi-stroke hgi-tick-02" style="margin-right:6px;"></i>เสร็จสิ้น
      </button>`;
    if (isFinishWaiting) {
      const delay = Math.max(0, swipeDoneFinishReadyAt - Date.now());
      setTimeout(() => {
        const finishBtn = document.getElementById('swipe-done-finish-btn');
        if (finishBtn && Date.now() >= swipeDoneFinishReadyAt) finishBtn.disabled = false;
      }, delay);
    }
    return;
  }

  card.style.display = 'flex';
  doneState.style.display = 'none';

  const student = c.students[swipeStudentIndex];

  // Calculate historical stats
  let histPresent = 0, histLate = 0, histAbsent = 0;
  const dates = Object.keys(c.attendance || {});
  dates.forEach(d => {
    const st = (c.attendance[d] || {})[student.id];
    if (st === 'present') histPresent++;
    else if (st === 'late') histLate++;
    else if (st === 'absent') histAbsent++;
  });

  document.getElementById('swipe-card-no').innerText = `เลขที่ ${student.no || (swipeStudentIndex + 1)}`;
  document.getElementById('swipe-card-code').innerText = student.studentCode ? `รหัส ${student.studentCode}` : '';
  // รูปนักเรียนถ้ามี; ถ้าไม่มี ใช้ชื่อเล่นหรือเลขที่เป็น fallback
  const nick = (student.nickname || '').trim();
  const seatNo = student.no || (swipeStudentIndex + 1);
  const avatar = document.getElementById('swipe-card-avatar');
  avatar.classList.toggle('has-photo', !!student.photoBase64);
  if (student.photoBase64) avatar.innerHTML = `<img src="${student.photoBase64}" alt="">`;
  else avatar.innerText = nick || seatNo;
  document.getElementById('swipe-card-name').innerText = student.name;
  document.getElementById('swipe-card-stats').innerHTML = `
    <span class="sc-stat present">มา ${histPresent}</span>
    <span class="sc-stat late">สาย ${histLate}</span>
    <span class="sc-stat absent">ขาด ${histAbsent}</span>`;

  // Reset transform
  card.style.transform = '';
  card.classList.remove('swipe-out-right', 'swipe-out-left', 'swipe-out-up', 'hint-right', 'hint-left');
  card.classList.add('swipe-in');
  setTimeout(() => card.classList.remove('swipe-in'), 300);
}

// ========== DESKTOP VIEW TABLE LOGIC ==========
function renderDesktopSwipeTable() {
  const c = appState.classes.find(x => x.id === swipeClassId);
  const tbody = document.getElementById('swipe-desktop-table-body');
  if (!c || !tbody) return;

  if (c.students.length === 0) {
    tbody.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:56px 20px;color:var(--text-muted);">
        <i class="hgi-stroke hgi-user-block-01" style="font-size:3rem;margin-bottom:12px;"></i>
        <h3 style="color:var(--text-muted);margin:0 0 6px;font-weight:700;">ยังไม่มีนักเรียนในห้องนี้</h3>
        <p style="font-size:0.85rem;margin:0 0 18px;">เพิ่มรายชื่อเองทีละคน หรือนำเข้าจากไฟล์ Excel</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
          <button class="btn btn-primary" style="padding:10px 20px;display:inline-flex;align-items:center;gap:8px;" onclick="addStudentFromSwipe()"><i class="hgi-stroke hgi-user-add-01"></i> เพิ่มนักเรียน</button>
          <button class="btn" style="padding:10px 20px;background-color:#E8F5E9;color:#2E7D32;border:1px solid #C8E6C9;display:inline-flex;align-items:center;gap:8px;" onclick="importStudentsFromSwipe()"><i class="hgi-stroke hgi-google-sheet"></i> นำเข้านักเรียน</button>
        </div>
      </div>`;
    return;
  }

  let html = '';
  c.students.forEach((s, index) => {
    const currentStatus = swipeResults[s.id] || '';

    let sPresent = 0, sAbsent = 0, sLate = 0, sLeave = 0;
    Object.values(c.attendance || {}).forEach(dayRecord => {
      const st = (dayRecord || {})[s.id];
      if (st === 'present') sPresent++;
      else if (st === 'absent') sAbsent++;
      else if (st === 'late') sLate++;
      else if (st === 'leave') sLeave++;
    });

    html += `
      <div class="d-student-row">
        <div class="d-col-no">${s.no || (index + 1)}</div>
        <div class="d-col-code"><input class="d-code-input" type="text" value="${String(s.studentCode||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}" placeholder="—" onchange="setStudentCodeInline('${c.id}','${s.id}',this.value)"></div>
        <div class="d-col-name">${s.name}</div>
        <div class="d-col-status">
          <button class="d-status-btn type-present ${currentStatus === 'present' ? 'present' : ''}"
            onclick="setDesktopStudentStatus('${s.id}', 'present')"><i class="hgi-stroke hgi-tick-02"></i> มา</button>

          <button class="d-status-btn type-late ${currentStatus === 'late' ? 'late' : ''}"
            onclick="setDesktopStudentStatus('${s.id}', 'late')"><i class="hgi-stroke hgi-clock-01"></i> สาย</button>

          <button class="d-status-btn type-absent ${currentStatus === 'absent' ? 'absent' : ''}"
            onclick="setDesktopStudentStatus('${s.id}', 'absent')"><i class="hgi-stroke hgi-cancel-01"></i> ขาด</button>

          <button class="d-status-btn type-leave ${currentStatus === 'leave' ? 'leave' : ''}"
            onclick="setDesktopStudentStatus('${s.id}', 'leave')"><i class="hgi-stroke hgi-file-02"></i> ลา</button>
        </div>
        <div class="d-col-stats">
          <span style="color:var(--color-present);font-weight:700;">มา ${sPresent}</span>
          <span style="color:var(--color-absent);font-weight:700;">ขาด ${sAbsent}</span>
          <span style="color:var(--color-leave);font-weight:700;">ลา ${sLeave}</span>
          <span style="color:var(--color-late-text);font-weight:700;">สาย ${sLate}</span>
        </div>
        <div class="d-col-note">
          <input type="text" placeholder="หมายเหตุ..." style="width:100%;padding:6px 10px;border:1px solid var(--border-color);border-radius:6px;font-size:0.8rem;background:#fbfbfd;">
        </div>
        <div class="d-col-manage">
          <button class="d-manage-btn" title="แก้ไขข้อมูล" onclick="currentClassId='${c.id}';openStudentDetailModal('${s.id}','${c.id}')"><i class="hgi-stroke hgi-edit-02"></i></button>
          <button class="d-manage-btn danger" title="ลบนักเรียน" onclick="currentClassId='${c.id}';deleteStudentFromSwipe('${s.id}')"><i class="hgi-stroke hgi-delete-02"></i></button>
        </div>
      </div>
    `;
  });
  tbody.innerHTML = html;
}

function openSwipeMobileEdit() {
  const sheet = document.getElementById('swipe-mobile-edit-sheet');
  if (!sheet) return;
  renderSwipeMobileEditList();
  sheet.classList.add('show');
  sheet.setAttribute('aria-hidden', 'false');
}

function closeSwipeMobileEdit() {
  const sheet = document.getElementById('swipe-mobile-edit-sheet');
  if (!sheet) return;
  sheet.classList.remove('show');
  sheet.setAttribute('aria-hidden', 'true');
}

function renderSwipeMobileEditList() {
  const c = appState.classes.find(x => x.id === swipeClassId);
  const list = document.getElementById('swipe-mobile-edit-list');
  const subtitle = document.getElementById('swipe-mobile-edit-subtitle');
  if (!c || !list) return;

  const checked = c.students.filter(s => swipeResults[s.id]).length;
  if (subtitle) subtitle.innerText = `${checked} / ${c.students.length} คน · แตะสถานะเพื่อแก้ไข`;

  list.innerHTML = c.students.map((s, index) => {
    const currentStatus = swipeResults[s.id] || '';
    const currentLabel = SWIPE_EDIT_STATUS[currentStatus]?.label || 'ยังไม่ได้เช็ก';
    const name = escapeAttendanceHtml(s.name || `นักเรียน ${index + 1}`);
    const code = s.studentCode ? ` · รหัส ${escapeAttendanceHtml(s.studentCode)}` : '';
    const no = escapeAttendanceHtml(s.no || (index + 1));
    const buttons = Object.entries(SWIPE_EDIT_STATUS).map(([status, meta]) => `
      <button type="button" class="swipe-edit-status-btn ${status} ${currentStatus === status ? 'active' : ''}"
        onclick="setSwipeMobileEditStatus('${s.id}', '${status}')">
        <i class="hgi-stroke ${meta.icon}"></i><span>${meta.label}</span>
      </button>`).join('');

    return `<div class="swipe-edit-student-row ${currentStatus ? '' : 'unchecked'}">
      <div class="swipe-edit-student-main">
        <span class="swipe-edit-no">${no}</span>
        <div>
          <strong>${name}</strong>
          <small>${currentLabel}${code}</small>
        </div>
      </div>
      <div class="swipe-edit-status-grid">${buttons}</div>
    </div>`;
  }).join('');
}

function setSwipeMobileEditStatus(studentId, status) {
  const c = appState.classes.find(x => x.id === swipeClassId);
  if (!c || !SWIPE_EDIT_STATUS[status]) return;
  if (!isSwipeDateAllowed()) { ensureSwipeDateAllowed(() => setSwipeMobileEditStatus(studentId, status)); return; }
  const student = c.students.find(s => s.id === studentId);
  if (!student) return;

  const previousStatus = swipeResults[studentId] || '';
  swipeResults[studentId] = status;
  swipeHistory.push({ studentId, status, previousStatus });
  Tour.action('attendance-marked');

  const nextUnchecked = c.students.findIndex(s => !swipeResults[s.id]);
  swipeStudentIndex = nextUnchecked >= 0 ? nextUnchecked : c.students.findIndex(s => s.id === studentId);

  autoSaveAttendance();
  updateSwipeSummary();
  renderDesktopSwipeTable();
  renderSwipeCard();
  renderSwipeMobileEditList();
}

// ลบนักเรียนจากหน้าเช็คชื่อ — confirm + re-render ตาราง desktop หลังลบเสร็จ
function deleteStudentFromSwipe(studentId) {
  const c = appState.classes.find(x => x.id === swipeClassId);
  if (!c) return;
  const s = c.students.find(x => x.id === studentId);
  if (!s) return;
  showConfirm(`ลบ "${s.name}" ออกจากห้องเรียน?`, () => {
    c.students = c.students.filter(x => x.id !== studentId);
    c.students.forEach((st, i) => st.no = i + 1);
    Object.keys(c.attendance || {}).forEach(d => { delete c.attendance[d][studentId]; });
    delete swipeResults[studentId];
    saveState();
    showToast('ลบนักเรียนแล้ว', 'success');
    renderDesktopSwipeTable();
    updateSwipeSummary();
    document.getElementById('swipe-class-meta').innerText = `${c.students.length} คน`;
  }, { title: `ลบ "${s.name}"?`, icon: '🗑️', okText: 'ลบ' });
}

function setDesktopStudentStatus(studentId, status) {
  const c = appState.classes.find(x => x.id === swipeClassId);
  if (!c) return;
  if (!isSwipeDateAllowed()) { ensureSwipeDateAllowed(() => setDesktopStudentStatus(studentId, status)); return; }

  // Set the status
  swipeResults[studentId] = status;
  Tour.action('attendance-marked');

  // Try to find the next unchecked student to update swipeStudentIndex for the mobile view
  let foundUnchecked = false;
  for (let i = 0; i < c.students.length; i++) {
    if (!swipeResults[c.students[i].id]) {
      swipeStudentIndex = i;
      foundUnchecked = true;
      break;
    }
  }
  
  if (!foundUnchecked && c.students.length > 0) {
    swipeStudentIndex = 0; // fallback
  }

  // Record history for mobile view's undo functionality
  swipeHistory.push({ studentId, status });

  // บันทึกลง c.attendance ก่อน เพื่อให้สถานะสะสม (ขาด/ลา/สาย) อัปเดตเรียลไทม์
  autoSaveAttendance();

  // Update UI (อ่านค่าสะสมจาก c.attendance ที่เพิ่งบันทึก)
  updateSwipeSummary();
  renderDesktopSwipeTable();

  // Re-render mobile card in case the current card was checked from desktop
  renderSwipeCard();
}


function updateSwipeSummary() {
  let p=0,l=0,a=0,lv=0;
  Object.values(swipeResults).forEach(st => {
    if (st === 'present') p++;
    else if (st === 'late') l++;
    else if (st === 'absent') a++;
    else if (st === 'leave') lv++;
  });
  document.getElementById('swipe-cnt-present').innerText = p;
  document.getElementById('swipe-cnt-late').innerText = l;
  document.getElementById('swipe-cnt-absent').innerText = a;
  document.getElementById('swipe-cnt-leave').innerText = lv;

  const total = appState.classes.find(x => x.id === swipeClassId)?.students.length || 0;
  const checked = p + l + a + lv;
  document.getElementById('swipe-checked-count').innerText = checked;
  const totalEl = document.getElementById('swipe-total-count');
  if (totalEl) totalEl.innerText = total;
  const fill = document.getElementById('swipe-progress-fill');
  if (fill) fill.style.width = (total > 0 ? (checked / total) * 100 : 0) + '%';
}

function markSwipeStatus(status) {
  const c = appState.classes.find(x => x.id === swipeClassId);
  if (!c) return;
  if (!isSwipeDateAllowed()) { ensureSwipeDateAllowed(() => markSwipeStatus(status)); return; }

  // Find current visible student
  const student = c.students[swipeStudentIndex];
  if (!student || swipeResults[student.id]) {
    // Already checked, find next
    renderSwipeCard();
    return;
  }

  swipeResults[student.id] = status;
  swipeHistory.push({ studentId: student.id, status });
  Tour.action('attendance-marked');

  // Animate card out
  const card = document.getElementById('swipe-card');
  if (status === 'present' || status === 'late') card.classList.add('swipe-out-up');
  else if (status === 'absent') card.classList.add('swipe-out-right');
  else if (status === 'leave') card.classList.add('swipe-out-left');

  updateSwipeSummary();

  setTimeout(() => {
    card.classList.remove('swipe-out-right', 'swipe-out-left', 'swipe-out-up');
    swipeStudentIndex = (swipeStudentIndex + 1) % c.students.length;
    renderSwipeCard();
    autoSaveAttendance();
    finishMobileSwipeAttendanceSoon();
  }, 350);
}

function undoSwipe() {
  if (swipeHistory.length === 0) return;
  const last = swipeHistory.pop();
  if (last.previousStatus) swipeResults[last.studentId] = last.previousStatus;
  else delete swipeResults[last.studentId];

  const c = appState.classes.find(x => x.id === swipeClassId);
  if (c) {
    const idx = c.students.findIndex(s => s.id === last.studentId);
    if (idx >= 0) swipeStudentIndex = idx;
  }

  updateSwipeSummary();
  renderSwipeCard();
  autoSaveAttendance();
}

function setAllSwipePresent() {
  const c = appState.classes.find(x => x.id === swipeClassId);
  if (!c) return;
  if (!isSwipeDateAllowed()) { ensureSwipeDateAllowed(setAllSwipePresent); return; }
  showConfirm(`เปลี่ยนสถานะนักเรียนทั้ง ${c.students.length} คน เป็น "มา" ทั้งหมด?`, () => {
    // ทับสถานะทุกคนเป็น "มา" (รวมที่ตั้ง ขาด/สาย/ลา ไว้)
    c.students.forEach(s => {
      swipeResults[s.id] = 'present';
      swipeHistory.push({ studentId: s.id, status: 'present' });
    });
    autoSaveAttendance();       // บันทึกก่อน เพื่อให้สถานะสะสมอัปเดตเรียลไทม์
    updateSwipeSummary();
    renderDesktopSwipeTable();  // รีเฟรชตาราง desktop
    renderSwipeCard();
    showToast(`ตั้งสถานะ "มา" ให้นักเรียนทั้ง ${c.students.length} คนแล้ว`, 'success');
    finishMobileSwipeAttendanceSoon();
  }, { title: 'มาทุกคน', icon: '<i class="hgi-stroke hgi-checkmark-circle-02" style="color:var(--color-present);"></i>', okText: 'ยืนยัน', okSafe: true });
}

function clearSwipeChecks() {
  showConfirm('ต้องการล้างผลเช็คชื่อทั้งหมด?', () => {
    swipeResults = {};
    swipeHistory = [];
    swipeStudentIndex = 0;
    autoSaveAttendance();
    updateSwipeSummary();
    renderDesktopSwipeTable();
    renderSwipeCard();
  }, { title: 'ล้างข้อมูลเช็คชื่อ', icon: '🗑️', okText: 'ล้าง' });
}

function autoSaveAttendance() {
  const c = appState.classes.find(x => x.id === swipeClassId);
  if (!c) return;
  const date = getTodayString(swipeSelectedDate || getNowDate());
  if (!c.attendance) c.attendance = {};

  const finalResult = {};
  c.students.forEach(s => {
    if (swipeResults[s.id]) {
      finalResult[s.id] = swipeResults[s.id];
    }
  });
  // ถ้าไม่มีการเช็คเหลืออยู่เลย (เช่น ยกเลิก/ล้างหมด) → ลบ key วันที่ทิ้ง
  // ไม่งั้นจะเหลือ record ว่างค้าง แล้วรายงานนับเป็น "คาบ 0%" (ข้อมูลไม่ซิงก์)
  if (Object.keys(finalResult).length === 0) {
    delete c.attendance[date];
  } else {
    c.attendance[date] = finalResult;
  }

  saveState();
  // showSaveToast(); // ซ่อน toast "บันทึกแล้ว" ตามที่ผู้ใช้ต้องการ (auto-save เงียบ)

  // Also refresh parent views immediately so it reflects in background if visible
  if (appState.activeWebScreen === 'dashboard') renderWebDashboard();
  else if (appState.activeWebScreen === 'attendance') loadWebAttendanceMatrix();
  else if (appState.activeWebScreen === 'classrooms') renderWebClassrooms();
}

// ==================== TOAST SYSTEM ====================
function getToastContainer() {
  let c = document.getElementById('ck-toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'ck-toast-container';
    c.className = 'ck-toast-container';
    document.body.appendChild(c);
  }
  return c;
}

function showToast(msg, type = 'success', duration = 2200) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const container = getToastContainer();
  const el = document.createElement('div');
  el.className = `ck-toast ${type}`;
  el.innerHTML = `<span>${icons[type] || '✅'}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

function showConfirm(msg, onOk, { title = 'ยืนยัน', icon = '🗑️', okText = 'ยืนยัน', okSafe = false } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'ck-confirm-overlay';
  overlay.innerHTML = `
    <div class="ck-confirm-box">
      <div class="ck-confirm-icon">${icon}</div>
      <div class="ck-confirm-title">${title}</div>
      <div class="ck-confirm-msg">${msg}</div>
      <div class="ck-confirm-btns">
        <button onclick="this.closest('.ck-confirm-overlay').remove()">ยกเลิก</button>
        <button class="ck-confirm-ok ${okSafe ? 'safe' : ''}" id="ck-ok-btn">${okText}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#ck-ok-btn').onclick = () => { overlay.remove(); onOk(); };
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function showSaveToast() {
  showToast('<i class="hgi-stroke hgi-cloud-upload" style="margin-right:4px;"></i>บันทึกแล้ว', 'success', 1500);
}

// ===== TOUCH GESTURE HANDLERS =====
function onSwipeCardTap(event) {
  // If user was dragging instead of tapping, don't trigger tap
  if (Math.abs(swipeTouchCurrentX - swipeTouchStartX) > 20) return;
  markSwipeStatus('present');
}

function onSwipeTouchStart(event) {
  swipeTouchStartX = event.touches[0].clientX;
  swipeTouchCurrentX = swipeTouchStartX;
  swipeIsDragging = true;
  document.getElementById('swipe-card').classList.add('dragging');
}

function onSwipeTouchMove(event) {
  if (!swipeIsDragging) return;
  event.preventDefault();
  swipeTouchCurrentX = event.touches[0].clientX;
  const deltaX = swipeTouchCurrentX - swipeTouchStartX;
  const card = document.getElementById('swipe-card');
  const rotation = deltaX * 0.05;
  card.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`;

  card.classList.remove('hint-right', 'hint-left');
  if (deltaX > 40) card.classList.add('hint-right');       // ขาด
  else if (deltaX < -40) card.classList.add('hint-left');   // ลา
}

function onSwipeTouchEnd(event) {
  if (!swipeIsDragging) return;
  swipeIsDragging = false;
  const card = document.getElementById('swipe-card');
  card.classList.remove('dragging', 'hint-right', 'hint-left');
  const deltaX = swipeTouchCurrentX - swipeTouchStartX;

  if (deltaX > SWIPE_THRESHOLD) {
    markSwipeStatus('absent');    // ปัดขวา = ขาด
  } else if (deltaX < -SWIPE_THRESHOLD) {
    markSwipeStatus('leave');     // ปัดซ้าย = ลา
  } else {
    card.style.transform = '';    // Snap back
  }
}

// ==================== MODALS ====================
