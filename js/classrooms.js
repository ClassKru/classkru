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
    // ทั้งใบกดได้ → เช็คชื่อ (ปุ่มเช็คชื่อ/คะแนนเดิมถูกตัดออก — เข้าหน้าอื่นผ่านแถบแท็บในห้อง)
    card.style.cssText = `padding:0;overflow:hidden;gap:0;cursor:pointer;--cc:${col.text};border-top:4px solid ${col.text};`;
    card.onclick = () => enterClassRoom(c.id);
    card.innerHTML = `
      <div style="padding:16px 18px;display:flex;align-items:flex-start;gap:8px;">
        <div style="flex:1;min-width:0;">
          <strong style="font-size:1.05rem;font-weight:700;display:flex;align-items:center;gap:9px;line-height:1.2;"><span class="ck-class-dot" style="width:11px;height:11px;border-radius:50%;background:${col.text};flex-shrink:0;"></span>${c.subject}</strong>
          <span class="subtitle ck-class-sub" style="display:block;">${c.className} · <span style="font-weight:700;color:var(--text-main);">${c.students.length}</span> คน</span>
          <div class="progress-container" style="margin-top:12px;">
            <div class="progress-label-row"><span>เข้าเรียน</span><span style="font-weight:800;color:${pctColor};">${pct}%</span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%;background:${col.text};"></div></div>
          </div>
        </div>
        <button class="ck-class-menu-btn" aria-label="ตัวเลือกเพิ่มเติม" onclick="event.stopPropagation();toggleClassMenu(event,'${c.id}')"><i class="hgi-stroke hgi-more-vertical-circle-01"></i></button>
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
// แตะการ์ดห้อง → เข้าหน้าเช็คชื่อ "เสมอ" — จงใจไม่จำแท็บล่าสุด
// เคยลองจำแล้วถอยออก: ครูจำไม่ได้ว่าครั้งก่อนออกจากแท็บไหน แตะการ์ดเดิมเลยได้หน้าไม่ซ้ำกัน
// รู้สึกเหมือนแอปเด้งมั่ว การเปลี่ยนหน้า/เปลี่ยนห้องมีแกนของมันอยู่แล้ว
// (แถบแท็บ = เปลี่ยนหน้า · แตะชื่อห้อง = เปลี่ยนห้อง) ไม่ต้องให้ระบบเดาใจซ้อนเข้าไปอีก
function enterClassRoom(classId) {
  switchClassTab('checkin', classId);
}

function renderClassTabBar(classId, active) {
  // มีห้องเดียว = แตะชื่อห้องแล้วไม่เกิดอะไร → ซ่อนลูกศรสลับห้อง (CSS อ่านคลาสนี้)
  // ตั้งที่นี่เพราะทุกหน้าในห้องเรียกฟังก์ชันนี้ตอน render และจำนวนห้องเปลี่ยนได้ระหว่างใช้งาน
  document.body.classList.toggle('ck-one-class', (appState.classes || []).length < 2);
  const tabs = [
    { key: 'checkin',  label: 'เช็คชื่อ',     icon: 'hgi-task-done-01' },
    { key: 'scores',   label: 'คะแนน',       icon: 'hgi-award-01' },
    { key: 'students', label: 'นักเรียน',     icon: 'hgi-user-multiple' },
    { key: 'reports',  label: 'การเข้าเรียน', icon: 'hgi-pie-chart' }
  ];
  // สีของแท็บที่เลือกคุมด้วย CSS (.ck-classtab.active → var(--primary))
  // ไม่ผูกกับสีประจำห้องแล้ว เพื่อให้เป็นแม่แบบเดียวกับแถบแท็บหน้ารายงาน
  const btns = tabs.map(t => {
    const on = t.key === active;
    return `<button class="ck-classtab${on ? ' active' : ''}" onclick="switchClassTab('${t.key}','${classId}')"><i class="hgi-stroke ${t.icon}"></i><span>${t.label}</span></button>`;
  }).join('');
  // index ของแท็บที่เลือก ส่งให้ thumb รู้ว่าต้องวิ่งไปช่องไหน
  const idx = tabs.findIndex(t => t.key === active);
  // เรียกทั้ง rAF และ timeout — rAF ไม่ยิงตอนแท็บถูกซ่อน/เบราว์เซอร์หรี่การวาด
  // ฟังก์ชันทำงานซ้ำได้ ไม่มีผลข้างเคียง เรียกสองรอบจึงปลอดภัย
  requestAnimationFrame(() => positionClassTabThumb());
  setTimeout(() => positionClassTabThumb(), 0);
  return `<div class="ck-classtab-bar" data-active="${idx}">${btns}<span class="ck-classtab-thumb"></span></div>`;
}

// จำแท็บก่อนหน้าไว้ เพื่อให้ thumb "วิ่ง" จากช่องเดิมไปช่องใหม่
// (แถบถูกสร้างใหม่ทุกครั้งที่เปลี่ยนหน้า ถ้าไม่จำ มันจะโผล่ที่ช่องใหม่เฉยๆ ไม่มีการเคลื่อน)
let __ckPrevTabIndex = null;

function positionClassTabThumb() {
  // หน้าไหน active อยู่ก็มีแถบเดียวที่มองเห็น — เอาอันที่วัดความกว้างได้จริง
  const bars = [...document.querySelectorAll('.ck-classtab-bar')].filter(b => b.offsetWidth > 0);
  bars.forEach(bar => {
    const thumb = bar.querySelector('.ck-classtab-thumb');
    const btns = [...bar.querySelectorAll('.ck-classtab')];
    const to = Number(bar.dataset.active);
    if (!thumb || !btns[to]) return;
    // thumb เป็น absolute left:0 → offsetLeft ของปุ่ม (วัดจากขอบ padding ของ bar เหมือนกัน) ใช้ตรงๆ ได้
    const put = (i) => {
      thumb.style.width = btns[i].offsetWidth + 'px';
      thumb.style.transform = `translateX(${btns[i].offsetLeft}px)`;
    };
    // จัดตำแหน่งได้แล้ว → สลับจากพื้นหลังสำรองบนปุ่มมาใช้ thumb
    const already = bar.classList.contains('thumb-ready');
    bar.classList.add('thumb-ready');
    const from = (!already && __ckPrevTabIndex !== null && btns[__ckPrevTabIndex]) ? __ckPrevTabIndex : to;
    if (from === to) {
      // ไม่ได้ย้ายช่อง (เข้าหน้าครั้งแรก / render ซ้ำ) → วางเลย ไม่ต้องวิ่ง
      thumb.style.transition = 'none';
      put(to);
      void thumb.offsetWidth;              // บังคับ reflow ก่อนคืน transition ไม่งั้นเฟรมถัดไปจะวิ่งย้อน
      thumb.style.transition = '';
    } else {
      // วางที่ช่องเดิมแบบไม่มี transition แล้วบังคับ reflow ให้เบราว์เซอร์ "ยอมรับ" ค่าเริ่มต้นก่อน
      // จากนั้นค่อยเปิด transition แล้วสั่งไปช่องใหม่ → วิ่งได้โดยไม่ต้องพึ่ง rAF
      // (rAF ไม่ยิงตอนแท็บถูกซ่อน จะทำให้ thumb ค้างอยู่ช่องเดิม)
      thumb.style.transition = 'none';
      put(from);
      void thumb.offsetWidth;
      thumb.style.transition = '';
      put(to);
      bar.classList.add('tab-moved');   // ปลดล็อกให้ไอคอนเด้ง (เฉพาะตอนเปลี่ยนแท็บจริง)
    }
  });
  const anyBar = bars[0];
  if (anyBar) __ckPrevTabIndex = Number(anyBar.dataset.active);
}

// ย่อ/ขยายจอแล้วความกว้างปุ่มเปลี่ยน — จัด thumb ใหม่ (ไม่ต้องวิ่ง เพราะช่องเดิม)
window.addEventListener('resize', () => positionClassTabThumb());

// แตะชื่อห้องบนหัวจอ → popup เลือกห้อง แล้วสลับไปห้องใหม่โดยอยู่แท็บเดิม
// (มีห้องเดียวก็ไม่ต้องเด้ง — ไม่มีอะไรให้เลือก)
function openClassSwitcher(tab) {
  if ((appState.classes || []).length < 2) return;
  showMobileClassPicker({ icon: 'hgi-exchange-01', onPick: id => switchClassTab(tab, id) });
}

// สลับแท็บภายในห้อง — อ่านห้องจาก classId แล้วเปิดหน้าเป้าหมาย
// เช็คชื่อเป็น overlay ที่เหลือเป็น screen → ปิด overlay ก่อนถ้ากำลังเปิดอยู่
function switchClassTab(tab, classId) {
  // อ่าน "มาจากหน้าไหน" ก่อนแตะอะไรทั้งสิ้น — ขั้นตอนข้างล่างจะเปลี่ยน activeWebScreen ทิ้ง
  const fromInRoom = ['checkin', 'scores', 'students', 'reports'].includes(appState.activeWebScreen);

  // ปิด overlay เช็คชื่อตรงๆ ไม่เรียก closeSwipeAttendance เพราะหน้าที่ของมันคือ
  // "ออกจากห้องไปหน้าห้องเรียน" ซึ่งจะแวะ push ประวัติหน้าห้องเรียนคั่นกลางโดยเปล่าประโยชน์
  // ตอนสลับแท็บเราเปิดหน้าใหม่ต่อทันทีอยู่แล้ว
  const ov = document.getElementById('swipe-overlay');
  if (ov && ov.classList.contains('show') && tab !== 'checkin') ov.classList.remove('show');

  // เริ่มที่บนสุดทุกครั้ง — ไม่งั้นสลับกลับมาแล้วค้างตำแหน่ง scroll เดิมของหน้าก่อน
  const sc = document.querySelector('.app-content');
  if (sc) sc.scrollTop = 0;
  window.scrollTo(0, 0);
  // replace เฉพาะการเคลื่อนที่ "ภายในห้อง" (สลับแท็บ / สลับห้องคาแท็บเดิม) เท่านั้น
  // ถ้ามาจากนอกห้อง (แตะการ์ดหน้าห้องเรียน, แดชบอร์ด) = เข้าห้อง ต้อง push
  // ไม่งั้นไม่มี history entry ให้ปุ่ม back ของเครื่องใช้ออกจากห้อง
  __ckReplaceHashOnce = fromInRoom;
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
