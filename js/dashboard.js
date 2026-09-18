function buildDashboardScheduleSlots(date) {
  return getTimetableEntriesForDay(date.getDay())
    .map(t => {
      const period = Number(t.period);
      const slot = getPeriodSlots().find(s => s.period === period) || { s:'08:30', e:'09:20' };
      const [sH,sM] = slot.s.split(':').map(Number);
      const [eH,eM] = slot.e.split(':').map(Number);
      const linkedClass = appState.classes.find(c => c.id === t.classId);
      return {
        ...t,
        period,
        subject: linkedClass?.subject || t.subject || 'ไม่ระบุวิชา',
        className: linkedClass?.className || t.className || '',
        startMin: sH*60+sM,
        endMin: eH*60+eM,
        slotStart: slot.s,
        slotEnd: slot.e
      };
    })
    .sort((a,b) => a.startMin - b.startMin);
}

function findNextDashboardScheduleDate(fromDate) {
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = new Date(fromDate);
    candidate.setDate(fromDate.getDate() + offset);
    if (getTimetableEntriesForDay(candidate.getDay()).length > 0) return candidate;
  }
  return null;
}

const HOME_DAY_ACCENTS = [
  { accent: '#e2464a', soft: '#fdecea' }, // อาทิตย์
  { accent: '#e0a81a', soft: '#fdf5e3' }, // จันทร์
  { accent: '#d4547e', soft: '#fdeaf2' }, // อังคาร
  { accent: '#1d9e75', soft: '#ecf9f6' }, // พุธ
  { accent: '#f97316', soft: '#fff7ed' }, // พฤหัสบดี
  { accent: '#3b7fd4', soft: '#eaf1fb' }, // ศุกร์
  { accent: '#8b5cf6', soft: '#f5f3ff' }  // เสาร์
];

function escapeHomeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

function renderHomeInsights(options) {
  const holder = document.getElementById('home-insight-list');
  if (!holder) return;
  const dateKey = options.dateKey;
  const viewSlots = options.viewSlots || [];
  const unchecked = options.unchecked || [];
  const nowMin = options.nowMin;
  const scheduleIsToday = options.scheduleIsToday;

  const absencesByClass = appState.classes.map(c => {
    const att = (c.attendance || {})[dateKey] || {};
    const absent = (c.students || []).filter(s => att[s.id] === 'absent').length;
    return { classId: c.id, subject: c.subject, className: c.className, absent };
  }).filter(item => item.absent > 0).sort((a, b) => b.absent - a.absent);

  const ongoing = scheduleIsToday ? viewSlots.find(t => nowMin >= t.startMin && nowMin < t.endMin) : null;
  const upcoming = scheduleIsToday ? viewSlots.find(t => nowMin < t.startMin) : null;
  const items = [];

  if (unchecked.length > 0) {
    const target = unchecked[0];
    items.push({
      tone: 'warning',
      icon: 'hgi-alert-02',
      title: `ยังไม่ได้เช็กชื่อ ${unchecked.length} คาบ`,
      detail: target ? `${target.subject} ${target.className} · แตะเพื่อเปิดเช็กชื่อ` : 'แตะเพื่อไปหน้าห้องเรียน',
      action: target ? `openSwipeAttendance('${target.classId}', new Date('${dateKey}'))` : `navigateToWebScreen('classrooms')`
    });
  }

  if (absencesByClass.length > 0) {
    const totalAbsent = absencesByClass.reduce((sum, item) => sum + item.absent, 0);
    absencesByClass.slice(0, 3).forEach((item) => {
      items.push({
        tone: 'danger',
        icon: 'hgi-user-remove-01',
        title: `${item.subject} ${item.className} ขาด ${item.absent} คน`,
        detail: `รวมวันนี้ขาด ${totalAbsent} คน`,
        action: `navigateToWebScreen('reports','${item.classId}')`
      });
    });
  } else {
    items.push({
      tone: 'done',
      icon: 'hgi-checkmark-circle-02',
      title: 'ยังไม่มีนักเรียนขาดในข้อมูลวันนี้',
      detail: 'หลังเช็กชื่อเสร็จ ระบบจะสรุปห้องที่ต้องติดตามให้ตรงนี้',
      action: `navigateToWebScreen('reports')`
    });
  }

  holder.innerHTML = items.slice(0, 4).map(item => `<button type="button" class="home-insight-item ${item.tone}" onclick="${item.action}">
    <span class="home-insight-icon"><i class="hgi-stroke ${item.icon}"></i></span>
    <span class="home-insight-copy"><strong>${escapeHomeHtml(item.title)}</strong><small>${escapeHomeHtml(item.detail)}</small></span>
    <i class="hgi-stroke hgi-arrow-right-01 home-insight-arrow"></i>
  </button>`).join('');
}

