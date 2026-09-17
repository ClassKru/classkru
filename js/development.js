/**
 * ClassKru — พัฒนาผู้เรียน
 * Optional evidence layer over normal classroom work.
 * This first version is deliberately deterministic: no AI/API calls.
 */
(function () {
  'use strict';

  let selectedProjectId = null;
  let developmentView = 'detail';

  function ensureProjects() {
    if (!Array.isArray(appState.developmentProjects)) appState.developmentProjects = [];
    return appState.developmentProjects;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function projectClass(project) {
    return (appState.classes || []).find(item => item.id === project.classId) || null;
  }

  function classLabel(c) {
    return c ? `${c.subject || 'ไม่ระบุวิชา'} (${c.className || 'ไม่ระบุห้อง'})` : 'ยังไม่ได้เลือกห้องเรียน';
  }

  function scoreItems(c) {
    return Array.isArray(c?.scores?.items) ? c.scores.items : [];
  }

  function itemById(c, id) {
    return scoreItems(c).find(item => item.id === id) || null;
  }

  function indicatorOptions(c) {
    const board = c?.scores?.config?.indicatorBoard;
    const catalog = window.CKCurriculumCatalog;
    if (!Array.isArray(board) || !catalog) return [];
    return board.map(block => {
      const subject = catalog.getSubject(block.subjectId);
      const indicator = subject?.dataset?.indicators?.find(item => item.id === block.indicatorId);
      return indicator ? { ...indicator, subjectId: block.subjectId } : null;
    }).filter(Boolean);
  }

  function selectedIndicator(project, c) {
    const ref = project?.indicator;
    if (!ref) return null;
    return indicatorOptions(c).find(item => item.id === ref.id) || ref;
  }

  function scorePercent(c, itemId) {
    const item = itemById(c, itemId);
    if (!item || !Number(item.max)) return null;
    const marks = c.scores?.marks?.[itemId] || {};
    const values = (c.students || []).map(s => marks[s.id])
      .filter(v => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v)))
      .map(v => Number(v));
    if (!values.length) return null;
    return { percent: values.reduce((sum, value) => sum + value, 0) / values.length / Number(item.max) * 100, count: values.length, total: (c.students || []).length };
  }

  function projectStatus(project, c) {
    const baseline = scorePercent(c, project.baselineItemId);
    const post = scorePercent(c, project.postItemId);
    if (!project.classId || !project.indicator || !project.problem || !project.objective) return { key: 'setup', label: 'ตั้งค่าไม่ครบ', tone: 'warning', baseline, post };
    if (!baseline || !post) return { key: 'collecting', label: 'รอข้อมูลก่อน–หลังเรียน', tone: 'info', baseline, post };
    return { key: 'ready', label: 'มีข้อมูลพร้อมวิเคราะห์', tone: 'done', baseline, post };
  }

  function deltaLabel(status) {
    if (!status.baseline || !status.post) return 'ยังเปรียบเทียบไม่ได้';
    const delta = status.post.percent - status.baseline.percent;
    return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} จุดร้อยละ`;
  }

  function studentMark(c, itemId, studentId) {
    const item = itemById(c, itemId);
    const value = c?.scores?.marks?.[itemId]?.[studentId];
    if (!item || value === '' || value === null || value === undefined || !Number.isFinite(Number(value))) return null;
    return { raw: Number(value), percent: Number(value) / Number(item.max) * 100 };
  }

  function studentEvidenceRows(project, c) {
    return (c?.students || []).map(student => {
      const before = studentMark(c, project.baselineItemId, student.id);
      const after = studentMark(c, project.postItemId, student.id);
      const delta = before && after ? after.percent - before.percent : null;
      return { student, before, after, delta };
    });
  }

  function studentEvidenceTable(project, c) {
    const rows = studentEvidenceRows(project, c);
    if (!rows.length) return '<div class="dev-table-empty">ยังไม่มีรายชื่อนักเรียนในห้องนี้</div>';
    return `<div class="dev-data-table-wrap"><table class="dev-data-table"><thead><tr><th>นักเรียน</th><th>ก่อนเรียน</th><th>หลังเรียน</th><th>ผลต่าง</th><th>สถานะ</th></tr></thead><tbody>${rows.map(row => {
      const status = !row.before && !row.after ? ['ยังไม่มีข้อมูล','warning'] : !row.before || !row.after ? ['ข้อมูลไม่ครบ','warning'] : [row.delta >= 0 ? 'พัฒนาขึ้น' : 'ลดลง', row.delta >= 0 ? 'done' : 'danger'];
      return `<tr><td><strong>${esc(row.student.name || 'ไม่ระบุชื่อ')}</strong><small>${esc(row.student.studentCode || `เลขที่ ${row.student.no || '—'}`)}</small></td><td>${row.before ? `${row.before.raw}/${esc(itemById(c, project.baselineItemId)?.max)} <small>${row.before.percent.toFixed(1)}%</small>` : '—'}</td><td>${row.after ? `${row.after.raw}/${esc(itemById(c, project.postItemId)?.max)} <small>${row.after.percent.toFixed(1)}%</small>` : '—'}</td><td class="dev-delta ${row.delta === null ? '' : row.delta >= 0 ? 'positive' : 'negative'}">${row.delta === null ? '—' : `${row.delta >= 0 ? '+' : ''}${row.delta.toFixed(1)} จุด`}</td><td><span class="dev-status ${status[1]}">${status[0]}</span></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function reportHtml(project) {
    const c = projectClass(project);
    const status = projectStatus(project, c);
    const indicator = selectedIndicator(project, c);
    const beforeItem = itemById(c, project.baselineItemId);
    const postItem = itemById(c, project.postItemId);
    const rows = studentEvidenceRows(project, c);
    const completeRows = rows.filter(row => row.before && row.after);
    const improved = completeRows.filter(row => row.delta >= 0).length;
    return `<div class="dev-report-page"><div class="dev-report-toolbar"><button class="btn-back" type="button" onclick="backToDevelopmentDetail()"><i class="hgi-stroke hgi-arrow-left-01"></i> กลับโครงการ</button><div><button class="btn" type="button" onclick="window.print()"><i class="hgi-stroke hgi-printer"></i> พิมพ์ / PDF</button></div></div><article class="dev-report-paper"><header><span>ร่างรายงานผลการพัฒนาผู้เรียน</span><h1>${esc(project.title)}</h1><p>${esc(classLabel(c))} · ${esc(indicator?.code || 'ยังไม่มีตัวชี้วัด')}</p></header><section><h2>1. ปัญหาและความสำคัญ</h2><p>${esc(project.problem || 'ยังไม่ได้ระบุ')}</p></section><section><h2>2. เป้าหมายการพัฒนา</h2><p>${esc(project.objective || 'ยังไม่ได้ระบุ')}</p></section><section><h2>3. วิธีการดำเนินงาน</h2><p>${esc(project.intervention || 'ยังไม่ได้ระบุ')}</p><p>หลักฐานที่ใช้: ${esc(beforeItem?.name || 'ไม่ระบุ')} เป็นข้อมูลก่อนเรียน และ ${esc(postItem?.name || 'ไม่ระบุ')} เป็นข้อมูลหลังเรียน</p></section><section><h2>4. ผลการพัฒนา</h2><div class="dev-report-stat-grid"><div><b>${status.baseline ? `${status.baseline.percent.toFixed(1)}%` : '—'}</b><span>เฉลี่ยก่อนเรียน</span></div><div><b>${status.post ? `${status.post.percent.toFixed(1)}%` : '—'}</b><span>เฉลี่ยหลังเรียน</span></div><div><b>${completeRows.length ? `${improved}/${completeRows.length} คน` : '—'}</b><span>ข้อมูลครบและผลไม่ลดลง</span></div></div>${studentEvidenceTable(project, c)}</section><section><h2>5. ข้อจำกัดของข้อมูล</h2><p>${completeRows.length ? `มีข้อมูลก่อนและหลังเรียนครบ ${completeRows.length} จาก ${rows.length} คน ระบบคำนวณจากคะแนนที่บันทึกไว้เท่านั้น` : 'ข้อมูลก่อนเรียนและหลังเรียนยังไม่ครบ จึงยังไม่ควรสรุปผลการพัฒนาเป็นข้อยุติ'}</p></section><footer>เอกสารนี้เป็นร่างจากข้อมูลที่บันทึกใน ClassKru ครูควรตรวจสอบบริบท หลักฐาน และเกณฑ์ของหน่วยงานก่อนนำไปใช้งาน</footer></article></div>`;
  }

  function renderProjectList(projects) {
    if (!projects.length) return `<div class="dev-empty"><span class="dev-empty-icon"><i class="hgi-stroke hgi-chart-up-02"></i></span><strong>ยังไม่มีโครงการพัฒนาผู้เรียน</strong><p>เริ่มจากงานที่ครูทำอยู่แล้ว แล้วค่อยเลือกหลักฐานมาเชื่อมกับโครงการ</p><button class="btn btn-primary" type="button" onclick="openDevelopmentForm()"><i class="hgi-stroke hgi-add-01"></i> สร้างโครงการแรก</button></div>`;
    return `<div class="dev-project-grid">${projects.map(project => {
      const c = projectClass(project);
      const status = projectStatus(project, c);
      return `<button type="button" class="dev-project-card" onclick="openDevelopmentProject('${esc(project.id)}')">
        <div class="dev-project-card-top"><span class="dev-status ${status.tone}">${esc(status.label)}</span><i class="hgi-stroke hgi-arrow-right-01"></i></div>
        <strong>${esc(project.title || 'โครงการไม่มีชื่อ')}</strong>
        <span>${esc(classLabel(c))}</span>
        <small>${project.indicator ? esc(project.indicator.code) : 'ยังไม่ได้เลือกตัวชี้วัด'} · ${status.key === 'ready' ? `ผลต่าง ${esc(deltaLabel(status))}` : 'กำลังเตรียมหลักฐาน'}</small>
      </button>`;
    }).join('')}</div>`;
  }

  function classOptions(selected) {
    return (appState.classes || []).map(c => `<option value="${esc(c.id)}"${c.id === selected ? ' selected' : ''}>${esc(classLabel(c))}</option>`).join('');
  }

  function itemOptions(c, selected, emptyLabel) {
    return `<option value="">${emptyLabel}</option>` + scoreItems(c).map(item => `<option value="${esc(item.id)}"${item.id === selected ? ' selected' : ''}>${esc(item.name)} · ${esc(item.max)} คะแนน${item.date ? ` · ${esc(item.date)}` : ''}</option>`).join('');
  }

  function indicatorSelect(c, selected) {
    const options = indicatorOptions(c);
    if (!options.length) return `<div class="dev-inline-warning"><i class="hgi-stroke hgi-information-circle"></i><span>ยังไม่มีตัวชี้วัดที่เชื่อมกับห้องนี้ ไปที่หน้าคะแนน → ตัวชี้วัดรายวิชา เพื่อเพิ่มก่อน</span></div>`;
    return `<select id="dev-form-indicator" class="form-control"><option value="">เลือกตัวชี้วัด</option>${options.map(item => `<option value="${esc(item.id)}"${item.id === selected ? ' selected' : ''}>${esc(item.code)} · ${esc(item.text)}</option>`).join('')}</select>`;
  }

  function formHtml(project) {
    const editing = !!project;
    const c = project ? projectClass(project) : (appState.classes || [])[0];
    const indicator = selectedIndicator(project, c);
    return `<section class="dev-form card">
      <div class="dev-form-head"><div><span class="dev-eyebrow">${editing ? 'แก้ไขโครงการ' : 'เริ่มจากข้อมูลจริง'}</span><h2>${editing ? 'แก้ไขโครงการพัฒนาผู้เรียน' : 'สร้างโครงการพัฒนาผู้เรียน'}</h2><p>กรอกเฉพาะบริบทที่งานคะแนนปกติไม่มี ส่วนข้อมูลนักเรียนและคะแนนจะดึงจากห้องเรียนเดิม</p></div><button class="btn" type="button" onclick="closeDevelopmentForm()">ยกเลิก</button></div>
      <div class="dev-form-grid">
        <label><span>ชื่อโครงการ <b>*</b></span><input id="dev-form-title" class="form-control" value="${esc(project?.title)}" placeholder="เช่น พัฒนาทักษะการอ่านโจทย์ปัญหา"></label>
        <label><span>ห้องเรียน <b>*</b></span><select id="dev-form-class" class="form-control" onchange="refreshDevelopmentForm()">${classOptions(project?.classId)}</select></label>
        <label class="dev-form-wide"><span>ตัวชี้วัด <b>*</b></span><div id="dev-form-indicator-wrap">${indicatorSelect(c, indicator?.id)}</div></label>
        <label class="dev-form-wide"><span>ปัญหาหรือประเด็นที่ต้องการพัฒนา <b>*</b></span><textarea id="dev-form-problem" class="form-control" rows="3" placeholder="อธิบายจากสิ่งที่พบจริงในห้องเรียน">${esc(project?.problem)}</textarea></label>
        <label class="dev-form-wide"><span>เป้าหมายการพัฒนา <b>*</b></span><textarea id="dev-form-objective" class="form-control" rows="3" placeholder="ต้องการให้ผู้เรียนพัฒนาอะไร และเห็นจากหลักฐานใด">${esc(project?.objective)}</textarea></label>
        <label class="dev-form-wide"><span>วิธีการสอนหรือกิจกรรมที่ใช้</span><textarea id="dev-form-intervention" class="form-control" rows="3" placeholder="บันทึกวิธีที่ครูทำจริง ไม่ต้องเขียนเป็นภาษาวิจัย">${esc(project?.intervention)}</textarea></label>
        <label><span>ข้อมูลก่อนเรียน</span><select id="dev-form-baseline" class="form-control">${itemOptions(c, project?.baselineItemId, 'เลือกงาน/คะแนนก่อนเรียน')}</select></label>
        <label><span>ข้อมูลหลังเรียน</span><select id="dev-form-post" class="form-control">${itemOptions(c, project?.postItemId, 'เลือกงาน/คะแนนหลังเรียน')}</select></label>
      </div>
      <div class="dev-form-note"><i class="hgi-stroke hgi-shield-01"></i><span>ตัวเลขจะคำนวณจากคะแนนที่บันทึกจริง ระบบจะไม่สร้างข้อมูลแทน และครูตรวจสอบได้ทุกครั้ง</span></div>
      <div class="dev-form-actions"><button class="btn btn-primary" type="button" onclick="saveDevelopmentProject('${esc(project?.id || '')}')"><i class="hgi-stroke hgi-floppy-disk"></i> ${editing ? 'บันทึกการแก้ไข' : 'สร้างโครงการ'}</button></div>
    </section>`;
  }

  function detailHtml(project) {
    const c = projectClass(project);
    const status = projectStatus(project, c);
    const indicator = selectedIndicator(project, c);
    const base = status.baseline;
    const post = status.post;
    return `<section class="dev-detail-head card"><div><button class="btn-back" type="button" onclick="renderDevelopmentPage()"><i class="hgi-stroke hgi-arrow-left-01"></i> กลับโครงการ</button><span class="dev-eyebrow">โครงการพัฒนาผู้เรียน</span><h2>${esc(project.title)}</h2><p>${esc(classLabel(c))} · ${esc(indicator?.code || 'ยังไม่มีตัวชี้วัด')}</p></div><div class="dev-detail-actions"><button class="btn btn-primary" type="button" onclick="openDevelopmentReport()"><i class="hgi-stroke hgi-file-02"></i> สร้างร่างรายงาน</button><button class="btn" type="button" onclick="openDevelopmentForm('${esc(project.id)}')"><i class="hgi-stroke hgi-edit-02"></i> แก้ไข</button><button class="btn" type="button" onclick="deleteDevelopmentProject('${esc(project.id)}')"><i class="hgi-stroke hgi-delete-02"></i> ลบ</button></div></section>
      <section class="dev-kpi-grid"><article class="card dev-kpi"><span>ก่อนเรียน</span><strong>${base ? `${base.percent.toFixed(1)}%` : '—'}</strong><small>${base ? `${base.count}/${base.total} คนมีข้อมูล` : 'เลือกงานหรือบันทึกคะแนนก่อน'}</small></article><article class="card dev-kpi"><span>หลังเรียน</span><strong>${post ? `${post.percent.toFixed(1)}%` : '—'}</strong><small>${post ? `${post.count}/${post.total} คนมีข้อมูล` : 'เลือกงานหรือบันทึกคะแนนหลัง'}</small></article><article class="card dev-kpi dev-kpi-accent"><span>ความก้าวหน้า</span><strong>${esc(deltaLabel(status))}</strong><small>${status.key === 'ready' ? 'คำนวณจากข้อมูลคะแนนจริง' : 'ยังสรุปผลไม่ได้'}</small></article></section>
      <section class="dev-detail-grid"><article class="card dev-detail-card"><span class="dev-section-label">บริบทโครงการ</span><h3>ปัญหาที่พบ</h3><p>${esc(project.problem || 'ยังไม่ได้ระบุ')}</p><h3>เป้าหมายการพัฒนา</h3><p>${esc(project.objective || 'ยังไม่ได้ระบุ')}</p><h3>วิธีการที่ใช้</h3><p>${esc(project.intervention || 'ยังไม่ได้ระบุ')}</p></article><article class="card dev-detail-card"><span class="dev-section-label">หลักฐานที่เชื่อมไว้</span><div class="dev-evidence-row"><i class="hgi-stroke hgi-book-open-01"></i><span><b>ตัวชี้วัด</b><small>${esc(indicator ? `${indicator.code} · ${indicator.text}` : 'ยังไม่ได้เลือก')}</small></span></div><div class="dev-evidence-row"><i class="hgi-stroke hgi-chart-bar-line"></i><span><b>ก่อนเรียน</b><small>${esc(itemById(c, project.baselineItemId)?.name || 'ยังไม่ได้เชื่อม')}</small></span></div><div class="dev-evidence-row"><i class="hgi-stroke hgi-chart-bar-line"></i><span><b>หลังเรียน</b><small>${esc(itemById(c, project.postItemId)?.name || 'ยังไม่ได้เชื่อม')}</small></span></div><div class="dev-next-step ${status.tone}"><i class="hgi-stroke hgi-information-circle"></i><span>${status.key === 'ready' ? 'ข้อมูลพื้นฐานพร้อมสำหรับขั้นวิเคราะห์และจัดทำร่างรายงาน' : 'เพิ่มข้อมูลหรือเชื่อมงานก่อนเรียน/หลังเรียน เพื่อให้ระบบคำนวณผลได้'}</span></div></article></section><section class="card dev-student-section"><div class="dev-section-heading"><div><h2>ผลการเรียนรู้รายคน</h2><p>ตัวเลขมาจากคะแนนที่บันทึกจริง ไม่เติมข้อมูลที่หายไป</p></div><span class="dev-source-badge"><i class="hgi-stroke hgi-database-02"></i> ข้อมูลจากห้องเรียน</span></div>${studentEvidenceTable(project, c)}</section>`;
  }

  window.renderDevelopmentPage = function () {
    const root = document.getElementById('development-root');
    if (!root) return;
    const projects = ensureProjects();
    const selected = selectedProjectId ? projects.find(item => item.id === selectedProjectId) : null;
    if (selected && developmentView === 'report') { root.innerHTML = reportHtml(selected); return; }
    if (selected) { root.innerHTML = detailHtml(selected); return; }
    root.innerHTML = `<section class="dev-hero"><div><span class="dev-eyebrow"><i class="hgi-stroke hgi-chart-up-02"></i> หลักฐานจากงานสอนจริง</span><h1>พัฒนาผู้เรียน</h1><p>เก็บบริบทและเชื่อมข้อมูลจากงานเดิม เพื่อดูพัฒนาการของผู้เรียนอย่างเป็นระบบ</p></div><button class="btn btn-primary" type="button" onclick="openDevelopmentForm()"><i class="hgi-stroke hgi-add-01"></i> สร้างโครงการ</button></section><section class="dev-how card"><div><b>ทำงานตามปกติ</b><span>สร้างงานและกรอกคะแนนจากหน้าคะแนนเดิม</span></div><i class="hgi-stroke hgi-arrow-right-01"></i><div><b>เชื่อมหลักฐาน</b><span>เลือกงานก่อนเรียนและหลังเรียนมาไว้ในโครงการ</span></div><i class="hgi-stroke hgi-arrow-right-01"></i><div><b>พร้อมต่อยอด</b><span>ดูผลต่างและจัดทำรายงานในขั้นถัดไป</span></div></section><div id="development-form-slot"></div><section class="dev-list-section"><div class="dev-section-heading"><div><h2>โครงการของฉัน</h2><p>ครูที่ใช้แค่คะแนนไม่ต้องสร้างโครงการ ระบบเดิมยังทำงานเหมือนเดิม</p></div></div>${renderProjectList(projects)}</section>`;
    if (window.__developmentFormOpen) openDevelopmentForm(window.__developmentFormProjectId || '');
  };

  window.renderDevelopmentDashboardCard = function () {
    const card = document.getElementById('home-development-card');
    if (!card) return;
    const projects = ensureProjects();
    const ready = projects.filter(project => {
      const c = projectClass(project);
      return projectStatus(project, c).key === 'ready';
    }).length;
    card.style.display = 'flex';
    card.innerHTML = `<div><span class="dev-dashboard-kicker"><i class="hgi-stroke hgi-chart-up-02"></i> พัฒนาผู้เรียน</span><strong>${projects.length ? `มี ${projects.length} โครงการ${ready ? ` · ${ready} โครงการมีข้อมูลพร้อมวิเคราะห์` : ''}` : 'เปลี่ยนงานสอนให้เป็นหลักฐานได้'}</strong><small>${projects.length ? 'ต่อจากข้อมูลห้องเรียนและคะแนนเดิม' : 'เริ่มจากปัญหาจริงในห้องเรียน ไม่ต้องกรอกคะแนนซ้ำ'}</small></div><button class="btn" type="button" onclick="navigateToWebScreen('development')">${projects.length ? 'ดูโครงการ' : 'เริ่มต้น'} <i class="hgi-stroke hgi-arrow-right-01"></i></button>`;
  };

  window.openDevelopmentForm = function (projectId = '') {
    window.__developmentFormOpen = true;
    window.__developmentFormProjectId = projectId;
    // The form is a list view state; clear detail selection while editing.
    selectedProjectId = null;
    const root = document.getElementById('development-root');
    if (!root) return;
    const project = ensureProjects().find(item => item.id === projectId) || null;
    let slot = document.getElementById('development-form-slot');
    if (!slot) { renderDevelopmentPage(); slot = document.getElementById('development-form-slot'); }
    if (slot) { slot.innerHTML = formHtml(project); slot.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };

  window.closeDevelopmentForm = function () { window.__developmentFormOpen = false; window.__developmentFormProjectId = ''; renderDevelopmentPage(); };

  window.refreshDevelopmentForm = function () {
    const classId = document.getElementById('dev-form-class')?.value;
    const c = (appState.classes || []).find(item => item.id === classId);
    const wrap = document.getElementById('dev-form-indicator-wrap');
    const baseline = document.getElementById('dev-form-baseline');
    const post = document.getElementById('dev-form-post');
    if (wrap) wrap.innerHTML = indicatorSelect(c, '');
    if (baseline) baseline.innerHTML = itemOptions(c, '', 'เลือกงาน/คะแนนก่อนเรียน');
    if (post) post.innerHTML = itemOptions(c, '', 'เลือกงาน/คะแนนหลังเรียน');
  };

  window.saveDevelopmentProject = function (projectId = '') {
    const classId = document.getElementById('dev-form-class')?.value || '';
    const c = (appState.classes || []).find(item => item.id === classId);
    const indicatorId = document.getElementById('dev-form-indicator')?.value || '';
    const indicator = indicatorOptions(c).find(item => item.id === indicatorId);
    const title = document.getElementById('dev-form-title')?.value.trim() || '';
    const problem = document.getElementById('dev-form-problem')?.value.trim() || '';
    const objective = document.getElementById('dev-form-objective')?.value.trim() || '';
    if (!title || !classId || !indicator || !problem || !objective) { showToast('กรุณากรอกชื่อ ห้องเรียน ตัวชี้วัด ปัญหา และเป้าหมายให้ครบ', 'warning'); return; }
    const projects = ensureProjects();
    const existing = projects.find(item => item.id === projectId);
    const next = existing || { id: `dev_${Date.now()}`, createdAt: new Date().toISOString() };
    Object.assign(next, { title, classId, indicator: { id: indicator.id, code: indicator.code, text: indicator.text, subjectId: indicator.subjectId }, problem, objective, intervention: document.getElementById('dev-form-intervention')?.value.trim() || '', baselineItemId: document.getElementById('dev-form-baseline')?.value || '', postItemId: document.getElementById('dev-form-post')?.value || '', updatedAt: new Date().toISOString() });
    if (!existing) projects.unshift(next);
    selectedProjectId = next.id;
    window.__developmentFormOpen = false;
    saveState();
    renderDevelopmentPage();
    showToast('บันทึกโครงการแล้ว', 'success');
  };

  window.openDevelopmentProject = function (id) { selectedProjectId = id; developmentView = 'detail'; window.__developmentFormOpen = false; renderDevelopmentPage(); };
  window.openDevelopmentReport = function () { if (!selectedProjectId) return; developmentView = 'report'; renderDevelopmentPage(); };
  window.backToDevelopmentDetail = function () { developmentView = 'detail'; renderDevelopmentPage(); };
  window.deleteDevelopmentProject = function (id) {
    const project = ensureProjects().find(item => item.id === id);
    if (!project) return;
    showConfirm(`ลบโครงการ “${project.title}” หรือไม่?`, () => { appState.developmentProjects = ensureProjects().filter(item => item.id !== id); selectedProjectId = null; saveState(); renderDevelopmentPage(); showToast('ลบโครงการแล้ว', 'success'); }, { title: 'ลบโครงการ', icon: '🗑️', okText: 'ลบ' });
  };

  window.addEventListener('classkru:state-ready', () => { if (appState.activeWebScreen === 'development') renderDevelopmentPage(); });
})();
