/**
 * =========================================================
 * ClassKru — Connected Classroom System
 * =========================================================
 * Responsive Web App + Swipe Attendance Check-in
 * Desktop: Sidebar layout | Mobile: Bottom Nav
 */

// ==================== STATE ====================
let appState = {
  classes: [],
  timetable: [],
  timetableWeek: 'A',
  activeWebScreen: 'dashboard',
  holidays: []
};

const STORAGE_KEY = 'classkru_mobile_v4';
let currentClassId = null;
let currentWebReportTab = 'today';
let currentExcelImportTab = 'students';
let editingClassId = null;
let selectedClassColorIndex = 0;
let editingStudentId = null;
let detailedStudentId = null;
let parsedExcelRows = [];
let parsedExcelHeaders = [];
let parsedExcelType = 'students';
let currentEditDow = null;
let currentEditPeriod = null;
let mockDateTimeString = null;

// Swipe Attendance State
let swipeClassId = null;
let swipeStudentIndex = 0;
let swipeResults = {};
let swipeHistory = [];
let swipeTouchStartX = 0;
let swipeTouchCurrentX = 0;
let swipeIsDragging = false;
const SWIPE_THRESHOLD = 80;

let swipeSelectedDate = null;
let swipeCalViewYear = null;
let swipeCalViewMonth = null;

let repSelectedDate = null;
let repCalViewYear = null;
let repCalViewMonth = null;

// Constants
const DAY_NAMES = ['วันอาทิตย์','วันจันทร์','วันอังคาร','วันพุธ','วันพฤหัสบดี','วันศุกร์','วันเสาร์'];
const DAY_SHORT = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
const MONTH_NAMES = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
// สีการ์ดวันที่ตามสีประจำวัน (โทนเข้มพอให้ตัวอักษรขาวอ่านชัด)
const DAY_CARD_COLORS = [
  { grad: 'linear-gradient(135deg, #e2464a 0%, #c62828 100%)', shadow: 'rgba(198,40,40,0.28)' },   // อาทิตย์ · แดง
  { grad: 'linear-gradient(135deg, #f4b23a 0%, #e0900d 100%)', shadow: 'rgba(224,144,13,0.28)' },   // จันทร์ · เหลือง
  { grad: 'linear-gradient(135deg, #ec6ea3 0%, #d94a86 100%)', shadow: 'rgba(217,74,134,0.28)' },    // อังคาร · ชมพู
  { grad: 'linear-gradient(135deg, #1d9e75 0%, #0d8a5f 100%)', shadow: 'rgba(13,138,95,0.28)' },     // พุธ · เขียว
  { grad: 'linear-gradient(135deg, #f5892b 0%, #e8640f 100%)', shadow: 'rgba(232,100,15,0.28)' },    // พฤหัส · ส้ม
  { grad: 'linear-gradient(135deg, #4a90d9 0%, #2f6fc0 100%)', shadow: 'rgba(47,111,192,0.28)' },    // ศุกร์ · ฟ้า
  { grad: 'linear-gradient(135deg, #9c6ade 0%, #7d4fc9 100%)', shadow: 'rgba(125,79,201,0.28)' },    // เสาร์ · ม่วง
];

// Dynamic period slots — generated from appState.periodSettings
// Default fallback used before state loads
const TIMETABLE_SLOTS_DEFAULT = [
  { period: 1, s: '08:30', e: '09:20' },
  { period: 2, s: '09:20', e: '10:10' },
  { period: 3, s: '10:10', e: '11:00' },
  { period: 4, s: '11:00', e: '11:50' },
  { period: 5, s: '13:00', e: '13:50' },
  { period: 6, s: '13:50', e: '14:40' },
  { period: 7, s: '14:40', e: '15:30' }
];

function getPeriodSlots() {
  const ps = (typeof appState !== 'undefined' && appState.periodSettings) ? appState.periodSettings : null;
  if (!ps) return TIMETABLE_SLOTS_DEFAULT;
  const slots = [];
  const [h, m] = ps.startTime.split(':').map(Number);
  let cur = h * 60 + m;
  const dur = Number(ps.duration) || 50;
  const brk = Number(ps.breakTime) || 0;
  const cnt = Number(ps.count) || 7;
  for (let i = 1; i <= cnt; i++) {
    const sH = Math.floor(cur / 60), sM = cur % 60;
    const end = cur + dur;
    const eH = Math.floor(end / 60), eM = end % 60;
    slots.push({
      period: i,
      s: `${String(sH).padStart(2,'0')}:${String(sM).padStart(2,'0')}`,
      e: `${String(eH).padStart(2,'0')}:${String(eM).padStart(2,'0')}`
    });
    cur = end + brk;
  }
  return slots;
}

// Keep TIMETABLE_SLOTS_MASTER as alias for backward compatibility
Object.defineProperty(window, 'TIMETABLE_SLOTS_MASTER', { get: () => getPeriodSlots(), configurable: true });


const SB_URL = 'https://dzntiiuyqvkaxqpqzxeh.supabase.co';
const SB_KEY = 'sb_publishable_SePLBF-dsJfx5T6Yvvcuew_vntSr3Vc';
let supabaseClient = null;

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SB_URL, SB_KEY);

    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const email = session.user.email;
        localStorage.setItem('classmanager_email', email);
        if (document.getElementById('login-overlay').classList.contains('show')) {
          onLoginSuccess(email);
        }
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('classmanager_email');
        localStorage.removeItem(STORAGE_KEY);
        const lo = document.getElementById('login-overlay');
        lo.classList.add('show');
        lo.style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
      }
    });

    let session = null;
    try {
      const result = await Promise.race([
        supabaseClient.auth.getSession(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      session = result.data?.session;
    } catch (e) {
      console.warn('getSession timeout/error:', e);
    }
    if (session) {
      const email = session.user.email;
      localStorage.setItem('classmanager_email', email);
      onLoginSuccess(email);
    } else {
      // ไม่มี session จริง → ต้องล็อกอินใหม่ (RLS ต้องใช้ JWT ในการ sync)
      localStorage.removeItem('classmanager_email');
      showLoginOverlay();
    }
  } else {
    // โหลด Supabase ไม่ได้ → ล็อกอินไม่ได้ (กันข้อมูลรั่วเมื่อไม่มี auth)
    showLoginOverlay();
  }
});

function showLoginOverlay() {
  const lo = document.getElementById('login-overlay');
  lo.classList.add('show');
  lo.style.display = 'flex';
}

function onLoginSuccess(email) {
  const lo = document.getElementById('login-overlay');
  lo.classList.remove('show');
  lo.style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';
  initAppState();
  updateUIProfileLabels(email);
  // เช็ค onboarding หลัง sync cloud เสร็จ (กันเข้าใจผิดว่าไม่มีห้องทั้งที่ cloud มีข้อมูล)
  syncBackgroundCloud(email).finally(() => maybeStartOnboarding());
  updateHeaderDate();
  navigateToWebScreen('dashboard');

  setInterval(() => {
    const activeEmail = localStorage.getItem('classmanager_email');
    if (activeEmail && supabaseClient && document.visibilityState === 'visible') {
      syncBackgroundCloud(activeEmail);
    }
  }, 3000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const activeEmail = localStorage.getItem('classmanager_email');
      if (activeEmail && supabaseClient) syncBackgroundCloud(activeEmail);
    }
  });
}

function setLoginStatus(msg, ok) {
  const statusEl = document.getElementById('login-status');
  if (!statusEl) return;
  statusEl.style.color = ok ? 'var(--color-present)' : 'var(--color-absent)';
  statusEl.innerText = msg;
}

function getLoginInputs() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !email.includes('@')) { setLoginStatus('กรุณากรอกอีเมลให้ถูกต้อง', false); return null; }
  if (!password || password.length < 6) { setLoginStatus('รหัสผ่านอย่างน้อย 6 ตัวอักษร', false); return null; }
  if (!supabaseClient) { setLoginStatus('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', false); return null; }
  return { email, password };
}

function setLoginBtnLoading(loading) {
  const btn = document.getElementById('btn-login');
  if (btn) { btn.disabled = loading; btn.style.opacity = loading ? '0.6' : ''; }
}

async function loginWithPassword() {
  const inp = getLoginInputs();
  if (!inp) return;
  setLoginBtnLoading(true);
  setLoginStatus('กำลังเข้าสู่ระบบ...', true);
  const { error } = await supabaseClient.auth.signInWithPassword(inp);
  setLoginBtnLoading(false);
  if (error) {
    const m = (error.message || '').toLowerCase();
    if (m.includes('invalid login')) setLoginStatus('อีเมลหรือรหัสผ่านไม่ถูกต้อง (ถ้ายังไม่มีบัญชี กด "สมัครใช้งานฟรี")', false);
    else setLoginStatus(error.message || 'เข้าสู่ระบบไม่สำเร็จ', false);
    return;
  }
  // SIGNED_IN จะถูกจับใน onAuthStateChange → onLoginSuccess เอง
  setLoginStatus('', true);
}

async function signUpWithPassword() {
  const inp = getLoginInputs();
  if (!inp) return;
  setLoginBtnLoading(true);
  setLoginStatus('กำลังสมัคร...', true);
  const { data, error } = await supabaseClient.auth.signUp(inp);
  setLoginBtnLoading(false);
  if (error) {
    const m = (error.message || '').toLowerCase();
    if (m.includes('already registered') || m.includes('already been')) setLoginStatus('อีเมลนี้มีบัญชีแล้ว — กด "เข้าสู่ระบบ" ได้เลย', false);
    else setLoginStatus(error.message || 'สมัครไม่สำเร็จ', false);
    return;
  }
  if (data && data.session) {
    // ปิด confirm email แล้ว → ได้ session ทันที (onAuthStateChange จะพาเข้า)
    setLoginStatus('สมัครสำเร็จ! กำลังเข้าสู่ระบบ...', true);
  } else {
    // ยังเปิด confirm email อยู่ → ต้องยืนยันในอีเมลก่อน
    setLoginStatus('สมัครสำเร็จ — โปรดยืนยันลิงก์ในอีเมลก่อนเข้าใช้งาน', true);
  }
}

function togglePasswordVisibility() {
  const input = document.getElementById('login-password');
  const icon = document.querySelector('#btn-toggle-pw i');
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  if (icon) icon.className = show ? 'hgi-stroke hgi-view-off' : 'hgi-stroke hgi-view';
}

function loginWithGoogle() {
  if (!supabaseClient) return;
  const redirectTo = window.location.protocol === 'file:'
    ? 'https://testapp-psi-seven.vercel.app/'
    : window.location.origin + '/';
  supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
}

// ==================== UTILITIES ====================
function getNowDate() {
  return mockDateTimeString ? new Date(mockDateTimeString) : new Date();
}

function getTodayString(d) {
  const dt = d || getNowDate();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function updateHeaderDate() {
  const now = getNowDate();
  const thaiDay = DAY_NAMES[now.getDay()];
  const thaiMonth = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'][now.getMonth()];
  const thaiYear = now.getFullYear() + 543;
  const el = document.getElementById('web-header-date');
  if (el) el.innerText = `${thaiDay}ที่ ${now.getDate()} ${thaiMonth} พ.ศ. ${thaiYear}`;
}


function updateProfileImages() {
  const imgSrc = appState.profileImageBase64 || 'logo.png';
  const els = ['sidebar-profile-img', 'settings-profile-img'];
  els.forEach(id => {
    const img = document.getElementById(id);
    if (img) img.src = imgSrc;
  });
}

function handleProfileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('กรุณาเลือกไฟล์รูปภาพ', 'warning');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    // ย่อรูปเป็นสี่เหลี่ยมจัตุรัส ≤256px + บีบเป็น JPEG กันข้อมูล sync บวม (base64 เล็กลงมาก)
    const img = new Image();
    img.onload = function() {
      const MAX = 256;
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = MAX;
      canvas.height = MAX;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, side, side, 0, 0, MAX, MAX);
      try {
        appState.profileImageBase64 = canvas.toDataURL('image/jpeg', 0.82);
      } catch (err) {
        appState.profileImageBase64 = e.target.result; // fallback (เช่นรูปมี CORS)
      }
      saveState();
      updateProfileImages();
      showToast('อัปเดตรูปโปรไฟล์แล้ว', 'success');
    };
    img.onerror = function() { showToast('เปิดรูปไม่สำเร็จ', 'error'); };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = ''; // ให้เลือกรูปเดิมซ้ำได้
}

function updateUIProfileLabels(email) {
  const fallback = email ? (() => { const n = email.split('@')[0]; return `ครู${n.charAt(0).toUpperCase() + n.slice(1)}`; })() : 'คุณครู';
  const displayName = (appState.teacherName || '').trim() || fallback;
  const els = ['sidebar-profile-name','web-settings-profile-name'];
  els.forEach(id => { const e = document.getElementById(id); if (e) e.innerText = displayName; });
  const emailEls = ['sidebar-profile-email','web-settings-profile-email'];
  emailEls.forEach(id => { const e = document.getElementById(id); if (e) e.innerText = email || ''; });
  const nameInput = document.getElementById('settings-name-input');
  if (nameInput) nameInput.value = (appState.teacherName || '').trim();
  updateProfileImages();
}

function saveTeacherName(val) {
  appState.teacherName = (val || '').trim();
  saveState();
  updateUIProfileLabels(localStorage.getItem('classmanager_email'));
  showToast('บันทึกชื่อแล้ว', 'success', 1000);
}

// ========== เปลี่ยนรหัสผ่าน ==========
function openChangePasswordModal() {
  document.getElementById('cp-new').value = '';
  document.getElementById('cp-confirm').value = '';
  document.getElementById('cp-status').innerText = '';
  document.getElementById('modal-change-password').classList.add('show');
}
function closeChangePasswordModal() { document.getElementById('modal-change-password').classList.remove('show'); }

