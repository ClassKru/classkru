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
