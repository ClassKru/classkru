/**
 * Continuous QR score entry.
 * Reuses appState + classmanager_profiles.state instead of introducing a second score schema.
 */

const QR_SCORE_SCANNER_SRC = 'js/vendor/html5-qrcode.min.js';
const QR_SCORE_COOLDOWN_MS = 1250;

let qrScoreScanner = null;
let qrScoreLibraryPromise = null;
let qrScoreState = createQrScoreState();

function createQrScoreState() {
  return {
    classId: null,
    itemId: null,
    studentId: null,
    defaultScore: '',
    originScores: false,
    setupTouched: false,
    phase: 'idle',
    blockedCode: null,
    lastSeenAt: 0,
    cameraClearTimer: null,
    successTimer: null
  };
}

function qrScoreEsc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
}

function qrScoreGradeLabel(c) {
  const room = String(c?.className || '').trim();
  const roomPrefix = room.split('/')[0].trim();
  if (roomPrefix) return roomPrefix;
  const level = String(c?.gradeLevel || '').toLowerCase();
  const m = level.match(/^([pm])(\d)$/);
  if (m) return `${m[1] === 'p' ? 'ป.' : 'ม.'}${m[2]}`;
  return level || 'ไม่ระบุ';
}

function qrScoreClasses() {
  return (appState.classes || []).filter(c => c && c.id);
}

function qrScoreUnique(values) {
  return [...new Set(values.filter(v => v !== undefined && v !== null && String(v).trim() !== '').map(String))];
}

function qrScoreNaturalSort(values) {
  return [...values].sort((a, b) => String(a).localeCompare(String(b), 'th', { numeric: true, sensitivity: 'base' }));
}

function qrScoreAcademicYears(classes) {
  return qrScoreUnique(classes.map(c => c.academicYear))
    .sort((a, b) => Number(b) - Number(a));
}

function qrScoreSetOptions(id, values, selected, placeholder, labeler) {
  const select = document.getElementById(id);
  if (!select) return '';
  const opts = values.map(value => ({ value: String(value), label: labeler ? labeler(value) : String(value) }));
  select.innerHTML = `<option value="">${qrScoreEsc(placeholder)}</option>` + opts.map(o => `<option value="${qrScoreEsc(o.value)}">${qrScoreEsc(o.label)}</option>`).join('');
  if (selected && opts.some(o => o.value === String(selected))) select.value = String(selected);
  select.disabled = opts.length === 0;
  return select.value;
}

function openQrScoreScanner(classId, itemId) {
  const modal = document.getElementById('modal-qr-score');
  if (!modal) return;
  qrScoreState = createQrScoreState();
  qrScoreState.originScores = Boolean(classId && classId === scoreCurrentClassId);
  document.getElementById('qr-score-setup').style.display = 'block';
  document.getElementById('qr-score-scan').style.display = 'none';
  document.getElementById('qr-score-setup-error').textContent = '';
  document.getElementById('qr-score-save-error').textContent = '';
  modal.classList.add('show');
  renderQrScoreSetup(classId, itemId);

  const c = qrScoreClasses().find(x => x.id === classId);
  const item = c && ensureScores(c).items.find(x => x.id === itemId);
  if (c && item) beginQrScoreScan(classId, itemId);
}

function openQrScoreScannerFromScores() {
  const c = qrScoreClasses().find(x => x.id === scoreCurrentClassId);
  if (!c) { showToast('กรุณาเปิดห้องเรียนก่อน', 'warning'); return; }
  const items = scoreOrderedItems(c);
  if (!items.length) { showToast('กรุณาเพิ่มงานก่อนเปิด QR Scanner', 'warning'); return; }
  const preferred = items.find(i => i.id === quickScoreItemId) || (items.length === 1 ? items[0] : null);
  openQrScoreScanner(c.id, preferred?.id || null);
}

function openStudentQrCards(classId) {
  const selectedId = classId || document.getElementById('qr-score-subject')?.value || qrScoreState.classId || currentClassId;
  const c = qrScoreClasses().find(x => x.id === selectedId);
  if (!c) { showToast('กรุณาเลือกห้องเรียนก่อนพิมพ์ QR', 'warning'); return; }
  if (!c.students?.length) { showToast('ห้องนี้ยังไม่มีรายชื่อนักเรียน', 'warning'); return; }
  const url = `student-qr-cards.html?classId=${encodeURIComponent(c.id)}`;
  const tab = window.open(url, '_blank');
  if (tab) tab.opener = null;
  if (!tab) showToast('เบราว์เซอร์บล็อกหน้าพิมพ์ QR กรุณาอนุญาต Pop-up', 'warning');
}

function openStudentQrCardsFromRoster() {
  const classId = document.getElementById('web-student-class-filter')?.value || currentClassId;
  openStudentQrCards(classId);
}

