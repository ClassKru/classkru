function loadWebAttendanceMatrix() {
  const select = document.getElementById('web-attendance-class-select');
  if (!select) return;
  const curVal = select.value;
  select.innerHTML = '';
  appState.classes.forEach(c => {
    select.innerHTML += `<option value="${c.id}" ${curVal===c.id?'selected':''}>${c.subject} (${c.className})</option>`;
  });
  if (!select.value && appState.classes.length > 0) select.value = appState.classes[0].id;
  const c = appState.classes.find(x => x.id === select.value);
  const table = document.getElementById('web-attendance-matrix-table');
  if (!c || c.students.length === 0) { table.innerHTML = '<tr><td class="empty-state">ไม่มีข้อมูล</td></tr>'; return; }
  const dates = Object.keys(c.attendance || {}).sort().slice(-10);
  let html = '<thead><tr><th>ชื่อ</th>';
  dates.forEach(d => { html += `<th style="text-align:center;font-size:0.65rem;">${d.slice(5)}</th>`; });
  html += '</tr></thead><tbody>';
  c.students.forEach(s => {
    html += `<tr><td style="font-weight:700;font-size:0.78rem;white-space:nowrap;">${s.name}</td>`;
    dates.forEach(d => {
      const st = (c.attendance[d] || {})[s.id] || '';
      const colors = { present:'var(--color-present)', late:'var(--color-late)', absent:'var(--color-absent)', leave:'var(--color-leave)' };
      const bg = colors[st] || '#e5e5ea';
      html += `<td style="text-align:center;"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${bg};"></span></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  table.innerHTML = html;
}

// ==================== REPORTS ====================
function renderWebReports() {
  document.getElementById('web-reports-selection-view').style.display = 'block';
  document.getElementById('web-reports-detail-view').style.display = 'none';
  const list = document.getElementById('web-reports-class-list');
  list.innerHTML = '';
  if (appState.classes.length === 0) {
    list.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">ไม่มีห้องเรียน</div>';
    return;
  }
  appState.classes.forEach(c => {
    const pct = calculateAttendancePercentage(c);
    const col = getClassColor(c.id);
    list.innerHTML += `<div class="card" style="padding:20px;cursor:pointer;border-top:4px solid ${col.text};" onclick="viewWebClassReport('${c.id}')"><strong style="font-size:1.05rem;">${c.subject}</strong><span class="subtitle">${c.className} · <span style="font-weight:700;color:var(--text-main);">${c.students.length}</span> คน</span><div class="progress-container" style="margin-top:8px;"><div class="progress-label-row"><span>เข้าเรียน</span><span style="font-weight:800;color:${col.text};">${pct}%</span></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%;background:${col.text};"></div></div></div></div>`;
  });
}

function goBackToWebReportsSelection() {
  // มือถือ: เข้าหน้านี้จากการ์ดห้อง → กลับหน้าห้องเรียน ให้เหมือนแท็บอื่นในห้อง (คะแนน/นักเรียน)
  // เดสก์ท็อปยังกลับไปหน้าเลือกห้องของรายงานเหมือนเดิม
  if (window.matchMedia('(max-width: 768px)').matches) { navigateToWebScreen('classrooms'); return; }
  document.getElementById('web-reports-selection-view').style.display = 'block';
  document.getElementById('web-reports-detail-view').style.display = 'none';
}

function switchWebReportTab(tab) {
  currentWebReportTab = tab;
  document.querySelectorAll('.report-tab-item').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
  ['today','weekly','term','overall'].forEach(t => {
    const el = document.getElementById(`web-rep-content-${t}`);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'today') renderTodayReport();
  else if (tab === 'weekly') requestAnimationFrame(() => renderWeeklyReport());
  else if (tab === 'term') renderTermReport();
  else if (tab === 'overall') renderOverallReport();
}

function renderTodayReport() {
  const c = appState.classes.find(x => x.id === currentClassId);
  if (!c) return;
  const dateObj = repSelectedDate || getNowDate();
  const today = getTodayString(dateObj);
  const isToday = today === getTodayString();
  const rec = (c.attendance || {})[today] || {};
  let p=0,l=0,a=0,lv=0;
  c.students.forEach(s => {
    const st = rec[s.id];
    if (st === 'present') p++; else if (st === 'late') l++; else if (st === 'absent') a++; else if (st === 'leave') lv++;
  });
  const total = p+l+a+lv;
  const pct = total > 0 ? Math.round((p+l) / total * 100) : 0;
  const MONTHS_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const labelFull = `${dateObj.getDate()} ${MONTHS_FULL[dateObj.getMonth()]} ${dateObj.getFullYear()+543}`;
  const labelShort = `${dateObj.getDate()} ${MONTHS_SHORT[dateObj.getMonth()]}`;
  document.getElementById('web-rep-today-date-label').innerText = isToday ? `${labelFull}` : labelFull;

  // เช็คตารางสอนก่อน: ถ้าวันนั้นห้องนี้ไม่มีคาบ → "ไม่มีคาบสอน" (แม้จะมีข้อมูลเช็คชื่อค้าง),
  // ถ้ามีคาบแต่ยังไม่เช็ค → "ยังไม่ได้เช็คชื่อ" (กันสับสนกับ 0/0% หรือแสดงข้อมูลผิดวัน)
  const progressWrap = document.getElementById('web-rep-today-pct').closest('.progress-container');
  const hasPeriod = appState.timetable.some(t => t.classId === c.id && t.dow === dateObj.getDay());
  if (!hasPeriod || total === 0) {
    const noPeriod = !hasPeriod;
    const icon = noPeriod ? 'hgi-calendar-remove-01' : 'hgi-task-01';
    const msg  = noPeriod ? 'ไม่มีคาบสอน' : 'ยังไม่ได้เช็คชื่อ';
    const sub  = noPeriod ? 'วันนี้ห้องนี้ไม่มีตารางสอน' : 'ยังไม่ได้บันทึกการเช็คชื่อของวันนี้';
    document.getElementById('web-rep-today-pills').innerHTML =
      `<div style="width:100%;text-align:center;color:var(--text-muted);padding:18px 8px;">
        <i class="hgi-stroke ${icon}" style="font-size:2.1rem;display:block;margin-bottom:8px;opacity:0.55;"></i>
        <div style="font-weight:800;font-size:0.98rem;color:var(--text-main);">${msg}</div>
        <div style="font-size:0.8rem;margin-top:3px;">${sub}</div>
      </div>`;
    if (progressWrap) progressWrap.style.display = 'none';
    const badgeEl = document.getElementById('web-rep-today-status-badge');
    badgeEl.innerHTML = `<i class="hgi-stroke ${icon}"></i> ${msg}`;
    badgeEl.style.background = '#f2f2f7';
    badgeEl.style.color = 'var(--text-muted)';
    document.getElementById('web-rep-today-abnormal-card').style.display = 'none';
    return;
  }
  if (progressWrap) progressWrap.style.display = '';

  document.getElementById('web-rep-today-pills').innerHTML = `
    <span class="summary-pill" style="background:var(--color-present-bg);color:var(--color-present);">มา ${p}</span>
    <span class="summary-pill" style="background:var(--color-late-bg);color:var(--color-late-text);">สาย ${l}</span>
    <span class="summary-pill" style="background:var(--color-absent-bg);color:var(--color-absent);">ขาด ${a}</span>
    <span class="summary-pill" style="background:var(--color-leave-bg);color:var(--color-leave);">ลา ${lv}</span>`;
  // อนิเมชัน: บาร์วิ่ง 0 → ค่าจริง + ตัวเลข % นับขึ้น (เหมือนแท็บภาพรวม)
  const todayPctEl = document.getElementById('web-rep-today-pct');
  const todayBar = document.getElementById('web-rep-today-progress');
  todayBar.style.transition = 'none';
  todayBar.style.width = '0%';
  todayPctEl.innerText = '0%';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    todayBar.style.transition = 'width 0.9s cubic-bezier(0.22,1,0.36,1)';
    todayBar.style.width = `${pct}%`;
    const duration = 900, startTime = performance.now();
    (function tick(now){ const t=Math.min((now-startTime)/duration,1); const eased=1-Math.pow(1-t,3); todayPctEl.innerText=Math.round(eased*pct)+'%'; if(t<1)requestAnimationFrame(tick); })(performance.now());
  }));
  const badge = document.getElementById('web-rep-today-status-badge');
  if (a === 0) { badge.innerText = '✅ ปกติ ไม่มีขาดเรียน'; badge.style.background = 'var(--color-present-bg)'; badge.style.color = 'var(--color-present)'; }
  else { badge.innerText = `⚠️ มีขาดเรียน ${a} คน`; badge.style.background = 'var(--color-absent-bg)'; badge.style.color = 'var(--color-absent)'; }

  const abnormalCard = document.getElementById('web-rep-today-abnormal-card');
  const abnormalList = document.getElementById('web-rep-today-abnormal-list');
  const absentStudents = c.students.filter(s => rec[s.id] === 'absent' || rec[s.id] === 'late');
  if (absentStudents.length > 0) {
    abnormalCard.style.display = 'block';
    abnormalList.innerHTML = absentStudents.map(s => `<div style="display:flex;align-items:center;gap:8px;padding:8px;background:${rec[s.id]==='absent'?'var(--color-absent-bg)':'var(--color-late-bg)'};border-radius:8px;font-size:0.82rem;font-weight:700;color:${rec[s.id]==='absent'?'var(--color-absent)':'var(--color-late-text)'}"><i class="hgi-stroke hgi-user"></i> ${s.name} — ${rec[s.id]==='absent'?'ขาด':'สาย'}</div>`).join('');
  } else { abnormalCard.style.display = 'none'; }
}