async function submitChangePassword() {
  const p1 = document.getElementById('cp-new').value;
  const p2 = document.getElementById('cp-confirm').value;
  const st = document.getElementById('cp-status');
  const set = (m, ok) => { st.style.color = ok ? 'var(--color-present)' : 'var(--color-absent)'; st.innerText = m; };
  if (!p1 || p1.length < 6) return set('รหัสผ่านอย่างน้อย 6 ตัวอักษร', false);
  if (p1 !== p2) return set('รหัสผ่านใหม่ไม่ตรงกัน', false);
  if (!supabaseClient) return set('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', false);
  const btn = document.getElementById('cp-submit');
  if (btn) btn.disabled = true;
  set('กำลังบันทึก...', true);
  const { error } = await supabaseClient.auth.updateUser({ password: p1 });
  if (btn) btn.disabled = false;
  if (error) { set(error.message || 'เปลี่ยนรหัสไม่สำเร็จ', false); return; }
  set('เปลี่ยนรหัสผ่านสำเร็จ', true);
  showToast('เปลี่ยนรหัสผ่านแล้ว 🎉', 'success', 1500);
  setTimeout(closeChangePasswordModal, 900);
}

// ==================== NAVIGATION ====================
function navigateToWebScreen(screenId) {
  // เมนู 'excel' ถูกตัดออกแล้ว (นำเข้าตารางสอนย้ายไปหน้าตารางสอน) — กัน state เก่าที่ค้าง
  if (screenId === 'excel') screenId = 'timetable';

  // ถ้ากำลังอยู่หน้าเช็คชื่อ (overlay) แล้วกดเมนู sidebar → ปิด overlay ก่อน
  const swipeOverlay = document.getElementById('swipe-overlay');
  if (swipeOverlay && swipeOverlay.classList.contains('show')) {
    swipeOverlay.classList.remove('show');
  }

  appState.activeWebScreen = screenId;
  saveStateLocalOnly(false);

  const screens = ['dashboard','classrooms','students','timetable','attendance','reports','settings'];
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


function renderWebDashboard() {
  const now = getNowDate();
  const viewDate = homeSelectedDate || now;
  const isToday = getTodayString(viewDate) === getTodayString(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const viewDow = viewDate.getDay();
  const activeWeek = appState.timetableWeek || 'A';

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
    const dc = DAY_CARD_COLORS[viewDow] || DAY_CARD_COLORS[3];
    dateCard.style.background = dc.grad;
    dateCard.style.boxShadow = `0 6px 18px ${dc.shadow}`;
  }

  // ---- Build slots for view day ----
  const viewSlots = appState.timetable
    .filter(t => t.dow === viewDow && (t.week === undefined || t.week === activeWeek))
    .map(t => {
      const slot = TIMETABLE_SLOTS_MASTER.find(s => s.period === t.period) || { s:'08:30', e:'09:20' };
      const [sH,sM] = slot.s.split(':').map(Number);
      const [eH,eM] = slot.e.split(':').map(Number);
      return { ...t, startMin: sH*60+sM, endMin: eH*60+eM, slotStart: slot.s, slotEnd: slot.e };
    })
    .sort((a,b) => a.startMin - b.startMin);

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
  if (titleEl) titleEl.innerText = isToday ? 'ตารางสอนวันนี้' : `${DAY_NAMES[viewDow]}ที่ ${viewDate.getDate()} ${MONTH_NAMES[viewDate.getMonth()]}`;

  // ---- Next class card (today only) ----
  const nextArea = document.getElementById('home-next-card-area');
  if (nextArea) {
    if (isToday) {
      const today = getTodayString(now);
      const timePassed = viewSlots.length > 0 && viewSlots.every(t => nowMin >= t.endMin);
      // เช็คว่าทุกคาบที่ผ่านเวลาแล้วถูกเช็คชื่อครบหรือยัง
      const hasUnchecked = viewSlots.some(t => {
        if (nowMin < t.endMin) return false;
        const cls = appState.classes.find(x => x.id === t.classId);
        if (!cls) return true;
        const att = (cls.attendance || {})[today];
        return !att || Object.keys(att).length < cls.students.length;
      });
      const allDone = timePassed && !hasUnchecked;
      const ongoing = viewSlots.find(t => nowMin >= t.startMin && nowMin < t.endMin);
      const nextSlot = viewSlots.find(t => nowMin < t.startMin);

      if (viewSlots.length === 0) {
        nextArea.innerHTML = `<div class="home-next-card is-done" style="background:#f2f2f7;border:1.5px solid var(--border-color);padding:14px 18px;"><div class="next-subject" style="color:var(--text-muted);font-size:0.95rem;">ไม่มีตารางสอนวันนี้</div></div>`;
      } else if (allDone) {
        nextArea.innerHTML = `<div class="home-next-card is-done" style="padding:12px 18px;flex-direction:row;align-items:center;gap:10px;"><div style="font-size:1.5rem;">✅</div><div><div class="next-subject" style="font-size:0.95rem;">เสร็จสิ้นทุกคาบแล้ว!</div><div class="next-meta" style="font-size:0.75rem;margin-top:2px;">ยอดเยี่ยมครับ คุณครู</div></div></div>`;
      } else if (ongoing) {
        const c = appState.classes.find(x => x.id === ongoing.classId);
        const attToday = c && (c.attendance || {})[today];
        const checked = attToday && c && Object.keys(attToday).length >= c.students.length;
        nextArea.innerHTML = `<div class="home-next-card is-ongoing" style="padding:12px 18px;" onclick="openSwipeAttendance('${ongoing.classId}')"><div class="next-tag">🔴 กำลังสอน · คาบ ${ongoing.period}</div><div class="next-subject" style="font-size:1rem;">${ongoing.subject} <span style="font-weight:600;font-size:0.8rem;opacity:0.85;">· ${ongoing.className}</span></div><button class="next-action-btn" style="padding:5px 12px;font-size:0.75rem;margin-top:4px;" onclick="event.stopPropagation();openSwipeAttendance('${ongoing.classId}')"><i class="hgi-stroke hgi-task-done-01"></i> ${checked ? '✓ เช็คแล้ว' : 'เช็คชื่อ'}</button></div>`;
      } else if (nextSlot) {
        nextArea.innerHTML = `<div class="home-next-card is-upcoming" style="padding:13px 18px;gap:5px;" onclick="openSwipeAttendance('${nextSlot.classId}')"><div class="next-tag">คาบถัดไป · ${nextSlot.slotStart} น.</div><div class="next-subject" style="font-size:1rem;">${nextSlot.subject} <span style="font-weight:600;font-size:0.8rem;opacity:0.85;">· ${nextSlot.className}</span></div></div>`;
      } else {
        nextArea.innerHTML = '';
      }
    } else {
      nextArea.innerHTML = '';
    }
  }

  // ---- Unchecked warning (today only) ----
  const uncheckedEl = document.getElementById('home-unchecked-card');
  if (uncheckedEl) {
    if (isToday) {
      const today = getTodayString(now);
      const unchecked = viewSlots.filter(t => {
        if (nowMin < t.endMin) return false;
        const cls = appState.classes.find(x => x.id === t.classId);
        if (!cls) return true;
        const att = (cls.attendance || {})[today];
        return !att || Object.keys(att).length < cls.students.length;
      });
      if (unchecked.length > 0) {
        uncheckedEl.style.display = 'flex';
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

  // ---- Schedule list ----
  const listEl = document.getElementById('home-schedule-list');
  const countEl = document.getElementById('home-today-count');
  if (!listEl) return;
  if (countEl) countEl.innerText = `${viewSlots.length} คาบ`;

  if (viewSlots.length === 0) {
    listEl.innerHTML = `<div class="empty-state" style="padding:24px;"><i class="hgi-stroke hgi-calendar-remove-01"></i><p>ไม่มีตารางสอน</p></div>`;
    return;
  }

  const dateKey = getTodayString(viewDate);
  listEl.innerHTML = '';
  viewSlots.forEach(t => {
    const c = appState.classes.find(x => x.id === t.classId);
    const attData = c && (c.attendance || {})[dateKey];
    const checked = attData && c && Object.keys(attData).length >= c.students.length;
    const isOngoing = isToday && nowMin >= t.startMin && nowMin < t.endMin;
    const isPast = isToday && nowMin >= t.endMin;

    let dotClass = 'unchecked', badgeHtml = '';
    if (isOngoing) { dotClass = 'ongoing'; badgeHtml = `<span class="home-schedule-badge" style="background:var(--color-leave-bg);color:var(--color-leave);">● สอน</span>`; }
    else if (checked) { dotClass = 'present'; badgeHtml = `<span class="home-schedule-badge" style="background:var(--primary-light);color:var(--primary);">✓ เช็คแล้ว</span>`; }
    else if (isPast) { dotClass = 'absent'; badgeHtml = `<span class="home-schedule-badge" style="background:var(--color-absent-bg);color:var(--color-absent);">!</span>`; }

    const row = document.createElement('div');
    row.className = 'home-schedule-row' + (isOngoing ? ' is-now' : '');
    // hover = สีประจำห้อง, กดแล้วเปิดเช็คชื่อของวันที่กำลังดู
    row.style.setProperty('--row-hover', getClassColor(t.classId).bg);
    row.onclick = () => openSwipeAttendance(t.classId, viewDate);
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
  const activeWeek = appState.timetableWeek || 'A';
  const classDoWs = new Set(appState.timetable.filter(t => t.week === undefined || t.week === activeWeek).map(t => t.dow));

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
function renderWebClassrooms() {
  const container = document.getElementById('web-classrooms-grid');
  if (!container) return;
  container.innerHTML = '';
  if (appState.classes.length === 0) {
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i class="hgi-stroke hgi-school" style="font-size:3rem;"></i><p>ยังไม่มีห้องเรียน เริ่มสร้างวิชาสอนแรกของคุณได้เลย</p><button class="btn btn-primary" onclick="openClassModal()" style="margin-top:16px;display:inline-flex;align-items:center;gap:8px;"><i class="hgi-stroke hgi-add-01"></i> เพิ่มห้องเรียน</button></div>';
    return;
  }
  appState.classes.forEach(c => {
    const pct = calculateAttendancePercentage(c);
    const pctColor = pct >= 80 ? 'var(--color-present)' : pct >= 60 ? 'var(--color-late-text)' : 'var(--color-absent)';
    const col = getClassColor(c.id);
    const card = document.createElement('div');
    card.className = 'card ck-class-card';
    card.style.cssText = `padding:0;overflow:hidden;gap:0;--cc:${col.text};`;
    card.innerHTML = `
      <div style="height:5px;background:${col.text};"></div>
      <div style="padding:16px 18px 14px;">
        <div>
          <strong style="font-size:1.05rem;font-weight:700;display:flex;align-items:center;gap:9px;line-height:1.2;"><span class="ck-class-dot" style="width:11px;height:11px;border-radius:50%;background:${col.text};flex-shrink:0;"></span>${c.subject}</strong>
          <span class="subtitle ck-class-sub" style="display:block;">${c.className} · <span style="font-weight:700;color:var(--text-main);">${c.students.length}</span> คน</span>
        </div>
      </div>
      <div style="padding:0 18px 14px;text-align:center;">
        <button class="btn ck-checkin-btn" style="display:inline-flex;padding:10px 40px;font-size:0.9rem;justify-content:center;border-radius:var(--radius-sm);background:${col.text};color:#fff;border:none;font-weight:700;" onclick="openSwipeAttendance('${c.id}')">
          <i class="hgi-stroke hgi-task-done-01"></i> เช็คชื่อ
        </button>
      </div>
      <div class="desktop-only-flex" style="gap:1px;border-top:1px solid var(--border-color);">
        <button class="ck-card-btn" style="border:none;border-radius:0;" onclick="openClassModal('${c.id}')"><i class="hgi-stroke hgi-pencil-edit-02"></i><span>แก้ไข</span></button>
        <button class="ck-card-btn danger" style="border:none;border-radius:0;" onclick="deleteClassById('${c.id}')"><i class="hgi-stroke hgi-delete-02"></i><span>ลบ</span></button>
        <button class="ck-card-btn" style="border:none;border-radius:0;" onclick="triggerDirectClassExcelImport('${c.id}')"><i class="hgi-stroke hgi-file-import"></i><span>นำเข้า นร.</span></button>
        <button class="ck-card-btn" style="border:none;border-radius:0;" onclick="viewWebClassReport('${c.id}')"><i class="hgi-stroke hgi-pie-chart"></i><span>สถิติ</span></button>
      </div>`;
    container.appendChild(card);
  });
}

function startWebClassroomsCheckin(classId) {
  currentClassId = classId;
  navigateToWebScreen('attendance');
}

function manageStudentsFromCard(classId) {
  window.__forceStudentClassId = classId;
  navigateToWebScreen('students');
}

function viewWebClassReport(classId) {
  currentClassId = classId;
  navigateToWebScreen('reports');
  document.getElementById('web-reports-selection-view').style.display = 'none';
  document.getElementById('web-reports-detail-view').style.display = 'block';
  const c = appState.classes.find(x => x.id === classId);
  if (c) {
    const repCol = getClassColor(c.id);
    document.getElementById('web-rep-detail-class-title').innerHTML =
      `<span style="width:12px;height:12px;border-radius:50%;background:${repCol.text};flex-shrink:0;"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">${c.subject} (${c.className})</span>`;
  }
  repSelectedDate = null;
  switchWebReportTab('today');
}

// ==================== WEB STUDENTS ====================
function renderWebStudents() {
  const container = document.getElementById('web-students-list');
  const filter = document.getElementById('web-student-class-filter');
  const contentArea = document.getElementById('web-students-content-area');
  const emptyState = document.getElementById('web-students-empty-state');
  
  if (!container || !filter) return;
  
  // Always rebuild filter options to reflect added/deleted classes
  const currentVal = window.__forceStudentClassId || filter.value;
  window.__forceStudentClassId = null; // Consume the forced value
  let optionsHtml = '<option value="">-- กรุณาเลือกห้องเรียน --</option>';
  appState.classes.forEach(c => {
    optionsHtml += `<option value="${c.id}">${c.subject} (${c.className})</option>`;
  });
  filter.innerHTML = optionsHtml;
  filter.value = currentVal;

  // Toggle empty state
  if (!filter.value) {
    contentArea.style.display = 'none';
    emptyState.style.display = 'block';
    currentClassId = null;
    return;
  } else {
    contentArea.style.display = 'block';
    emptyState.style.display = 'none';
    currentClassId = filter.value;
  }

  container.innerHTML = '';
  const search = (document.getElementById('web-student-search-input').value || '').trim().toLowerCase();
  
  const targetClass = appState.classes.find(c => c.id === filter.value);
  if (!targetClass) return;

  let filteredStudents = [];
  targetClass.students.forEach(s => {
    if (search && !s.name.toLowerCase().includes(search) && !(s.studentCode || '').toLowerCase().includes(search)) return;
    filteredStudents.push(s);
  });

  document.getElementById('web-students-count-label').innerText = `พบ ${filteredStudents.length} คน`;

  filteredStudents.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:center;font-weight:700;">${s.no || '-'}</td>
      <td style="text-align:center;"><input class="d-code-input" type="text" value="${String(s.studentCode||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}" placeholder="-" onchange="setStudentCodeInline('${targetClass.id}','${s.id}',this.value)"></td>
      <td style="font-weight:700;">${s.name}</td>
      <td style="color:var(--text-muted);font-size:0.8rem;">${s.comment || '-'}</td>
      <td style="text-align:center;">
        <button class="btn" title="แก้ไขข้อมูล" style="padding:4px 8px;font-size:0.72rem;" onclick="currentClassId='${targetClass.id}';openStudentDetailModal('${s.id}','${targetClass.id}')"><i class="hgi-stroke hgi-edit-02"></i></button>
        <button class="btn btn-danger" style="padding:4px 8px;font-size:0.72rem;" onclick="currentClassId='${targetClass.id}';deleteStudent('${s.id}')"><i class="hgi-stroke hgi-delete-02"></i></button>
      </td>`;
    container.appendChild(tr);
  });
}

// ==================== WEB TIMETABLE ====================
// สีประจำห้อง (ClickUp-style) — แต่ละห้องได้สีคงที่ตามลำดับ ช่วยกวาดตาแยกห้องในตารางสอน
const TT_CLASS_COLORS = [
  { bg:'#f0fdf4', border:'#bbf7d0', text:'#16a34a' }, // เขียว
  { bg:'#eff6ff', border:'#bfdbfe', text:'#2563eb' }, // น้ำเงิน
  { bg:'#f5f3ff', border:'#ddd6fe', text:'#7c3aed' }, // ม่วง
  { bg:'#fffbeb', border:'#fde68a', text:'#d97706' }, // อำพัน
  { bg:'#fdf2f8', border:'#fbcfe8', text:'#db2777' }, // ชมพู
  { bg:'#f0fdfa', border:'#99f6e4', text:'#0d9488' }, // เขียวน้ำทะเล
  { bg:'#fff7ed', border:'#fed7aa', text:'#ea580c' }, // ส้ม
  { bg:'#eef2ff', border:'#c7d2fe', text:'#4f46e5' }, // คราม
  { bg:'#fef2f2', border:'#fecaca', text:'#dc2626' }, // แดง
  { bg:'#fefce8', border:'#fef08a', text:'#ca8a04' }, // เหลือง
  { bg:'#f7fee7', border:'#d9f99d', text:'#65a30d' }, // เขียวไลม์
  { bg:'#ecfdf5', border:'#a7f3d0', text:'#059669' }, // มรกต
  { bg:'#ecfeff', border:'#a5f3fc', text:'#0891b2' }, // ฟ้าเทอร์คอยซ์
  { bg:'#f0f9ff', border:'#bae6fd', text:'#0284c7' }, // ฟ้าคราม
  { bg:'#faf5ff', border:'#e9d5ff', text:'#9333ea' }, // ม่วงองุ่น
  { bg:'#fdf4ff', border:'#f5d0fe', text:'#c026d3' }, // บานเย็น
  { bg:'#fff1f2', border:'#fecdd3', text:'#e11d48' }, // กุหลาบ
  { bg:'#fef7ed', border:'#fddcaa', text:'#b45309' }, // น้ำตาล
  { bg:'#f8fafc', border:'#e2e8f0', text:'#475569' }, // เทาหิน
  { bg:'#f0fdf4', border:'#bbf7d0', text:'#15803d' }, // เขียวเข้ม
  // --- ชุดสีสด/สว่าง (index 20-29) ต่อท้าย ห้ามแทรกกลาง ไม่งั้น index เดิมเพี้ยน ---
  { bg:'#fefce8', border:'#fef08a', text:'#eab308' }, // 20 เหลืองสด
  { bg:'#f7fee7', border:'#d9f99d', text:'#84cc16' }, // 21 ไลม์สด
  { bg:'#fefce8', border:'#fef08a', text:'#facc15' }, // 22 เหลืองสด (สว่าง)
  { bg:'#fffbeb', border:'#fde68a', text:'#fbbf24' }, // 23 เหลืองอำพัน (อุ่น)
  { bg:'#ecfeff', border:'#a5f3fc', text:'#06b6d4' }, // 24 ฟ้าเทอร์คอยซ์สด
  { bg:'#f0f9ff', border:'#bae6fd', text:'#0ea5e9' }, // 25 ฟ้าสด
  { bg:'#eef2ff', border:'#c7d2fe', text:'#6366f1' }, // 26 ครามสด
  { bg:'#f5f3ff', border:'#ddd6fe', text:'#8b5cf6' }, // 27 ม่วงสด
  { bg:'#fdf4ff', border:'#f5d0fe', text:'#d946ef' }, // 28 บานเย็นสด
  { bg:'#fdf2f8', border:'#fbcfe8', text:'#ec4899' }, // 29 ชมพูสด
];
// ลำดับแสดงผลใน color picker — 30 สี (2 แถว × 15 เต็มความกว้าง) ไล่เฉดสีแบบรุ้ง
const TT_COLOR_ORDER = [
  8, 6, 17, 3, 9, 20, 22, 23, 10, 21, 0, 19, 11, 5, 24,  // แดง→ส้ม→เหลือง(9,20,22,23)→เขียว→มรกต
  12, 25, 13, 1, 26, 7, 27, 2, 14, 28, 15, 4, 29, 16, 18, // ฟ้า→น้ำเงิน→ม่วง→ชมพู→เทา
];
function getClassColor(classId) {
  const idx = appState.classes.findIndex(c => c.id === classId);
  const c = appState.classes[idx];
  // ใช้สีที่ครูเลือกไว้ (colorIndex) ก่อน ถ้าไม่มีค่อย fallback เป็นสีตามลำดับห้อง
  const ci = (c && typeof c.colorIndex === 'number') ? c.colorIndex : (idx < 0 ? 0 : idx);
  const n = TT_CLASS_COLORS.length;
  return TT_CLASS_COLORS[((ci % n) + n) % n];
}

// สีประจำวันไทย (พื้นอ่อน + ตัวอักษรเข้ม) — ใช้ร่วมทั้งเดสก์ท็อป มือถือ และหน้าหลัก
const DAY_TINT = {
  1: { bg:'#fef9c3', text:'#eab308' }, // จันทร์ เหลือง
  2: { bg:'#fce7f3', text:'#be185d' }, // อังคาร ชมพู
  3: { bg:'#dcfce7', text:'#15803d' }, // พุธ เขียว
  4: { bg:'#ffedd5', text:'#c2410c' }, // พฤหัสบดี ส้ม
  5: { bg:'#dbeafe', text:'#1d4ed8' }, // ศุกร์ ฟ้า
};

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
function loadWebAttendanceMatrix() {
  const select = document.getElementById('web-attendance-class-select');
  if (!select) return;
  const curVal = select.value;
  select.innerHTML = '';
  appState.classes.forEach(c => {
    select.innerHTML += `<option value="${c.id}" ${curVal===c.id?'selected':''}>${c.subject} (${c.className})</option>`;
  });
  if (!select.value && appState.classes.length > 0) select.value = appState.classes[0].id;
  const c = appState.classes.find(x => x.id === select.value);
  const table = document.getElementById('web-attendance-matrix-table');
  if (!c || c.students.length === 0) { table.innerHTML = '<tr><td class="empty-state">ไม่มีข้อมูล</td></tr>'; return; }
  const dates = Object.keys(c.attendance || {}).sort().slice(-10);
  let html = '<thead><tr><th>ชื่อ</th>';
  dates.forEach(d => { html += `<th style="text-align:center;font-size:0.65rem;">${d.slice(5)}</th>`; });
  html += '</tr></thead><tbody>';
  c.students.forEach(s => {
    html += `<tr><td style="font-weight:700;font-size:0.78rem;white-space:nowrap;">${s.name}</td>`;
    dates.forEach(d => {
      const st = (c.attendance[d] || {})[s.id] || '';
      const colors = { present:'var(--color-present)', late:'var(--color-late)', absent:'var(--color-absent)', leave:'var(--color-leave)' };
      const bg = colors[st] || '#e5e5ea';
      html += `<td style="text-align:center;"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${bg};"></span></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  table.innerHTML = html;
}

// ==================== REPORTS ====================
function renderWebReports() {
  document.getElementById('web-reports-selection-view').style.display = 'block';
  document.getElementById('web-reports-detail-view').style.display = 'none';
  const list = document.getElementById('web-reports-class-list');
  list.innerHTML = '';
  if (appState.classes.length === 0) {
    list.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">ไม่มีห้องเรียน</div>';
    return;
  }
  appState.classes.forEach(c => {
    const pct = calculateAttendancePercentage(c);
    const col = getClassColor(c.id);
    list.innerHTML += `<div class="card" style="padding:20px;cursor:pointer;border-top:4px solid ${col.text};" onclick="viewWebClassReport('${c.id}')"><strong style="font-size:1.05rem;">${c.subject}</strong><span class="subtitle">${c.className} · <span style="font-weight:700;color:var(--text-main);">${c.students.length}</span> คน</span><div class="progress-container" style="margin-top:8px;"><div class="progress-label-row"><span>เข้าเรียน</span><span style="font-weight:800;color:${col.text};">${pct}%</span></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%;background:${col.text};"></div></div></div></div>`;
  });
}

function goBackToWebReportsSelection() {
  document.getElementById('web-reports-selection-view').style.display = 'block';
  document.getElementById('web-reports-detail-view').style.display = 'none';
}

function switchWebReportTab(tab) {
  currentWebReportTab = tab;
  document.querySelectorAll('.report-tab-item').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
  ['today','weekly','term','overall'].forEach(t => {
    const el = document.getElementById(`web-rep-content-${t}`);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'today') renderTodayReport();
  else if (tab === 'weekly') requestAnimationFrame(() => renderWeeklyReport());
  else if (tab === 'term') renderTermReport();
  else if (tab === 'overall') renderOverallReport();
}

function renderTodayReport() {
  const c = appState.classes.find(x => x.id === currentClassId);
  if (!c) return;
  const dateObj = repSelectedDate || getNowDate();
  const today = getTodayString(dateObj);
  const isToday = today === getTodayString();
  const rec = (c.attendance || {})[today] || {};
  let p=0,l=0,a=0,lv=0;
  c.students.forEach(s => {
    const st = rec[s.id];
    if (st === 'present') p++; else if (st === 'late') l++; else if (st === 'absent') a++; else if (st === 'leave') lv++;
  });
  const total = p+l+a+lv;
  const pct = total > 0 ? Math.round((p+l) / total * 100) : 0;
  const MONTHS_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const labelFull = `${dateObj.getDate()} ${MONTHS_FULL[dateObj.getMonth()]} ${dateObj.getFullYear()+543}`;
  const labelShort = `${dateObj.getDate()} ${MONTHS_SHORT[dateObj.getMonth()]}`;
  document.getElementById('web-rep-today-date-label').innerText = isToday ? `${labelFull}` : labelFull;

  // เช็คตารางสอนก่อน: ถ้าวันนั้นห้องนี้ไม่มีคาบ → "ไม่มีคาบสอน" (แม้จะมีข้อมูลเช็คชื่อค้าง),
  // ถ้ามีคาบแต่ยังไม่เช็ค → "ยังไม่ได้เช็คชื่อ" (กันสับสนกับ 0/0% หรือแสดงข้อมูลผิดวัน)
  const progressWrap = document.getElementById('web-rep-today-pct').closest('.progress-container');
  const hasPeriod = appState.timetable.some(t => t.classId === c.id && t.dow === dateObj.getDay());
  if (!hasPeriod || total === 0) {
    const noPeriod = !hasPeriod;
    const icon = noPeriod ? 'hgi-calendar-remove-01' : 'hgi-task-01';
    const msg  = noPeriod ? 'ไม่มีคาบสอน' : 'ยังไม่ได้เช็คชื่อ';
    const sub  = noPeriod ? 'วันนี้ห้องนี้ไม่มีตารางสอน' : 'ยังไม่ได้บันทึกการเช็คชื่อของวันนี้';
    document.getElementById('web-rep-today-pills').innerHTML =
      `<div style="width:100%;text-align:center;color:var(--text-muted);padding:18px 8px;">
        <i class="hgi-stroke ${icon}" style="font-size:2.1rem;display:block;margin-bottom:8px;opacity:0.55;"></i>
        <div style="font-weight:800;font-size:0.98rem;color:var(--text-main);">${msg}</div>
        <div style="font-size:0.8rem;margin-top:3px;">${sub}</div>
      </div>`;
    if (progressWrap) progressWrap.style.display = 'none';
    const badgeEl = document.getElementById('web-rep-today-status-badge');
    badgeEl.innerHTML = `<i class="hgi-stroke ${icon}"></i> ${msg}`;
    badgeEl.style.background = '#f2f2f7';
    badgeEl.style.color = 'var(--text-muted)';
    document.getElementById('web-rep-today-abnormal-card').style.display = 'none';
    return;
  }
  if (progressWrap) progressWrap.style.display = '';

  document.getElementById('web-rep-today-pills').innerHTML = `
    <span class="summary-pill" style="background:var(--color-present-bg);color:var(--color-present);">มา ${p}</span>
    <span class="summary-pill" style="background:var(--color-late-bg);color:var(--color-late-text);">สาย ${l}</span>
    <span class="summary-pill" style="background:var(--color-absent-bg);color:var(--color-absent);">ขาด ${a}</span>
    <span class="summary-pill" style="background:var(--color-leave-bg);color:var(--color-leave);">ลา ${lv}</span>`;
  // อนิเมชัน: บาร์วิ่ง 0 → ค่าจริง + ตัวเลข % นับขึ้น (เหมือนแท็บภาพรวม)
  const todayPctEl = document.getElementById('web-rep-today-pct');
  const todayBar = document.getElementById('web-rep-today-progress');
  todayBar.style.transition = 'none';
  todayBar.style.width = '0%';
  todayPctEl.innerText = '0%';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    todayBar.style.transition = 'width 0.9s cubic-bezier(0.22,1,0.36,1)';
    todayBar.style.width = `${pct}%`;
    const duration = 900, startTime = performance.now();
    (function tick(now){ const t=Math.min((now-startTime)/duration,1); const eased=1-Math.pow(1-t,3); todayPctEl.innerText=Math.round(eased*pct)+'%'; if(t<1)requestAnimationFrame(tick); })(performance.now());
  }));
  const badge = document.getElementById('web-rep-today-status-badge');
  if (a === 0) { badge.innerText = '✅ ปกติ ไม่มีขาดเรียน'; badge.style.background = 'var(--color-present-bg)'; badge.style.color = 'var(--color-present)'; }
  else { badge.innerText = `⚠️ มีขาดเรียน ${a} คน`; badge.style.background = 'var(--color-absent-bg)'; badge.style.color = 'var(--color-absent)'; }

  const abnormalCard = document.getElementById('web-rep-today-abnormal-card');
  const abnormalList = document.getElementById('web-rep-today-abnormal-list');
  const absentStudents = c.students.filter(s => rec[s.id] === 'absent' || rec[s.id] === 'late');
  if (absentStudents.length > 0) {
    abnormalCard.style.display = 'block';
    abnormalList.innerHTML = absentStudents.map(s => `<div style="display:flex;align-items:center;gap:8px;padding:8px;background:${rec[s.id]==='absent'?'var(--color-absent-bg)':'var(--color-late-bg)'};border-radius:8px;font-size:0.82rem;font-weight:700;color:${rec[s.id]==='absent'?'var(--color-absent)':'var(--color-late-text)'}"><i class="hgi-stroke hgi-user"></i> ${s.name} — ${rec[s.id]==='absent'?'ขาด':'สาย'}</div>`).join('');
  } else { abnormalCard.style.display = 'none'; }
}

// ========== REPORT DATE CALENDAR PICKER ==========
function toggleRepCalendar() {
  const popup = document.getElementById('rep-calendar-popup');
  if (!popup) return;
  if (popup.style.display === 'none' || !popup.style.display) {
    const d = repSelectedDate || getNowDate();
    repCalViewYear = d.getFullYear();
    repCalViewMonth = d.getMonth();
    renderRepCalendar();
    popup.style.display = 'block';
    setTimeout(() => document.addEventListener('click', closeRepCalOnOutside), 10);
  } else {
    closeRepCalendar();
  }
}

function closeRepCalendar() {
  const popup = document.getElementById('rep-calendar-popup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', closeRepCalOnOutside);
}

function closeRepCalOnOutside(e) {
  const popup = document.getElementById('rep-calendar-popup');
  const btn = document.getElementById('rep-date-btn');
  if (btn && btn.contains(e.target)) return;
  if (popup && !popup.contains(e.target)) closeRepCalendar();
}

function renderRepCalendar() {
  const popup = document.getElementById('rep-calendar-popup');
  if (!popup) return;
  const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const today = getNowDate();
  const todayStr = getTodayString(today);
  const selectedStr = repSelectedDate ? getTodayString(repSelectedDate) : todayStr;
  const firstDay = new Date(repCalViewYear, repCalViewMonth, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(repCalViewYear, repCalViewMonth + 1, 0).getDate();
  const thaiYear = repCalViewYear + 543;

  let html = `<div class="cal-header">
    <button class="cal-nav-btn" onclick="repCalNavMonth(-1);event.stopPropagation();"><i class="hgi-stroke hgi-arrow-left-01"></i></button>
    <span class="cal-header-title">${thaiMonths[repCalViewMonth]} ${thaiYear}</span>
    <button class="cal-nav-btn" onclick="repCalNavMonth(1);event.stopPropagation();"><i class="hgi-stroke hgi-arrow-right-01"></i></button>
  </div><div class="cal-grid">`;
  ['อา','จ','อ','พ','พฤ','ศ','ส'].forEach(d => { html += `<div class="cal-dow">${d}</div>`; });
  for (let i = 0; i < startDow; i++) html += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dObj = new Date(repCalViewYear, repCalViewMonth, d);
    const dStr = getTodayString(dObj);
    const isWknd = dObj.getDay() === 0 || dObj.getDay() === 6;
    const isTdy = dStr === todayStr;
    const isSel = dStr === selectedStr && !isTdy;
    let cls = 'cal-day';
    if (isTdy) cls += ' today';
    else if (isSel) cls += ' selected';
    if (isWknd && !isTdy && !isSel) cls += ' weekend';
    html += `<div class="${cls}" onclick="selectRepCalDate(${repCalViewYear},${repCalViewMonth},${d});event.stopPropagation();">${d}</div>`;
  }
  html += `</div><button class="cal-today-btn" onclick="selectRepCalToday();event.stopPropagation();">วันนี้</button>`;
  popup.innerHTML = html;
}

function repCalNavMonth(delta) {
  repCalViewMonth += delta;
  if (repCalViewMonth > 11) { repCalViewMonth = 0; repCalViewYear++; }
  if (repCalViewMonth < 0) { repCalViewMonth = 11; repCalViewYear--; }
  renderRepCalendar();
}

function selectRepCalDate(y, m, d) {
  repSelectedDate = new Date(y, m, d);
  closeRepCalendar();
  renderTodayReport();
}

function selectRepCalToday() {
  repSelectedDate = null;
  closeRepCalendar();
  renderTodayReport();
}

function renderWeeklyReport() {
  const c = appState.classes.find(x => x.id === currentClassId);
  if (!c) return;
  const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const DOW_TH = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
  const today = getTodayString();
  // แต่ละวันที่เช็คชื่อ = 1 คาบ (report รายคาบ ไม่รวมเป็นสัปดาห์)
  const sessions = Object.keys(c.attendance || {}).filter(d => d <= today).sort();

  // นิยามเดียวทั้งระบบ: เฉพาะ "ขาด" หักเวลาเรียน — สาย/ลา นับเป็นมา
  // คนที่ยังไม่ได้เช็ค (ไม่มีข้อมูล) = ไม่นับ (หารเฉพาะคนที่เช็คจริงในคาบนั้น)
  const statDay = d => {
    let absent=0, late=0, leave=0, checked=0;
    c.students.forEach(s => {
      const st=(c.attendance[d]||{})[s.id];
      if(!st) return; // ไม่มีข้อมูล = ไม่นับ
      checked++;
      if(st==='absent')absent++; else if(st==='late')late++; else if(st==='leave')leave++;
    });
    return { absent, late, leave, checked, pct: checked>0 ? Math.round((checked-absent)/checked*100) : 0 };
  };
  const dateLabel = d => { const o = new Date(d+'T00:00:00'); return `${o.getDate()} ${MONTHS_TH[o.getMonth()]}`; };
  const dowLabel  = d => { const o = new Date(d+'T00:00:00'); return DOW_TH[o.getDay()]; };

  const lessonsEl = document.getElementById('web-rep-weekly-lessons');
  const pillsEl   = document.getElementById('web-rep-weekly-pills');
  const insEl     = document.getElementById('web-rep-weekly-insights');
  const chart     = document.getElementById('web-rep-weekly-trend-chart');

  if (!sessions.length) {
    lessonsEl.innerText = '0 คาบ';
    pillsEl.innerHTML = '<span class="subtitle">ยังไม่มีข้อมูลการเช็คชื่อ</span>';
    insEl.innerText = 'ยังไม่มีข้อมูล';
    chart.innerHTML = '';
    return;
  }

  // สรุปภาพรวมทุกคาบ
  const perSession = sessions.map(d => ({ d, s: statDay(d) }));
  let oAbsent=0, oLate=0, oLeave=0, oChecked=0;
  perSession.forEach(x => { oAbsent+=x.s.absent; oLate+=x.s.late; oLeave+=x.s.leave; oChecked+=x.s.checked; });
  const overallPct = oChecked>0 ? Math.round((oChecked-oAbsent)/oChecked*100) : 0;

  lessonsEl.innerText = `${sessions.length} คาบ`;
  pillsEl.innerHTML =
    `<span class="summary-pill" style="background:var(--color-present-bg);color:var(--color-present);font-weight:800;">เข้าเรียนเฉลี่ย ${overallPct}%</span>`
    + `<span class="summary-pill" style="background:var(--color-absent-bg);color:var(--color-absent);">ขาด ${oAbsent} ครั้ง</span>`
    + `<span class="summary-pill" style="background:var(--color-late-bg);color:var(--color-late-text);">สาย ${oLate} ครั้ง</span>`
    + `<span class="summary-pill" style="background:var(--color-leave-bg);color:var(--color-leave);">ลา ${oLeave} ครั้ง</span>`;

  // insight: ภาพรวม + คาบที่เข้าเรียนน้อยสุด
  const worst = perSession.reduce((a, x) => (!a || x.s.pct < a.s.pct ? x : a), null);
  insEl.innerText = `จากทั้งหมด ${sessions.length} คาบ เข้าเรียนเฉลี่ย ${overallPct}%`
    + (oAbsent>0 ? ` · ขาดรวม ${oAbsent} ครั้ง` : ' · ไม่มีขาด')
    + (worst && worst.s.pct < 100 ? ` · คาบที่เข้าเรียนน้อยสุด ${dateLabel(worst.d)} (${worst.s.pct}%)` : '');

  // กราฟแท่งรายคาบ: Y = % เข้าเรียน, X = แต่ละคาบ (วันที่) — เลื่อนแนวนอนได้
  const PAD = { top: 32, right: 16, bottom: 48, left: 44 };
  const H = 210;
  const slotW = 56;
  const minW = chart.clientWidth || 600;
  const W = Math.max(minW, PAD.left + sessions.length * slotW + PAD.right);
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const barW = Math.min(slotW * 0.55, 26);

  const yTicks = [0, 25, 50, 75, 100];
  const yPos = pct => PAD.top + chartH - (pct / 100) * chartH;
  const xCenter = i => PAD.left + slotW * i + slotW / 2;

  let gridSvg = '';
  yTicks.forEach(t => {
    const y = yPos(t);
    gridSvg += `<line x1="${PAD.left}" y1="${y}" x2="${PAD.left + chartW}" y2="${y}"
      stroke="${t === 0 ? '#bbb' : '#ebebeb'}" stroke-width="${t === 0 ? 1.5 : 1}" stroke-dasharray="${t === 0 ? '' : '4,3'}"/>
      <text x="${PAD.left - 6}" y="${y + 4}" text-anchor="end" font-size="12" fill="#888" font-family="LINE Seed Sans TH, sans-serif">${t}%</text>`;
  });

  const baseline = PAD.top + chartH;
  let barsSvg = '', xLabelSvg = '';
  perSession.forEach((w, i) => {
    const cx = xCenter(i);
    const barH = Math.max((w.s.pct / 100) * chartH, 2);
    const barY = baseline - barH;
    const color = w.s.pct >= 80 ? '#2ecc71' : w.s.pct >= 60 ? '#f39c12' : '#e74c3c';

    // แท่งงอกจากพื้น 0 → ความสูงจริง (SVG animate รีรันทุกครั้งที่ render แท็บ) + ป้าย % ค่อยปรากฏ
    barsSvg += `
      <rect x="${cx - barW/2}" y="${baseline}" width="${barW}" height="0" rx="3" ry="3" fill="${color}" opacity="0.85">
        <animate attributeName="y" values="${baseline};${barY}" dur="0.8s" begin="0s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.22 1 0.36 1"/>
        <animate attributeName="height" values="0;${barH}" dur="0.8s" begin="0s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.22 1 0.36 1"/>
      </rect>
      <text x="${cx}" y="${barY - 6}" text-anchor="middle" font-size="11" font-weight="800" fill="#333" font-family="LINE Seed Sans TH, sans-serif" opacity="0">${w.s.pct}%<animate attributeName="opacity" values="0;1" begin="0.45s" dur="0.35s" fill="freeze"/></text>`;
    xLabelSvg += `
      <text x="${cx}" y="${PAD.top + chartH + 17}" text-anchor="middle" font-size="12" font-weight="800" fill="#333" font-family="LINE Seed Sans TH, sans-serif">${i + 1}</text>
      <text x="${cx}" y="${PAD.top + chartH + 31}" text-anchor="middle" font-size="9" fill="#888" font-family="LINE Seed Sans TH, sans-serif">${dateLabel(w.d)}</text>`;
  });

  chart.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible;">
    ${gridSvg}
    ${barsSvg}
    ${xLabelSvg}
  </svg>`;
}

function renderTermReport() {
  const c = appState.classes.find(x => x.id === currentClassId);
  if (!c) return;
  const todayStr = getTodayString();
  const dates = Object.keys(c.attendance || {}).filter(d => d <= todayStr).sort();
  
  // Student attendance grid: ชื่อ + สีแต่ละคาบ
  const heatmap = document.getElementById('web-rep-term-heatmap-grid');
  heatmap.innerHTML = '';

  const STATUS_COLOR = {
    present: 'var(--color-present)',
    late:    'var(--color-late)',
    absent:  'var(--color-absent)',
    leave:   'var(--color-leave)',
  };
  const STATUS_LABEL = { present: 'มา', late: 'สาย', absent: 'ขาด', leave: 'ลา' };
  const STATUS_TEXT  = { present: 'var(--color-present)', late: 'var(--color-late-text)', absent: 'var(--color-absent)', leave: 'var(--color-leave)' };

  // grid columns: ชื่อ 140px + คาบ 28px ต่อคาบ + รวม (พื้นที่ที่เหลือชิดขวา)
  const gridCols = `140px repeat(${dates.length}, 28px) minmax(90px, 1fr)`;

  // ===== เดสก์ท็อป: ตาราง dot รายคาบเต็ม =====
  let desktop = `<div class="term-grid-row term-grid-header" style="--term-cols:${gridCols};"><div class="term-grid-name"></div>`;
  dates.forEach((d, i) => { desktop += `<div class="term-grid-cell term-grid-date" style="font-size:0.7rem;">${i+1}</div>`; });
  desktop += `<div class="term-grid-summary is-header">รวม</div></div>`;

  // ===== มือถือ: การ์ดสรุปต่อคน มา/สาย/ขาด/ลา + % (dot รายคาบไปดูบนคอม) =====
  let mobile = '';

  c.students.forEach(s => {
    let absent=0, late=0, leave=0, present=0;
    let cells = '', timeline = '';
    dates.forEach((d, i) => {
      const st = (c.attendance[d]||{})[s.id] || '';
      if (st==='present') present++;
      else if (st==='late') late++;
      else if (st==='absent') absent++;
      else if (st==='leave') leave++;
      const bg = STATUS_COLOR[st] || '#d1d5db';
      cells += `<div class="term-grid-cell" title="${s.name}: ${STATUS_LABEL[st]||'-'}"><span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${bg};"></span></div>`;
      timeline += `<span class="tm-tl-item"><b>คาบ ${i+1}</b><span class="tm-tl-end"><span class="tm-tl-st" style="color:${STATUS_TEXT[st]||'var(--text-muted)'};">${STATUS_LABEL[st]||'–'}</span><span class="tm-dot" style="background:${bg};"></span></span></span>`;
    });
    const total = present+late+absent+leave;
    const pctS = total > 0 ? Math.round((present+late)/total*100) : 0;
    const pctColor = pctS >= 80 ? 'var(--color-present)' : pctS >= 60 ? 'var(--color-late-text)' : 'var(--color-absent)';
    const nameLabel = `${s.no ? s.no+'. ' : ''}${s.name}`;

    // panel กาง (dot รายคาบ + ลิงก์ไปหน้าแก้ไข) ใช้ร่วมทั้งมือถือ/คอม
    const panel = timeline
      ? `<div class="term-tl">${timeline}</div><button class="term-tl-edit" onclick="event.stopPropagation();currentClassId='${c.id}';openStudentDetailModal('${s.id}','${c.id}')"><i class="hgi-stroke hgi-edit-02"></i> แก้ไขข้อมูล</button>`
      : `<div class="tm-tl-empty">ยังไม่มีข้อมูลการเช็คชื่อ</div>`;

    desktop += `<div class="term-grid-row term-clickable" style="--term-cols:${gridCols};" onclick="toggleTermExpand('tmx-d-${s.id}',this)">
      <div class="term-grid-name">${nameLabel}</div>
      ${cells}
      <div class="term-grid-summary">
        <span style="font-weight:800;font-size:0.82rem;color:${pctColor};white-space:nowrap;">${pctS}%</span>
      </div>
    </div>
    <div class="term-expand term-expand-desk" id="tmx-d-${s.id}">${panel}</div>`;

    const stat = (color, label, n) => `<span class="tm-stat${n>0?' on':''}"><span class="tm-dot" style="background:${color};"></span>${label} <b>${n}</b></span>`;
    mobile += `<div class="term-mcard term-clickable" onclick="toggleTermExpand('tmx-m-${s.id}',this)">
      <div class="term-mcard-top">
        <span class="term-mcard-name">${nameLabel}</span>
        <span class="term-mcard-pct" style="color:${pctColor};">${total>0 ? pctS+'%' : '—'} <i class="hgi-stroke hgi-arrow-down-01 tm-chev"></i></span>
      </div>
      <div class="term-mcard-stats">
        ${stat('var(--color-present)','มา',present)}
        ${stat('var(--color-late)','สาย',late)}
        ${stat('var(--color-absent)','ขาด',absent)}
        ${stat('var(--color-leave)','ลา',leave)}
      </div>
      <div class="term-expand" id="tmx-m-${s.id}">${panel}</div>
    </div>`;
  });

  heatmap.innerHTML = `<div class="term-desktop-view">${desktop}</div><div class="term-mobile-view">${mobile}</div>`;
}

// แตะการ์ด/แถวรายภาค → กาง/พับ panel dot รายคาบ (ปิดอันอื่นก่อนเพื่อเปิดทีละคน)
function toggleTermExpand(panelId, rowEl) {
  const el = document.getElementById(panelId);
  if (!el) return;
  const willOpen = !el.classList.contains('open');
  document.querySelectorAll('.term-expand.open').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.term-clickable.expanded').forEach(r => r.classList.remove('expanded'));
  if (willOpen) {
    el.classList.add('open');
    if (rowEl) rowEl.classList.add('expanded');
  }
}

function renderOverallReport() {
  const c = appState.classes.find(x => x.id === currentClassId);
  if (!c) return;
  const pct = calculateAttendancePercentage(c);
  const pctEl = document.getElementById('web-rep-overall-pct');
  const circle = document.getElementById('web-rep-overall-circle');

  // ไล่สีตามคะแนน: เขียว(ดี) → ส้ม(ต้องติดตาม) → แดง(วิกฤต)
  const health = pct >= 90
    ? { color: 'var(--color-present)',    icon: 'hgi-checkmark-circle-02', msg: 'สุขภาพห้องเรียนดีเยี่ยม', bg: 'var(--color-present-bg)', fg: 'var(--color-present)' }
    : pct >= 75
    ? { color: '#f59e0b',                 icon: 'hgi-alert-circle',        msg: 'ต้องติดตาม',            bg: 'var(--color-late-bg)',    fg: 'var(--color-late-text)' }
    : { color: 'var(--color-absent)',     icon: 'hgi-alert-02',            msg: 'วิกฤต',                 bg: 'var(--color-absent-bg)',  fg: 'var(--color-absent)' };
  if (circle) circle.style.stroke = health.color;
  if (pctEl) pctEl.style.color = health.color;

  if (circle && pctEl) {
    const targetOffset = 251.2 - (251.2 * pct / 100);
    // Reset to 0 first
    circle.style.transition = 'none';
    circle.style.strokeDashoffset = 251.2;
    pctEl.innerText = '0%';
    // Double rAF ensures browser paints the reset before animating
    requestAnimationFrame(() => requestAnimationFrame(() => {
      circle.style.transition = '';
      circle.style.strokeDashoffset = targetOffset;
      // Count-up number animation
      const duration = 900;
      const startTime = performance.now();
      function tick(now) {
        const t = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        pctEl.innerText = Math.round(eased * pct) + '%';
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }));
  }
  
  let totalAbsent=0, totalLate=0;
  const dates = Object.keys(c.attendance||{});
  dates.forEach(d => { c.students.forEach(s => { const st=(c.attendance[d]||{})[s.id]; if(st==='absent')totalAbsent++; if(st==='late')totalLate++; }); });
  document.getElementById('web-rep-overall-absent').innerText = totalAbsent;
  document.getElementById('web-rep-overall-late').innerText = totalLate;

  const badge = document.getElementById('web-rep-overall-health-badge');
  badge.innerHTML = `<i class="hgi-stroke ${health.icon}"></i> ${health.msg}`;
  badge.style.background = health.bg;
  badge.style.color = health.fg;

  const riskStudents = [];
  c.students.forEach(s => { let ab=0; dates.forEach(d=>{if((c.attendance[d]||{})[s.id]==='absent')ab++;}); if(ab>=2) riskStudents.push({name:s.name,absent:ab}); });
  document.getElementById('web-rep-overall-insights').innerHTML = riskStudents.length > 0
    ? riskStudents.map(r => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><i class="hgi-stroke hgi-alert-02" style="color:var(--color-absent);"></i> ${r.name} ขาด ${r.absent} คาบ</div>`).join('')
    : '<div style="display:flex;align-items:center;gap:6px;"><i class="hgi-stroke hgi-checkmark-circle-02" style="color:var(--color-present);"></i> ไม่มีนักเรียนกลุ่มเสี่ยง</div>';
}

// ==================== EXCEL EXPORT ====================
function printReport() {
  const titleEl = document.getElementById('web-rep-detail-class-title');
  const subject = titleEl ? titleEl.innerText.trim() : 'รายงานการเข้าเรียน';
  const email = localStorage.getItem('classmanager_email') || '';
  const fallback = email ? `ครู${email.split('@')[0]}` : 'คุณครู';
  const teacher = (appState.teacherName || '').trim() || fallback;
  const activeTab = document.querySelector('#web-screen-reports .report-tab-item.active');
  const tabName = activeTab ? activeTab.innerText.trim() : '';
  const now = new Date();
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear() + 543}`;
  const hdr = document.getElementById('ck-print-header');
  if (hdr) {
    hdr.innerHTML =
      `<div class="ck-print-brand">ClassKru · รายงานการเข้าเรียน</div>` +
      `<div class="ck-print-title">${subject}</div>` +
      `<div class="ck-print-sub">ครูผู้สอน: ${teacher} &nbsp;·&nbsp; มุมมอง: ${tabName} &nbsp;·&nbsp; พิมพ์เมื่อ ${dateStr}</div>`;
  }
  window.print();
}

function exportAttendanceExcel() {
  if (!currentClassId) return;
  const c = appState.classes.find(x => x.id === currentClassId);
  if (!c) return;

  const dates = Object.keys(c.attendance || {}).sort();
  if (dates.length === 0) {
    showToast('ไม่มีข้อมูลการเช็คชื่อสำหรับส่งออก', 'warning');
    return;
  }

  // Create Headers
  const header = ['เลขที่', 'รหัสประจำตัว', 'ชื่อ-นามสกุล', ...dates.map(d => {
    // Format YYYY-MM-DD to DD/MM/YYYY
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }), 'มา', 'สาย', 'ขาด', 'ลา'];

  const rows = [];
  rows.push(header);

  // Student Rows
  c.students.forEach((s, idx) => {
    const row = [s.no || (idx + 1), s.studentCode || '', s.name];
    let p = 0, l = 0, a = 0, lv = 0;
    
    dates.forEach(d => {
      const st = (c.attendance[d] || {})[s.id];
      let txt = '';
      if (st === 'present') { txt = 'มา'; p++; }
      else if (st === 'late') { txt = 'สาย'; l++; }
      else if (st === 'absent') { txt = 'ขาด'; a++; }
      else if (st === 'leave') { txt = 'ลา'; lv++; }
      else { txt = '-'; }
      row.push(txt);
    });
    
    row.push(p, l, a, lv);
    rows.push(row);
  });

  // Create Workbook and export
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  XLSX.writeFile(wb, `เช็คชื่อ_${c.subject}_${c.className}.xlsx`);
}

// ==================== EXCEL IMPORT ====================
function downloadStudentsTemplate() {
  try {
    const data = [
      ["เลขที่", "รหัสประจำตัว", "ชื่อ", "นามสกุล", "ชั้นเรียน"],
      [1,  "13001", "เด็กชายอนันต์",    "มีสุข",       "ม.1/1"],
      [2,  "13002", "เด็กหญิงกนกวรรณ", "สว่างจิต",    "ม.1/1"],
      [3,  "13003", "เด็กชายธนภัทร",   "ชูศรี",       "ม.1/1"],
      [4,  "13004", "เด็กหญิงปิยะดา",  "แก้วมณี",     "ม.1/1"],
      [5,  "13005", "เด็กชายวรพล",     "ทองดี",       "ม.1/1"],
      [6,  "13006", "เด็กหญิงณัฐธิดา", "พรหมบุตร",    "ม.1/1"],
      [7,  "13007", "เด็กชายพีรพัฒน์", "รุ่งเรือง",   "ม.1/1"],
      [8,  "13008", "เด็กหญิงสุภาพร",  "ดวงดี",       "ม.1/1"],
      [9,  "13009", "เด็กชายกิตติพงษ์","ศรีวิชัย",    "ม.1/1"],
      [10, "13010", "เด็กหญิงอัจฉรา",  "บุญรักษา",    "ม.1/1"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    // Column widths
    ws['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายชื่อนักเรียน");
    XLSX.writeFile(wb, "ClassKru_รายชื่อนักเรียน_template.xlsx");
  } catch (err) {
    showToast("เกิดข้อผิดพลาด: " + err.message, "error");
  }
}

function downloadTimetableTemplate() {
  try {
    const data = [
      ["วัน", "คาบ", "ห้องเรียน", "วิชา"],
      ["จันทร์", 1, "ม.1/1", "คณิตศาสตร์"],
      ["จันทร์", 2, "ม.1/1", "วิทยาศาสตร์"],
      ["อังคาร", 1, "ม.1/2", "ภาษาอังกฤษ"],
      ["อังคาร", 2, "ม.1/2", "ภาษาไทย"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ตารางสอน");
    XLSX.writeFile(wb, "classkru_timetable_template.xlsx");
  } catch (err) {
    showToast("เกิดข้อผิดพลาด: " + err.message, "error");
  }
}

function switchExcelImportTab(tab) {
  currentExcelImportTab = tab;
  document.getElementById('btn-excel-tab-students').classList.toggle('active', tab === 'students');
  document.getElementById('btn-excel-tab-timetable').classList.toggle('active', tab === 'timetable');
  document.getElementById('excel-panel-students').style.display = tab === 'students' ? 'block' : 'none';
  document.getElementById('excel-panel-timetable').style.display = tab === 'timetable' ? 'block' : 'none';
}

let directImportTargetClassId = null;

function triggerDirectClassExcelImport(classId) {
  directImportTargetClassId = classId;
  document.getElementById('modal-direct-excel').classList.add('show');
}

function closeDirectExcelModal() {
  document.getElementById('modal-direct-excel').classList.remove('show');
}

function handleDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('dragover');
}

function handleExcelDrop(event, inputId) {
  event.preventDefault();
  event.currentTarget.classList.remove('dragover');
  const files = event.dataTransfer.files;
  if (files && files.length > 0) {
    const input = document.getElementById(inputId);
    input.files = files;
    // Trigger the change event manually
    const changeEvent = new Event('change', { bubbles: true });
    input.dispatchEvent(changeEvent);
  }
}

function handleDirectClassExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (json.length < 2) { showToast('ไฟล์ไม่มีข้อมูล', 'warning'); return; }
      
      const headers = json[0].map(h => String(h || '').trim().toLowerCase());
      let noIdx       = headers.findIndex(h => h.includes('เลขที่') || h.includes('ลำดับ') || h.includes('no'));
      let codeIdx     = headers.findIndex(h => h.includes('รหัส') || h.includes('code') || h.includes('sid') || h === 'id');
      let nameIdx     = headers.findIndex(h => h === 'ชื่อ' || h.includes('ชื่อ-') || h.includes('name'));
      let lastnameIdx = headers.findIndex(h => h.includes('นามสกุล') || h.includes('last') || h.includes('surname'));

      if (nameIdx === -1) {
        showToast('ไม่พบคอลัมน์ "ชื่อ" ในไฟล์ Excel', 'warning'); return;
      }

      const targetClass = appState.classes.find(c => c.id === directImportTargetClassId);
      if (!targetClass) return;

      let added = 0;
      json.slice(1).forEach(r => {
        if (!r[nameIdx]) return;
        let name = String(r[nameIdx]).trim();
        if (lastnameIdx >= 0 && r[lastnameIdx]) name += ' ' + String(r[lastnameIdx]).trim();
        const no = noIdx >= 0 ? (Number(r[noIdx]) || (targetClass.students.length + 1)) : (targetClass.students.length + 1);
        const studentCode = codeIdx >= 0 ? String(r[codeIdx] || '').trim() : '';

        // Skip only if same เลขที่ already exists (allow same name, different number)
        if (noIdx >= 0 && targetClass.students.some(s => s.no === no)) return;

        targetClass.students.push({ id: 's_' + Date.now() + Math.random().toString(36).substr(2, 5), name, no, studentCode, score: 0, comment: '' });
        added++;
      });
      
      saveState();
      renderWebClassrooms();
      refreshSwipeIfOpen();
      showToast(`นำเข้านักเรียนเรียบร้อย ${added} คน`, 'success');
    } catch (err) {
      showToast('อ่านไฟล์ไม่ได้: ' + err.message, 'error');
    } finally {
      event.target.value = ''; // Reset input
    }
  };
  reader.readAsArrayBuffer(file);
}

function handleExcelStudentsUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (json.length < 2) { showToast('ไฟล์ไม่มีข้อมูล', 'warning'); return; }
      parsedExcelHeaders = json[0].map(h => String(h || '').trim());
      parsedExcelRows = json.slice(1).filter(r => r.some(c => c));
      parsedExcelType = 'students';
      showStudentMappingUI();
    } catch (err) { showToast('อ่านไฟล์ไม่ได้: ' + err.message, 'error'); }
  };
  reader.readAsArrayBuffer(file);
}

function showStudentMappingUI() {
  document.getElementById('excel-students-mapping-area').style.display = 'block';
  const opts = '<option value="">-- เลือก --</option>' + parsedExcelHeaders.map((h,i) => `<option value="${i}">${h}</option>`).join('');
  ['map-student-no','map-student-code','map-student-name','map-student-lastname','map-student-class'].forEach(id => { document.getElementById(id).innerHTML = opts; });
  autoGuessMapping('students');
  
  // Target class dropdown
  const target = document.getElementById('map-student-target-class');
  target.innerHTML = '<option value="">-- สร้างอัตโนมัติ --</option>';
  appState.classes.forEach(c => { target.innerHTML += `<option value="${c.id}">${c.subject} (${c.className})</option>`; });

  // Preview
  const preview = document.getElementById('excel-students-preview-table');
  let html = '<thead><tr>' + parsedExcelHeaders.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
  parsedExcelRows.slice(0, 5).forEach(r => { html += '<tr>' + parsedExcelHeaders.map((_,i) => `<td>${r[i]||''}</td>`).join('') + '</tr>'; });
  html += '</tbody>';
  preview.innerHTML = html;
}

function autoGuessMapping(type) {
  if (type === 'students') {
    parsedExcelHeaders.forEach((h, i) => {
      const low = h.toLowerCase();
      if (low.includes('เลขที่') || low.includes('ลำดับ') || low.includes('no')) document.getElementById('map-student-no').value = i;
      if (low.includes('รหัส') || low.includes('code') || low.includes('sid') || low === 'id') document.getElementById('map-student-code').value = i;
      if (low === 'ชื่อ' || low.includes('name') || low.includes('ชื่อ-สกุล') || low.includes('ชื่อ-นามสกุล')) document.getElementById('map-student-name').value = i;
      if (low.includes('นามสกุล') || low.includes('last') || low.includes('surname')) document.getElementById('map-student-lastname').value = i;
      if (low.includes('ชั้น') || low.includes('ห้อง') || low.includes('class')) document.getElementById('map-student-class').value = i;
    });
  }
}

function confirmStudentsExcelImport() {
  const nameIdx = parseInt(document.getElementById('map-student-name').value);
  const lastnameIdx = parseInt(document.getElementById('map-student-lastname').value);
  if (isNaN(nameIdx)) { showToast('กรุณาเลือกคอลัมน์ชื่อ', 'warning'); return; }
  const noIdx = parseInt(document.getElementById('map-student-no').value);
  const codeIdx = parseInt(document.getElementById('map-student-code').value);
  const classIdx = parseInt(document.getElementById('map-student-class').value);
  const targetClassId = document.getElementById('map-student-target-class').value;

  let imported = 0;
  parsedExcelRows.forEach((row, ri) => {
    let name = String(row[nameIdx] || '').trim();
    if (!name) return;
    
    // Add last name if mapped
    if (!isNaN(lastnameIdx)) {
      const lname = String(row[lastnameIdx] || '').trim();
      if (lname) name += ' ' + lname;
    }
    
    let targetClass;
    if (targetClassId) {
      targetClass = appState.classes.find(c => c.id === targetClassId);
    } else {
      const className = !isNaN(classIdx) ? String(row[classIdx] || '').trim() : 'ห้องเรียนใหม่';
      targetClass = appState.classes.find(c => c.className === className);
      if (!targetClass) {
        targetClass = { id: 'c_' + Date.now() + '_' + ri, subject: 'วิชาใหม่', className, students: [], attendance: {}, notes: {} };
        appState.classes.push(targetClass);
      }
    }
    if (!targetClass) return;

    const no = !isNaN(noIdx) ? parseInt(row[noIdx]) || (targetClass.students.length + 1) : targetClass.students.length + 1;
    const studentCode = !isNaN(codeIdx) ? String(row[codeIdx] || '').trim() : '';
    targetClass.students.push({ id: `s_${Date.now()}_${ri}`, name, no, studentCode, score: 0, comment: '' });
    imported++;
  });

  saveState();
  showToast(`นำเข้าสำเร็จ ${imported} คน! 🎉`, 'success');
  document.getElementById('excel-students-mapping-area').style.display = 'none';
  if (directImportTargetClassId) {
    closeDirectExcelModal();
    directImportTargetClassId = null;
  }
  navigateToWebScreen(appState.activeWebScreen);
}

function handleExcelTimetableUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (json.length < 2) { showToast('ไฟล์ไม่มีข้อมูล', 'warning'); return; }
      parsedExcelHeaders = json[0].map(h => String(h || '').trim());
      parsedExcelRows = json.slice(1).filter(r => r.some(c => c));
      showTimetableMappingUI();
    } catch (err) { showToast('อ่านไฟล์ไม่ได้: ' + err.message, 'error'); }
  };
  reader.readAsArrayBuffer(file);
}