function renderQrScoreSetup(prefillClassId, prefillItemId) {
  const classes = qrScoreClasses();
  const prefill = classes.find(c => c.id === prefillClassId);
  const year = prefill ? String(prefill.academicYear || '') : '';
  const grade = prefill ? qrScoreGradeLabel(prefill) : '';
  const room = prefill ? String(prefill.className || '') : '';
  const byYear = year ? classes.filter(c => String(c.academicYear) === year) : [];
  const byGrade = year && grade ? byYear.filter(c => qrScoreGradeLabel(c) === grade) : [];
  const subjectClasses = year && grade && room ? byGrade.filter(c => String(c.className) === room) : [];

  qrScoreSetOptions('qr-score-year', qrScoreAcademicYears(classes), year, classes.length ? '-- เลือกปีการศึกษา --' : 'ยังไม่มีข้อมูลห้องเรียน');
  qrScoreSetOptions('qr-score-grade', year ? qrScoreNaturalSort(qrScoreUnique(byYear.map(qrScoreGradeLabel))) : [], grade, year ? '-- เลือกระดับชั้น --' : '');
  qrScoreSetOptions('qr-score-room', year && grade ? qrScoreNaturalSort(qrScoreUnique(byGrade.map(c => c.className))) : [], room, year && grade ? '-- เลือกห้องเรียน --' : '');
  subjectClasses.sort((a, b) => String(a.subject || '').localeCompare(String(b.subject || ''), 'th', { numeric: true, sensitivity: 'base' }));
  qrScoreSetOptions('qr-score-subject', subjectClasses.map(c => c.id), prefill?.id || '', room ? '-- เลือกวิชา --' : '', id => subjectClasses.find(c => c.id === id)?.subject || id);
  const items = prefill ? scoreOrderedItems(prefill) : [];
  qrScoreSetOptions('qr-score-item', items.map(i => i.id), prefillItemId || '', prefill ? (items.length ? '-- เลือกงาน --' : 'ยังไม่มีงานในวิชานี้') : '', id => {
    const item = items.find(i => i.id === id);
    return item ? `${item.name} / ${item.max}` : id;
  });
  updateQrScoreMax();
  updateQrScoreSetupState();
}

function qrScoreSetupChanged(level) {
  qrScoreState.setupTouched = true;
  const classes = qrScoreClasses();
  let year = document.getElementById('qr-score-year').value;
  let grade = document.getElementById('qr-score-grade').value;
  let room = document.getElementById('qr-score-room').value;
  let classId = document.getElementById('qr-score-subject').value;
  let itemId = document.getElementById('qr-score-item').value;

  if (level === 'year') { grade = ''; room = ''; classId = ''; itemId = ''; }
  if (level === 'grade') { room = ''; classId = ''; itemId = ''; }
  if (level === 'room') { classId = ''; itemId = ''; }
  if (level === 'subject') itemId = '';

  const byYear = year ? classes.filter(c => String(c.academicYear) === year) : [];
  grade = qrScoreSetOptions('qr-score-grade', year ? qrScoreNaturalSort(qrScoreUnique(byYear.map(qrScoreGradeLabel))) : [], grade, year ? '-- เลือกระดับชั้น --' : '');
  const byGrade = year && grade ? byYear.filter(c => qrScoreGradeLabel(c) === grade) : [];
  room = qrScoreSetOptions('qr-score-room', year && grade ? qrScoreNaturalSort(qrScoreUnique(byGrade.map(c => c.className))) : [], room, year && grade ? '-- เลือกห้องเรียน --' : '');
  const byRoom = year && grade && room ? byGrade.filter(c => String(c.className) === room) : [];
  byRoom.sort((a, b) => String(a.subject || '').localeCompare(String(b.subject || ''), 'th', { numeric: true, sensitivity: 'base' }));
  classId = qrScoreSetOptions('qr-score-subject', byRoom.map(c => c.id), classId, room ? '-- เลือกวิชา --' : '', id => byRoom.find(c => c.id === id)?.subject || id);
  const selectedClass = classes.find(c => c.id === classId);
  const items = selectedClass ? scoreOrderedItems(selectedClass) : [];
  qrScoreSetOptions('qr-score-item', items.map(i => i.id), itemId, selectedClass ? (items.length ? '-- เลือกงาน --' : 'ยังไม่มีงานในวิชานี้') : '', id => {
    const item = items.find(i => i.id === id);
    return item ? `${item.name} / ${item.max}` : id;
  });
  const defaultScore = document.getElementById('qr-score-default-score');
  if (defaultScore) defaultScore.value = '';
  updateQrScoreMax();
  updateQrScoreSetupState();
  document.getElementById('qr-score-setup-error').textContent = '';
}

