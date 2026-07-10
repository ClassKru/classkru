// ==================== URL ROUTING (#hash) — รองรับ LINE OA ลิงก์เข้าหน้าตรงๆ ====================
// หน้าที่ลิงก์เข้าได้จาก URL เช่น classkru-kohl.vercel.app/#reports
const ROUTABLE_SCREENS = ['dashboard','classrooms','students','timetable','attendance','reports','settings'];

// อ่านชื่อหน้าจาก URL hash เช่น "#reports" → "reports" (คืน null ถ้าไม่มี/ไม่ถูกต้อง)
function getScreenFromHash() {
  const raw = (location.hash || '').replace(/^#/, '').trim();
  return ROUTABLE_SCREENS.includes(raw) ? raw : null;
}

// หน้าที่ผู้ใช้ "ลิงก์เข้ามา" ตอนเปิดแอป (เช่นจาก LINE OA) — อ่านครั้งเดียวตอนโหลด
// ใช้ให้ deep-link ชนะ activeWebScreen ที่ค้างใน cloud state ตอน sync ครั้งแรก
// จะถูกล้างเป็น null ทันทีที่ผู้ใช้เปลี่ยนไปหน้าอื่นเอง (กัน sync กระตุกกลับ)
let pendingDeepLink = getScreenFromHash();

// LINE OA แตะเมนูซ้ำ / กดปุ่ม back ของเบราว์เซอร์ → เปลี่ยนหน้าตาม hash
window.addEventListener('hashchange', () => {
  const mainApp = document.getElementById('main-app');
  if (!mainApp || mainApp.style.display === 'none') return; // ยังไม่ล็อกอิน ไม่ต้องทำอะไร
  const screen = getScreenFromHash();
  if (screen && screen !== appState.activeWebScreen) navigateToWebScreen(screen);
});

// ==================== NAVIGATION ====================
function navigateToWebScreen(screenId) {
  // เมนู 'excel' ถูกตัดออกแล้ว (นำเข้าตารางสอนย้ายไปหน้าตารางสอน) — กัน state เก่าที่ค้าง
  if (screenId === 'excel') screenId = 'timetable';

  // ผู้ใช้เปลี่ยนไปหน้าอื่นที่ไม่ใช่ deep-link แล้ว → ยกเลิก deep-link (กัน sync ดึงกลับ)
  if (pendingDeepLink && screenId !== pendingDeepLink) pendingDeepLink = null;

  // ถ้ากำลังอยู่หน้าเช็คชื่อ (overlay) แล้วกดเมนู sidebar → ปิด overlay ก่อน
  const swipeOverlay = document.getElementById('swipe-overlay');
  if (swipeOverlay && swipeOverlay.classList.contains('show')) {
    swipeOverlay.classList.remove('show');
  }

  appState.activeWebScreen = screenId;
  saveStateLocalOnly(false);

  // อัปเดต URL hash ให้ตรงหน้า (แชร์ลิงก์ได้ / กด back ได้ / LINE OA ลิงก์ตรง)
  // hashchange ที่ตามมาจะเห็นว่าตรงกับ activeWebScreen อยู่แล้ว → ไม่ navigate ซ้ำ (กัน loop)
  if (location.hash !== '#' + screenId) location.hash = screenId;

  const screens = ['dashboard','classrooms','students','timetable','attendance','scores','reports','settings'];
  screens.forEach(s => {
    const el = document.getElementById(`web-screen-${s}`);
    if (el) el.style.display = s === screenId ? 'block' : 'none';
  });

  // Sidebar active
  document.querySelectorAll('.sidebar-menu .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-screen') === screenId);
  });

  // Mobile bottom nav active
  document.querySelectorAll('.mob-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-screen') === screenId);
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


