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

function qrScoreClasses() {
  return (appState.classes || []).filter(c => c && c.id).slice().sort((a, b) => {
    const year = Number(b.academicYear || 0) - Number(a.academicYear || 0);
    if (year) return year;
    const room = String(a.className || '').localeCompare(String(b.className || ''), 'th', { numeric: true, sensitivity: 'base' });
    if (room) return room;
    return String(a.subject || '').localeCompare(String(b.subject || ''), 'th', { numeric: true, sensitivity: 'base' });
  });
}

function qrScoreTaskValue(classId, itemId) {
  return `${classId}::${itemId}`;
}

function qrScoreParseTaskValue(value) {
  const [classId, itemId] = String(value || '').split('::');
  return { classId: classId || '', itemId: itemId || '' };
}

function qrScoreTasks(classes) {
  const tasks = [];
  classes.forEach(c => {
    scoreOrderedItems(c).forEach(item => {
      tasks.push({ classroom: c, item });
    });
  });
  return tasks.sort((a, b) => {
    const ay = Number(b.classroom.academicYear || 0) - Number(a.classroom.academicYear || 0);
    if (ay) return ay;
    const room = String(a.classroom.className || '').localeCompare(String(b.classroom.className || ''), 'th', { numeric: true, sensitivity: 'base' });
    if (room) return room;
    const subject = String(a.classroom.subject || '').localeCompare(String(b.classroom.subject || ''), 'th', { numeric: true, sensitivity: 'base' });
    if (subject) return subject;
    return String(a.item.name || '').localeCompare(String(b.item.name || ''), 'th', { numeric: true, sensitivity: 'base' });
  });
}

function qrScoreClassOptionLabel(c) {
  return c.subject || c.className || 'ห้องเรียน';
}

function qrScoreClassOptionMeta(c) {
  const year = c.academicYear ? `ปี ${c.academicYear}` : 'ไม่ระบุปี';
  return `${year} • ${c.className || 'ไม่ระบุห้อง'} • ${c.students?.length || 0} คน`;
}

function qrScoreClassDotColor(c) {
  const colors = ['#ef4444', '#f59e0b', '#ec4899', '#1d9e75', '#f97316', '#3b82f6', '#8b5cf6', '#14b8a6'];
  return colors[Number(c?.colorIndex || 0) % colors.length] || '#1d9e75';
}

function resetQrScorePickerPanels() {
  ['qr-score-class-panel', 'qr-score-task-panel'].forEach(id => {
    const panel = document.getElementById(id);
    if (panel) panel.style.display = 'none';
  });
  ['qr-score-class-trigger', 'qr-score-task-trigger'].forEach(id => {
    document.getElementById(id)?.classList.remove('is-open');
  });
}

function openQrScoreScanner(classId, itemId) {
  const modal = document.getElementById('modal-qr-score');
  if (!modal) return;
  qrScoreState = createQrScoreState();
  resetQrScorePickerPanels();
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
  const selectedTask = qrScoreParseTaskValue(document.getElementById('qr-score-task')?.value);
  const selectedClassId = document.getElementById('qr-score-class')?.value || '';
  const selectedId = classId || selectedTask.classId || selectedClassId || qrScoreState.classId || currentClassId;
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
  const tasks = qrScoreTasks(classes);
  const selectedClassId = prefillClassId || '';
  const classSelect = document.getElementById('qr-score-class');
  if (classSelect) {
    classSelect.innerHTML = `<option value="">${classes.length ? '-- เลือกห้องเรียน --' : 'ยังไม่มีข้อมูลห้องเรียน'}</option>` + classes.map(c => {
      return `<option value="${qrScoreEsc(c.id)}">${qrScoreEsc(qrScoreClassOptionLabel(c))} • ${qrScoreEsc(qrScoreClassOptionMeta(c))}</option>`;
    }).join('');
    if (selectedClassId && classes.some(c => c.id === selectedClassId)) classSelect.value = selectedClassId;
    classSelect.disabled = classes.length === 0;
  }
  const selected = prefillClassId && prefillItemId ? qrScoreTaskValue(prefillClassId, prefillItemId) : '';
  renderQrScoreTaskSelect(tasks, selected);
  renderQrScoreClassList(classes);
  renderQrScoreTaskList(tasks);
  updateQrScoreMax();
  updateQrScoreSetupState();
}