// Login starts cloud sync in the background. If the QR setup is already open and
// the teacher has not touched it yet, refresh it once the real cloud state arrives.
function refreshQrScoreSetupAfterCloudSync() {
  const modal = document.getElementById('modal-qr-score');
  if (!modal?.classList.contains('show') || qrScoreState.phase !== 'idle' || qrScoreState.setupTouched) return;
  const classId = document.getElementById('qr-score-subject')?.value || null;
  const itemId = document.getElementById('qr-score-item')?.value || null;
  renderQrScoreSetup(classId, itemId);
}

function updateQrScoreSetupState() {
  const classes = qrScoreClasses();
  const classId = document.getElementById('qr-score-subject')?.value || '';
  const itemId = document.getElementById('qr-score-item')?.value || '';
  const selectedClass = classes.find(c => c.id === classId);
  const items = selectedClass ? scoreOrderedItems(selectedClass) : [];
  const button = document.getElementById('qr-score-print-cards');
  if (button) button.disabled = !classId;
  const startButton = document.getElementById('qr-score-start-btn');
  if (startButton) startButton.disabled = !classId || !itemId;

  const status = document.getElementById('qr-score-data-status');
  if (!status) return;
  if (!classes.length) {
    status.innerHTML = '<i class="hgi-stroke hgi-alert-02"></i><span>ยังไม่มีข้อมูลห้องเรียน กรุณาสร้างห้องเรียนก่อนใช้งาน</span>';
    status.className = 'qr-score-data-status is-warning';
  } else if (selectedClass && !items.length) {
    status.innerHTML = '<i class="hgi-stroke hgi-alert-02"></i><span>วิชานี้ยังไม่มีงาน กรุณาเพิ่มงานในหน้าตารางคะแนนก่อน</span>';
    status.className = 'qr-score-data-status is-warning';
  } else {
    status.innerHTML = `<i class="hgi-stroke hgi-database"></i><span>ดึงจากข้อมูลจริงของคุณครู ${classes.length} วิชา</span>`;
    status.className = 'qr-score-data-status';
  }
}

function updateQrScoreMax() {
  const classId = document.getElementById('qr-score-subject')?.value;
  const itemId = document.getElementById('qr-score-item')?.value;
  const c = qrScoreClasses().find(x => x.id === classId);
  const item = c && ensureScores(c).items.find(x => x.id === itemId);
  const max = document.getElementById('qr-score-max');
  if (max) max.textContent = item ? `/${item.max}` : '/—';
  const defaultScore = document.getElementById('qr-score-default-score');
  if (defaultScore) {
    defaultScore.disabled = !item;
    defaultScore.max = item ? String(item.max) : '';
  }
}

async function beginQrScoreScan(forcedClassId, forcedItemId) {
  const activeState = qrScoreState;
  const classId = forcedClassId || document.getElementById('qr-score-subject')?.value;
  const itemId = forcedItemId || document.getElementById('qr-score-item')?.value;
  const c = qrScoreClasses().find(x => x.id === classId);
  const item = c && ensureScores(c).items.find(x => x.id === itemId);
  const errorEl = document.getElementById('qr-score-setup-error');
  if (!c || !item) {
    if (errorEl) errorEl.textContent = 'กรุณาเลือกปี ระดับชั้น ห้อง วิชา และงานให้ครบ';
    return;
  }
  if (!c.students?.length) {
    if (errorEl) errorEl.textContent = 'ห้องนี้ยังไม่มีรายชื่อนักเรียน';
    return;
  }
  const defaultScoreInput = document.getElementById('qr-score-default-score');
  const defaultScore = defaultScoreInput?.value?.trim() || '';
  if (defaultScore !== '') {
    const numericDefault = Number(defaultScore);
    if (!Number.isFinite(numericDefault) || numericDefault < 0 || numericDefault > Number(item.max)) {
      if (errorEl) errorEl.textContent = `คะแนนต้องอยู่ระหว่าง 0–${item.max}`;
      defaultScoreInput?.focus();
      defaultScoreInput?.select();
      return;
    }
  }

  qrScoreState.classId = c.id;
  qrScoreState.itemId = item.id;
  qrScoreState.defaultScore = defaultScore;
  qrScoreState.phase = 'starting';
  document.getElementById('qr-score-setup').style.display = 'none';
  document.getElementById('qr-score-scan').style.display = 'block';
  document.getElementById('qr-score-context').innerHTML = `<div><strong>${qrScoreEsc(c.className)} • ${qrScoreEsc(c.subject)}</strong><span>${qrScoreEsc(item.name)} / ${qrScoreEsc(item.max)} คะแนน · ปี ${qrScoreEsc(c.academicYear || '—')}</span></div><button type="button" onclick="openStudentQrCards('${qrScoreEsc(c.id)}')"><i class="hgi-stroke hgi-printer"></i> พิมพ์ QR นักเรียน</button>`;
  resetQrScoreResult();
  setQrScoreStatus('กำลังเปิดกล้อง…', 'loading');
  const cameraPlaceholder = document.getElementById('qr-score-camera-placeholder');
  cameraPlaceholder.style.display = 'flex';
  cameraPlaceholder.innerHTML = '<i class="hgi-stroke hgi-camera-01"></i><strong>กำลังขอสิทธิ์กล้อง…</strong><span>เมื่อมือถือถาม กรุณาเลือก “อนุญาต”</span>';

  try {
    await startQrScoreCamera();
    if (qrScoreState !== activeState || activeState.phase === 'stopping') {
      await stopQrScoreCamera();
      return;
    }
    qrScoreState.phase = 'scanning';
    setQrScoreStatus('พร้อมสแกนนักเรียน', 'ready');
  } catch (error) {
    console.warn('QR score camera error:', error);
    qrScoreState.phase = 'scanning';
    showQrScoreCameraError(error);
  }
}

