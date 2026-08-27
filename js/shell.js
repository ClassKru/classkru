// ==================== URL ROUTING (#hash) — รองรับ LINE OA ลิงก์เข้าหน้าตรงๆ ====================
// หน้าที่ลิงก์เข้าได้จาก URL เช่น classkru-kohl.vercel.app/#reports
// 'checkin' คือหน้าเช็คชื่อ (เดิมเป็น overlay ที่ไม่มี URL ของตัวเอง) — ต้องมี param บอกห้อง
const ROUTABLE_SCREENS = ['dashboard','help','classrooms','students','timetable','attendance','scores','reports','games','settings','checkin'];

// รูปแบบ hash: "#reports" หรือแบบมีพารามิเตอร์ "#checkin:c_1712345678"
// คืน { screen, param } — screen เป็น null ถ้า hash ไม่ถูกต้อง
function parseHash() {
  const raw = (location.hash || '').replace(/^#/, '').trim();
  const i = raw.indexOf(':');
  const name = i === -1 ? raw : raw.slice(0, i);
  const param = i === -1 ? null : raw.slice(i + 1);
  return ROUTABLE_SCREENS.includes(name) ? { screen: name, param: param || null } : { screen: null, param: null };
}

// อ่านชื่อหน้าจาก URL hash เช่น "#reports" → "reports" (คืน null ถ้าไม่มี/ไม่ถูกต้อง)
function getScreenFromHash() { return parseHash().screen; }

// หน้าที่ผู้ใช้ "ลิงก์เข้ามา" ตอนเปิดแอป (เช่นจาก LINE OA) — อ่านครั้งเดียวตอนโหลด
// ใช้ให้ deep-link ชนะ activeWebScreen ที่ค้างใน cloud state ตอน sync ครั้งแรก
// จะถูกล้างเป็น null ทันทีที่ผู้ใช้เปลี่ยนไปหน้าอื่นเอง (กัน sync กระตุกกลับ)
let pendingDeepLink = getScreenFromHash();
// ห้องที่แนบมากับ deep-link เช่น "#checkin:c_123" — เก็บคู่กับ pendingDeepLink
let pendingDeepLinkParam = parseHash().param;

// หน้าที่อยู่ก่อนเข้าเช็คชื่อ — ใช้ตอนกด "กลับ" ให้ย้อนไปหน้าที่มาจริงๆ
let screenBeforeCheckin = null;
// ต้นทางแบบละเอียดของหน้าเช็คชื่อ เช่น เข้าจากจุดในรายงานรายภาค
// ใช้เฉพาะเคสที่ต้องกลับไปหน้าจอเดิมจริงๆ ไม่ใช่ fallback ทั่วไป
let checkinReturnTarget = null;

function setCheckinReturnTarget(target) {
  checkinReturnTarget = target || null;
}

function clearCheckinReturnTarget() {
  checkinReturnTarget = null;
}

function consumeCheckinReturnTarget() {
  const target = checkinReturnTarget;
  checkinReturnTarget = null;
  return target;
}

function navigateToCheckinReturnTarget(target) {
  if (!target || !target.screen) return false;
  if (target.screen === 'reports' && target.classId) {
    navigateToWebScreen('reports', target.classId);
    if (target.reportTab && typeof switchWebReportTab === 'function') {
      switchWebReportTab(target.reportTab);
    }
    return true;
  }
  navigateToWebScreen(target.screen, target.classId);
  return true;
}

// ==================== เขียน URL: push หรือ replace ====================
// สลับแท็บ/เปลี่ยนห้อง "ภายในห้องเดียวกัน" = การเคลื่อนที่แนวราบ ไม่ควรสร้างประวัติใหม่
// ถ้า push ทุกครั้ง history จะบวมขึ้นเรื่อยๆ (วัดจริง: เดิน 5 หน้า ประวัติ 24→28 ไม่เคยลด)
// แล้วปุ่ม back ของเครื่องจะเดินถอยหลังผ่านทุกหน้าที่เคยเปิดตามลำดับเวลา แทนที่จะถอยขึ้นหน้าแม่
// switchClassTab จึงยกธงนี้ก่อนเปลี่ยนหน้า → รอบนั้นใช้ replaceState แทน
// (replaceState ไม่ยิง hashchange ซึ่งตรงกับที่ต้องการ เพราะเราเปลี่ยนหน้าด้วยมือไปแล้ว)
let __ckReplaceHashOnce = false;
function setRouteHash(hash) {
  const replace = __ckReplaceHashOnce;
  __ckReplaceHashOnce = false;   // ธงใช้ครั้งเดียวเสมอ ล้างก่อน return กันค้างข้ามรอบ
  if (location.hash === hash) return;
  if (replace) history.replaceState(null, '', hash);
  else location.hash = hash;
}

// LINE OA แตะเมนูซ้ำ / กดปุ่ม back ของเบราว์เซอร์ → เปลี่ยนหน้าตาม hash
window.addEventListener('hashchange', () => {
  const mainApp = document.getElementById('main-app');
  if (!mainApp || mainApp.style.display === 'none') return; // ยังไม่ล็อกอิน ไม่ต้องทำอะไร
  const { screen, param } = parseHash();
  if (!screen) return;
  if (screen === 'checkin') {
    // อยู่ห้องเดิมอยู่แล้ว = hash ที่เราเพิ่งเซ็ตเอง ไม่ต้องเปิดซ้ำ (กันวน)
    const ov = document.getElementById('swipe-overlay');
    const showing = ov && ov.classList.contains('show');
    if (!(showing && swipeClassId === param)) navigateToWebScreen('checkin', param);
    return;
  }
  if (['students', 'scores', 'reports'].includes(screen) && param) {
    const activeClassId = screen === 'scores'
      ? (typeof scoreCurrentClassId !== 'undefined' ? scoreCurrentClassId : null)
      : currentClassId;
    if (screen !== appState.activeWebScreen || activeClassId !== param) navigateToWebScreen(screen, param);
    return;
  }
  if (screen !== appState.activeWebScreen) navigateToWebScreen(screen);
});

// ==================== NAVIGATION ====================
// เมนูทุกขนาดจอใช้ข้อมูลกลางชุดเดียว เพิ่ม/ย้ายเมนูได้โดยไม่ต้องแก้ HTML ซ้ำหลายจุด
const APP_NAVIGATION = [
  { id: 'dashboard', label: 'หน้าหลัก', mobileLabel: 'หน้าหลัก', icon: 'hgi-home-01', screens: ['dashboard'], desktopOrder: 1, mobileOrder: 1 },
  { id: 'classrooms', label: 'ห้องเรียนของฉัน', mobileLabel: 'ห้องเรียน', icon: 'hgi-school', screens: ['classrooms', 'students', 'scores', 'reports'], desktopScreens: ['classrooms', 'students', 'scores', 'reports', 'checkin'], desktopOrder: 2, mobileOrder: 5 },
  { id: 'timetable', label: 'ตารางสอน', mobileLabel: 'ตารางสอน', icon: 'hgi-calendar-03', screens: ['timetable'], desktopOrder: 3, mobileOrder: 2 },
  { id: 'checkin', label: 'เช็คชื่อ', mobileLabel: 'เช็คชื่อ', icon: 'hgi-task-done-01', screens: ['checkin'], mobileOrder: 3, className: 'checkin-btn', action: 'mobileCheckinTap()' },
  { id: 'tools', label: 'เครื่องมือช่วยสอน', mobileLabel: 'เครื่องมือ', icon: 'hgi-magic-wand-01', screens: ['tools'], desktopOrder: 4, moreOrder: 1 },
  { id: 'qr-score', label: 'กรอกคะแนนด้วย QR', mobileLabel: 'QR คะแนน', icon: 'hgi-qr-code', screens: [], desktopOrder: 5, mobileOrder: 4, className: 'qr-score-mobile-nav', action: 'openQrScoreScanner()' },
  { id: 'games', label: 'เกมการศึกษา', mobileLabel: 'เกม', icon: 'hgi-rocket-01', screens: ['games'], desktopOrder: 6, moreOrder: 2 },
  { id: 'help', label: 'ศูนย์ช่วยเหลือ', mobileLabel: 'ช่วยเหลือ', icon: 'hgi-customer-service-01', screens: ['help'], desktopOrder: 7, moreOrder: 4 },
  { id: 'settings', label: 'ตั้งค่าระบบ', mobileLabel: 'ตั้งค่า', icon: 'hgi-settings-01', screens: ['settings'], desktopOrder: 8, moreOrder: 3 }
];

function navigationAction(item) {
  return item.action || `navigateToWebScreen('${item.id}')`;
}

function navigationButton(item, variant) {
  const label = variant === 'desktop' ? item.label : item.mobileLabel;
  const screens = (item[`${variant}Screens`] || item.screens).join(' ');
  const classes = variant === 'desktop'
    ? 'nav-item'
    : variant === 'mobile'
      ? `mob-nav-btn ${item.className || ''}`.trim()
      : 'mobile-more-item';
  return `<button class="${classes}" type="button" data-nav-id="${item.id}" data-screen="${screens}" onclick="${navigationAction(item)}" aria-label="${item.label}" title="${item.label}"><i class="hgi-stroke ${item.icon}"></i><span>${label}</span></button>`;
}

function renderAppNavigation() {
  const desktop = document.getElementById('desktop-navigation');
  const mobile = document.getElementById('mobile-bottom-nav');
  const more = document.getElementById('mobile-more-navigation');
  if (desktop) desktop.innerHTML = APP_NAVIGATION.filter(item => item.desktopOrder).sort((a, b) => a.desktopOrder - b.desktopOrder).map(item => navigationButton(item, 'desktop')).join('');
  if (mobile) {
    const quickItems = APP_NAVIGATION.filter(item => item.mobileOrder).sort((a, b) => a.mobileOrder - b.mobileOrder);
    const moreItems = APP_NAVIGATION.filter(item => item.moreOrder).sort((a, b) => a.moreOrder - b.moreOrder);
    const moreScreens = moreItems.flatMap(item => item.screens).join(' ');
    mobile.innerHTML = quickItems.map(item => navigationButton(item, 'mobile')).join('')
      + `<button class="mob-nav-btn mobile-more-nav" type="button" data-nav-id="more" data-screen="${moreScreens}" onclick="openMobileMoreMenu()" aria-label="เมนูเพิ่มเติม" title="เมนูเพิ่มเติม"><i class="hgi-stroke hgi-menu-01"></i><span>เพิ่มเติม</span></button>`;
  }
  if (more) more.innerHTML = APP_NAVIGATION.filter(item => item.moreOrder).sort((a, b) => a.moreOrder - b.moreOrder).map(item => navigationButton(item, 'more')).join('');
  updateNavigationState(appState?.activeWebScreen || 'dashboard');
}

function updateNavigationState(screenId) {
  document.querySelectorAll('[data-nav-id]').forEach(button => {
    const owns = (button.getAttribute('data-screen') || '').split(' ').filter(Boolean);
    const active = owns.includes(screenId);
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

renderAppNavigation();

function navigateToWebScreen(screenId, param) {
  closeMobileMoreMenu();

  // เมนู 'excel' ถูกตัดออกแล้ว (นำเข้าตารางสอนย้ายไปหน้าตารางสอน) — กัน state เก่าที่ค้าง
  if (screenId === 'excel') screenId = 'timetable';

  // นักเรียน/คะแนน/รายงาน = เข้าเฉพาะ "รายวิชา" ผ่านการ์ดหน้าห้องเรียนวิชาสอน
  // ไม่มีห้องแนบมา (ลิงก์ตรง #scores/#reports · refresh · กด back) → เด้งกลับหน้าห้องเรียนวิชาสอน
  let detailClassId = null;
  if (screenId === 'students' || screenId === 'scores' || screenId === 'reports') {
    detailClassId = (param && appState.classes.some(c => c.id === param)) ? param : null;
    if (!detailClassId && (screenId === 'scores' || screenId === 'reports')) { navigateToWebScreen('classrooms'); return; }
    if (param && !detailClassId) { navigateToWebScreen('classrooms'); return; }
    if (screenId === 'students' && detailClassId) window.__forceStudentClassId = detailClassId;
  }

  // ผู้ใช้เปลี่ยนไปหน้าอื่นที่ไม่ใช่ deep-link แล้ว → ยกเลิก deep-link (กัน sync ดึงกลับ)
  if (pendingDeepLink && screenId !== pendingDeepLink) pendingDeepLink = null;

  // หน้าเช็คชื่อมี DOM เป็น overlay (ไม่ใช่ div#web-screen-*) เลยแยกทางเดินของมันออกมา
  // ตัวจริงที่ทำงานคือ openSwipeAttendance ซึ่งจะเรียก applyCheckinRoute() ปิดท้ายเอง
  if (screenId === 'checkin') {
    const cid = param || swipeClassId;
    const exists = cid && appState.classes.some(c => c.id === cid);
    if (!exists) { navigateToWebScreen('classrooms'); return; }   // ห้องถูกลบ/ลิงก์เสีย → กลับหน้าห้องเรียน
    if (appState.activeWebScreen !== 'checkin') screenBeforeCheckin = appState.activeWebScreen;
    openSwipeAttendance(cid);
    return;
  }

  // ถ้ากำลังอยู่หน้าเช็คชื่อ (overlay) แล้วกดเมนู sidebar → ปิด overlay ก่อน
  const swipeOverlay = document.getElementById('swipe-overlay');
  if (swipeOverlay && swipeOverlay.classList.contains('show')) {
    swipeOverlay.classList.remove('show');
  }

  appState.activeWebScreen = screenId;
  saveStateLocalOnly(false);

  // อัปเดต URL hash ให้ตรงหน้า (แชร์ลิงก์ได้ / กด back ได้ / LINE OA ลิงก์ตรง)
  // hashchange ที่ตามมาจะเห็นว่าตรงกับ activeWebScreen อยู่แล้ว → ไม่ navigate ซ้ำ (กัน loop)
  setRouteHash(detailClassId ? `#${screenId}:${detailClassId}` : '#' + screenId);

  const screens = ['dashboard','help','classrooms','students','timetable','attendance','scores','reports','tools','games','settings'];
  screens.forEach(s => {
    const el = document.getElementById(`web-screen-${s}`);
    if (el) el.style.display = s === screenId ? 'block' : 'none';
  });

  updateNavigationState(screenId);

  const titleEl = document.getElementById('web-header-title');
  const subEl = document.getElementById('web-header-subtitle');
  const titles = {
    dashboard: ['หน้าหลัก', 'ตารางสอนและเช็คชื่อด่วน'],
    help: ['ศูนย์ช่วยเหลือ', 'วิธีใช้งาน แจ้งปัญหา และติดต่อทีมงาน'],
    classrooms: ['ห้องเรียนของฉัน', 'จัดการรายวิชาและเช็คชื่อด่วน'],
    students: ['จัดการรายชื่อเด็ก', 'เพิ่ม ลบ แก้ไข ย้ายห้อง'],
    timetable: ['ตารางสอน', 'กำหนดคาบเรียนประจำสัปดาห์'],
    attendance: ['Attendance Matrix', 'ประวัติเข้าเรียนรายคาบ'],
    scores: ['เก็บคะแนน', 'กรอกคะแนน รวมผล ตัดเกรดอัตโนมัติ'],
    reports: ['รายงานวิเคราะห์ผล', 'สถิติเชิงลึกรายห้องเรียน'],
    tools: ['เครื่องมือช่วยสอน', 'เลือกห้องเรียนและเปิดเครื่องมือหน้าชั้นเรียน'],
    games: ['เกมการศึกษา', 'เลือกกิจกรรมสนุก ๆ สำหรับนักเรียน'],
    settings: ['ตั้งค่าระบบ', 'จัดการบัญชีและข้อมูล']
  };
  if (titles[screenId] && titleEl && subEl) {
    titleEl.innerText = titles[screenId][0];
    subEl.innerText = titles[screenId][1];
  }

  // Render
  if (screenId === 'dashboard') renderWebDashboard();
  else if (screenId === 'classrooms') renderWebClassrooms();
  else if (screenId === 'students') renderWebStudents();
  else if (screenId === 'timetable') renderWebTimetable();
  else if (screenId === 'attendance') loadWebAttendanceMatrix();
  else if (screenId === 'scores') viewClassScores(detailClassId);
  else if (screenId === 'reports') showWebClassReport(detailClassId);
  else if (screenId === 'tools') renderTeachingToolsPage();
  else if (screenId === 'help') renderHelpHub();

  if (typeof maybeStartScreenGuide === 'function') {
    maybeStartScreenGuide(screenId);
  }
  if (typeof Tour !== 'undefined' && Tour.active) setTimeout(() => Tour._place(), 80);
}

function openMobileMoreMenu() {
  document.getElementById('mobile-more-menu')?.classList.add('show');
}

function closeMobileMoreMenu() {
  document.getElementById('mobile-more-menu')?.classList.remove('show');
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMobileMoreMenu();
});

function openHelpLine(topic) {
  const message = encodeURIComponent(`#${topic}`);
  const lineMessageUrl = `https://line.me/R/oaMessage/${encodeURIComponent('@731idhsu')}/?${message}`;
  const isMobile = window.matchMedia('(max-width: 768px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = lineMessageUrl;
    return;
  }
  document.getElementById('modal-help-line')?.classList.add('show');
}

function closeHelpLineModal() {
  document.getElementById('modal-help-line')?.classList.remove('show');
}

// ==================== หน้าเช็คชื่อในฐานะ "หน้า" จริง ====================
// DOM ของเช็คชื่อเป็น overlay ไม่ใช่ div#web-screen-* เลยทำงานฝั่ง routing แยก
// openSwipeAttendance เรียกตัวนี้ปิดท้าย เพื่อให้ URL / sidebar / ชื่อหน้า ตรงกับที่เห็นจริง
function applyCheckinRoute(classId) {
  if (appState.activeWebScreen !== 'checkin') screenBeforeCheckin = appState.activeWebScreen;
  appState.activeWebScreen = 'checkin';
  saveStateLocalOnly(false);

  setRouteHash('#checkin:' + classId);   // เข้าจากการ์ดห้อง = push (ปุ่ม back ปิดหน้านี้ได้) · สลับแท็บ = replace

  // ซ่อนหน้าอื่นทั้งหมด (overlay ทับอยู่แล้ว แต่ต้องให้ state ตรงกัน)
  ['dashboard','help','classrooms','students','timetable','attendance','scores','reports','tools','games','settings'].forEach(s => {
    const el = document.getElementById(`web-screen-${s}`);
    if (el) el.style.display = 'none';
  });

  // เช็คชื่อสังกัดห้องเรียน → ไฮไลต์เมนู "ห้องเรียนวิชาสอน" ไม่ปล่อยให้ค้างที่หน้าเดิม
  updateNavigationState('checkin');

  const titleEl = document.getElementById('web-header-title');
  const subEl = document.getElementById('web-header-subtitle');
  if (titleEl && subEl) {
    titleEl.innerText = 'เช็คชื่อ';
    subEl.innerText = 'เช็คชื่อรายคาบ ปัดการ์ดทีละคน';
  }
}

// ==================== นำเข้าตารางสอนจาก Excel (modal บนหน้าตารางสอน) ====================
function openTimetableImport() {
  // reset สถานะทุกครั้งที่เปิด (ซ่อน mapping area ของรอบก่อน)
  const mapArea = document.getElementById('excel-timetable-mapping-area');
  if (mapArea) mapArea.style.display = 'none';
  const input = document.getElementById('web-excel-timetable-input');
  if (input) input.value = '';
  document.getElementById('modal-timetable-import').classList.add('show');
}
function closeTimetableImport() {
  document.getElementById('modal-timetable-import').classList.remove('show');
}

// ==================== NEXT CLASS ALGORITHM ====================
function calculateNextClass() {
  const now = getNowDate();
  const currentDow = now.getDay();
  if (appState.timetable.length === 0) return null;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayClasses = appState.timetable
    .filter(p => Number(p.dow) === currentDow)
    .map(p => {
      const slot = TIMETABLE_SLOTS_MASTER.find(s => s.period === p.period) || { s:'08:30', e:'09:20' };
      const [sH,sM] = slot.s.split(':').map(Number);
      const [eH,eM] = slot.e.split(':').map(Number);
      return { ...p, startMin: sH*60+sM, endMin: eH*60+eM, timeString: `${slot.s} - ${slot.e} น.` };
    })
    .sort((a,b) => a.startMin - b.startMin);

  for (let p of todayClasses) {
    if (currentMinutes < p.endMin) {
      const isOngoing = currentMinutes >= p.startMin;
      return { ...p, relativeDayText: 'วันนี้', statusText: isOngoing ? 'กำลังสอนอยู่' : `เริ่มในอีก ${p.startMin - currentMinutes} นาที`, isOngoing };
    }
  }

  for (let offset = 1; offset <= 7; offset++) {
    const nextDow = (currentDow + offset) % 7;
    const nextClasses = appState.timetable
      .filter(p => Number(p.dow) === nextDow)
      .map(p => {
        const slot = TIMETABLE_SLOTS_MASTER.find(s => s.period === p.period) || { s:'08:30', e:'09:20' };
        return { ...p, startMin: slot.s.split(':').map(Number).reduce((h,m)=>h*60+m), timeString: `${slot.s} - ${slot.e} น.` };
      })
      .sort((a,b) => a.startMin - b.startMin);

    if (nextClasses.length > 0) {
      const dayLabel = offset === 1 ? 'วันพรุ่งนี้' : `วัน${DAY_NAMES[nextDow].slice(3)}`;
      return { ...nextClasses[0], relativeDayText: dayLabel, statusText: `คาบที่ ${nextClasses[0].period}`, isOngoing: false };
    }
  }
  return null;
}

// ==================== HOME SCREEN ====================
let homeSelectedDate = null;
let calViewYear = 0;
let calViewMonth = 0;
