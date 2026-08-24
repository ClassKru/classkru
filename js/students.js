// หน้าเพิ่มนักเรียนแบบแท็บใหม่จะเขียนรายชื่อเข้าที่เก็บข้อมูลเดียวกัน
// อีเวนต์นี้ทำให้หน้าจัดการเดิมเห็นรายชื่อใหม่ทันทีโดยไม่ต้องรีเฟรชเอง
window.addEventListener('storage', (event) => {
  if (event.key !== 'classkru_mobile_v4' || !event.newValue) return;
  try {
    appState = JSON.parse(event.newValue);
    if (typeof renderWebStudents === 'function') renderWebStudents();
  } catch (error) {
    console.warn('ClassKru student roster sync failed', error);
  }
});

// มือถือ: ช่องค้นหาซ่อนไว้ ให้หัวจอสูงเท่าหน้าอื่น (52px) — แตะแว่นขยายค่อยกางออกมา
// ปิดแล้วล้างคำค้นด้วย ไม่งั้นรายชื่อจะถูกกรองค้างโดยที่ผู้ใช้มองไม่เห็นช่องค้นหา
function toggleStudentsSearch() {
  const box = document.querySelector('.students-head-controls');
  const input = document.getElementById('web-student-search-input');
  const btn = document.getElementById('students-search-btn');
  if (!box || !input) return;
  const open = box.classList.toggle('is-open');
  if (btn) btn.classList.toggle('active', open);
  if (open) {
    input.focus();
  } else if (input.value) {
    input.value = '';
    renderWebStudents();
  }
}

