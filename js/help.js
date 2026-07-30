const HELP_DETAILS = {
  'getting-started': {
    icon: 'hgi-book-02', title: 'เริ่มต้นใช้งาน ClassKru', intro: 'ตั้งค่าครั้งแรกให้พร้อมเช็กชื่อได้ในไม่กี่ขั้นตอน',
    steps: [['01', 'สร้างห้องเรียน', 'เพิ่มรายวิชา ห้องเรียน และข้อมูลพื้นฐานที่ต้องใช้'], ['02', 'เพิ่มรายชื่อนักเรียน', 'เพิ่มทีละคน หรือนำเข้ารายชื่อจากไฟล์ Excel/CSV'], ['03', 'เริ่มเช็กชื่อ', 'เลือกคาบเรียน แล้วแตะหรือปัดเพื่อบันทึกการเข้าเรียน']]
  },
  report: { icon: 'hgi-alert-02', title: 'แจ้งปัญหา', intro: 'ช่วยบอกเราให้ละเอียดที่สุด เพื่อให้ทีมงานตรวจสอบได้เร็วขึ้น', tips: ['หน้าหรือฟีเจอร์ที่พบปัญหา', 'ขั้นตอนที่ทำก่อนเกิดปัญหา', 'ภาพหน้าจอ หรือข้อความแจ้งเตือนที่พบ'] },
  feature: { icon: 'hgi-bulb', title: 'เสนอฟีเจอร์', intro: 'ทุกไอเดียจากการใช้งานจริงช่วยให้ ClassKru ดีขึ้นสำหรับคุณครูมากขึ้น', tips: ['ฟีเจอร์ที่อยากให้มี', 'ปัญหาหรือเวลาที่ฟีเจอร์นี้จะช่วยลดได้', 'ตัวอย่างวิธีใช้งานที่คุณนึกภาพไว้'] },
  contact: { icon: 'hgi-message-02', title: 'ติดต่อทีมงานผ่าน LINE', intro: 'ใช้สำหรับสอบถาม แจ้งปัญหา หรือให้ทีมงานช่วยแนะนำการใช้งานเบื้องต้น', tips: ['พิมพ์คำถามหรือรายละเอียดที่ต้องการให้ช่วย', 'แนบภาพหน้าจอได้เมื่อจำเป็น', 'เริ่มใช้งาน ClassKru ได้จากระบบโดยตรง ไม่จำเป็นต้องติดต่อ LINE ก่อน'] }
};

const PUBLIC_HELP_DETAILS = {
  'getting-started': { title: 'เริ่มต้นใช้งาน ClassKru', intro: 'เริ่มจากสร้างห้องเรียน เพิ่มรายชื่อ แล้วเช็กชื่อได้ทันที', items: ['สมัครบัญชีหรือเข้าสู่ระบบ', 'สร้างห้องเรียนและเพิ่มรายชื่อนักเรียน', 'เลือกคาบเรียนเพื่อเริ่มเช็กชื่อ'] },
  account: { title: 'บัญชีและรหัสผ่าน', intro: 'จัดการการเข้าสู่ระบบได้ง่าย ๆ จากหน้า Login', items: ['สมัครใหม่ด้วยอีเมล หรือดำเนินการต่อด้วย Google', 'กรอกอีเมลแล้วกด “ลืมรหัสผ่าน?” เพื่อรับลิงก์ตั้งรหัสใหม่', 'หากไม่พบอีเมล ลองตรวจสอบโฟลเดอร์จดหมายขยะ'] },
  report: { title: 'แจ้งปัญหา', intro: 'รายละเอียดที่ครบช่วยให้ทีมงานตรวจสอบและตอบกลับได้เร็วขึ้น', items: ['ชื่อหน้าหรือฟีเจอร์ที่พบปัญหา', 'ขั้นตอนก่อนเกิดปัญหา', 'ภาพหน้าจอหรือข้อความแจ้งเตือน'] },
  contact: { title: 'ติดต่อทีมงานผ่าน LINE', intro: 'มีคำถามก่อนเริ่มใช้งาน หรืออยากให้ทีมงานช่วยแนะนำเบื้องต้น ทัก LINE ได้เลย', items: ['บอกสิ่งที่ต้องการให้ช่วยอย่างสั้น ๆ', 'แนบภาพหน้าจอได้เมื่อจำเป็น', 'LINE เป็นช่องทางติดต่อทีมงาน ไม่ใช่ขั้นตอนบังคับในการใช้งานระบบ'] }
};

function openClassKruLine(topic) {
  if (typeof openHelpLine === 'function') {
    openHelpLine(topic);
    return;
  }
  const message = encodeURIComponent(`#${topic}`);
  window.open(`https://line.me/R/oaMessage/%40731idhsu/?${message}`, '_blank', 'noopener');
}