function renderWebDashboard() {
  const now = getNowDate();
  const viewDate = homeSelectedDate || now;
  const isToday = getTodayString(viewDate) === getTodayString(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const viewDow = viewDate.getDay();
  appState.timetableWeek = 'A';

  // หน้าแรกบอกงานตั้งค่าที่จำเป็น แต่รอให้ครูเลือกเริ่มเอง
  const setupCard = document.getElementById('home-setup-card');
  const setupCopy = document.getElementById('home-setup-copy');
  const setupButton = setupCard?.querySelector('button');
  const firstClassWithoutStudents = (appState.classes || []).find(c => !(c.students || []).length);
  if (setupCard && setupCopy && setupButton) {
    if (!(appState.classes || []).length) {
      setupCard.style.display = 'flex';
      setupCopy.textContent = 'สร้างห้องเรียนและเพิ่มรายชื่อนักเรียนก่อน เพื่อให้เช็คชื่อและเก็บคะแนนได้ครบ';
      setupButton.innerHTML = '<i class="hgi-stroke hgi-arrow-right-01"></i> เริ่มตั้งค่า';
      setupButton.onclick = startMainTour;
    } else if (firstClassWithoutStudents) {
      setupCard.style.display = 'flex';
      setupCopy.textContent = `เพิ่มรายชื่อนักเรียนใน ${firstClassWithoutStudents.subject} (${firstClassWithoutStudents.className}) เพื่อเริ่มใช้งานห้องนี้`;
      setupButton.innerHTML = '<i class="hgi-stroke hgi-user-add-01"></i> เพิ่มนักเรียน';
      setupButton.onclick = () => startStudentSetup(firstClassWithoutStudents.id);
    } else if (appState.onboarding?.setupStep === 'schedule') {
      setupCard.style.display = 'flex';
      setupCopy.textContent = 'เพิ่มตารางสอนเพื่อให้หน้าแรกเตือนคาบถัดไป และเปิดเช็คชื่อได้ตรงเวลา';
      setupButton.innerHTML = '<i class="hgi-stroke hgi-calendar-add-01"></i> สร้างตารางสอน';
      setupButton.onclick = startScheduleSetup;
    } else {
      setupCard.style.display = 'none';
    }
  }

  // ---- Date display ----
  const dayEl = document.getElementById('home-day-name');
  const dateEl = document.getElementById('home-date-big');
  const yearEl = document.getElementById('home-year');
  if (!dayEl) return;
  dayEl.innerText = DAY_NAMES[viewDow];
  dateEl.innerText = `${viewDate.getDate()} ${MONTH_NAMES[viewDate.getMonth()]}`;
  yearEl.innerText = `พ.ศ. ${viewDate.getFullYear() + 543}`;
  // สีการ์ดวันที่ตามสีประจำวัน
  const dateCard = document.getElementById('home-date-card');
  if (dateCard) {
    const dc = HOME_DAY_ACCENTS[viewDow] || HOME_DAY_ACCENTS[3];
    dateCard.style.setProperty('--home-day-accent', dc.accent);
    dateCard.style.setProperty('--home-day-soft', dc.soft);
  }

  // ---- Build slots for view day ----
  let scheduleDate = viewDate;
  let viewSlots = buildDashboardScheduleSlots(scheduleDate);
  let showingUpcoming = false;
  if (isToday && viewSlots.length === 0) {
    const nextScheduleDate = findNextDashboardScheduleDate(now);
    if (nextScheduleDate) {
      scheduleDate = nextScheduleDate;
      viewSlots = buildDashboardScheduleSlots(scheduleDate);
      showingUpcoming = true;
    }
  }
  const scheduleIsToday = getTodayString(scheduleDate) === getTodayString(now);

  // ---- Status badge → 2x2 attendance stats ----
  const badge = document.getElementById('home-status-badge');
  if (badge) {
    const dateStr = getTodayString(viewDate);
    let present = 0, late = 0, absent = 0, leave = 0;
    appState.classes.forEach(c => {
      const att = ((c.attendance || {})[dateStr]) || {};
      Object.values(att).forEach(v => {
        if (v === 'present') present++;
        else if (v === 'late') late++;
        else if (v === 'absent') absent++;
        else if (v === 'leave') leave++;
      });
    });
    badge.className = 'home-status-badge';
    badge.innerHTML = `
      <div class="home-stat-cell home-stat-present"><strong>${present}</strong><span>มา</span></div>
      <div class="home-stat-cell home-stat-late"><strong>${late}</strong><span>สาย</span></div>
      <div class="home-stat-cell home-stat-absent"><strong>${absent}</strong><span>ขาด</span></div>
      <div class="home-stat-cell home-stat-leave"><strong>${leave}</strong><span>ลา</span></div>`;
  }

  // ---- Schedule title ----
  const titleEl = document.getElementById('home-schedule-title');
  if (titleEl) {
    titleEl.innerText = showingUpcoming
      ? `ตารางสอนถัดไป · ${DAY_NAMES[scheduleDate.getDay()]}ที่ ${scheduleDate.getDate()} ${MONTH_NAMES[scheduleDate.getMonth()]}`
      : isToday ? 'ตารางสอนวันนี้' : `${DAY_NAMES[viewDow]}ที่ ${viewDate.getDate()} ${MONTH_NAMES[viewDate.getMonth()]}`;
  }

  // ---- Current teaching status ----
  const nextArea = document.getElementById('home-next-card-area');
  if (nextArea) {
    const currentSlots = buildDashboardScheduleSlots(now);
    const ongoing = currentSlots.find(t => nowMin >= t.startMin && nowMin < t.endMin);
    const upcoming = currentSlots.find(t => nowMin < t.startMin);
    if (ongoing) {
      const roomColor = getClassColor(ongoing.classId).text;
      nextArea.innerHTML = `<div class="home-next-card is-ongoing" onclick="openSwipeAttendance('${ongoing.classId}', getNowDate());">
        <div class="next-tag">วันนี้ · กำลังสอนขณะนี้ · ${ongoing.slotStart}–${ongoing.slotEnd} น.</div>
        <div class="next-subject">${ongoing.subject} <span><i class="home-room-dot" style="background:${roomColor};"></i>${ongoing.className}</span></div>
        <div class="next-meta">คาบ ${ongoing.period} · เปิดเช็กชื่อได้ทันทีจากตรงนี้</div>
        <button class="next-action-btn" onclick="openSwipeAttendance('${ongoing.classId}', getNowDate());event.stopPropagation();"><i class="hgi-stroke hgi-user-check-01"></i> เช็กชื่อคาบนี้</button>
      </div>`;
    } else if (upcoming) {
      const roomColor = getClassColor(upcoming.classId).text;
      nextArea.innerHTML = `<div class="home-next-card is-upcoming" onclick="openSwipeAttendance('${upcoming.classId}', getNowDate());">
        <div class="next-tag">วันนี้ · คาบถัดไป · ${upcoming.slotStart}–${upcoming.slotEnd} น.</div>
        <div class="next-subject">${upcoming.subject} <span><i class="home-room-dot" style="background:${roomColor};"></i>${upcoming.className}</span></div>
        <div class="next-meta">คาบ ${upcoming.period} · เริ่มในอีก ${upcoming.startMin - nowMin} นาที</div>
        <button class="next-action-btn" onclick="openSwipeAttendance('${upcoming.classId}', getNowDate());event.stopPropagation();"><i class="hgi-stroke hgi-user-check-01"></i> เตรียมเช็กชื่อ</button>
      </div>`;
    } else {
      nextArea.innerHTML = `<div class="home-next-card is-idle">
        <div class="next-tag">วันนี้</div>
        <div class="next-subject">ไม่มีคาบสอนตอนนี้</div>
        <div class="next-meta">เลือกวันที่หรือตารางสอนด้านล่างเพื่อดูคาบอื่น</div>
      </div>`;
    }
  }

  // ---- Unchecked warning (today only) ----
  let todayUnchecked = [];
  const uncheckedEl = document.getElementById('home-unchecked-card');
  if (uncheckedEl) {
    if (isToday && !showingUpcoming) {
      const today = getTodayString(now);
      const unchecked = viewSlots.filter(t => {
        if (nowMin < t.endMin) return false;
        const cls = appState.classes.find(x => x.id === t.classId);
        if (!cls) return true;
        const att = (cls.attendance || {})[today];
        return !att || Object.keys(att).length < cls.students.length;
      });
      todayUnchecked = unchecked;
      if (unchecked.length > 0) {
        uncheckedEl.style.display = 'none';
        uncheckedEl.className = 'home-unchecked-card';
        uncheckedEl.onclick = () => navigateToWebScreen('classrooms');
        uncheckedEl.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><i class="hgi-stroke hgi-alert-circle" style="font-size:1.1rem;color:#f97316;"></i><div style="font-size:0.82rem;color:#c2410c;"><span style="font-weight:800;">ยังไม่ได้เช็คชื่อ</span><span style="font-weight:600;color:#ea580c;"> · ${unchecked.length} คาบรอการเช็คชื่อ</span></div></div><i class="hgi-stroke hgi-arrow-right-01" style="color:#f97316;"></i>`;
      } else {
        uncheckedEl.style.display = 'none';
      }
    } else {
      uncheckedEl.style.display = 'none';
    }
  }

  renderHomeInsights({
    dateKey: getTodayString(scheduleDate),
    viewSlots,
    unchecked: todayUnchecked,
    nowMin,
    scheduleIsToday
  });

  // ---- Schedule list ----
  const listEl = document.getElementById('home-schedule-list');
  const countEl = document.getElementById('home-today-count');
  if (!listEl) return;
  if (countEl) countEl.innerText = `${viewSlots.length} คาบ`;

  if (viewSlots.length === 0) {
    listEl.innerHTML = `<div class="empty-state" style="padding:24px;"><i class="hgi-stroke hgi-calendar-remove-01"></i><p>ไม่มีตารางสอน</p></div>`;
    return;
  }

  const dateKey = getTodayString(scheduleDate);
  listEl.innerHTML = '';
  viewSlots.forEach(t => {
    const c = appState.classes.find(x => x.id === t.classId);
    const attData = c && (c.attendance || {})[dateKey];
    const checked = attData && c && Object.keys(attData).length >= c.students.length;
    const isOngoing = scheduleIsToday && nowMin >= t.startMin && nowMin < t.endMin;
    const isPast = scheduleIsToday && nowMin >= t.endMin;

    let dotClass = 'unchecked', badgeHtml = '';
    if (isOngoing) { dotClass = 'ongoing'; badgeHtml = `<span class="home-schedule-badge" style="background:var(--color-leave-bg);color:var(--color-leave);">● กำลังสอน</span>`; }
    else if (checked) { dotClass = 'present'; badgeHtml = `<span class="home-schedule-badge" style="background:var(--primary-light);color:var(--primary);">✓ เช็คแล้ว</span>`; }
    else if (isPast) { dotClass = 'absent'; badgeHtml = `<span class="home-schedule-badge" style="background:var(--color-absent-bg);color:var(--color-absent);">!</span>`; }

    const row = document.createElement('div');
    row.className = 'home-schedule-row' + (isOngoing ? ' is-now' : '');
    // hover = สีประจำห้อง, กดแล้วเปิดเช็คชื่อของวันที่กำลังดู
    row.style.setProperty('--row-hover', getClassColor(t.classId).bg);
    row.onclick = () => openSwipeAttendance(t.classId, scheduleDate);
    const dotCol = getClassColor(t.classId).text;
    row.innerHTML = `<div class="home-schedule-time">${t.slotStart}<br>${t.slotEnd}</div>
      <div class="home-schedule-info"><div class="home-schedule-subject" style="display:flex;align-items:center;gap:9px;"><span class="home-schedule-dot" style="background:${dotCol};"></span>${t.subject}</div><div class="home-schedule-class" style="margin-left:19px;">${t.className}</div></div>
      ${badgeHtml}`;
    listEl.appendChild(row);
  });
}

// ========== CALENDAR PICKER ==========
function toggleHomeCalendar() {
  const popup = document.getElementById('home-calendar-popup');
  if (!popup) return;
  const card = document.getElementById('home-date-card');
  if (popup.style.display === 'none' || !popup.style.display) {
    const d = homeSelectedDate || getNowDate();
    calViewYear = d.getFullYear();
    calViewMonth = d.getMonth();
    renderCalendar();
    popup.style.display = 'block';
    if (card) card.style.zIndex = '600'; // ยกการ์ด(+ป๊อปอัป) ให้อยู่เหนือการ์ดเตือน "ยังไม่เช็ค"
    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', closeCalOnOutside);
    }, 10);
  } else {
    closeHomeCalendar();
  }
}

function closeHomeCalendar() {
  const popup = document.getElementById('home-calendar-popup');
  const card = document.getElementById('home-date-card');
  if (popup) popup.style.display = 'none';
  if (card) card.style.zIndex = '';
  document.removeEventListener('click', closeCalOnOutside);
}

function closeCalOnOutside(e) {
  const popup = document.getElementById('home-calendar-popup');
  const card = document.getElementById('home-date-card');
  // คลิกในการ์ด/ป๊อปอัป ปล่อยให้ toggle/เลือกวันจัดการเอง
  if (card && card.contains(e.target)) return;
  if (popup && !popup.contains(e.target)) closeHomeCalendar();
}

function renderCalendar() {
  const popup = document.getElementById('home-calendar-popup');
  if (!popup) return;
  const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const today = getNowDate();
  const todayStr = getTodayString(today);
  const selectedStr = homeSelectedDate ? getTodayString(homeSelectedDate) : todayStr;
  const classDoWs = new Set((appState.timetable || [])
    .map(t => Number(t.dow))
    .filter(dow => Number.isInteger(dow) && dow >= 0 && dow <= 6));

  const firstDay = new Date(calViewYear, calViewMonth, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
  const thaiYear = calViewYear + 543;

  let html = `<div class="cal-header">
    <button class="cal-nav-btn" onclick="calNavMonth(-1);event.stopPropagation();"><i class="hgi-stroke hgi-arrow-left-01"></i></button>
    <span class="cal-header-title">${thaiMonths[calViewMonth]} ${thaiYear}</span>
    <button class="cal-nav-btn" onclick="calNavMonth(1);event.stopPropagation();"><i class="hgi-stroke hgi-arrow-right-01"></i></button>
  </div><div class="cal-grid">`;

  ['อา','จ','อ','พ','พฤ','ศ','ส'].forEach(d => { html += `<div class="cal-dow">${d}</div>`; });
  for (let i = 0; i < startDow; i++) html += '<div></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dObj = new Date(calViewYear, calViewMonth, d);
    const dStr = getTodayString(dObj);
    const dow = dObj.getDay();
    const isWknd = dow === 0 || dow === 6;
    const isTdy = dStr === todayStr;
    const isSel = dStr === selectedStr && !isTdy;
    const hasCls = classDoWs.has(dow);

    let cls = 'cal-day';
    if (isTdy) cls += ' today';
    else if (isSel) cls += ' selected';
    if (isWknd && !isTdy && !isSel) cls += ' weekend';
    if (hasCls) cls += ' has-class';

    html += `<div class="${cls}" onclick="selectCalDate(${calViewYear},${calViewMonth},${d});event.stopPropagation();">${d}</div>`;
  }
  html += `</div><button class="cal-today-btn" onclick="selectCalToday();event.stopPropagation();">วันนี้</button>`;
  popup.innerHTML = html;
}

function calNavMonth(delta) {
  calViewMonth += delta;
  if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
  if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
  renderCalendar();
}

function selectCalDate(y, m, d) {
  homeSelectedDate = new Date(y, m, d);
  closeHomeCalendar();
  renderWebDashboard();
}

function selectCalToday() {
  homeSelectedDate = null;
  closeHomeCalendar();
  renderWebDashboard();
}

// ==================== WEB CLASSROOMS ====================