function showTimetableMappingUI() {
  document.getElementById('excel-timetable-mapping-area').style.display = 'block';
  const opts = '<option value="">-- เลือก --</option>' + parsedExcelHeaders.map((h,i) => `<option value="${i}">${h}</option>`).join('');
  ['map-table-day','map-table-period','map-table-class','map-table-subject'].forEach(id => { document.getElementById(id).innerHTML = opts; });
  
  const preview = document.getElementById('excel-timetable-preview-table');
  let html = '<thead><tr>' + parsedExcelHeaders.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
  parsedExcelRows.slice(0, 5).forEach(r => { html += '<tr>' + parsedExcelHeaders.map((_,i) => `<td>${r[i]||''}</td>`).join('') + '</tr>'; });
  html += '</tbody>';
  preview.innerHTML = html;
}

function confirmTimetableExcelImport() {
  const dayIdx = parseInt(document.getElementById('map-table-day').value);
  const periodIdx = parseInt(document.getElementById('map-table-period').value);
  const classIdx = parseInt(document.getElementById('map-table-class').value);
  const subjectIdx = parseInt(document.getElementById('map-table-subject').value);
  if (isNaN(dayIdx) || isNaN(periodIdx)) { showToast('กรุณาเลือกคอลัมน์วันและคาบ', 'warning'); return; }

  let imported = 0;
  parsedExcelRows.forEach(row => {
    const dayStr = String(row[dayIdx] || '').trim();
    const period = parseInt(row[periodIdx]);
    if (!dayStr || !period) return;
    const dowMap = {'จันทร์':1,'อังคาร':2,'พุธ':3,'พฤหัสบดี':4,'ศุกร์':5,'เสาร์':6,'อาทิตย์':0};
    const dow = dowMap[dayStr] !== undefined ? dowMap[dayStr] : parseInt(dayStr);
    if (isNaN(dow)) return;

    const className = !isNaN(classIdx) ? String(row[classIdx]||'').trim() : '';
    const subject = !isNaN(subjectIdx) ? String(row[subjectIdx]||'').trim() : '';
    const matchClass = appState.classes.find(c => c.className === className);

    appState.timetable.push({
      dow, period,
      classId: matchClass ? matchClass.id : '',
      subject: subject || (matchClass ? matchClass.subject : 'ไม่ระบุ'),
      className: className || (matchClass ? matchClass.className : ''),
      week: appState.timetableWeek || 'A'
    });
    imported++;
  });

  saveState();
  showToast(`นำเข้าตารางเรียน ${imported} คาบ! 🎉`, 'success');
  document.getElementById('excel-timetable-mapping-area').style.display = 'none';
  closeTimetableImport();
  renderWebTimetable();
}