function showPublicHelp() {
  const login = document.getElementById('login-content');
  const help = document.getElementById('public-help-view');
  if (!login || !help) return;
  login.style.display = 'none';
  help.style.display = 'block';
  history.replaceState(null, '', '#help-public');
  const fab = document.getElementById('help-fab');
  if (fab) fab.style.display = 'none';
}

function closePublicHelp() {
  const login = document.getElementById('login-content');
  const help = document.getElementById('public-help-view');
  if (!login || !help) return;
  help.style.display = 'none';
  login.style.display = 'flex';
  history.replaceState(null, '', window.location.pathname + window.location.search);
  const fab = document.getElementById('help-fab');
  if (fab) fab.style.display = 'flex';
}

function openPublicHelpDetail(key) {
  const item = PUBLIC_HELP_DETAILS[key];
  const hub = document.getElementById('public-help-hub');
  const detail = document.getElementById('public-help-detail');
  if (!item || !hub || !detail) return;
  hub.style.display = 'none';
  const action = key === 'contact' || key === 'report'
    ? `<button class="btn btn-primary" type="button" onclick="openClassKruLine('${key === 'report' ? 'แจ้งปัญหา' : 'ติดต่อเรา'}')"><i class="hgi-stroke hgi-message-02"></i> ติดต่อผ่าน LINE</button><button class="btn" type="button" onclick="closePublicHelp();document.getElementById('login-email')?.focus();">เข้าสู่ระบบ</button>`
    : `<button class="btn btn-primary" type="button" onclick="closePublicHelp();document.getElementById('login-email')?.focus();"><i class="hgi-stroke hgi-login-03"></i> กลับไปเข้าสู่ระบบ</button>`;
  detail.innerHTML = `<button class="help-back" type="button" onclick="renderPublicHelpHub()"><i class="hgi-stroke hgi-arrow-left-01"></i> กลับศูนย์ช่วยเหลือ</button><div class="help-detail-heading"><span class="help-category-icon tint-green"><i class="hgi-stroke hgi-help-circle"></i></span><div><span class="help-eyebrow">ClassKru Help Center</span><h3>${item.title}</h3><p>${item.intro}</p></div></div><div class="help-tip-box"><strong>สิ่งที่ควรรู้</strong><ul>${item.items.map(item => `<li>${item}</li>`).join('')}</ul></div><div class="help-detail-actions">${action}</div>`;
  detail.style.display = 'block';
}

function renderPublicHelpHub() {
  const hub = document.getElementById('public-help-hub');
  const detail = document.getElementById('public-help-detail');
  if (hub) hub.style.display = 'block';
  if (detail) { detail.style.display = 'none'; detail.innerHTML = ''; }
}

document.addEventListener('DOMContentLoaded', () => {
  if (location.hash === '#help-public' && document.getElementById('login-overlay')) showPublicHelp();
});

function renderHelpHub() {
  const hub = document.getElementById('help-hub-view');
  const detail = document.getElementById('help-detail-view');
  if (hub) hub.style.display = 'block';
  if (detail) { detail.style.display = 'none'; detail.innerHTML = ''; }
}

function openHelpDetail(key) {
  const item = HELP_DETAILS[key];
  const hub = document.getElementById('help-hub-view');
  const detail = document.getElementById('help-detail-view');
  if (!item || !hub || !detail) return;
  hub.style.display = 'none';
  detail.innerHTML = `<button class="help-back" onclick="renderHelpHub()"><i class="hgi-stroke hgi-arrow-left-01"></i> กลับศูนย์ช่วยเหลือ</button><div class="help-detail-heading"><span class="help-category-icon tint-green"><i class="hgi-stroke ${item.icon}"></i></span><div><span class="help-eyebrow">Help Center</span><h3>${item.title}</h3><p>${item.intro}</p></div></div>${item.steps ? `<div class="help-step-list">${item.steps.map(s => `<div class="help-step"><b>${s[0]}</b><div><strong>${s[1]}</strong><p>${s[2]}</p></div></div>`).join('')}</div>` : `<div class="help-tip-box"><strong>รายละเอียดที่ช่วยให้เราดูแลได้ไวขึ้น</strong><ul>${item.tips.map(t => `<li>${t}</li>`).join('')}</ul></div>`}<div class="help-detail-actions"><button class="btn btn-primary" onclick="openClassKruLine('${item.title}')"><i class="hgi-stroke hgi-message-02"></i> ติดต่อผ่าน LINE</button></div>`;
  detail.style.display = 'block';
  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
