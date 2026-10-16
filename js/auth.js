const CLASSKRU_MEDIA_DEVELOPER_EMAILS = new Set([
  'petch.0231@gmail.com',
  'supakit.radiation@gmail.com',
  'classkru.dev@gmail.com'
]);

// LINE Web Login uses OAuth2 with an HS256 ID token. Supabase's Custom OIDC
// provider expects ES256, so the browser starts our server-side LINE OAuth2
// bridge instead of calling the old custom OIDC provider.
const CLASSKRU_LINE_PROVIDER = 'line';
const CLASSKRU_LINE_PROVIDER_ALIASES = new Set(['line', 'custom:line']);
const CLASSKRU_USERNAME_EMAIL_DOMAIN = 'username.classkru.local';

function normalizeAuthUsername(value) {
  return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

async function usernameAuthEmail(value) {
  const username = normalizeAuthUsername(value);
  const length = Array.from(username).length;
  if (length < 3 || length > 30 || !/^[\p{L}\p{N}][\p{L}\p{N}\p{M}._-]*$/u.test(username)
    || /[._-]$/.test(username) || /[._-]{2}/.test(username)) return null;
  const bytes = new TextEncoder().encode(username);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
  return `user-${hash}@${CLASSKRU_USERNAME_EMAIL_DOMAIN}`;
}

function isClassKruMediaDeveloper(email = localStorage.getItem('classmanager_email')) {
  return CLASSKRU_MEDIA_DEVELOPER_EMAILS.has(String(email || '').trim().toLowerCase());
}

function showLoginOverlay() {
  const lo = document.getElementById('login-overlay');
  lo.classList.add('show');
  lo.style.display = 'flex';
}

function isLineLoginUser(user) {
  const provider = String(user?.app_metadata?.provider || '').toLowerCase();
  if (CLASSKRU_LINE_PROVIDER_ALIASES.has(provider)) return true;
  return (Array.isArray(user?.identities) ? user.identities : [])
    .some(identity => CLASSKRU_LINE_PROVIDER_ALIASES.has(String(identity?.provider || '').toLowerCase()));
}

function resolveLoginEmail(email, user = null) {
  const directEmail = String(email || user?.email || user?.user_metadata?.email || '').trim().toLowerCase();
  if (directEmail) return directEmail;
  // LINE may authenticate successfully without returning an email address.
  // Keep the app's legacy email-shaped key stable while teacher_id remains the
  // canonical identity used by Supabase and the relational tables.
  if (!isLineLoginUser(user)) return '';
  const stableId = String(user?.id || 'account').replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'account';
  return `line-${stableId}@login.classkru.local`;
}

function onLoginSuccess(email, user = null) {
  const resolvedEmail = resolveLoginEmail(email, user);
  if (!resolvedEmail) {
    setLoginStatus('บัญชีนี้ยังไม่มีอีเมลสำหรับเข้าสู่ระบบ กรุณาใช้ Google หรืออีเมลแทน', false);
    return;
  }
  const lo = document.getElementById('login-overlay');
  lo.classList.remove('show');
  lo.style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';
  prepareLocalStateForTeacher(user?.id);
  initAppState();
  updateUIProfileLabels(resolvedEmail);
  // เช็ค onboarding หลัง sync cloud เสร็จ (กันเข้าใจผิดว่าไม่มีห้องทั้งที่ cloud มีข้อมูล)
  syncBackgroundCloud(resolvedEmail).finally(() => maybeStartOnboarding());
  updateHeaderDate();
  // เข้าหน้าตาม deep-link ถ้ามี (เช่นเปิดจาก LINE OA มาที่ #reports) ไม่งั้นหน้าหลัก
  navigateToWebScreen(pendingDeepLink || 'dashboard', pendingDeepLinkParam);
  const lineLinkResult = new URLSearchParams(window.location.search).get('line_link');
  if (lineLinkResult === 'success') showToast('เชื่อมบัญชีกับ LINE สำเร็จ — ใช้บัญชีเดิมได้แล้ว', 'success', 2500);
  if (lineLinkResult === 'conflict') showToast('LINE นี้เชื่อมกับบัญชี ClassKru อื่นแล้ว', 'error', 3500);
  if (lineLinkResult === 'start') showToast('กำลังตรวจสอบการเชื่อมบัญชี กรุณาลองใหม่อีกครั้ง', 'warning', 3000);
  const googleLinkResult = new URLSearchParams(window.location.search).get('google_link');
  const hasGoogleIdentity = (Array.isArray(user?.identities) ? user.identities : [])
    .some(identity => String(identity?.provider || '').toLowerCase() === 'google');
  if (googleLinkResult === 'start' && hasGoogleIdentity) showToast('เชื่อม Google เข้าบัญชีเดิมแล้ว', 'success', 2500);
  refreshLoginIdentitySettings(user).catch(error => console.warn('Login identity status deferred:', error));

  // Developer-only test entry: requires a normal Supabase login from an allowlisted email.
  if (new URLSearchParams(window.location.search).get('media_test') === '1' && isClassKruMediaDeveloper(resolvedEmail)) {
    window.setTimeout(() => {
      if (typeof openInteractiveMediaStudio === 'function') openInteractiveMediaStudio();
    }, 0);
  }

  // มาจากลิงก์ตั้งรหัสใหม่ในอีเมล → เด้ง modal ตั้งรหัสทันทีหลังแอปโผล่
  if (pendingPasswordRecovery) { pendingPasswordRecovery = false; startPasswordRecovery(); }
}

async function refreshLoginIdentitySettings(user) {
  if (!user?.id) return;
  const googleLinked = (Array.isArray(user.identities) ? user.identities : [])
    .some(identity => String(identity?.provider || '').toLowerCase() === 'google');
  const googleButton = document.getElementById('btn-link-google');
  const googleStatus = document.getElementById('settings-google-link-status');
  if (googleButton) googleButton.style.display = googleLinked ? 'none' : 'flex';
  if (googleStatus) {
    googleStatus.textContent = googleLinked
      ? 'เชื่อม Google แล้ว ใช้บัญชี Google นี้เข้าสู่ระบบได้'
      : 'แนะนำให้เชื่อม Google หรือ LINE ไว้สักช่องทาง เผื่อลืมรหัสผ่าน';
  }

  const lineButton = document.getElementById('btn-link-line');
  const lineStatus = document.getElementById('settings-line-link-status');
  try {
    const { data, error } = await supabaseClient.from('teacher_login_identities')
      .select('provider').eq('teacher_id', user.id).eq('provider', 'line').maybeSingle();
    if (error) throw error;
    const lineLinked = Boolean(data);
    if (lineButton) lineButton.style.display = lineLinked ? 'none' : 'flex';
    if (lineStatus) lineStatus.textContent = lineLinked
      ? 'เชื่อม LINE แล้ว ข้อมูลห้องเรียนยังอยู่ในบัญชีเดิม'
      : 'เชื่อม LINE ภายหลังได้ ข้อมูลห้องเรียนจะอยู่ในบัญชีเดิม';
  } catch (error) {
    console.warn('LINE identity status check deferred:', error);
  }
}

function setLoginStatus(msg, ok) {
  const statusEl = document.getElementById('login-status');
  if (!statusEl) return;
  statusEl.style.color = ok ? 'var(--color-present)' : 'var(--color-absent)';
  statusEl.innerText = msg;
}

// ==================== โหมดเข้าสู่ระบบ / สมัครใหม่ ====================
// แยกเป็น 2 โหมดชัดเจน ครูจะได้รู้ว่ากำลังทำอะไรอยู่ (เดิมใช้ปุ่มเดียวกันแล้วงง)
let authMode = 'login';

function setAuthMode(mode) {
  authMode = (mode === 'signup') ? 'signup' : 'login';
  const isSignup = authMode === 'signup';

  const tabOn  = { background: 'white', color: 'var(--text-main)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
  const tabOff = { background: 'transparent', color: 'var(--text-muted)', boxShadow: 'none' };
  const apply = (id, s) => { const el = document.getElementById(id); if (el) Object.assign(el.style, s); };
  apply('auth-tab-login',  isSignup ? tabOff : tabOn);
  apply('auth-tab-signup', isSignup ? tabOn  : tabOff);
  const loginTab = document.getElementById('auth-tab-login');
  const signupTab = document.getElementById('auth-tab-signup');
  if (loginTab) loginTab.setAttribute('aria-selected', String(!isSignup));
  if (signupTab) signupTab.setAttribute('aria-selected', String(isSignup));
  const googleLabel = document.getElementById('google-login-label');
  const lineLabel = document.getElementById('line-login-label');
  if (googleLabel) googleLabel.innerText = isSignup ? 'สมัครผ่าน Google' : 'เข้าสู่ระบบด้วย Google';
  if (lineLabel) lineLabel.innerText = isSignup ? 'สมัครผ่าน LINE' : 'เข้าสู่ระบบด้วย LINE';

  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('signup-confirm-wrap', isSignup);
  show('signup-note-wrap', isSignup);
  show('signup-username-hint', isSignup);
  show('forgot-pw-wrap', !isSignup);

  const heading = document.getElementById('auth-heading');
  if (heading) heading.innerText = isSignup ? 'สมัครใช้งาน' : 'เข้าสู่ระบบ';
  const label = document.getElementById('btn-login-label');
  if (label) label.innerText = isSignup ? 'สมัครใช้งานฟรี' : 'เข้าสู่ระบบ';
  const icon = document.getElementById('btn-login-icon');
  if (icon) icon.className = isSignup ? 'hgi-stroke hgi-user-add-01' : 'hgi-stroke hgi-login-03';

  // ให้ browser เสนอ "สร้างรหัสผ่าน" ตอนสมัคร แทนที่จะเติมรหัสเดิม
  const pw = document.getElementById('login-password');
  if (pw) pw.autocomplete = isSignup ? 'new-password' : 'current-password';
  if (pw) pw.placeholder = isSignup ? 'อย่างน้อย 8 ตัวอักษร' : 'อย่างน้อย 6 ตัวอักษร';

  setLoginStatus('', true);
}

function submitAuth() {
  return authMode === 'signup' ? signUpWithPassword() : loginWithPassword();
}

function getLoginInputs() {
  const identifier = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!identifier) { setLoginStatus('กรุณากรอกชื่อผู้ใช้หรืออีเมล', false); return null; }
  if (authMode === 'signup' && !identifier.includes('@') && !isValidUsername(identifier)) {
    setLoginStatus('ชื่อผู้ใช้ยาว 3–30 ตัว ใช้ภาษาไทย/อังกฤษ ตัวเลข จุด ขีดกลาง หรือ _ ได้', false);
    return null;
  }
  const minimumPasswordLength = authMode === 'signup' ? 8 : 6;
  if (!password || password.length < minimumPasswordLength) {
    setLoginStatus(`รหัสผ่าน${authMode === 'signup' ? 'สำหรับสมัคร' : ''}อย่างน้อย ${minimumPasswordLength} ตัวอักษร`, false);
    return null;
  }
  if (authMode === 'signup') {
    const confirm = document.getElementById('login-password-confirm').value;
    if (password !== confirm) { setLoginStatus('รหัสผ่านทั้งสองช่องไม่ตรงกัน', false); return null; }
  }
  if (!supabaseClient) { setLoginStatus('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', false); return null; }
  return { identifier, password };
}

function isValidUsername(value) {
  const username = normalizeAuthUsername(value);
  const length = Array.from(username).length;
  return length >= 3 && length <= 30 && /^[\p{L}\p{N}][\p{L}\p{N}\p{M}._-]*$/u.test(username)
    && !/[._-]$/.test(username) && !/[._-]{2}/.test(username);
}

async function authEmailForIdentifier(identifier) {
  const value = String(identifier || '').trim();
  if (value.includes('@')) return value.toLowerCase();
  return usernameAuthEmail(value);
}

function getAuthRedirectTo() {
  // Google/Supabase ต้องกลับเข้าหน้า index.html ซึ่งมี Supabase client รับ OAuth hash
  // อยู่ หากกลับไปที่ root Vercel จะ redirect ต่อไป home.html และ session จะไม่ถูกอ่าน
  // (อาการที่เห็นคือกด Google แล้วเหมือนยังอยู่หน้าเดิม)
  const publicOrigin = 'https://www.classkru.com';
  const publicHosts = new Set(['classkru.com', 'www.classkru.com']);
  const hostname = String(window.location.hostname || '').toLowerCase();
  const isVercelPreview = hostname.endsWith('.vercel.app');
  const origin = window.location.protocol === 'file:' || publicHosts.has(hostname) || isVercelPreview
    ? publicOrigin
    : window.location.origin;
  // พา query string กลับมาด้วย (เช่น ?media_test=1) เพื่อคง deep-link หลังล็อกอิน
  return `${origin}/index.html${window.location.search || ''}`;
}

// ==================== ลืมรหัสผ่าน ====================
// เดิมไม่มีทางนี้เลย — ครูพิมพ์รหัสผิดตอนสมัคร = เข้าไม่ได้ตลอดกาล
async function sendPasswordReset() {
  const identifier = document.getElementById('login-email').value.trim();
  if (!identifier) { setLoginStatus('กรอกชื่อผู้ใช้หรืออีเมลก่อน แล้วกด "ลืมรหัสผ่าน?" อีกครั้ง', false); return; }
  if (!identifier.includes('@')) {
    setLoginStatus('บัญชีชื่อผู้ใช้ต้องเชื่อม Google หรือ LINE ไว้เพื่อกลับเข้าใช้งาน หากยังไม่ได้เชื่อม กรุณาติดต่อทีม ClassKru', false);
    return;
  }
  if (!supabaseClient) { setLoginStatus('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', false); return; }
  setLoginBtnLoading(true);
  setLoginStatus('กำลังส่งลิงก์...', true);
  const { error } = await supabaseClient.auth.resetPasswordForEmail(identifier.toLowerCase(), { redirectTo: getAuthRedirectTo() });
  setLoginBtnLoading(false);
  if (error) { setLoginStatus(error.message || 'ส่งลิงก์ไม่สำเร็จ', false); return; }
  // ไม่บอกว่าอีเมลนี้มีบัญชีหรือไม่ (กันคนไล่เดาว่าครูคนไหนใช้ระบบอยู่)
  setLoginStatus('ส่งลิงก์ตั้งรหัสใหม่ไปที่อีเมลแล้ว — ถ้าไม่เจอ ลองดูในเมลขยะ', true);
}

// เปิดจากลิงก์ในอีเมล → Supabase ให้ session ชั่วคราวมา ต้องตั้งรหัสใหม่ทันที
function startPasswordRecovery() {
  if (typeof openChangePasswordModal !== 'function') return;
  openChangePasswordModal();
  const st = document.getElementById('cp-status');
  if (st) { st.style.color = 'var(--text-muted)'; st.innerText = 'ตั้งรหัสผ่านใหม่เพื่อเข้าใช้งานต่อ'; }
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
  const email = await authEmailForIdentifier(inp.identifier);
  if (!email) {
    setLoginBtnLoading(false);
    setLoginStatus('ชื่อผู้ใช้ไม่ถูกต้อง', false);
    return;
  }
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password: inp.password });
  setLoginBtnLoading(false);
  if (error) {
    const m = (error.message || '').toLowerCase();
    if (m.includes('invalid login')) setLoginStatus('ชื่อผู้ใช้/อีเมลหรือรหัสผ่านไม่ถูกต้อง', false);
    else setLoginStatus(error.message || 'เข้าสู่ระบบไม่สำเร็จ', false);
    return;
  }
  // SIGNED_IN จะถูกจับใน onAuthStateChange → onLoginSuccess เอง
  setLoginStatus('', true);
}