function getQrScoreCameraErrorInfo(error) {
  const raw = `${error?.name || ''} ${error?.message || ''} ${String(error || '')}`.toLowerCase();
  const inAppBrowser = /line\/|\bline\b|fban|fbav|instagram|micromessenger/i.test(navigator.userAgent || '');
  if (!window.isSecureContext) {
    return { title: 'ต้องเปิดผ่านเว็บไซต์ HTTPS', detail: 'กล้องใช้งานได้เฉพาะการเชื่อมต่อที่ปลอดภัย กรุณาเปิดเว็บไซต์ ClassKru โดยตรง' };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return inAppBrowser
      ? { title: 'เบราว์เซอร์ในแอปนี้ไม่รองรับกล้อง', detail: 'แตะเมนูของแอป แล้วเลือก “เปิดใน Safari” หรือ “เปิดใน Chrome”' }
      : { title: 'เบราว์เซอร์นี้ไม่รองรับกล้อง', detail: 'กรุณาเปิด ClassKru ด้วย Safari หรือ Chrome เวอร์ชันล่าสุด' };
  }
  if (/notallowed|permission|denied|securityerror/.test(raw)) {
    return { title: 'ยังไม่ได้รับอนุญาตให้ใช้กล้อง', detail: 'อนุญาต Camera ในการตั้งค่าเว็บไซต์ของ Safari/Chrome แล้วกด “ลองเปิดกล้องอีกครั้ง”' };
  }
  if (/notfound|devicesnotfound|no camera/.test(raw)) {
    return { title: 'ไม่พบกล้องบนอุปกรณ์นี้', detail: 'ตรวจสอบว่ามือถือมีกล้องที่พร้อมใช้งาน หรือกรอกรหัส QR ด้านล่างแทน' };
  }
  if (/notreadable|trackstarterror|could not start|in use/.test(raw)) {
    return { title: 'กล้องกำลังถูกใช้งานอยู่', detail: 'ปิดแอปอื่นที่ใช้กล้อง แล้วกด “ลองเปิดกล้องอีกครั้ง”' };
  }
  return inAppBrowser
    ? { title: 'เปิดกล้องในเบราว์เซอร์นี้ไม่สำเร็จ', detail: 'ลองเปิด ClassKru ใน Safari/Chrome หรือกดลองเปิดกล้องอีกครั้ง' }
    : { title: 'เปิดกล้องไม่สำเร็จ', detail: 'ตรวจสิทธิ์กล้องของเว็บไซต์ แล้วกดลองเปิดกล้องอีกครั้ง' };
}

function showQrScoreCameraError(error) {
  const info = getQrScoreCameraErrorInfo(error);
  const placeholder = document.getElementById('qr-score-camera-placeholder');
  if (placeholder) {
    placeholder.style.display = 'flex';
    placeholder.innerHTML = `<i class="hgi-stroke hgi-camera-off-01"></i><strong>${qrScoreEsc(info.title)}</strong><span>${qrScoreEsc(info.detail)}</span><button type="button" onclick="retryQrScoreCamera()"><i class="hgi-stroke hgi-camera-01"></i> อนุญาตกล้อง / ลองใหม่</button>`;
  }
  setQrScoreStatus(`${info.title} — หรือกรอกรหัส QR ด้านล่าง`, 'error');
}