function escapeStudentCardHtml(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

function splitStudentDisplayName(value) {
  const cleanName = String(value || 'นักเรียน').trim().replace(/\s+/g, ' ');
  const lastSpace = cleanName.lastIndexOf(' ');
  if (lastSpace <= 0) return { first: cleanName, last: '' };
  return {
    first: cleanName.slice(0, lastSpace),
    last: cleanName.slice(lastSpace + 1)
  };
}

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

  // Toggle empty state + แถบแท็บภายในห้อง (โชว์เมื่อเลือกห้องแล้วเท่านั้น)
  const stTab = document.getElementById('students-classtab-holder');
  // หัวจอโชว์ชื่อห้อง (จุดสี + วิชา (ชั้น)) ให้เหมือนหน้าคะแนน/รายงาน — ยังไม่เลือกห้องค่อยกลับเป็นชื่อหน้า
  const stTitle = document.getElementById('web-students-detail-title');
  if (!filter.value) {
    contentArea.style.display = 'none';
    emptyState.style.display = 'block';
    currentClassId = null;
    if (stTab) stTab.innerHTML = '';
    if (stTitle) stTitle.innerHTML = '<i class="hgi-stroke hgi-user-multiple" style="color:var(--primary)"></i> <span class="hdr-title-text">จัดการรายชื่อนักเรียน</span>';
    return;
  } else {
    contentArea.style.display = 'block';
    emptyState.style.display = 'none';
    currentClassId = filter.value;
    if (stTab) stTab.innerHTML = renderClassTabBar(filter.value, 'students');
    if (stTitle) {
      const sc = appState.classes.find(x => x.id === filter.value);
      const scol = getClassColor(filter.value);
      if (sc) stTitle.innerHTML =
        `<span style="width:12px;height:12px;border-radius:50%;background:${scol.text};flex-shrink:0;"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">${sc.subject} (${sc.className})</span>`;
    }
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

  if (filteredStudents.length === 0) {
    container.innerHTML = `
      <div class="student-card-empty">
        <i class="hgi-stroke hgi-user-search-01"></i>
        <strong>ไม่พบนักเรียนที่ตรงกับคำค้น</strong>
        <span>ลองค้นด้วยชื่อ หรือรหัสนักเรียนอีกครั้ง</span>
      </div>`;
    return;
  }

  filteredStudents.forEach((s, visibleIndex) => {
    const displayName = splitStudentDisplayName(s.name || 'นักเรียน');
    const firstNameEsc = escapeStudentCardHtml(displayName.first);
    const lastNameEsc = escapeStudentCardHtml(displayName.last);
    const fullNameEsc = escapeStudentCardHtml(s.name || 'นักเรียน');
    const nickEsc = escapeStudentCardHtml((s.nickname || '').trim());
    const card = document.createElement('article');
    card.className = 'student-roster-card';
    card.tabIndex = 0;
    // สี avatar ชุดเดียวกับหน้าคะแนน (ไล่ตามลำดับคนในห้อง → คนเดียวกันได้สีตรงกันทั้ง 2 หน้า) — โชว์เป็นวงกลมบนมือถือ
    const realIdx = targetClass.students.indexOf(s);
    const av = (typeof mscAvatar === 'function') ? mscAvatar(s, realIdx < 0 ? 0 : realIdx) : { bg: '', fg: '' };
    const avatarText = nickEsc || String(s.no || visibleIndex + 1);
    const avatarClass = avatarText.length > 5 ? ' is-tiny' : (avatarText.length > 3 ? ' is-small' : '');
    const avatar = s.photoBase64
      ? `<img src="${s.photoBase64}" alt="">`
      : `<span class="student-card-avatar-text${avatarClass}" title="${avatarText}">${avatarText}</span>`;
    const nicknameBlock = nickEsc || '';
    card.setAttribute('onclick', `if(!event.target.closest('input,button'))openStudentSummaryModal('${s.id}','${targetClass.id}')`);
    card.setAttribute('onkeydown', `if((event.key==='Enter'||event.key===' ')&&!event.target.closest('input,button')){event.preventDefault();openStudentSummaryModal('${s.id}','${targetClass.id}')}`);
    card.innerHTML = `
      <div class="student-card-top">
        <span class="student-card-no" style="--av-bg:${av.bg};--av-fg:${av.fg};">เลขที่ ${s.no || '-'}</span>
        <div class="student-card-actions">
          <button class="student-card-icon-btn" title="แก้ไขข้อมูล" onclick="event.stopPropagation();currentClassId='${targetClass.id}';openStudentDetailModal('${s.id}','${targetClass.id}')"><i class="hgi-stroke hgi-edit-02"></i></button>
          <button class="student-card-icon-btn danger" title="ลบนักเรียน" onclick="event.stopPropagation();currentClassId='${targetClass.id}';deleteStudent('${s.id}')"><i class="hgi-stroke hgi-delete-02"></i></button>
        </div>
      </div>
      <div class="student-card-main">
        <div class="student-card-avatar" style="--av-bg:${av.bg};--av-fg:${av.fg};">${avatar}</div>
        <div class="student-card-name" title="${fullNameEsc}">
          <strong>
            <span class="student-card-name-line">${firstNameEsc}</span>
            ${lastNameEsc ? `<span class="student-card-surname-line">${lastNameEsc}</span>` : ''}
          </strong>
          <span>${nicknameBlock}</span>
        </div>
      </div>`;
    container.appendChild(card);
  });
}

// เมนู ⋮ ปุ่มจัดการรายชื่อ (มือถือ) — ยุบ นำเข้า Excel / ลบทั้งหมด ไว้ที่เดียว
function toggleStudentsActionMenu(ev) {
  ev.stopPropagation();
  const existing = document.getElementById('ck-class-menu');
  const wasOpen = !!existing;
  if (typeof closeClassMenu === 'function') closeClassMenu();
  if (wasOpen) return; // กดซ้ำ = ปิด
  const r = ev.currentTarget.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'ck-class-menu';
  menu.className = 'ck-class-menu';
  menu.dataset.for = 'students-actions';
  menu.innerHTML = `
    <button onclick="closeClassMenu();openStudentModal()"><i class="hgi-stroke hgi-user-add-01"></i><span>เพิ่มนักเรียน</span></button>
    <button onclick="closeClassMenu();openStudentQrCardsFromRoster()"><i class="hgi-stroke hgi-qr-code"></i><span>พิมพ์ QR นักเรียน</span></button>
    <button onclick="closeClassMenu();openClassJoinActivity()"><i class="hgi-stroke hgi-user-add-01"></i><span>เพิ่มนักเรียนผ่านกิจกรรม</span></button>
    <button onclick="closeClassMenu();triggerDirectClassExcelImport(currentClassId)"><i class="hgi-stroke hgi-google-sheet"></i><span>นำเข้า Excel</span></button>
    <button class="danger" onclick="closeClassMenu();deleteAllStudentsInClass(currentClassId)"><i class="hgi-stroke hgi-delete-02"></i><span>ลบทั้งหมด</span></button>`;
  document.body.appendChild(menu);
  menu.style.top = (r.bottom + window.scrollY + 6) + 'px';
  menu.style.left = (r.right + window.scrollX - menu.offsetWidth) + 'px';
  notifyTourAction('student-menu-opened');
  setTimeout(() => document.addEventListener('click', closeClassMenuOnOutside), 0);
}

// Local working prototype: เปิดรับนักเรียนผ่านกิจกรรมเพิ่มนักเรียนในเครื่องนี้
const JOIN_ACTIVITY_STORAGE_KEY = 'classkru_join_activity_sessions_v2';
let activeJoinSessionCode = null;
let joinActivityRefreshTimer = null;
const JOIN_ACTIVITY_SAMPLE = [
  { firstName: 'สมชาย', lastName: 'ใจดี', nickname: 'บอล', no: 12, code: '12345', answer: 'พร้อมมาก', status: 'matched' },
  { firstName: 'มาลี', lastName: 'สดใส', nickname: 'มายด์', no: 8, code: '13008', answer: 'พอไหว', status: 'matched' },
  { firstName: 'ธนา', lastName: '', nickname: 'นัท', no: 51, code: '', answer: 'ง่วงนิดหน่อย', status: 'pending' },
  { firstName: 'พิมพ์', lastName: '', nickname: 'พิม', no: '', code: '', answer: 'อยากเริ่มด้วยเกม', status: 'pending' }
];

function openClassJoinActivity() {
  if (!currentClassId) {
    alert('กรุณาเลือกห้องเรียนก่อนเปิดกิจกรรมเพิ่มนักเรียน');
    return;
  }
  const activityUrl = `join-activity.html?classId=${encodeURIComponent(currentClassId)}`;
  const activityTab = window.open(activityUrl, '_blank');
  if (!activityTab) window.location.href = activityUrl;
}

function closeClassJoinActivity() {
  const modal = document.getElementById('modal-join-activity');
  if (modal) modal.classList.remove('show');
  if (joinActivityRefreshTimer) clearInterval(joinActivityRefreshTimer);
  joinActivityRefreshTimer = null;
}

function getJoinQuestion() {
  return (document.getElementById('join-question-input')?.value || '').trim() || 'วันนี้รู้สึกพร้อมเรียนแค่ไหน?';
}

function getJoinDisplayMode() {
  return document.getElementById('join-display-mode')?.value || 'anonymous';
}

function getJoinAnswerType() {
  return document.getElementById('join-answer-type')?.value || 'choice';
}

function getJoinOptions() {
  return (document.getElementById('join-options-input')?.value || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function getJoinSessions() {
  try { return JSON.parse(localStorage.getItem(JOIN_ACTIVITY_STORAGE_KEY) || '{}') || {}; }
  catch (e) { return {}; }
}

function saveJoinSessions(sessions) {
  localStorage.setItem(JOIN_ACTIVITY_STORAGE_KEY, JSON.stringify(sessions));
}

// รหัสห้องเดิมเป็น CK-1000..CK-9999 = มีแค่ 9,000 ค่า และ code เป็น unique ถาวรในตาราง
// ชนเมื่อไหร่ระบบจะเงียบตกไปเป็นโหมดเครื่องเดียว นักเรียนสแกน QR แล้วเข้าไม่ได้
// ต้องตรงกับ generateJoinCode() ใน join-activity.html
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateJoinCode() {
  const buf = new Uint32Array(6);
  window.crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < buf.length; i++) out += JOIN_CODE_ALPHABET[buf[i] % JOIN_CODE_ALPHABET.length];
  return `CK-${out}`;
}

function getActiveJoinSession() {
  if (!activeJoinSessionCode) return null;
  return getJoinSessions()[activeJoinSessionCode] || null;
}

function createJoinActivitySession(resetResponses = true) {
  const cls = appState.classes.find(c => c.id === currentClassId);
  if (!cls) return null;
  const sessions = getJoinSessions();
  const code = activeJoinSessionCode || generateJoinCode();
  const previous = sessions[code] || {};
  sessions[code] = {
    code,
    classroomId: cls.id,
    roomLabel: `${cls.subject} (${cls.className})`,
    question: getJoinQuestion(),
    answerType: getJoinAnswerType(),
    options: getJoinOptions(),
    displayMode: getJoinDisplayMode(),
    status: 'open',
    createdAt: previous.createdAt || new Date().toISOString(),
    studentsSnapshot: (cls.students || []).map(s => ({
      id: s.id,
      name: s.name || '',
      no: s.no || s.studentNo || '',
      studentCode: s.studentCode || ''
    })),
    responses: resetResponses ? [] : (previous.responses || [])
  };
  activeJoinSessionCode = code;
  saveJoinSessions(sessions);
  updateJoinShareBox(sessions[code]);
  return sessions[code];
}

function updateJoinActivitySessionFromForm() {
  const session = getActiveJoinSession();
  if (!session) return createJoinActivitySession(false);
  const sessions = getJoinSessions();
  sessions[session.code] = {
    ...session,
    question: getJoinQuestion(),
    answerType: getJoinAnswerType(),
    options: getJoinOptions(),
    displayMode: getJoinDisplayMode()
  };
  saveJoinSessions(sessions);
  updateJoinShareBox(sessions[session.code]);
  return sessions[session.code];
}

function getJoinUrl(code) {
  return `${location.origin}${location.pathname}#join:${encodeURIComponent(code)}`;
}

function updateJoinShareBox(session) {
  if (!session) return;
  const url = getJoinUrl(session.code);
  const codeEl = document.getElementById('join-code-label');
  const linkEl = document.getElementById('join-link-label');
  const qrEl = document.getElementById('join-qr-img');
  if (codeEl) codeEl.innerText = session.code;
  if (linkEl) {
    linkEl.innerText = url;
    linkEl.href = url;
  }
  if (qrEl) {
    qrEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
  }
}

function renderJoinActivityPreview() {
  const answerType = document.getElementById('join-answer-type')?.value || 'short';
  const optionWrap = document.getElementById('join-options-wrap');
  if (optionWrap) optionWrap.style.display = answerType === 'choice' ? 'block' : 'none';
  const session = updateJoinActivitySessionFromForm();
  const responses = session ? (session.responses || []) : [];

  const liveWall = document.getElementById('join-live-wall');
  const pendingList = document.getElementById('join-pending-list');
  const totalEl = document.getElementById('join-stat-total');
  const pendingEl = document.getElementById('join-stat-pending');
  if (!liveWall || !pendingList) return;

  const displayMode = getJoinDisplayMode();
  const question = getJoinQuestion();
  const pendingCount = responses.filter(r => r.status !== 'matched').length;
  if (totalEl) totalEl.innerText = responses.length;
  if (pendingEl) pendingEl.innerText = pendingCount;

  if (displayMode === 'count') {
    liveWall.innerHTML = `
      <div class="ck-join-count-wall">
        <span>${responses.length}</span>
        <strong>คำตอบแล้ว</strong>
        <small>${question}</small>
      </div>`;
  } else if (responses.length === 0) {
    liveWall.innerHTML = '<div class="ck-join-empty">ยังไม่มีคำตอบจากนักเรียน</div>';
  } else {
    liveWall.innerHTML = responses.map((r, idx) => {
      const name = displayMode === 'nickname' ? (r.nickname || `นักเรียน ${idx + 1}`) : `นักเรียนคนที่ ${idx + 1}`;
      return `<div class="ck-join-answer-card"><strong>${name}</strong><span>${escapeJoinHtml(r.answer)}</span></div>`;
    }).join('');
  }

  pendingList.innerHTML = responses.map((r) => {
    const statusText = r.status === 'matched' ? 'พบในรายชื่อเดิม' : 'รอตรวจสอบ';
    const statusClass = r.status === 'matched' ? 'is-matched' : 'is-pending';
    const fullName = `${r.firstName || '-'} ${r.lastName || ''}`.trim();
    return `
      <div class="ck-join-student-row">
        <div>
          <strong>${escapeJoinHtml(fullName)}</strong>
          <span>ชื่อเล่น ${escapeJoinHtml(r.nickname || '-')} · เลขที่ ${escapeJoinHtml(String(r.no || '-'))} · รหัส ${escapeJoinHtml(r.code || '-')}</span>
        </div>
        <em class="${statusClass}">${statusText}</em>
      </div>`;
  }).join('') || '<div class="ck-join-empty">ยังไม่มีข้อมูลหลังบ้าน</div>';
}

function mockStartJoinActivity() {
  createJoinActivitySession(true);
  renderJoinActivityPreview();
}

function mockAddJoinResponse() {
  const session = getActiveJoinSession() || createJoinActivitySession(false);
  if (!session) return;
  const sessions = getJoinSessions();
  const responses = sessions[session.code].responses || [];
  if (responses.length < JOIN_ACTIVITY_SAMPLE.length) {
    responses.push({ ...JOIN_ACTIVITY_SAMPLE[responses.length], id: `sample-${Date.now()}` });
  } else {
    const next = responses.length + 1;
    responses.push({
      id: `sample-${Date.now()}`,
      firstName: `นักเรียนใหม่ ${next}`,
      lastName: '',
      nickname: `คนที่ ${next}`,
      no: '',
      code: '',
      answer: next % 2 ? 'อยากทำกิจกรรมกลุ่ม' : 'ยังไม่พร้อม',
      status: 'pending'
    });
  }
  sessions[session.code].responses = responses;
  saveJoinSessions(sessions);
  renderJoinActivityPreview();
}

function showPublicJoinScreen() {
  const code = decodeURIComponent((location.hash || '').replace(/^#join:/, '').trim());
  const sessions = getJoinSessions();
  const session = sessions[code];
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('main-app').style.display = 'none';
  const screen = document.getElementById('public-join-screen');
  if (screen) screen.style.display = 'flex';
  if (!session) {
    document.getElementById('public-join-room').innerText = 'ไม่พบกิจกรรม';
    document.getElementById('public-join-code').innerText = code || '-';
    document.getElementById('public-join-question').innerText = 'ลิงก์นี้หมดอายุหรือยังไม่ได้เปิดจากเครื่องนี้';
    document.getElementById('public-join-answer-area').innerHTML = '';
    return;
  }
  document.getElementById('public-join-room').innerText = session.roomLabel || 'เข้าร่วมห้องเรียน';
  document.getElementById('public-join-code').innerText = session.code;
  document.getElementById('public-join-question').innerText = session.question || 'ตอบคำถามเช็กอิน';
  renderPublicJoinAnswer(session);
}

function renderPublicJoinAnswer(session) {
  const area = document.getElementById('public-join-answer-area');
  if (!area) return;
  if (session.answerType === 'choice' && session.options && session.options.length) {
    area.innerHTML = session.options.map((opt, idx) => `
      <label class="ck-public-choice">
        <input type="radio" name="public-answer-choice" value="${escapeJoinHtml(opt)}" ${idx === 0 ? 'checked' : ''}>
        <span>${escapeJoinHtml(opt)}</span>
      </label>`).join('');
  } else if (session.answerType === 'scale') {
    area.innerHTML = `
      <div class="ck-public-scale">
        ${[1,2,3,4,5].map(n => `<label><input type="radio" name="public-answer-choice" value="${n}" ${n === 3 ? 'checked' : ''}><span>${n}</span></label>`).join('')}
      </div>`;
  } else {
    area.innerHTML = '<textarea id="public-answer-text" class="form-control" rows="3" placeholder="พิมพ์คำตอบของคุณ"></textarea>';
  }
}

function getPublicJoinAnswer() {
  const text = document.getElementById('public-answer-text');
  if (text) return text.value.trim();
  return document.querySelector('input[name="public-answer-choice"]:checked')?.value || '';
}

function submitPublicJoinResponse() {
  const code = decodeURIComponent((location.hash || '').replace(/^#join:/, '').trim());
  const sessions = getJoinSessions();
  const session = sessions[code];
  if (!session) return;
  const firstName = document.getElementById('public-first-name').value.trim();
  const nickname = document.getElementById('public-nickname').value.trim();
  const no = document.getElementById('public-student-no').value.trim();
  const studentCode = document.getElementById('public-student-code').value.trim();
  const answer = getPublicJoinAnswer();
  if (!firstName || !nickname || (!no && !studentCode) || !answer) {
    alert('กรุณากรอกชื่อจริง ชื่อเล่น เลขที่หรือรหัสนักเรียน และคำตอบ');
    return;
  }
  const matched = matchPublicJoinStudent(session, firstName, no, studentCode);
  sessions[code].responses = sessions[code].responses || [];
  sessions[code].responses.push({
    id: `resp-${Date.now()}`,
    firstName,
    lastName: '',
    nickname,
    no,
    code: studentCode,
    answer,
    status: matched ? 'matched' : 'pending',
    createdAt: new Date().toISOString()
  });
  saveJoinSessions(sessions);
  document.getElementById('public-join-form-card').style.display = 'none';
  document.getElementById('public-join-success').style.display = 'block';
}

function matchPublicJoinStudent(session, firstName, no, studentCode) {
  const students = session.studentsSnapshot || [];
  const normalizedName = firstName.replace(/\s+/g, '').toLowerCase();
  return students.some(s => {
    const codeMatch = studentCode && String(s.studentCode || '') === String(studentCode);
    const noMatch = no && String(s.no || '') === String(no);
    const nameMatch = normalizedName && String(s.name || '').replace(/\s+/g, '').toLowerCase().includes(normalizedName);
    return codeMatch || (noMatch && nameMatch);
  });
}

function escapeJoinHtml(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[ch]));
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