async function signUpWithPassword() {
  const inp = getLoginInputs();
  if (!inp) return;
  if (inp.identifier.includes('@')) {
    setLoginStatus('สมัครด้วยชื่อผู้ใช้ได้โดยไม่ต้องใช้อีเมล หรือเลือกสมัครผ่าน Google / LINE', false);
    return;
  }
  if (inp.password.length < 8) {
    setLoginStatus('ตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษร', false);
    return;
  }
  setLoginBtnLoading(true);
  setLoginStatus('กำลังสมัคร...', true);
  try {
    const response = await fetch('/api/auth/username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username: normalizeAuthUsername(inp.identifier), password: inp.password })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (result.error === 'username_unavailable') setLoginStatus('ชื่อผู้ใช้นี้ถูกใช้แล้ว ลองชื่ออื่นนะครับ', false);
      else if (result.error === 'invalid_username') setLoginStatus('ชื่อผู้ใช้ยาว 3–30 ตัว ใช้ภาษาไทย/อังกฤษ ตัวเลข จุด ขีดกลาง หรือ _ ได้', false);
      else setLoginStatus('สมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', false);
      return;
    }
    setLoginStatus('สมัครสำเร็จ กำลังเข้าสู่ระบบ...', true);
    const email = await authEmailForIdentifier(inp.identifier);
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password: inp.password });
    if (error) setLoginStatus('สมัครแล้ว แต่เข้าสู่ระบบไม่สำเร็จ กรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านที่ตั้งไว้', false);
  } catch (error) {
    console.warn('Username signup failed:', error);
    setLoginStatus('เชื่อมต่อระบบสมัครไม่ได้ กรุณาลองใหม่อีกครั้ง', false);
  } finally {
    setLoginBtnLoading(false);
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

async function loginWithGoogle() {
  if (!supabaseClient) { setLoginStatus('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', false); return; }
  const button = document.getElementById('btn-google');
  if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
  setLoginStatus('กำลังเชื่อมต่อ Google...', true);
  try {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAuthRedirectTo() }
    });
    if (error) {
      const message = (error.message || '').toLowerCase();
      console.warn('Google OAuth start failed:', error);
      if (message.includes('redirect') || message.includes('origin') || message.includes('url')) {
        setLoginStatus('โดเมนนี้ยังไม่ได้เปิดใช้ Google Login กรุณาตรวจสอบ Redirect URLs ใน Supabase', false);
      } else {
        setLoginStatus('เชื่อมต่อ Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', false);
      }
    }
  } catch (error) {
    console.warn('Google OAuth start failed:', error);
    setLoginStatus('เชื่อมต่อ Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', false);
  } finally {
    if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
  }
}