async function retryQrScoreCamera() {
  if (!document.getElementById('modal-qr-score')?.classList.contains('show') || qrScoreState.phase === 'stopping') return;
  qrScoreState.phase = 'starting';
  const placeholder = document.getElementById('qr-score-camera-placeholder');
  if (placeholder) {
    placeholder.style.display = 'flex';
    placeholder.innerHTML = '<i class="hgi-stroke hgi-camera-01"></i><strong>กำลังขอสิทธิ์กล้อง…</strong><span>เมื่อมือถือถาม กรุณาเลือก “อนุญาต”</span>';
  }
  setQrScoreStatus('กำลังขอสิทธิ์และเปิดกล้อง…', 'loading');
  try {
    await startQrScoreCamera();
    if (!document.getElementById('modal-qr-score')?.classList.contains('show') || qrScoreState.phase === 'stopping') {
      await stopQrScoreCamera();
      return;
    }
    qrScoreState.phase = 'scanning';
    setQrScoreStatus('พร้อมสแกนนักเรียน', 'ready');
  } catch (error) {
    console.warn('QR score camera retry error:', error);
    qrScoreState.phase = 'scanning';
    showQrScoreCameraError(error);
  }
}

function ensureQrScoreLibrary() {
  if (window.Html5Qrcode) return Promise.resolve();
  if (qrScoreLibraryPromise) return qrScoreLibraryPromise;
  qrScoreLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = QR_SCORE_SCANNER_SRC;
    script.async = true;
    script.onload = () => {
      if (window.Html5Qrcode) resolve();
      else { qrScoreLibraryPromise = null; reject(new Error('QR scanner library unavailable')); }
    };
    script.onerror = () => { qrScoreLibraryPromise = null; reject(new Error('โหลด QR scanner ไม่สำเร็จ')); };
    document.head.appendChild(script);
  });
  return qrScoreLibraryPromise;
}

async function startQrScoreCamera() {
  if (!window.isSecureContext) throw new DOMException('Camera requires a secure HTTPS context', 'SecurityError');
  if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('Camera API is unavailable in this browser', 'NotSupportedError');
  await ensureQrScoreLibrary();
  if (qrScoreScanner) await stopQrScoreCamera();
  const formats = window.Html5QrcodeSupportedFormats ? [window.Html5QrcodeSupportedFormats.QR_CODE] : undefined;
  qrScoreScanner = new window.Html5Qrcode('qr-score-reader', formats ? { formatsToSupport: formats, verbose: false } : { verbose: false });
  const scanConfig = { fps: 12, qrbox: (w, h) => { const size = Math.floor(Math.min(w, h) * 0.72); return { width: size, height: size }; }, aspectRatio: 1 };
  const onSuccess = decoded => handleQrScoreDecoded(decoded);
  const onFailure = () => noteQrScoreNoCode();
  let cameraIdOrConfig = { facingMode: 'environment' };
  if (window.Html5Qrcode.getCameras) {
    const cameras = await window.Html5Qrcode.getCameras(); // requests permission before labels are available on mobile
    if (!cameras?.length) throw new DOMException('No camera found', 'NotFoundError');
    const rear = cameras.find(camera => /back|rear|environment|หลัง/i.test(camera.label || '')) || cameras[cameras.length - 1];
    cameraIdOrConfig = rear.id;
  }
  try {
    await qrScoreScanner.start(cameraIdOrConfig, scanConfig, onSuccess, onFailure);
  } catch (firstError) {
    const denied = /notallowed|permission|denied|securityerror/i.test(String(firstError?.name || firstError?.message || firstError));
    if (denied || typeof cameraIdOrConfig !== 'string') throw firstError;
    await qrScoreScanner.start({ facingMode: 'environment' }, scanConfig, onSuccess, onFailure);
  }
  document.getElementById('qr-score-camera-placeholder').style.display = 'none';
}

async function stopQrScoreCamera() {
  clearTimeout(qrScoreState.cameraClearTimer);
  if (!qrScoreScanner) return;
  try {
    if (qrScoreScanner.isScanning) await qrScoreScanner.stop();
  } catch (error) {
    console.warn('QR scanner stop error:', error);
  }
  try { qrScoreScanner.clear(); } catch (_) { /* reader may already be clear */ }
  qrScoreScanner = null;
}

function pauseQrScoreCamera() {
  try { if (qrScoreScanner?.isScanning) qrScoreScanner.pause(true); } catch (_) { /* manual entry has no camera */ }
}

function resumeQrScoreCamera() {
  try { if (qrScoreScanner?.isScanning) qrScoreScanner.resume(); } catch (_) { /* manual entry has no camera */ }
}

function noteQrScoreNoCode() {
  if (qrScoreState.blockedCode && Date.now() - qrScoreState.lastSeenAt >= QR_SCORE_COOLDOWN_MS) {
    qrScoreState.blockedCode = null;
  }
}

