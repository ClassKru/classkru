// ==================== URL ROUTING (#hash) — รองรับ LINE OA ลิงก์เข้าหน้าตรงๆ ====================
// หน้าที่ลิงก์เข้าได้จาก URL เช่น classkru-kohl.vercel.app/#reports
// 'checkin' คือหน้าเช็คชื่อ (เดิมเป็น overlay ที่ไม่มี URL ของตัวเอง) — ต้องมี param บอกห้อง
const ROUTABLE_SCREENS = ['dashboard','classrooms','students','timetable','attendance','scores','reports','settings','checkin'];

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
  if (screen !== appState.activeWebScreen) navigateToWebScreen(screen);
});

// ==================== NAVIGATION ====================
function navigateToWebScreen(screenId, param) {
  // เมนู 'excel' ถูกตัดออกแล้ว (นำเข้าตารางสอนย้ายไปหน้าตารางสอน) — กัน state เก่าที่ค้าง
  if (screenId === 'excel') screenId = 'timetable';

  // ผู้ใช้เปลี่ยนไปหน้าอื่นที่ไม่ใช่ deep-link แล้ว → ยกเลิก deep-link (กัน sync ดึงกลับ)
  if (pendingDeepLink && screenId !== pendingDeepLink) pendingDeepLink = null;

  // ธง "เข้ามาทางปุ่มนักเรียน" มีอายุแค่ในวงจร เลือกห้อง ↔ หน้านักเรียน เท่านั้น
  // ออกไปหน้าอื่นเมื่อไหร่ (เช็คชื่อ/คะแนน/ตารางสอน) = เปลี่ยนใจแล้ว → กลับค่าเริ่มต้น
  // ไม่งั้นธงค้างข้ามงาน แล้วแตะการ์ดทีหลังจะได้หน้านักเรียนโดยไม่รู้ตัว
  if (screenId !== 'classrooms' && screenId !== __ckRoomEntryTab) __ckRoomEntryTab = 'checkin';

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
  setRouteHash('#' + screenId);

  const screens = ['dashboard','classrooms','students','timetable','attendance','scores','reports','settings'];
  screens.forEach(s => {
    const el = document.getElementById(`web-screen-${s}`);
    if (el) el.style.display = s === screenId ? 'block' : 'none';
  });

  // Sidebar active
  document.querySelectorAll('.sidebar-menu .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-screen') === screenId);
  });

  // Mobile bottom nav active — data-screen รับได้หลายหน้าคั่นด้วยช่องว่าง
  // ปุ่ม "นักเรียน" ครอบทั้ง "classrooms students" เพราะหน้าเลือกห้องกับหน้ารายชื่อ
  // เป็นขั้นตอนเดียวกันในสายตาครู ไฟต้องติดค้างตลอดทาง ไม่ใช่ดับตอนเลือกห้อง
  document.querySelectorAll('.mob-nav-btn').forEach(btn => {
    const owns = (btn.getAttribute('data-screen') || '').split(' ');
    btn.classList.toggle('active', owns.includes(screenId));
  });

  const titleEl = document.getElementById('web-header-title');
  const subEl = document.getElementById('web-header-subtitle');
  const titles = {
    dashboard: ['หน้าหลัก', 'ตารางสอนและเช็คชื่อด่วน'],
    classrooms: ['ห้องเรียนวิชาสอน', 'จัดการรายวิชาและเช็คชื่อด่วน'],
    students: ['จัดการรายชื่อเด็ก', 'เพิ่ม ลบ แก้ไข ย้ายห้อง'],
    timetable: ['ตารางสอนสัปดาห์', 'กำหนดคาบเรียนรองรับ Week A/B'],
    attendance: ['Attendance Matrix', 'ประวัติเข้าเรียนรายคาบ'],
    scores: ['เก็บคะแนน', 'กรอกคะแนน รวมผล ตัดเกรดอัตโนมัติ'],
    reports: ['รายงานวิเคราะห์ผล', 'สถิติเชิงลึกรายห้องเรียน'],
    settings: ['ตั้งค่าระบบ', 'จัดการผู้ใช้งาน & รีเซ็ต']
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
  else if (screenId === 'scores') renderWebScores();
  else if (screenId === 'reports') renderWebReports();
}

// ==================== หน้าเช็คชื่อในฐานะ "หน้า" จริง ====================
// DOM ของเช็คชื่อเป็น overlay ไม่ใช่ div#web-screen-* เลยทำงานฝั่ง routing แยก
// openSwipeAttendance เรียกตัวนี้ปิดท้าย เพื่อให้ URL / sidebar / ชื่อหน้า ตรงกับที่เห็นจริง
function applyCheckinRoute(classId) {
  // มาถึงหน้าเช็คชื่อแล้ว = ออกจากสาย "นักเรียน" แน่นอน → ล้างธงทางเข้า
  // ต้องล้างที่นี่ด้วย เพราะ switchClassTab('checkin') ยิงเข้า openSwipeAttendance ตรงๆ
  // ไม่ผ่าน navigateToWebScreen ที่เป็นจุดล้างอีกจุด
  __ckRoomEntryTab = 'checkin';
  if (appState.activeWebScreen !== 'checkin') screenBeforeCheckin = appState.activeWebScreen;
  appState.activeWebScreen = 'checkin';
  saveStateLocalOnly(false);

  setRouteHash('#checkin:' + classId);   // เข้าจากการ์ดห้อง = push (ปุ่ม back ปิดหน้านี้ได้) · สลับแท็บ = replace

  // ซ่อนหน้าอื่นทั้งหมด (overlay ทับอยู่แล้ว แต่ต้องให้ state ตรงกัน)
  ['dashboard','classrooms','students','timetable','attendance','scores','reports','settings'].forEach(s => {
    const el = document.getElementById(`web-screen-${s}`);
    if (el) el.style.display = 'none';
  });

  // เช็คชื่อสังกัดห้องเรียน → ไฮไลต์เมนู "ห้องเรียนวิชาสอน" ไม่ปล่อยให้ค้างที่หน้าเดิม
  document.querySelectorAll('.sidebar-menu .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-screen') === 'classrooms');
  });
  // bottom nav มือถือ: ไฮไลต์ปุ่ม "เช็คชื่อ" ตรงๆ (ปุ่ม "นักเรียน" ถือ data-screen="classrooms"
  // ไปแล้ว ถ้าไฮไลต์ด้วย 'classrooms' เหมือน sidebar จะไฟติดผิดปุ่ม)
  document.querySelectorAll('.mob-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-screen') === 'checkin');
  });

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
  const activeWeek = appState.timetableWeek || 'A';

  const todayClasses = appState.timetable
    .filter(p => p.dow === currentDow && (p.week === undefined || p.week === activeWeek))
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
      .filter(p => p.dow === nextDow && (p.week === undefined || p.week === activeWeek))
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


