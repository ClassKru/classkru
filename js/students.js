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
  if (!filter.value) {
    contentArea.style.display = 'none';
    emptyState.style.display = 'block';
    currentClassId = null;
    if (stTab) stTab.innerHTML = '';
    return;
  } else {
    contentArea.style.display = 'block';
    emptyState.style.display = 'none';
    currentClassId = filter.value;
    if (stTab) stTab.innerHTML = renderClassTabBar(filter.value, 'students');
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

  filteredStudents.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:center;font-weight:700;">${s.no || '-'}</td>
      <td style="text-align:center;"><input class="d-code-input" type="text" value="${String(s.studentCode||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}" placeholder="-" onchange="setStudentCodeInline('${targetClass.id}','${s.id}',this.value)"></td>
      <td style="font-weight:700;">${s.name}</td>
      <td style="color:var(--text-muted);font-size:0.8rem;">${s.comment || '-'}</td>
      <td style="text-align:center;">
        <button class="btn" title="แก้ไขข้อมูล" style="padding:4px 8px;font-size:0.72rem;" onclick="currentClassId='${targetClass.id}';openStudentDetailModal('${s.id}','${targetClass.id}')"><i class="hgi-stroke hgi-edit-02"></i></button>
        <button class="btn btn-danger" style="padding:4px 8px;font-size:0.72rem;" onclick="currentClassId='${targetClass.id}';deleteStudent('${s.id}')"><i class="hgi-stroke hgi-delete-02"></i></button>
      </td>`;
    container.appendChild(tr);
  });
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