// ========== REPORT DATE CALENDAR PICKER ==========
function toggleRepCalendar() {
  const popup = document.getElementById('rep-calendar-popup');
  if (!popup) return;
  if (popup.style.display === 'none' || !popup.style.display) {
    const d = repSelectedDate || getNowDate();
    repCalViewYear = d.getFullYear();
    repCalViewMonth = d.getMonth();
    renderRepCalendar();
    popup.style.display = 'block';
    setTimeout(() => document.addEventListener('click', closeRepCalOnOutside), 10);
  } else {
    closeRepCalendar();
  }
}

function closeRepCalendar() {
  const popup = document.getElementById('rep-calendar-popup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', closeRepCalOnOutside);
}

function closeRepCalOnOutside(e) {
  const popup = document.getElementById('rep-calendar-popup');
  const btn = document.getElementById('rep-date-btn');
  if (btn && btn.contains(e.target)) return;
  if (popup && !popup.contains(e.target)) closeRepCalendar();
}

function renderRepCalendar() {
  const popup = document.getElementById('rep-calendar-popup');
  if (!popup) return;
  const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const today = getNowDate();
  const todayStr = getTodayString(today);
  const selectedStr = repSelectedDate ? getTodayString(repSelectedDate) : todayStr;
  const firstDay = new Date(repCalViewYear, repCalViewMonth, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(repCalViewYear, repCalViewMonth + 1, 0).getDate();
  const thaiYear = repCalViewYear + 543;

  let html = `<div class="cal-header">
    <button class="cal-nav-btn" onclick="repCalNavMonth(-1);event.stopPropagation();"><i class="hgi-stroke hgi-arrow-left-01"></i></button>
    <span class="cal-header-title">${thaiMonths[repCalViewMonth]} ${thaiYear}</span>
    <button class="cal-nav-btn" onclick="repCalNavMonth(1);event.stopPropagation();"><i class="hgi-stroke hgi-arrow-right-01"></i></button>
  </div><div class="cal-grid">`;
  ['อา','จ','อ','พ','พฤ','ศ','ส'].forEach(d => { html += `<div class="cal-dow">${d}</div>`; });
  for (let i = 0; i < startDow; i++) html += '<div></div>';

  // จุดใต้วันที่มีคาบสอนของห้องนี้ — ให้เหมือนปฏิทินหน้าเช็คชื่อ (ดู renderSwipeCalendar)
  const scheduledDoWs = classScheduledDoWs(currentClassId);

  for (let d = 1; d <= daysInMonth; d++) {
    const dObj = new Date(repCalViewYear, repCalViewMonth, d);
    const dStr = getTodayString(dObj);
    const dow = dObj.getDay();
    const isWknd = dow === 0 || dow === 6;
    const isTdy = dStr === todayStr;
    const isSel = dStr === selectedStr && !isTdy;
    let cls = 'cal-day';
    if (isTdy) cls += ' today';
    else if (isSel) cls += ' selected';
    if (isWknd && !isTdy && !isSel) cls += ' weekend';
    if (scheduledDoWs.has(dow)) cls += ' has-class';
    html += `<div class="${cls}" onclick="selectRepCalDate(${repCalViewYear},${repCalViewMonth},${d});event.stopPropagation();">${d}</div>`;
  }
  html += `</div><button class="cal-today-btn" onclick="selectRepCalToday();event.stopPropagation();">วันนี้</button>`;
  popup.innerHTML = html;
}

function repCalNavMonth(delta) {
  repCalViewMonth += delta;
  if (repCalViewMonth > 11) { repCalViewMonth = 0; repCalViewYear++; }
  if (repCalViewMonth < 0) { repCalViewMonth = 11; repCalViewYear--; }
  renderRepCalendar();
}

function selectRepCalDate(y, m, d) {
  repSelectedDate = new Date(y, m, d);
  closeRepCalendar();
  renderTodayReport();
}

function selectRepCalToday() {
  repSelectedDate = null;
  closeRepCalendar();
  renderTodayReport();
}

function renderWeeklyReport() {
  const c = appState.classes.find(x => x.id === currentClassId);
  if (!c) return;
  const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const DOW_TH = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
  const today = getTodayString();
  // แต่ละวันที่เช็คชื่อ = 1 คาบ (report รายคาบ ไม่รวมเป็นสัปดาห์)
  const sessions = Object.keys(c.attendance || {}).filter(d => d <= today).sort();

  // นิยามเดียวทั้งระบบ: เฉพาะ "ขาด" หักเวลาเรียน — สาย/ลา นับเป็นมา
  // คนที่ยังไม่ได้เช็ค (ไม่มีข้อมูล) = ไม่นับ (หารเฉพาะคนที่เช็คจริงในคาบนั้น)
  const statDay = d => {
    let absent=0, late=0, leave=0, checked=0;
    c.students.forEach(s => {
      const st=(c.attendance[d]||{})[s.id];
      if(!st) return; // ไม่มีข้อมูล = ไม่นับ
      checked++;
      if(st==='absent')absent++; else if(st==='late')late++; else if(st==='leave')leave++;
    });
    return { absent, late, leave, checked, pct: checked>0 ? Math.round((checked-absent)/checked*100) : 0 };
  };
  const dateLabel = d => { const o = new Date(d+'T00:00:00'); return `${o.getDate()} ${MONTHS_TH[o.getMonth()]}`; };
  const dowLabel  = d => { const o = new Date(d+'T00:00:00'); return DOW_TH[o.getDay()]; };

  const lessonsEl = document.getElementById('web-rep-weekly-lessons');
  const pillsEl   = document.getElementById('web-rep-weekly-pills');
  const insEl     = document.getElementById('web-rep-weekly-insights');
  const chart     = document.getElementById('web-rep-weekly-trend-chart');

  if (!sessions.length) {
    lessonsEl.innerText = '0 คาบ';
    pillsEl.innerHTML = '<span class="subtitle">ยังไม่มีข้อมูลการเช็คชื่อ</span>';
    insEl.innerText = 'ยังไม่มีข้อมูล';
    chart.innerHTML = '';
    return;
  }

  // สรุปภาพรวมทุกคาบ
  const perSession = sessions.map(d => ({ d, s: statDay(d) }));
  let oAbsent=0, oLate=0, oLeave=0, oChecked=0;
  perSession.forEach(x => { oAbsent+=x.s.absent; oLate+=x.s.late; oLeave+=x.s.leave; oChecked+=x.s.checked; });
  const overallPct = oChecked>0 ? Math.round((oChecked-oAbsent)/oChecked*100) : 0;

  lessonsEl.innerText = `${sessions.length} คาบ`;
  pillsEl.innerHTML =
    `<span class="summary-pill" style="background:var(--color-present-bg);color:var(--color-present);font-weight:800;">เข้าเรียนเฉลี่ย ${overallPct}%</span>`
    + `<span class="summary-pill" style="background:var(--color-absent-bg);color:var(--color-absent);">ขาด ${oAbsent} ครั้ง</span>`
    + `<span class="summary-pill" style="background:var(--color-late-bg);color:var(--color-late-text);">สาย ${oLate} ครั้ง</span>`
    + `<span class="summary-pill" style="background:var(--color-leave-bg);color:var(--color-leave);">ลา ${oLeave} ครั้ง</span>`;

  // insight: ภาพรวม + คาบที่เข้าเรียนน้อยสุด
  const worst = perSession.reduce((a, x) => (!a || x.s.pct < a.s.pct ? x : a), null);
  insEl.innerText = `จากทั้งหมด ${sessions.length} คาบ เข้าเรียนเฉลี่ย ${overallPct}%`
    + (oAbsent>0 ? ` · ขาดรวม ${oAbsent} ครั้ง` : ' · ไม่มีขาด')
    + (worst && worst.s.pct < 100 ? ` · คาบที่เข้าเรียนน้อยสุด ${dateLabel(worst.d)} (${worst.s.pct}%)` : '');

  // กราฟแท่งรายคาบ: Y = % เข้าเรียน, X = แต่ละคาบ (วันที่) — เลื่อนแนวนอนได้
  const PAD = { top: 32, right: 16, bottom: 48, left: 44 };
  const H = 210;
  const slotW = 56;
  const minW = chart.clientWidth || 600;
  const W = Math.max(minW, PAD.left + sessions.length * slotW + PAD.right);
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const barW = Math.min(slotW * 0.55, 26);

  const yTicks = [0, 25, 50, 75, 100];
  const yPos = pct => PAD.top + chartH - (pct / 100) * chartH;
  const xCenter = i => PAD.left + slotW * i + slotW / 2;

  let gridSvg = '';
  yTicks.forEach(t => {
    const y = yPos(t);
    gridSvg += `<line x1="${PAD.left}" y1="${y}" x2="${PAD.left + chartW}" y2="${y}"
      stroke="${t === 0 ? '#bbb' : '#ebebeb'}" stroke-width="${t === 0 ? 1.5 : 1}" stroke-dasharray="${t === 0 ? '' : '4,3'}"/>
      <text x="${PAD.left - 6}" y="${y + 4}" text-anchor="end" font-size="12" fill="#888" font-family="LINE Seed Sans TH, sans-serif">${t}%</text>`;
  });

  const baseline = PAD.top + chartH;
  let barsSvg = '', xLabelSvg = '';
  perSession.forEach((w, i) => {
    const cx = xCenter(i);
    const barH = Math.max((w.s.pct / 100) * chartH, 2);
    const barY = baseline - barH;
    const color = w.s.pct >= 80 ? '#2ecc71' : w.s.pct >= 60 ? '#f39c12' : '#e74c3c';

    // แท่งงอกจากพื้น 0 → ความสูงจริง (SVG animate รีรันทุกครั้งที่ render แท็บ) + ป้าย % ค่อยปรากฏ
    barsSvg += `
      <rect x="${cx - barW/2}" y="${baseline}" width="${barW}" height="0" rx="3" ry="3" fill="${color}" opacity="0.85">
        <animate attributeName="y" values="${baseline};${barY}" dur="0.8s" begin="0s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.22 1 0.36 1"/>
        <animate attributeName="height" values="0;${barH}" dur="0.8s" begin="0s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.22 1 0.36 1"/>
      </rect>
      <text x="${cx}" y="${barY - 6}" text-anchor="middle" font-size="11" font-weight="800" fill="#333" font-family="LINE Seed Sans TH, sans-serif" opacity="0">${w.s.pct}%<animate attributeName="opacity" values="0;1" begin="0.45s" dur="0.35s" fill="freeze"/></text>`;
    xLabelSvg += `
      <text x="${cx}" y="${PAD.top + chartH + 17}" text-anchor="middle" font-size="12" font-weight="800" fill="#333" font-family="LINE Seed Sans TH, sans-serif">${i + 1}</text>
      <text x="${cx}" y="${PAD.top + chartH + 31}" text-anchor="middle" font-size="9" fill="#888" font-family="LINE Seed Sans TH, sans-serif">${dateLabel(w.d)}</text>`;
  });

  chart.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible;">
    ${gridSvg}
    ${barsSvg}
    ${xLabelSvg}
  </svg>`;
}

function renderTermReport() {
  const c = appState.classes.find(x => x.id === currentClassId);
  if (!c) return;
  const todayStr = getTodayString();
  const dates = Object.keys(c.attendance || {}).filter(d => d <= todayStr).sort();
  
  // Student attendance grid: ชื่อ + สีแต่ละคาบ
  const heatmap = document.getElementById('web-rep-term-heatmap-grid');
  heatmap.innerHTML = '';

  const STATUS_COLOR = {
    present: 'var(--color-present)',
    late:    'var(--color-late)',
    absent:  'var(--color-absent)',
    leave:   'var(--color-leave)',
  };
  const STATUS_LABEL = { present: 'มา', late: 'สาย', absent: 'ขาด', leave: 'ลา' };
  const STATUS_TEXT  = { present: 'var(--color-present)', late: 'var(--color-late-text)', absent: 'var(--color-absent)', leave: 'var(--color-leave)' };

  // grid columns: ชื่อ 140px + คาบ 28px ต่อคาบ + รวม (พื้นที่ที่เหลือชิดขวา)
  const gridCols = `140px repeat(${dates.length}, 28px) minmax(90px, 1fr)`;

  // ===== เดสก์ท็อป: ตาราง dot รายคาบเต็ม =====
  let desktop = `<div class="term-grid-row term-grid-header" style="--term-cols:${gridCols};"><div class="term-grid-name"></div>`;
  dates.forEach((d, i) => { desktop += `<div class="term-grid-cell term-grid-date" style="font-size:0.7rem;">${i+1}</div>`; });
  desktop += `<div class="term-grid-summary is-header">รวม</div></div>`;

  // ===== มือถือ: การ์ดสรุปต่อคน มา/สาย/ขาด/ลา + % (dot รายคาบไปดูบนคอม) =====
  let mobile = '';

  c.students.forEach(s => {
    let absent=0, late=0, leave=0, present=0;
    let cells = '', timeline = '';
    dates.forEach((d, i) => {
      const st = (c.attendance[d]||{})[s.id] || '';
      if (st==='present') present++;
      else if (st==='late') late++;
      else if (st==='absent') absent++;
      else if (st==='leave') leave++;
      const bg = STATUS_COLOR[st] || '#d1d5db';
      cells += `<div class="term-grid-cell" title="${s.name}: ${STATUS_LABEL[st]||'-'}"><span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${bg};"></span></div>`;
      timeline += `<span class="tm-tl-item"><b>คาบ ${i+1}</b><span class="tm-tl-end"><span class="tm-tl-st" style="color:${STATUS_TEXT[st]||'var(--text-muted)'};">${STATUS_LABEL[st]||'–'}</span><span class="tm-dot" style="background:${bg};"></span></span></span>`;
    });
    const total = present+late+absent+leave;
    const pctS = total > 0 ? Math.round((present+late)/total*100) : 0;
    const pctColor = pctS >= 80 ? 'var(--color-present)' : pctS >= 60 ? 'var(--color-late-text)' : 'var(--color-absent)';
    const nameLabel = `${s.no ? s.no+'. ' : ''}${s.name}`;

    // panel กาง (dot รายคาบ + ลิงก์ไปหน้าแก้ไข) ใช้ร่วมทั้งมือถือ/คอม
    const panel = timeline
      ? `<div class="term-tl">${timeline}</div><button class="term-tl-edit" onclick="event.stopPropagation();currentClassId='${c.id}';openStudentDetailModal('${s.id}','${c.id}')"><i class="hgi-stroke hgi-edit-02"></i> แก้ไขข้อมูล</button>`
      : `<div class="tm-tl-empty">ยังไม่มีข้อมูลการเช็คชื่อ</div>`;

    desktop += `<div class="term-grid-row term-clickable" style="--term-cols:${gridCols};" onclick="toggleTermExpand('tmx-d-${s.id}',this)">
      <div class="term-grid-name">${nameLabel}</div>
      ${cells}
      <div class="term-grid-summary">
        <span style="font-weight:800;font-size:0.82rem;color:${pctColor};white-space:nowrap;">${pctS}%</span>
      </div>
    </div>
    <div class="term-expand term-expand-desk" id="tmx-d-${s.id}">${panel}</div>`;

    const stat = (color, label, n) => `<span class="tm-stat${n>0?' on':''}"><span class="tm-dot" style="background:${color};"></span>${label} <b>${n}</b></span>`;
    mobile += `<div class="term-mcard term-clickable" onclick="toggleTermExpand('tmx-m-${s.id}',this)">
      <div class="term-mcard-top">
        <span class="term-mcard-name">${nameLabel}</span>
        <span class="term-mcard-pct" style="color:${pctColor};">${total>0 ? pctS+'%' : '—'} <i class="hgi-stroke hgi-arrow-down-01 tm-chev"></i></span>
      </div>
      <div class="term-mcard-stats">
        ${stat('var(--color-present)','มา',present)}
        ${stat('var(--color-late)','สาย',late)}
        ${stat('var(--color-absent)','ขาด',absent)}
        ${stat('var(--color-leave)','ลา',leave)}
      </div>
      <div class="term-expand" id="tmx-m-${s.id}">${panel}</div>
    </div>`;
  });

  heatmap.innerHTML = `<div class="term-desktop-view">${desktop}</div><div class="term-mobile-view">${mobile}</div>`;
}