function renderQrScoreTaskSelect(tasks, preferredValue = '') {
  const taskSelect = document.getElementById('qr-score-task');
  if (!taskSelect) return;
  const classId = document.getElementById('qr-score-class')?.value || '';
  const visibleTasks = classId ? tasks.filter(({ classroom }) => classroom.id === classId) : [];
  taskSelect.innerHTML = `<option value="">${classId ? (visibleTasks.length ? '-- เลือกงานที่จะกรอกคะแนน --' : 'ห้องนี้ยังไม่มีงาน') : 'เลือกห้องเรียนก่อน'}</option>` + visibleTasks.map(({ classroom, item }) => {
    const label = `${item.name} / ${item.max} คะแนน`;
    return `<option value="${qrScoreEsc(qrScoreTaskValue(classroom.id, item.id))}">${qrScoreEsc(label)}</option>`;
  }).join('');
  if (preferredValue && visibleTasks.some(({ classroom, item }) => qrScoreTaskValue(classroom.id, item.id) === preferredValue)) {
    taskSelect.value = preferredValue;
  }
  taskSelect.disabled = !classId || visibleTasks.length === 0;
}

function qrScoreTaskLabel(classroom, item) {
  return `${item.name} / ${item.max} คะแนน`;
}

function qrScoreTaskMeta(classroom) {
  return `${classroom.className || 'ไม่ระบุห้อง'} • ${classroom.subject || 'ไม่ระบุวิชา'} • ปี ${classroom.academicYear || '—'}`;
}

function renderQrScoreClassList(classes) {
  const list = document.getElementById('qr-score-class-list');
  if (!list) return;
  if (!classes.length) {
    list.innerHTML = '<div class="qr-score-picker-empty">ยังไม่มีข้อมูลห้องเรียน</div>';
    return;
  }
  const selected = document.getElementById('qr-score-class')?.value || '';
  list.innerHTML = classes.map(c => {
    return `
      <button type="button" class="qr-score-picker-option ${c.id === selected ? 'is-selected' : ''}" onclick="selectQrScoreClass('${qrScoreEsc(c.id)}')">
        <span class="qr-score-class-dot" style="--qr-class-dot:${qrScoreEsc(qrScoreClassDotColor(c))};"></span>
        <strong>${qrScoreEsc(qrScoreClassOptionLabel(c))}</strong>
        <small>${qrScoreEsc(qrScoreClassOptionMeta(c))}</small>
      </button>
    `;
  }).join('');
}

function renderQrScoreTaskList(tasks) {
  const list = document.getElementById('qr-score-task-list');
  if (!list) return;
  const classId = document.getElementById('qr-score-class')?.value || '';
  if (!classId) {
    list.innerHTML = '<div class="qr-score-picker-empty">เลือกห้องเรียนก่อน แล้วระบบจะแสดงเฉพาะงานของห้องนั้น</div>';
    return;
  }
  const visibleTasks = tasks.filter(({ classroom }) => classroom.id === classId);
  if (!visibleTasks.length) {
    list.innerHTML = '<div class="qr-score-picker-empty">ห้องนี้ยังไม่มีงานให้กรอกคะแนน</div>';
    return;
  }
  const selected = document.getElementById('qr-score-task')?.value || '';
  list.innerHTML = visibleTasks.map(({ classroom, item }) => {
    const value = qrScoreTaskValue(classroom.id, item.id);
    return `
      <button type="button" class="qr-score-picker-option qr-score-task-option ${value === selected ? 'is-selected' : ''}" onclick="selectQrScoreTask('${qrScoreEsc(value)}')">
        <strong>${qrScoreEsc(item.name || 'งาน')}</strong>
        <small>${qrScoreEsc(item.max)} คะแนน</small>
      </button>
    `;
  }).join('');
}

function toggleQrScoreClassPanel(force) {
  const panel = document.getElementById('qr-score-class-panel');
  if (!panel) return;
  const shouldShow = force === undefined ? panel.style.display === 'none' : Boolean(force);
  panel.style.display = shouldShow ? 'block' : 'none';
  document.getElementById('qr-score-class-trigger')?.classList.toggle('is-open', shouldShow);
  if (shouldShow) toggleQrScoreTaskPanel(false);
}