async function linkGoogleIdentity() {
  if (!supabaseClient) {
    if (typeof showToast === 'function') showToast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', 'error');
    return;
  }
  const button = document.getElementById('btn-link-google');
  const status = document.getElementById('settings-google-link-status');
  if (button) { button.setAttribute('aria-busy', 'true'); button.style.pointerEvents = 'none'; }
  if (status) status.textContent = 'กำลังเปิด Google...';
  try {
    const { data, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;
    if (!data?.session?.access_token) throw new Error('ต้องเข้าสู่ระบบก่อนเชื่อม Google');
    const { error } = await supabaseClient.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: (() => {
          const redirect = new URL(getAuthRedirectTo());
          redirect.searchParams.set('google_link', 'start');
          return redirect.toString();
        })(),
        queryParams: { prompt: 'select_account' }
      }
    });
    if (error) throw error;
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    console.warn('Google identity linking failed:', error);
    const userMessage = message.includes('already linked') || message.includes('identity')
      ? 'Google นี้อาจเชื่อมกับบัญชี ClassKru อื่นแล้ว'
      : 'เชื่อม Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
    if (status) status.textContent = userMessage;
    if (typeof showToast === 'function') showToast(userMessage, 'error');
  } finally {
    if (button) { button.removeAttribute('aria-busy'); button.style.pointerEvents = ''; }
  }
}

