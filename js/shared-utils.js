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

  // เลิกนับ/แสดงสถิติ มา-สาย-ขาด-ลา ในหน้านี้แล้ว — modal นี้เป็น "แก้ไขข้อมูล" อย่างเดียว
  // ดูรายงานเข้าเรียนได้ที่หน้ารายงาน หรือ modal สรุปนักเรียน (openStudentSummaryModal)
  document.getElementById('modal-student-detail').classList.add('show');
}

function closeStudentDetailModal() { document.getElementById('modal-student-detail').classList.remove('show'); }

// modal สรุปนักเรียน (ดูข้อมูล view-only): เข้าเรียน + คะแนน/เกรด — คนละอันกับหน้าแก้ไข
function openStudentSummaryModal(studentId, classId) {
  const c = appState.classes.find(x => x.id === (classId || currentClassId));
  if (!c) return;
  const s = c.students.find(x => x.id === studentId);
  if (!s) return;

  document.getElementById('student-summary-name').innerText = s.nickname ? `${s.name} (${s.nickname})` : s.name;
  document.getElementById('student-summary-class').innerText = `${c.subject} (${c.className})`;
  // เลขที่ + เลขประจำตัว
  const codeTxt = s.studentCode ? String(s.studentCode) : '—';
  document.getElementById('student-summary-idline').innerHTML =
    `<span>เลขที่ <b style="color:var(--text-main);">${s.no || '—'}</b></span><span>เลขประจำตัว <b style="color:var(--text-main);">${codeTxt}</b></span>`;

  // นับเข้าเรียน (เหมือนหน้าแก้ไข)
  let p = 0, l = 0, a = 0, lv = 0;
  Object.keys(c.attendance || {}).forEach(d => {
    const st = (c.attendance[d] || {})[studentId];
    if (st === 'present') p++; else if (st === 'late') l++; else if (st === 'absent') a++; else if (st === 'leave') lv++;
  });
  document.getElementById('student-summary-present').innerText = p;
  document.getElementById('student-summary-late').innerText = l;
  document.getElementById('student-summary-absent').innerText = a;
  document.getElementById('student-summary-leave').innerText = lv;
  const pct = (typeof studentAttendancePct === 'function') ? studentAttendancePct(c, studentId) : null;
  document.getElementById('student-summary-attpct').innerText = (pct !== null && !isNaN(pct)) ? `เวลาเรียน ${pct}%` : '';

  // คะแนน + เกรด (ปพ.5) — reuse computeStudentScore
  const sc = computeStudentScore(c, studentId);
  const grade = (typeof effectiveGrade === 'function') ? effectiveGrade(c, studentId) : sc.grade;
  document.getElementById('student-summary-total').innerText = sc.total;
  document.getElementById('student-summary-grade').innerText = grade;
  const r1 = v => Math.round(v * 10) / 10;
  // 3 ช่องตาม ปพ.5 — คะแนนเก็บ(ก่อน+หลัง) / สอบกลางภาค / สอบปลายภาค · หาร weight จาก config.ratio
  const collect    = r1(sc.cats.before.scaled + sc.cats.after.scaled);
  const collectMax = r1(sc.cats.before.weight + sc.cats.after.weight);
  document.getElementById('student-summary-collect').innerText = collect;
  document.getElementById('student-summary-collect-max').innerText = `/${collectMax}`;
  document.getElementById('student-summary-mid').innerText = r1(sc.cats.mid.scaled);
  document.getElementById('student-summary-mid-max').innerText = `/${r1(sc.cats.mid.weight)}`;
  document.getElementById('student-summary-final').innerText = r1(sc.cats.final.scaled);
  document.getElementById('student-summary-final-max').innerText = `/${r1(sc.cats.final.weight)}`;
  const anyScore = ['before', 'after', 'mid', 'final'].some(k => sc.cats[k].has);
  document.getElementById('student-summary-breakdown').innerText = anyScore ? '' : 'ยังไม่มีการกรอกคะแนน';

  // ปุ่มสะพานไปหน้าแก้ไข
  document.getElementById('student-summary-edit-btn').onclick = function () { closeStudentSummaryModal(); openStudentDetailModal(studentId, c.id); };
  // ปุ่มลบนักเรียน (ทางลบหลักบนมือถือ — แถวไม่มีปุ่มลบแล้ว)
  document.getElementById('student-summary-delete-btn').onclick = function () { currentClassId = c.id; closeStudentSummaryModal(); deleteStudent(studentId); };

  document.getElementById('modal-student-summary').classList.add('show');
}

function closeStudentSummaryModal() { document.getElementById('modal-student-summary').classList.remove('show'); }

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
  } else if (appState.activeWebScreen === 'scores' && typeof scoreCurrentClassId !== 'undefined' && scoreCurrentClassId) {
    // แก้จากหน้าคะแนน → refresh ตารางคะแนน (ชื่อ/รหัส/เลขที่อัปเดต ลิ้งกับข้อมูลชุดเดียว)
    renderScoreMatrix(c);
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
    pruneEmptyAttendance();
  }
  else { initAppStateDefault(); }
}

// ลบ record เช็คชื่อที่ว่างเปล่า (ไม่มีนักเรียนสักคน) — กันรายงานนับเป็น "คาบ 0%" ค้าง
// เกิดจากโค้ดเก่าที่เก็บ c.attendance[date] = {} ตอนล้าง/ยกเลิกเช็ค. คืน true ถ้ามีการลบ
function pruneEmptyAttendance() {
  let changed = false;
  (appState.classes || []).forEach(c => {
    if (!c.attendance) return;
    Object.keys(c.attendance).forEach(d => {
      const rec = c.attendance[d];
      if (!rec || Object.keys(rec).length === 0) { delete c.attendance[d]; changed = true; }
    });
  });
  return changed;
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
        pruneEmptyAttendance();
        saveStateLocalOnly(false);
        updateProfileImages();
        // deep-link (LINE OA) ชนะ activeWebScreen ที่ค้างใน cloud — แต่ถ้าผู้ใช้เปลี่ยนหน้าเองแล้ว pendingDeepLink=null
        navigateToWebScreen(pendingDeepLink || appState.activeWebScreen || 'dashboard', pendingDeepLinkParam);
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
      pruneEmptyAttendance();
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
        // ล้างเนื้อข้อมูลก่อนเสมอ แล้วค่อยลองลบทั้งแถว
        // (ถ้าไม่มี DELETE policy ใน RLS คำสั่ง delete จะถูกบล็อกแบบเงียบ — คืน 0 แถว ไม่คืน error
        //  ถ้าไปเช็ค error แล้วค่อยล้าง แผนสำรองจะไม่ทำงาน แล้วข้อมูลจะถูกดึงกลับมาตอนซิงก์ครั้งถัดไป)
        await supabaseClient.from('classmanager_profiles').upsert({
          email,
          state: { classes: [], timetable: [], lastModified: Date.now() },
          updated_at: new Date().toISOString()
        });
        await supabaseClient.from('classmanager_profiles').delete().eq('email', email);
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