function normalizeQrStudentToken(decodedText) {
  const raw = String(decodedText || '').trim();
  if (!raw) return '';
  if (/^CKSTU:/i.test(raw)) return raw.replace(/^CKSTU:/i, '').trim();
  try {
    const url = new URL(raw);
    const fromUrl = url.searchParams.get('student_id') || url.searchParams.get('student');
    if (fromUrl) return fromUrl.trim();
  } catch (_) { /* raw token, not a URL */ }
  if (raw.startsWith('{')) {
    try { return String(JSON.parse(raw).student_id || '').trim(); } catch (_) { /* invalid JSON */ }
  }
  return raw;
}

function findQrScoreStudent(token) {
  const classes = qrScoreClasses();
  const current = classes.find(c => c.id === qrScoreState.classId);
  if (!current) return null;
  let student = current.students?.find(s => String(s.id) === token);
  if (student) return { student, classroom: current, exact: true };
  for (const classroom of classes) {
    student = classroom.students?.find(s => String(s.id) === token);
    if (student) return { student, classroom, exact: true };
  }
  student = current.students?.find(s => String(s.studentCode || '') === token);
  if (student) return { student, classroom: current, exact: false };
  for (const classroom of classes) {
    student = classroom.students?.find(s => s.studentCode && String(s.studentCode) === token);
    if (student) return { student, classroom, exact: false };
  }
  return null;
}

function handleQrScoreDecoded(decodedText) {
  if (qrScoreState.phase !== 'scanning') return;
  const now = Date.now();
  const rawCode = String(decodedText || '').trim();
  if (!rawCode) return;
  if (rawCode === qrScoreState.blockedCode) {
    qrScoreState.lastSeenAt = now;
    return;
  }
  qrScoreState.blockedCode = rawCode;
  qrScoreState.lastSeenAt = now;
  const token = normalizeQrStudentToken(rawCode);
  qrScoreState.phase = 'lookup';
  pauseQrScoreCamera();
  const found = findQrScoreStudent(token);
  if (!found) {
    showQrScoreLookupError('ไม่พบรหัสนักเรียนนี้ในระบบ', `รหัส: ${rawCode}`);
    return;
  }
  if (found.classroom.id !== qrScoreState.classId) {
    showQrScoreLookupError(`นักเรียนคนนี้ไม่ได้อยู่ในห้อง ${qrScoreClasses().find(c => c.id === qrScoreState.classId)?.className || ''}`, `${found.student.name} • ห้อง ${found.classroom.className}`);
    return;
  }
  showQrScoreStudent(found.student, found.classroom);
}

function submitQrScoreManualCode(event) {
  event.preventDefault();
  const input = document.getElementById('qr-score-manual-code');
  const code = input.value.trim();
  if (!code) return;
  qrScoreState.blockedCode = null;
  handleQrScoreDecoded(code);
  input.value = '';
}

function showQrScoreLookupError(title, detail) {
  qrScoreState.studentId = null;
  qrScoreState.phase = 'error';
  const result = document.getElementById('qr-score-result');
  result.style.display = 'block';
  result.classList.add('is-error');
  document.getElementById('qr-score-result-state').innerHTML = `<strong>⚠️ ${qrScoreEsc(title)}</strong><span>${qrScoreEsc(detail)}</span>`;
  document.querySelector('.qr-score-student').style.display = 'none';
  document.querySelector('.qr-score-old').style.display = 'none';
  document.getElementById('qr-score-new-wrap').style.display = 'none';
  document.getElementById('qr-score-save-btn').style.display = 'none';
  document.getElementById('qr-score-retry-btn').style.display = 'inline-flex';
  setQrScoreStatus('ตรวจสอบ QR แล้วเลือกสแกนใหม่', 'error');
}

function showQrScoreStudent(student, c) {
  const item = ensureScores(c).items.find(i => i.id === qrScoreState.itemId);
  const current = (ensureScores(c).marks[item.id] || {})[student.id];
  qrScoreState.studentId = student.id;
  qrScoreState.phase = 'editing';
  const result = document.getElementById('qr-score-result');
  result.style.display = 'block';
  result.classList.remove('is-error');
  document.getElementById('qr-score-result-state').innerHTML = '<strong>✓ พบข้อมูลนักเรียน</strong><span>ตรวจสอบชื่อก่อนลงคะแนน</span>';
  document.querySelector('.qr-score-student').style.display = 'flex';
  document.querySelector('.qr-score-old').style.display = 'flex';
  document.getElementById('qr-score-new-wrap').style.display = 'block';
  document.getElementById('qr-score-save-btn').style.display = 'inline-flex';
  document.getElementById('qr-score-retry-btn').style.display = 'inline-flex';
  document.getElementById('qr-score-student-name').textContent = student.name || 'นักเรียน';
  document.getElementById('qr-score-student-meta').textContent = `${c.className} • รหัส ${student.studentCode || student.id}`;
  document.getElementById('qr-score-student-avatar').textContent = (student.name || 'น').trim().charAt(0);
  document.getElementById('qr-score-old-score').textContent = current === undefined || current === null || current === '' ? 'ยังไม่มี' : String(current);
  document.getElementById('qr-score-max-label').textContent = `/${item.max}`;
  const input = document.getElementById('qr-score-new-score');
  input.max = item.max;
  input.value = current === undefined || current === null ? qrScoreState.defaultScore : current;
  document.getElementById('qr-score-save-error').textContent = '';
  setQrScoreStatus('กรอกคะแนนแล้วกดบันทึก', 'found');
  setTimeout(() => { input.focus(); input.select(); }, 50);
}