async function loginWithLine() {
  if (!supabaseClient) { setLoginStatus('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', false); return; }
  const button = document.getElementById('btn-line');
  if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
  setLoginStatus('กำลังเชื่อมต่อ LINE...', true);
  try {
    const authOrigin = new URL(getAuthRedirectTo()).origin;
    const startUrl = `${authOrigin}/api/auth/line/start?return_to=${encodeURIComponent(getAuthRedirectTo())}`;
    window.location.assign(startUrl);
  } catch (error) {
    console.warn('LINE OAuth start failed:', error);
    setLoginStatus('เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', false);
  } finally {
    if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
  }
}

async function linkLineIdentity() {
  if (!supabaseClient) {
    if (typeof showToast === 'function') showToast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', 'error');
    return;
  }
  const button = document.getElementById('btn-link-line');
  if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
  const status = document.getElementById('settings-line-link-status');
  if (status) status.textContent = 'กำลังเปิด LINE...';
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data?.session?.access_token) throw new Error('ต้องเข้าสู่ระบบก่อนเชื่อม LINE');
    const response = await fetch(`/api/auth/line/start?mode=link&return_to=${encodeURIComponent(getAuthRedirectTo())}`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      credentials: 'same-origin'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.url) throw new Error(payload.error || 'line_link_start_failed');
    window.location.assign(payload.url);
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    console.warn('LINE identity linking failed:', error);
    const userMessage = message.includes('already linked') || message.includes('conflict')
      ? 'LINE นี้เชื่อมกับบัญชี ClassKru อื่นแล้ว'
      : 'เชื่อมบัญชีกับ LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
    if (status) status.textContent = userMessage;
    if (typeof showToast === 'function') showToast(userMessage, 'error');
  } finally {
    if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
  }
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
      showToast('เปลี่ยนรูปประจำตัวแล้ว', 'success');
    };
    img.onerror = function() { showToast('เปิดรูปไม่สำเร็จ', 'error'); };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = ''; // ให้เลือกรูปเดิมซ้ำได้
}