// แตะการ์ด/แถวรายภาค → กาง/พับ panel dot รายคาบ (ปิดอันอื่นก่อนเพื่อเปิดทีละคน)
function toggleTermExpand(panelId, rowEl) {
  const el = document.getElementById(panelId);
  if (!el) return;
  const willOpen = !el.classList.contains('open');
  document.querySelectorAll('.term-expand.open').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.term-clickable.expanded').forEach(r => r.classList.remove('expanded'));
  if (willOpen) {
    el.classList.add('open');
    if (rowEl) rowEl.classList.add('expanded');
  }
}

function renderOverallReport() {
  const c = appState.classes.find(x => x.id === currentClassId);
  if (!c) return;
  const pct = calculateAttendancePercentage(c);
  const pctEl = document.getElementById('web-rep-overall-pct');
  const circle = document.getElementById('web-rep-overall-circle');

  // ไล่สีตามคะแนน: เขียว(ดี) → ส้ม(ต้องติดตาม) → แดง(วิกฤต)
  const health = pct >= 90
    ? { color: 'var(--color-present)',    icon: 'hgi-checkmark-circle-02', msg: 'สุขภาพห้องเรียนดีเยี่ยม', bg: 'var(--color-present-bg)', fg: 'var(--color-present)' }
    : pct >= 75
    ? { color: '#f59e0b',                 icon: 'hgi-alert-circle',        msg: 'ต้องติดตาม',            bg: 'var(--color-late-bg)',    fg: 'var(--color-late-text)' }
    : { color: 'var(--color-absent)',     icon: 'hgi-alert-02',            msg: 'วิกฤต',                 bg: 'var(--color-absent-bg)',  fg: 'var(--color-absent)' };
  if (circle) circle.style.stroke = health.color;
  if (pctEl) pctEl.style.color = health.color;

  if (circle && pctEl) {
    const targetOffset = 251.2 - (251.2 * pct / 100);
    // Reset to 0 first
    circle.style.transition = 'none';
    circle.style.strokeDashoffset = 251.2;
    pctEl.innerText = '0%';
    // Double rAF ensures browser paints the reset before animating
    requestAnimationFrame(() => requestAnimationFrame(() => {
      circle.style.transition = '';
      circle.style.strokeDashoffset = targetOffset;
      // Count-up number animation
      const duration = 900;
      const startTime = performance.now();
      function tick(now) {
        const t = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        pctEl.innerText = Math.round(eased * pct) + '%';
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }));
  }
  
  let totalAbsent=0, totalLate=0;
  const dates = Object.keys(c.attendance||{});
  dates.forEach(d => { c.students.forEach(s => { const st=(c.attendance[d]||{})[s.id]; if(st==='absent')totalAbsent++; if(st==='late')totalLate++; }); });
  document.getElementById('web-rep-overall-absent').innerText = totalAbsent;
  document.getElementById('web-rep-overall-late').innerText = totalLate;

  const badge = document.getElementById('web-rep-overall-health-badge');
  badge.innerHTML = `<i class="hgi-stroke ${health.icon}"></i> ${health.msg}`;
  badge.style.background = health.bg;
  badge.style.color = health.fg;

  const riskStudents = [];
  c.students.forEach(s => { let ab=0; dates.forEach(d=>{if((c.attendance[d]||{})[s.id]==='absent')ab++;}); if(ab>=2) riskStudents.push({name:s.name,absent:ab}); });
  document.getElementById('web-rep-overall-insights').innerHTML = riskStudents.length > 0
    ? riskStudents.map(r => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><i class="hgi-stroke hgi-alert-02" style="color:var(--color-absent);"></i> ${r.name} ขาด ${r.absent} คาบ</div>`).join('')
    : '<div style="display:flex;align-items:center;gap:6px;"><i class="hgi-stroke hgi-checkmark-circle-02" style="color:var(--color-present);"></i> ไม่มีนักเรียนกลุ่มเสี่ยง</div>';
}

// ==================== EXCEL EXPORT ====================
function printReport() {
  const titleEl = document.getElementById('web-rep-detail-class-title');
  const subject = titleEl ? titleEl.innerText.trim() : 'รายงานการเข้าเรียน';
  const email = localStorage.getItem('classmanager_email') || '';
  const fallback = email ? `ครู${email.split('@')[0]}` : 'คุณครู';
  const teacher = (appState.teacherName || '').trim() || fallback;
  const activeTab = document.querySelector('#web-screen-reports .report-tab-item.active');
  const tabName = activeTab ? activeTab.innerText.trim() : '';
  const now = new Date();
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear() + 543}`;
  const hdr = document.getElementById('ck-print-header');
  if (hdr) {
    hdr.innerHTML =
      `<div class="ck-print-brand">ClassKru · รายงานการเข้าเรียน</div>` +
      `<div class="ck-print-title">${subject}</div>` +
      `<div class="ck-print-sub">ครูผู้สอน: ${teacher} &nbsp;·&nbsp; มุมมอง: ${tabName} &nbsp;·&nbsp; พิมพ์เมื่อ ${dateStr}</div>`;
  }
  window.print();
}

function exportAttendanceExcel() {
  if (!currentClassId) return;
  const c = appState.classes.find(x => x.id === currentClassId);
  if (!c) return;

  const dates = Object.keys(c.attendance || {}).sort();
  if (dates.length === 0) {
    showToast('ไม่มีข้อมูลการเช็คชื่อสำหรับส่งออก', 'warning');
    return;
  }

  // Create Headers
  const header = ['เลขที่', 'รหัสประจำตัว', 'ชื่อ-นามสกุล', ...dates.map(d => {
    // Format YYYY-MM-DD to DD/MM/YYYY
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }), 'มา', 'สาย', 'ขาด', 'ลา'];

  const rows = [];
  rows.push(header);

  // Student Rows
  c.students.forEach((s, idx) => {
    const row = [s.no || (idx + 1), s.studentCode || '', s.name];
    let p = 0, l = 0, a = 0, lv = 0;
    
    dates.forEach(d => {
      const st = (c.attendance[d] || {})[s.id];
      let txt = '';
      if (st === 'present') { txt = 'มา'; p++; }
      else if (st === 'late') { txt = 'สาย'; l++; }
      else if (st === 'absent') { txt = 'ขาด'; a++; }
      else if (st === 'leave') { txt = 'ลา'; lv++; }
      else { txt = '-'; }
      row.push(txt);
    });
    
    row.push(p, l, a, lv);
    rows.push(row);
  });

  // Create Workbook and export
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  XLSX.writeFile(wb, `เช็คชื่อ_${c.subject}_${c.className}.xlsx`);
}

// ==================== EXCEL IMPORT ====================
function downloadStudentsTemplate() {
  try {
    const data = [
      ["เลขที่", "รหัสประจำตัว", "ชื่อ", "นามสกุล", "ชั้นเรียน"],
      [1,  "13001", "เด็กชายอนันต์",    "มีสุข",       "ม.1/1"],
      [2,  "13002", "เด็กหญิงกนกวรรณ", "สว่างจิต",    "ม.1/1"],
      [3,  "13003", "เด็กชายธนภัทร",   "ชูศรี",       "ม.1/1"],
      [4,  "13004", "เด็กหญิงปิยะดา",  "แก้วมณี",     "ม.1/1"],
      [5,  "13005", "เด็กชายวรพล",     "ทองดี",       "ม.1/1"],
      [6,  "13006", "เด็กหญิงณัฐธิดา", "พรหมบุตร",    "ม.1/1"],
      [7,  "13007", "เด็กชายพีรพัฒน์", "รุ่งเรือง",   "ม.1/1"],
      [8,  "13008", "เด็กหญิงสุภาพร",  "ดวงดี",       "ม.1/1"],
      [9,  "13009", "เด็กชายกิตติพงษ์","ศรีวิชัย",    "ม.1/1"],
      [10, "13010", "เด็กหญิงอัจฉรา",  "บุญรักษา",    "ม.1/1"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    // Column widths
    ws['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายชื่อนักเรียน");
    XLSX.writeFile(wb, "ClassKru_รายชื่อนักเรียน_template.xlsx");
  } catch (err) {
    showToast("เกิดข้อผิดพลาด: " + err.message, "error");
  }
}

function downloadTimetableTemplate() {
  try {
    const data = [
      ["วัน", "คาบ", "ห้องเรียน", "วิชา"],
      ["จันทร์", 1, "ม.1/1", "คณิตศาสตร์"],
      ["จันทร์", 2, "ม.1/1", "วิทยาศาสตร์"],
      ["อังคาร", 1, "ม.1/2", "ภาษาอังกฤษ"],
      ["อังคาร", 2, "ม.1/2", "ภาษาไทย"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ตารางสอน");
    XLSX.writeFile(wb, "classkru_timetable_template.xlsx");
  } catch (err) {
    showToast("เกิดข้อผิดพลาด: " + err.message, "error");
  }
}

function switchExcelImportTab(tab) {
  currentExcelImportTab = tab;
  document.getElementById('btn-excel-tab-students').classList.toggle('active', tab === 'students');
  document.getElementById('btn-excel-tab-timetable').classList.toggle('active', tab === 'timetable');
  document.getElementById('excel-panel-students').style.display = tab === 'students' ? 'block' : 'none';
  document.getElementById('excel-panel-timetable').style.display = tab === 'timetable' ? 'block' : 'none';
}

let directImportTargetClassId = null;

function triggerDirectClassExcelImport(classId) {
  directImportTargetClassId = classId;
  document.getElementById('modal-direct-excel').classList.add('show');
}

function closeDirectExcelModal() {
  document.getElementById('modal-direct-excel').classList.remove('show');
}

function handleDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('dragover');
}

function handleExcelDrop(event, inputId) {
  event.preventDefault();
  event.currentTarget.classList.remove('dragover');
  const files = event.dataTransfer.files;
  if (files && files.length > 0) {
    const input = document.getElementById(inputId);
    input.files = files;
    // Trigger the change event manually
    const changeEvent = new Event('change', { bubbles: true });
    input.dispatchEvent(changeEvent);
  }
}

function handleDirectClassExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (json.length < 2) { showToast('ไฟล์ไม่มีข้อมูล', 'warning'); return; }
      
      const headers = json[0].map(h => String(h || '').trim().toLowerCase());
      let noIdx       = headers.findIndex(h => h.includes('เลขที่') || h.includes('ลำดับ') || h.includes('no'));
      let codeIdx     = headers.findIndex(h => h.includes('รหัส') || h.includes('code') || h.includes('sid') || h === 'id');
      let nameIdx     = headers.findIndex(h => h === 'ชื่อ' || h.includes('ชื่อ-') || h.includes('name'));
      let lastnameIdx = headers.findIndex(h => h.includes('นามสกุล') || h.includes('last') || h.includes('surname'));

      if (nameIdx === -1) {
        showToast('ไม่พบคอลัมน์ "ชื่อ" ในไฟล์ Excel', 'warning'); return;
      }

      const targetClass = appState.classes.find(c => c.id === directImportTargetClassId);
      if (!targetClass) return;

      let added = 0;
      json.slice(1).forEach(r => {
        if (!r[nameIdx]) return;
        let name = String(r[nameIdx]).trim();
        if (lastnameIdx >= 0 && r[lastnameIdx]) name += ' ' + String(r[lastnameIdx]).trim();
        const no = noIdx >= 0 ? (Number(r[noIdx]) || (targetClass.students.length + 1)) : (targetClass.students.length + 1);
        const studentCode = codeIdx >= 0 ? String(r[codeIdx] || '').trim() : '';

        // Skip only if same เลขที่ already exists (allow same name, different number)
        if (noIdx >= 0 && targetClass.students.some(s => s.no === no)) return;

        targetClass.students.push({ id: 's_' + Date.now() + Math.random().toString(36).substr(2, 5), name, no, studentCode, score: 0, comment: '' });
        added++;
      });
      
      saveState();
      renderWebClassrooms();
      refreshSwipeIfOpen();
      showToast(`นำเข้านักเรียนเรียบร้อย ${added} คน`, 'success');
    } catch (err) {
      showToast('อ่านไฟล์ไม่ได้: ' + err.message, 'error');
    } finally {
      event.target.value = ''; // Reset input
    }
  };
  reader.readAsArrayBuffer(file);
}

function handleExcelStudentsUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (json.length < 2) { showToast('ไฟล์ไม่มีข้อมูล', 'warning'); return; }
      parsedExcelHeaders = json[0].map(h => String(h || '').trim());
      parsedExcelRows = json.slice(1).filter(r => r.some(c => c));
      parsedExcelType = 'students';
      showStudentMappingUI();
    } catch (err) { showToast('อ่านไฟล์ไม่ได้: ' + err.message, 'error'); }
  };
  reader.readAsArrayBuffer(file);
}