function toggleQrScoreTaskPanel(force) {
  const panel = document.getElementById('qr-score-task-panel');
  if (!panel) return;
  if (!document.getElementById('qr-score-class')?.value) return;
  const shouldShow = force === undefined ? panel.style.display === 'none' : Boolean(force);
  panel.style.display = shouldShow ? 'block' : 'none';
  document.getElementById('qr-score-task-trigger')?.classList.toggle('is-open', shouldShow);
  if (shouldShow) toggleQrScoreClassPanel(false);
}

function selectQrScoreClass(value) {
  const select = document.getElementById('qr-score-class');
  if (!select) return;
  select.value = value;
  toggleQrScoreClassPanel(false);
  qrScoreClassChanged();
}

function qrScoreClassChanged() {
  qrScoreState.setupTouched = true;
  const taskSelect = document.getElementById('qr-score-task');
  if (taskSelect) taskSelect.value = '';
  const defaultScore = document.getElementById('qr-score-default-score');
  if (defaultScore) defaultScore.value = '';
  renderQrScoreTaskSelect(qrScoreTasks(qrScoreClasses()));
  toggleQrScoreTaskPanel(false);
  updateQrScoreMax();
  updateQrScoreSetupState();
  document.getElementById('qr-score-setup-error').textContent = '';
}

function selectQrScoreTask(value) {
  const select = document.getElementById('qr-score-task');
  if (!select) return;
  select.value = value;
  toggleQrScoreTaskPanel(false);
  qrScoreTaskChanged();
}

function qrScoreTaskChanged() {
  qrScoreState.setupTouched = true;
  const defaultScore = document.getElementById('qr-score-default-score');
  if (defaultScore) defaultScore.value = '';
  updateQrScoreMax();
  updateQrScoreSetupState();
  document.getElementById('qr-score-setup-error').textContent = '';
}

function qrScoreSetupChanged(level) {
  qrScoreState.setupTouched = true;
  qrScoreTaskChanged();
}

// Login starts cloud sync in the background. If the QR setup is already open and
// the teacher has not touched it yet, refresh it once the real cloud state arrives.
function refreshQrScoreSetupAfterCloudSync() {
  const modal = document.getElementById('modal-qr-score');
  if (!modal?.classList.contains('show') || qrScoreState.phase !== 'idle' || qrScoreState.setupTouched) return;
  const selected = qrScoreParseTaskValue(document.getElementById('qr-score-task')?.value);
  const classId = selected.classId || null;
  const itemId = selected.itemId || null;
  renderQrScoreSetup(classId, itemId);
}

function updateQrScoreSetupState() {
  const classes = qrScoreClasses();
  const selected = qrScoreParseTaskValue(document.getElementById('qr-score-task')?.value);
  const classId = selected.classId || document.getElementById('qr-score-class')?.value || '';
  const itemId = selected.itemId;
  const selectedClass = classes.find(c => c.id === classId);
  const item = selectedClass ? ensureScores(selectedClass).items.find(i => i.id === itemId) : null;
  const button = document.getElementById('qr-score-print-cards');
  if (button) button.disabled = !classId;
  const startButton = document.getElementById('qr-score-start-btn');
  if (startButton) startButton.disabled = !classId || !itemId;
  const summary = document.getElementById('qr-score-task-summary');
  const triggerTitle = document.getElementById('qr-score-task-trigger-title');
  const triggerMeta = document.getElementById('qr-score-task-trigger-meta');
  const classTriggerTitle = document.getElementById('qr-score-class-trigger-title');
  const classTriggerMeta = document.getElementById('qr-score-class-trigger-meta');
  const classTrigger = document.getElementById('qr-score-class-trigger');
  const classTriggerDot = document.getElementById('qr-score-class-trigger-dot');
  if (summary) {
    if (selectedClass && item) {
      summary.style.display = 'flex';
      summary.innerHTML = `<i class="hgi-stroke hgi-checkmark-circle-02"></i><span>${qrScoreEsc(selectedClass.className || '—')} • ${qrScoreEsc(selectedClass.subject || '—')} • ${qrScoreEsc(item.name || '—')} / ${qrScoreEsc(item.max)} คะแนน</span>`;
    } else {
      summary.style.display = 'none';
      summary.innerHTML = '';
    }
  }
  if (triggerTitle && triggerMeta) {
    triggerTitle.textContent = item && selectedClass ? qrScoreTaskLabel(selectedClass, item) : 'เลือกงานที่จะกรอกคะแนน';
    triggerMeta.textContent = item && selectedClass ? qrScoreTaskMeta(selectedClass) : (selectedClass ? 'แตะเพื่อเลือกจากงานของห้องนี้' : 'เลือกห้องเรียนก่อน');
  }
  if (classTriggerTitle && classTriggerMeta) {
    classTriggerTitle.textContent = selectedClass ? qrScoreClassOptionLabel(selectedClass) : 'เลือกห้องเรียน';
    classTriggerMeta.textContent = selectedClass ? qrScoreClassOptionMeta(selectedClass) : 'แตะเพื่อเลือกห้องที่จะกรอกคะแนน';
  }
  if (classTrigger && classTriggerDot) {
    classTrigger.classList.toggle('has-class-dot', Boolean(selectedClass));
    classTriggerDot.classList.toggle('is-visible', Boolean(selectedClass));
    classTriggerDot.style.setProperty('--qr-class-dot', selectedClass ? qrScoreClassDotColor(selectedClass) : 'transparent');
  }
  renderQrScoreClassList(classes);
  renderQrScoreTaskList(qrScoreTasks(classes));

}