function getTeacherDisplayFallback(email) {
  if (isInternalAuthEmail(email)) return 'ClassKru';
  return email ? (() => { const n = email.split('@')[0]; return `ครู${n.charAt(0).toUpperCase() + n.slice(1)}`; })() : 'คุณครู';
}

function updateUIProfileLabels(email) {
  const fallback = getTeacherDisplayFallback(email);
  const displayName = (appState.teacherName || '').trim() || fallback;
  const els = ['sidebar-profile-name','web-settings-profile-name'];
  els.forEach(id => { const e = document.getElementById(id); if (e) e.innerText = displayName; });
  const emailEls = ['sidebar-profile-email','web-settings-profile-email'];
  const isSynthetic = isSyntheticLoginEmail(email);
  const isInternal = isInternalAuthEmail(email);
  const displayEmail = isSynthetic ? 'เข้าสู่ระบบด้วย LINE' : (isInternal ? 'บัญชี ClassKru' : email);
  emailEls.forEach(id => { const e = document.getElementById(id); if (e) e.innerText = displayEmail || ''; });
  const recoveryRow = document.getElementById('btn-add-recovery-email');
  const recoveryStatus = document.getElementById('settings-recovery-email-status');
  if (recoveryRow) recoveryRow.style.display = isSynthetic && !String(email || '').toLowerCase().includes('@username.classkru.local') ? 'flex' : 'none';
  if (recoveryStatus) recoveryStatus.style.display = recoveryRow?.style.display === 'flex' ? 'block' : 'none';
  const nameInput = document.getElementById('settings-name-input');
  if (nameInput) nameInput.value = (appState.teacherName || '').trim();
  updateProfileImages();
}