function showStudentMappingUI() {
  document.getElementById('excel-students-mapping-area').style.display = 'block';
  const opts = '<option value="">-- เลือก --</option>' + parsedExcelHeaders.map((h,i) => `<option value="${i}">${h}</option>`).join('');
  ['map-student-no','map-student-code','map-student-name','map-student-lastname','map-student-class'].forEach(id => { document.getElementById(id).innerHTML = opts; });
  autoGuessMapping('students');
  
  // Target class dropdown
  const target = document.getElementById('map-student-target-class');
  target.innerHTML = '<option value="">-- สร้างอัตโนมัติ --</option>';
  appState.classes.forEach(c => { target.innerHTML += `<option value="${c.id}">${c.subject} (${c.className})</option>`; });

  // Preview
  const preview = document.getElementById('excel-students-preview-table');
  let html = '<thead><tr>' + parsedExcelHeaders.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
  parsedExcelRows.slice(0, 5).forEach(r => { html += '<tr>' + parsedExcelHeaders.map((_,i) => `<td>${r[i]||''}</td>`).join('') + '</tr>'; });
  html += '</tbody>';
  preview.innerHTML = html;
}

function autoGuessMapping(type) {
  if (type === 'students') {
    parsedExcelHeaders.forEach((h, i) => {
      const low = h.toLowerCase();
      if (low.includes('เลขที่') || low.includes('ลำดับ') || low.includes('no')) document.getElementById('map-student-no').value = i;
      if (low.includes('รหัส') || low.includes('code') || low.includes('sid') || low === 'id') document.getElementById('map-student-code').value = i;
      if (low === 'ชื่อ' || low.includes('name') || low.includes('ชื่อ-สกุล') || low.includes('ชื่อ-นามสกุล')) document.getElementById('map-student-name').value = i;
      if (low.includes('นามสกุล') || low.includes('last') || low.includes('surname')) document.getElementById('map-student-lastname').value = i;
      if (low.includes('ชั้น') || low.includes('ห้อง') || low.includes('class')) document.getElementById('map-student-class').value = i;
    });
  }
}