function resetQrScoreResult() {
  qrScoreState.studentId = null;
  const result = document.getElementById('qr-score-result');
  if (result) {
    result.style.display = 'none';
    result.classList.remove('is-error', 'is-success');
  }
  const err = document.getElementById('qr-score-save-error');
  if (err) err.textContent = '';
}

function resumeQrScoreScan() {
  resetQrScoreResult();
  qrScoreState.phase = 'scanning';
  qrScoreState.lastSeenAt = Date.now();
  resumeQrScoreCamera();
  setQrScoreStatus('พร้อมสแกนนักเรียนคนถัดไป', 'ready');
}

function validateQrScore(c, item, student, rawScore) {
  if (!student || !c.students.some(s => s.id === student.id)) return 'ไม่พบนักเรียนหรือถูกนำออกจากระบบแล้ว';
  if (!item || !ensureScores(c).items.some(i => i.id === item.id)) return 'ไม่พบงานนี้ในระบบแล้ว';
  if (!c.academicYear) return 'ไม่พบปีการศึกษาของห้องนี้';
  if (!c.subject || !c.className) return 'ข้อมูลวิชาหรือห้องเรียนไม่สมบูรณ์';
  if (rawScore === '' || rawScore === null || rawScore === undefined) return 'กรุณากรอกคะแนน';
  const score = Number(rawScore);
  if (!Number.isFinite(score)) return 'คะแนนต้องเป็นตัวเลข';
  if (score < 0) return 'คะแนนต้องไม่ติดลบ';
  if (score > Number(item.max)) return `คะแนนต้องไม่เกิน ${item.max}`;
  return '';
}

async function persistQrScore(classId, itemId, studentId, rawScore) {
  const c = qrScoreClasses().find(x => x.id === classId);
  const item = c && ensureScores(c).items.find(i => i.id === itemId);
  const student = c?.students?.find(s => s.id === studentId);
  const validationError = validateQrScore(c, item, student, rawScore);
  if (validationError) return { success: false, message: validationError };
  if (!supabaseClient) return { success: false, message: 'ยังเชื่อมต่อฐานข้อมูลไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต' };

  const email = localStorage.getItem('classmanager_email');
  if (!email) return { success: false, message: 'Session หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง' };
  const score = Number(rawScore);
  const nextState = typeof structuredClone === 'function' ? structuredClone(appState) : JSON.parse(JSON.stringify(appState));
  const nextClass = nextState.classes.find(x => x.id === classId);
  const nextScores = ensureScores(nextClass);
  const nextItem = nextScores.items.find(i => i.id === itemId);
  const oldScore = (nextScores.marks[itemId] || {})[studentId];
  if (!nextScores.marks[itemId]) nextScores.marks[itemId] = {};
  nextScores.marks[itemId][studentId] = score;
  nextState.scoreAuditHistory = Array.isArray(nextState.scoreAuditHistory) ? nextState.scoreAuditHistory : [];
  nextState.scoreAuditHistory.push({
    student_id: studentId,
    assignment_id: itemId,
    class_id: classId,
    academic_year: String(nextClass.academicYear),
    subject: nextClass.subject,
    classroom: nextClass.className,
    old_score: oldScore ?? null,
    new_score: score,
    updated_by: email,
    updated_at: new Date().toISOString(),
    source: 'qr_continuous_scan'
  });
  if (nextState.scoreAuditHistory.length > 2000) nextState.scoreAuditHistory = nextState.scoreAuditHistory.slice(-2000);
  nextState.lastModified = Date.now();

  try {
    clearTimeout(_cloudPushTimer);
    _cloudPushTimer = null;
    updateCloudStatus('syncing', 'กำลังบันทึก...');
    await enqueueCloudStateWrite(email, nextState, { strict: true });
    appState = nextState;
    saveStateLocalOnly(false);
    updateCloudStatus('online', 'ซิงก์แล้ว');
    return { success: true, student_id: studentId, assignment_id: itemId, score, old_score: oldScore ?? null, message: 'บันทึกคะแนนสำเร็จ' };
  } catch (error) {
    console.warn('QR score save error:', error);
    updateCloudStatus('offline', 'บันทึกไม่สำเร็จ');
    return { success: false, message: 'ไม่สามารถบันทึกคะแนนได้ กรุณาลองอีกครั้ง' };
  }
}