function isSyntheticLoginEmail(email) {
  return /@login\.classkru\.local$/i.test(String(email || '').trim());
}

function isInternalAuthEmail(email) {
  return /@(?:login|username)\.classkru\.local$/i.test(String(email || '').trim());
}

function setTeacherNameSaveState() {
  const input = document.getElementById('settings-name-input');
  const button = document.getElementById('settings-name-save');
  const status = document.getElementById('settings-name-save-status');
  if (!input || !button) return;
  const isDirty = input.value.trim() !== String(appState.teacherName || '').trim();
  button.disabled = !isDirty;
  if (status) {
    status.textContent = isDirty ? 'ยังไม่ได้บันทึก' : '';
    status.dataset.state = isDirty ? 'pending' : '';
  }
}

function saveTeacherNameFromInput() {
  const input = document.getElementById('settings-name-input');
  if (input) return saveTeacherName(input.value);
}

async function saveTeacherName(val) {
  const input = document.getElementById('settings-name-input');
  const button = document.getElementById('settings-name-save');
  const status = document.getElementById('settings-name-save-status');
  const name = String(val || '').trim();
  if (!name) {
    if (status) {
      status.textContent = 'กรุณากรอกชื่อที่ต้องการแสดง';
      status.dataset.state = 'error';
    }
    input?.focus();
    return false;
  }

  appState.teacherName = name;
  if (button) button.disabled = true;
  if (status) {
    status.textContent = 'กำลังบันทึก…';
    status.dataset.state = 'pending';
  }
  updateUIProfileLabels(localStorage.getItem('classmanager_email'));
  try {
    let saved = await saveState();
    // A relational write can be kept in the local retry queue after a transient
    // network error. Flush that queue before telling the teacher it is saved.
    if (typeof relationalMode !== 'undefined' && relationalMode === 'ready'
      && typeof flushRelationalQueue === 'function') {
      saved = await flushRelationalQueue();
    }
    if (saved) {
      if (status) {
        status.textContent = 'บันทึกแล้ว';
        status.dataset.state = 'saved';
      }
      showToast('บันทึกชื่อแล้ว', 'success', 1500);
      return true;
    }
    if (status) {
      status.textContent = 'บันทึกไว้ในเครื่องแล้ว รอเชื่อมต่อเพื่อซิงก์';
      status.dataset.state = 'pending';
    }
    if (button) button.disabled = false;
    return false;
  } catch (error) {
    console.warn('Teacher name save failed:', error);
    if (status) {
      status.textContent = 'บันทึกออนไลน์ไม่สำเร็จ ลองอีกครั้ง';
      status.dataset.state = 'error';
    }
    if (button) button.disabled = false;
    return false;
  }
}