function confirmStudentsExcelImport() {
  const nameIdx = parseInt(document.getElementById('map-student-name').value);
  const lastnameIdx = parseInt(document.getElementById('map-student-lastname').value);
  if (isNaN(nameIdx)) { showToast('กรุณาเลือกคอลัมน์ชื่อ', 'warning'); return; }
  const noIdx = parseInt(document.getElementById('map-student-no').value);
  const codeIdx = parseInt(document.getElementById('map-student-code').value);
  const classIdx = parseInt(document.getElementById('map-student-class').value);
  const targetClassId = document.getElementById('map-student-target-class').value;

  let imported = 0;
  parsedExcelRows.forEach((row, ri) => {
    let name = String(row[nameIdx] || '').trim();
    if (!name) return;
    
    // Add last name if mapped
    if (!isNaN(lastnameIdx)) {
      const lname = String(row[lastnameIdx] || '').trim();
      if (lname) name += ' ' + lname;
    }
    
    let targetClass;
    if (targetClassId) {
      targetClass = appState.classes.find(c => c.id === targetClassId);
    } else {
      const className = !isNaN(classIdx) ? String(row[classIdx] || '').trim() : 'ห้องเรียนใหม่';
      targetClass = appState.classes.find(c => c.className === className);
      if (!targetClass) {
        targetClass = { id: 'c_' + Date.now() + '_' + ri, subject: 'วิชาใหม่', className, students: [], attendance: {}, notes: {} };
        appState.classes.push(targetClass);
      }
    }
    if (!targetClass) return;

    const no = !isNaN(noIdx) ? parseInt(row[noIdx]) || (targetClass.students.length + 1) : targetClass.students.length + 1;
    const studentCode = !isNaN(codeIdx) ? String(row[codeIdx] || '').trim() : '';
    targetClass.students.push({ id: `s_${Date.now()}_${ri}`, name, no, studentCode, score: 0, comment: '' });
    imported++;
  });

  saveState();
  showToast(`นำเข้าสำเร็จ ${imported} คน! 🎉`, 'success');
  document.getElementById('excel-students-mapping-area').style.display = 'none';
  if (directImportTargetClassId) {
    closeDirectExcelModal();
    directImportTargetClassId = null;
  }
  navigateToWebScreen(appState.activeWebScreen);
}

function handleExcelTimetableUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (json.length < 2) { showToast('ไฟล์ไม่มีข้อมูล', 'warning'); return; }
      parsedExcelHeaders = json[0].map(h => String(h || '').trim());
      parsedExcelRows = json.slice(1).filter(r => r.some(c => c));
      showTimetableMappingUI();
    } catch (err) { showToast('อ่านไฟล์ไม่ได้: ' + err.message, 'error'); }
  };
  reader.readAsArrayBuffer(file);
}

function showTimetableMappingUI() {
  document.getElementById('excel-timetable-mapping-area').style.display = 'block';
  const opts = '<option value="">-- เลือก --</option>' + parsedExcelHeaders.map((h,i) => `<option value="${i}">${h}</option>`).join('');
  ['map-table-day','map-table-period','map-table-class','map-table-subject'].forEach(id => { document.getElementById(id).innerHTML = opts; });
  
  const preview = document.getElementById('excel-timetable-preview-table');
  let html = '<thead><tr>' + parsedExcelHeaders.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
  parsedExcelRows.slice(0, 5).forEach(r => { html += '<tr>' + parsedExcelHeaders.map((_,i) => `<td>${r[i]||''}</td>`).join('') + '</tr>'; });
  html += '</tbody>';
  preview.innerHTML = html;
}

