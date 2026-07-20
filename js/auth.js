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
  // เข้าหน้าตาม deep-link ถ้ามี (เช่นเปิดจาก LINE OA มาที่ #reports) ไม่งั้นหน้าหลัก
  navigateToWebScreen(pendingDeepLink || 'dashboard', pendingDeepLinkParam);

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

