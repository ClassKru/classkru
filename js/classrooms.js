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
      <div style="padding:16px 18px 14px;display:flex;align-items:flex-start;gap:8px;">
        <div style="flex:1;min-width:0;">
          <strong style="font-size:1.05rem;font-weight:700;display:flex;align-items:center;gap:9px;line-height:1.2;"><span class="ck-class-dot" style="width:11px;height:11px;border-radius:50%;background:${col.text};flex-shrink:0;"></span>${c.subject}</strong>
          <span class="subtitle ck-class-sub" style="display:block;">${c.className} · <span style="font-weight:700;color:var(--text-main);">${c.students.length}</span> คน</span>
        </div>
        <button class="ck-class-menu-btn" aria-label="ตัวเลือกเพิ่มเติม" onclick="toggleClassMenu(event,'${c.id}')"><i class="hgi-stroke hgi-more-vertical-circle-01"></i></button>
      </div>
      <div style="padding:0 18px 16px;display:flex;gap:8px;">
        <button class="btn ck-checkin-btn ck-cardaction-btn" style="flex:1;display:inline-flex;align-items:center;gap:6px;padding:10px 12px;font-size:0.9rem;justify-content:center;border-radius:var(--radius-sm);background:${col.text};color:#fff;border:1.5px solid ${col.text};font-weight:700;" onclick="openSwipeAttendance('${c.id}')">
          <i class="hgi-stroke hgi-task-done-01"></i> เช็คชื่อ
        </button>
        <button class="btn ck-cardaction-btn" style="flex:1;display:inline-flex;align-items:center;gap:6px;padding:10px 12px;font-size:0.9rem;justify-content:center;border-radius:var(--radius-sm);background:#fff;color:${col.text};border:1.5px solid ${col.text};font-weight:700;" onclick="openClassScores('${c.id}')">
          <i class="hgi-stroke hgi-award-01"></i> คะแนน
        </button>
      </div>`;
    container.appendChild(card);
  });
}

// เมนู ⋮ ต่อการ์ดห้อง — ยุบ แก้ไข/นำเข้า/สถิติ/ลบ ไว้ที่เดียว (append body กัน overflow:hidden ของการ์ดตัด)
function toggleClassMenu(ev, classId) {
  ev.stopPropagation();
  const existing = document.getElementById('ck-class-menu');
  const wasFor = existing ? existing.dataset.for : null;
  closeClassMenu();
  if (wasFor === classId) return; // กดปุ่มเดิมซ้ำ = ปิด
  const r = ev.currentTarget.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'ck-class-menu';
  menu.className = 'ck-class-menu';
  menu.dataset.for = classId;
  menu.innerHTML = `
    <button onclick="closeClassMenu();openClassModal('${classId}')"><i class="hgi-stroke hgi-pencil-edit-02"></i><span>แก้ไข</span></button>
    <button onclick="closeClassMenu();triggerDirectClassExcelImport('${classId}')"><i class="hgi-stroke hgi-file-import"></i><span>นำเข้า นร.</span></button>
    <button onclick="closeClassMenu();viewWebClassReport('${classId}')"><i class="hgi-stroke hgi-pie-chart"></i><span>สถิติ</span></button>
    <button class="danger" onclick="closeClassMenu();deleteClassById('${classId}')"><i class="hgi-stroke hgi-delete-02"></i><span>ลบ</span></button>`;
  document.body.appendChild(menu);
  menu.style.top = (r.bottom + window.scrollY + 6) + 'px';
  menu.style.left = (r.right + window.scrollX - menu.offsetWidth) + 'px';
  setTimeout(() => document.addEventListener('click', closeClassMenuOnOutside), 0);
}

function closeClassMenu() {
  const m = document.getElementById('ck-class-menu');
  if (m) m.remove();
  document.removeEventListener('click', closeClassMenuOnOutside);
}

function closeClassMenuOnOutside(e) {
  const m = document.getElementById('ck-class-menu');
  if (m && !m.contains(e.target)) closeClassMenu();
}

function startWebClassroomsCheckin(classId) {
  currentClassId = classId;
  navigateToWebScreen('attendance');
}

function manageStudentsFromCard(classId) {
  window.__forceStudentClassId = classId;
  navigateToWebScreen('students');
}

// ==================== แถบแท็บภายในห้อง (detail tabs) — template กลางอันเดียว ใช้ทุกหน้า ====================
// เสียบใต้หัวจอของแต่ละหน้า (คะแนน/นักเรียน/รายงาน) — ปุ่ม action เดิมของแต่ละหน้าอยู่ที่เดิม
function renderClassTabBar(classId, active) {
  const col = getClassColor(classId);
  const tabs = [
    { key: 'checkin',  label: 'เช็คชื่อ',     icon: 'hgi-task-done-01' },
    { key: 'scores',   label: 'คะแนน',       icon: 'hgi-award-01' },
    { key: 'students', label: 'นักเรียน',     icon: 'hgi-user-multiple' },
    { key: 'reports',  label: 'การเข้าเรียน', icon: 'hgi-pie-chart' }
  ];
  const btns = tabs.map(t => {
    const on = t.key === active;
    const style = on ? `background:#fff;color:${col.text};border-color:${col.border};box-shadow:0 1px 3px rgba(0,0,0,0.07);` : '';
    return `<button class="ck-classtab${on ? ' active' : ''}" style="${style}" onclick="switchClassTab('${t.key}','${classId}')"><i class="hgi-stroke ${t.icon}"></i><span>${t.label}</span></button>`;
  }).join('');
  return `<div class="ck-classtab-bar">${btns}</div>`;
}

// สลับแท็บภายในห้อง — อ่านห้องจาก classId แล้วเปิดหน้าเป้าหมาย
// เช็คชื่อเป็น overlay ที่เหลือเป็น screen → ปิด overlay ก่อนถ้ากำลังเปิดอยู่
function switchClassTab(tab, classId) {
  const ov = document.getElementById('swipe-overlay');
  if (ov && ov.classList.contains('show') && tab !== 'checkin') closeSwipeAttendance();
  if (tab === 'checkin') openSwipeAttendance(classId);
  else if (tab === 'scores') openClassScores(classId);
  else if (tab === 'students') manageStudentsFromCard(classId);
  else if (tab === 'reports') viewWebClassReport(classId);
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
  const repTab = document.getElementById('reports-classtab-holder');
  if (repTab) repTab.innerHTML = renderClassTabBar(classId, 'reports');
  repSelectedDate = null;
  switchWebReportTab('today');
}

// ==================== WEB STUDENTS ====================