// ==========================================
// ====  SWIPE ATTENDANCE (NEW FEATURE)  ====
// ==========================================

// ========== SWIPE CALENDAR PICKER ==========
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

  for (let d = 1; d <= daysInMonth; d++) {
    const dObj = new Date(swipeCalViewYear, swipeCalViewMonth, d);
    const dStr = getTodayString(dObj);
    const dow = dObj.getDay();
    const isWknd = dow === 0 || dow === 6;
    const isTdy = dStr === todayStr;
    const isSel = dStr === selectedStr && !isTdy;

    let cls = 'cal-day';
    if (isTdy) cls += ' today';
    else if (isSel) cls += ' selected';
    if (isWknd && !isTdy && !isSel) cls += ' weekend';

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

function updateSwipeDateDisplay() {
  const d = swipeSelectedDate || getNowDate();
  const thaiMonthsShort = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const el = document.getElementById('swipe-date-display');
  if (el) el.innerHTML = `${d.getDate()} ${thaiMonthsShort[d.getMonth()]}<span class="ck-date-year"> ${d.getFullYear() + 543}</span>`;
}


function openSwipeAttendance(classId, forDate) {
  swipeClassId = classId;
  swipeStudentIndex = 0;
  swipeResults = {};
  swipeHistory = [];

  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;

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

  // Show overlay
  document.getElementById('swipe-overlay').classList.add('show');

  renderSwipeCard();
  updateSwipeSummary();
  Tour.action('opened-checkin');
}

function closeSwipeAttendance() {
  document.getElementById('swipe-overlay').classList.remove('show');
  // Refresh current screen
  const screen = appState.activeWebScreen;
  if (screen === 'classrooms') renderWebClassrooms();
  else if (screen === 'attendance') loadWebAttendanceMatrix();
  else if (screen === 'dashboard') renderWebDashboard();
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

function showMobileClassPicker() {
  const overlay = document.createElement('div');
  overlay.className = 'ck-confirm-overlay';
  const items = appState.classes.map(c => {
    const pct = calculateAttendancePercentage(c);
    return `<div onclick="document.querySelector('.ck-confirm-overlay').remove();openSwipeAttendance('${c.id}')"
      style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border-color);cursor:pointer;transition:background 0.15s;"
      onmouseover="this.style.background='var(--primary-light)'" onmouseout="this.style.background=''">
      <div>
        <div style="font-weight:800;font-size:0.95rem;display:flex;align-items:center;gap:10px;"><span style="width:12px;height:12px;border-radius:50%;background:${getClassColor(c.id).text};flex-shrink:0;"></span>${c.subject}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;margin-left:22px;">${c.className} · ${c.students.length} คน</div>
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
        <div style="font-size:1rem;font-weight:800;"><i class="hgi-stroke hgi-task-done-01" style="color:var(--primary);margin-right:8px;"></i>เลือกห้องเรียน</div>
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
    doneState.style.display = 'flex';
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
      <button class="btn btn-primary" style="margin-top:20px;padding:12px 32px;font-size:0.95rem;font-weight:700;" onclick="closeSwipeAttendance()">
        <i class="hgi-stroke hgi-tick-02" style="margin-right:6px;"></i>เสร็จสิ้น
      </button>`;
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
  // avatar: ชื่อเล่น ถ้ามี, ไม่มีก็ใช้ชื่อจริงคำแรก. ป้าย "ชื่อเล่น" โชว์เฉพาะตอนมีชื่อเล่นจริง
  const nick = (student.nickname || '').trim();
  const firstName = (student.name || '').trim().split(/\s+/)[0] || '';
  document.getElementById('swipe-card-avatar').innerText = nick || firstName;
  const nickLabel = document.getElementById('swipe-card-nick-label');
  nickLabel.style.display = nick ? 'block' : 'none';
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

    let sAbsent = 0, sLate = 0, sLeave = 0;
    Object.values(c.attendance || {}).forEach(dayRecord => {
      const st = (dayRecord || {})[s.id];
      if (st === 'absent') sAbsent++;
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
  }, 350);
}

function undoSwipe() {
  if (swipeHistory.length === 0) return;
  const last = swipeHistory.pop();
  delete swipeResults[last.studentId];

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
  c.attendance[date] = finalResult;

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
function openClassModal(classId) {
  editingClassId = classId || null;
  const title = document.querySelector('#modal-class h3');
  const btn = document.getElementById('btn-class-submit');
  if (classId) {
    const c = appState.classes.find(x => x.id === classId);
    if (c) {
      document.getElementById('input-subject-name').value = c.subject;
      document.getElementById('input-class-name').value = c.className;
      const idx = appState.classes.findIndex(x => x.id === classId);
      selectedClassColorIndex = (typeof c.colorIndex === 'number') ? c.colorIndex : (idx % TT_CLASS_COLORS.length);
    }
    if (title) title.innerText = 'แก้ไขห้องเรียน';
    if (btn) btn.innerText = 'บันทึก';
  } else {
    document.getElementById('input-subject-name').value = '';
    document.getElementById('input-class-name').value = '';
    // ห้องใหม่: default เป็นสีแรกในจานสี
    selectedClassColorIndex = TT_COLOR_ORDER[0];
    if (title) title.innerText = 'เพิ่มห้องเรียนวิชาสอน';
    if (btn) btn.innerText = 'เพิ่มห้องเรียน';
  }
  renderClassColorPicker();
  document.getElementById('modal-class').classList.add('show');
}

function renderClassColorPicker() {
  const box = document.getElementById('class-color-picker');
  if (!box) return;
  box.innerHTML = TT_COLOR_ORDER.map((i) => {
    const col = TT_CLASS_COLORS[i];
    const on = i === selectedClassColorIndex;
    return `<button type="button" onclick="selectedClassColorIndex=${i};renderClassColorPicker();"
      style="width:18px;height:18px;border-radius:50%;background:${col.text};cursor:pointer;padding:0;
      border:2px solid ${on ? '#fff' : 'transparent'};
      box-shadow:0 0 0 ${on ? '2px '+col.text : '1px var(--border-color)'};
      transition:transform 0.12s;transform:scale(${on ? 1.25 : 1});"></button>`;
  }).join('');
}

function closeClassModal() {
  document.getElementById('modal-class').classList.remove('show');
  editingClassId = null;
}

function saveClass() {
  const subject = document.getElementById('input-subject-name').value.trim();
  const className = document.getElementById('input-class-name').value.trim();
  if (!subject || !className) { showToast('กรุณากรอกข้อมูลให้ครบ', 'warning'); return; }

  const isNew = !editingClassId;
  if (editingClassId) {
    const c = appState.classes.find(x => x.id === editingClassId);
    if (c) { c.subject = subject; c.className = className; c.colorIndex = selectedClassColorIndex; }
  } else {
    appState.classes.push({ id: 'c_' + Date.now(), subject, className, colorIndex: selectedClassColorIndex, students: [], attendance: {}, notes: {} });
  }
  saveState();
  closeClassModal();
  renderWebClassrooms();
  if (isNew) Tour.action('class-created');
}

function openStudentModal(studentId) {
  editingStudentId = studentId || null;
  const title = document.querySelector('#modal-student h3');
  const btn = document.getElementById('btn-student-submit');
  const c = appState.classes.find(x => x.id === currentClassId);
  if (studentId) {
    const s = c && c.students.find(x => x.id === studentId);
    document.getElementById('input-student-no').value = s ? (s.no || '') : '';
    document.getElementById('input-student-code').value = s ? (s.studentCode || '') : '';
    document.getElementById('input-student-name').value = s ? (s.name || '') : '';
    document.getElementById('input-student-nickname').value = s ? (s.nickname || '') : '';
    document.getElementById('input-student-comment').value = s ? (s.comment || '') : '';
    if (title) title.innerText = 'แก้ไขข้อมูลนักเรียน';
    if (btn) btn.innerText = 'บันทึก';
  } else {
    // เพิ่มใหม่: default เลขที่ = ถัดจากคนสุดท้าย, ที่เหลือว่าง
    document.getElementById('input-student-no').value = c ? (c.students.length + 1) : '';
    document.getElementById('input-student-code').value = '';
    document.getElementById('input-student-name').value = '';
    document.getElementById('input-student-nickname').value = '';
    document.getElementById('input-student-comment').value = '';
    if (title) title.innerText = 'เพิ่มนักเรียน';
    if (btn) btn.innerText = 'เพิ่ม';
  }
  document.getElementById('modal-student').classList.add('show');
}

function closeStudentModal() { document.getElementById('modal-student').classList.remove('show'); }

function saveStudent() {
  const name = document.getElementById('input-student-name').value.trim();
  if (!name) { showToast('กรุณากรอกชื่อ', 'warning'); return; }
  if (!currentClassId) { showToast('กรุณาเลือกห้องเรียน', 'warning'); return; }
  const c = appState.classes.find(x => x.id === currentClassId);
  if (!c) return;
  const no = parseInt(document.getElementById('input-student-no').value);
  const studentCode = document.getElementById('input-student-code').value.trim();
  const nickname = document.getElementById('input-student-nickname').value.trim();
  const comment = document.getElementById('input-student-comment').value.trim();
  if (editingStudentId) {
    const s = c.students.find(x => x.id === editingStudentId);
    if (s) { s.name = name; s.no = no || s.no; s.studentCode = studentCode; s.nickname = nickname; s.comment = comment; }
  } else {
    c.students.push({ id: 's_' + Date.now(), name, no: no || (c.students.length + 1), studentCode, nickname, comment, score: 0 });
  }
  saveState();
  closeStudentModal();
  renderWebStudents();
  refreshSwipeIfOpen();
  if (!editingStudentId) Tour.action('student-added');
}

function openPeriodModal(dow, period) {
  currentEditDow = dow;
  currentEditPeriod = period;
  const activeWeek = appState.timetableWeek || 'A';
  const existing = appState.timetable.find(t => t.dow === dow && t.period === period && (t.week === undefined || t.week === activeWeek));
  
  document.getElementById('modal-period-info').innerText = `${DAY_NAMES[dow]} · คาบ ${period} · Week ${activeWeek}`;
  
  const subjectSelect = document.getElementById('input-period-subject');
  const classSelect = document.getElementById('input-period-class');
  subjectSelect.innerHTML = '<option value="">-- เลือกวิชา --</option>';
  const uniqueSubjects = [...new Set(appState.classes.map(c => c.subject))];
  uniqueSubjects.forEach(s => { subjectSelect.innerHTML += `<option value="${s}">${s}</option>`; });

  if (existing) {
    subjectSelect.value = existing.subject || '';
    filterPeriodClassBySubject(existing.classId);
    document.getElementById('btn-period-delete').style.display = 'block';
  } else {
    filterPeriodClassBySubject();
    document.getElementById('btn-period-delete').style.display = 'none';
  }
  document.getElementById('modal-period').classList.add('show');
}

function closePeriodModal() { document.getElementById('modal-period').classList.remove('show'); }

function filterPeriodClassBySubject(preselectClassId) {
  const subject = document.getElementById('input-period-subject').value;
  const classSelect = document.getElementById('input-period-class');
  const filtered = subject
    ? appState.classes.filter(c => c.subject === subject)
    : appState.classes;
  classSelect.innerHTML = '<option value="">-- เลือกห้อง --</option>';
  filtered.forEach(c => { classSelect.innerHTML += `<option value="${c.id}">${c.className}</option>`; });
  if (preselectClassId) classSelect.value = preselectClassId;
}

function savePeriodSlot() {
  const subject = document.getElementById('input-period-subject').value;
  const classId = document.getElementById('input-period-class').value;
  if (!subject) { showToast('กรุณาเลือกวิชา', 'warning'); return; }
  const activeWeek = appState.timetableWeek || 'A';
  const c = appState.classes.find(x => x.id === classId);

  // Remove existing
  appState.timetable = appState.timetable.filter(t => !(t.dow === currentEditDow && t.period === currentEditPeriod && (t.week === undefined || t.week === activeWeek)));
  appState.timetable.push({ dow: currentEditDow, period: currentEditPeriod, classId, subject, className: c ? c.className : '', week: activeWeek });

  saveState();
  closePeriodModal();
  renderWebTimetable();
  Tour.action('period-added');
}

function deletePeriodSlot() {
  const activeWeek = appState.timetableWeek || 'A';
  appState.timetable = appState.timetable.filter(t => !(t.dow === currentEditDow && t.period === currentEditPeriod && (t.week === undefined || t.week === activeWeek)));
  saveState();
  closePeriodModal();
  renderWebTimetable();
}

function openStudentDetailModal(studentId, classId) {
  detailedStudentId = studentId;
  currentClassId = classId || currentClassId;
  const c = appState.classes.find(x => x.id === currentClassId);
  if (!c) return;
  const s = c.students.find(x => x.id === studentId);
  if (!s) return;

  document.getElementById('student-detail-name').innerText = s.nickname ? `${s.name} (${s.nickname})` : s.name;
  document.getElementById('student-detail-class').innerText = `${c.subject} (${c.className})`;
  document.getElementById('student-detail-no').value = s.no || '';
  document.getElementById('student-detail-code').value = s.studentCode || '';
  document.getElementById('student-detail-fullname').value = s.name || '';
  document.getElementById('student-detail-nickname').value = s.nickname || '';
  document.getElementById('student-detail-comment').value = s.comment || '';

  let p=0,l=0,a=0,lv=0;
  Object.keys(c.attendance || {}).forEach(d => {
    const st = (c.attendance[d] || {})[studentId];
    if (st === 'present') p++; else if (st === 'late') l++; else if (st === 'absent') a++; else if (st === 'leave') lv++;
  });
  document.getElementById('student-detail-present').innerText = p;
  document.getElementById('student-detail-late').innerText = l;
  document.getElementById('student-detail-absent').innerText = a;
  document.getElementById('student-detail-leave').innerText = lv;

  document.getElementById('modal-student-detail').classList.add('show');
}

function closeStudentDetailModal() { document.getElementById('modal-student-detail').classList.remove('show'); }

// แก้รหัสประจำตัวแบบ inline จากช่องในตาราง (เช็คชื่อ/จัดการรายชื่อ) — เขียนลงฟิลด์เดียวกับ modal
function setStudentCodeInline(classId, studentId, val) {
  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;
  const s = c.students.find(x => x.id === studentId);
  if (!s) return;
  s.studentCode = String(val || '').trim();
  saveState();
}

function saveStudentDetailChanges() {
  const c = appState.classes.find(x => x.id === currentClassId);
  if (!c) return;
  const s = c.students.find(x => x.id === detailedStudentId);
  if (!s) return;
  const newName = document.getElementById('student-detail-fullname').value.trim();
  if (!newName) { showToast('กรุณากรอกชื่อ-นามสกุล', 'warning'); return; }
  s.name = newName;
  s.no = parseInt(document.getElementById('student-detail-no').value) || s.no;
  s.studentCode = document.getElementById('student-detail-code').value.trim();
  s.nickname = document.getElementById('student-detail-nickname').value.trim();
  s.comment = document.getElementById('student-detail-comment').value.trim();
  saveState();
  closeStudentDetailModal();
  // ถ้าเปิดจากหน้าเช็คชื่อ → refresh ทั้งการ์ดมือถือ + ตารางเดสก์ท็อป (กันข้อมูลค้างหลังแก้ไข)
  // refreshSwipeIfOpen() คงตัวนักเรียนที่กำลังแสดงไว้ (ไม่กระโดดข้ามคน) เพราะคนปัจจุบันยังไม่ถูกเช็ค
  const swipeOverlay = document.getElementById('swipe-overlay');
  if (swipeOverlay && swipeOverlay.classList.contains('show')) {
    refreshSwipeIfOpen();
  } else {
    renderWebStudents();
  }
}


// ==================== DELETE / MANAGE ====================
function deleteCurrentClass() {
  showConfirm('ลบห้องเรียนนี้?', () => {
    appState.classes = appState.classes.filter(x => x.id !== currentClassId);
    appState.timetable = appState.timetable.filter(p => p.classId !== currentClassId);
    saveState();
    currentClassId = null;
    renderWebClassrooms();
  }, { title: 'ลบห้องเรียน', icon: '🗑️', okText: 'ลบ' });
}

function deleteClassById(classId) {
  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;
  showConfirm(`รายชื่อ ${c.students.length} คน และสถิติทั้งหมดจะถูกลบถาวร`, () => {
    appState.classes = appState.classes.filter(x => x.id !== classId);
    appState.timetable = appState.timetable.filter(p => p.classId !== classId);
    if (currentClassId === classId) currentClassId = null;
    saveState();
    renderWebClassrooms();
    renderWebDashboard();
  }, { title: `ลบห้อง "${c.subject} (${c.className})"?`, icon: '⚠️', okText: 'ลบถาวร' });
}

function deleteStudent(studentId) {
  const c = appState.classes.find(x => x.id === currentClassId);
  if (!c) return;
  const s = c.students.find(x => x.id === studentId);
  if (!s) return;
  showConfirm(`ลบ "${s.name}" ออกจากห้องเรียน?`, () => {
    c.students = c.students.filter(x => x.id !== studentId);
    c.students.forEach((s,i) => s.no = i + 1);
    Object.keys(c.attendance || {}).forEach(d => { delete c.attendance[d][studentId]; });
    saveState();
    showToast('ลบนักเรียนแล้ว', 'success');
    renderWebStudents();
  }, { title: `ลบ "${s.name}"?`, icon: '🗑️', okText: 'ลบ' });
}

function deleteAllStudentsInClass(classId) {
  const c = appState.classes.find(x => x.id === classId);
  if (!c) return;
  if (c.students.length === 0) {
    showToast('ไม่มีนักเรียนในห้องนี้', 'info');
    return;
  }
  showConfirm(`ข้อมูลการเช็คชื่อทั้งหมดจะหายไปด้วย`, () => {
    c.students = [];
    c.attendance = {};
    saveState();
    showToast('ลบรายชื่อนักเรียนทั้งหมดแล้ว', 'success');
    renderWebStudents();
  }, { title: `ลบนักเรียน ${c.students.length} คน?`, icon: '⚠️', okText: 'ลบทั้งหมด' });
}

// ==================== STATE MANAGEMENT ====================
function initAppState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    appState = JSON.parse(saved);
    // Migrate: add periodSettings if missing
    if (!appState.periodSettings) {
      appState.periodSettings = { startTime: '08:30', duration: 50, breakTime: 0, count: 7 };
    }
  }
  else { initAppStateDefault(); }
}

function initAppStateDefault() {
  appState.classes = [];
  appState.timetable = [];
  appState.periodSettings = { startTime: '08:30', duration: 50, breakTime: 0, count: 7 };
  appState.lastModified = 0; // Extremely old so it ALWAYS pulls from cloud if exists
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function generateMockHistory(classId, totalDays) {
  const mock = {};
  const today = new Date();
  let offset = 1, added = 0;
  const dows = { m11: [1,3,5], m12: [2,4] };
  const targets = dows[classId] || [1];
  while (added < totalDays) {
    const d = new Date(today); d.setDate(today.getDate() - offset);
    if (targets.includes(d.getDay())) {
      const key = d.toISOString().split('T')[0];
      const rec = {};
      if (classId === 'm11') { rec.m11_s1='present'; rec.m11_s2='present'; rec.m11_s3 = (added===2||added===4)?'absent':'present'; }
      else { rec.m12_s1 = added===1?'late':'present'; rec.m12_s2 = added===3?'absent':'present'; rec.m12_s3='present'; }
      mock[key] = rec;
      added++;
    }
    offset++;
  }
  return mock;
}

let _storageWarnShown = false;
function saveStateLocalOnly(updateTime = true) {
  if (updateTime) appState.lastModified = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    _storageWarnShown = false;
  } catch (e) {
    if (!_storageWarnShown) {
      _storageWarnShown = true;
      showToast('⚠️ พื้นที่เก็บข้อมูลเต็ม — <a href="clear-cache.html" style="color:#fbbf24;text-decoration:underline;">คลิกล้าง Cache</a>', 'warning', 8000);
    }
  }
}

let _cloudPushTimer = null;
function saveState() {
  localStorage.removeItem('classkru_skip_sync');
  saveStateLocalOnly();
  clearTimeout(_cloudPushTimer);
  _cloudPushTimer = setTimeout(() => {
    const email = localStorage.getItem('classmanager_email');
    if (email && supabaseClient) pushStateToCloudDirectly(email, appState);
  }, 500);
}

async function syncBackgroundCloud(email) {
  if (!supabaseClient) { updateCloudStatus('offline', 'ออฟไลน์'); return; }
  if (localStorage.getItem('classkru_skip_sync')) {
    updateCloudStatus('online', 'ล้างข้อมูลแล้ว');
    return;
  }
  try {
    updateCloudStatus('syncing', 'กำลังซิงก์...');
    const { data, error } = await supabaseClient.from('classmanager_profiles').select('state').eq('email', email).single();
    if (error && error.code !== 'PGRST116') throw error;
    if (data && data.state) {
      const cloudState = data.state;
      const cloudModified = cloudState.lastModified || 0;
      const localModified = appState.lastModified || 0;
      
      // Pull from cloud if it's newer, or if we have no classes locally but cloud does
      if (cloudModified > localModified || (cloudState.classes && cloudState.classes.length > 0 && appState.classes.length === 0)) {
        appState = cloudState;
        saveStateLocalOnly(false);
        updateProfileImages();
        navigateToWebScreen(appState.activeWebScreen || 'dashboard');
      } else if (localModified > cloudModified) {
        await pushStateToCloudDirectly(email, appState);
      }
    } else {
      await pushStateToCloudDirectly(email, appState);
    }
    updateCloudStatus('online', 'ออนไลน์');
  } catch (err) {
    console.warn('Cloud sync error:', err);
    updateCloudStatus('offline', 'ออฟไลน์');
  }
}

async function pushStateToCloudDirectly(email, state) {
  try {
    updateCloudStatus('syncing', 'อัปโหลด...');
    const { error } = await supabaseClient.from('classmanager_profiles').upsert({ email, state, updated_at: new Date().toISOString() });
    if (error) throw error;
    updateCloudStatus('online', 'ซิงก์แล้ว');
  } catch (err) {
    console.warn(err);
    updateCloudStatus('offline', 'ออฟไลน์');
  }
}

function updateCloudStatus(status, text) {
  const dot = document.getElementById('cloud-sync-dot');
  const textEl = document.getElementById('cloud-sync-text');
  if (!dot || !textEl) return;
  textEl.innerText = text;
  const colors = { online:'var(--color-present)', syncing:'var(--color-leave)', offline:'var(--color-absent)' };
  dot.style.backgroundColor = colors[status] || 'var(--text-muted)';
}

function calculateAttendancePercentage(c) {
  const today = getTodayString();
  const dates = Object.keys(c.attendance || {}).filter(d => d <= today);
  if (dates.length === 0 || c.students.length === 0) return 0;
  // คนที่ยังไม่ได้เช็ค (ไม่มีข้อมูล) = ไม่นับ — หารเฉพาะช่องที่เช็คจริง
  let present = 0, checked = 0;
  dates.forEach(d => {
    c.students.forEach(s => {
      const st = (c.attendance[d] || {})[s.id];
      if (!st) return;
      checked++;
      if (st === 'present' || st === 'late' || st === 'leave') present++;
    });
  });
  return checked > 0 ? Math.round((present / checked) * 100) : 0;
}

function logoutTeacher() {
  showConfirm('ออกจากระบบ ClassKru?', async () => {
    localStorage.removeItem('classmanager_email');
    localStorage.removeItem(STORAGE_KEY);
    if (supabaseClient) await supabaseClient.auth.signOut();
    window.location.reload();
  }, { title: 'ออกจากระบบ', icon: '👋', okText: 'ออก', okSafe: true });
}

async function forcePullFromCloud() {
  const email = localStorage.getItem('classmanager_email');
  if (!email || !supabaseClient) return;
  localStorage.removeItem('classkru_skip_sync');
  try {
    updateCloudStatus('syncing', 'กำลังดึงข้อมูล...');
    const { data, error } = await supabaseClient.from('classmanager_profiles').select('state').eq('email', email).single();
    if (error && error.code !== 'PGRST116') throw error;
    if (data && data.state) {
      appState = data.state;
      appState.lastModified = Date.now(); // Stamp it so it becomes the latest local
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      showToast('ดาวน์โหลดข้อมูลจาก Cloud สำเร็จ! 🎉', 'success', 1500);
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showToast('ไม่พบข้อมูลบน Cloud', 'warning');
      updateCloudStatus('online', 'ออนไลน์');
    }
  } catch (err) {
    console.warn(err);
    showToast('เกิดข้อผิดพลาดในการดึงข้อมูล', 'error');
    updateCloudStatus('offline', 'ออฟไลน์');
  }
}

function resetApplicationData() {
  showConfirm('ข้อมูลบน Cloud จะไม่หาย แค่ล้างในเครื่องนี้', () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem('classkru_skip_sync', '1');
    showToast('ล้างข้อมูลในเครื่องแล้ว', 'success', 1200);
    setTimeout(() => window.location.reload(), 800);
  }, { title: 'ล้างข้อมูลในเครื่อง?', icon: '🔄', okText: 'ล้างข้อมูล', okSafe: true });
}

function deleteAllDataEverywhere() {
  showConfirm('ข้อมูลทั้งหมดจะหายถาวร ทุกเครื่อง กู้คืนไม่ได้', async () => {
    // Block sync immediately before any async work
    localStorage.setItem('classkru_skip_sync', '1');
    localStorage.removeItem(STORAGE_KEY);
    const email = localStorage.getItem('classmanager_email');
    if (email && supabaseClient) {
      try {
        // Delete row; if that fails, overwrite with empty state so cloud is blank
        const { error } = await supabaseClient.from('classmanager_profiles').delete().eq('email', email);
        if (error) {
          await supabaseClient.from('classmanager_profiles').upsert({
            email,
            state: { classes: [], timetable: [], lastModified: Date.now() },
            updated_at: new Date().toISOString()
          });
        }
      } catch (e) {
        console.warn('Delete cloud error:', e);
      }
    }
    showToast('ลบข้อมูลทั้งหมดแล้ว', 'success', 1200);
    setTimeout(() => window.location.reload(), 800);
  }, { title: 'ลบข้อมูลทั้งหมด?', icon: '🗑️', okText: 'ลบถาวร' });
}

// ==================== OCR SCAN IMPORT ====================
let ocrTargetClassId = null;
let ocrExtractedNames = [];

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
    bubble.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:0.72rem;font-weight:700;color:var(--text-muted);">ขั้นที่ ${n}/${total}</span>
        <button onclick="Tour.skip()" style="background:none;border:none;color:var(--text-muted);font-size:0.78rem;cursor:pointer;">ข้ามทั้งหมด</button>
      </div>` +
      (step.title ? `<div style="font-weight:800;font-size:1rem;margin-bottom:6px;color:var(--text-main);">${step.title}</div>` : '') +
      `<div style="font-size:0.87rem;color:var(--text-main);line-height:1.65;">${body}</div>` +
      `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px;">${hint}<div style="margin-left:auto;">${advBtn}</div></div>`;
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
  // ลองเช็คจริง 1 คน (มือถือ) — เน้นว่า "แตะปุ่ม = เช็คชื่อ"
  { target: '.swipe-action-buttons', title: 'ลองเช็คชื่อดู!', mobileOnly: true, before: ensureCheckinOpen,
    body: 'แตะปุ่มด้านล่างเพื่อบันทึกสถานะของนักเรียนที่แสดงบนการ์ด<br>(<b style="color:var(--color-present)">มา</b> / สาย / ขาด / ลา)<br><br>👇 <b>ลองเช็คสัก 1 คน</b> — พอเป็นแล้วที่เหลือง่ายมาก!',
    advance: 'action:attendance-marked' },
  // ลองเช็คจริง 1 คน (คอม)
  { target: '.d-col-status', title: 'ลองเช็คชื่อดู!', desktopOnly: true, before: ensureCheckinOpen,
    body: 'กดปุ่มสถานะในแถวของนักเรียน (<b style="color:var(--color-present)">มา</b> / สาย / ขาด / ลา) เพื่อบันทึกการเข้าเรียน<br><br>👉 <b>ลองเช็คสัก 1 คน</b> — พอเป็นแล้วที่เหลือง่ายมาก!',
    advance: 'action:attendance-marked' },
  // สอนลงตารางสอนเอง (คอม) — แตะช่องในตาราง แล้วเลือกวิชา/ห้องที่เพิ่งสร้าง
  { nav: 'timetable', target: '#web-timetable-matrix-container td[onclick^="openPeriodModal"]', title: 'ลงตารางสอน (ไม่บังคับ)', desktopOnly: true,
    body: 'แตะช่องในตารางเพื่อลงคาบสอน แล้วเลือก<b>วิชา/ห้อง</b>ที่คุณเพิ่งสร้าง<br><br>ลงไว้แล้วหน้าแรกจะ<b>เตือนคาบถัดไป</b>ให้อัตโนมัติ · ยังไม่พร้อมก็ข้ามได้',
    advance: 'action:period-added' },
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
