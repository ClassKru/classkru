// ==================== คลังสื่อการสอน / AI Quiz ====================
// AI สร้าง "ฉบับร่าง" เท่านั้น ครูตรวจและแก้ไขก่อนบันทึกหรือมอบหมายเสมอ
(function () {
  'use strict';

  const state = {
    view: 'home',
    sourceType: 'topic',
    selectedClassId: '',
    subjectId: '',
    grade: '',
    standardId: 'all',
    indicatorCodes: [],
    draft: null,
    detailEditing: false
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  const uid = () => globalThis.crypto?.randomUUID?.() || `quiz_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const gradeLabel = (value) => ({ p1:'ป.1',p2:'ป.2',p3:'ป.3',p4:'ป.4',p5:'ป.5',p6:'ป.6',m1:'ม.1',m2:'ม.2',m3:'ม.3',m4:'ม.4',m5:'ม.5',m6:'ม.6' }[value] || value || 'ไม่ระบุ');

  function classes() { return Array.isArray(appState?.classes) ? appState.classes : []; }
  function library() { return Array.isArray(appState?.mediaLibrary) ? appState.mediaLibrary : []; }
  function catalog() { return window.CKCurriculumCatalog || null; }
  function subjectIdFromName(name) {
    const text = String(name || '').toLowerCase();
    if (text.includes('คณิต')) return 'math';
    if (text.includes('วิทย')) return 'science';
    if (text.includes('ภาษาไทย')) return 'thai';
    if (text.includes('สังคม')) return 'social';
    if (text.includes('สุข') || text.includes('พลศึกษา')) return 'health';
    if (text.includes('ศิลป')) return 'art';
    if (text.includes('การงาน')) return 'career';
    if (text.includes('อังกฤษ') || text.includes('ภาษาต่าง')) return 'foreign';
    return '';
  }
  function selectedClass() { return classes().find(item => item.id === state.selectedClassId) || null; }
  function initContext() {
    const first = selectedClass() || classes()[0] || null;
    if (first && !state.selectedClassId) state.selectedClassId = first.id;
    if (first && !state.subjectId) state.subjectId = subjectIdFromName(first.subject);
    if (first && !state.grade) state.grade = String(first.gradeLevel || '');
  }
  function render() {
    initContext();
    const root = document.getElementById('content-library-root');
    if (!root) return;
    root.innerHTML = state.view === 'quiz' ? quizWizardHtml() : state.view === 'review' ? reviewHtml() : state.view === 'edit' ? editHtml() : state.view === 'detail' ? detailHtml() : homeHtml();
    if (state.view === 'detail') renderDetailMetaControls(root);
  }
  window.renderContentLibrary = render;

  function homeHtml() {
    const saved = library().filter(item => item.type === 'quiz').slice().reverse();
    return `<section class="cl-hero card"><div class="cl-hero-copy"><span class="cl-kicker"><i class="hgi-stroke hgi-book-open-01"></i> พื้นที่สร้างสื่อของคุณครู</span><h2>คลังสื่อการสอน</h2><p>สร้างข้อสอบจากเนื้อหาและตัวชี้วัด แล้วเชื่อมไปใช้กับห้องเรียนจริงได้ทันที</p></div><span class="cl-hero-mark"><i class="hgi-stroke hgi-sparkles"></i></span></section>
      <section><div class="cl-section-head"><div><h3>เริ่มสร้างสื่อ</h3><p>เลือกเครื่องมือที่ต้องการใช้</p></div></div><div class="cl-create-grid">
        <button class="cl-create-card quiz" type="button" onclick="openQuizCreator()"><span class="cl-create-icon"><i class="hgi-stroke hgi-task-02"></i></span><span class="cl-function-label">แบบประเมิน</span><h4>สร้างข้อสอบ</h4><p>ให้ AI ช่วยร่างข้อสอบ โดยกำหนดห้องเรียน เนื้อหา และตัวชี้วัดได้</p></button>
        <button class="cl-create-card worksheet coming" type="button" onclick="showToast('ใบงานกำลังพัฒนา เร็ว ๆ นี้')"><span class="cl-coming">เร็ว ๆ นี้</span><span class="cl-create-icon"><i class="hgi-stroke hgi-note-02"></i></span><span class="cl-function-label">กิจกรรม</span><h4>สร้างใบงาน</h4><p>จัดทำใบงานพร้อมคำชี้แจงและพื้นที่สำหรับนักเรียนทำงาน</p></button>
        <button class="cl-create-card lesson-plan coming" type="button" onclick="showToast('แผนการสอนกำลังพัฒนา เร็ว ๆ นี้')"><span class="cl-coming">เร็ว ๆ นี้</span><span class="cl-create-icon"><i class="hgi-stroke hgi-presentation-01"></i></span><span class="cl-function-label">การวางแผน</span><h4>แผนการสอน</h4><p>ช่วยวางลำดับกิจกรรม สื่อ และการประเมินในคาบเรียน</p></button>
      </div></section>
      <section><div class="cl-section-head"><div><h3>ข้อสอบของฉัน</h3><p>${saved.length ? `บันทึกไว้ ${saved.length} ชุด` : 'ข้อสอบที่บันทึกไว้จะแสดงที่นี่'}</p></div></div>${saved.length ? `<div class="cl-saved-grid">${saved.map(savedQuizHtml).join('')}</div>` : `<div class="cl-empty-library"><i class="hgi-stroke hgi-folder-01"></i><strong>ยังไม่มีข้อสอบในคลัง</strong><div>เริ่มจากเลือก “สร้างข้อสอบ” แล้ว AI จะช่วยสร้างฉบับร่างให้คุณตรวจสอบ</div></div>`}</section>`;
  }
  function savedQuizHtml(item) {
    return `<button class="cl-saved-card quiz" type="button" onclick="openQuizDetail('${escapeHtml(item.id)}')" aria-label="เปิดข้อสอบ ${escapeHtml(item.title || '')}"><span class="cl-saved-type"><i class="hgi-stroke hgi-task-02"></i> ข้อสอบ</span><h4>${escapeHtml(item.title || 'ข้อสอบไม่มีชื่อ')}</h4><p>${escapeHtml(item.classLabel || 'ยังไม่ได้เชื่อมห้องเรียน')}</p><div class="cl-saved-meta"><span>${Number(item.questions?.length || 0)} ข้อ</span><span>${item.mode === 'practice' ? 'โหมดฝึกฝน' : 'แบบทดสอบ'}</span><span>ร่าง</span></div><span class="cl-saved-open">เปิดข้อสอบ <i class="hgi-stroke hgi-arrow-right-01"></i></span></button>`;
  }

  window.openQuizCreator = function () { state.view = 'quiz'; state.draft = null; render(); };
  window.closeQuizCreator = function () { state.view = 'home'; render(); };
  window.openQuizDetail = function (id) {
    const quiz = library().find(item => item.id === id && item.type === 'quiz');
    if (!quiz) { showToast('ไม่พบข้อสอบชุดนี้', 'warning'); return; }
    state.draft = typeof structuredClone === 'function' ? structuredClone(quiz) : JSON.parse(JSON.stringify(quiz));
    state.detailEditing = false;
    state.view = 'detail'; render();
  };
  window.setQuizClass = function (value) {
    state.selectedClassId = value;
    const room = selectedClass();
    state.subjectId = subjectIdFromName(room?.subject);
    state.grade = String(room?.gradeLevel || '');
    state.standardId = 'all'; state.indicatorCodes = [];
    render();
  };
  window.setQuizSubject = function (value) { state.subjectId = value; state.standardId = 'all'; state.indicatorCodes = []; render(); };
  window.setQuizGrade = function (value) { state.grade = value; state.standardId = 'all'; state.indicatorCodes = []; render(); };
  window.setQuizStandard = function (value) { state.standardId = value; state.indicatorCodes = []; render(); };
  window.setQuizSource = function (type) { state.sourceType = type; render(); };

  function quizWizardHtml() {
    const room = selectedClass();
    const cat = catalog();
    const subjectOptions = (cat?.subjects || []).filter(s => s.available).map(s => `<option value="${escapeHtml(s.id)}" ${s.id === state.subjectId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
    const grades = state.subjectId && cat ? cat.getGrades(state.subjectId) : [];
    const standards = state.subjectId && cat ? cat.getStandards(state.subjectId, state.grade.toUpperCase()) : [];
    const indicatorRows = state.subjectId && cat ? cat.search({ subjectId:state.subjectId, grade:state.grade.toUpperCase(), standardId:state.standardId }) : [];
    const type = state.sourceType;
    const sourceField = type === 'topic'
      ? `<label class="cl-field full"><span>หัวข้อที่ต้องการออกข้อสอบ</span><input id="quiz-source" class="form-control" maxlength="500" placeholder="เช่น สมการเชิงเส้นสองตัวแปร"></label>`
      : `<label class="cl-field full"><span>เนื้อหาบทเรียน</span><textarea id="quiz-source" class="form-control" maxlength="12000" placeholder="วางเนื้อหาที่สอน หรือสรุปบทเรียนที่ต้องการให้ AI ใช้อ้างอิง..."></textarea><small>AI จะสร้างข้อสอบจากข้อมูลที่ครูให้เท่านั้น และครูต้องตรวจทานก่อนใช้งาน</small></label>`;
    return `<div class="cl-wizard"><div class="cl-wizard-top"><div class="cl-wizard-title"><span class="cl-create-icon"><i class="hgi-stroke hgi-task-02"></i></span><div><h2>สร้างข้อสอบ</h2><p>เริ่มจากเลือกห้องเรียนและขอบเขตเนื้อหา</p></div></div><button class="btn" type="button" onclick="closeQuizCreator()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับคลัง</span></button></div>
      <div class="cl-stepper" aria-label="ขั้นตอนการสร้างข้อสอบ"><span class="cl-step active"><b>1</b> ตั้งค่าข้อสอบ</span><span class="cl-step"><b>2</b> ตรวจร่าง</span><span class="cl-step"><b>3</b> บันทึก/มอบหมาย</span></div>
      <section class="card cl-form-card"><h3>1. เลือกบริบทของข้อสอบ</h3><p class="cl-form-note">ข้อมูลห้องเรียนจะช่วยเติมวิชาและระดับชั้นให้โดยอัตโนมัติ</p><div class="cl-form-grid">
        <label class="cl-field full"><span>ห้องเรียน <em style="color:#d04b3f;font-style:normal">*</em></span><select id="quiz-class" class="form-control" onchange="setQuizClass(this.value)"><option value="">เลือกห้องเรียน</option>${classes().map(c => `<option value="${escapeHtml(c.id)}" ${c.id === state.selectedClassId ? 'selected' : ''}>${escapeHtml(c.subject)} · ${escapeHtml(c.className)}</option>`).join('')}</select></label>
        <label class="cl-field"><span>กลุ่มสาระ</span><select class="form-control" onchange="setQuizSubject(this.value)"><option value="">เลือกกลุ่มสาระ</option>${subjectOptions}</select></label>
        <label class="cl-field"><span>ระดับชั้น</span><select class="form-control" onchange="setQuizGrade(this.value)"><option value="">ไม่ระบุ</option>${grades.map(g => `<option value="${g}" ${g.toLowerCase() === state.grade.toLowerCase() ? 'selected' : ''}>${gradeLabel(g.toLowerCase())}</option>`).join('')}</select></label>
      </div>${room ? `<div class="cl-context-card"><i class="hgi-stroke hgi-link-square-02"></i><span>ข้อสอบชุดนี้จะเชื่อมกับ <strong>${escapeHtml(room.subject)} · ${escapeHtml(room.className)}</strong> เมื่อบันทึกแล้ว คุณสามารถนำไปมอบหมายกับห้องนี้ได้</span></div>` : `<div class="cl-context-card"><i class="hgi-stroke hgi-information-circle"></i><span>กรุณาเลือกห้องเรียนก่อน เพื่อให้ข้อสอบเชื่อมกับรายวิชาและนักเรียนจริง</span></div>`}
        <div class="cl-form-grid"><label class="cl-field full"><span>มาตรฐานการเรียนรู้</span><select class="form-control" onchange="setQuizStandard(this.value)" ${standards.length ? '' : 'disabled'}><option value="all">${standards.length ? 'ทุกมาตรฐานที่เกี่ยวข้อง' : 'ยังไม่มีข้อมูลมาตรฐานสำหรับวิชา/ชั้นนี้'}</option>${standards.map(s => `<option value="${escapeHtml(s.id)}" ${s.id === state.standardId ? 'selected' : ''}>${escapeHtml(s.code)} · ${escapeHtml(s.title)}</option>`).join('')}</select></label>
        <div class="cl-field full"><span>ตัวชี้วัด/ผลการเรียนรู้ <small style="font-weight:600;color:var(--text-muted)">(เลือกได้หลายข้อ ไม่เลือกได้)</small></span><div class="cl-indicator-table" role="group" aria-label="เลือกรายการตัวชี้วัด"><div class="cl-indicator-table-head"><span></span><span>รหัส</span><span>รายละเอียดตัวชี้วัด</span></div>${indicatorRows.slice(0,18).map(i => `<label class="cl-indicator-row"><input type="checkbox" value="${escapeHtml(i.code)}" ${state.indicatorCodes.includes(i.code) ? 'checked' : ''} onchange="toggleQuizIndicator(this.value,this.checked)"><strong>${escapeHtml(i.code)}</strong><span>${escapeHtml(i.text)}</span></label>`).join('') || '<div class="cl-indicator-empty">ไม่พบตัวชี้วัดที่ตรงกับข้อมูลที่เลือก — คุณยังสร้างจากเนื้อหาได้</div>'}</div></div></div>
        <hr style="border:0;border-top:1px solid var(--border-color);margin:22px 0;">
        <h3>2. กำหนดข้อสอบ</h3><p class="cl-form-note">AI จะสร้างเป็นฉบับร่างเพื่อให้ครูตรวจแก้ก่อนบันทึก</p><div class="cl-source-tabs"><button class="cl-source-tab ${type === 'topic' ? 'active' : ''}" type="button" onclick="setQuizSource('topic')"><i class="hgi-stroke hgi-bulb"></i> จากหัวข้อ</button><button class="cl-source-tab ${type === 'text' ? 'active' : ''}" type="button" onclick="setQuizSource('text')"><i class="hgi-stroke hgi-text"></i> วางเนื้อหา</button></div>
        <div class="cl-form-grid">${sourceField}<label class="cl-field"><span>ชื่อข้อสอบ</span><input id="quiz-title" class="form-control" maxlength="160" placeholder="เช่น แบบทดสอบก่อนเรียน เรื่องสมการ"></label><label class="cl-field"><span>จำนวนข้อ</span><select id="quiz-count" class="form-control"><option value="5">5 ข้อ</option><option value="10" selected>10 ข้อ</option><option value="15">15 ข้อ</option></select></label><label class="cl-field"><span>ระดับความยาก</span><select id="quiz-difficulty" class="form-control"><option value="ง่าย">ง่าย</option><option value="ปานกลาง" selected>ปานกลาง</option><option value="ยาก">ยาก</option></select></label><label class="cl-field"><span>รูปแบบการใช้งาน</span><select id="quiz-mode" class="form-control"><option value="practice">ฝึกฝน — เห็นผลทันที</option><option value="assessment">แบบทดสอบ — เห็นผลเมื่อส่งครบ</option></select></label><div class="cl-field full"><span>ประเภทคำถาม</span><div class="cl-choices"><label class="cl-choice"><input type="checkbox" name="quiz-type" value="multiple_choice" checked> ปรนัย 4 ตัวเลือก</label><label class="cl-choice"><input type="checkbox" name="quiz-type" value="true_false"> ถูก / ผิด</label><label class="cl-choice"><input type="checkbox" name="quiz-type" value="short_answer"> คำตอบสั้น</label></div></div><label class="cl-field full"><span>คำสั่งเพิ่มเติม <small style="font-weight:600;color:var(--text-muted)">(ถ้ามี)</small></span><textarea id="quiz-instructions" class="form-control" maxlength="1200" placeholder="เช่น เน้นการคิดวิเคราะห์ ไม่ใช้โจทย์คำนวณยาว และมีคำอธิบายเฉลยทุกข้อ"></textarea></label></div>
        <div class="cl-actions"><button class="btn" type="button" onclick="closeQuizCreator()">ยกเลิก</button><button class="btn btn-primary" type="button" onclick="generateQuizDraft()"><i class="hgi-stroke hgi-ai-magic"></i> สร้างร่างข้อสอบ</button></div>
      </section></div>`;
  }
  window.toggleQuizIndicator = function (code, checked) { state.indicatorCodes = checked ? [...new Set([...state.indicatorCodes, code])] : state.indicatorCodes.filter(x => x !== code); };

  function selectedIndicators() {
    const cat = catalog();
    if (!cat || !state.subjectId) return [];
    const rows = cat.search({ subjectId:state.subjectId, grade:state.grade.toUpperCase(), standardId:state.standardId });
    return rows.filter(row => state.indicatorCodes.includes(row.code));
  }
  function processing(show) { document.getElementById('quiz-processing-overlay')?.classList.toggle('show', show); }
  function ensureProcessingOverlay() {
    if (document.getElementById('quiz-processing-overlay')) return;
    const overlay = document.createElement('div'); overlay.id = 'quiz-processing-overlay'; overlay.className = 'cl-processing'; overlay.setAttribute('role', 'status'); overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = '<div class="cl-processing-card"><div class="cl-processing-spinner"></div><h3>AI กำลังสร้างร่างข้อสอบ</h3><p>กำลังจัดคำถามให้ตรงกับเนื้อหาและตัวชี้วัด<br>กรุณารอสักครู่ และไม่ต้องกดซ้ำ</p></div>';
    document.body.appendChild(overlay);
  }
  window.generateQuizDraft = async function () {
    const room = selectedClass();
    const source = document.getElementById('quiz-source')?.value.trim() || '';
    const types = [...document.querySelectorAll('input[name="quiz-type"]:checked')].map(input => input.value);
    if (!room) { showToast('กรุณาเลือกห้องเรียนก่อนสร้างข้อสอบ', 'warning'); return; }
    if (source.length < 3) { showToast(state.sourceType === 'topic' ? 'กรุณาระบุหัวข้อ' : 'กรุณาวางเนื้อหาบทเรียน', 'warning'); return; }
    if (!types.length) { showToast('กรุณาเลือกประเภทคำถามอย่างน้อย 1 แบบ', 'warning'); return; }
    const title = document.getElementById('quiz-title')?.value.trim() || `ข้อสอบ ${source.slice(0, 60)}`;
    const payload = { title, classId:room.id, classLabel:`${room.subject} · ${room.className}`, subject:room.subject, grade:gradeLabel(state.grade), sourceType:state.sourceType, source, questionCount:Number(document.getElementById('quiz-count')?.value || 10), types, difficulty:document.getElementById('quiz-difficulty')?.value || 'ปานกลาง', mode:document.getElementById('quiz-mode')?.value || 'practice', instructions:document.getElementById('quiz-instructions')?.value.trim() || '', indicators:selectedIndicators().map(row => ({ code:row.code, text:row.text })) };
    ensureProcessingOverlay(); processing(true);
    try {
      const session = await supabaseClient?.auth?.getSession();
      const token = session?.data?.session?.access_token;
      const response = await fetch('/api/ai/generate-quiz', { method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) }, body:JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || result.error || 'ไม่สามารถสร้างข้อสอบได้');
      state.draft = { ...payload, id:uid(), createdAt:new Date().toISOString(), questions:Array.isArray(result.questions) ? result.questions : [], qualityWarnings:Array.isArray(result.warnings) ? result.warnings : [] };
      if (!state.draft.questions.length) throw new Error('AI ไม่ได้ส่งคำถามกลับมา กรุณาลองใหม่');
      state.view = 'review'; render();
    } catch (error) {
      console.warn('Quiz generation failed:', error);
      showToast(`สร้างข้อสอบไม่สำเร็จ: ${error.message || 'กรุณาลองใหม่'}`, 'warning', 7000);
    } finally { processing(false); }
  };

  function reviewHtml() {
    const draft = state.draft;
    if (!draft) { state.view = 'quiz'; return quizWizardHtml(); }
    return `<div class="cl-wizard"><div class="cl-wizard-top"><div class="cl-wizard-title"><span class="cl-create-icon"><i class="hgi-stroke hgi-task-02"></i></span><div><h2>ตรวจร่างข้อสอบ</h2><p>ตรวจคำถาม คำตอบ และเฉลยก่อนบันทึก</p></div></div><button class="btn" type="button" onclick="backToQuizSettings()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>แก้การตั้งค่า</span></button></div><div class="cl-stepper"><span class="cl-step"><b>1</b> ตั้งค่าข้อสอบ</span><span class="cl-step active"><b>2</b> ตรวจร่าง</span><span class="cl-step"><b>3</b> บันทึก/มอบหมาย</span></div>
      <section class="card cl-review-head"><div><h3>${escapeHtml(draft.title)}</h3><p>${escapeHtml(draft.classLabel)} · ${draft.questions.length} ข้อ · ${draft.mode === 'practice' ? 'โหมดฝึกฝน' : 'แบบทดสอบ'}</p></div><span class="cl-saved-type"><i class="hgi-stroke hgi-ai-magic"></i> ร่างโดย AI</span></section>${draft.qualityWarnings?.length ? `<div class="cl-quality-warning"><i class="hgi-stroke hgi-alert-02"></i><div><strong>ระบบตัดกรองเบื้องต้นแล้ว</strong><p>${draft.qualityWarnings.map(escapeHtml).join('<br>')}</p><small>ยังต้องตรวจความถูกต้องของเนื้อหา เฉลย และความเหมาะสมกับชั้นเรียนก่อนบันทึก</small></div></div>` : ''}<div class="cl-review-list">${draft.questions.map(questionHtml).join('')}</div><div class="cl-review-bottom"><span>ครูควรตรวจทานความถูกต้องและความเหมาะสมของทุกข้อก่อนบันทึก</span><div class="cl-actions"><button class="btn" type="button" onclick="backToQuizSettings()">สร้างใหม่</button><button class="btn btn-primary" type="button" onclick="saveQuizDraft()"><i class="hgi-stroke hgi-floppy-disk"></i> บันทึกเข้าคลัง</button></div></div></div>`;
  }
  function questionHtml(question, index) {
    const typeName = question.type === 'true_false' ? 'ถูก / ผิด' : question.type === 'short_answer' ? 'คำตอบสั้น' : 'ปรนัย';
    const options = question.type === 'multiple_choice' ? `<div class="cl-option-list">${(question.options || []).map((option, optionIndex) => `<label class="cl-option"><input type="radio" name="answer-${index}" ${Number(question.answerIndex) === optionIndex ? 'checked' : ''} onchange="setQuizAnswer(${index},${optionIndex})"><input type="text" class="form-control" value="${escapeHtml(option)}" onchange="setQuizOption(${index},${optionIndex},this.value)"></label>`).join('')}</div>` : question.type === 'true_false' ? `<div class="cl-option-list"><label class="cl-option"><input type="radio" name="answer-${index}" ${question.answer === 'ถูก' ? 'checked' : ''} onchange="setQuizAnswerText(${index},'ถูก')"> ถูก</label><label class="cl-option"><input type="radio" name="answer-${index}" ${question.answer === 'ผิด' ? 'checked' : ''} onchange="setQuizAnswerText(${index},'ผิด')"> ผิด</label></div>` : `<label class="cl-field" style="margin-top:12px"><span>แนวคำตอบที่ยอมรับได้</span><input class="form-control" value="${escapeHtml(question.answer || '')}" onchange="setQuizAnswerText(${index},this.value)"></label>`;
    return `<article class="card cl-question-card"><div class="cl-question-head"><span class="cl-question-no"><b>${index + 1}</b> ${typeName}</span><div class="cl-question-tools"><button class="cl-icon-btn" type="button" onclick="deleteQuizQuestion(${index})" title="ลบข้อนี้" aria-label="ลบข้อนี้"><i class="hgi-stroke hgi-delete-02"></i></button></div></div><textarea class="form-control" onchange="setQuizPrompt(${index},this.value)">${escapeHtml(question.prompt || '')}</textarea>${options}${question.explanation ? `<div class="cl-explanation"><strong>คำอธิบายจาก AI:</strong> ${escapeHtml(question.explanation)}</div>` : ''}</article>`;
  }
  function editHtml() {
    const quiz = state.draft;
    if (!quiz) { state.view = 'home'; return homeHtml(); }
    return `<div class="cl-wizard cl-edit-view"><div class="cl-wizard-top"><div class="cl-wizard-title"><span class="cl-create-icon"><i class="hgi-stroke hgi-edit-02"></i></span><div><h2>แก้ไขข้อสอบ</h2><p>แก้ไขรายละเอียด คำถาม ตัวเลือก และเฉลยของข้อสอบชุดนี้</p></div></div><button class="btn" type="button" onclick="cancelSavedQuizEdit()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับไปยังรายละเอียด</span></button></div><div class="cl-edit-toolbar"><span><i class="hgi-stroke hgi-information-circle"></i> การแก้ไขจะบันทึกทับข้อสอบชุดเดิมในคลัง</span><button class="btn btn-primary" type="button" onclick="saveSavedQuizEdits()"><i class="hgi-stroke hgi-floppy-disk"></i> บันทึกการแก้ไข</button></div><section class="card cl-edit-intro"><div class="cl-edit-section-heading"><div><span class="cl-saved-type"><i class="hgi-stroke hgi-task-02"></i> Quiz introduction</span><h3>ข้อมูลข้อสอบ</h3></div><span class="cl-edit-section-note">แก้ไขได้</span></div><div class="cl-edit-meta-grid"><label class="cl-field"><span>หัวข้อข้อสอบ</span><input id="edit-quiz-title" class="form-control" maxlength="160" value="${escapeHtml(quiz.title || '')}"></label><label class="cl-field"><span>คำอธิบาย</span><textarea id="edit-quiz-description" class="form-control" maxlength="1200" placeholder="อธิบายจุดประสงค์หรือเนื้อหาของข้อสอบ">${escapeHtml(quiz.description || '')}</textarea></label></div><p class="cl-edit-context">${escapeHtml(quiz.classLabel || 'ยังไม่ได้เชื่อมห้องเรียน')} · ${quiz.questions?.length || 0} ข้อ · ${quiz.mode === 'practice' ? 'โหมดฝึกฝน' : 'แบบทดสอบ'}</p></section><div class="cl-edit-questions-head"><div><h3>คำถาม</h3><p>ตรวจคำถาม ตัวเลือก และเฉลยให้ถูกต้องก่อนบันทึก</p></div><span>${quiz.questions?.length || 0} ข้อ</span></div><div class="cl-review-list">${(quiz.questions || []).map(questionHtml).join('') || '<div class="cl-empty-library">ข้อสอบนี้ยังไม่มีคำถาม</div>'}</div><div class="cl-edit-bottom"><button class="btn" type="button" onclick="cancelSavedQuizEdit()">ยกเลิก</button><button class="btn btn-primary" type="button" onclick="saveSavedQuizEdits()"><i class="hgi-stroke hgi-floppy-disk"></i> บันทึกการแก้ไข</button></div></div>`;
  }
  window.backToQuizSettings = function () { state.view = 'quiz'; render(); };
  window.setQuizPrompt = (index, value) => { state.draft.questions[index].prompt = value; };
  window.setQuizOption = (index, optionIndex, value) => { state.draft.questions[index].options[optionIndex] = value; };
  window.setQuizAnswer = (index, answerIndex) => { state.draft.questions[index].answerIndex = answerIndex; };
  window.setQuizAnswerText = (index, answer) => { state.draft.questions[index].answer = answer; };
  window.deleteQuizQuestion = function (index) { state.draft.questions.splice(index, 1); render(); };
  window.saveQuizDraft = function () {
    if (!state.draft?.questions?.length) { showToast('ข้อสอบต้องมีอย่างน้อย 1 ข้อ', 'warning'); return; }
    appState.mediaLibrary = library().filter(item => item.id !== state.draft.id);
    appState.mediaLibrary.push({ ...state.draft, status:'draft', type:'quiz' });
    saveState();
    state.view = 'home'; state.draft = null; render();
    showToast('บันทึกข้อสอบเข้าคลังแล้ว');
  };

  function detailQuestionHtml(question, index) {
    const answer = question.type === 'multiple_choice'
      ? question.options?.[Number(question.answerIndex)] || 'ไม่ระบุ'
      : question.answer || 'ไม่ระบุ';
    return `<article class="card cl-detail-question"><div class="cl-question-head"><span class="cl-question-no"><b>${index + 1}</b> ${question.type === 'true_false' ? 'ถูก / ผิด' : question.type === 'short_answer' ? 'คำตอบสั้น' : 'ปรนัย'}</span></div><p class="cl-detail-prompt">${escapeHtml(question.prompt || '')}</p>${question.type === 'multiple_choice' ? `<ol class="cl-detail-options">${(question.options || []).map((option, optionIndex) => `<li class="${Number(question.answerIndex) === optionIndex ? 'correct' : ''}">${escapeHtml(option)}</li>`).join('')}</ol>` : ''}<div class="cl-detail-answer"><strong>เฉลย:</strong> ${escapeHtml(answer)}</div>${question.explanation ? `<p class="cl-detail-explanation">${escapeHtml(question.explanation)}</p>` : ''}</article>`;
  }
  function detailHtml() {
    const quiz = state.draft;
    if (!quiz) { state.view = 'home'; return homeHtml(); }
    const selected = Array.isArray(quiz.indicators) ? quiz.indicators : [];
    return `<div class="cl-wizard cl-detail"><div class="cl-wizard-top"><div class="cl-wizard-title"><span class="cl-create-icon"><i class="hgi-stroke hgi-task-02"></i></span><div><h2>รายละเอียดข้อสอบ</h2><p>ตรวจแก้หรือส่งออกเอกสารได้จากหน้านี้</p></div></div><button class="btn" type="button" onclick="closeQuizCreator()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับคลัง</span></button></div><section class="card cl-detail-head"><div><span class="cl-saved-type"><i class="hgi-stroke hgi-task-02"></i> ข้อสอบ · ร่าง</span><h2>${escapeHtml(quiz.title || 'ข้อสอบไม่มีชื่อ')}</h2><p>${escapeHtml(quiz.classLabel || 'ยังไม่ได้เชื่อมห้องเรียน')} · ${quiz.questions?.length || 0} ข้อ · ${quiz.mode === 'practice' ? 'โหมดฝึกฝน' : 'โหมดแบบทดสอบ'}</p>${selected.length ? `<div class="cl-detail-indicators">${selected.map(item => `<span>${escapeHtml(item.code)}</span>`).join('')}</div>` : ''}</div><div class="cl-detail-actions"><button class="btn cl-export-btn word" type="button" data-export-type="word" onclick="exportQuizDocx()"><i class="hgi-stroke hgi-file-download"></i> ส่งออก Word</button><button class="btn cl-export-btn pdf" type="button" data-export-type="pdf" onclick="exportQuizPdf()"><i class="hgi-stroke hgi-file-02"></i> ส่งออก PDF</button><button class="btn btn-primary" type="button" onclick="editSavedQuiz()"><i class="hgi-stroke hgi-edit-02"></i> แก้ไขข้อสอบ</button></div></section><div class="cl-detail-list">${(quiz.questions || []).map(detailQuestionHtml).join('') || '<div class="cl-empty-library">ข้อสอบนี้ยังไม่มีคำถาม</div>'}</div><div class="cl-detail-danger"><button class="btn" type="button" onclick="deleteSavedQuiz()"><i class="hgi-stroke hgi-delete-02"></i> ลบข้อสอบชุดนี้</button></div></div>`;
  }
  function renderDetailMetaControls(root) {
    const quiz = state.draft;
    const head = root.querySelector('.cl-detail-head');
    const info = head?.firstElementChild;
    const meta = info?.querySelector('p');
    const actions = head?.querySelector('.cl-detail-actions');
    if (!quiz || !info || !meta || !actions) return;
    root.querySelector('.cl-export-btn.pdf')?.remove();
    const oldDescription = info.querySelector('.cl-detail-description');
    oldDescription?.remove();
    info.querySelector('.cl-detail-edit-fields')?.remove();
    const description = document.createElement('p');
    description.className = 'cl-detail-description';
    description.textContent = quiz.description || 'ยังไม่มีคำอธิบายสำหรับข้อสอบชุดนี้';
    info.insertBefore(description, meta);
    actions.querySelector('[data-detail-edit]')?.remove();
    actions.querySelector('[data-detail-save]')?.remove();
    actions.querySelector('[data-detail-cancel]')?.remove();
    if (!state.detailEditing) {
      actions.insertAdjacentHTML('afterbegin', '<button class="btn cl-detail-edit-btn" type="button" data-detail-edit onclick="editQuizDetails()"><i class="hgi-stroke hgi-edit-02"></i> แก้ไขรายละเอียด</button>');
      return;
    }
    info.querySelector('h2').style.display = 'none';
    description.style.display = 'none';
    const fields = document.createElement('div');
    fields.className = 'cl-detail-edit-fields';
    fields.innerHTML = `<label>หัวข้อข้อสอบ<input id="detail-title" class="form-control" maxlength="160" value="${escapeHtml(quiz.title || '')}"></label><label>คำอธิบาย<textarea id="detail-description" class="form-control" maxlength="1200" placeholder="เช่น แบบทดสอบทบทวนเรื่องแรงและการเคลื่อนที่">${escapeHtml(quiz.description || '')}</textarea></label>`;
    info.insertBefore(fields, meta);
    actions.insertAdjacentHTML('afterbegin', '<button class="btn btn-primary" type="button" data-detail-save onclick="saveQuizDetails()"><i class="hgi-stroke hgi-floppy-disk"></i> บันทึกข้อมูล</button><button class="btn" type="button" data-detail-cancel onclick="cancelQuizDetails()">ยกเลิก</button>');
  }
  window.editQuizDetails = function () { state.detailEditing = true; render(); document.getElementById('detail-title')?.focus(); };
  window.cancelQuizDetails = function () { state.detailEditing = false; render(); };
  window.saveQuizDetails = function () {
    if (!state.draft) return;
    const title = document.getElementById('detail-title')?.value.trim();
    if (!title) { showToast('กรุณาระบุหัวข้อข้อสอบ', 'warning'); return; }
    state.draft.title = title;
    state.draft.description = document.getElementById('detail-description')?.value.trim() || '';
    appState.mediaLibrary = library().map(item => item.id === state.draft.id ? { ...item, title:state.draft.title, description:state.draft.description } : item);
    saveState(); state.detailEditing = false; render(); showToast('บันทึกข้อมูลข้อสอบแล้ว');
  };
  window.editSavedQuiz = function () { state.detailEditing = false; state.view = 'edit'; render(); };
  window.cancelSavedQuizEdit = function () { state.detailEditing = false; state.view = 'detail'; render(); };
  window.saveSavedQuizEdits = function () {
    if (!state.draft?.questions?.length) { showToast('ข้อสอบต้องมีอย่างน้อย 1 ข้อ', 'warning'); return; }
    const title = document.getElementById('edit-quiz-title')?.value.trim();
    if (!title) { showToast('กรุณาระบุหัวข้อข้อสอบ', 'warning'); return; }
    state.draft.title = title;
    state.draft.description = document.getElementById('edit-quiz-description')?.value.trim() || '';
    appState.mediaLibrary = library().map(item => item.id === state.draft.id ? { ...state.draft, status:'draft', type:'quiz' } : item);
    saveState(); state.view = 'detail'; state.detailEditing = false; render(); showToast('บันทึกการแก้ไขข้อสอบแล้ว');
  };
  window.deleteSavedQuiz = function () {
    if (!state.draft || !confirm(`ลบข้อสอบ “${state.draft.title || ''}” ออกจากคลังใช่หรือไม่?`)) return;
    appState.mediaLibrary = library().filter(item => item.id !== state.draft.id);
    saveState(); state.draft = null; state.view = 'home'; render(); showToast('ลบข้อสอบออกจากคลังแล้ว');
  };
  window.exportQuizDocx = async function () {
    const quiz = state.draft;
    if (!quiz?.questions?.length) { showToast('ข้อสอบนี้ยังไม่มีคำถามสำหรับส่งออก', 'warning'); return; }
    const button = document.querySelector('.cl-detail-actions [data-export-type="word"]');
    const oldHtml = button?.innerHTML;
    if (button) { button.disabled = true; button.innerHTML = '<i class="hgi-stroke hgi-loading-03"></i> กำลังสร้าง Word...'; }
    try {
      const session = await supabaseClient?.auth?.getSession();
      const token = session?.data?.session?.access_token;
      const response = await fetch('/api/exports/quiz-docx', { method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) }, body:JSON.stringify({ quiz }) });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'ไม่สามารถสร้างไฟล์ Word ได้');
      }
      const blob = await response.blob();
      const safeName = String(quiz.title || 'ข้อสอบ').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
      const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = `${safeName}.docx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
      showToast('ดาวน์โหลดไฟล์ Word แล้ว');
    } catch (error) { showToast(`ส่งออก Word ไม่สำเร็จ: ${error.message || 'กรุณาลองใหม่'}`, 'warning', 7000); }
    finally { if (button) { button.disabled = false; button.innerHTML = oldHtml; } }
  };
})();
