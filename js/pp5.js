/* ClassKru ปพ.5: derived scores + teacher-entered metadata/assessments.
 * Config is stored in scores.config so existing local/cloud round trips preserve it.
 */
const PP5_TRAITS = ['รักชาติ ศาสน์ กษัตริย์', 'ซื่อสัตย์สุจริต', 'มีวินัย', 'ใฝ่เรียนรู้', 'อยู่อย่างพอเพียง', 'มุ่งมั่นในการทำงาน', 'รักความเป็นไทย', 'มีจิตสาธารณะ'];
const PP5_LEVELS = ['ไม่ผ่าน', 'ผ่าน', 'ดี', 'ดีเยี่ยม'];
const PP5_SECTIONS = { cover: 'ปกและข้อมูลรายวิชา', indicators: 'ตัวชี้วัดและโครงสร้างคะแนน', attendance: 'บันทึกเวลาเรียน', scores: 'บันทึกคะแนน', assessment: 'ผลประเมินเพิ่มเติม', summary: 'สรุปผลและลงนาม' };
let pp5Section = 'cover';
let pp5AssessmentSaveTimer = null;
const pp5Esc = value => escapeScoreAttr(String(value ?? ''));
const pp5Num = value => Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const pp5AssessmentValue = value => ['0','1','2','3'].includes(String(value ?? ''));
function pp5TraitSummary(assessment = {}) {
  const values = PP5_TRAITS.map((_, n) => String(assessment[`trait${n}`] ?? ''));
  if (!values.every(pp5AssessmentValue)) return '';
  if (values.includes('0')) return '0';
  const excellent = values.filter(value => value === '3').length;
  const goodOrBetter = values.filter(value => value === '2' || value === '3').length;
  const hasPass = values.includes('1');
  if (excellent >= 5 && !hasPass) return '3';
  if (!hasPass || goodOrBetter >= 5) return '2';
  return '1';
}
const pp5AssessmentLabel = value => PP5_LEVELS[String(value ?? '')] || '—';
function pp5ReadAssessmentForm(form) {
  const students = new Map();
  form.querySelectorAll('[data-student]').forEach(input => {
    const fields = students.get(input.dataset.student) || {};
    fields[input.dataset.field] = input.value;
    students.set(input.dataset.student, fields);
  });
  return students;
}
function pp5UpdateTraitOutputs(form, students = pp5ReadAssessmentForm(form)) {
  form.querySelectorAll('[data-summary-student]').forEach(output => {
    output.textContent = pp5AssessmentLabel(pp5TraitSummary(students.get(output.dataset.summaryStudent) || {}));
  });
}
function pp5Config(c) {
  const cfg = ensureScores(c).config;
  if (!cfg.pp5) cfg.pp5 = { school: '', teacher: appState.teacherName || '', term: '', code: '', strand: '', hours: '', credits: '', start: '', end: '', description: '', reviewer: '', approver: '', approverTitle: 'ผู้อำนวยการสถานศึกษา', assessments: {} };
  if (!cfg.pp5.assessments) cfg.pp5.assessments = {};
  return cfg.pp5;
}
function pp5Current() { return appState.classes.find(c => c.id === scoreCurrentClassId); }
function pp5FlushAssessmentForm() {
  if (typeof document === 'undefined') return false;
  const form = document.querySelector?.('.pp5-assessment-editor');
  return form ? pp5WriteAssessmentForm(form) : false;
}
function pp5Select(value) {
  if (!PP5_SECTIONS[value]) return;
  if (pp5Section === 'assessment') pp5FlushAssessmentForm();
  pp5Section = value;
  const c = pp5Current(); if (c) renderPp5(c);
}
function pp5SaveMeta(form) {
  const c = pp5Current(); if (!c || !form.reportValidity()) return false;
  const data = new FormData(form);
  if (data.get('start') && data.get('end') && data.get('start') > data.get('end')) { showToast('วันเริ่มต้องไม่อยู่หลังวันสิ้นสุด', 'warning'); return false; }
  const cfg = pp5Config(c);
  ['school','district','province','advisor','weeklyHours','teacher','term','code','strand','hours','credits','start','end','description','reviewer','approver','approverTitle'].forEach(key => { cfg[key] = String(data.get(key) || '').trim(); });
  saveState(); renderPp5(c); showToast('บันทึกข้อมูล ปพ.5 แล้ว', 'success'); return false;
}
function pp5WriteAssessmentForm(form) {
  const c = pp5Current(); if (!c) return false;
  const cfg = pp5Config(c);
  const validStudents = new Set(c.students.map(s => s.id));
  const touched = new Set();
  let changed = false;
  form.querySelectorAll('[data-student]').forEach(el => {
    const sid = el.dataset.student, field = el.dataset.field;
    if (!validStudents.has(sid) || !/^(trait[0-7]|traits|reading|remark)$/.test(field)) return;
    if (field !== 'remark' && !['', '0','1','2','3'].includes(el.value)) return;
    if (!cfg.assessments[sid]) cfg.assessments[sid] = {};
    touched.add(sid);
    if (cfg.assessments[sid][field] !== el.value) {
      cfg.assessments[sid][field] = el.value;
      changed = true;
    }
  });
  touched.forEach(sid => {
    const derived = pp5TraitSummary(cfg.assessments[sid]);
    if (cfg.assessments[sid].traits !== derived) {
      cfg.assessments[sid].traits = derived;
      changed = true;
    }
  });
  if (changed) saveState();
  return changed;
}
function pp5ScheduleAssessmentAutosave(form, delay = 300) {
  if (!form) return;
  if (pp5AssessmentSaveTimer) clearTimeout(pp5AssessmentSaveTimer);
  pp5AssessmentSaveTimer = setTimeout(() => {
    pp5AssessmentSaveTimer = null;
    pp5WriteAssessmentForm(form);
  }, delay);
}
function pp5SaveAssessment(form) {
  const c = pp5Current(); if (!c) return false;
  if (pp5AssessmentSaveTimer) { clearTimeout(pp5AssessmentSaveTimer); pp5AssessmentSaveTimer = null; }
  pp5WriteAssessmentForm(form);
  renderPp5(c); showToast('บันทึกผลประเมินแล้ว', 'success'); return false;
}
function pp5AssessmentSelectChanged(select) {
  select.dataset.level = select.value;
  select.classList.remove('is-level-unset', 'is-level-0', 'is-level-1', 'is-level-2', 'is-level-3');
  select.classList.add(select.value === '' ? 'is-level-unset' : `is-level-${select.value}`);
  const form = select.form;
  if (!form) return;
  const students = pp5ReadAssessmentForm(form);
  pp5UpdateTraitOutputs(form, students);
  const completed = [...students.values()].filter(fields =>
    pp5AssessmentValue(pp5TraitSummary(fields)) && pp5AssessmentValue(fields.reading)
  ).length;
  const status = form.querySelector('.pp5-assessment-status span');
  if (status) status.textContent = `${completed}/${students.size}`;
  pp5ScheduleAssessmentAutosave(form);
}
function pp5AssessmentRemarkChanged(input) { pp5ScheduleAssessmentAutosave(input.form, 500); }
function pp5BulkMode(form) { return form?.elements?.pp5BulkMode?.value === 'blank' ? 'blank' : 'all'; }
function pp5ApplyAssessmentBulk(form, field, value, mode = pp5BulkMode(form)) {
  if (!field || !['0', '1', '2', '3'].includes(String(value))) return;
  const c = pp5Current(); if (!c) return;
  const cfg = pp5Config(c);
  let changed = false;
  c.students.forEach(student => {
    const assessment = cfg.assessments[student.id] || (cfg.assessments[student.id] = {});
    if (mode === 'blank' && pp5AssessmentValue(assessment[field])) return;
    if (assessment[field] !== String(value)) {
      assessment[field] = String(value);
      changed = true;
    }
    if (/^trait[0-7]$/.test(field)) {
      const derived = pp5TraitSummary(assessment);
      if (assessment.traits !== derived) {
        assessment.traits = derived;
        changed = true;
      }
    }
  });
  if (changed) saveState();
  renderPp5(c);
  showToast(`ตั้งค่า${field === 'reading' ? 'อ่าน คิดวิเคราะห์ และเขียน' : 'รายการประเมิน'}${mode === 'blank' ? 'เฉพาะช่องว่าง' : 'ทั้งห้อง'}แล้ว`, 'success', 1500);
}
function pp5HasMark(value) { return value != null && String(value).trim() !== '' && Number.isFinite(Number(value)); }
function pp5StudentResult(c, s) {
  const sc = ensureScores(c), calc = computeStudentScore(c, s.id);
  const complete = sc.items.length > 0 && sc.items.every(i => Number.isFinite(Number(i.max)) && Number(i.max) > 0 && pp5HasMark((sc.marks[i.id] || {})[s.id]));
  const bucketsReady = SCORE_WK.every(b => !sc.config.ratio[b.key] || sc.items.some(i => i.bucket === b.key));
  const ratioReady = SCORE_WK.reduce((sum, b) => sum + Number(sc.config.ratio[b.key] || 0), 0) === 100;
  const special=sc.gradeOverride[s.id];
  return { ...calc, complete: complete && bucketsReady && ratioReady, grade: ['ร','มส','มผ','ผ'].includes(special) ? special : complete && bucketsReady && ratioReady ? effectiveGrade(c, s.id) : 'ยังไม่ครบ' };
}
function pp5Dates(c) {
  const cfg = pp5Config(c), today = getTodayString();
  return Object.keys(c.attendance || {}).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today && (!cfg.start || d >= cfg.start) && (!cfg.end || d <= cfg.end)).sort();
}
function pp5Attendance(c, sid, dates) {
  const result = { present: 0, late: 0, absent: 0, leave: 0, missing: 0 };
  dates.forEach(d => { const status = c.attendance[d]?.[sid]; if (['present','late','absent','leave'].includes(status)) result[status]++; else result.missing++; });
  result.checked = dates.length - result.missing;
  return result;
}
function pp5Warnings(c) {
  const cfg = pp5Config(c), sc = ensureScores(c), warnings = [];
  if (!cfg.school || !cfg.teacher || !cfg.code || !cfg.term || !c.academicYear) warnings.push('ข้อมูลหัวเอกสารยังไม่ครบ (โรงเรียน ครู รหัสวิชา ภาคเรียน หรือปีการศึกษา)');
  if (!c.students.length) warnings.push('ยังไม่มีนักเรียน');
  if (!sc.items.length) warnings.push('ยังไม่มีรายการคะแนน');
  const incomplete = c.students.filter(s => !pp5StudentResult(c, s).complete).length;
  if (incomplete) warnings.push(`คะแนนยังไม่พร้อมสรุป ${incomplete} คน — ตรวจช่องว่าง คะแนนเต็ม และสัดส่วนคะแนน`);
  if (!cfg.start || !cfg.end) warnings.push('ยังไม่ได้กำหนดช่วงวันที่ภาคเรียน — เวลาเรียนจะแสดงทุกวันที่บันทึกถึงวันนี้');
  const missing = c.students.filter(s => !pp5AssessmentValue(pp5TraitSummary(cfg.assessments[s.id])) || !pp5AssessmentValue(cfg.assessments[s.id]?.reading)).length;
  if (missing) warnings.push(`ยังไม่สรุปผลประเมินเพิ่มเติม ${missing} คน`);
  return warnings;
}
function pp5Summary(c) {
  const cfg=pp5Config(c), total=c.students.length;
  const grades=[...SCORE_GRADES,'ร','มส','มผ','ผ','อื่น ๆ','ยังไม่ครบ'];
  const students=c.students.map((student,index)=>{
    const result=pp5StudentResult(c,student), assessment=cfg.assessments[student.id] || {};
    const traitSummary=pp5TraitSummary(assessment);
    const grade=result.grade;
    const missing=[];
    if(!result.complete)missing.push('คะแนนยังไม่ครบหรือโครงสร้างคะแนนไม่พร้อม');
    if(!pp5AssessmentValue(traitSummary))missing.push('คุณลักษณะฯ รายข้อ 8 ข้อ');
    if(!['0','1','2','3'].includes(String(assessment.reading ?? '')))missing.push('อ่าน คิดวิเคราะห์ และเขียน');
    return {student,index,grade:grades.includes(String(grade))?String(grade):'อื่น ๆ',assessment:{...assessment,traits:traitSummary},missing};
  });
  const distribution=(title,labels,count)=>({section:'summary',title,headers:['รายการ',...labels],rows:[['จำนวน (คน)',...labels.map(count)],['ร้อยละ',...labels.map(label=>total?Number((count(label)*100/total).toFixed(2)):'—')]]});
  const sheets=[distribution('สรุปผลการเรียน',grades,grade=>students.filter(s=>s.grade===grade).length)];
  for(const [field,title] of [['traits','คุณลักษณะอันพึงประสงค์'],['reading','อ่าน คิดวิเคราะห์ และเขียน']]){
    const labels=['ดีเยี่ยม','ดี','ผ่าน','ไม่ผ่าน','ยังไม่ประเมิน'];
    sheets.push(distribution(title,labels,label=>students.filter(s=>(PP5_LEVELS[s.assessment[field]] || 'ยังไม่ประเมิน')===label).length));
  }
  const pending=students.filter(s=>s.missing.length);
  return {total,completed:total-pending.length,pending,sheets};
}
function pp5SummaryDocument(c) {
  const cfg=pp5Config(c), summary=pp5Summary(c);
  const fields=[['โรงเรียน',cfg.school],['อำเภอ / เขต',cfg.district],['จังหวัด',cfg.province],['ชั้น / ห้อง',c.className],['รายวิชา',c.subject],['รหัสวิชา',cfg.code],['ภาคเรียน',cfg.term],['ปีการศึกษา',c.academicYear],['หน่วยกิต',cfg.credits],['เวลาเรียนตามหลักสูตร (ชั่วโมง)',cfg.hours],['ชั่วโมง / สัปดาห์',cfg.weeklyHours],['ครูผู้สอน',cfg.teacher],['ครูที่ปรึกษา',cfg.advisor]];
  return `<article class="pp5-page pp5-summary-page"><header class="pp5-doc-head"><h2>แบบบันทึกผลการเรียนประจำรายวิชา</h2></header><dl class="pp5-summary-meta">${fields.map(([label,value])=>`<div><dt>${label}</dt><dd>${pp5Esc(value || '—')}</dd></div>`).join('')}</dl><p>นักเรียนทั้งหมด ${summary.total} คน · ผลครบ ${summary.completed} คน · ยังไม่ครบ ${summary.pending.length} คน</p><p>ร้อยละคิดจากนักเรียนทั้งหมด ${summary.total} คน · ผลที่ยังไม่ครบไม่ถือเป็น 0 หรือไม่ผ่าน</p>${summary.sheets.map(sheet=>`<section class="pp5-summary-section"><h3>${sheet.title}</h3>${pp5Table(sheet.headers,sheet.rows)}</section>`).join('')}${pp5Signatures(c)}<footer class="pp5-doc-foot">ClassKru · ตรวจสอบข้อมูลและลงนามก่อนรับรองผล</footer></article>`;
}
function pp5Table(headers, rows) {
  return `<table class="pp5-table"><thead><tr>${headers.map(h => `<th>${pp5Esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(v => `<td>${pp5Esc(v)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">ยังไม่มีข้อมูล</td></tr>`}</tbody></table>`;
}
function pp5Header(c, title) {
  const cfg = pp5Config(c);
  return `<header class="pp5-doc-head"><h2>${pp5Esc(title)}</h2><p>${pp5Esc(cfg.school || 'โรงเรียน ................................')}</p><p>รายวิชา ${pp5Esc(c.subject)} · รหัส ${pp5Esc(cfg.code || '—')} · ชั้น ${pp5Esc(c.className)}</p><p>ภาคเรียน ${pp5Esc(cfg.term || '—')} · ปีการศึกษา ${pp5Esc(c.academicYear || '—')} · ครูผู้สอน ${pp5Esc(cfg.teacher || '—')}</p></header>`;
}
function pp5Signatures(c) {
  const cfg = pp5Config(c);
  return `<div class="pp5-signatures">${[[cfg.teacher,'ครูผู้สอน'],[cfg.reviewer,'ผู้ตรวจ'],[cfg.approver,cfg.approverTitle || 'ผู้อนุมัติ']].map(([name, role]) => `<div>ลงชื่อ ................................<br>(${pp5Esc(name || '................................')})<br>${pp5Esc(role)}<br>วันที่ ....... / ....... / .......</div>`).join('')}</div>`;
}
function pp5DataSheets(c) {
  const cfg = pp5Config(c), sc = ensureScores(c), dates = pp5Dates(c);
  const identity = (s,i) => [s.no || i+1, s.studentCode || '', s.name];
  const base = ['เลขที่','เลขประจำตัว','ชื่อ–สกุล'];
  const assessment = (s,k) => PP5_LEVELS[k === 'traits' ? pp5TraitSummary(cfg.assessments[s.id]) : cfg.assessments[s.id]?.[k]] || '—';
  const sheets = [];
  const warnings = pp5Warnings(c);
  sheets.push({section:'summary', title:'ตรวจสอบก่อนรับรองผล', headers:['รายการ'], rows:(warnings.length ? warnings : ['ตรวจสอบความถูกต้องและลงนามก่อนรับรองผล']).map(w=>[w])});
  sheets.push({ section:'cover', title:'ข้อมูลรายวิชา', headers:['รายการ','ข้อมูล'], rows:[['โรงเรียน',cfg.school],['รายวิชา',c.subject],['รหัสวิชา',cfg.code],['กลุ่มสาระ',cfg.strand],['ชั้น',c.className],['ภาคเรียน',cfg.term],['ปีการศึกษา',c.academicYear],['ครูผู้สอน',cfg.teacher],['เวลาเรียนตามหลักสูตร (ชั่วโมง)',cfg.hours],['หน่วยกิต',cfg.credits],['เริ่มวันที่',cfg.start],['สิ้นสุดวันที่',cfg.end],['คำอธิบายรายวิชา',cfg.description]] });
  const board = getScoreIndicatorBoard(c);
  sheets.push({ section:'indicators', title:'ตัวชี้วัด / ผลการเรียนรู้', headers:['รหัส','รายละเอียด','งานที่เชื่อมโยง','คะแนนเต็มตัวชี้วัด'], rows:board.map(b => {
    const indicator = window.CKCurriculumCatalog?.getSubject(b.subjectId)?.dataset?.indicators.find(i => i.id === b.indicatorId);
    return [indicator?.code || b.indicatorId, indicator?.text || 'ไม่พบรายละเอียดในคลังตัวชี้วัด', indicatorLinkedItems(c,b).map(i => i.name).join(', ') || 'ยังไม่เชื่อมงาน',indicatorConfiguredMax(b)];
  }) });
  sheets.push({section:'indicators',title:'โครงสร้างคะแนน',headers:['หมวด','สัดส่วน (%)','งาน','คะแนนเต็มดิบ'], rows:SCORE_WK.flatMap(b => { const items = sc.items.filter(i => i.bucket === b.key); return items.length ? items.map(i => [b.label,sc.config.ratio[b.key],i.name,i.max]) : [[b.label,sc.config.ratio[b.key],'ยังไม่มีงาน','—']]; })});
  sheets.push({section:'attendance',title:'สรุปการเช็กชื่อ (วัน)',headers:[...base,'มา','สาย','ขาด','ลา','ยังไม่เช็ก','รวมวันที่มีบันทึก'], rows:c.students.map((s,i) => { const a = pp5Attendance(c,s.id,dates); return [...identity(s,i),a.present,a.late,a.absent,a.leave,a.missing,dates.length]; })});
  for(let offset=0;offset<dates.length;offset+=12) {
    const part=dates.slice(offset,offset+12);
    sheets.push({section:'attendance',title:`บันทึกการเช็กชื่อ ${part[0]} ถึง ${part[part.length-1]}`,headers:[...base,...part],rows:c.students.map((s,i) => [...identity(s,i),...part.map(d => ({present:'มา',late:'สาย',absent:'ขาด',leave:'ลา'}[c.attendance[d]?.[s.id]] || '—'))])});
  }
  sheets.push({section:'scores',title:'สรุปคะแนนรายวิชา (ถ่วงน้ำหนัก)',headers:[...base,...SCORE_WK.map(b=>`${b.label} / ${sc.config.ratio[b.key]}`),'รวม / 100','ระดับผลการเรียน','สถานะข้อมูล'],rows:c.students.map((s,i)=>{ const r=pp5StudentResult(c,s); return [...identity(s,i),...SCORE_WK.map(b=>pp5Num(r.cats[b.key].scaled)),pp5Num(r.total),r.grade,r.complete?'คะแนนครบ':'ผลชั่วคราว']; })});
  for(let offset=0;offset<sc.items.length;offset+=8) {
    const items=sc.items.slice(offset,offset+8);
    sheets.push({section:'scores',title:`คะแนนรายชิ้นงาน ชุด ${offset/8+1}`,headers:[...base,...items.map(i=>`${i.name} / ${i.max}`)],rows:c.students.map((s,i)=>[...identity(s,i),...items.map(item=>{const value=(sc.marks[item.id]||{})[s.id];return pp5HasMark(value)?clampMark(value,item.max):'—';})])});
  }
  sheets.push({section:'assessment',title:'คุณลักษณะอันพึงประสงค์',headers:[...base,...PP5_TRAITS,'ผลสรุปโดยครู'],rows:c.students.map((s,i)=>[...identity(s,i),...PP5_TRAITS.map((_,n)=>assessment(s,`trait${n}`)),assessment(s,'traits')])});
  sheets.push({section:'assessment',title:'ผลประเมินเพิ่มเติม',headers:[...base,'คุณลักษณะอันพึงประสงค์','อ่าน คิดวิเคราะห์ และเขียน','หมายเหตุ'],rows:c.students.map((s,i)=>[...identity(s,i),assessment(s,'traits'),assessment(s,'reading'),cfg.assessments[s.id]?.remark||''])});
  const summary=pp5Summary(c);
  sheets.push({section:'summary',title:'ความครบถ้วนของผลทั้งห้อง',headers:['นักเรียนทั้งหมด','ผลครบ','ยังไม่ครบ','ฐานคำนวณร้อยละ'],rows:[[summary.total,summary.completed,summary.pending.length,'นักเรียนทั้งหมดในห้อง']]});
  sheets.push(...summary.sheets);
  if(summary.pending.length)sheets.push({section:'summary',title:'รายชื่อนักเรียนที่ข้อมูลยังไม่ครบ',headers:[...base,'ข้อมูลที่ขาด'],rows:summary.pending.map(({student,index,missing})=>[...identity(student,index),missing.join(' · ')])});
  sheets.find(sheet => sheet.section === 'cover').rows.push(['อำเภอ / เขต',cfg.district || ''],['จังหวัด',cfg.province || ''],['ครูที่ปรึกษา',cfg.advisor || ''],['ชั่วโมง / สัปดาห์',cfg.weeklyHours || '']);
  sheets.find(sheet => sheet.section === 'cover').rows.push(['ผู้ตรวจ',cfg.reviewer],['ผู้อนุมัติ',cfg.approver],['ตำแหน่งผู้อนุมัติ',cfg.approverTitle]);
  return sheets;
}
function pp5Document(c, section) {
  const cfg=pp5Config(c), warnings=pp5Warnings(c);
  const sections=section==='all'?Object.keys(PP5_SECTIONS):[section];
  const sheets=pp5DataSheets(c);
  const footer='<footer class="pp5-doc-foot">ClassKru · แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน · ตรวจสอบและลงนามก่อนรับรองผล</footer>';
  return sections.map(key=>{
    if(key==='summary'){
      const pending=sheets.find(sheet=>sheet.title==='รายชื่อนักเรียนที่ข้อมูลยังไม่ครบ');
      const details=[];
      if(pending)for(let offset=0;offset<pending.rows.length;offset+=18)details.push(`<article class="pp5-page">${pp5Header(c,pending.title)}${pp5Table(pending.headers,pending.rows.slice(offset,offset+18))}${footer}</article>`);
      return pp5SummaryDocument(c)+details.join('');
    }
    if(key==='cover')return `<article class="pp5-page pp5-cover">${pp5Header(c,'แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน (ปพ.5)')}<p>กลุ่มสาระการเรียนรู้ ${pp5Esc(cfg.strand||'—')}</p><p>เวลาเรียนตามหลักสูตร ${pp5Esc(cfg.hours||'—')} ชั่วโมง · หน่วยกิต ${pp5Esc(cfg.credits||'—')}</p><p>ช่วงวันที่เช็กชื่อ ${pp5Esc(cfg.start||'ไม่กำหนด')} ถึง ${pp5Esc(cfg.end||'ไม่กำหนด')}</p><h3>คำอธิบายรายวิชา</h3><div class="pp5-description">${pp5Esc(cfg.description||'ยังไม่ระบุ')}</div>${warnings.length?`<div class="pp5-doc-warning">ข้อมูลที่ต้องตรวจสอบ<ul>${warnings.map(w=>`<li>${pp5Esc(w)}</li>`).join('')}</ul></div>`:''}${pp5Signatures(c)}${footer}</article>`;
    return sheets.filter(s=>s.section===key).map(sheet=>{
      const chunks=[]; for(let i=0;i<Math.max(1,sheet.rows.length);i+=18)chunks.push(sheet.rows.slice(i,i+18));
      return chunks.map((rows,i)=>`<article class="pp5-page">${pp5Header(c,sheet.title)}${chunks.length>1?`<p>ส่วนที่ ${i+1} / ${chunks.length}</p>`:''}${key==='attendance'?'<p>หน่วยเป็นวันจากการเช็กชื่อ ไม่ใช่ชั่วโมงเรียน · ช่องว่างไม่ถือว่าขาด · ไม่มีการตัดสิน มส. อัตโนมัติ</p>':''}${key==='scores'?'<p>คะแนนรวมที่ข้อมูลไม่ครบเป็นผลชั่วคราว · คะแนน 0 เป็นคะแนนที่บันทึกแล้ว · “—” คือยังไม่มีคะแนน</p>':''}${key==='indicators'?'<p>คะแนนเต็มชิ้นงานเป็นคะแนนดิบ สัดส่วนหมวดคิดครั้งเดียวตามการตั้งค่า · งานที่เชื่อมหลายตัวชี้วัดไม่นับซ้ำในคะแนนรวม</p>':''}${pp5Table(sheet.headers,rows)}${key==='summary'&&i===chunks.length-1?pp5Signatures(c):''}${footer}</article>`).join('');
    }).join('');
  }).join('');
}
function pp5MetaForm(c) {
  const cfg=pp5Config(c);
  const fields=[['school','โรงเรียน','text'],['code','รหัสวิชา','text'],['teacher','ครูผู้สอน','text'],['strand','กลุ่มสาระการเรียนรู้','text'],['term','ภาคเรียน','text'],['hours','เวลาเรียนตามหลักสูตร (ชั่วโมง)','number'],['credits','หน่วยกิต','number'],['start','วันเริ่มภาคเรียน','date'],['end','วันสิ้นสุดภาคเรียน','date'],['reviewer','ชื่อผู้ตรวจ','text'],['approver','ชื่อผู้อนุมัติ','text'],['approverTitle','ตำแหน่งผู้อนุมัติ','text']];
  fields.push(['district','อำเภอ / เขต','text'],['province','จังหวัด','text'],['advisor','ครูที่ปรึกษา','text'],['weeklyHours','ชั่วโมง / สัปดาห์','number']);
  return `<form class="pp5-editor" onsubmit="return pp5SaveMeta(this)"><h3>ข้อมูลเอกสาร</h3><div class="pp5-fields">${fields.map(([key,label,type])=>`<label>${label}<input class="form-control" name="${key}" type="${type}" ${type==='number'?'min="0" step="0.5"':''} value="${pp5Esc(cfg[key])}" maxlength="200"></label>`).join('')}</div><label>คำอธิบายรายวิชา<textarea class="form-control" name="description" rows="4" maxlength="10000">${pp5Esc(cfg.description)}</textarea></label><p>รายวิชา ชั้น และปีการศึกษา ใช้ข้อมูลจากห้องเรียน · บันทึกข้อมูลก่อนเปลี่ยนส่วนหรือพิมพ์</p><button class="btn btn-primary" type="submit">บันทึกข้อมูลเอกสาร</button></form>`;
}
function pp5AssessmentForm(c) {
  const cfg=pp5Config(c);
  const students=c.students || [];
  const completed=students.filter(s => pp5AssessmentValue(pp5TraitSummary(cfg.assessments[s.id])) && pp5AssessmentValue(cfg.assessments[s.id]?.reading)).length;
  const bulkFields=[...PP5_TRAITS.map((t,n)=>[`trait${n}`,t]),['reading','อ่าน คิดวิเคราะห์ และเขียน']];
  const bulkOptions=bulkFields.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  const toolbarButtons=PP5_LEVELS.map((label,value)=>`<button type="button" class="pp5-level-action pp5-level-action-${value}" onclick="pp5ApplyAssessmentBulk(this.form,this.form.elements.pp5BulkField.value,'${value}')">${label}</button>`).join('');
  return `<form class="pp5-assessment-editor pp5-document-editor" onsubmit="return pp5SaveAssessment(this)"><div class="pp5-editor-head"><h3>ผลประเมินเพิ่มเติม</h3><div class="pp5-assessment-head-actions"><div class="pp5-assessment-status"><span>${completed}/${students.length}</span><small>สรุปครบ</small></div></div></div><div class="pp5-assessment-tools"><div><strong>กรอกเร็วหลายคน</strong></div><select class="pp5-bulk-field" name="pp5BulkField" aria-label="หัวข้อที่จะกรอกเร็ว">${bulkOptions}</select><div class="pp5-bulk-scope" role="radiogroup" aria-label="ขอบเขตการกรอกเร็ว"><label><input type="radio" name="pp5BulkMode" value="all" checked> ทั้งห้อง</label><label><input type="radio" name="pp5BulkMode" value="blank"> เฉพาะช่องว่าง</label></div><div class="pp5-level-actions">${toolbarButtons}</div></div><div class="pp5-preview" aria-label="รายงานผลประเมินเพิ่มเติม">${pp5Document(c,'assessment')}</div></form>`;
}
function renderPp5(c) {
  const wrap=document.getElementById('web-scores-matrix-wrap'); if(!wrap)return;
  const warnings=pp5Warnings(c);
  const content=pp5Section==='assessment'?pp5AssessmentForm(c):`${pp5Section==='cover'?pp5MetaForm(c):''}<div class="pp5-preview" aria-label="ตัวอย่างเอกสาร">${pp5Document(c,pp5Section)}</div>${pp5Section==='summary'?'<div class="pp5-summary-export"><button class="btn" onclick="pp5ExportExcel()">ส่งออก Excel ทั้งชุด</button><button class="btn" onclick="pp5Print(false)">พิมพ์สรุป / PDF</button><button class="btn btn-primary" onclick="pp5Print(true)">พิมพ์ ปพ.5 ทั้งชุด / PDF</button></div>':''}`;
  wrap.innerHTML=`<section class="pp5-workspace"><div class="pp5-toolbar"><div><h3>ปพ.5 · ${pp5Esc(c.subject)}</h3><p>ดึงคะแนนและรายชื่อจากห้องเรียนปัจจุบัน</p></div><div class="pp5-actions"><button class="btn" onclick="pp5ExportExcel()">ส่งออก Excel ทั้งชุด</button><button class="btn" onclick="pp5Print(false)">พิมพ์ส่วนนี้ / PDF</button><button class="btn btn-primary" onclick="pp5Print(true)">พิมพ์ทั้งชุด / PDF</button></div></div>${warnings.length?`<details class="pp5-warnings"><summary>มีข้อมูลที่ต้องตรวจสอบ ${warnings.length} รายการ</summary><ul>${warnings.map(w=>`<li>${pp5Esc(w)}</li>`).join('')}</ul></details>`:''}<nav class="pp5-nav" aria-label="ส่วนเอกสาร ปพ.5">${Object.entries(PP5_SECTIONS).map(([key,title])=>`<button type="button" aria-pressed="${pp5Section===key}" onclick="pp5Select('${key}')">${title}</button>`).join('')}</nav>${content}</section>`;
}
function pp5Print(all) {
  const c=pp5Current(); if(!c)return;
  pp5FlushAssessmentForm();
  const popup=window.open('','_blank');
  if(!popup){showToast('โปรดอนุญาตหน้าต่างพิมพ์ในเบราว์เซอร์','warning');return;}
  const css=new URL('css/pp5.css?v=1',document.baseURI).href;
  popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${pp5Esc(c.subject)} ปพ.5</title><link rel="stylesheet" href="${pp5Esc(css)}"></head><body class="pp5-print">${pp5Document(c,all?'all':pp5Section)}</body></html>`);
  popup.onload=()=>{popup.focus();popup.print();};
  popup.document.close();
}
function pp5ExportExcel() {
  const c=pp5Current(); if(!c)return;
  pp5FlushAssessmentForm();
  if(typeof XLSX==='undefined'){showToast('ยังโหลดเครื่องมือ Excel ไม่สำเร็จ กรุณาลองใหม่','warning');return;}
  const wb=XLSX.utils.book_new();
  pp5DataSheets(c).forEach((sheet,i)=>{
    const ws=XLSX.utils.aoa_to_sheet([[sheet.title],[c.subject,c.className,c.academicYear,pp5Config(c).term],sheet.headers,...sheet.rows]);
    ws['!cols']=sheet.headers.map((_,n)=>({wch:n===2?28:18}));
    XLSX.utils.book_append_sheet(wb,ws,`${i+1} ${sheet.title}`.slice(0,31).replace(/[\[\]:*?\/\\]/g,' '));
  });
  XLSX.writeFile(wb,`${scoreFileBase(c)}_ปพ5.xlsx`);
}