async function saveQrScannedScore() {
  if (qrScoreState.phase !== 'editing' || !qrScoreState.studentId) return;
  const input = document.getElementById('qr-score-new-score');
  const c = qrScoreClasses().find(x => x.id === qrScoreState.classId);
  const item = c && ensureScores(c).items.find(i => i.id === qrScoreState.itemId);
  const student = c?.students?.find(s => s.id === qrScoreState.studentId);
  const validationError = validateQrScore(c, item, student, input.value);
  const errorEl = document.getElementById('qr-score-save-error');
  if (validationError) { errorEl.textContent = validationError; input.focus(); return; }

  qrScoreState.phase = 'saving';
  const button = document.getElementById('qr-score-save-btn');
  button.disabled = true;
  button.innerHTML = '<span class="qr-score-spinner"></span> กำลังบันทึก';
  errorEl.textContent = '';
  const result = await persistQrScore(qrScoreState.classId, qrScoreState.itemId, qrScoreState.studentId, input.value);
  button.disabled = false;
  button.innerHTML = '<i class="hgi-stroke hgi-floppy-disk"></i> บันทึกคะแนน';
  if (!result.success) {
    qrScoreState.phase = 'editing';
    errorEl.textContent = result.message;
    setQrScoreStatus('บันทึกไม่สำเร็จ — ข้อมูลยังอยู่ กรุณาลองอีกครั้ง', 'error');
    return;
  }

  updateQrScoreUi(qrScoreState.classId, qrScoreState.itemId, qrScoreState.studentId, result.score);
  document.getElementById('qr-score-result').classList.add('is-success');
  document.getElementById('qr-score-result-state').innerHTML = '<strong>✓ บันทึกคะแนนสำเร็จ</strong><span>กำลังพร้อมรับคนถัดไป</span>';
  setQrScoreStatus('✓ บันทึกสำเร็จ', 'success');
  qrScoreState.phase = 'success';
  qrScoreState.successTimer = setTimeout(() => {
    if (document.getElementById('modal-qr-score')?.classList.contains('show')) resumeQrScoreScan();
  }, 550);
}

function qrScoreCssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/(["\\])/g, '\\$1');
}

function updateQrScoreUi(classId, itemId, studentId, score) {
  const attrs = `[data-class-id="${qrScoreCssEscape(classId)}"][data-item-id="${qrScoreCssEscape(itemId)}"][data-student-id="${qrScoreCssEscape(studentId)}"]`;
  const selector = `.score-cell-input${attrs}, .score-quick-input input${attrs}, .msc-in${attrs}`;
  document.querySelectorAll(selector).forEach(input => { input.value = score; });
  const c = qrScoreClasses().find(x => x.id === classId);
  if (c) {
    updateScoreRow(c, studentId);
    renderQuickScoreStats(c, itemId);
  }
}

function setQrScoreStatus(message, type) {
  const status = document.getElementById('qr-score-status');
  if (!status) return;
  status.textContent = message;
  status.className = `qr-score-status ${type || ''}`;
}

async function stopQrScoreScanner() {
  if (qrScoreState.phase === 'saving') {
    showToast('กำลังบันทึกคะแนน กรุณารอสักครู่', 'warning');
    return;
  }
  const originClassId = qrScoreState.originScores ? qrScoreState.classId : null;
  qrScoreState.phase = 'stopping';
  clearTimeout(qrScoreState.successTimer);
  await stopQrScoreCamera();
  document.getElementById('modal-qr-score')?.classList.remove('show');
  document.getElementById('qr-score-camera-placeholder').innerHTML = '<i class="hgi-stroke hgi-camera-01"></i><span>กำลังเปิดกล้อง…</span>';
  qrScoreState = createQrScoreState();
  if (originClassId && scoreCurrentClassId === originClassId) {
    const c = qrScoreClasses().find(x => x.id === originClassId);
    if (c) renderScoreWorkspace(c);
  }
}

document.addEventListener('keydown', event => {
  const modal = document.getElementById('modal-qr-score');
  if (event.key === 'Escape' && modal?.classList.contains('show')) stopQrScoreScanner();
  if (event.key === 'Enter' && qrScoreState.phase === 'editing' && document.activeElement?.id === 'qr-score-new-score') {
    event.preventDefault();
    saveQrScannedScore();
  }
});

document.addEventListener('visibilitychange', () => {
  if (qrScoreState.phase !== 'scanning') return;
  if (document.hidden) pauseQrScoreCamera();
  else resumeQrScoreCamera();
});