function updateQrScoreMax() {
  const selected = qrScoreParseTaskValue(document.getElementById('qr-score-task')?.value);
  const classId = selected.classId;
  const itemId = selected.itemId;
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
  const selectedTask = qrScoreParseTaskValue(document.getElementById('qr-score-task')?.value);
  const classId = forcedClassId || selectedTask.classId || document.getElementById('qr-score-class')?.value;
  const itemId = forcedItemId || selectedTask.itemId;
  const c = qrScoreClasses().find(x => x.id === classId);
  const item = c && ensureScores(c).items.find(x => x.id === itemId);
  const errorEl = document.getElementById('qr-score-setup-error');
  if (!c || !item) {
    if (errorEl) errorEl.textContent = c ? 'กรุณาเลือกงานที่จะกรอกคะแนน' : 'กรุณาเลือกห้องเรียนก่อน';
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
  document.getElementById('qr-score-scan').classList.remove('has-result');
  document.getElementById('qr-score-context').innerHTML = `<div><strong>${qrScoreEsc(c.className)} • ${qrScoreEsc(c.subject)}</strong><span>${qrScoreEsc(item.name)} / ${qrScoreEsc(item.max)} คะแนน · ปี ${qrScoreEsc(c.academicYear || '—')}</span></div><button type="button" class="qr-score-print-context" onclick="openStudentQrCards('${qrScoreEsc(c.id)}')"><i class="hgi-stroke hgi-printer"></i> พิมพ์ QR นักเรียน</button>`;
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
    return { title: 'ไม่พบกล้องบนอุปกรณ์นี้', detail: 'ตรวจสอบว่ามือถือมีกล้องที่พร้อมใช้งาน แล้วกดลองเปิดกล้องอีกครั้ง' };
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
  setQrScoreStatus(info.title, 'error');
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
  const scanConfig = { fps: 12, qrbox: (w, h) => { const size = Math.floor(Math.min(w, h) * 0.64); return { width: size, height: size }; }, aspectRatio: 1 };
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

function decodeQrScorePart(value) {
  try { return decodeURIComponent(value || ''); }
  catch (_) { return String(value || ''); }
}

function parseQrStudentPayload(decodedText) {
  const raw = String(decodedText || '').trim();
  const empty = { raw, classId: '', studentId: '', legacyToken: '' };
  if (!raw) return empty;
  if (/^CKSTU:/i.test(raw)) {
    const body = raw.replace(/^CKSTU:/i, '').trim();
    const parts = body.split(':');
    if (parts.length >= 2) {
      return {
        raw,
        classId: decodeQrScorePart(parts[0]).trim(),
        studentId: decodeQrScorePart(parts.slice(1).join(':')).trim(),
        legacyToken: ''
      };
    }
    return { raw, classId: '', studentId: '', legacyToken: body };
  }
  try {
    const url = new URL(raw);
    const fromUrl = url.searchParams.get('student_id') || url.searchParams.get('student');
    const classId = url.searchParams.get('class_id') || url.searchParams.get('classId') || url.searchParams.get('class');
    if (fromUrl) return { raw, classId: String(classId || '').trim(), studentId: fromUrl.trim(), legacyToken: '' };
  } catch (_) { /* raw token, not a URL */ }
  if (raw.startsWith('{')) {
    try {
      const data = JSON.parse(raw);
      return {
        raw,
        classId: String(data.class_id || data.classId || '').trim(),
        studentId: String(data.student_id || data.studentId || '').trim(),
        legacyToken: ''
      };
    } catch (_) { /* invalid JSON */ }
  }
  return { raw, classId: '', studentId: '', legacyToken: raw };
}

function findQrScoreStudent(payload) {
  const classes = qrScoreClasses();
  const current = classes.find(c => c.id === qrScoreState.classId);
  if (!current) return null;
  if (payload.classId && payload.studentId) {
    const scopedClass = classes.find(c => String(c.id) === String(payload.classId));
    const student = scopedClass?.students?.find(s => String(s.id) === String(payload.studentId));
    return student ? { student, classroom: scopedClass, exact: true, scoped: true } : null;
  }
  const token = payload.studentId || payload.legacyToken || '';
  if (!token) return null;
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
  const payload = parseQrStudentPayload(rawCode);
  qrScoreState.phase = 'lookup';
  pauseQrScoreCamera();
  const found = findQrScoreStudent(payload);
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

function showQrScoreLookupError(title, detail) {
  qrScoreState.studentId = null;
  qrScoreState.phase = 'error';
  const result = document.getElementById('qr-score-result');
  document.getElementById('qr-score-scan')?.classList.add('has-result');
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
  document.getElementById('qr-score-scan')?.classList.add('has-result');
  result.style.display = 'block';
  result.classList.remove('is-error', 'is-success');
  document.getElementById('qr-score-result-state').innerHTML = '<strong>✓ พบข้อมูลนักเรียน</strong><span>ตรวจสอบชื่อก่อนลงคะแนน</span>';
  document.querySelector('.qr-score-student').style.display = 'flex';
  document.querySelector('.qr-score-old').style.display = 'flex';
  document.getElementById('qr-score-new-wrap').style.display = 'block';
  document.getElementById('qr-score-save-btn').style.display = 'inline-flex';
  document.getElementById('qr-score-retry-btn').style.display = 'inline-flex';
  document.getElementById('qr-score-student-name').textContent = qrScoreStudentDisplayName(student);
  document.getElementById('qr-score-student-meta').textContent = `${c.className} • เลขที่ ${student.no || '—'}${student.studentCode ? ` • รหัส ${student.studentCode}` : ''}`;
  const avatar = document.getElementById('qr-score-student-avatar');
  if (avatar) {
    avatar.classList.toggle('has-photo', Boolean(student.photoBase64));
    avatar.innerHTML = qrScoreStudentAvatarHtml(student);
  }
  document.getElementById('qr-score-old-score').textContent = current === undefined || current === null || current === '' ? 'ยังไม่มี' : String(current);
  document.getElementById('qr-score-max-label').textContent = `/${item.max}`;
  const input = document.getElementById('qr-score-new-score');
  input.max = item.max;
  input.value = current === undefined || current === null ? qrScoreState.defaultScore : current;
  document.getElementById('qr-score-save-error').textContent = '';
  setQrScoreStatus('กรอกคะแนนแล้วกดบันทึก', 'found');
  setTimeout(() => { input.focus(); input.select(); }, 50);
}

function qrScoreStudentDisplayName(student) {
  const name = String(student?.name || 'นักเรียน').trim();
  const nick = String(student?.nickname || '').trim();
  return nick ? `${name} (${nick})` : name;
}

function qrScoreStudentAvatarHtml(student) {
  if (student?.photoBase64) return `<img src="${student.photoBase64}" alt="">`;
  const fallback = String(student?.nickname || student?.no || '').trim() || String(student?.name || 'น').trim().charAt(0) || 'น';
  return qrScoreEsc(fallback);
}

function resetQrScoreResult() {
  qrScoreState.studentId = null;
  document.getElementById('qr-score-scan')?.classList.remove('has-result');
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
  document.getElementById('qr-score-result-state').innerHTML = `<strong>บันทึกแล้ว: ${qrScoreEsc(student?.name || 'นักเรียน')} ${qrScoreEsc(result.score)}/${qrScoreEsc(item?.max || '')}</strong><span>พร้อมรับคนถัดไป</span>`;
  setQrScoreStatus(`บันทึกแล้ว ${result.score}/${item?.max || ''}`, 'success');
  qrScoreState.phase = 'success';
  qrScoreState.successTimer = setTimeout(() => {
    if (document.getElementById('modal-qr-score')?.classList.contains('show')) resumeQrScoreScan();
  }, 900);
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
  resetQrScorePickerPanels();
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
