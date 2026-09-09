/* ClassKru ปพ.5: derived scores + teacher-entered metadata/assessments.
 * Config is stored in scores.config so existing local/cloud round trips preserve it.
 */
const PP5_TRAITS = ['รักชาติ ศาสน์ กษัตริย์', 'ซื่อสัตย์สุจริต', 'มีวินัย', 'ใฝ่เรียนรู้', 'อยู่อย่างพอเพียง', 'มุ่งมั่นในการทำงาน', 'รักความเป็นไทย', 'มีจิตสาธารณะ'];
const PP5_LEVELS = ['ไม่ผ่าน', 'ผ่าน', 'ดี', 'ดีเยี่ยม'];
const PP5_SECTIONS = { cover: 'ปกและข้อมูลรายวิชา', indicators: 'ตัวชี้วัดและโครงสร้างคะแนน', attendance: 'บันทึกเวลาเรียน', scores: 'บันทึกคะแนน', assessment: 'ผลประเมินเพิ่มเติม', summary: 'สรุปผลและลงนาม' };
let pp5Section = 'cover';
const pp5Esc = value => escapeScoreAttr(String(value ?? ''));
const pp5Num = value => Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 });
function pp5Config(c) {
  const cfg = ensureScores(c).config;
  if (!cfg.pp5) cfg.pp5 = { school: '', teacher: appState.teacherName || '', term: '', code: '', strand: '', hours: '', credits: '', start: '', end: '', description: '', reviewer: '', approver: '', approverTitle: 'ผู้อำนวยการสถานศึกษา', assessments: {} };
  if (!cfg.pp5.assessments) cfg.pp5.assessments = {};
  return cfg.pp5;
}
function pp5Current() { return appState.classes.find(c => c.id === scoreCurrentClassId); }
function pp5Select(value) { if (!PP5_SECTIONS[value]) return; pp5Section = value; const c = pp5Current(); if (c) renderPp5(c); }
function pp5SaveMeta(form) {
  const c = pp5Current(); if (!c || !form.reportValidity()) return false;
  const data = new FormData(form);
  if (data.get('start') && data.get('end') && data.get('start') > data.get('end')) { showToast('วันเริ่มต้องไม่อยู่หลังวันสิ้นสุด', 'warning'); return false; }
  const cfg = pp5Config(c);
  ['school','teacher','term','code','strand','hours','credits','start','end','description','reviewer','approver','approverTitle'].forEach(key => { cfg[key] = String(data.get(key) || '').trim(); });
  saveState(); renderPp5(c); showToast('บันทึกข้อมูล ปพ.5 แล้ว', 'success'); return false;
}
function pp5SaveAssessment(form) {
  const c = pp5Current(); if (!c) return false;
  const cfg = pp5Config(c);
  form.querySelectorAll('[data-student]').forEach(el => {
    const sid = el.dataset.student, field = el.dataset.field;
    if (!c.students.some(s => s.id === sid) || !/^(trait[0-7]|traits|reading|remark)$/.test(field)) return;
    if (field !== 'remark' && !['', '0','1','2','3'].includes(el.value)) return;
    if (!cfg.assessments[sid]) cfg.assessments[sid] = {};
    cfg.assessments[sid][field] = el.value;
  });
  saveState(); renderPp5(c); showToast('บันทึกผลประเมินแล้ว', 'success'); return false;
}
function pp5AssessmentSelectChanged(select) {
  select.dataset.level = select.value;
  select.classList.remove('is-level-unset', 'is-level-0', 'is-level-1', 'is-level-2', 'is-level-3');
  select.classList.add(select.value === '' ? 'is-level-unset' : `is-level-${select.value}`);
  const form = select.form;
  if (!form) return;
  const students = new Set([...form.querySelectorAll('.pp5-col-no')].map(cell => cell.closest('tr')));
  const completed = [...students].filter(row => ['traits', 'reading'].every(field => {
    const input = row.querySelector(`[data-field="${field}"]`);
    return input && ['0', '1', '2', '3'].includes(input.value);
  })).length;
  const status = form.querySelector('.pp5-assessment-status span');
  if (status) status.textContent = `${completed}/${students.size}`;
}
function pp5ApplyAssessmentBulk(form, field, value) {
  if (!field || !['0', '1', '2', '3'].includes(String(value))) return;
  form.querySelectorAll(`[data-field="${field}"]`).forEach(input => {
    input.value = String(value);
    pp5AssessmentSelectChanged(input);
  });
  showToast(`ตั้งค่า${field === 'traits' ? 'คุณลักษณะฯ' : field === 'reading' ? 'อ่าน คิดวิเคราะห์ และเขียน' : 'รายการประเมิน'} ทั้งห้องแล้ว`, 'success', 1500);
}
function pp5HasMark(value) { return value != null && String(value).trim() !== '' && Number.isFinite(Number(value)); }
function pp5StudentResult(c, s) {
  const sc = ensureScores(c), calc = computeStudentScore(c, s.id);
  const complete = sc.items.length > 0 && sc.items.every(i => Number.isFinite(Number(i.max)) && Number(i.max) > 0 && pp5HasMark((sc.marks[i.id] || {})[s.id]));
  const bucketsReady = SCORE_WK.every(b => !sc.config.ratio[b.key] || sc.items.some(i => i.bucket === b.key));
  const ratioReady = SCORE_WK.reduce((sum, b) => sum + Number(sc.config.ratio[b.key] || 0), 0) === 100;
  return { ...calc, complete: complete && bucketsReady && ratioReady, grade: complete && bucketsReady && ratioReady ? effectiveGrade(c, s.id) : 'ยังไม่ครบ' };
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
  const missing = c.students.filter(s => !['0','1','2','3'].includes(cfg.assessments[s.id]?.traits) || !['0','1','2','3'].includes(cfg.assessments[s.id]?.reading)).length;
  if (missing) warnings.push(`ยังไม่สรุปผลประเมินเพิ่มเติม ${missing} คน`);
  return warnings;
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
  const assessment = (s,k) => PP5_LEVELS[cfg.assessments[s.id]?.[k]] || '—';
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
  const results=c.students.map(s=>pp5StudentResult(c,s));
  const grades=[...SCORE_GRADES,'ร','มส','มผ','ผ','ยังไม่ครบ'];
  sheets.push({section:'summary',title:'สรุประดับผลการเรียน',headers:['ระดับผลการเรียน','จำนวน (คน)','ร้อยละของนักเรียนทั้งหมด'],rows:grades.map(g=>{const count=results.filter(r=>r.grade===g).length;return[g,count,c.students.length?pp5Num(count/c.students.length*100):'—'];})});
  sheets.push({section:'summary',title:'สรุปผลประเมินเพิ่มเติม',headers:['ระดับ','คุณลักษณะฯ (คน)','อ่าน คิดวิเคราะห์ และเขียน (คน)'],rows:[...PP5_LEVELS,'—'].map(level=>[level,...['traits','reading'].map(k=>c.students.filter(s=>assessment(s,k)===level).length)])});
  sheets.find(sheet => sheet.section === 'cover').rows.push(['ผู้ตรวจ',cfg.reviewer],['ผู้อนุมัติ',cfg.approver],['ตำแหน่งผู้อนุมัติ',cfg.approverTitle]);
  return sheets;
}
function pp5Document(c, section) {
  const cfg=pp5Config(c), warnings=pp5Warnings(c);
  const sections=section==='all'?Object.keys(PP5_SECTIONS):[section];
  const sheets=pp5DataSheets(c);
  const footer='<footer class="pp5-doc-foot">ClassKru · แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน · ตรวจสอบและลงนามก่อนรับรองผล</footer>';
  return sections.map(key=>{
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
  return `<form class="pp5-editor" onsubmit="return pp5SaveMeta(this)"><h3>ข้อมูลเอกสาร</h3><div class="pp5-fields">${fields.map(([key,label,type])=>`<label>${label}<input class="form-control" name="${key}" type="${type}" ${type==='number'?'min="0" step="0.5"':''} value="${pp5Esc(cfg[key])}" maxlength="200"></label>`).join('')}</div><label>คำอธิบายรายวิชา<textarea class="form-control" name="description" rows="4" maxlength="10000">${pp5Esc(cfg.description)}</textarea></label><p>รายวิชา ชั้น และปีการศึกษา ใช้ข้อมูลจากห้องเรียน · บันทึกข้อมูลก่อนเปลี่ยนส่วนหรือพิมพ์</p><button class="btn btn-primary" type="submit">บันทึกข้อมูลเอกสาร</button></form>`;
}
function pp5AssessmentForm(c) {
  const cfg=pp5Config(c);
  const students=c.students || [];
  const completed=students.filter(s => ['0','1','2','3'].includes(cfg.assessments[s.id]?.traits) && ['0','1','2','3'].includes(cfg.assessments[s.id]?.reading)).length;
  const select=(s,k)=>{ const value=String(cfg.assessments[s.id]?.[k] ?? ''); const levelClass=value===''?'is-level-unset':`is-level-${value}`; return `<select class="pp5-level-select ${levelClass}" aria-label="${pp5Esc(s.name)} ${pp5Esc(k.startsWith('trait')&&k!=='traits'?PP5_TRAITS[Number(k.slice(5))]:k==='traits'?'สรุปคุณลักษณะ':'อ่าน คิดวิเคราะห์ และเขียน')}" data-student="${pp5Esc(s.id)}" data-field="${k}" data-level="${pp5Esc(value)}" onchange="pp5AssessmentSelectChanged(this)"><option value="">—</option>${PP5_LEVELS.map((v,i)=>`<option value="${i}"${value===String(i)?' selected':''}>${v}</option>`).join('')}</select>`; };
  const row=(s,i)=>`<tr><td class="pp5-sticky pp5-col-no">${pp5Esc(s.no || i+1)}</td><td class="pp5-sticky pp5-col-code">${pp5Esc(s.studentCode || '')}</td><td class="pp5-sticky pp5-col-name" title="${pp5Esc(s.name)}">${pp5Esc(s.name)}</td>${PP5_TRAITS.map((_,n)=>`<td class="pp5-col-assess">${select(s,`trait${n}`)}</td>`).join('')}<td class="pp5-col-assess pp5-col-final">${select(s,'traits')}</td><td class="pp5-col-assess pp5-col-reading">${select(s,'reading')}</td><td class="pp5-col-remark"><input class="pp5-remark-input" aria-label="หมายเหตุ ${pp5Esc(s.name)}" data-student="${pp5Esc(s.id)}" data-field="remark" maxlength="500" value="${pp5Esc(cfg.assessments[s.id]?.remark||'')}"></td></tr>`;
  const bulkFields=[...PP5_TRAITS.map((t,n)=>[`trait${n}`,t]),['traits','สรุปคุณลักษณะฯ'],['reading','อ่าน คิดวิเคราะห์ และเขียน']];
  const bulkOptions=bulkFields.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  const bulkButtons=PP5_LEVELS.map((label,value)=>`<button type="button" class="pp5-level-action pp5-level-action-${value}" onclick="pp5ApplyAssessmentBulk(this.form,this.form.elements.pp5BulkField.value,'${value}')">${label}</button>`).join('');
  return `<form class="pp5-editor pp5-assessment-editor" onsubmit="return pp5SaveAssessment(this)"><div class="pp5-editor-head"><div><h3>บันทึกผลประเมินเพิ่มเติม</h3><p>อ้างอิงแบบ ปพ.5 ด้วยรายชื่อนักเรียนชุดเดียวกัน: เลขที่ · เลขประจำตัว · ชื่อ–สกุล</p></div><div class="pp5-assessment-head-actions"><div class="pp5-assessment-status"><span>${completed}/${students.length}</span><small>สรุปครบ</small></div><button class="btn btn-primary pp5-save-assessment" type="submit">บันทึกผลประเมิน</button></div></div><div class="pp5-assessment-tools"><div><strong>กรอกเร็วทั้งห้อง</strong><small>เลือกหัวข้อ แล้วกดระดับที่ต้องการ</small></div><select class="pp5-bulk-field" name="pp5BulkField" aria-label="หัวข้อที่จะกรอกเร็ว">${bulkOptions}</select><div class="pp5-level-actions">${bulkButtons}</div></div><div class="pp5-table-scroll pp5-assessment-scroll"><table class="pp5-table pp5-assessment-table"><thead><tr><th class="pp5-sticky pp5-col-no">เลขที่</th><th class="pp5-sticky pp5-col-code">เลขประจำตัว</th><th class="pp5-sticky pp5-col-name">ชื่อ–สกุล</th>${PP5_TRAITS.map(t=>`<th class="pp5-col-assess">${t}</th>`).join('')}<th class="pp5-col-assess pp5-col-final">ผลสรุปโดยครู</th><th class="pp5-col-assess pp5-col-reading">อ่าน คิดวิเคราะห์ และเขียน</th><th class="pp5-col-remark">หมายเหตุ</th></tr></thead><tbody>${students.length?students.map(row).join(''):`<tr><td colspan="14">ยังไม่มีรายชื่อนักเรียน</td></tr>`}</tbody></table></div></form>`;
}
function renderPp5(c) {
  const wrap=document.getElementById('web-scores-matrix-wrap'); if(!wrap)return;
  const warnings=pp5Warnings(c);
  wrap.innerHTML=`<section class="pp5-workspace"><div class="pp5-toolbar"><div><h3>ปพ.5 · ${pp5Esc(c.subject)}</h3><p>ดึงคะแนนและรายชื่อจากห้องเรียนปัจจุบัน</p></div><div class="pp5-actions"><button class="btn" onclick="pp5ExportExcel()">ส่งออก Excel ทั้งชุด</button><button class="btn" onclick="pp5Print(false)">พิมพ์ส่วนนี้ / PDF</button><button class="btn btn-primary" onclick="pp5Print(true)">พิมพ์ทั้งชุด / PDF</button></div></div>${warnings.length?`<details class="pp5-warnings"><summary>มีข้อมูลที่ต้องตรวจสอบ ${warnings.length} รายการ</summary><ul>${warnings.map(w=>`<li>${pp5Esc(w)}</li>`).join('')}</ul></details>`:''}<nav class="pp5-nav" aria-label="ส่วนเอกสาร ปพ.5">${Object.entries(PP5_SECTIONS).map(([key,title])=>`<button type="button" aria-pressed="${pp5Section===key}" onclick="pp5Select('${key}')">${title}</button>`).join('')}</nav>${pp5Section==='cover'?pp5MetaForm(c):pp5Section==='assessment'?pp5AssessmentForm(c):''}<div class="pp5-preview" aria-label="ตัวอย่างเอกสาร">${pp5Document(c,pp5Section)}</div></section>`;
}
function pp5Print(all) {
  const c=pp5Current(); if(!c)return;
  const popup=window.open('','_blank');
  if(!popup){showToast('โปรดอนุญาตหน้าต่างพิมพ์ในเบราว์เซอร์','warning');return;}
  const css=new URL('css/pp5.css?v=1',document.baseURI).href;
  popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${pp5Esc(c.subject)} ปพ.5</title><link rel="stylesheet" href="${pp5Esc(css)}"></head><body class="pp5-print">${pp5Document(c,all?'all':pp5Section)}</body></html>`);
  popup.onload=()=>{popup.focus();popup.print();};
  popup.document.close();
}
function pp5ExportExcel() {
  const c=pp5Current(); if(!c)return;
  if(typeof XLSX==='undefined'){showToast('ยังโหลดเครื่องมือ Excel ไม่สำเร็จ กรุณาลองใหม่','warning');return;}
  const wb=XLSX.utils.book_new();
  pp5DataSheets(c).forEach((sheet,i)=>{
    const ws=XLSX.utils.aoa_to_sheet([[sheet.title],[c.subject,c.className,c.academicYear,pp5Config(c).term],sheet.headers,...sheet.rows]);
    ws['!cols']=sheet.headers.map((_,n)=>({wch:n===2?28:18}));
    XLSX.utils.book_append_sheet(wb,ws,`${i+1} ${sheet.title}`.slice(0,31).replace(/[\[\]:*?\/\\]/g,' '));
  });
  XLSX.writeFile(wb,`${scoreFileBase(c)}_ปพ5.xlsx`);
}
