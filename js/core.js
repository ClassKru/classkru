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