// ========== เปลี่ยนรหัสผ่าน ==========
function openChangePasswordModal() {
  document.getElementById('cp-new').value = '';
  document.getElementById('cp-confirm').value = '';
  document.getElementById('cp-status').innerText = '';
  document.getElementById('modal-change-password').classList.add('show');
}
function closeChangePasswordModal() { document.getElementById('modal-change-password').classList.remove('show'); }

function openRecoveryEmailModal() {
  const input = document.getElementById('recovery-email-input');
  const status = document.getElementById('recovery-email-status');
  if (input) input.value = '';
  if (status) status.innerText = '';
  document.getElementById('modal-recovery-email')?.classList.add('show');
  input?.focus();
}

function closeRecoveryEmailModal() {
  document.getElementById('modal-recovery-email')?.classList.remove('show');
}

async function submitRecoveryEmail() {
  const input = document.getElementById('recovery-email-input');
  const status = document.getElementById('recovery-email-status');
  const button = document.getElementById('recovery-email-submit');
  const email = String(input?.value || '').trim().toLowerCase();
  const set = (message, ok = false) => {
    if (status) {
      status.style.color = ok ? 'var(--color-present)' : 'var(--color-absent)';
      status.innerText = message;
    }
  };
  if (!email || !email.includes('@')) return set('กรุณากรอกอีเมลให้ถูกต้อง');
  if (!supabaseClient) return set('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง');
  if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
  set('กำลังส่งลิงก์ยืนยัน...', true);
  try {
    const { error } = await supabaseClient.auth.updateUser({ email });
    if (error) throw error;
    set('ส่งลิงก์ยืนยันแล้ว กรุณาเปิดอีเมลเพื่อยืนยันบัญชี', true);
    if (typeof showToast === 'function') showToast('ส่งลิงก์ยืนยันอีเมลแล้ว', 'success', 2500);
  } catch (error) {
    console.warn('Recovery email update failed:', error);
    const message = String(error?.message || '').toLowerCase();
    set(message.includes('already') ? 'อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว' : 'เพิ่มอีเมลไม่สำเร็จ กรุณาลองใหม่');
  } finally {
    if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
  }
}

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