function confirmTimetableExcelImport() {
  const dayIdx = parseInt(document.getElementById('map-table-day').value);
  const periodIdx = parseInt(document.getElementById('map-table-period').value);
  const classIdx = parseInt(document.getElementById('map-table-class').value);
  const subjectIdx = parseInt(document.getElementById('map-table-subject').value);
  if (isNaN(dayIdx) || isNaN(periodIdx)) { showToast('กรุณาเลือกคอลัมน์วันและคาบ', 'warning'); return; }

  let imported = 0;
  parsedExcelRows.forEach(row => {
    const dayStr = String(row[dayIdx] || '').trim();
    const period = parseInt(row[periodIdx]);
    if (!dayStr || !period) return;
    const dowMap = {'จันทร์':1,'อังคาร':2,'พุธ':3,'พฤหัสบดี':4,'ศุกร์':5,'เสาร์':6,'อาทิตย์':0};
    const dow = dowMap[dayStr] !== undefined ? dowMap[dayStr] : parseInt(dayStr);
    if (isNaN(dow)) return;

    const className = !isNaN(classIdx) ? String(row[classIdx]||'').trim() : '';
    const subject = !isNaN(subjectIdx) ? String(row[subjectIdx]||'').trim() : '';
    const matchClass = appState.classes.find(c => c.className === className);

    appState.timetable.push({
      dow, period,
      classId: matchClass ? matchClass.id : '',
      subject: subject || (matchClass ? matchClass.subject : 'ไม่ระบุ'),
      className: className || (matchClass ? matchClass.className : ''),
      week: appState.timetableWeek || 'A'
    });
    imported++;
  });

  saveState();
  showToast(`นำเข้าตารางเรียน ${imported} คาบ! 🎉`, 'success');
  document.getElementById('excel-timetable-mapping-area').style.display = 'none';
  closeTimetableImport();
  renderWebTimetable();
}

// ==========================================
// ====  SWIPE ATTENDANCE (NEW FEATURE)  ====
// ==========================================

// ========== SWIPE CALENDAR PICKER ==========
