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
    lessonIndicatorCodes: [],
    lessonView: 'home',
    lessonDraft: null,
    lessonDraftOrigin: 'new',
    lessonEditing: false,
    lessonQuizLinkOpen: false,
    lessonWorksheetLinkOpen: false,
    quizPrefill: null,
    quizReturnPlanId: '',
    worksheetView: 'home',
    worksheetDraft: null,
    worksheetDraftOrigin: 'new',
    worksheetEditing: false,
    worksheetPrefill: null,
    worksheetType: 'questions',
    worksheetWorkMode: 'individual',
    worksheetItemCount: '8',
    worksheetDifficulty: 'medium',
    worksheetVisuals: 'none',
    worksheetAnswerSpace: 'medium',
    worksheetAnswerKey: 'yes',
    worksheetIndicatorCodes: [],
    draft: null,
    detailEditing: false,
    editBaseline: '',
    libraryTab: 'all',
    libraryQuery: ''
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  const uid = () => globalThis.crypto?.randomUUID?.() || `quiz_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const gradeLabel = (value) => ({ p1:'ป.1',p2:'ป.2',p3:'ป.3',p4:'ป.4',p5:'ป.5',p6:'ป.6',m1:'ม.1',m2:'ม.2',m3:'ม.3',m4:'ม.4',m5:'ม.5',m6:'ม.6' }[value] || value || 'ไม่ระบุ');
  const gradeIdFromLabel = (value) => {
    const text = String(value || '').toLowerCase().replace(/\s+/g, '');
    const match = text.match(/([pm])\.?([1-6])/);
    if (match) return `${match[1]}${match[2]}`;
    if (text.includes('ป.')) return `p${text.replace(/\D/g, '').slice(0, 1)}`;
    if (text.includes('ม.')) return `m${text.replace(/\D/g, '').slice(0, 1)}`;
    return text;
  };

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
  function apiPath(path) { return window.location.protocol === 'file:' ? `https://classkru-kohl.vercel.app${path}` : path; }
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
    root.innerHTML = state.worksheetView === 'form' ? worksheetFormHtml() : state.worksheetView === 'review' ? worksheetReviewHtml() : state.worksheetView === 'detail' ? worksheetDetailHtml() : state.lessonView === 'form' ? lessonFormHtml() : state.lessonView === 'review' ? lessonReviewHtml() : state.lessonView === 'detail' ? lessonDetailHtml() : state.view === 'quiz' ? quizWizardHtml() : state.view === 'review' ? reviewHtml() : state.view === 'edit' ? editHtml() : state.view === 'detail' ? detailHtml() : homeHtml();
    bindCreationCardActions(root);
    bindLibraryControls(root);
    if (state.worksheetView === 'review' || state.worksheetView === 'detail') decorateWorksheetPreview(root);
    if (state.view === 'detail') renderDetailMetaControls(root);
  }
  window.renderContentLibrary = render;

  function bindCreationCardActions(root) {
    root.querySelectorAll('[data-create-action]').forEach(card => {
      card.addEventListener('click', () => {
        const action = card.dataset.createAction;
        if (action === 'worksheet') window.openWorksheetCreator();
        if (action === 'quiz') window.openQuizCreator();
        if (action === 'lesson-plan') window.openLessonPlanCreator();
        if (action === 'interactive') window.openInteractiveMediaStudio(state.selectedClassId);
      });
    });
  }

  function bindLibraryControls(root) {
    root.querySelectorAll('[data-library-tab]').forEach(tab => tab.addEventListener('click', () => {
      state.libraryTab = tab.dataset.libraryTab || 'all';
      render();
    }));
    const search = root.querySelector('[data-library-search]');
    if (!search) return;
    search.addEventListener('input', event => {
      const cursor = event.target.selectionStart;
      state.libraryQuery = event.target.value;
      render();
      const next = document.querySelector('[data-library-search]');
      if (next) { next.focus(); next.setSelectionRange(cursor, cursor); }
    });
  }

  function libraryItemMatches(item, query) {
    if (!query) return true;
    const haystack = [item.title, item.topic, item.subject, item.classLabel, item.worksheetTypeLabel, item.activityType, ...(Array.isArray(item.indicators) ? item.indicators.flatMap(indicator => [indicator.code, indicator.text]) : [])].join(' ').toLowerCase();
    return haystack.includes(query.toLowerCase());
  }
  function savedLibraryItemHtml(item) {
    if (item.type === 'quiz') return savedQuizHtml(item);
    if (item.type === 'worksheet') return savedWorksheetHtml(item);
    return savedLessonPlanHtml(item);
  }
  function libraryTabLabel(type) {
    return { all:'ทั้งหมด', quiz:'ข้อสอบ', worksheet:'ใบงาน', lesson_plan:'แผนรายคาบ' }[type] || 'ทั้งหมด';
  }
  function homeHtml() {
    const allItems = library().filter(item => ['quiz', 'worksheet', 'lesson_plan'].includes(item.type)).slice().reverse();
    const tab = ['all', 'quiz', 'worksheet', 'lesson_plan'].includes(state.libraryTab) ? state.libraryTab : 'all';
    const query = String(state.libraryQuery || '').trim();
    const visibleItems = allItems.filter(item => (tab === 'all' || item.type === tab) && libraryItemMatches(item, query));
    const tabCounts = { all:allItems.length, quiz:allItems.filter(item => item.type === 'quiz').length, worksheet:allItems.filter(item => item.type === 'worksheet').length, lesson_plan:allItems.filter(item => item.type === 'lesson_plan').length };
    const resultLabel = query ? `พบ ${visibleItems.length} รายการจากการค้นหา` : `${tabCounts[tab]} รายการ`;
    return `<section class="cl-hero card"><div class="cl-hero-copy"><span class="cl-kicker"><i class="hgi-stroke hgi-book-open-01"></i> พื้นที่สร้างสื่อของคุณครู</span><h2>คลังสื่อการสอน</h2><p>สร้างข้อสอบจากเนื้อหาและตัวชี้วัด แล้วเชื่อมไปใช้กับห้องเรียนจริงได้ทันที</p></div><span class="cl-hero-mark"><i class="hgi-stroke hgi-sparkles"></i></span></section>
      <section><div class="cl-section-head"><div><h3>เริ่มสร้างสื่อ</h3><p>เลือกเครื่องมือที่ต้องการใช้</p></div></div><div class="cl-create-grid">
        <button class="cl-create-card quiz" type="button" data-create-action="interactive"><span class="cl-create-icon"><i class="hgi-stroke hgi-magic-wand-01"></i></span><span class="cl-function-label">สื่อโต้ตอบ</span><h4>เกมและแบบจำลองกับ AI</h4><p>คุยไอเดีย สร้างสื่อ ทดลองเล่น และเปิดงานเดิมจากคลังสื่อโต้ตอบ</p></button>
        <button class="cl-create-card quiz" type="button" data-create-action="quiz"><span class="cl-create-icon"><i class="hgi-stroke hgi-task-02"></i></span><span class="cl-function-label">แบบประเมิน</span><h4>สร้างข้อสอบ</h4><p>ให้ AI ช่วยร่างข้อสอบ โดยกำหนดห้องเรียน เนื้อหา และตัวชี้วัดได้</p></button>
        <button class="cl-create-card worksheet" type="button" data-create-action="worksheet"><span class="cl-create-icon"><i class="hgi-stroke hgi-note-02"></i></span><span class="cl-function-label">กิจกรรม</span><h4>สร้างใบงาน</h4><p>จัดทำใบงานพร้อมคำชี้แจง ขั้นตอน และพื้นที่สำหรับนักเรียนทำงาน</p></button>
        <button class="cl-create-card lesson-plan" type="button" data-create-action="lesson-plan"><span class="cl-create-icon"><i class="hgi-stroke hgi-presentation-01"></i></span><span class="cl-function-label">การวางแผน</span><h4>สร้างแผนการสอน</h4><p>กำหนดกรอบการสอน แล้วให้ AI ช่วยเติมกิจกรรมและการประเมิน</p></button>
        <button class="cl-create-card lesson-plan coming" type="button" disabled aria-disabled="true"><span class="cl-coming">เร็ว ๆ นี้</span><span class="cl-create-icon"><i class="hgi-stroke hgi-book-open-01"></i></span><span class="cl-function-label">การวางแผนรายวิชา</span><h4>แผนการจัดการเรียนรู้รายวิชา</h4><p>รวมหน่วยการเรียนรู้และแผนรายคาบไว้เป็นชุดเดียวสำหรับส่งออกทั้งภาคเรียน</p></button>
      </div></section>
      <section class="cl-library-section"><div class="cl-section-head"><div><h3>คลังของฉัน</h3><p>${resultLabel} · ค้นหาและกรองงานทั้งหมดได้จากที่เดียว</p></div></div><div class="cl-library-toolbar"><label class="cl-library-search"><i class="hgi-stroke hgi-search-01"></i><input data-library-search type="search" value="${escapeHtml(query)}" placeholder="ค้นหาชื่อเรื่อง วิชา ห้องเรียน หรือตัวชี้วัด" aria-label="ค้นหาในคลังสื่อการสอน"></label><div class="cl-library-tabs" role="tablist" aria-label="ประเภทสื่อในคลัง">${['all', 'quiz', 'worksheet', 'lesson_plan'].map(type => `<button class="cl-library-tab ${tab === type ? 'active' : ''}" type="button" data-library-tab="${type}" role="tab" aria-selected="${tab === type}">${libraryTabLabel(type)} <span>${tabCounts[type]}</span></button>`).join('')}</div></div>${visibleItems.length ? `<div class="cl-saved-grid">${visibleItems.map(savedLibraryItemHtml).join('')}</div>` : `<div class="cl-empty-library"><i class="hgi-stroke hgi-${query ? 'search-01' : 'folder-01'}"></i><strong>${query ? 'ไม่พบรายการที่ค้นหา' : `ยังไม่มี${tab === 'all' ? 'สื่อ' : libraryTabLabel(tab)}`}</strong><div>${query ? 'ลองใช้คำค้นอื่น หรือเลือกประเภทสื่ออื่น' : 'เริ่มจากเลือกเครื่องมือด้านบน แล้วงานที่บันทึกไว้จะแสดงที่นี่'}</div></div>`}</section>`;
  }
  function savedLessonPlanHtml(item) { return `<article class="cl-saved-card lesson-plan"><button class="cl-saved-card-main" type="button" onclick="openSavedLessonPlan('${escapeHtml(item.id)}')" aria-label="เปิดแผนการสอน ${escapeHtml(item.title || '')}"><span class="cl-saved-type cl-plan-type"><i class="hgi-stroke hgi-presentation-01"></i> แผนการสอน</span><h4>${escapeHtml(item.title || 'แผนการสอนไม่มีชื่อ')}</h4><p>${escapeHtml(item.classLabel || 'ยังไม่ได้เชื่อมห้องเรียน')}</p><div class="cl-saved-meta"><span>${escapeHtml(item.duration || 'ไม่ระบุเวลา')}</span><span>${Array.isArray(item.indicators) ? item.indicators.length : 0} ตัวชี้วัด</span><span>ร่าง</span></div><span class="cl-saved-open">เปิดแผน <i class="hgi-stroke hgi-arrow-right-01"></i></span></button><button class="cl-saved-delete" type="button" onclick="deleteSavedLibraryItem(event, '${escapeHtml(item.id)}')" aria-label="ลบแผนการสอน" title="ลบแผนการสอน"><i class="hgi-stroke hgi-delete-02"></i></button></article>`; }
  function savedWorksheetHtml(item) { return `<article class="cl-saved-card worksheet"><button class="cl-saved-card-main" type="button" onclick="openSavedWorksheet('${escapeHtml(item.id)}')" aria-label="เปิดใบงาน ${escapeHtml(item.title || '')}"><span class="cl-saved-type cl-worksheet-type"><i class="hgi-stroke hgi-note-02"></i> ใบงาน</span><h4>${escapeHtml(item.title || 'ใบงานไม่มีชื่อ')}</h4><p>${escapeHtml(item.classLabel || 'ยังไม่ได้เชื่อมห้องเรียน')}</p><div class="cl-saved-meta"><span>${escapeHtml(item.worksheetTypeLabel || item.activityType || 'กิจกรรม')}</span><span>${Array.isArray(item.indicators) ? item.indicators.length : 0} ตัวชี้วัด</span><span>ร่าง</span></div><span class="cl-saved-open">เปิดใบงาน <i class="hgi-stroke hgi-arrow-right-01"></i></span></button><button class="cl-saved-delete" type="button" onclick="deleteSavedLibraryItem(event, '${escapeHtml(item.id)}')" aria-label="ลบใบงาน" title="ลบใบงาน"><i class="hgi-stroke hgi-delete-02"></i></button></article>`; }
  function savedQuizHtml(item) {
    return `<article class="cl-saved-card quiz"><button class="cl-saved-card-main" type="button" onclick="openQuizDetail('${escapeHtml(item.id)}')" aria-label="เปิดข้อสอบ ${escapeHtml(item.title || '')}"><span class="cl-saved-type"><i class="hgi-stroke hgi-task-02"></i> ข้อสอบ</span><h4>${escapeHtml(item.title || 'ข้อสอบไม่มีชื่อ')}</h4><p>${escapeHtml(item.classLabel || 'ยังไม่ได้เชื่อมห้องเรียน')}</p><div class="cl-saved-meta"><span>${Number(item.questions?.length || 0)} ข้อ</span><span>${item.mode === 'practice' ? 'โหมดฝึกฝน' : 'แบบทดสอบ'}</span><span>ร่าง</span></div><span class="cl-saved-open">เปิดข้อสอบ <i class="hgi-stroke hgi-arrow-right-01"></i></span></button><button class="cl-saved-delete" type="button" onclick="deleteSavedLibraryItem(event, '${escapeHtml(item.id)}')" aria-label="ลบข้อสอบ" title="ลบข้อสอบ"><i class="hgi-stroke hgi-delete-02"></i></button></article>`;
  }

  window.openWorksheetCreator = function () { state.worksheetView = 'form'; state.worksheetDraft = null; state.worksheetDraftOrigin = 'new'; state.worksheetEditing = false; state.worksheetPrefill = null; state.worksheetType = 'questions'; state.worksheetWorkMode = 'individual'; state.worksheetItemCount = '8'; state.worksheetDifficulty = 'medium'; state.worksheetVisuals = 'none'; state.worksheetAnswerSpace = 'medium'; state.worksheetAnswerKey = 'yes'; state.worksheetIndicatorCodes = []; render(); };
  window.closeWorksheetCreator = function () { const returnPlanId = state.worksheetPrefill?.lessonPlanId || state.worksheetDraft?.lessonPlanId; const returnPlan = returnPlanId ? library().find(item => item.id === returnPlanId && item.type === 'lesson_plan') : null; state.worksheetView = 'home'; state.worksheetDraft = null; state.worksheetDraftOrigin = 'new'; state.worksheetEditing = false; state.worksheetPrefill = null; state.worksheetIndicatorCodes = []; if (returnPlan) { state.lessonDraft = clone(returnPlan); state.lessonDraftOrigin = 'saved'; state.lessonView = 'detail'; } render(); };
  window.setWorksheetClass = function (value) { state.selectedClassId = value; const room = selectedClass(); state.subjectId = subjectIdFromName(room?.subject); state.grade = String(room?.gradeLevel || ''); state.worksheetIndicatorCodes = []; render(); };
  window.setWorksheetSubject = function (value) { state.subjectId = value; state.worksheetIndicatorCodes = []; render(); };
  window.setWorksheetGrade = function (value) { state.grade = value; state.worksheetIndicatorCodes = []; render(); };
  window.setWorksheetType = function (value) { state.worksheetType = value; };
  window.setWorksheetOption = function (field, value) { const stateField = `worksheet${field.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')}`; if (Object.prototype.hasOwnProperty.call(state, stateField)) state[stateField] = value; };
  window.toggleWorksheetIndicator = function (code, checked) { state.worksheetIndicatorCodes = checked ? [...new Set([...state.worksheetIndicatorCodes, code])] : state.worksheetIndicatorCodes.filter(item => item !== code); };
  function selectedWorksheetIndicators() { const cat = catalog(); if (!cat || !state.subjectId) return []; const rows = cat.search({ subjectId:state.subjectId, grade:state.grade.toUpperCase(), standardId:'all' }); return rows.filter(row => state.worksheetIndicatorCodes.includes(row.code)); }
  const worksheetFormats = [{ id:'questions', label:'เติมคำ / ตอบคำถาม', hint:'ใบงานพื้นฐานสำหรับทบทวนความเข้าใจ เติมคำ หรือเขียนคำตอบสั้น ๆ' }, { id:'table', label:'ตาราง / จำแนกข้อมูล', hint:'ใช้จัดกลุ่ม เปรียบเทียบ ทำเครื่องหมาย หรือบันทึกข้อมูลลงตาราง' }, { id:'inquiry', label:'ทดลอง / สำรวจ / บันทึกผล', hint:'ใช้กับการสังเกตหรือทดลอง มีขั้นตอน ตารางบันทึกผล และคำถามสรุป' }, { id:'matching', label:'จับคู่ / ลากเส้น', hint:'แสดงรายการสองฝั่งให้นักเรียนจับคู่ โดยมีช่องคำตอบและเฉลยแยกสำหรับครู' }, { id:'drawing_form', label:'วาดภาพ / แบบฟอร์ม', hint:'สร้างพื้นที่วาดหรือออกแบบ พร้อมช่องให้เขียนคำอธิบายและเกณฑ์ตรวจ' }];
  function worksheetFormat(value) { return worksheetFormats.find(item => item.id === value) || worksheetFormats[0]; }
  function worksheetOptionsHtml(saved, prefill) {
    const storedField = { worksheetWorkMode:'workMode', worksheetItemCount:'itemCount', worksheetDifficulty:'difficulty', worksheetVisuals:'visuals', worksheetAnswerSpace:'answerSpace', worksheetAnswerKey:'answerKey' };
    const value = (field, fallback) => saved[storedField[field]] || prefill[storedField[field]] || state[field] || fallback;
    const option = (field, current, items) => `<label class="cl-field"><span>${items.label}</span><select id="worksheet-${field}" class="form-control" onchange="setWorksheetOption('${field}', this.value)">${items.options.map(item => `<option value="${item.value}" ${item.value === current ? 'selected' : ''}>${item.label}</option>`).join('')}</select></label>`;
    const numberOption = (field, current, label) => `<label class="cl-field"><span>${label}</span><select id="worksheet-${field}" class="form-control" onchange="setWorksheetOption('${field}', this.value)">${Array.from({length:10}, (_, index) => `<option value="${index + 1}" ${String(current) === String(index + 1) ? 'selected' : ''}>${index + 1} ข้อ</option>`).join('')}</select></label>`;
    return `<section class="cl-worksheet-options-card"><div class="cl-worksheet-options-head"><div><h3>3. กำหนดลักษณะใบงาน</h3><p>กำหนดจำนวนกิจกรรมหลักเป็นเป้าหมาย ระบบจะรักษารายละเอียดสำคัญในคำสั่งไว้ให้ครบ</p></div><span class="cl-worksheet-guide-badge"><i class="hgi-stroke hgi-magic-wand-01"></i> จัดหน้าพร้อมพื้นที่ตอบ</span></div><div class="cl-form-grid">${option('work-mode', value('worksheetWorkMode', 'individual'), { label:'รูปแบบการทำงาน', options:[{value:'individual',label:'ทำรายบุคคล'},{value:'pair',label:'ทำงานเป็นคู่'},{value:'group',label:'ทำงานเป็นกลุ่ม'}] })}${numberOption('item-count', value('worksheetItemCount', '8'), 'จำนวนกิจกรรมหลัก')}${option('difficulty', value('worksheetDifficulty', 'medium'), { label:'ระดับความยาก', options:[{value:'easy',label:'พื้นฐาน'},{value:'medium',label:'ปานกลาง'},{value:'hard',label:'ท้าทาย'}] })}${option('visuals', value('worksheetVisuals', 'none'), { label:'สื่อประกอบที่รองรับ', options:[{value:'none',label:'โครงสร้างใบงานและพื้นที่วาด'}] })}${option('answer-space', value('worksheetAnswerSpace', 'medium'), { label:'พื้นที่คำตอบ', options:[{value:'short',label:'สั้น กระชับ'},{value:'medium',label:'พอดี'},{value:'long',label:'มีพื้นที่อธิบาย'}] })}${option('answer-key', value('worksheetAnswerKey', 'yes'), { label:'เฉลยสำหรับครู', options:[{value:'yes',label:'สร้างเฉลย/เกณฑ์ตรวจด้วย'},{value:'no',label:'ไม่ต้องสร้างเฉลย'}] })}</div></section>`;
  }
  function worksheetFormHtml() {
    const saved = state.worksheetDraft || {}; const prefill = state.worksheetPrefill || {}; const requestedType = saved.worksheetType || prefill.worksheetType || state.worksheetType; const selectedType = worksheetFormats.some(item => item.id === requestedType) ? requestedType : 'questions'; state.worksheetType = selectedType;
    const formatBlock = `<section class="cl-worksheet-format-card"><div><h3>2. เลือกแม่แบบใบงาน</h3><p>เลือกโครงสร้างที่ใกล้กับงานที่ต้องการ ระบบจะจัดวางเป็นใบงานให้ครูตรวจต่อ</p></div><label class="cl-field"><span>รูปแบบใบงาน <em class="cl-required">*</em></span><select id="worksheet-type" class="form-control" onchange="setWorksheetType(this.value)">${worksheetFormats.map(item => `<option value="${item.id}" ${item.id === selectedType ? 'selected' : ''}>${item.label}</option>`).join('')}</select><small class="cl-field-hint">${escapeHtml(worksheetFormat(selectedType).hint)}</small></label></section>`;
    const optionBlock = worksheetOptionsHtml(saved, prefill);
    return legacyWorksheetFormHtml().replace('<h3>2. สิ่งที่ต้องการให้ใบงานช่วยจัดทำ</h3>', `${formatBlock}${optionBlock}<h3>4. รายละเอียดเพิ่มเติม (ถ้ามี)</h3>`);
  }
  function legacyWorksheetFormHtml() {
    const saved = state.worksheetDraft || {}; const prefill = state.worksheetPrefill || {}; const savedIndicators = Array.isArray(saved.indicators) ? saved.indicators.map(item => item.code) : (prefill.indicators || []).map(item => item.code); const selectedIndicatorCodes = state.worksheetIndicatorCodes.length ? state.worksheetIndicatorCodes : savedIndicators; const cat = catalog(); const subjectOptions = (cat?.subjects || []).filter(s => s.available).map(s => `<option value="${escapeHtml(s.id)}" ${s.id === state.subjectId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join(''); const grades = state.subjectId && cat ? cat.getGrades(state.subjectId) : []; const indicatorRows = state.subjectId && cat ? cat.search({ subjectId:state.subjectId, grade:state.grade.toUpperCase(), standardId:'all' }) : [];
    const activityTypes = ['สืบค้นและรวบรวมข้อมูล','ทดลองและสังเกต','ฝึกทักษะ','วิเคราะห์และอภิปราย','ทำงานกลุ่ม','สะท้อนการเรียนรู้'];
    return `<div class="cl-wizard cl-worksheet-wizard"><div class="cl-wizard-top"><button class="btn" type="button" onclick="closeWorksheetCreator()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับคลัง</span></button><div class="cl-wizard-title"><span class="cl-create-icon worksheet"><i class="hgi-stroke hgi-note-02"></i></span><div><h2>สร้างใบงาน</h2><p>กำหนดกรอบกิจกรรม แล้วให้ AI ช่วยจัดทำร่างใบงาน</p></div></div></div><div class="cl-stepper" aria-label="ขั้นตอนการสร้างใบงาน"><span class="cl-step active"><b>1</b> กำหนดกรอบ</span><span class="cl-step"><b>2</b> ตรวจร่าง</span><span class="cl-step"><b>3</b> บันทึกเข้าคลัง</span></div><section class="card cl-form-card"><h3>1. ข้อมูลพื้นฐาน</h3><p class="cl-form-note">เลือกข้อมูลที่มีอยู่ใน ClassKru เพื่อให้ใบงานสอดคล้องกับห้องเรียนและตัวชี้วัด</p><div class="cl-form-grid"><label class="cl-field full"><span>ห้องเรียน <em class="cl-required">*</em></span><select id="worksheet-class" class="form-control" onchange="setWorksheetClass(this.value)"><option value="">เลือกห้องเรียน</option>${classes().map(c => `<option value="${escapeHtml(c.id)}" ${c.id === (saved.classId || prefill.classId || state.selectedClassId) ? 'selected' : ''}>${escapeHtml(c.subject)} · ${escapeHtml(c.className)}</option>`).join('')}</select></label><label class="cl-field"><span>กลุ่มสาระ</span><select class="form-control" onchange="setWorksheetSubject(this.value)"><option value="">เลือกกลุ่มสาระ</option>${subjectOptions}</select></label><label class="cl-field"><span>ระดับชั้น</span><select class="form-control" onchange="setWorksheetGrade(this.value)"><option value="">ไม่ระบุ</option>${grades.map(g => `<option value="${escapeHtml(g)}" ${g.toLowerCase() === state.grade.toLowerCase() ? 'selected' : ''}>${gradeLabel(g.toLowerCase())}</option>`).join('')}</select></label><label class="cl-field full"><span>ชื่อใบงาน <em class="cl-required">*</em></span><input id="worksheet-title" class="form-control" maxlength="180" value="${escapeHtml(saved.title || prefill.title || '')}" placeholder="เช่น ใบงานวิเคราะห์โครงสร้างของเซลล์"></label><label class="cl-field"><span>ประเภทกิจกรรม</span><select id="worksheet-activity-type" class="form-control">${activityTypes.map(value => `<option ${value === (saved.activityType || prefill.activityType) ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="cl-field"><span>เวลาที่ใช้</span><select id="worksheet-duration" class="form-control"><option ${saved.duration === '1 คาบ (50 นาที)' ? 'selected' : ''}>1 คาบ (50 นาที)</option><option ${saved.duration === '2 คาบ (100 นาที)' ? 'selected' : ''}>2 คาบ (100 นาที)</option><option ${saved.duration === '3 คาบ (150 นาที)' ? 'selected' : ''}>3 คาบ (150 นาที)</option></select></label></div><div class="cl-form-grid"><div class="cl-field full"><span>ตัวชี้วัด/ผลการเรียนรู้ <small>(เลือกได้หลายข้อ)</small></span><div class="cl-indicator-table" role="group" aria-label="เลือกตัวชี้วัดสำหรับใบงาน"><div class="cl-indicator-table-head"><span></span><span>รหัส</span><span>รายละเอียดตัวชี้วัด</span></div>${indicatorRows.slice(0,18).map(i => `<label class="cl-indicator-row"><input type="checkbox" value="${escapeHtml(i.code)}" ${selectedIndicatorCodes.includes(i.code) ? 'checked' : ''} onchange="toggleWorksheetIndicator(this.value,this.checked)"><strong>${escapeHtml(i.code)}</strong><span>${escapeHtml(i.text)}</span></label>`).join('') || '<div class="cl-indicator-empty">เลือกกลุ่มสาระและระดับชั้นเพื่อแสดงตัวชี้วัด</div>'}</div></div></div><h3>2. สิ่งที่ต้องการให้ใบงานช่วยจัดทำ</h3><p class="cl-form-note">กรอกเท่าที่รู้ ระบบจะไม่สร้างคำตอบหรือผลการเรียนของนักเรียนแทนข้อมูลจริง</p><div class="cl-form-grid"><label class="cl-field full"><span>สิ่งที่อยากให้นักเรียนทำหรือส่ง</span><textarea id="worksheet-output" class="form-control" rows="3" maxlength="1200" placeholder="เช่น วาดภาพเซลล์พร้อมอธิบายหน้าที่ของออร์แกเนลล์ด้วยภาษาของตนเอง">${escapeHtml(saved.learnerOutput || prefill.learnerOutput || '')}</textarea></label><label class="cl-field full"><span>อุปกรณ์หรือข้อจำกัดของห้องเรียน</span><textarea id="worksheet-resources" class="form-control" rows="2" maxlength="1000" placeholder="เช่น มีภาพตัวอย่างและกระดาษ A4 ไม่มีอุปกรณ์ทดลอง">${escapeHtml(saved.resources || prefill.resources || '')}</textarea></label><label class="cl-field full"><span>สิ่งที่ครูอยากเน้นเป็นพิเศษ</span><textarea id="worksheet-focus" class="form-control" rows="2" maxlength="1000" placeholder="เช่น ให้เด็กอธิบายจากหลักฐาน ไม่ตอบตามการจำ">${escapeHtml(saved.focus || prefill.focus || '')}</textarea></label></div><div class="cl-context-card"><i class="hgi-stroke hgi-information-circle"></i><span>ระบบจะส่งกรอบที่ครูกำหนดไปยัง API เพื่อสร้างร่างใบงาน 1 ครั้ง ครูตรวจและแก้ไขได้ก่อนบันทึก</span></div><div class="cl-actions"><button class="btn" type="button" onclick="closeWorksheetCreator()">ยกเลิก</button><button class="btn btn-primary" type="button" onclick="generateWorksheetDraft()"><i class="hgi-stroke hgi-ai-magic"></i> สร้างร่างใบงาน</button></div></section></div>`;
  }
  function ensureWorksheetProcessingOverlay() { if (document.getElementById('worksheet-processing-overlay')) return; const overlay = document.createElement('div'); overlay.id = 'worksheet-processing-overlay'; overlay.className = 'cl-processing'; overlay.setAttribute('role','status'); overlay.innerHTML = '<div class="cl-processing-card"><div class="cl-processing-spinner"></div><h3>AI กำลังจัดทำร่างใบงาน</h3><p>กำลังเรียบเรียงคำชี้แจง ขั้นตอน และพื้นที่ทำงาน<br>กรุณารอสักครู่ และไม่ต้องกดซ้ำ</p></div>'; document.body.appendChild(overlay); }
  window.generateWorksheetDraft = async function () {
    const room = selectedClass();
    const title = document.getElementById('worksheet-title')?.value.trim() || '';
    const indicators = selectedWorksheetIndicators();
    const worksheetType = state.worksheetType || document.getElementById('worksheet-type')?.value || 'questions';
    if (!room) { showToast('กรุณาเลือกห้องเรียนก่อนสร้างใบงาน', 'warning'); return; }
    if (title.length < 3) { showToast('กรุณาระบุชื่อใบงาน', 'warning'); return; }
    if (!indicators.length) { showToast('กรุณาเลือกตัวชี้วัดอย่างน้อย 1 ข้อ', 'warning'); return; }
    const payload = { title, worksheetType, worksheetTypeLabel:worksheetFormat(worksheetType).label, classId:room.id, classLabel:`${room.subject} · ${room.className}`, subject:room.subject, grade:gradeLabel(state.grade), topic:state.worksheetPrefill?.topic || title, activityType:document.getElementById('worksheet-activity-type')?.value || '', duration:document.getElementById('worksheet-duration')?.value || '', indicators:indicators.map(row => ({ code:row.code, text:row.text })), workMode:document.getElementById('worksheet-work-mode')?.value || state.worksheetWorkMode, itemCount:document.getElementById('worksheet-item-count')?.value || state.worksheetItemCount, difficulty:document.getElementById('worksheet-difficulty')?.value || state.worksheetDifficulty, visuals:document.getElementById('worksheet-visuals')?.value || state.worksheetVisuals, answerSpace:document.getElementById('worksheet-answer-space')?.value || state.worksheetAnswerSpace, answerKey:document.getElementById('worksheet-answer-key')?.value || state.worksheetAnswerKey, learnerOutput:document.getElementById('worksheet-output')?.value.trim() || '', resources:document.getElementById('worksheet-resources')?.value.trim() || '', focus:document.getElementById('worksheet-focus')?.value.trim() || '', lessonPlanId:state.worksheetPrefill?.lessonPlanId || '' };
    ensureWorksheetProcessingOverlay(); document.getElementById('worksheet-processing-overlay')?.classList.add('show');
    try { const session = await supabaseClient?.auth?.getSession(); const token = session?.data?.session?.access_token; const response = await fetch(apiPath('/api/ai/generate-worksheet'), { method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) }, body:JSON.stringify(payload) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.message || result.error || 'ไม่สามารถสร้างใบงานได้'); state.worksheetDraft = { ...payload, id:uid(), createdAt:new Date().toISOString(), worksheet:result.worksheet, warnings:Array.isArray(result.warnings) ? result.warnings : [] }; state.worksheetDraftOrigin = 'new'; state.worksheetEditing = false; state.worksheetView = 'review'; render(); } catch (error) { console.warn('Worksheet generation failed:', error); showToast(`สร้างใบงานไม่สำเร็จ: ${error.message || 'กรุณาลองใหม่'}`, 'warning', 7000); } finally { document.getElementById('worksheet-processing-overlay')?.classList.remove('show'); }
  };
  function worksheetListHtml(items) { return Array.isArray(items) ? `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : `<p>${escapeHtml(items || 'ยังไม่ได้ระบุ')}</p>`; }
  function decorateWorksheetPreview(root) {
    if (state.worksheetDraft?.worksheet?.version === 2) {
      root.querySelectorAll('.cl-worksheet-preview').forEach(preview => { preview.innerHTML = WorksheetLayout.html(state.worksheetDraft, state.worksheetEditing); });
      return;
    }
    const type = state.worksheetDraft?.worksheetType || state.worksheetPrefill?.worksheetType || state.worksheetType || 'questions';
    const labels = {
      questions: ['คำชี้แจง', 'โจทย์หรือคำถาม', 'วิธีทำ / ขั้นตอน', 'ภารกิจที่ต้องทำ', 'ช่องคำตอบของนักเรียน', 'สิ่งที่ต้องส่ง', 'แนวทางตรวจ'],
      table: ['คำชี้แจง', 'ข้อมูลหรือรายการที่ใช้ทำงาน', 'วิธีทำ / ขั้นตอน', 'ตาราง / ภารกิจจำแนกข้อมูล', 'คำตอบหรือข้อสรุปจากตาราง', 'สิ่งที่ต้องส่ง', 'แนวทางตรวจ'],
      inquiry: ['คำชี้แจงและคำถามนำ', 'สถานการณ์หรือโจทย์การสำรวจ', 'ขั้นตอนการทดลอง / สำรวจ', 'ภารกิจและตารางบันทึกผล', 'วิเคราะห์และสรุปผล', 'สิ่งที่ต้องส่ง', 'แนวทางตรวจ']
    }[type] || [];
    root.querySelectorAll('.cl-worksheet-grid article h3').forEach((heading, index) => { if (labels[index]) heading.textContent = labels[index]; });
    root.querySelectorAll('.cl-worksheet-preview').forEach(preview => preview.classList.toggle(`cl-worksheet-format-${type}`, true));
  }
  function worksheetFieldLabel(field) { return ({ directions:'คำชี้แจง', context:'สถานการณ์หรือโจทย์กิจกรรม', steps:'ขั้นตอนการทำงาน', tasks:'ภารกิจ/คำถามชี้นำ', responseAreas:'สิ่งที่นักเรียนต้องทำหรือบันทึก', submission:'ชิ้นงานที่ต้องส่ง', assessmentCriteria:'เกณฑ์หรือแนวทางประเมิน' }[field] || field); }
  function worksheetEditField(field, value) { return `<label class="cl-plan-edit-field"><span>${worksheetFieldLabel(field)}</span><small>เขียนแยกข้อด้วยการขึ้นบรรทัดใหม่</small><textarea class="form-control" rows="5" oninput="setWorksheetField('${field}', this.value)">${escapeHtml(Array.isArray(value) ? value.join('\n') : value || '')}</textarea></label>`; }
  function worksheetReviewHtml() { const d = state.worksheetDraft; if (!d?.worksheet) return worksheetFormHtml(); const w = d.worksheet; const editing = state.worksheetEditing; return `<div class="cl-wizard cl-worksheet-wizard"><div class="cl-wizard-top"><button class="btn" type="button" onclick="leaveWorksheetReview()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับคลัง</span></button><div class="cl-wizard-title"><span class="cl-create-icon worksheet"><i class="hgi-stroke hgi-note-02"></i></span><div><h2>${editing ? 'แก้ไขใบงาน' : 'ตรวจร่างใบงาน'}</h2><p>${escapeHtml(d.classLabel)} · ${escapeHtml(d.title)}</p></div></div></div><div class="cl-stepper"><span class="cl-step"><b>1</b> กำหนดกรอบ</span><span class="cl-step active"><b>2</b> ${editing ? 'แก้ไขใบงาน' : 'ตรวจร่าง'}</span><span class="cl-step"><b>3</b> บันทึกเข้าคลัง</span></div>${d.warnings?.length ? `<div class="cl-quality-warning"><i class="hgi-stroke hgi-alert-02"></i><div><strong>ข้อควรตรวจสอบ</strong><p>${d.warnings.map(escapeHtml).join('<br>')}</p></div></div>` : ''}<section class="card cl-worksheet-preview"><header><span class="cl-saved-type cl-worksheet-type"><i class="hgi-stroke hgi-note-02"></i> ${editing ? 'แก้ไขได้' : 'ร่างโดย AI'}</span><h2>${escapeHtml(w.title || d.title)}</h2><p>${escapeHtml(d.classLabel)} · ${escapeHtml(d.activityType)} · ${escapeHtml(d.duration)}</p></header>${editing ? `<div class="cl-plan-edit-grid">${['directions','context','steps','tasks','responseAreas','submission','assessmentCriteria'].map(field => worksheetEditField(field, w[field])).join('')}</div>` : `<div class="cl-worksheet-grid"><article><h3>คำชี้แจง</h3>${worksheetListHtml(w.directions)}</article><article><h3>สถานการณ์หรือโจทย์กิจกรรม</h3>${worksheetListHtml(w.context)}</article><article><h3>ขั้นตอนการทำงาน</h3>${worksheetListHtml(w.steps)}</article><article><h3>ภารกิจ/คำถามชี้นำ</h3>${worksheetListHtml(w.tasks)}</article><article><h3>สิ่งที่นักเรียนต้องทำหรือบันทึก</h3>${worksheetListHtml(w.responseAreas)}</article><article><h3>ชิ้นงานที่ต้องส่ง</h3>${worksheetListHtml(w.submission)}</article><article class="cl-worksheet-wide"><h3>เกณฑ์หรือแนวทางประเมินสำหรับครู</h3>${worksheetListHtml(w.assessmentCriteria)}</article></div>`}</section><div class="cl-review-bottom"><span>${editing ? 'แก้ไขข้อมูลแล้วกดบันทึกเข้าคลังได้ทันที' : 'ใบงานนี้เป็นร่าง ครูควรตรวจความเหมาะสมก่อนนำไปใช้'}</span><div class="cl-actions">${editing ? `<button class="btn" type="button" onclick="toggleWorksheetEditing()">เสร็จสิ้นการแก้ไข</button>` : `<button class="btn" type="button" onclick="toggleWorksheetEditing()"><i class="hgi-stroke hgi-edit-02"></i> แก้ไขใบงาน</button>`}<button class="btn btn-primary" type="button" onclick="saveWorksheetDraft()"><i class="hgi-stroke hgi-floppy-disk"></i> บันทึกเข้าคลัง</button></div></div></div>`; }
  function worksheetDetailHtml() { const d = state.worksheetDraft; if (!d?.worksheet) { state.worksheetView = 'home'; return homeHtml(); } const w = d.worksheet; return `<div class="cl-wizard cl-worksheet-detail"><div class="cl-wizard-top"><button class="btn" type="button" onclick="closeWorksheetCreator()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับคลัง</span></button><div class="cl-wizard-title"><span class="cl-create-icon worksheet"><i class="hgi-stroke hgi-note-02"></i></span><div><h2>รายละเอียดใบงาน</h2><p>ตรวจแก้ ส่งออก หรือเชื่อมใบงานกับแผนการสอนได้จากหน้านี้</p></div></div></div><section class="card cl-plan-detail-head"><div><span class="cl-saved-type cl-worksheet-type"><i class="hgi-stroke hgi-note-02"></i> ใบงานในคลัง</span><h2>${escapeHtml(w.title || d.title)}</h2><p>${escapeHtml(d.classLabel)} · ${escapeHtml(d.activityType)} · ${escapeHtml(d.duration)}</p><div class="cl-detail-indicators">${(d.indicators || []).map(item => `<span>${escapeHtml(item.code)}</span>`).join('')}</div></div><div class="cl-detail-actions"><button class="btn cl-export-btn word" type="button" data-export-worksheet="word" onclick="exportWorksheetDocx()"><i class="hgi-stroke hgi-file-download"></i> ส่งออก Word</button><button class="btn btn-primary" type="button" onclick="editSavedWorksheet()"><i class="hgi-stroke hgi-edit-02"></i> แก้ไขใบงาน</button></div></section><section class="card cl-worksheet-preview cl-worksheet-detail-preview"><div class="cl-worksheet-grid"><article><h3>คำชี้แจง</h3>${worksheetListHtml(w.directions)}</article><article><h3>สถานการณ์หรือโจทย์กิจกรรม</h3>${worksheetListHtml(w.context)}</article><article><h3>ขั้นตอนการทำงาน</h3>${worksheetListHtml(w.steps)}</article><article><h3>ภารกิจ/คำถามชี้นำ</h3>${worksheetListHtml(w.tasks)}</article><article><h3>สิ่งที่นักเรียนต้องทำหรือบันทึก</h3>${worksheetListHtml(w.responseAreas)}</article><article><h3>ชิ้นงานที่ต้องส่ง</h3>${worksheetListHtml(w.submission)}</article><article class="cl-worksheet-wide"><h3>เกณฑ์หรือแนวทางประเมินสำหรับครู</h3>${worksheetListHtml(w.assessmentCriteria)}</article></div></section></div>`; }
  window.setWorksheetField = function (field, value) { if (!state.worksheetDraft?.worksheet) return; state.worksheetDraft.worksheet[field] = String(value || '').split('\n').map(item => item.trim()).filter(Boolean); };
  window.setWorksheetBlockField = function (path, value) {
    const w = state.worksheetDraft?.worksheet;
    if (!w || w.version !== 2) return;
    if (path === 'title') { w.title = value; state.worksheetDraft.title = value; return; }
    if (path === 'directions') { w.directions = value.split('\n').filter(Boolean); return; }
    const parts = path.split('.');
    let target = w.blocks[Number(parts.shift())];
    while (target && parts.length > 1) target = target[parts.shift()];
    const key = parts[0];
    if (target && key === 'drawingItems' && Array.isArray(target.items)) {
      const prompts = String(value || '').split('\n').map(item => item.trim()).filter(Boolean);
      target.items = prompts.map((prompt, index) => ({ prompt, fields:target.items[index]?.fields || [] }));
      return;
    }
    if (target && Object.prototype.hasOwnProperty.call(target,key) && target[key] !== null) target[key] = ['leftItems','rightItems'].includes(key) ? String(value || '').split('\n').map(item => item.trim()).filter(Boolean) : value;
  };
  window.toggleWorksheetEditing = function () { state.worksheetEditing = !state.worksheetEditing; render(); };
  window.leaveWorksheetReview = function () { if (state.worksheetDraftOrigin === 'new' && !window.confirm('ใบงานนี้ยังไม่ได้บันทึกเข้าคลัง ต้องการกลับคลังและทิ้งร่างนี้หรือไม่?')) return; closeWorksheetCreator(); };
  window.editSavedWorksheet = function () { state.worksheetEditing = true; state.worksheetView = 'review'; render(); };
  window.saveWorksheetDraft = function () { if (!state.worksheetDraft?.worksheet) { showToast('ยังไม่มีร่างใบงาน', 'warning'); return; } if (state.worksheetDraft.worksheet.version === 2) { try { state.worksheetDraft.worksheet = WorksheetLayout.normalize(state.worksheetDraft.worksheet, state.worksheetDraft); } catch (error) { showToast(error.message, 'warning'); return; } } const savedWorksheet = { ...state.worksheetDraft, status:'draft', type:'worksheet' }; let linkedPlan = null; appState.mediaLibrary = library().filter(item => item.id !== savedWorksheet.id).map(item => { if (item.id !== savedWorksheet.lessonPlanId || item.type !== 'lesson_plan') return item; linkedPlan = { ...item, linkedWorksheetIds:[...new Set([...(Array.isArray(item.linkedWorksheetIds) ? item.linkedWorksheetIds : []), savedWorksheet.id])] }; return linkedPlan; }); appState.mediaLibrary.push(savedWorksheet); saveState(); if (linkedPlan) { state.lessonDraft = clone(linkedPlan); state.lessonDraftOrigin = 'saved'; state.lessonView = 'detail'; state.worksheetView = 'home'; state.worksheetDraft = null; state.worksheetPrefill = null; state.worksheetEditing = false; render(); showToast('บันทึกใบงานและเชื่อมกับแผนแล้ว'); return; } state.worksheetDraft = clone(savedWorksheet); state.worksheetDraftOrigin = 'saved'; state.worksheetView = 'detail'; state.worksheetEditing = false; render(); showToast('บันทึกใบงานเข้าคลังแล้ว'); };
  window.openSavedWorksheet = function (id) { const worksheet = library().find(item => item.id === id && item.type === 'worksheet'); if (!worksheet) { showToast('ไม่พบใบงานนี้', 'warning'); return; } state.worksheetDraft = clone(worksheet); state.worksheetDraftOrigin = 'saved'; state.worksheetEditing = false; state.worksheetView = 'detail'; render(); };

  window.openLessonPlanCreator = function () { state.view = 'home'; state.worksheetView = 'home'; state.lessonView = 'form'; state.lessonDraft = null; state.lessonDraftOrigin = 'new'; state.lessonEditing = false; state.lessonQuizLinkOpen = false; state.lessonWorksheetLinkOpen = false; state.lessonIndicatorCodes = []; render(); };
  window.closeLessonPlanCreator = function () { state.view = 'home'; state.worksheetView = 'home'; state.lessonView = 'home'; state.lessonDraft = null; state.lessonDraftOrigin = 'new'; state.lessonEditing = false; state.lessonQuizLinkOpen = false; state.lessonWorksheetLinkOpen = false; render(); };
  window.backToLessonLibrary = function () { state.view = 'home'; state.worksheetView = 'home'; state.lessonView = 'home'; state.lessonDraft = null; state.lessonDraftOrigin = 'new'; state.lessonEditing = false; state.lessonQuizLinkOpen = false; state.lessonWorksheetLinkOpen = false; render(); };
  window.setLessonClass = function (value) { state.selectedClassId = value; const room = selectedClass(); state.subjectId = subjectIdFromName(room?.subject); state.grade = String(room?.gradeLevel || ''); state.lessonIndicatorCodes = []; render(); };
  window.setLessonSubject = function (value) { state.subjectId = value; state.lessonIndicatorCodes = []; render(); };
  window.setLessonGrade = function (value) { state.grade = value; state.lessonIndicatorCodes = []; render(); };
  window.toggleLessonIndicator = function (code, checked) { state.lessonIndicatorCodes = checked ? [...new Set([...state.lessonIndicatorCodes, code])] : state.lessonIndicatorCodes.filter(item => item !== code); };
  function selectedLessonIndicators() { const cat = catalog(); if (!cat || !state.subjectId) return []; const rows = cat.search({ subjectId:state.subjectId, grade:state.grade.toUpperCase(), standardId:'all' }); return rows.filter(row => state.lessonIndicatorCodes.includes(row.code)); }
  function selectedLessonSubjectName() { const cat = catalog(); return cat?.subjects?.find(item => item.id === state.subjectId)?.name || selectedClass()?.subject || ''; }
  function lessonFormHtml() {
    const saved = state.lessonDraft || {}; const savedIndicators = Array.isArray(saved.indicators) ? saved.indicators.map(item => item.code) : [];
    const selectedIndicatorCodes = state.lessonIndicatorCodes.length ? state.lessonIndicatorCodes : savedIndicators;
    const room = selectedClass(); const cat = catalog();
    const subjectOptions = (cat?.subjects || []).filter(s => s.available).map(s => `<option value="${escapeHtml(s.id)}" ${s.id === state.subjectId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
    const grades = state.subjectId && cat ? cat.getGrades(state.subjectId) : [];
    const indicatorRows = state.subjectId && cat ? cat.search({ subjectId:state.subjectId, grade:state.grade.toUpperCase(), standardId:'all' }) : [];
    return `<div class="cl-wizard cl-lesson-wizard"><div class="cl-wizard-top"><button class="btn" type="button" onclick="closeLessonPlanCreator()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับคลัง</span></button><div class="cl-wizard-title"><span class="cl-create-icon lesson-plan"><i class="hgi-stroke hgi-presentation-01"></i></span><div><h2>สร้างแผนการสอน</h2><p>กำหนดกรอบสำคัญ แล้วให้ AI ช่วยเติมร่างแผน</p></div></div></div>
      <div class="cl-stepper" aria-label="ขั้นตอนการสร้างแผน"><span class="cl-step active"><b>1</b> กำหนดกรอบ</span><span class="cl-step"><b>2</b> ตรวจร่าง</span><span class="cl-step"><b>3</b> บันทึกเข้าคลัง</span></div>
      <section class="card cl-form-card"><h3>1. ข้อมูลพื้นฐาน</h3><p class="cl-form-note">ครูเลือกห้องเรียน กลุ่มสาระ ระดับชั้น หัวข้อ และตัวชี้วัดเอง ระบบจะใช้กรอบนี้เท่านั้นในการสร้างร่าง</p><div class="cl-form-grid">
        <label class="cl-field full"><span>ห้องเรียน <em class="cl-required">*</em></span><select id="lesson-class" class="form-control" onchange="setLessonClass(this.value)"><option value="">เลือกห้องเรียน</option>${classes().map(c => `<option value="${escapeHtml(c.id)}" ${c.id === state.selectedClassId ? 'selected' : ''}>${escapeHtml(c.subject)} · ${escapeHtml(c.className)}</option>`).join('')}</select></label>
        <label class="cl-field"><span>กลุ่มสาระ</span><select class="form-control" onchange="setLessonSubject(this.value)"><option value="">เลือกกลุ่มสาระ</option>${subjectOptions}</select></label>
        <label class="cl-field"><span>ระดับชั้น</span><select class="form-control" onchange="setLessonGrade(this.value)"><option value="">ไม่ระบุ</option>${grades.map(g => `<option value="${escapeHtml(g)}" ${g.toLowerCase() === state.grade.toLowerCase() ? 'selected' : ''}>${gradeLabel(g.toLowerCase())}</option>`).join('')}</select></label>
        <label class="cl-field full"><span>หัวข้อบทเรียน <em class="cl-required">*</em></span><input id="lesson-topic" class="form-control" maxlength="240" value="${escapeHtml(saved.topic || '')}" placeholder="เช่น การถ่ายทอดลักษณะทางพันธุกรรม"></label>
        <label class="cl-field"><span>เวลาเรียน</span><select id="lesson-duration" class="form-control">${['1 คาบ (50 นาที)','2 คาบ (100 นาที)','3 คาบ (150 นาที)','ปรับเอง'].map(value => `<option ${value === saved.duration ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
        <label class="cl-field"><span>รูปแบบการเรียนรู้</span><select id="lesson-method" class="form-control">${['สืบเสาะหาความรู้','ลงมือปฏิบัติ','ร่วมมือกันเรียนรู้','ใช้ปัญหาเป็นฐาน','ผสมผสาน'].map(value => `<option ${value === saved.method ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      </div><div class="cl-form-grid"><div class="cl-field full"><span>ตัวชี้วัด/ผลการเรียนรู้ <small>(เลือกได้หลายข้อ)</small></span><div class="cl-indicator-table" role="group" aria-label="เลือกตัวชี้วัดสำหรับแผนการสอน"><div class="cl-indicator-table-head"><span></span><span>รหัส</span><span>รายละเอียดตัวชี้วัด</span></div>${indicatorRows.slice(0,18).map(i => `<label class="cl-indicator-row"><input type="checkbox" value="${escapeHtml(i.code)}" ${selectedIndicatorCodes.includes(i.code) ? 'checked' : ''} onchange="toggleLessonIndicator(this.value,this.checked)"><strong>${escapeHtml(i.code)}</strong><span>${escapeHtml(i.text)}</span></label>`).join('') || '<div class="cl-indicator-empty">เลือกกลุ่มสาระและระดับชั้นเพื่อแสดงตัวชี้วัด</div>'}</div></div></div>
      <h3>2. บริบทที่ต้องการให้ AI นำไปใช้</h3><p class="cl-form-note">กรอกเท่าที่รู้ ระบบจะไม่สร้างข้อมูลผลการเรียนแทนข้อมูลจริง</p><div class="cl-form-grid"><label class="cl-field full"><span>ลักษณะผู้เรียน/ปัญหาที่พบ</span><textarea id="lesson-learners" class="form-control" rows="3" maxlength="1600" placeholder="เช่น นักเรียนยังสับสนเรื่อง... หรือมีพื้นฐานแตกต่างกัน">${escapeHtml(saved.learnerContext || '')}</textarea></label><label class="cl-field full"><span>อุปกรณ์หรือข้อจำกัดของห้องเรียน</span><textarea id="lesson-resources" class="form-control" rows="2" maxlength="1000" placeholder="เช่น มีอุปกรณ์ทดลอง 5 ชุด ใช้โทรศัพท์ได้บางส่วน">${escapeHtml(saved.resources || '')}</textarea></label><label class="cl-field full"><span>สิ่งที่ครูอยากเน้นเป็นพิเศษ</span><textarea id="lesson-focus" class="form-control" rows="2" maxlength="1000" placeholder="เช่น เน้นการอธิบายด้วยหลักฐาน และให้มีการประเมินระหว่างเรียน">${escapeHtml(saved.focus || '')}</textarea></label></div>
      <div class="cl-context-card"><i class="hgi-stroke hgi-information-circle"></i><span>ระบบจะส่งเฉพาะกรอบที่ครูกำหนดไปยัง API เพื่อสร้างร่างแผน 1 ครั้ง ครูตรวจและแก้ไขได้ก่อนบันทึก ไม่มีการกำหนดวันใช้แผนหรือบังคับใช้กับห้องเรียน</span></div><div class="cl-actions"><button class="btn" type="button" onclick="closeLessonPlanCreator()">ยกเลิก</button><button class="btn btn-primary" type="button" onclick="generateLessonPlanDraft()"><i class="hgi-stroke hgi-ai-magic"></i> สร้างร่างแผน</button></div></section></div>`;
  }
  function lessonProcessing(show) { document.getElementById('lesson-processing-overlay')?.classList.toggle('show', show); }
  function ensureLessonProcessingOverlay() { if (document.getElementById('lesson-processing-overlay')) return; const overlay = document.createElement('div'); overlay.id = 'lesson-processing-overlay'; overlay.className = 'cl-processing'; overlay.setAttribute('role','status'); overlay.innerHTML = '<div class="cl-processing-card"><div class="cl-processing-spinner"></div><h3>AI กำลังจัดทำร่างแผน</h3><p>กำลังเรียบเรียงกิจกรรมและการประเมินให้ตรงกับกรอบที่เลือก<br>กรุณารอสักครู่ และไม่ต้องกดซ้ำ</p></div>'; document.body.appendChild(overlay); }
  window.generateLessonPlanDraft = async function () {
    const room = selectedClass(); const topic = document.getElementById('lesson-topic')?.value.trim() || ''; const indicators = selectedLessonIndicators(); const subjectName = selectedLessonSubjectName(); const grade = gradeLabel(state.grade);
    if (!room) { showToast('กรุณาเลือกห้องเรียนก่อนสร้างแผน', 'warning'); return; }
    if (!subjectName || !state.grade) { showToast('กรุณาเลือกกลุ่มสาระและระดับชั้น', 'warning'); return; }
    if (topic.length < 3) { showToast('กรุณาระบุหัวข้อบทเรียน', 'warning'); return; }
    if (!indicators.length) { showToast('กรุณาเลือกตัวชี้วัดอย่างน้อย 1 ข้อ', 'warning'); return; }
    const payload = { title:topic, classId:room.id, classLabel:`${subjectName} · ${room.className}`, subject:subjectName, grade, topic, duration:document.getElementById('lesson-duration')?.value || '', method:document.getElementById('lesson-method')?.value || '', indicators:indicators.map(row => ({ code:row.code, text:row.text })), learnerContext:document.getElementById('lesson-learners')?.value.trim() || '', resources:document.getElementById('lesson-resources')?.value.trim() || '', focus:document.getElementById('lesson-focus')?.value.trim() || '' };
    ensureLessonProcessingOverlay(); lessonProcessing(true);
    try { const session = await supabaseClient?.auth?.getSession(); const token = session?.data?.session?.access_token; const response = await fetch('/api/ai/generate-lesson-plan', { method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) }, body:JSON.stringify(payload) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.message || result.error || 'ไม่สามารถสร้างแผนการสอนได้'); state.lessonDraft = { ...payload, id:uid(), createdAt:new Date().toISOString(), plan:result.plan, warnings:Array.isArray(result.warnings) ? result.warnings : [] }; state.lessonDraftOrigin = 'new'; state.lessonEditing = false; state.lessonView = 'review'; render(); } catch (error) { console.warn('Lesson plan generation failed:', error); showToast(`สร้างแผนไม่สำเร็จ: ${error.message || 'กรุณาลองใหม่'}`, 'warning', 7000); } finally { lessonProcessing(false); }
  };
  function listHtml(items) { return Array.isArray(items) ? `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : `<p>${escapeHtml(items || 'ยังไม่ได้ระบุ')}</p>`; }
  function lessonEditField(field, value) { return `<label class="cl-plan-edit-field"><span>${field === 'keyConcepts' ? 'สาระสำคัญ' : field === 'objectives' ? 'จุดประสงค์การเรียนรู้' : field === 'activities' ? 'ขั้นตอนกิจกรรม' : field === 'resources' ? 'สื่อและแหล่งเรียนรู้' : field === 'assessment' ? 'การวัดและประเมินผล' : field === 'evidence' ? 'หลักฐานที่ควรเก็บ' : 'คำแนะนำการปรับใช้'}</span><small>เขียนแยกข้อด้วยการขึ้นบรรทัดใหม่</small><textarea class="form-control" rows="5" oninput="setLessonPlanField('${field}', this.value)">${escapeHtml(Array.isArray(value) ? value.join('\n') : value || '')}</textarea></label>`; }
  function lessonMetaEditHtml(d, p) { return `<div class="cl-plan-meta-edit"><label class="cl-field full"><span>ชื่อแผนการสอน</span><input class="form-control" maxlength="240" value="${escapeHtml(p.title || d.title || d.topic || '')}" oninput="setLessonPlanTitle(this.value)"></label><label class="cl-field"><span>หัวข้อบทเรียน</span><input class="form-control" maxlength="240" value="${escapeHtml(d.topic || '')}" oninput="setLessonMetaField('topic', this.value)"></label><label class="cl-field"><span>เวลาเรียน</span><input class="form-control" maxlength="80" value="${escapeHtml(d.duration || '')}" oninput="setLessonMetaField('duration', this.value)"></label><label class="cl-field"><span>รูปแบบการเรียนรู้</span><input class="form-control" maxlength="120" value="${escapeHtml(d.method || '')}" oninput="setLessonMetaField('method', this.value)"></label></div>`; }
  function lessonReviewHtml() { const d = state.lessonDraft; if (!d) return lessonFormHtml(); const p = d.plan || {}; const editing = state.lessonEditing; return `<div class="cl-wizard cl-lesson-wizard"><div class="cl-wizard-top"><button class="btn" type="button" onclick="leaveLessonPlanReview()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับคลัง</span></button><div class="cl-wizard-title"><span class="cl-create-icon lesson-plan"><i class="hgi-stroke hgi-presentation-01"></i></span><div><h2>${editing ? 'แก้ไขแผนการสอน' : 'ตรวจร่างแผนการสอน'}</h2><p>${escapeHtml(d.classLabel)} · ${escapeHtml(d.topic)}</p></div></div></div><div class="cl-stepper"><span class="cl-step"><b>1</b> กำหนดกรอบ</span><span class="cl-step active"><b>2</b> ${editing ? 'แก้ไขแผน' : 'ตรวจร่าง'}</span><span class="cl-step"><b>3</b> บันทึกเข้าคลัง</span></div>${d.warnings?.length ? `<div class="cl-quality-warning"><i class="hgi-stroke hgi-alert-02"></i><div><strong>ข้อควรตรวจสอบ</strong><p>${d.warnings.map(escapeHtml).join('<br>')}</p></div></div>` : ''}<section class="card cl-plan-preview"><header><span class="cl-saved-type cl-plan-type"><i class="hgi-stroke hgi-presentation-01"></i> ${editing ? 'แก้ไขได้' : 'ร่างโดย AI'}</span><h2>${escapeHtml(p.title || d.topic)}</h2><p>${escapeHtml(d.classLabel)} · ${escapeHtml(d.duration)} · ${escapeHtml(d.method)}</p></header>${editing ? `${lessonMetaEditHtml(d,p)}<div class="cl-plan-edit-grid">${lessonEditField('keyConcepts',p.keyConcepts)}${lessonEditField('objectives',p.objectives)}${lessonEditField('activities',p.activities)}${lessonEditField('resources',p.resources)}${lessonEditField('assessment',p.assessment)}${lessonEditField('evidence',p.evidence)}${lessonEditField('adaptations',p.adaptations)}</div>` : `<div class="cl-plan-grid"><article><h3>สาระสำคัญ</h3>${listHtml(p.keyConcepts)}</article><article><h3>จุดประสงค์การเรียนรู้</h3>${listHtml(p.objectives)}</article><article><h3>ขั้นตอนกิจกรรม</h3>${listHtml(p.activities)}</article><article><h3>สื่อและแหล่งเรียนรู้</h3>${listHtml(p.resources)}</article><article><h3>การวัดและประเมินผล</h3>${listHtml(p.assessment)}</article><article><h3>หลักฐานที่ควรเก็บ</h3>${listHtml(p.evidence)}</article><article class="cl-plan-wide"><h3>คำแนะนำการปรับใช้</h3>${listHtml(p.adaptations)}</article></div>`}</section><div class="cl-review-bottom"><span>${editing ? 'แก้ไขข้อมูลแล้วกดบันทึกเข้าคลังได้ทันที' : 'แผนนี้เป็นร่าง ครูตรวจและแก้ไขก่อนบันทึกได้'}</span><div class="cl-actions">${editing ? `<button class="btn" type="button" onclick="toggleLessonPlanEditing()">เสร็จสิ้นการแก้ไข</button>` : `<button class="btn" type="button" onclick="toggleLessonPlanEditing()"><i class="hgi-stroke hgi-edit-02"></i> แก้ไขแผน</button>`}<button class="btn btn-primary" type="button" onclick="saveLessonPlanDraft()"><i class="hgi-stroke hgi-floppy-disk"></i> บันทึกเข้าคลัง</button></div></div></div>`; }
  window.setLessonPlanField = function (field, value) { if (!state.lessonDraft?.plan) return; state.lessonDraft.plan[field] = String(value || '').split('\n').map(item => item.trim()).filter(Boolean); };
  window.setLessonPlanTitle = function (value) { if (!state.lessonDraft?.plan) return; const title = String(value || '').trim(); state.lessonDraft.plan.title = title; state.lessonDraft.title = title || state.lessonDraft.topic || ''; };
  window.setLessonMetaField = function (field, value) { if (!state.lessonDraft) return; state.lessonDraft[field] = String(value || '').trim(); };
  window.toggleLessonPlanEditing = function () { state.lessonEditing = !state.lessonEditing; render(); };
  window.leaveLessonPlanReview = function () { if (state.lessonDraftOrigin === 'new' && !window.confirm('แผนนี้ยังไม่ได้บันทึกเข้าคลัง ต้องการกลับคลังและทิ้งร่างนี้หรือไม่?')) return; closeLessonPlanCreator(); };
  window.backToLessonSettings = function () { state.lessonIndicatorCodes = Array.isArray(state.lessonDraft?.indicators) ? state.lessonDraft.indicators.map(item => item.code) : []; state.lessonView = 'form'; render(); };
  window.saveLessonPlanDraft = function () { if (!state.lessonDraft?.plan) { showToast('ยังไม่มีร่างแผนการสอน', 'warning'); return; } const cleanTitle = String(state.lessonDraft.plan.title || state.lessonDraft.title || state.lessonDraft.topic || '').trim(); if (!cleanTitle) { showToast('กรุณาระบุชื่อแผนการสอน', 'warning'); return; } const savedPlan = { ...state.lessonDraft, title:cleanTitle, plan:{ ...state.lessonDraft.plan, title:cleanTitle }, status:'draft', type:'lesson_plan', linkedQuizIds:Array.isArray(state.lessonDraft.linkedQuizIds) ? state.lessonDraft.linkedQuizIds : [], linkedWorksheetIds:Array.isArray(state.lessonDraft.linkedWorksheetIds) ? state.lessonDraft.linkedWorksheetIds : [] }; delete savedPlan.runs; appState.mediaLibrary = library().filter(item => item.id !== savedPlan.id); appState.mediaLibrary.push(savedPlan); saveState(); state.lessonDraft = typeof structuredClone === 'function' ? structuredClone(savedPlan) : JSON.parse(JSON.stringify(savedPlan)); state.lessonDraftOrigin = 'saved'; state.lessonView = 'detail'; state.lessonEditing = false; render(); showToast('บันทึกแผนเข้าคลังแล้ว'); };
  window.openSavedLessonPlan = function (id) { const plan = library().find(item => item.id === id && item.type === 'lesson_plan'); if (!plan) { showToast('ไม่พบแผนการสอนนี้', 'warning'); return; } state.lessonDraft = typeof structuredClone === 'function' ? structuredClone(plan) : JSON.parse(JSON.stringify(plan)); state.lessonDraftOrigin = 'saved'; state.lessonEditing = false; state.lessonView = 'detail'; render(); };
  function clone(value) { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
  function saveLessonPlan(plan) { const savedPlan = { ...plan, title:plan.plan?.title || plan.title || plan.topic || 'แผนการสอน', type:'lesson_plan', status:plan.status || 'draft' }; delete savedPlan.runs; appState.mediaLibrary = library().some(item => item.id === savedPlan.id) ? library().map(item => item.id === savedPlan.id ? savedPlan : item) : [...library(), savedPlan]; saveState(); state.lessonDraft = clone(savedPlan); }
  function linkedLessonQuizzes(plan) { const ids = Array.isArray(plan.linkedQuizIds) ? plan.linkedQuizIds : []; return library().filter(item => item.type === 'quiz' && ids.includes(item.id)); }
  function linkedLessonWorksheets(plan) { const ids = Array.isArray(plan.linkedWorksheetIds) ? plan.linkedWorksheetIds : []; return library().filter(item => item.type === 'worksheet' && ids.includes(item.id)); }
  function lessonDetailHtml() {
    const d = state.lessonDraft;
    if (!d?.plan) { state.lessonView = 'home'; return homeHtml(); }
    const p = d.plan; const quizzes = linkedLessonQuizzes(d); const worksheets = linkedLessonWorksheets(d);
    const quizList = quizzes.length ? quizzes.map(quiz => `<button class="cl-plan-linked-item" type="button" onclick="openQuizDetail('${escapeHtml(quiz.id)}')"><span class="cl-saved-type"><i class="hgi-stroke hgi-task-02"></i> ข้อสอบ</span><strong>${escapeHtml(quiz.title || 'ข้อสอบไม่มีชื่อ')}</strong><small>${Number(quiz.questions?.length || 0)} ข้อ · เปิดรายละเอียด</small><i class="hgi-stroke hgi-arrow-right-01"></i></button>`).join('') : '<div class="cl-plan-empty-link"><i class="hgi-stroke hgi-task-02"></i><span>ยังไม่ได้เชื่อมแบบทดสอบกับแผนนี้</span></div>';
    const worksheetList = worksheets.length ? worksheets.map(item => `<button class="cl-plan-linked-item worksheet" type="button" onclick="openSavedWorksheet('${escapeHtml(item.id)}')"><span class="cl-saved-type cl-worksheet-type"><i class="hgi-stroke hgi-note-02"></i> ใบงาน</span><strong>${escapeHtml(item.title || 'ใบงานไม่มีชื่อ')}</strong><small>${escapeHtml(item.activityType || 'กิจกรรม')} · เปิดรายละเอียด</small><i class="hgi-stroke hgi-arrow-right-01"></i></button>`).join('') : '<div class="cl-plan-empty-link"><i class="hgi-stroke hgi-note-02"></i><span>ยังไม่ได้เชื่อมใบงานกับแผนนี้</span></div>';
    return `<div class="cl-wizard cl-lesson-detail"><div class="cl-wizard-top"><button class="btn" type="button" onclick="backToLessonLibrary()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับคลัง</span></button><div class="cl-wizard-title"><span class="cl-create-icon lesson-plan"><i class="hgi-stroke hgi-presentation-01"></i></span><div><h2>รายละเอียดแผนการสอน</h2><p>จัดการแผนและสื่อที่เกี่ยวข้องได้จากหน้านี้</p></div></div></div><section class="card cl-plan-detail-head"><div><span class="cl-saved-type cl-plan-type"><i class="hgi-stroke hgi-presentation-01"></i> แผนการสอน</span><h2>${escapeHtml(p.title || d.topic || 'แผนการสอนไม่มีชื่อ')}</h2><p>${escapeHtml(d.classLabel || 'ยังไม่ได้เชื่อมห้องเรียน')} · ${escapeHtml(d.duration || 'ไม่ระบุเวลา')} · ${escapeHtml(d.method || 'ไม่ระบุรูปแบบ')}</p><div class="cl-detail-indicators">${(d.indicators || []).map(item => `<span>${escapeHtml(item.code)}</span>`).join('')}</div></div><div class="cl-detail-actions"><button class="btn cl-export-btn word" type="button" data-export-plan="word" onclick="exportLessonPlanDocx()"><i class="hgi-stroke hgi-file-download"></i> ส่งออกแผน</button><button class="btn btn-primary cl-export-btn pack" type="button" data-export-plan="pack" onclick="exportLessonPackDocx()"><i class="hgi-stroke hgi-files-01"></i> ส่งออกชุดเอกสารประกอบคาบ</button><button class="btn" type="button" onclick="editSavedLessonPlan()"><i class="hgi-stroke hgi-edit-02"></i> แก้ไขแผน</button></div></section><section class="card cl-plan-detail-section cl-plan-assets-section"><div class="cl-plan-section-head"><div><h3>สื่อและการประเมินที่เชื่อมกับแผน</h3><p>ข้อสอบและใบงานแยกเป็นคนละส่วน เพื่อให้ครูเลือกใช้ได้ตามความเหมาะสม</p></div></div><div class="cl-plan-asset-group"><div class="cl-plan-section-head"><div><h4><i class="hgi-stroke hgi-task-02"></i> แบบทดสอบ</h4><p>ข้อสอบที่บันทึกไว้ในคลังและเชื่อมกับแผนนี้</p></div><div class="cl-plan-section-actions"><button class="btn" type="button" onclick="openLessonQuizLinks()"><i class="hgi-stroke hgi-link-01"></i> เลือกข้อสอบจากคลัง</button><button class="btn btn-primary" type="button" onclick="createQuizFromLessonPlan()"><i class="hgi-stroke hgi-ai-magic"></i> สร้างข้อสอบจากแผน</button></div></div><div class="cl-plan-linked-list">${quizList}</div></div><div class="cl-plan-asset-group"><div class="cl-plan-section-head"><div><h4><i class="hgi-stroke hgi-note-02"></i> ใบงาน</h4><p>ใบงานที่บันทึกไว้ในคลังและเชื่อมกับแผนนี้</p></div><div class="cl-plan-section-actions"><button class="btn" type="button" onclick="openLessonWorksheetLinks()"><i class="hgi-stroke hgi-link-01"></i> เลือกใบงานจากคลัง</button><button class="btn btn-primary" type="button" onclick="createWorksheetFromLessonPlan()"><i class="hgi-stroke hgi-ai-magic"></i> สร้างใบงานจากแผน</button></div></div><div class="cl-plan-linked-list">${worksheetList}</div></div></section><section class="card cl-plan-preview cl-plan-detail-preview"><header><h3>เนื้อหาแผน</h3><p>รายละเอียดสำหรับตรวจทานหรือส่งออกเป็นเอกสาร Word</p></header><div class="cl-plan-grid"><article><h3>สาระสำคัญ</h3>${listHtml(p.keyConcepts)}</article><article><h3>จุดประสงค์การเรียนรู้</h3>${listHtml(p.objectives)}</article><article><h3>ขั้นตอนกิจกรรม</h3>${listHtml(p.activities)}</article><article><h3>สื่อและแหล่งเรียนรู้</h3>${listHtml(p.resources)}</article><article><h3>การวัดและประเมินผล</h3>${listHtml(p.assessment)}</article><article><h3>หลักฐานที่ควรเก็บ</h3>${listHtml(p.evidence)}</article></div></section>${lessonQuizLinkModal(d)}${lessonWorksheetLinkModal(d)}</div>`;
  }
  function lessonQuizLinkModal(plan) { if (!state.lessonQuizLinkOpen) return ''; const quizzes = library().filter(item => item.type === 'quiz'); const selected = Array.isArray(plan.linkedQuizIds) ? plan.linkedQuizIds : []; return `<div class="cl-detail-edit-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-quiz-link-title"><div class="cl-detail-edit-dialog"><div class="cl-detail-edit-dialog-head"><div><span class="cl-saved-type cl-plan-type"><i class="hgi-stroke hgi-link-01"></i> สื่อที่เชื่อม</span><h3 id="lesson-quiz-link-title">เชื่อมแบบทดสอบกับแผน</h3></div><button class="cl-modal-close" type="button" onclick="closeLessonQuizLinks()" aria-label="ปิด"><i class="hgi-stroke hgi-cancel-01"></i></button></div><div class="cl-detail-edit-form"><p class="cl-modal-note">เลือกข้อสอบที่ใช้ประกอบแผนนี้ได้หลายชุด ข้อสอบต้นฉบับยังอยู่ในคลังตามเดิม</p><div class="cl-link-picker">${quizzes.length ? quizzes.map(quiz => `<label><input type="checkbox" name="lesson-linked-quiz" value="${escapeHtml(quiz.id)}" ${selected.includes(quiz.id) ? 'checked' : ''}><span><strong>${escapeHtml(quiz.title || 'ข้อสอบไม่มีชื่อ')}</strong><small>${escapeHtml(quiz.classLabel || 'ยังไม่ระบุห้อง')} · ${Number(quiz.questions?.length || 0)} ข้อ</small></span></label>`).join('') : '<div class="cl-empty-library">ยังไม่มีข้อสอบในคลัง สร้างข้อสอบจากแผนนี้ได้เลย</div>'}</div></div><div class="cl-detail-edit-dialog-actions"><button class="btn" type="button" onclick="closeLessonQuizLinks()">ยกเลิก</button><button class="btn btn-primary" type="button" onclick="saveLessonPlanQuizLinks()"><i class="hgi-stroke hgi-floppy-disk"></i> บันทึกการเชื่อม</button></div></div></div>`; }
  function lessonWorksheetLinkModal(plan) { if (!state.lessonWorksheetLinkOpen) return ''; const worksheets = library().filter(item => item.type === 'worksheet'); const selected = Array.isArray(plan.linkedWorksheetIds) ? plan.linkedWorksheetIds : []; return `<div class="cl-detail-edit-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-worksheet-link-title"><div class="cl-detail-edit-dialog"><div class="cl-detail-edit-dialog-head"><div><span class="cl-saved-type cl-worksheet-type"><i class="hgi-stroke hgi-link-01"></i> สื่อที่เชื่อม</span><h3 id="lesson-worksheet-link-title">เชื่อมใบงานกับแผน</h3></div><button class="cl-modal-close" type="button" onclick="closeLessonWorksheetLinks()" aria-label="ปิด"><i class="hgi-stroke hgi-cancel-01"></i></button></div><div class="cl-detail-edit-form"><p class="cl-modal-note">เลือกใบงานที่ใช้ประกอบแผนนี้ได้หลายใบ ใบงานต้นฉบับยังอยู่ในคลังตามเดิม</p><div class="cl-link-picker">${worksheets.length ? worksheets.map(item => `<label><input type="checkbox" name="lesson-linked-worksheet" value="${escapeHtml(item.id)}" ${selected.includes(item.id) ? 'checked' : ''}><span><strong>${escapeHtml(item.title || 'ใบงานไม่มีชื่อ')}</strong><small>${escapeHtml(item.classLabel || 'ยังไม่ระบุห้อง')} · ${escapeHtml(item.activityType || 'กิจกรรม')}</small></span></label>`).join('') : '<div class="cl-empty-library">ยังไม่มีใบงานในคลัง สร้างใบงานจากแผนนี้ได้เลย</div>'}</div></div><div class="cl-detail-edit-dialog-actions"><button class="btn" type="button" onclick="closeLessonWorksheetLinks()">ยกเลิก</button><button class="btn btn-primary" type="button" onclick="saveLessonPlanWorksheetLinks()"><i class="hgi-stroke hgi-floppy-disk"></i> บันทึกการเชื่อม</button></div></div></div>`; }
  window.editSavedLessonPlan = function () { state.lessonEditing = true; state.lessonView = 'review'; render(); };
  window.openLessonQuizLinks = function () { state.lessonQuizLinkOpen = true; render(); };
  window.closeLessonQuizLinks = function () { state.lessonQuizLinkOpen = false; render(); };
  window.saveLessonPlanQuizLinks = function () { const plan = state.lessonDraft; if (!plan) return; const linkedQuizIds = [...document.querySelectorAll('input[name="lesson-linked-quiz"]:checked')].map(input => input.value); saveLessonPlan({ ...plan, linkedQuizIds }); state.lessonQuizLinkOpen = false; render(); showToast('บันทึกการเชื่อมข้อสอบแล้ว'); };
  window.openLessonWorksheetLinks = function () { state.lessonWorksheetLinkOpen = true; render(); };
  window.closeLessonWorksheetLinks = function () { state.lessonWorksheetLinkOpen = false; render(); };
  window.saveLessonPlanWorksheetLinks = function () { const plan = state.lessonDraft; if (!plan) return; const linkedWorksheetIds = [...document.querySelectorAll('input[name="lesson-linked-worksheet"]:checked')].map(input => input.value); saveLessonPlan({ ...plan, linkedWorksheetIds }); state.lessonWorksheetLinkOpen = false; render(); showToast('บันทึกการเชื่อมใบงานแล้ว'); };
  window.createQuizFromLessonPlan = function () { const plan = state.lessonDraft; if (!plan) return; state.selectedClassId = plan.classId || state.selectedClassId; state.subjectId = subjectIdFromName(plan.subject || selectedClass()?.subject); state.grade = gradeIdFromLabel(selectedClass()?.gradeLevel || plan.grade || state.grade); state.standardId = 'all'; state.indicatorCodes = (plan.indicators || []).map(item => item.code); state.quizPrefill = { source:plan.topic || plan.title || '', title:`แบบทดสอบหลังเรียน เรื่อง ${plan.topic || plan.title || ''}`.trim(), instructions:`อ้างอิงแผนการสอน “${plan.title || plan.topic || ''}” และตัวชี้วัดที่เลือก`, lessonPlanId:plan.id }; state.lessonView = 'home'; state.view = 'quiz'; render(); };
  window.createWorksheetFromLessonPlan = function () { const plan = state.lessonDraft; if (!plan) return; state.selectedClassId = plan.classId || state.selectedClassId; state.subjectId = subjectIdFromName(plan.subject || selectedClass()?.subject); state.grade = gradeIdFromLabel(selectedClass()?.gradeLevel || plan.grade || state.grade); state.worksheetIndicatorCodes = (plan.indicators || []).map(item => item.code); state.worksheetPrefill = { title:`ใบงานเรื่อง ${plan.topic || plan.title || ''}`.trim(), topic:plan.topic || plan.title || '', classId:plan.classId, indicators:plan.indicators || [], activityType:'สืบค้นและรวบรวมข้อมูล', lessonPlanId:plan.id, resources:Array.isArray(plan.plan?.resources) ? plan.plan.resources.join('\n') : '', focus:Array.isArray(plan.plan?.assessment) ? plan.plan.assessment.join('\n') : '' }; state.lessonView = 'home'; state.worksheetView = 'form'; render(); };
  window.openQuizCreator = function () { state.worksheetView = 'home'; state.lessonView = 'home'; state.view = 'quiz'; state.draft = null; state.quizPrefill = null; state.quizReturnPlanId = ''; render(); };
  window.closeQuizCreator = function () { const returnPlanId = state.quizPrefill?.lessonPlanId || state.quizReturnPlanId; const returnPlan = returnPlanId ? library().find(item => item.id === returnPlanId && item.type === 'lesson_plan') : null; state.view = 'home'; state.draft = null; state.quizPrefill = null; state.quizReturnPlanId = ''; if (returnPlan) { state.lessonDraft = clone(returnPlan); state.lessonDraftOrigin = 'saved'; state.lessonView = 'detail'; } render(); };
  window.openQuizDetail = function (id) {
    const quiz = library().find(item => item.id === id && item.type === 'quiz');
    if (!quiz) { showToast('ไม่พบข้อสอบชุดนี้', 'warning'); return; }
    state.quizReturnPlanId = state.lessonView === 'detail' ? state.lessonDraft?.id || '' : '';
    state.lessonView = 'home';
    state.worksheetView = 'home';
    state.draft = typeof structuredClone === 'function' ? structuredClone(quiz) : JSON.parse(JSON.stringify(quiz));
    state.detailEditing = false;
    state.editBaseline = '';
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
    const prefill = state.quizPrefill || {};
    const cat = catalog();
    const subjectOptions = (cat?.subjects || []).filter(s => s.available).map(s => `<option value="${escapeHtml(s.id)}" ${s.id === state.subjectId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
    const grades = state.subjectId && cat ? cat.getGrades(state.subjectId) : [];
    const standards = state.subjectId && cat ? cat.getStandards(state.subjectId, state.grade.toUpperCase()) : [];
    const indicatorRows = state.subjectId && cat ? cat.search({ subjectId:state.subjectId, grade:state.grade.toUpperCase(), standardId:state.standardId }) : [];
    const type = state.sourceType;
    const sourceField = type === 'topic'
      ? `<label class="cl-field full"><span>หัวข้อที่ต้องการออกข้อสอบ</span><input id="quiz-source" class="form-control" maxlength="500" value="${escapeHtml(prefill.source || '')}" placeholder="เช่น สมการเชิงเส้นสองตัวแปร"></label>`
      : `<label class="cl-field full"><span>เนื้อหาบทเรียน</span><textarea id="quiz-source" class="form-control" maxlength="12000" placeholder="วางเนื้อหาที่สอน หรือสรุปบทเรียนที่ต้องการให้ AI ใช้อ้างอิง...">${escapeHtml(prefill.source || '')}</textarea><small>AI จะสร้างข้อสอบจากข้อมูลที่ครูให้เท่านั้น และครูต้องตรวจทานก่อนใช้งาน</small></label>`;
    return `<div class="cl-wizard"><div class="cl-wizard-top"><div class="cl-wizard-title"><span class="cl-create-icon"><i class="hgi-stroke hgi-task-02"></i></span><div><h2>สร้างข้อสอบ</h2><p>เริ่มจากเลือกห้องเรียนและขอบเขตเนื้อหา</p></div></div><button class="btn" type="button" onclick="closeQuizCreator()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับคลัง</span></button></div>
      <div class="cl-stepper" aria-label="ขั้นตอนการสร้างข้อสอบ"><span class="cl-step active"><b>1</b> ตั้งค่าข้อสอบ</span><span class="cl-step"><b>2</b> ตรวจร่าง</span><span class="cl-step"><b>3</b> บันทึก/มอบหมาย</span></div>
      <section class="card cl-form-card"><h3>1. เลือกบริบทของข้อสอบ</h3><p class="cl-form-note">ข้อมูลห้องเรียนจะช่วยเติมวิชาและระดับชั้นให้โดยอัตโนมัติ</p><div class="cl-form-grid">
        <label class="cl-field full"><span>ห้องเรียน <em style="color:#d04b3f;font-style:normal">*</em></span><select id="quiz-class" class="form-control" onchange="setQuizClass(this.value)"><option value="">เลือกห้องเรียน</option>${classes().map(c => `<option value="${escapeHtml(c.id)}" ${c.id === state.selectedClassId ? 'selected' : ''}>${escapeHtml(c.subject)} · ${escapeHtml(c.className)}</option>`).join('')}</select></label>
        <label class="cl-field"><span>กลุ่มสาระ</span><select class="form-control" onchange="setQuizSubject(this.value)"><option value="">เลือกกลุ่มสาระ</option>${subjectOptions}</select></label>
        <label class="cl-field"><span>ระดับชั้น</span><select class="form-control" onchange="setQuizGrade(this.value)"><option value="">ไม่ระบุ</option>${grades.map(g => `<option value="${g}" ${g.toLowerCase() === state.grade.toLowerCase() ? 'selected' : ''}>${gradeLabel(g.toLowerCase())}</option>`).join('')}</select></label>
      </div>
        <div class="cl-form-grid"><label class="cl-field full"><span>มาตรฐานการเรียนรู้</span><select class="form-control" onchange="setQuizStandard(this.value)" ${standards.length ? '' : 'disabled'}><option value="all">${standards.length ? 'ทุกมาตรฐานที่เกี่ยวข้อง' : 'ยังไม่มีข้อมูลมาตรฐานสำหรับวิชา/ชั้นนี้'}</option>${standards.map(s => `<option value="${escapeHtml(s.id)}" ${s.id === state.standardId ? 'selected' : ''}>${escapeHtml(s.code)} · ${escapeHtml(s.title)}</option>`).join('')}</select></label>
        <div class="cl-field full"><span>ตัวชี้วัด/ผลการเรียนรู้ <small style="font-weight:600;color:var(--text-muted)">(เลือกได้หลายข้อ ไม่เลือกได้)</small></span><div class="cl-indicator-table" role="group" aria-label="เลือกรายการตัวชี้วัด"><div class="cl-indicator-table-head"><span></span><span>รหัส</span><span>รายละเอียดตัวชี้วัด</span></div>${indicatorRows.slice(0,18).map(i => `<label class="cl-indicator-row"><input type="checkbox" value="${escapeHtml(i.code)}" ${state.indicatorCodes.includes(i.code) ? 'checked' : ''} onchange="toggleQuizIndicator(this.value,this.checked)"><strong>${escapeHtml(i.code)}</strong><span>${escapeHtml(i.text)}</span></label>`).join('') || '<div class="cl-indicator-empty">ไม่พบตัวชี้วัดที่ตรงกับข้อมูลที่เลือก — คุณยังสร้างจากเนื้อหาได้</div>'}</div></div></div>
        <hr style="border:0;border-top:1px solid var(--border-color);margin:22px 0;">
        <h3>2. กำหนดข้อสอบ</h3><p class="cl-form-note">AI จะสร้างเป็นฉบับร่างเพื่อให้ครูตรวจแก้ก่อนบันทึก</p><div class="cl-source-tabs"><button class="cl-source-tab ${type === 'topic' ? 'active' : ''}" type="button" onclick="setQuizSource('topic')"><i class="hgi-stroke hgi-bulb"></i> จากหัวข้อ</button><button class="cl-source-tab ${type === 'text' ? 'active' : ''}" type="button" onclick="setQuizSource('text')"><i class="hgi-stroke hgi-text"></i> วางเนื้อหา</button></div>
        <div class="cl-form-grid">${sourceField}<label class="cl-field"><span>ชื่อข้อสอบ</span><input id="quiz-title" class="form-control" maxlength="160" value="${escapeHtml(prefill.title || '')}" placeholder="เช่น แบบทดสอบก่อนเรียน เรื่องสมการ"></label><label class="cl-field"><span>จำนวนข้อ</span><select id="quiz-count" class="form-control"><option value="5">5 ข้อ</option><option value="10" selected>10 ข้อ</option><option value="15">15 ข้อ</option></select></label><label class="cl-field"><span>ระดับความยาก</span><select id="quiz-difficulty" class="form-control"><option value="ง่าย">ง่าย</option><option value="ปานกลาง" selected>ปานกลาง</option><option value="ยาก">ยาก</option></select></label><div class="cl-field full"><span>ประเภทคำถาม</span><div class="cl-choices"><label class="cl-choice"><input type="checkbox" name="quiz-type" value="multiple_choice" checked> ปรนัย 4 ตัวเลือก</label><label class="cl-choice"><input type="checkbox" name="quiz-type" value="true_false"> ถูก / ผิด</label><label class="cl-choice"><input type="checkbox" name="quiz-type" value="short_answer"> คำตอบสั้น</label></div></div><label class="cl-field full"><span>คำสั่งเพิ่มเติม <small style="font-weight:600;color:var(--text-muted)">(ถ้ามี)</small></span><textarea id="quiz-instructions" class="form-control" maxlength="1200" placeholder="เช่น เน้นการคิดวิเคราะห์ ไม่ใช้โจทย์คำนวณยาว และมีคำอธิบายเฉลยทุกข้อ">${escapeHtml(prefill.instructions || '')}</textarea></label></div>
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
    const payload = { title, classId:room.id, classLabel:`${room.subject} · ${room.className}`, subject:room.subject, grade:gradeLabel(state.grade), sourceType:state.sourceType, source, questionCount:Number(document.getElementById('quiz-count')?.value || 10), types, difficulty:document.getElementById('quiz-difficulty')?.value || 'ปานกลาง', mode:'assessment', instructions:document.getElementById('quiz-instructions')?.value.trim() || '', indicators:selectedIndicators().map(row => ({ code:row.code, text:row.text })) };
    ensureProcessingOverlay(); processing(true);
    try {
      const session = await supabaseClient?.auth?.getSession();
      const token = session?.data?.session?.access_token;
      const response = await fetch('/api/ai/generate-quiz', { method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) }, body:JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || result.error || 'ไม่สามารถสร้างข้อสอบได้');
      state.draft = { ...payload, id:uid(), createdAt:new Date().toISOString(), lessonPlanId:state.quizPrefill?.lessonPlanId || '', questions:Array.isArray(result.questions) ? result.questions : [], qualityWarnings:Array.isArray(result.warnings) ? result.warnings : [] };
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
    const options = question.type === 'multiple_choice' ? `<div class="cl-option-list">${(question.options || []).map((option, optionIndex) => `<label class="cl-option"><input type="radio" name="answer-${index}" ${Number(question.answerIndex) === optionIndex ? 'checked' : ''} onchange="setQuizAnswer(${index},${optionIndex})"><input type="text" class="form-control" value="${escapeHtml(option)}" oninput="setQuizOption(${index},${optionIndex},this.value)"></label>`).join('')}</div>` : question.type === 'true_false' ? `<div class="cl-option-list"><label class="cl-option"><input type="radio" name="answer-${index}" ${question.answer === 'ถูก' ? 'checked' : ''} onchange="setQuizAnswerText(${index},'ถูก')"> ถูก</label><label class="cl-option"><input type="radio" name="answer-${index}" ${question.answer === 'ผิด' ? 'checked' : ''} onchange="setQuizAnswerText(${index},'ผิด')"> ผิด</label></div>` : `<label class="cl-field" style="margin-top:12px"><span>แนวคำตอบที่ยอมรับได้</span><input class="form-control" value="${escapeHtml(question.answer || '')}" oninput="setQuizAnswerText(${index},this.value)"></label>`;
    return `<article class="card cl-question-card"><div class="cl-question-head"><span class="cl-question-no"><b>${index + 1}</b> ${typeName}</span><div class="cl-question-tools"><button class="cl-icon-btn" type="button" onclick="deleteQuizQuestion(${index})" title="ลบข้อนี้" aria-label="ลบข้อนี้"><i class="hgi-stroke hgi-delete-02"></i></button></div></div><textarea class="form-control" oninput="setQuizPrompt(${index},this.value)">${escapeHtml(question.prompt || '')}</textarea>${options}<label class="cl-explanation"><strong>คำอธิบายเฉลยสำหรับครู</strong><textarea class="form-control" rows="3" maxlength="900" placeholder="AI จะอธิบายวิธีคำนวณหรือเหตุผลตามลักษณะของข้อนี้" oninput="setQuizExplanation(${index},this.value)">${escapeHtml(question.explanation || '')}</textarea></label></article>`;
  }
  function editHtml() {
    const quiz = state.draft;
    if (!quiz) { state.view = 'home'; return homeHtml(); }
    return `<div class="cl-wizard cl-edit-view"><div class="cl-wizard-top"><div class="cl-wizard-title"><span class="cl-create-icon"><i class="hgi-stroke hgi-edit-02"></i></span><div><h2>แก้ไขข้อสอบ</h2><p>แก้ไขรายละเอียด คำถาม ตัวเลือก และเฉลยของข้อสอบชุดนี้</p></div></div><button class="btn" type="button" onclick="cancelSavedQuizEdit()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับไปยังรายละเอียด</span></button></div><div class="cl-edit-toolbar"><span><i class="hgi-stroke hgi-information-circle"></i> การแก้ไขจะบันทึกทับข้อสอบชุดเดิมในคลัง</span><button class="btn btn-primary" type="button" onclick="saveSavedQuizEdits()"><i class="hgi-stroke hgi-floppy-disk"></i> บันทึกการแก้ไข</button></div><section class="card cl-edit-intro"><div class="cl-edit-section-heading"><div><span class="cl-saved-type"><i class="hgi-stroke hgi-task-02"></i> Quiz introduction</span><h3>ข้อมูลข้อสอบ</h3></div><span class="cl-edit-section-note">แก้ไขได้</span></div><div class="cl-edit-meta-grid"><label class="cl-field"><span>หัวข้อข้อสอบ</span><input id="edit-quiz-title" class="form-control" maxlength="160" value="${escapeHtml(quiz.title || '')}" oninput="setSavedQuizTitle(this.value)"></label><label class="cl-field"><span>คำอธิบาย</span><textarea id="edit-quiz-description" class="form-control" maxlength="1200" placeholder="อธิบายจุดประสงค์หรือเนื้อหาของข้อสอบ" oninput="setSavedQuizDescription(this.value)">${escapeHtml(quiz.description || '')}</textarea></label></div><p class="cl-edit-context">${escapeHtml(quiz.classLabel || 'ยังไม่ได้เชื่อมห้องเรียน')} · ${quiz.questions?.length || 0} ข้อ · ${quiz.mode === 'practice' ? 'โหมดฝึกฝน' : 'แบบทดสอบ'}</p></section><div class="cl-edit-questions-head"><div><h3>คำถาม</h3><p>ตรวจคำถาม ตัวเลือก และเฉลยให้ถูกต้องก่อนบันทึก</p></div><span>${quiz.questions?.length || 0} ข้อ</span></div><div class="cl-review-list">${(quiz.questions || []).map(questionHtml).join('') || '<div class="cl-empty-library">ข้อสอบนี้ยังไม่มีคำถาม</div>'}</div><div class="cl-edit-bottom"><button class="btn" type="button" onclick="cancelSavedQuizEdit()">ยกเลิก</button><button class="btn btn-primary" type="button" onclick="saveSavedQuizEdits()"><i class="hgi-stroke hgi-floppy-disk"></i> บันทึกการแก้ไข</button></div></div>`;
  }
  window.backToQuizSettings = function () { state.view = 'quiz'; render(); };
  window.setQuizPrompt = (index, value) => { state.draft.questions[index].prompt = value; };
  window.setQuizExplanation = (index, value) => { state.draft.questions[index].explanation = value; };
  window.setQuizOption = (index, optionIndex, value) => { state.draft.questions[index].options[optionIndex] = value; };
  window.setQuizAnswer = (index, answerIndex) => { state.draft.questions[index].answerIndex = answerIndex; };
  window.setQuizAnswerText = (index, answer) => { state.draft.questions[index].answer = answer; };
  window.setSavedQuizTitle = (value) => { if (state.draft) state.draft.title = value; };
  window.setSavedQuizDescription = (value) => { if (state.draft) state.draft.description = value; };
  function hasUnsavedSavedQuizEdits() {
    return state.view === 'edit' && !!state.editBaseline && JSON.stringify(state.draft) !== state.editBaseline;
  }
  function confirmDiscardSavedQuizEdits() {
    if (!hasUnsavedSavedQuizEdits()) return true;
    return window.confirm('มีการแก้ไขที่ยังไม่ได้บันทึก\n\nต้องการออกโดยไม่บันทึกการแก้ไขหรือไม่?');
  }
  window.addEventListener('beforeunload', (event) => {
    if (!hasUnsavedSavedQuizEdits()) return;
    event.preventDefault();
    event.returnValue = '';
  });
  window.deleteQuizQuestion = function (index) { state.draft.questions.splice(index, 1); render(); };
  window.saveQuizDraft = function () {
    if (!state.draft?.questions?.length) { showToast('ข้อสอบต้องมีอย่างน้อย 1 ข้อ', 'warning'); return; }
    appState.mediaLibrary = library().filter(item => item.id !== state.draft.id);
    appState.mediaLibrary.push({ ...state.draft, status:'draft', type:'quiz' });
    const lessonPlanId = state.draft.lessonPlanId;
    let linkedPlan = null;
    if (lessonPlanId) {
      appState.mediaLibrary = appState.mediaLibrary.map(item => {
        if (item.id !== lessonPlanId || item.type !== 'lesson_plan') return item;
        linkedPlan = { ...item, linkedQuizIds:[...new Set([...(Array.isArray(item.linkedQuizIds) ? item.linkedQuizIds : []), state.draft.id])] };
        return linkedPlan;
      });
    }
    saveState();
    state.view = 'home'; state.draft = null; state.quizPrefill = null;
    if (linkedPlan) { state.lessonDraft = clone(linkedPlan); state.lessonDraftOrigin = 'saved'; state.lessonView = 'detail'; render(); showToast('บันทึกข้อสอบและเชื่อมกับแผนแล้ว'); return; }
    render(); showToast('บันทึกข้อสอบเข้าคลังแล้ว');
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
    root.querySelector('.cl-detail-edit-modal')?.remove();
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
    root.insertAdjacentHTML('beforeend', `<div class="cl-detail-edit-modal" role="dialog" aria-modal="true" aria-labelledby="detail-edit-title"><div class="cl-detail-edit-dialog"><div class="cl-detail-edit-dialog-head"><div><span class="cl-saved-type"><i class="hgi-stroke hgi-edit-02"></i> แก้ไขข้อสอบ</span><h3 id="detail-edit-title">แก้ไขรายละเอียด</h3></div><button class="cl-modal-close" type="button" onclick="cancelQuizDetails()" aria-label="ปิดหน้าต่างแก้ไข"><i class="hgi-stroke hgi-cancel-01"></i></button></div><div class="cl-detail-edit-form"><label>หัวข้อข้อสอบ<input id="detail-title" class="form-control" maxlength="160" value="${escapeHtml(quiz.title || '')}"></label><label>คำอธิบาย<textarea id="detail-description" class="form-control" maxlength="1200" placeholder="เช่น แบบทดสอบทบทวนเรื่องแรงและการเคลื่อนที่">${escapeHtml(quiz.description || '')}</textarea></label></div><div class="cl-detail-edit-dialog-actions"><button class="btn" type="button" onclick="cancelQuizDetails()">ยกเลิก</button><button class="btn btn-primary" type="button" onclick="saveQuizDetails()"><i class="hgi-stroke hgi-floppy-disk"></i> บันทึกข้อมูล</button></div></div></div>`);
    const modal = root.querySelector('.cl-detail-edit-modal');
    modal?.addEventListener('click', event => {
      if (event.target === modal) window.cancelQuizDetails();
    });
    document.getElementById('detail-title')?.focus();
  }
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && state.view === 'detail' && state.detailEditing) {
      event.preventDefault();
      window.cancelQuizDetails();
    }
  });
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
  window.editSavedQuiz = function () { state.detailEditing = false; state.editBaseline = JSON.stringify(state.draft); state.view = 'edit'; render(); };
  window.cancelSavedQuizEdit = function () { if (!confirmDiscardSavedQuizEdits()) return; state.detailEditing = false; state.editBaseline = ''; state.view = 'detail'; render(); };
  window.saveSavedQuizEdits = function () {
    if (!state.draft?.questions?.length) { showToast('ข้อสอบต้องมีอย่างน้อย 1 ข้อ', 'warning'); return; }
    const title = document.getElementById('edit-quiz-title')?.value.trim();
    if (!title) { showToast('กรุณาระบุหัวข้อข้อสอบ', 'warning'); return; }
    state.draft.title = title;
    state.draft.description = document.getElementById('edit-quiz-description')?.value.trim() || '';
    appState.mediaLibrary = library().map(item => item.id === state.draft.id ? { ...state.draft, status:'draft', type:'quiz' } : item);
    saveState(); state.view = 'detail'; state.detailEditing = false; state.editBaseline = ''; render(); showToast('บันทึกการแก้ไขข้อสอบแล้ว');
  };
  window.deleteSavedLibraryItem = function (event, id) {
    event?.stopPropagation();
    const item = library().find(row => row.id === id);
    if (!item) { showToast('ไม่พบสื่อนี้ในคลัง', 'warning'); return; }
    const labels = { quiz:'ข้อสอบ', worksheet:'ใบงาน', lesson_plan:'แผนการสอน' };
    const label = labels[item.type] || 'สื่อนี้';
    if (!confirm(`ต้องการลบ${label} “${item.title || 'ไม่มีชื่อ'}” ออกจากคลังหรือไม่?`)) return;
    appState.mediaLibrary = library().filter(row => row.id !== id).map(row => {
      if (row.type !== 'lesson_plan') return row;
      if (item.type === 'quiz') return { ...row, linkedQuizIds:Array.isArray(row.linkedQuizIds) ? row.linkedQuizIds.filter(linkId => linkId !== id) : [] };
      if (item.type === 'worksheet') return { ...row, linkedWorksheetIds:Array.isArray(row.linkedWorksheetIds) ? row.linkedWorksheetIds.filter(linkId => linkId !== id) : [] };
      return row;
    });
    saveState();
    if (state.draft?.id === id) { state.draft = null; state.view = 'home'; }
    if (state.lessonDraft?.id === id) { state.lessonDraft = null; state.lessonView = 'home'; }
    if (state.worksheetDraft?.id === id) { state.worksheetDraft = null; state.worksheetView = 'home'; }
    render(); showToast(`ลบ${label}ออกจากคลังแล้ว`);
  };
  window.deleteSavedQuiz = function () {
    if (!state.draft) return;
    window.deleteSavedLibraryItem(null, state.draft.id);
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
  window.exportLessonPlanDocx = async function () {
    const plan = state.lessonDraft;
    if (!plan?.plan) { showToast('ไม่พบข้อมูลแผนการสอนสำหรับส่งออก', 'warning'); return; }
    const button = document.querySelector('[data-export-plan="word"]');
    const oldHtml = button?.innerHTML;
    if (button) { button.disabled = true; button.innerHTML = '<i class="hgi-stroke hgi-loading-03"></i> กำลังสร้าง Word...'; }
    try {
      const session = await supabaseClient?.auth?.getSession();
      const token = session?.data?.session?.access_token;
      const response = await fetch('/api/exports/lesson-plan-docx', { method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) }, body:JSON.stringify({ lessonPlan:plan }) });
      if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || 'ไม่สามารถสร้างไฟล์ Word ได้'); }
      const blob = await response.blob(); const safeName = String(plan.plan.title || plan.topic || 'แผนการสอน').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
      const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = `${safeName}.docx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
      showToast('ดาวน์โหลดไฟล์ Word แล้ว แก้ไขต่อใน Microsoft Word ได้ทันที');
    } catch (error) { showToast(`ส่งออก Word ไม่สำเร็จ: ${error.message || 'กรุณาลองใหม่'}`, 'warning', 7000); }
    finally { if (button) { button.disabled = false; button.innerHTML = oldHtml; } }
  };
  window.exportLessonPackDocx = async function () {
    const plan = state.lessonDraft;
    if (!plan?.plan) { showToast('ไม่พบข้อมูลแผนการสอนสำหรับส่งออกชุดเอกสาร', 'warning'); return; }
    const button = document.querySelector('[data-export-plan="pack"]');
    const oldHtml = button?.innerHTML;
    if (button) { button.disabled = true; button.innerHTML = '<i class="hgi-stroke hgi-loading-03"></i> กำลังรวมเอกสาร...'; }
    try {
      const session = await supabaseClient?.auth?.getSession();
      const token = session?.data?.session?.access_token;
      const worksheets = linkedLessonWorksheets(plan);
      const quizzes = linkedLessonQuizzes(plan);
      const response = await fetch('/api/exports/lesson-pack-docx', { method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) }, body:JSON.stringify({ lessonPlan:plan, worksheets, quizzes }) });
      if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || 'ไม่สามารถสร้างชุดเอกสาร Word ได้'); }
      const blob = await response.blob(); const safeName = String(plan.plan.title || plan.topic || 'แผนการสอน').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
      const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = `${safeName} - ชุดเอกสารประกอบคาบ.docx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
      showToast(`ดาวน์โหลดชุดเอกสารแล้ว (${worksheets.length} ใบงาน, ${quizzes.length} ข้อสอบ)`);
    } catch (error) { showToast(`ส่งออกชุดเอกสารไม่สำเร็จ: ${error.message || 'กรุณาลองใหม่'}`, 'warning', 7000); }
    finally { if (button) { button.disabled = false; button.innerHTML = oldHtml; } }
  };
  window.exportWorksheetDocx = async function () {
    const worksheet = state.worksheetDraft;
    if (!worksheet?.worksheet) { showToast('ไม่พบข้อมูลใบงานสำหรับส่งออก', 'warning'); return; }
    const button = document.querySelector('[data-export-worksheet="word"]');
    const oldHtml = button?.innerHTML;
    if (button) { button.disabled = true; button.innerHTML = '<i class="hgi-stroke hgi-loading-03"></i> กำลังสร้าง Word...'; }
    try {
      const session = await supabaseClient?.auth?.getSession();
      const token = session?.data?.session?.access_token;
      const response = await fetch('/api/exports/worksheet-docx', { method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) }, body:JSON.stringify({ worksheet }) });
      if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || 'ไม่สามารถสร้างไฟล์ Word ได้'); }
      const blob = await response.blob(); const safeName = String(worksheet.worksheet.title || worksheet.title || 'ใบงาน').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
      const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = `${safeName}.docx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
      showToast('ดาวน์โหลดไฟล์ Word แล้ว แก้ไขต่อได้ทันที');
    } catch (error) { showToast(`ส่งออก Word ไม่สำเร็จ: ${error.message || 'กรุณาลองใหม่'}`, 'warning', 7000); }
    finally { if (button) { button.disabled = false; button.innerHTML = oldHtml; } }
  };
})();
