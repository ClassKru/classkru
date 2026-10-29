// ==================== คลังสื่อการสอน / AI Quiz ====================
// AI สร้าง "ฉบับร่าง" เท่านั้น ครูตรวจและแก้ไขก่อนบันทึกหรือมอบหมายเสมอ
(function () {
  'use strict';

  const state = {
    view: 'home',
    sourceType: 'topic',
    quizQuestionCount: '10',
    selectedClassId: '',
    creationContextOptional: false,
    subjectId: '',
    grade: '',
    standardId: 'all',
    indicatorCodes: [],
    lessonIndicatorCodes: [],
    lessonView: 'home',
    lessonDraft: null,
    lessonForm: {},
    lessonDraftOrigin: 'new',
    lessonEditing: false,
    lessonPlanNumberManual: false,
    lessonQuizLinkOpen: false,
    lessonWorksheetLinkOpen: false,
    lessonMediaAssetsPlanId: '',
    lessonMediaAssets: [],
    lessonMediaAssetsError: '',
    lessonMediaAssetsLoadingFor: '',
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
    aiQuota: null,
    aiGenerating: false,
    draft: null,
    detailEditing: false,
    editBaseline: '',
    libraryTab: 'all',
    libraryQuery: ''
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  const uid = () => globalThis.crypto?.randomUUID?.() || `quiz_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const gradeLabel = (value) => ({ p1:'ป.1',p2:'ป.2',p3:'ป.3',p4:'ป.4',p5:'ป.5',p6:'ป.6',m1:'ม.1',m2:'ม.2',m3:'ม.3',m4:'ม.4',m5:'ม.5',m6:'ม.6' }[String(value || '').toLowerCase()] || value || 'ไม่ระบุ');
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
  function indicatorReference(row, subjectId = state.subjectId) {
    const subject = catalog()?.getSubject(subjectId);
    return {
      id: row.id || '',
      code: row.code || '',
      text: row.text || '',
      subjectId: subjectId || '',
      standardId: row.standard || '',
      unitId: row.unitId || '',
      grade: row.grade || '',
      sourceId: subject?.dataset?.source?.id || ''
    };
  }
  function subjectIdFromName(name) {
    const text = String(name || '').toLowerCase();
    if (text.includes('แนะแนว')) return 'guidance';
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
  function lessonFormValue(key, fallback = '') {
    if (Object.prototype.hasOwnProperty.call(state.lessonForm || {}, key)) return state.lessonForm[key];
    return state.lessonDraft?.[key] ?? fallback;
  }
  function captureLessonForm() {
    const ids = ['lesson-course-name','lesson-course-code','lesson-semester','lesson-academic-year','lesson-unit-number','lesson-unit-name','lesson-unit-objective','lesson-year-objective','lesson-unit-hours','lesson-plan-number','lesson-class-sections','lesson-teacher-name','lesson-teacher-code','lesson-topic','lesson-method','lesson-learners','lesson-resource-context','lesson-focus','lesson-standard-override'];
    const next = { ...(state.lessonForm || {}) };
    const keyMap = { 'lesson-learners':'learnerContext', 'lesson-resource-context':'resourceContext' };
    ids.forEach(id => { const element = document.getElementById(id); if (element) next[keyMap[id] || id.replace(/^lesson-/,'').replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = element.value; });
    const duration = document.getElementById('lesson-duration');
    if (duration) next.durationChoice = duration.value;
    const customDuration = document.getElementById('lesson-duration-custom');
    if (customDuration) next.durationMinutes = customDuration.value;
    const planNumber = document.getElementById('lesson-plan-number');
    if (planNumber) next.planNumberManual = planNumber.dataset.manual === 'true';
    state.lessonForm = next;
  }
  function lessonPlanScope(data = {}) {
    const course = String(data.courseCode || data.courseName || data.subjectId || data.subject || '').trim().toLocaleLowerCase();
    return [course, String(data.academicYear || ''), String(data.semester || '')].join('|');
  }
  function lessonUnitScopeKey(data = {}) {
    if (data.subjectId !== 'guidance' || (!String(data.unitNumber || '').trim() && !String(data.unitName || '').trim())) return '';
    return [String(data.courseCode || data.courseName || data.subjectId || '').trim().toLocaleLowerCase(), String(data.grade || '').trim().toLocaleLowerCase(), String(data.academicYear || ''), String(data.semester || '1'), String(data.unitNumber || '').trim().toLocaleLowerCase(), String(data.unitName || '').trim().toLocaleLowerCase()].join('|');
  }
  function nextLessonPlanNumber(data = {}) {
    const scope = lessonPlanScope(data);
    const numbers = library().filter(item => item.type === 'lesson_plan' && lessonPlanScope(item) === scope)
      .map(item => Number(item.planNumber)).filter(number => Number.isInteger(number) && number > 0);
    return (numbers.length ? Math.max(...numbers) : 0) + 1;
  }
  function formatLessonDuration(minutes) {
    const total = Math.max(0, Number(minutes) || 0);
    if (!total) return '';
    const hours = Math.floor(total / 60); const remainder = total % 60;
    if (!hours) return `${total} นาที`;
    return remainder ? `${hours} ชั่วโมง ${remainder} นาที` : `${hours} ชั่วโมง`;
  }
  function lessonNumberSeed() {
    const room = selectedClass(); const year = lessonFormValue('academicYear', room?.academicYear || new Date().getFullYear() + 543);
    const semester = lessonFormValue('semester', '1');
    return { subjectId:state.subjectId, subject:catalog()?.getSubject(state.subjectId)?.name || room?.subject || '', courseCode:lessonFormValue('courseCode'), courseName:lessonFormValue('courseName'), academicYear:year, semester };
  }
  function lessonStandardRows(indicators = selectedLessonIndicators()) {
    const cat = catalog(); const seen = new Set();
    return indicators.map(item => cat?.getStandard(state.subjectId, item.standardId || item.standard))
      .filter(item => item && !seen.has(item.id) && seen.add(item.id));
  }
  function lessonStandardHtml(standards = lessonStandardRows()) {
    return standards.length
      ? standards.map(item => `<div class="cl-learning-standard-item"><strong>${escapeHtml(item.code)}</strong><span>${escapeHtml(item.title)}</span></div>`).join('')
      : '<p class="cl-learning-standard-empty">เลือกตัวชี้วัดเพื่อแสดงมาตรฐานที่เกี่ยวข้อง</p>';
  }
  function updateLessonStandardSummary() {
    const holder = document.getElementById('lesson-standard-summary');
    if (holder) holder.innerHTML = lessonStandardHtml();
  }
  window.setLessonDurationPreset = function (value) {
    const custom = document.getElementById('lesson-duration-custom-wrap');
    if (custom) custom.hidden = value !== 'custom';
    if (value === 'custom') document.getElementById('lesson-duration-custom')?.focus();
  };
  window.refreshLessonPlanNumber = function () {
    const input = document.getElementById('lesson-plan-number');
    if (!input || input.dataset.manual === 'true') return;
    const value = id => document.getElementById(id)?.value;
    input.value = String(nextLessonPlanNumber({ ...lessonNumberSeed(), courseCode:value('lesson-course-code') || '', courseName:value('lesson-course-name') || '', academicYear:value('lesson-academic-year') || '', semester:value('lesson-semester') || '' }));
  };
  window.setLessonPlanNumberManual = function () {
    const input = document.getElementById('lesson-plan-number');
    if (input) input.dataset.manual = 'true';
    state.lessonPlanNumberManual = true;
  };
  function apiPath(path) { return window.location.protocol === 'file:' ? `https://classkru-kohl.vercel.app${path}` : path; }
  function applyAiQuota(quota) {
    if (!quota || typeof quota !== 'object') return;
    const rawLimit = Number(quota.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 15;
    const rawUsed = quota.used == null ? 0 : Number(quota.used);
    const used = Number.isFinite(rawUsed) ? Math.max(rawUsed, 0) : 0;
    const rawRemaining = quota.remaining == null ? limit - used : Number(quota.remaining);
    const remaining = Number.isFinite(rawRemaining) ? Math.max(rawRemaining, 0) : Math.max(limit - used, 0);
    state.aiQuota = { limit, used, remaining, date:String(quota.date || '') };
  }
  function aiQuotaHtml() {
    const quota = state.aiQuota;
    if (quota?.error) return `<div class="cl-ai-quota is-warning" role="status"><i class="hgi-stroke hgi-alert-02"></i><span>${escapeHtml(quota.error)}</span></div>`;
    if (!quota) return '<div class="cl-ai-quota is-loading" role="status"><i class="hgi-stroke hgi-loading-03"></i><span>กำลังตรวจสอบโควตาการสร้าง AI...</span></div>';
    const empty = quota.remaining <= 0;
    return `<div class="cl-ai-quota ${empty ? 'is-empty' : ''}" role="status"><i class="hgi-stroke hgi-${empty ? 'alert-02' : 'sparkles'}"></i><span>โควตาสร้างข้อสอบ/ใบงาน/แผนวันนี้ <strong>เหลือ ${quota.remaining} ครั้ง</strong> จาก ${quota.limit} ครั้ง</span></div>`;
  }
  function updateAiQuotaUi() {
    document.querySelectorAll('.cl-ai-quota').forEach(element => {
      const template = document.createElement('template');
      template.innerHTML = aiQuotaHtml();
      element.replaceWith(template.content.firstElementChild);
    });
    const selector = state.view === 'quiz' ? 'button[onclick="generateQuizDraft()"]' : state.worksheetView === 'form' ? 'button[onclick="generateWorksheetDraft()"]' : state.lessonView === 'form' ? 'button[onclick="generateLessonPlanDraft()"]' : '';
    const button = selector ? document.querySelector(selector) : null;
    if (!button) return;
    const empty = state.aiQuota?.remaining === 0;
    button.disabled = empty;
    if (empty) button.setAttribute('aria-disabled', 'true'); else button.removeAttribute('aria-disabled');
    const actionLabel = state.view === 'quiz' ? 'สร้างร่างข้อสอบ' : state.worksheetView === 'form' ? 'สร้างร่างใบงาน' : state.subjectId === 'guidance' ? 'สร้างร่างแผนกิจกรรม' : 'สร้างร่างแผนการสอน';
    button.innerHTML = `<i class="hgi-stroke hgi-ai-magic"></i> ${empty ? 'โควตาครบแล้ว' : actionLabel}`;
  }
  async function refreshAiQuota(view) {
    try {
      const session = await supabaseClient?.auth?.getSession();
      const token = session?.data?.session?.access_token;
      const quotaRoute = view === 'lesson_plan' ? '/api/ai/generate-lesson-plan' : '/api/ai/generate-quiz';
      const response = await fetch(apiPath(quotaRoute), { headers: token ? { Authorization:`Bearer ${token}` } : {} });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'ยังตรวจสอบโควตาไม่ได้');
      applyAiQuota(result.quota);
    } catch (error) {
      state.aiQuota = { error:error.message || 'ยังตรวจสอบโควตาไม่ได้' };
    }
    if ((view === 'quiz' && state.view === 'quiz') || (view === 'worksheet' && state.worksheetView === 'form') || (view === 'lesson_plan' && state.lessonView === 'form')) updateAiQuotaUi();
  }
  function initContext() {
    const first = selectedClass() || classes()[0] || null;
    if (first && !state.selectedClassId && !state.creationContextOptional) state.selectedClassId = first.id;
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
    if (state.lessonView === 'detail' && state.lessonDraft?.id && state.lessonMediaAssetsPlanId !== state.lessonDraft.id && state.lessonMediaAssetsLoadingFor !== state.lessonDraft.id) {
      void loadLessonPlanMediaAssets(state.lessonDraft.id);
    }
  }
  window.renderContentLibrary = render;

  function bindCreationCardActions(root) {
    root.querySelectorAll('[data-create-action]').forEach(card => {
      if (card.dataset.createAction === 'interactive') {
        const status = card.querySelector('.cl-media-studio-status');
        const link = document.createElement('a');
        link.className = card.className;
        link.href = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://127.0.0.1:4178/interactive-v5' : new URL('/mini-lab-v5', window.location.origin).href;
        link.setAttribute('aria-describedby', 'cl-media-studio-status');
        link.innerHTML = card.innerHTML;
        if (status) status.textContent = 'เปิด Mini Lab V5';
        const description = link.querySelector('p');
        if (description) description.textContent = 'เล่าไอเดียหรือหัวข้อบทเรียน ให้ AI ช่วยสร้างสื่อโต้ตอบ แล้วบันทึกไว้กลับมาแก้ไขได้';
        card.replaceWith(link);
        return;
      }
      card.addEventListener('click', () => {
        const action = card.dataset.createAction;
        if (action === 'worksheet') window.openWorksheetCreator();
        if (action === 'quiz') window.openQuizCreator();
        if (action === 'lesson-plan') window.openLessonPlanCreator();
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
    return `<section class="cl-hero card"><div class="cl-hero-copy"><span class="cl-kicker"><i class="hgi-stroke hgi-book-open-01"></i> พื้นที่สร้างสื่อของคุณครู</span><h2>คลังสื่อการสอน</h2><p>สร้างข้อสอบ ใบงาน และสื่อโต้ตอบจากไอเดียของคุณครู แล้วกลับมาปรับต่อได้ทุกเมื่อ</p></div><span class="cl-hero-mark"><i class="hgi-stroke hgi-sparkles"></i></span></section>
      <section><div class="cl-section-head"><div><h3>เริ่มสร้างสื่อ</h3><p>เลือกเครื่องมือที่ต้องการใช้</p></div></div><div class="cl-create-grid">
        <button class="cl-create-card interactive cl-media-studio-entry" type="button" data-create-action="interactive" aria-describedby="cl-media-studio-status"><span id="cl-media-studio-status" class="cl-coming cl-media-studio-status">เปิด Mini Lab V5</span><span class="cl-create-icon"><i class="hgi-stroke hgi-magic-wand-01"></i></span><span class="cl-function-label">AI ช่วยสร้างสื่อ</span><h4>การสร้างสื่อโดย AI</h4><p>เปิด Mini Lab V5 เพื่อสร้าง แก้ไข และกลับมาทำสื่อต่อได้</p></button>
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

  window.openWorksheetCreator = function () { state.creationContextOptional = true; state.selectedClassId = ''; state.subjectId = ''; state.grade = ''; state.worksheetView = 'form'; state.worksheetDraft = null; state.worksheetDraftOrigin = 'new'; state.worksheetEditing = false; state.worksheetPrefill = null; state.worksheetType = 'questions'; state.worksheetWorkMode = 'individual'; state.worksheetItemCount = '10'; state.worksheetDifficulty = 'medium'; state.worksheetVisuals = 'none'; state.worksheetAnswerSpace = 'medium'; state.worksheetAnswerKey = 'yes'; state.worksheetIndicatorCodes = []; state.aiQuota = null; render(); refreshAiQuota('worksheet'); };
  window.closeWorksheetCreator = function () { const returnPlanId = state.worksheetPrefill?.lessonPlanId || state.worksheetDraft?.lessonPlanId; const returnPlan = returnPlanId ? library().find(item => item.id === returnPlanId && item.type === 'lesson_plan') : null; state.creationContextOptional = false; state.worksheetView = 'home'; state.worksheetDraft = null; state.worksheetDraftOrigin = 'new'; state.worksheetEditing = false; state.worksheetPrefill = null; state.worksheetIndicatorCodes = []; if (returnPlan) { state.lessonDraft = clone(returnPlan); state.lessonDraftOrigin = 'saved'; state.lessonView = 'detail'; } render(); };
  window.setWorksheetClass = function (value) { state.selectedClassId = value; const room = selectedClass(); state.subjectId = subjectIdFromName(room?.subject); state.grade = String(room?.gradeLevel || ''); state.worksheetIndicatorCodes = []; render(); };
  window.setWorksheetSubject = function (value) { state.subjectId = value; state.worksheetIndicatorCodes = []; render(); };
  window.setWorksheetGrade = function (value) { state.grade = value; state.worksheetIndicatorCodes = []; render(); };
  window.setWorksheetType = function (value) { state.worksheetType = value; configureWorksheetCountControl(value); };
  window.setWorksheetOption = function (field, value) {
    if (field === 'item-count') {
      const custom = document.getElementById('worksheet-item-count-custom');
      if (value === 'custom') { if (custom) custom.hidden = false; return; }
      state.worksheetItemCount = value;
      if (custom) { custom.value = value; custom.hidden = true; }
      return;
    }
    const stateField = `worksheet${field.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')}`;
    if (Object.prototype.hasOwnProperty.call(state, stateField)) state[stateField] = value;
  };
  window.setWorksheetCustomItemCount = function (value) { state.worksheetItemCount = value; };
  window.toggleWorksheetIndicator = function (code, checked) { state.worksheetIndicatorCodes = checked ? [...new Set([...state.worksheetIndicatorCodes, code])] : state.worksheetIndicatorCodes.filter(item => item !== code); };
  function selectedWorksheetIndicators() { const cat = catalog(); if (!cat || !state.subjectId) return []; const rows = cat.search({ subjectId:state.subjectId, grade:state.grade.toUpperCase(), standardId:'all' }); return rows.filter(row => state.worksheetIndicatorCodes.includes(row.code)); }
  const worksheetFormats = [{ id:'questions', label:'เติมคำ / ตอบคำถาม', hint:'ใบงานพื้นฐานสำหรับทบทวนความเข้าใจ เติมคำ หรือเขียนคำตอบสั้น ๆ' }, { id:'table', label:'ตาราง / จำแนกข้อมูล', hint:'ใช้จัดกลุ่ม เปรียบเทียบ ทำเครื่องหมาย หรือบันทึกข้อมูลลงตาราง' }, { id:'inquiry', label:'ทดลอง / สำรวจ / บันทึกผล', hint:'ใช้กับการสังเกตหรือทดลอง มีขั้นตอน ตารางบันทึกผล และคำถามสรุป' }, { id:'matching', label:'จับคู่ / ลากเส้น', hint:'แสดงรายการสองฝั่งให้นักเรียนจับคู่ โดยมีช่องคำตอบและเฉลยแยกสำหรับครู' }, { id:'drawing_form', label:'วาดภาพ / แบบฟอร์ม', hint:'สร้างพื้นที่วาดหรือออกแบบ พร้อมช่องให้เขียนคำอธิบายและเกณฑ์ตรวจ' }];
  function worksheetFormat(value) { return worksheetFormats.find(item => item.id === value) || worksheetFormats[0]; }
  function worksheetCountLimit(type) { return type === 'questions' ? 30 : 10; }
  function worksheetCountPresets(type) { return [5,10,15,20,30].filter(count => count <= worksheetCountLimit(type)); }
  function worksheetCountOption(current, type) {
    const limit = worksheetCountLimit(type);
    const count = String(current || '10');
    const presets = worksheetCountPresets(type);
    const isPreset = presets.includes(Number(count));
    const choices = presets.map(value => `<option value="${value}" ${count === String(value) ? 'selected' : ''}>${value} ข้อ</option>`).join('');
    return `<div class="cl-field"><span>จำนวนกิจกรรมหลัก</span><select id="worksheet-item-count" class="form-control" onchange="setWorksheetOption('item-count', this.value)">${choices}<option value="custom" ${isPreset ? '' : 'selected'}>กำหนดเอง</option></select><input id="worksheet-item-count-custom" class="form-control cl-count-custom" type="number" min="1" max="${limit}" step="1" inputmode="numeric" aria-label="จำนวนกิจกรรมหลักที่กำหนดเอง" value="${escapeHtml(count)}" oninput="setWorksheetCustomItemCount(this.value)" ${isPreset ? 'hidden' : ''}><small id="worksheet-item-count-hint" class="cl-field-hint">${limit === 10 ? 'แม่แบบนี้รองรับได้ 1–10 กิจกรรมหลัก' : 'เลือกจำนวนที่ต้องการ หรือกำหนดเองได้ 1–30 ข้อ'}</small></div>`;
  }
  function configureWorksheetCountControl(type) {
    const select = document.getElementById('worksheet-item-count');
    const custom = document.getElementById('worksheet-item-count-custom');
    const hint = document.getElementById('worksheet-item-count-hint');
    if (!select || !custom) return;
    const limit = worksheetCountLimit(type);
    const count = Math.min(limit, Math.max(1, Number(state.worksheetItemCount) || 10));
    state.worksheetItemCount = String(count);
    const presets = worksheetCountPresets(type);
    select.innerHTML = [...presets.map(value => `<option value="${value}">${value} ข้อ</option>`), `<option value="custom">กำหนดเอง</option>`].join('');
    select.value = presets.includes(count) ? String(count) : 'custom';
    custom.max = String(limit);
    custom.value = String(count);
    custom.hidden = select.value !== 'custom';
    if (hint) hint.textContent = limit === 10 ? 'แม่แบบนี้รองรับได้ 1–10 กิจกรรมหลัก' : 'เลือกจำนวนที่ต้องการ หรือกำหนดเองได้ 1–30 ข้อ';
  }
  function worksheetOptionsHtml(saved, prefill) {
    const storedField = { worksheetWorkMode:'workMode', worksheetItemCount:'itemCount', worksheetDifficulty:'difficulty', worksheetVisuals:'visuals', worksheetAnswerSpace:'answerSpace', worksheetAnswerKey:'answerKey' };
    const value = (field, fallback) => saved[storedField[field]] || prefill[storedField[field]] || state[field] || fallback;
    const option = (field, current, items) => `<label class="cl-field"><span>${items.label}</span><select id="worksheet-${field}" class="form-control" onchange="setWorksheetOption('${field}', this.value)">${items.options.map(item => `<option value="${item.value}" ${item.value === current ? 'selected' : ''}>${item.label}</option>`).join('')}</select></label>`;
    return `<section class="cl-worksheet-options-card"><div class="cl-worksheet-options-head"><div><h3>3. กำหนดลักษณะใบงาน</h3><p>กำหนดจำนวนกิจกรรมหลักเป็นเป้าหมาย ระบบจะรักษารายละเอียดสำคัญในคำสั่งไว้ให้ครบ</p></div><span class="cl-worksheet-guide-badge"><i class="hgi-stroke hgi-magic-wand-01"></i> จัดหน้าพร้อมพื้นที่ตอบ</span></div><div class="cl-form-grid">${option('work-mode', value('worksheetWorkMode', 'individual'), { label:'รูปแบบการทำงาน', options:[{value:'individual',label:'ทำรายบุคคล'},{value:'pair',label:'ทำงานเป็นคู่'},{value:'group',label:'ทำงานเป็นกลุ่ม'}] })}${worksheetCountOption(value('worksheetItemCount', '10'), state.worksheetType)}${option('difficulty', value('worksheetDifficulty', 'medium'), { label:'ระดับความยาก', options:[{value:'easy',label:'พื้นฐาน'},{value:'medium',label:'ปานกลาง'},{value:'hard',label:'ท้าทาย'}] })}${option('visuals', value('worksheetVisuals', 'none'), { label:'สื่อประกอบที่รองรับ', options:[{value:'none',label:'โครงสร้างใบงานและพื้นที่วาด'}] })}${option('answer-space', value('worksheetAnswerSpace', 'medium'), { label:'พื้นที่คำตอบ', options:[{value:'short',label:'สั้น กระชับ'},{value:'medium',label:'พอดี'},{value:'long',label:'มีพื้นที่อธิบาย'}] })}${option('answer-key', value('worksheetAnswerKey', 'yes'), { label:'เฉลยสำหรับครู', options:[{value:'yes',label:'สร้างเฉลย/เกณฑ์ตรวจด้วย'},{value:'no',label:'ไม่ต้องสร้างเฉลย'}] })}</div></section>`;
  }
  function worksheetFormHtml() {
    const saved = state.worksheetDraft || {}; const prefill = state.worksheetPrefill || {}; const requestedType = saved.worksheetType || prefill.worksheetType || state.worksheetType; const selectedType = worksheetFormats.some(item => item.id === requestedType) ? requestedType : 'questions'; state.worksheetType = selectedType;
    const formatBlock = `<section class="cl-worksheet-format-card"><div><h3>2. เลือกแม่แบบใบงาน</h3><p>เลือกโครงสร้างที่ใกล้กับงานที่ต้องการ ระบบจะจัดวางเป็นใบงานให้ครูตรวจต่อ</p></div><label class="cl-field"><span>รูปแบบใบงาน <em class="cl-required">*</em></span><select id="worksheet-type" class="form-control" onchange="setWorksheetType(this.value)">${worksheetFormats.map(item => `<option value="${item.id}" ${item.id === selectedType ? 'selected' : ''}>${item.label}</option>`).join('')}</select><small class="cl-field-hint">${escapeHtml(worksheetFormat(selectedType).hint)}</small></label></section>`;
    const optionBlock = worksheetOptionsHtml(saved, prefill);
    return legacyWorksheetFormHtml().replace('<h3>2. สิ่งที่ต้องการให้ใบงานช่วยจัดทำ</h3>', `${formatBlock}${optionBlock}<h3>4. รายละเอียดเพิ่มเติม (ถ้ามี)</h3>`);
  }
  function legacyWorksheetFormHtmlBase() {
    const saved = state.worksheetDraft || {}; const prefill = state.worksheetPrefill || {}; const savedIndicators = Array.isArray(saved.indicators) ? saved.indicators.map(item => item.code) : (prefill.indicators || []).map(item => item.code); const selectedIndicatorCodes = state.worksheetIndicatorCodes.length ? state.worksheetIndicatorCodes : savedIndicators; const cat = catalog(); const subjectOptions = (cat?.subjects || []).filter(s => s.available).map(s => `<option value="${escapeHtml(s.id)}" ${s.id === state.subjectId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join(''); const grades = state.subjectId && cat ? cat.getGrades(state.subjectId) : []; const indicatorRows = state.subjectId && cat ? cat.search({ subjectId:state.subjectId, grade:state.grade.toUpperCase(), standardId:'all' }) : [];
    const activityTypes = ['สืบค้นและรวบรวมข้อมูล','ทดลองและสังเกต','ฝึกทักษะ','วิเคราะห์และอภิปราย','ทำงานกลุ่ม','สะท้อนการเรียนรู้'];
    return `<div class="cl-wizard cl-worksheet-wizard"><div class="cl-wizard-top"><button class="btn" type="button" onclick="closeWorksheetCreator()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับคลัง</span></button><div class="cl-wizard-title"><span class="cl-create-icon worksheet"><i class="hgi-stroke hgi-note-02"></i></span><div><h2>สร้างใบงาน</h2><p>กำหนดกรอบกิจกรรม แล้วให้ AI ช่วยจัดทำร่างใบงาน</p></div></div></div><div class="cl-stepper" aria-label="ขั้นตอนการสร้างใบงาน"><span class="cl-step active"><b>1</b> กำหนดกรอบ</span><span class="cl-step"><b>2</b> ตรวจร่าง</span><span class="cl-step"><b>3</b> บันทึกเข้าคลัง</span></div><section class="card cl-form-card"><h3>1. ข้อมูลรายวิชาและห้องเรียน</h3><p class="cl-form-note">เลือกข้อมูลที่มีอยู่ใน ClassKru เพื่อให้ใบงานสอดคล้องกับห้องเรียนและตัวชี้วัด</p><div class="cl-form-grid"><label class="cl-field full"><span>ห้องเรียน <em class="cl-required">*</em></span><select id="worksheet-class" class="form-control" onchange="setWorksheetClass(this.value)"><option value="">เลือกห้องเรียน</option>${classes().map(c => `<option value="${escapeHtml(c.id)}" ${c.id === (saved.classId || prefill.classId || state.selectedClassId) ? 'selected' : ''}>${escapeHtml(c.subject)} · ${escapeHtml(c.className)}</option>`).join('')}</select></label><label class="cl-field"><span>กลุ่มสาระ</span><select class="form-control" onchange="setWorksheetSubject(this.value)"><option value="">เลือกกลุ่มสาระ</option>${subjectOptions}</select></label><label class="cl-field"><span>ระดับชั้น</span><select class="form-control" onchange="setWorksheetGrade(this.value)"><option value="">ไม่ระบุ</option>${grades.map(g => `<option value="${escapeHtml(g)}" ${g.toLowerCase() === state.grade.toLowerCase() ? 'selected' : ''}>${gradeLabel(g.toLowerCase())}</option>`).join('')}</select></label><label class="cl-field full"><span>ชื่อใบงาน <em class="cl-required">*</em></span><input id="worksheet-title" class="form-control" maxlength="180" value="${escapeHtml(saved.title || prefill.title || '')}" placeholder="เช่น ใบงานวิเคราะห์โครงสร้างของเซลล์"></label><label class="cl-field"><span>ประเภทกิจกรรม</span><select id="worksheet-activity-type" class="form-control">${activityTypes.map(value => `<option ${value === (saved.activityType || prefill.activityType) ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="cl-field"><span>เวลาที่ใช้</span><select id="worksheet-duration" class="form-control"><option ${saved.duration === '1 คาบ (50 นาที)' ? 'selected' : ''}>1 คาบ (50 นาที)</option><option ${saved.duration === '2 คาบ (100 นาที)' ? 'selected' : ''}>2 คาบ (100 นาที)</option><option ${saved.duration === '3 คาบ (150 นาที)' ? 'selected' : ''}>3 คาบ (150 นาที)</option></select></label></div><div class="cl-form-grid"><div class="cl-field full"><span>ตัวชี้วัด/ผลการเรียนรู้ <small>(เลือกได้หลายข้อ)</small></span><div class="cl-indicator-table" role="group" aria-label="เลือกตัวชี้วัดสำหรับใบงาน"><div class="cl-indicator-table-head"><span></span><span>รหัส</span><span>รายละเอียดตัวชี้วัด</span></div>${indicatorRows.slice(0,18).map(i => `<label class="cl-indicator-row"><input type="checkbox" value="${escapeHtml(i.code)}" ${selectedIndicatorCodes.includes(i.code) ? 'checked' : ''} onchange="toggleWorksheetIndicator(this.value,this.checked)"><strong>${escapeHtml(i.code)}</strong><span>${escapeHtml(i.text)}</span></label>`).join('') || '<div class="cl-indicator-empty">เลือกกลุ่มสาระและระดับชั้นเพื่อแสดงตัวชี้วัด</div>'}</div></div></div><h3>2. สิ่งที่ต้องการให้ใบงานช่วยจัดทำ</h3><p class="cl-form-note">กรอกเท่าที่รู้ ระบบจะไม่สร้างคำตอบหรือผลการเรียนของนักเรียนแทนข้อมูลจริง</p><div class="cl-form-grid"><label class="cl-field full"><span>สิ่งที่อยากให้นักเรียนทำหรือส่ง</span><textarea id="worksheet-output" class="form-control" rows="3" maxlength="1200" placeholder="เช่น วาดภาพเซลล์พร้อมอธิบายหน้าที่ของออร์แกเนลล์ด้วยภาษาของตนเอง">${escapeHtml(saved.learnerOutput || prefill.learnerOutput || '')}</textarea></label><label class="cl-field full"><span>อุปกรณ์หรือข้อจำกัดของห้องเรียน</span><textarea id="worksheet-resources" class="form-control" rows="2" maxlength="1000" placeholder="เช่น มีภาพตัวอย่างและกระดาษ A4 ไม่มีอุปกรณ์ทดลอง">${escapeHtml(saved.resources || prefill.resources || '')}</textarea></label><label class="cl-field full"><span>สิ่งที่ครูอยากเน้นเป็นพิเศษ</span><textarea id="worksheet-focus" class="form-control" rows="2" maxlength="1000" placeholder="เช่น ให้เด็กอธิบายจากหลักฐาน ไม่ตอบตามการจำ">${escapeHtml(saved.focus || prefill.focus || '')}</textarea></label></div>${aiQuotaHtml()}<div class="cl-context-card"><i class="hgi-stroke hgi-information-circle"></i><span>ระบบจะส่งกรอบที่ครูกำหนดไปยัง API เพื่อสร้างร่างใบงาน 1 ครั้ง ครูตรวจและแก้ไขได้ก่อนบันทึก</span></div><div class="cl-actions"><button class="btn" type="button" onclick="closeWorksheetCreator()">ยกเลิก</button><button class="btn btn-primary" type="button" onclick="generateWorksheetDraft()"${state.aiQuota?.remaining === 0 ? ' disabled aria-disabled="true"' : ''}><i class="hgi-stroke hgi-ai-magic"></i> ${state.aiQuota?.remaining === 0 ? 'โควตาครบแล้ว' : 'สร้างร่างใบงาน'}</button></div></section></div>`;
  }
  function legacyWorksheetFormHtml() {
    return legacyWorksheetFormHtmlBase()
      .replace('เลือกข้อมูลที่มีอยู่ใน ClassKru เพื่อให้ใบงานสอดคล้องกับห้องเรียนและตัวชี้วัด', 'เลือกห้องเรียนได้ถ้าต้องการใช้เป็นบริบท — ไม่เลือกก็สร้างใบงานร่างไว้ทดลองได้')
      .replace('<span>ห้องเรียน <em class="cl-required">*</em></span><select id="worksheet-class" class="form-control" onchange="setWorksheetClass(this.value)"><option value="">เลือกห้องเรียน</option>', '<span>ห้องเรียน <small>(ไม่บังคับ)</small></span><select id="worksheet-class" class="form-control" onchange="setWorksheetClass(this.value)"><option value="">ยังไม่เลือก — สร้างร่างอิสระ</option>')
      .replace('<small>(เลือกได้หลายข้อ)</small>', '<small>(เลือกได้หลายข้อ ไม่เลือกก็ได้)</small>');
  }
  function ensureWorksheetProcessingOverlay() { if (document.getElementById('worksheet-processing-overlay')) return; const overlay = document.createElement('div'); overlay.id = 'worksheet-processing-overlay'; overlay.className = 'cl-processing'; overlay.setAttribute('role','status'); overlay.innerHTML = '<div class="cl-processing-card"><div class="cl-processing-spinner"></div><h3>AI กำลังจัดทำร่างใบงาน</h3><p>กำลังเรียบเรียงคำชี้แจง ขั้นตอน และพื้นที่ทำงาน<br>กรุณารอสักครู่ และไม่ต้องกดซ้ำ</p></div>'; document.body.appendChild(overlay); }
  window.generateWorksheetDraft = async function () {
    if (state.aiGenerating) return;
    if (state.aiQuota?.remaining === 0) { showToast('วันนี้ใช้โควตาการสร้างข้อสอบ/ใบงาน/แผนการสอนครบแล้ว กรุณาลองใหม่พรุ่งนี้', 'warning', 7000); return; }
    const room = selectedClass();
    const title = document.getElementById('worksheet-title')?.value.trim() || '';
    const indicators = selectedWorksheetIndicators();
    const worksheetType = state.worksheetType || document.getElementById('worksheet-type')?.value || 'questions';
    if (title.length < 3) { showToast('กรุณาระบุชื่อใบงาน', 'warning'); return; }
    const countControl = document.getElementById('worksheet-item-count');
    const itemCount = Number(countControl?.value === 'custom' ? document.getElementById('worksheet-item-count-custom')?.value : countControl?.value || state.worksheetItemCount || 10);
    if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > worksheetCountLimit(worksheetType)) { showToast(`กรุณาระบุจำนวนกิจกรรมหลัก 1–${worksheetCountLimit(worksheetType)} รายการ`, 'warning'); document.getElementById('worksheet-item-count-custom')?.focus(); return; }
    state.worksheetItemCount = String(itemCount);
    const subjectName = (catalog()?.subjects || []).find(item => item.id === state.subjectId)?.name || room?.subject || '';
    const payload = { title, worksheetType, worksheetTypeLabel:worksheetFormat(worksheetType).label, classId:room?.id || '', classLabel:state.worksheetPrefill?.classLabel || (room ? `${subjectName} · ${room.className}` : 'ยังไม่ได้เชื่อมห้องเรียน'), subjectId:state.subjectId, subject:subjectName, subjectGroup:subjectName, courseName:state.worksheetPrefill?.courseName || '', courseCode:state.worksheetPrefill?.courseCode || '', grade:gradeLabel(state.grade), standards:state.worksheetPrefill?.standards || [], lessonPlanNumber:state.worksheetPrefill?.planNumber || null, topic:state.worksheetPrefill?.topic || title, activityType:document.getElementById('worksheet-activity-type')?.value || '', duration:document.getElementById('worksheet-duration')?.value || '', indicators:indicators.map(row => indicatorReference(row)), workMode:document.getElementById('worksheet-work-mode')?.value || state.worksheetWorkMode, itemCount, difficulty:document.getElementById('worksheet-difficulty')?.value || state.worksheetDifficulty, visuals:document.getElementById('worksheet-visuals')?.value || state.worksheetVisuals, answerSpace:document.getElementById('worksheet-answer-space')?.value || state.worksheetAnswerSpace, answerKey:document.getElementById('worksheet-answer-key')?.value || state.worksheetAnswerKey, learnerOutput:document.getElementById('worksheet-output')?.value.trim() || '', resources:document.getElementById('worksheet-resources')?.value.trim() || '', focus:document.getElementById('worksheet-focus')?.value.trim() || '', lessonPlanId:state.worksheetPrefill?.lessonPlanId || '' };
    state.aiGenerating = true;
    ensureWorksheetProcessingOverlay(); document.getElementById('worksheet-processing-overlay')?.classList.add('show');
    try { const session = await supabaseClient?.auth?.getSession(); const token = session?.data?.session?.access_token; const response = await fetch(apiPath('/api/ai/generate-worksheet'), { method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) }, body:JSON.stringify(payload) }); const result = await response.json().catch(() => ({})); applyAiQuota(result.quota); if (!response.ok) { updateAiQuotaUi(); throw new Error(result.message || result.error || 'ไม่สามารถสร้างใบงานได้'); } state.worksheetDraft = { ...payload, id:uid(), createdAt:new Date().toISOString(), worksheet:result.worksheet, warnings:Array.isArray(result.warnings) ? result.warnings : [] }; state.worksheetDraftOrigin = 'new'; state.worksheetEditing = false; state.worksheetView = 'review'; render(); } catch (error) { console.warn('Worksheet generation failed:', error); showToast(`สร้างใบงานไม่สำเร็จ: ${error.message || 'กรุณาลองใหม่'}`, 'warning', 7000); } finally { state.aiGenerating = false; document.getElementById('worksheet-processing-overlay')?.classList.remove('show'); }
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
  function worksheetDetailHtml() { const d = state.worksheetDraft; if (!d?.worksheet) { state.worksheetView = 'home'; return homeHtml(); } const w = d.worksheet; return `<div class="cl-wizard cl-worksheet-detail"><div class="cl-wizard-top"><button class="btn" type="button" onclick="closeWorksheetCreator()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับคลัง</span></button><div class="cl-wizard-title"><span class="cl-create-icon worksheet"><i class="hgi-stroke hgi-note-02"></i></span><div><h2>รายละเอียดใบงาน</h2><p>ตรวจแก้ ส่งออก หรือเชื่อมใบงานกับแผนการสอนได้จากหน้านี้</p></div></div></div><section class="card cl-plan-detail-head"><div><span class="cl-saved-type cl-worksheet-type"><i class="hgi-stroke hgi-note-02"></i> ใบงานในคลัง</span><h2>${escapeHtml(w.title || d.title)}</h2><p>${escapeHtml(d.classLabel)} · ${escapeHtml(d.activityType)} · ${escapeHtml(d.duration)}</p><div class="cl-detail-indicators">${(d.indicators || []).map(item => `<span>${escapeHtml(item.code)}</span>`).join('')}</div></div><div class="cl-detail-actions"><button class="btn cl-export-btn word" type="button" data-export-worksheet="word" onclick="exportWorksheetDocx()"><i class="hgi-stroke hgi-file-download"></i> ส่งออก Word</button><button class="btn cl-export-btn pdf" type="button" data-export-worksheet="pdf" title="เปิดหน้าพิมพ์เพื่อเลือกบันทึกเป็น PDF ขนาด A4" onclick="exportWorksheetPdf()"><i class="hgi-stroke hgi-printer"></i> PDF · แบบฟอร์ม A4</button><button class="btn btn-primary" type="button" onclick="editSavedWorksheet()"><i class="hgi-stroke hgi-edit-02"></i> แก้ไขใบงาน</button></div></section><section class="card cl-worksheet-preview cl-worksheet-detail-preview"><div class="cl-worksheet-grid"><article><h3>คำชี้แจง</h3>${worksheetListHtml(w.directions)}</article><article><h3>สถานการณ์หรือโจทย์กิจกรรม</h3>${worksheetListHtml(w.context)}</article><article><h3>ขั้นตอนการทำงาน</h3>${worksheetListHtml(w.steps)}</article><article><h3>ภารกิจ/คำถามชี้นำ</h3>${worksheetListHtml(w.tasks)}</article><article><h3>สิ่งที่นักเรียนต้องทำหรือบันทึก</h3>${worksheetListHtml(w.responseAreas)}</article><article><h3>ชิ้นงานที่ต้องส่ง</h3>${worksheetListHtml(w.submission)}</article><article class="cl-worksheet-wide"><h3>เกณฑ์หรือแนวทางประเมินสำหรับครู</h3>${worksheetListHtml(w.assessmentCriteria)}</article></div></section></div>`; }
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

  window.openLessonPlanCreator = function () { state.view = 'home'; state.worksheetView = 'home'; state.lessonView = 'form'; state.lessonDraft = null; state.lessonForm = {}; state.lessonPlanNumberManual = false; state.lessonDraftOrigin = 'new'; state.lessonEditing = false; state.lessonQuizLinkOpen = false; state.lessonWorksheetLinkOpen = false; state.lessonIndicatorCodes = []; render(); refreshAiQuota('lesson_plan'); if (typeof supabaseClient !== 'undefined') void catalog()?.loadFromSupabase(supabaseClient); };
  window.closeLessonPlanCreator = function () { state.view = 'home'; state.worksheetView = 'home'; state.lessonView = 'home'; state.lessonDraft = null; state.lessonDraftOrigin = 'new'; state.lessonEditing = false; state.lessonQuizLinkOpen = false; state.lessonWorksheetLinkOpen = false; render(); };
  window.backToLessonLibrary = function () { state.view = 'home'; state.worksheetView = 'home'; state.lessonView = 'home'; state.lessonDraft = null; state.lessonDraftOrigin = 'new'; state.lessonEditing = false; state.lessonQuizLinkOpen = false; state.lessonWorksheetLinkOpen = false; render(); };
  window.setLessonClass = function (value) { captureLessonForm(); state.selectedClassId = value; const room = selectedClass(); state.subjectId = subjectIdFromName(room?.subject); state.grade = gradeIdFromLabel(room?.gradeLevel || ''); if (!state.lessonForm?.classSections) state.lessonForm.classSections = room?.className || ''; state.lessonIndicatorCodes = []; render(); };
  window.setLessonSubject = function (value) { captureLessonForm(); state.subjectId = value; state.lessonIndicatorCodes = []; render(); if (value === 'guidance' && typeof supabaseClient !== 'undefined') void catalog()?.loadFromSupabase(supabaseClient); };
  window.setLessonGrade = function (value) { captureLessonForm(); state.grade = value; state.lessonIndicatorCodes = []; render(); };
  window.toggleLessonIndicator = function (code, checked) { state.lessonIndicatorCodes = checked ? [...new Set([...state.lessonIndicatorCodes, code])] : state.lessonIndicatorCodes.filter(item => item !== code); updateLessonStandardSummary(); };
  function selectedLessonIndicators() { const cat = catalog(); if (!cat || !state.subjectId) return []; const rows = cat.search({ subjectId:state.subjectId, grade:state.grade.toUpperCase(), standardId:'all' }); return rows.filter(row => state.lessonIndicatorCodes.includes(row.code)); }
  function selectedLessonSubjectName() { const cat = catalog(); return cat?.subjects?.find(item => item.id === state.subjectId)?.name || selectedClass()?.subject || ''; }
  function lessonFormHtml() {
    const saved = state.lessonDraft || {}; const room = selectedClass(); const cat = catalog();
    const selectedIndicatorCodes = state.lessonIndicatorCodes;
    const isGuidance = state.subjectId === 'guidance';
    const curriculumFieldLabel = isGuidance ? 'กิจกรรมแนะแนว' : 'กลุ่มสาระการเรียนรู้';
    const indicatorFieldLabel = state.subjectId === 'guidance' ? 'ผลลัพธ์การเรียนรู้กิจกรรมแนะแนว' : 'ตัวชี้วัด/ผลการเรียนรู้';
    const subjectOptions = (cat?.subjects || []).filter(s => s.available).map(s => `<option value="${escapeHtml(s.id)}" ${s.id === state.subjectId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
    const grades = state.subjectId && cat ? cat.getGrades(state.subjectId) : [];
    const indicatorRows = state.subjectId && cat ? cat.search({ subjectId:state.subjectId, grade:state.grade.toUpperCase(), standardId:'all' }) : [];
    const academicYear = lessonFormValue('academicYear', room?.academicYear || new Date().getFullYear() + 543);
    const semester = lessonFormValue('semester', '1');
    const planNumber = lessonFormValue('planNumber', saved.planNumber || nextLessonPlanNumber({ ...lessonNumberSeed(), academicYear, semester }));
    const choice = lessonFormValue('durationChoice', saved.durationChoice || (saved.durationMinutes && ![50,100,150].includes(Number(saved.durationMinutes)) ? 'custom' : String(saved.durationMinutes || 50)));
    const customMinutes = lessonFormValue('durationMinutes', saved.durationMinutes && ![50,100,150].includes(Number(saved.durationMinutes)) ? saved.durationMinutes : '');
    const standardRows = lessonStandardRows();
    const currentTeacherName = lessonFormValue('teacherName', appState?.teacherName || '');
    const subjectOptionsHtml = subjectOptions || '<option value="">ยังไม่มีข้อมูลกลุ่มสาระ</option>';
    return `<div class="cl-wizard cl-lesson-wizard"><div class="cl-wizard-top"><button class="btn" type="button" onclick="closeLessonPlanCreator()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับคลัง</span></button><div class="cl-wizard-title"><span class="cl-create-icon lesson-plan"><i class="hgi-stroke hgi-presentation-01"></i></span><div><h2>${isGuidance ? 'สร้างแผนกิจกรรมแนะแนว' : 'สร้างแผนการสอน'}</h2><p>${isGuidance ? 'กำหนดภาพรวมหน่วย แล้วสร้างแผนกิจกรรมรายครั้ง' : 'กำหนดกรอบสำคัญ แล้วให้ AI ช่วยเติมร่างแผน'}</p></div></div></div>
      <div class="cl-stepper" aria-label="ขั้นตอนการสร้างแผน"><span class="cl-step active"><b>1</b> กำหนดกรอบ</span><span class="cl-step"><b>2</b> ตรวจร่าง</span><span class="cl-step"><b>3</b> บันทึกเข้าคลัง</span></div>
      <section class="card cl-form-card"><h3>1. ข้อมูลพื้นฐาน</h3><p class="cl-form-note">${isGuidance ? 'กำหนดกรอบหน่วยกิจกรรมก่อน แล้วระบุหัวข้อและเวลาของแผนรายครั้ง' : 'เลือกกลุ่มสาระเพื่อค้นมาตรฐานและตัวชี้วัด แล้วระบุชื่อรายวิชาที่สอนจริงสำหรับหัวเอกสาร'}</p><div class="cl-form-grid">
        <label class="cl-field full"><span>ห้องเรียนหลัก <em class="cl-required">*</em></span><select id="lesson-class" class="form-control" onchange="setLessonClass(this.value)"><option value="">เลือกห้องเรียน</option>${classes().map(c => `<option value="${escapeHtml(c.id)}" ${c.id === state.selectedClassId ? 'selected' : ''}>${escapeHtml(c.subject)} · ${escapeHtml(c.className)}</option>`).join('')}</select></label>
        <label class="cl-field"><span>${curriculumFieldLabel}</span><select class="form-control" onchange="setLessonSubject(this.value)"><option value="">เลือก${curriculumFieldLabel}</option>${subjectOptionsHtml}</select><small>ใช้ค้นข้อมูลหลักสูตร ไม่ใช่ชื่อรายวิชาที่สอน</small></label>
        <label class="cl-field"><span>ระดับชั้น</span><select class="form-control" onchange="setLessonGrade(this.value)"><option value="">ไม่ระบุ</option>${grades.map(g => `<option value="${escapeHtml(g)}" ${g.toLowerCase() === state.grade.toLowerCase() ? 'selected' : ''}>${gradeLabel(g.toLowerCase())}</option>`).join('')}</select></label>
        <label class="cl-field"><span>รายวิชาที่สอน <em class="cl-required">*</em></span><input id="lesson-course-name" class="form-control" maxlength="180" value="${escapeHtml(lessonFormValue('courseName'))}" placeholder="เช่น วิทยาศาสตร์พื้นฐาน" oninput="refreshLessonPlanNumber()"></label>
        <label class="cl-field"><span>รหัสวิชา</span><input id="lesson-course-code" class="form-control" maxlength="80" value="${escapeHtml(lessonFormValue('courseCode'))}" placeholder="เช่น ว 23101" oninput="refreshLessonPlanNumber()"></label>
        ${isGuidance ? `</div><section class="cl-guidance-form-section"><h3>2. ภาพรวมหน่วยการจัดกิจกรรม</h3><p class="cl-form-note">ข้อมูลชุดนี้เป็นเป้าหมายร่วมของแผนกิจกรรมหลายครั้ง ครูกรอกวัตถุประสงค์ชั้นปีตามหลักสูตรโรงเรียนได้</p><div class="cl-form-grid"><label class="cl-field"><span>ภาคเรียน</span><select id="lesson-semester" class="form-control" onchange="refreshLessonPlanNumber()"><option value="1" ${String(semester)==='1'?'selected':''}>1</option><option value="2" ${String(semester)==='2'?'selected':''}>2</option><option value="summer" ${String(semester)==='summer'?'selected':''}>ฤดูร้อน</option></select></label><label class="cl-field"><span>ปีการศึกษา</span><input id="lesson-academic-year" class="form-control" type="number" min="2500" max="2700" value="${escapeHtml(academicYear)}" oninput="refreshLessonPlanNumber()"></label><label class="cl-field"><span>หน่วยการจัดกิจกรรมที่</span><input id="lesson-unit-number" class="form-control" maxlength="40" value="${escapeHtml(lessonFormValue('unitNumber'))}" placeholder="เช่น 1"></label><label class="cl-field"><span>ชื่อหน่วยการจัดกิจกรรม</span><input id="lesson-unit-name" class="form-control" maxlength="200" value="${escapeHtml(lessonFormValue('unitName'))}" placeholder="เช่น การรู้จักและเข้าใจตนเอง"></label><label class="cl-field full"><span>วัตถุประสงค์ชั้นปี</span><textarea id="lesson-year-objective" class="form-control" rows="2" maxlength="1200" placeholder="กรอกจากหลักสูตรแนะแนวของโรงเรียน (ครูปรับแก้ได้)">${escapeHtml(lessonFormValue('yearObjective'))}</textarea><small>เป็นเป้าหมายพัฒนาผู้เรียนระดับชั้น ไม่ใช่จุดประสงค์ของกิจกรรมรายครั้ง</small></label><label class="cl-field full"><span>วัตถุประสงค์ของหน่วยการจัดกิจกรรม</span><textarea id="lesson-unit-objective" class="form-control" rows="2" maxlength="1200" placeholder="ภาพรวมว่าหน่วยนี้มุ่งพัฒนาผู้เรียนด้านใด (เว้นว่างให้ AI ช่วยร่างได้)">${escapeHtml(lessonFormValue('unitObjective'))}</textarea><small>เป้าหมายของหน่วยนี้จะแสดงแยกจากจุดประสงค์การเรียนรู้รายครั้ง</small></label><label class="cl-field"><span>เวลาเรียนรวมของหน่วย (ชั่วโมง)</span><input id="lesson-unit-hours" class="form-control" type="number" min="0.5" max="300" step="0.5" value="${escapeHtml(lessonFormValue('unitHours'))}" placeholder="เช่น 3"><small>ไม่ใช่เวลาเรียนของแผนรายครั้ง</small></label></div></section><section class="cl-guidance-form-section"><h3>3. แผนกิจกรรมรายครั้ง</h3><p class="cl-form-note">กำหนดหัวข้อ ลำดับแผน และเวลาเฉพาะของกิจกรรมครั้งนี้</p><div class="cl-form-grid">` : ''}
        <label class="cl-field full"><span>หัวข้อ${state.subjectId === 'guidance' ? 'กิจกรรม' : 'บทเรียน'} <em class="cl-required">*</em></span><input id="lesson-topic" class="form-control" maxlength="240" value="${escapeHtml(lessonFormValue('topic', saved.topic || ''))}" placeholder="${state.subjectId === 'guidance' ? 'เช่น รู้จักจุดแข็งและความสนใจของตนเอง' : 'เช่น การถ่ายทอดลักษณะทางพันธุกรรม'}"></label>
        <label class="cl-field"><span>${isGuidance ? 'เลขแผนกิจกรรมแนะแนว' : 'เลขแผนการจัดการเรียนรู้'}</span><input id="lesson-plan-number" class="form-control" type="number" min="1" step="1" data-manual="${state.lessonPlanNumberManual || lessonFormValue('planNumberManual', false) ? 'true' : 'false'}" value="${escapeHtml(planNumber)}" oninput="setLessonPlanNumberManual()"><small>รันต่อจากแผนที่บันทึกไว้ ครูแก้เลขได้</small></label>
        <label class="cl-field"><span>${isGuidance ? 'เวลาเรียนในแผนรายครั้ง' : 'เวลาเรียน'}</span><select id="lesson-duration" class="form-control" onchange="setLessonDurationPreset(this.value)"><option value="50" ${String(choice)==='50'?'selected':''}>1 คาบ (50 นาที)</option><option value="100" ${String(choice)==='100'?'selected':''}>2 คาบ (100 นาที)</option><option value="150" ${String(choice)==='150'?'selected':''}>3 คาบ (150 นาที)</option><option value="custom" ${String(choice)==='custom'?'selected':''}>ระบุเวลาเอง</option></select><div id="lesson-duration-custom-wrap" class="cl-duration-custom" ${String(choice)==='custom'?'':'hidden'}><input id="lesson-duration-custom" class="form-control" type="number" min="1" max="600" step="1" value="${escapeHtml(customMinutes)}" placeholder="เช่น 75" aria-label="ระบุเวลาเรียนเป็นนาที"><span>นาที</span></div></label>
        ${!isGuidance ? `<label class="cl-field"><span>ภาคเรียน</span><select id="lesson-semester" class="form-control" onchange="refreshLessonPlanNumber()"><option value="1" ${String(semester)==='1'?'selected':''}>1</option><option value="2" ${String(semester)==='2'?'selected':''}>2</option><option value="summer" ${String(semester)==='summer'?'selected':''}>ฤดูร้อน</option></select></label><label class="cl-field"><span>ปีการศึกษา</span><input id="lesson-academic-year" class="form-control" type="number" min="2500" max="2700" value="${escapeHtml(academicYear)}" oninput="refreshLessonPlanNumber()"></label><label class="cl-field"><span>หน่วยการเรียนรู้ที่</span><input id="lesson-unit-number" class="form-control" maxlength="40" value="${escapeHtml(lessonFormValue('unitNumber'))}" placeholder="เช่น 2"></label><label class="cl-field"><span>ชื่อหน่วยการเรียนรู้</span><input id="lesson-unit-name" class="form-control" maxlength="200" value="${escapeHtml(lessonFormValue('unitName'))}" placeholder="เช่น การถ่ายทอดลักษณะทางพันธุกรรม"></label>` : ''}
        <label class="cl-field full"><span>ชั้น/ห้องที่ใช้แผน</span><input id="lesson-class-sections" class="form-control" maxlength="240" value="${escapeHtml(lessonFormValue('classSections', room?.className || ''))}" placeholder="เช่น ม.3/1 ห้อง 226, ม.3/2 ห้อง 226"><small>ระบุหลายห้องคั่นด้วยเครื่องหมายจุลภาคได้</small></label>
        <label class="cl-field"><span>ชื่อผู้สอน</span><input id="lesson-teacher-name" class="form-control" maxlength="160" value="${escapeHtml(currentTeacherName)}" placeholder="ชื่อ-นามสกุลครู"></label>
        <label class="cl-field"><span>รหัสผู้สอน</span><input id="lesson-teacher-code" class="form-control" maxlength="80" value="${escapeHtml(lessonFormValue('teacherCode'))}" placeholder="ถ้ามี"></label>
        <label class="cl-field full"><span>รูปแบบการเรียนรู้</span><select id="lesson-method" class="form-control">${['สืบเสาะหาความรู้','ลงมือปฏิบัติ','ร่วมมือกันเรียนรู้','ใช้ปัญหาเป็นฐาน','ผสมผสาน'].map(value => `<option ${value === lessonFormValue('method', saved.method || 'สืบเสาะหาความรู้') ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      </div>${isGuidance ? '</section>' : ''}<h3>${isGuidance ? '4. กรอบแนะแนวที่เชื่อมโยง' : '2. มาตรฐานและตัวชี้วัด'}</h3><div class="cl-form-grid"><div class="cl-field full"><span>${isGuidance ? 'มาตรฐาน/กรอบแนะแนวที่อ้างอิง' : 'มาตรฐานการเรียนรู้'}</span><div id="lesson-standard-summary" class="cl-learning-standard-summary">${lessonStandardHtml(standardRows)}</div><textarea id="lesson-standard-override" class="form-control" rows="2" maxlength="1200" placeholder="${isGuidance ? 'เพิ่มหรือแก้ข้อความกรอบแนะแนวได้ ครูควรตรวจแหล่งที่มา' : 'เพิ่มหรือแก้ข้อความมาตรฐานได้เมื่อคลังไม่มีข้อมูล'}">${escapeHtml(lessonFormValue('standardOverride'))}</textarea></div><div class="cl-field full"><span>${indicatorFieldLabel} <small>(เลือกได้หลายข้อ)</small></span><div class="cl-indicator-table" role="group" aria-label="เลือกผลลัพธ์สำหรับแผนกิจกรรม"><div class="cl-indicator-table-head"><span></span><span>รหัส</span><span>รายละเอียด</span></div>${indicatorRows.slice(0,18).map(i => `<label class="cl-indicator-row"><input type="checkbox" value="${escapeHtml(i.code)}" ${selectedIndicatorCodes.includes(i.code) ? 'checked' : ''} onchange="toggleLessonIndicator(this.value,this.checked)"><strong>${escapeHtml(i.code)}</strong><span>${escapeHtml(i.text)}</span></label>`).join('') || '<div class="cl-indicator-empty">เลือกกิจกรรม/กลุ่มสาระและระดับชั้นเพื่อแสดงผลลัพธ์</div>'}</div></div></div>
      <h3>${isGuidance ? '5. บริบทกิจกรรม' : '3. บริบทที่ต้องการให้ AI นำไปใช้'}</h3><p class="cl-form-note">กรอกเท่าที่รู้ ระบบจะไม่สร้างข้อมูลผลการเรียนแทนข้อมูลจริง</p><div class="cl-form-grid"><label class="cl-field full"><span>ลักษณะผู้เรียน/ปัญหาที่พบ</span><textarea id="lesson-learners" class="form-control" rows="3" maxlength="1600" placeholder="เช่น นักเรียนยังสับสนเรื่อง... หรือมีพื้นฐานแตกต่างกัน">${escapeHtml(lessonFormValue('learnerContext', saved.learnerContext || ''))}</textarea></label><label class="cl-field full"><span>อุปกรณ์หรือข้อจำกัดของห้องเรียน</span><textarea id="lesson-resource-context" class="form-control" rows="2" maxlength="1000" placeholder="เช่น มีอุปกรณ์ทดลอง 5 ชุด ใช้โทรศัพท์ได้บางส่วน">${escapeHtml(lessonFormValue('resourceContext', saved.resourceContext || ''))}</textarea></label><label class="cl-field full"><span>สิ่งที่ครูอยากเน้นเป็นพิเศษ</span><textarea id="lesson-focus" class="form-control" rows="2" maxlength="1000" placeholder="เช่น เน้นการอธิบายด้วยหลักฐาน และให้มีการประเมินระหว่างเรียน">${escapeHtml(lessonFormValue('focus', saved.focus || ''))}</textarea></label></div>
      ${aiQuotaHtml()}<div class="cl-context-card"><i class="hgi-stroke hgi-information-circle"></i><span>${isGuidance ? 'ระบบจะแยกเป้าหมายระดับหน่วยออกจากจุดประสงค์ของแผนรายครั้ง ครูตรวจและแก้ไขได้ก่อนบันทึก' : 'ระบบจะส่งกรอบและมาตรฐานจากคลังไปสร้างร่างแผน ครูตรวจและแก้ไขแบบฟอร์มได้ก่อนบันทึก'}</span></div><div class="cl-actions"><button class="btn" type="button" onclick="closeLessonPlanCreator()">ยกเลิก</button><button class="btn btn-primary" type="button" onclick="generateLessonPlanDraft()"${state.aiQuota?.remaining === 0 ? ' disabled aria-disabled="true"' : ''}><i class="hgi-stroke hgi-ai-magic"></i> ${state.aiQuota?.remaining === 0 ? 'โควตาครบแล้ว' : isGuidance ? 'สร้างร่างแผนกิจกรรม' : 'สร้างร่างแผน'}</button></div></section></div>`;
  }
  function lessonProcessing(show) { document.getElementById('lesson-processing-overlay')?.classList.toggle('show', show); }
  function ensureLessonProcessingOverlay() { if (document.getElementById('lesson-processing-overlay')) return; const overlay = document.createElement('div'); overlay.id = 'lesson-processing-overlay'; overlay.className = 'cl-processing'; overlay.setAttribute('role','status'); overlay.innerHTML = '<div class="cl-processing-card"><div class="cl-processing-spinner"></div><h3>AI กำลังจัดทำร่างแผน</h3><p>กำลังเรียบเรียงกิจกรรมและการประเมินให้ตรงกับกรอบที่เลือก<br>กรุณารอสักครู่ และไม่ต้องกดซ้ำ</p></div>'; document.body.appendChild(overlay); }
  window.generateLessonPlanDraft = async function () {
    if (state.aiQuota?.remaining === 0) { showToast('วันนี้ใช้โควตาการสร้าง AI ครบแล้ว กรุณาลองใหม่พรุ่งนี้', 'warning'); return; }
    captureLessonForm();
    const room = selectedClass(); const form = state.lessonForm || {}; const topic = String(form.topic || '').trim(); const indicators = selectedLessonIndicators(); const subjectName = selectedLessonSubjectName(); const grade = gradeLabel(state.grade);
    if (!room) { showToast('กรุณาเลือกห้องเรียนก่อนสร้างแผน', 'warning'); return; }
    if (!subjectName || !state.grade) { showToast('กรุณาเลือกกิจกรรม/กลุ่มสาระและระดับชั้น', 'warning'); return; }
    if (!String(form.courseName || '').trim()) { showToast('กรุณาระบุชื่อรายวิชาที่สอนจริง', 'warning'); return; }
    if (topic.length < 3) { showToast('กรุณาระบุหัวข้อบทเรียน', 'warning'); return; }
    if (!indicators.length) { showToast('กรุณาเลือกตัวชี้วัดอย่างน้อย 1 ข้อ', 'warning'); return; }
    const choice = String(form.durationChoice || '50');
    const durationMinutes = choice === 'custom' ? Number(form.durationMinutes) : Number(choice);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) { showToast('กรุณาระบุเวลาเรียนเป็นนาที ตั้งแต่ 1 ถึง 600 นาที', 'warning'); return; }
    const planNumber = Math.max(1, Number.parseInt(form.planNumber, 10) || nextLessonPlanNumber(form));
    const classSections = String(form.classSections || room.className || '').split(/[\n,，]+/).map(item => item.trim()).filter(Boolean);
    const standards = lessonStandardRows(indicators).map(item => ({ id:item.id, code:item.code, title:item.title, subjectId:state.subjectId, sourceId:catalog()?.getSubject(state.subjectId)?.dataset?.source?.id || '' }));
    const override = String(form.standardOverride || '').trim();
    if (override) standards.push({ id:'teacher-override', code:'ครูระบุ', title:override, subjectId:state.subjectId, sourceId:'teacher' });
    const planTitle = state.subjectId === 'guidance' ? `แผนการจัดกิจกรรมแนะแนวที่ ${planNumber}` : `แผนการจัดการเรียนรู้ที่ ${planNumber}`;
    const unitNumber = String(form.unitNumber || '').trim(); const unitName = String(form.unitName || '').trim();
    const payload = {
      title:planTitle, planNumber, classId:room.id, classLabel:`${String(form.courseName).trim()} · ${classSections.join(', ') || room.className}`,
      classSections, subjectId:state.subjectId, subjectGroup:subjectName, subject:subjectName,
      courseName:String(form.courseName).trim(), courseCode:String(form.courseCode || '').trim(), grade, topic,
      semester:String(form.semester || '1'), academicYear:String(form.academicYear || ''),
      unitNumber, unitName, unitObjective:String(form.unitObjective || '').trim(), yearObjective:String(form.yearObjective || '').trim(), unitHours:String(form.unitHours || '').trim(),
      unitKey:lessonUnitScopeKey({ subjectId:state.subjectId, courseName:String(form.courseName || '').trim(), courseCode:String(form.courseCode || '').trim(), grade, academicYear:String(form.academicYear || ''), semester:String(form.semester || '1'), unitNumber, unitName }),
      teacherName:String(form.teacherName || '').trim(), teacherCode:String(form.teacherCode || '').trim(),
      durationMinutes, duration:formatLessonDuration(durationMinutes), method:String(form.method || '').trim(),
      standards, indicators:indicators.map(row => indicatorReference(row)), standardOverride:override,
      learnerContext:String(form.learnerContext || '').trim(), resourceContext:String(form.resourceContext || '').trim(), focus:String(form.focus || '').trim()
    };
    ensureLessonProcessingOverlay(); lessonProcessing(true);
    try { const session = await supabaseClient?.auth?.getSession(); const token = session?.data?.session?.access_token; const response = await fetch(apiPath('/api/ai/generate-lesson-plan'), { method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) }, body:JSON.stringify(payload) }); const result = await response.json().catch(() => ({})); applyAiQuota(result.quota); if (!response.ok) { updateAiQuotaUi(); throw new Error(result.message || result.error || 'ไม่สามารถสร้างแผนการสอนได้'); } const generatedPlan = { ...result.plan, title:planTitle }; const generatedUnitObjective = payload.unitObjective || String(generatedPlan.unitObjective || '').trim(); delete generatedPlan.unitObjective; state.lessonDraft = { ...payload, unitObjective:generatedUnitObjective, id:uid(), createdAt:new Date().toISOString(), plan:generatedPlan, warnings:Array.isArray(result.warnings) ? result.warnings : [] }; state.lessonDraftOrigin = 'new'; state.lessonEditing = false; state.lessonView = 'review'; render(); } catch (error) { console.warn('Lesson plan generation failed:', error); showToast(`สร้างแผนไม่สำเร็จ: ${error.message || 'กรุณาลองใหม่'}`, 'warning', 7000); } finally { lessonProcessing(false); }
  };
  function listHtml(items) { return Array.isArray(items) && items.length ? `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : `<p>${escapeHtml(Array.isArray(items) ? 'ยังไม่ได้ระบุ' : items || 'ยังไม่ได้ระบุ')}</p>`; }
  const lessonFieldLabels = { keyConcepts:'สาระสำคัญ', objectives:'จุดประสงค์การเรียนรู้', contentKnowledge:'สาระการเรียนรู้: ความรู้', contentSkills:'สาระการเรียนรู้: ทักษะ/กระบวนการ', competencies:'สมรรถนะสำคัญ', desirableCharacteristics:'คุณลักษณะอันพึงประสงค์', skills21:'ความสามารถและทักษะในศตวรรษที่ 21', workProducts:'ชิ้นงาน/ภาระงาน', activities:'ขั้นตอนกิจกรรมการเรียนรู้', resources:'สื่อและแหล่งเรียนรู้', assessment:'การวัดและประเมินผลเพิ่มเติม', assessmentMatrix:'ตารางการวัดและประเมินผล', evidence:'หลักฐานที่ควรเก็บ', suggestedActivities:'กิจกรรมเสนอแนะ', adaptations:'คำแนะนำการปรับใช้' };
  function lessonFieldText(field, value) { return field === 'assessmentMatrix' ? (Array.isArray(value) ? value.map(item => [item.domain, item.target, item.instrument, item.criterion].filter(Boolean).join(' | ')).join('\n') : '') : (Array.isArray(value) ? value.join('\n') : value || ''); }
  function lessonEditField(field, value) { return `<label class="cl-plan-edit-field"><span>${lessonFieldLabels[field] || field}</span><small>${field === 'assessmentMatrix' ? 'กรอกแต่ละแถวเป็น สิ่งที่ประเมิน | เป้าหมาย | เครื่องมือ | เกณฑ์' : 'เขียนแยกข้อด้วยการขึ้นบรรทัดใหม่'}</small><textarea class="form-control" rows="5" oninput="setLessonPlanField('${field}', this.value)">${escapeHtml(lessonFieldText(field, value))}</textarea></label>`; }
  function lessonMetaEditHtml(d, p) { const guidance = d.subjectId === 'guidance'; return `<div class="cl-plan-meta-edit"><label class="cl-field full"><span>${guidance ? 'ชื่อแผนกิจกรรมแนะแนว' : 'ชื่อแผนการสอน'}</span><input class="form-control" maxlength="240" value="${escapeHtml(p.title || d.title || d.topic || '')}" oninput="setLessonPlanTitle(this.value)"></label><label class="cl-field"><span>${guidance ? 'เลขแผนกิจกรรม' : 'เลขแผน'}</span><input class="form-control" type="number" min="1" value="${escapeHtml(d.planNumber || 1)}" oninput="setLessonMetaField('planNumber', this.value)"></label><label class="cl-field"><span>รายวิชาที่สอน</span><input class="form-control" maxlength="180" value="${escapeHtml(d.courseName || '')}" oninput="setLessonMetaField('courseName', this.value)"></label><label class="cl-field"><span>รหัสวิชา</span><input class="form-control" maxlength="80" value="${escapeHtml(d.courseCode || '')}" oninput="setLessonMetaField('courseCode', this.value)"></label><label class="cl-field"><span>ระดับชั้น</span><input class="form-control" maxlength="80" value="${escapeHtml(d.grade || '')}" oninput="setLessonMetaField('grade', this.value)"></label><label class="cl-field"><span>ภาคเรียน / ปีการศึกษา</span><input class="form-control" maxlength="30" value="${escapeHtml(d.semester || '')} / ${escapeHtml(d.academicYear || '')}" oninput="setLessonMetaField('termYear', this.value)"></label><label class="cl-field"><span>${guidance ? 'หน่วยการจัดกิจกรรมที่' : 'หน่วยการเรียนรู้ที่'}</span><input class="form-control" maxlength="40" value="${escapeHtml(d.unitNumber || '')}" oninput="setLessonMetaField('unitNumber', this.value)"></label><label class="cl-field"><span>${guidance ? 'ชื่อหน่วยการจัดกิจกรรม' : 'ชื่อหน่วยการเรียนรู้'}</span><input class="form-control" maxlength="200" value="${escapeHtml(d.unitName || '')}" oninput="setLessonMetaField('unitName', this.value)"></label>${guidance ? `<label class="cl-field full"><span>วัตถุประสงค์ชั้นปี</span><textarea class="form-control" rows="2" maxlength="1200" oninput="setLessonMetaField('yearObjective', this.value)">${escapeHtml(d.yearObjective || '')}</textarea></label><label class="cl-field full"><span>วัตถุประสงค์ของหน่วยการจัดกิจกรรม</span><textarea class="form-control" rows="2" maxlength="1200" oninput="setLessonMetaField('unitObjective', this.value)">${escapeHtml(d.unitObjective || p.unitObjective || '')}</textarea></label><label class="cl-field"><span>เวลาเรียนรวมของหน่วย (ชั่วโมง)</span><input class="form-control" type="number" min="0.5" max="300" step="0.5" value="${escapeHtml(d.unitHours || '')}" oninput="setLessonMetaField('unitHours', this.value)"></label>` : ''}<label class="cl-field full"><span>ชั้น/ห้องที่ใช้แผน</span><input class="form-control" maxlength="240" value="${escapeHtml((d.classSections || []).join(', '))}" oninput="setLessonMetaField('classSectionsText', this.value)"></label><label class="cl-field full"><span>${guidance ? 'หัวข้อกิจกรรม' : 'หัวข้อบทเรียน'}</span><input class="form-control" maxlength="240" value="${escapeHtml(d.topic || '')}" oninput="setLessonMetaField('topic', this.value)"></label><label class="cl-field"><span>${guidance ? 'เวลาเรียนแผนนี้ (นาที)' : 'เวลาเรียน (นาที)'}</span><input class="form-control" type="number" min="1" max="600" value="${escapeHtml(d.durationMinutes || '')}" oninput="setLessonDurationMinutes(this.value)"></label><label class="cl-field"><span>รูปแบบการเรียนรู้</span><input class="form-control" maxlength="120" value="${escapeHtml(d.method || '')}" oninput="setLessonMetaField('method', this.value)"></label></div>`; }
  function lessonSectionHtml(title, values, wide = false) { return `<article class="${wide ? 'cl-plan-wide' : ''}"><h3>${escapeHtml(title)}</h3>${listHtml(values)}</article>`; }
  function lessonPlanContentHtml(d, p) {
    const assessmentRows = Array.isArray(p.assessmentMatrix) ? p.assessmentMatrix.map(item => [item.domain, item.target, item.instrument, item.criterion].filter(Boolean).join(' · ')) : [];
    const isGuidance = d.subjectId === 'guidance';
    const standards = (d.standards || []).map(item => `${item.code || ''} ${item.title || ''}`.trim());
    const indicators = (d.indicators || []).map(item => `${item.code || ''} ${item.text || ''}`.trim());
    const guidanceContent = [...(Array.isArray(p.contentKnowledge) ? p.contentKnowledge.map(item => `ความรู้: ${item}`) : []), ...(Array.isArray(p.contentSkills) ? p.contentSkills.map(item => `ทักษะ/กระบวนการ: ${item}`) : [])];
    const unitObjective = d.unitObjective || p.unitObjective || '';
    const unitSummary = isGuidance ? `<section class="cl-guidance-unit-summary"><div class="cl-guidance-unit-heading"><div><span>ภาพรวมหน่วยการจัดกิจกรรม ${escapeHtml(d.unitNumber || '....')}</span><h3>${escapeHtml(d.unitName || '................................')}</h3></div>${d.unitHours ? `<span class="cl-guidance-hours">${escapeHtml(d.unitHours)} ชั่วโมงรวม</span>` : ''}</div><div class="cl-guidance-unit-goals"><div><strong>กรอบแนะแนวที่อ้างอิง</strong>${listHtml(standards)}</div><div><strong>ผลลัพธ์ที่เลือกสำหรับหน่วย</strong>${listHtml(indicators)}</div><div><strong>วัตถุประสงค์ชั้นปี</strong>${listHtml(d.yearObjective || 'ครูตรวจและเติมจากหลักสูตรสถานศึกษา')}</div><div><strong>วัตถุประสงค์ของหน่วย</strong>${listHtml(unitObjective || 'ยังไม่ได้ระบุ')}</div></div></section>` : '';
    const guidanceLessonSections = isGuidance ? `${lessonSectionHtml('1. สาระสำคัญ', p.keyConcepts)}${lessonSectionHtml('2. จุดประสงค์การเรียนรู้', p.objectives)}${lessonSectionHtml('3. สาระการเรียนรู้', guidanceContent)}${lessonSectionHtml('4. วิธีดำเนินกิจกรรม', p.activities, true)}${lessonSectionHtml('5. ชิ้นงาน/ภาระงาน', p.workProducts)}${lessonSectionHtml('6. สื่อ/อุปกรณ์/แหล่งเรียนรู้', p.resources)}${lessonSectionHtml('7. การวัดและประเมินผล', assessmentRows, true)}${lessonSectionHtml('รายละเอียดการประเมินเพิ่มเติม', p.assessment)}${lessonSectionHtml('หลักฐานที่ควรเก็บ', p.evidence)}` : `${lessonSectionHtml('มาตรฐานการเรียนรู้', standards)}${lessonSectionHtml('ตัวชี้วัด/ผลการเรียนรู้', indicators)}${lessonSectionHtml('สาระสำคัญ', p.keyConcepts)}${lessonSectionHtml('จุดประสงค์การเรียนรู้', p.objectives)}${lessonSectionHtml('สาระการเรียนรู้: ความรู้', p.contentKnowledge)}${lessonSectionHtml('สาระการเรียนรู้: ทักษะ/กระบวนการ', p.contentSkills)}${lessonSectionHtml('ชิ้นงาน/ภาระงาน', p.workProducts)}${lessonSectionHtml('ขั้นตอนกิจกรรมการเรียนรู้', p.activities, true)}${lessonSectionHtml('สื่อ/อุปกรณ์/แหล่งเรียนรู้', p.resources)}${lessonSectionHtml('การวัดและประเมินผล', assessmentRows)}${lessonSectionHtml('รายละเอียดการประเมินเพิ่มเติม', p.assessment)}${lessonSectionHtml('หลักฐานที่ควรเก็บ', p.evidence)}`;
    const guidanceAdditionalSections = isGuidance ? `${lessonSectionHtml('สมรรถนะสำคัญ', p.competencies)}${lessonSectionHtml('คุณลักษณะอันพึงประสงค์', p.desirableCharacteristics)}${lessonSectionHtml('ความสามารถและทักษะในศตวรรษที่ 21', p.skills21)}${lessonSectionHtml('กิจกรรมเสนอแนะ', p.suggestedActivities)}${lessonSectionHtml('คำแนะนำการปรับใช้', p.adaptations)}` : `${lessonSectionHtml('สมรรถนะสำคัญ', p.competencies)}${lessonSectionHtml('คุณลักษณะอันพึงประสงค์', p.desirableCharacteristics)}${lessonSectionHtml('ความสามารถและทักษะในศตวรรษที่ 21', p.skills21)}${lessonSectionHtml('กิจกรรมเสนอแนะ', p.suggestedActivities)}${lessonSectionHtml('คำแนะนำการปรับใช้', p.adaptations)}`;
    const sharedHeading = `<div class="cl-plan-form-heading"><h2>${escapeHtml(p.title || d.title || (isGuidance ? 'แผนการจัดกิจกรรมแนะแนว' : 'แผนการจัดการเรียนรู้'))}</h2><div class="cl-plan-form-metadata"><span><strong>รายวิชา</strong>${escapeHtml(d.courseName || '................................')}${d.courseCode ? ` (${escapeHtml(d.courseCode)})` : ''}</span><span><strong>ระดับชั้น</strong>${escapeHtml(d.grade || '................................')}</span><span><strong>ภาคเรียน/ปีการศึกษา</strong>${escapeHtml(d.semester || '....')} / ${escapeHtml(d.academicYear || '........')}</span><span><strong>${isGuidance ? 'หน่วยการจัดกิจกรรม' : 'หน่วยการเรียนรู้'}</strong>${escapeHtml(d.unitNumber || '....')} ${escapeHtml(d.unitName || '')}</span><span><strong>เรื่อง</strong>${escapeHtml(d.topic || '................................')}</span><span><strong>เวลาเรียนในแผนนี้</strong>${escapeHtml(d.duration || '................................')}</span><span><strong>ครูผู้สอน</strong>${escapeHtml(d.teacherName || '................................')}${d.teacherCode ? ` · ${escapeHtml(d.teacherCode)}` : ''}</span><span><strong>ชั้น/ห้อง</strong>${escapeHtml((d.classSections || []).join(', ') || '................................')}</span><span><strong>กลุ่มสาระ/กิจกรรม</strong>${escapeHtml(d.subjectGroup || d.subject || '................................')}</span></div></div>`;
    return `${sharedHeading}${unitSummary}<div class="cl-plan-grid">${guidanceLessonSections}${guidanceAdditionalSections}</div><section class="cl-plan-after-class"><h3>บันทึกหลังการจัดการเรียนรู้</h3><p>ผลการจัดการเรียนรู้ ................................................................................................................................................</p><p>ปัญหา/อุปสรรค ........................................................................................................................................................</p><p>แนวทางแก้ไข/ข้อเสนอแนะ .......................................................................................................................................</p></section>`;
  }
  function lessonReviewHtml() { const d = state.lessonDraft; if (!d) return lessonFormHtml(); const p = d.plan || {}; const editing = state.lessonEditing; return `<div class="cl-wizard cl-lesson-wizard"><div class="cl-wizard-top"><button class="btn" type="button" onclick="leaveLessonPlanReview()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับคลัง</span></button><div class="cl-wizard-title"><span class="cl-create-icon lesson-plan"><i class="hgi-stroke hgi-presentation-01"></i></span><div><h2>${editing ? (d.subjectId === 'guidance' ? 'แก้ไขแผนกิจกรรมแนะแนว' : 'แก้ไขแผนการสอน') : (d.subjectId === 'guidance' ? 'ตรวจร่างแผนกิจกรรมแนะแนว' : 'ตรวจร่างแผนการสอน')}</h2><p>${escapeHtml(d.classLabel)} · ${escapeHtml(d.topic)}</p></div></div></div><div class="cl-stepper"><span class="cl-step"><b>1</b> กำหนดกรอบ</span><span class="cl-step active"><b>2</b> ${editing ? 'แก้ไขแผน' : 'ตรวจร่าง'}</span><span class="cl-step"><b>3</b> บันทึกเข้าคลัง</span></div>${d.warnings?.length ? `<div class="cl-quality-warning"><i class="hgi-stroke hgi-alert-02"></i><div><strong>ข้อควรตรวจสอบ</strong><p>${d.warnings.map(escapeHtml).join('<br>')}</p></div></div>` : ''}<section class="card cl-plan-preview"><header><span class="cl-saved-type cl-plan-type"><i class="hgi-stroke hgi-presentation-01"></i> ${editing ? 'แก้ไขได้' : 'ร่างโดย AI'}</span><p>${escapeHtml(d.classLabel)} · ${escapeHtml(d.duration)} · ${escapeHtml(d.method)}</p></header>${editing ? `${lessonMetaEditHtml(d,p)}<div class="cl-plan-edit-grid">${Object.keys(lessonFieldLabels).map(field => lessonEditField(field,p[field])).join('')}</div>` : lessonPlanContentHtml(d,p)}</section><div class="cl-review-bottom"><span>${editing ? 'แก้ไขข้อมูลแล้วกดบันทึกเข้าคลังได้ทันที' : 'แผนนี้เป็นร่าง ครูตรวจและแก้ไขก่อนบันทึกได้'}</span><div class="cl-actions">${editing ? `<button class="btn" type="button" onclick="toggleLessonPlanEditing()">เสร็จสิ้นการแก้ไข</button>` : `<button class="btn" type="button" onclick="toggleLessonPlanEditing()"><i class="hgi-stroke hgi-edit-02"></i> แก้ไขแผน</button>`}<button class="btn btn-primary" type="button" onclick="saveLessonPlanDraft()"><i class="hgi-stroke hgi-floppy-disk"></i> บันทึกเข้าคลัง</button></div></div></div>`; }
  window.setLessonPlanField = function (field, value) { if (!state.lessonDraft?.plan) return; if (field === 'unitObjective') { state.lessonDraft.plan.unitObjective = String(value || '').trim(); return; } const rows = String(value || '').split('\n').map(item => item.trim()).filter(Boolean); state.lessonDraft.plan[field] = field === 'assessmentMatrix' ? rows.map(line => { const [domain='',target='',instrument='',criterion=''] = line.split('|').map(item => item.trim()); return { domain,target,instrument,criterion }; }) : rows; };
  window.setLessonPlanTitle = function (value) { if (!state.lessonDraft?.plan) return; const title = String(value || '').trim(); state.lessonDraft.plan.title = title; state.lessonDraft.title = title || state.lessonDraft.topic || ''; };
  window.setLessonMetaField = function (field, value) { if (!state.lessonDraft) return; const text = String(value || '').trim(); if (field === 'termYear') { const match = text.match(/^(.+?)\s*\/\s*(\d{4})$/); if (match) { state.lessonDraft.semester = match[1]; state.lessonDraft.academicYear = match[2]; state.lessonDraft.unitKey = lessonUnitScopeKey(state.lessonDraft); } return; } if (field === 'classSectionsText') { state.lessonDraft.classSections = text.split(/[\n,，]+/).map(item => item.trim()).filter(Boolean); state.lessonDraft.classLabel = `${state.lessonDraft.courseName || state.lessonDraft.subjectGroup || ''} · ${state.lessonDraft.classSections.join(', ')}`.trim(); return; } state.lessonDraft[field] = text; state.lessonDraft.unitKey = lessonUnitScopeKey(state.lessonDraft); if (field === 'courseName' || field === 'courseCode') state.lessonDraft.classLabel = `${state.lessonDraft.courseName || state.lessonDraft.subjectGroup || ''}${state.lessonDraft.courseCode ? ` (${state.lessonDraft.courseCode})` : ''} · ${(state.lessonDraft.classSections || []).join(', ')}`.trim(); if (field === 'planNumber') { state.lessonDraft.planNumber = Math.max(1, Number.parseInt(text, 10) || 1); state.lessonDraft.plan.title = `${state.lessonDraft.subjectId === 'guidance' ? 'แผนการจัดกิจกรรมแนะแนวที่' : 'แผนการจัดการเรียนรู้ที่'} ${state.lessonDraft.planNumber}`; state.lessonDraft.title = state.lessonDraft.plan.title; } };
  window.setLessonDurationMinutes = function (value) { if (!state.lessonDraft) return; const minutes = Number(value); if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) return; state.lessonDraft.durationMinutes = minutes; state.lessonDraft.duration = formatLessonDuration(minutes); };
  window.toggleLessonPlanEditing = function () { state.lessonEditing = !state.lessonEditing; render(); };
  window.leaveLessonPlanReview = function () { if (state.lessonDraftOrigin === 'new' && !window.confirm('แผนนี้ยังไม่ได้บันทึกเข้าคลัง ต้องการกลับคลังและทิ้งร่างนี้หรือไม่?')) return; closeLessonPlanCreator(); };
  window.backToLessonSettings = function () { state.lessonIndicatorCodes = Array.isArray(state.lessonDraft?.indicators) ? state.lessonDraft.indicators.map(item => item.code) : []; state.subjectId = state.lessonDraft?.subjectId || state.subjectId; state.grade = gradeIdFromLabel(state.lessonDraft?.grade || state.grade); state.lessonForm = {}; state.lessonView = 'form'; render(); };
  window.saveLessonPlanDraft = function () { if (!state.lessonDraft?.plan) { showToast('ยังไม่มีร่างแผนการสอน', 'warning'); return; } const cleanTitle = String(state.lessonDraft.plan.title || state.lessonDraft.title || state.lessonDraft.topic || '').trim(); if (!cleanTitle) { showToast('กรุณาระบุชื่อแผนการสอน', 'warning'); return; } const savedPlan = { ...state.lessonDraft, title:cleanTitle, plan:{ ...state.lessonDraft.plan, title:cleanTitle }, status:'draft', type:'lesson_plan', linkedQuizIds:Array.isArray(state.lessonDraft.linkedQuizIds) ? state.lessonDraft.linkedQuizIds : [], linkedWorksheetIds:Array.isArray(state.lessonDraft.linkedWorksheetIds) ? state.lessonDraft.linkedWorksheetIds : [] }; delete savedPlan.runs; appState.mediaLibrary = library().filter(item => item.id !== savedPlan.id); appState.mediaLibrary.push(savedPlan); saveState(); state.lessonDraft = typeof structuredClone === 'function' ? structuredClone(savedPlan) : JSON.parse(JSON.stringify(savedPlan)); state.lessonDraftOrigin = 'saved'; state.lessonView = 'detail'; state.lessonEditing = false; render(); showToast('บันทึกแผนเข้าคลังแล้ว'); };
  window.openSavedLessonPlan = function (id) { const plan = library().find(item => item.id === id && item.type === 'lesson_plan'); if (!plan) { showToast('ไม่พบแผนการสอนนี้', 'warning'); return; } state.lessonDraft = typeof structuredClone === 'function' ? structuredClone(plan) : JSON.parse(JSON.stringify(plan)); state.subjectId = state.lessonDraft.subjectId || subjectIdFromName(state.lessonDraft.subjectGroup || state.lessonDraft.subject); state.grade = gradeIdFromLabel(state.lessonDraft.grade || ''); state.lessonIndicatorCodes = (state.lessonDraft.indicators || []).map(item => item.code).filter(Boolean); state.lessonDraftOrigin = 'saved'; state.lessonEditing = false; state.lessonView = 'detail'; render(); };
  function clone(value) { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
  function saveLessonPlan(plan) { const savedPlan = { ...plan, title:plan.plan?.title || plan.title || plan.topic || 'แผนการสอน', type:'lesson_plan', status:plan.status || 'draft' }; delete savedPlan.runs; appState.mediaLibrary = library().some(item => item.id === savedPlan.id) ? library().map(item => item.id === savedPlan.id ? savedPlan : item) : [...library(), savedPlan]; saveState(); state.lessonDraft = clone(savedPlan); }
  function linkedLessonQuizzes(plan) { const ids = Array.isArray(plan.linkedQuizIds) ? plan.linkedQuizIds : []; return library().filter(item => item.type === 'quiz' && ids.includes(item.id)); }
  function linkedLessonWorksheets(plan) { const ids = Array.isArray(plan.linkedWorksheetIds) ? plan.linkedWorksheetIds : []; return library().filter(item => item.type === 'worksheet' && ids.includes(item.id)); }
  async function loadLessonPlanMediaAssets(planId) {
    if (!planId || state.lessonMediaAssetsLoadingFor === planId) return;
    if (!supabaseClient) {
      state.lessonMediaAssetsPlanId = planId;
      state.lessonMediaAssetsError = 'ยังเชื่อมต่อฐานข้อมูลไม่ได้';
      render();
      return;
    }
    state.lessonMediaAssetsLoadingFor = planId;
    state.lessonMediaAssetsError = '';
    render();
    try {
      const { data, error } = await supabaseClient.from('lesson_plan_media_assets')
        .select('artifact_id,job_id,title,created_at')
        .eq('lesson_plan_id', planId)
        .is('deleted_at', null)
        .order('created_at', { ascending:false });
      if (error) throw error;
      if (state.lessonDraft?.id === planId) {
        state.lessonMediaAssets = Array.isArray(data) ? data : [];
        state.lessonMediaAssetsPlanId = planId;
      }
    } catch (error) {
      if (state.lessonDraft?.id === planId) {
        state.lessonMediaAssets = [];
        state.lessonMediaAssetsPlanId = planId;
        state.lessonMediaAssetsError = error.message || 'โหลดรายการสื่อไม่สำเร็จ';
      }
    } finally {
      if (state.lessonMediaAssetsLoadingFor === planId) state.lessonMediaAssetsLoadingFor = '';
      if (state.lessonView === 'detail' && state.lessonDraft?.id === planId) render();
    }
  }
  function lessonPlanMediaAssetsHtml(planId) {
    if (state.lessonMediaAssetsLoadingFor === planId || state.lessonMediaAssetsPlanId !== planId) {
      return '<div class="cl-plan-empty-link"><i class="hgi-stroke hgi-refresh"></i><span>กำลังโหลดสื่อที่สร้างจากแผนนี้…</span></div>';
    }
    if (state.lessonMediaAssetsError) {
      return `<div class="cl-plan-empty-link"><i class="hgi-stroke hgi-alert-02"></i><span>${escapeHtml(state.lessonMediaAssetsError)}</span><button class="btn" type="button" onclick="reloadLessonPlanMediaAssets()">ลองอีกครั้ง</button></div>`;
    }
    const items = state.lessonMediaAssets;
    if (!items.length) return '<div class="cl-plan-empty-link"><i class="hgi-stroke hgi-magic-wand-01"></i><span>สื่อโต้ตอบที่สร้างจากแผนนี้จะแสดงที่นี่</span></div>';
    return items.map(item => {
      const createdAt = item.created_at ? new Date(item.created_at).toLocaleString('th-TH') : 'ไม่ทราบวันที่';
      return `<button class="cl-plan-linked-item" type="button" onclick="openLessonLinkedMedia('${escapeHtml(item.job_id)}')"><span class="cl-saved-type cl-plan-type"><i class="hgi-stroke hgi-magic-wand-01"></i> สื่อโต้ตอบ</span><strong>${escapeHtml(item.title || 'สื่อการเรียนรู้')}</strong><small>${escapeHtml(createdAt)} · เปิดตัวอย่าง</small><i class="hgi-stroke hgi-arrow-right-01"></i></button>`;
    }).join('');
  }
  window.reloadLessonPlanMediaAssets = function () {
    state.lessonMediaAssetsPlanId = '';
    state.lessonMediaAssetsError = '';
    render();
  };
  window.openLessonLinkedMedia = async function (jobId) {
    const tab = window.open('about:blank', '_blank');
    if (!tab) { showToast('เบราว์เซอร์บล็อกหน้าต่างใหม่ กรุณาอนุญาตแล้วลองอีกครั้ง', 'warning'); return; }
    tab.opener = null;
    try {
      const session = await supabaseClient?.auth?.getSession();
      const token = session?.data?.session?.access_token;
      if (!token) throw new Error('กรุณาเข้าสู่ระบบใหม่ก่อนเปิดสื่อ');
      const path = `/api/v5/jobs/${encodeURIComponent(jobId)}/preview`;
      const endpoint = window.location.protocol === 'file:' ? `https://classkru-kohl.vercel.app${path}` : path;
      const response = await fetch(endpoint, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:'{}' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.preview_url) throw new Error(result.error || 'เปิดสื่อไม่สำเร็จ');
      const base = window.location.protocol === 'file:' ? 'https://classkru-kohl.vercel.app' : window.location.origin;
      tab.location.replace(new URL(result.preview_url, base).href);
    } catch (error) {
      tab.close();
      showToast(`เปิดสื่อไม่สำเร็จ: ${error.message || 'กรุณาลองใหม่'}`, 'warning', 7000);
    }
  };
  function lessonDetailHtml() {
    const d = state.lessonDraft;
    if (!d?.plan) { state.lessonView = 'home'; return homeHtml(); }
    const p = d.plan; const quizzes = linkedLessonQuizzes(d); const worksheets = linkedLessonWorksheets(d);
    const interactiveMediaList = lessonPlanMediaAssetsHtml(d.id);
    const quizList = quizzes.length ? quizzes.map(quiz => `<button class="cl-plan-linked-item" type="button" onclick="openQuizDetail('${escapeHtml(quiz.id)}')"><span class="cl-saved-type"><i class="hgi-stroke hgi-task-02"></i> ข้อสอบ</span><strong>${escapeHtml(quiz.title || 'ข้อสอบไม่มีชื่อ')}</strong><small>${Number(quiz.questions?.length || 0)} ข้อ · เปิดรายละเอียด</small><i class="hgi-stroke hgi-arrow-right-01"></i></button>`).join('') : '<div class="cl-plan-empty-link"><i class="hgi-stroke hgi-task-02"></i><span>ยังไม่ได้เชื่อมแบบทดสอบกับแผนนี้</span></div>';
    const worksheetList = worksheets.length ? worksheets.map(item => `<button class="cl-plan-linked-item worksheet" type="button" onclick="openSavedWorksheet('${escapeHtml(item.id)}')"><span class="cl-saved-type cl-worksheet-type"><i class="hgi-stroke hgi-note-02"></i> ใบงาน</span><strong>${escapeHtml(item.title || 'ใบงานไม่มีชื่อ')}</strong><small>${escapeHtml(item.activityType || 'กิจกรรม')} · เปิดรายละเอียด</small><i class="hgi-stroke hgi-arrow-right-01"></i></button>`).join('') : '<div class="cl-plan-empty-link"><i class="hgi-stroke hgi-note-02"></i><span>ยังไม่ได้เชื่อมใบงานกับแผนนี้</span></div>';
    return `<div class="cl-wizard cl-lesson-detail"><div class="cl-wizard-top"><button class="btn" type="button" onclick="backToLessonLibrary()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับคลัง</span></button><div class="cl-wizard-title"><span class="cl-create-icon lesson-plan"><i class="hgi-stroke hgi-presentation-01"></i></span><div><h2>รายละเอียดแผนการสอน</h2><p>จัดการแผนและสื่อที่เกี่ยวข้องได้จากหน้านี้</p></div></div></div><section class="card cl-plan-detail-head"><div><span class="cl-saved-type cl-plan-type"><i class="hgi-stroke hgi-presentation-01"></i> แผนการสอน</span><h2>${escapeHtml(p.title || d.topic || 'แผนการสอนไม่มีชื่อ')}</h2><p>${escapeHtml(d.classLabel || 'ยังไม่ได้เชื่อมห้องเรียน')} · ${escapeHtml(d.duration || 'ไม่ระบุเวลา')} · ${escapeHtml(d.method || 'ไม่ระบุรูปแบบ')}</p><div class="cl-detail-indicators">${(d.indicators || []).map(item => `<span>${escapeHtml(item.code)}</span>`).join('')}</div></div><div class="cl-detail-actions"><button class="btn cl-export-btn word" type="button" data-export-plan="word" onclick="exportLessonPlanDocx()"><i class="hgi-stroke hgi-file-download"></i> ส่งออกแผน</button><button class="btn cl-export-btn pdf" type="button" data-export-plan="pdf" title="เปิดหน้าพิมพ์เพื่อเลือกบันทึกเป็น PDF ขนาด A4" onclick="exportLessonPlanPdf()"><i class="hgi-stroke hgi-printer"></i> PDF · แบบฟอร์ม A4</button><button class="btn btn-primary cl-export-btn pack" type="button" data-export-plan="pack" onclick="exportLessonPackDocx()"><i class="hgi-stroke hgi-files-01"></i> ส่งออกชุดเอกสารประกอบคาบ</button><button class="btn" type="button" onclick="openLessonInMiniLab()"><i class="hgi-stroke hgi-ai-magic"></i> สร้างสื่อจากแผน</button><button class="btn" type="button" onclick="editSavedLessonPlan()"><i class="hgi-stroke hgi-edit-02"></i> แก้ไขแผน</button></div></section><section class="card cl-plan-detail-section cl-plan-assets-section"><div class="cl-plan-section-head"><div><h3>สื่อและการประเมินที่เชื่อมกับแผน</h3><p>ข้อสอบและใบงานแยกเป็นคนละส่วน เพื่อให้ครูเลือกใช้ได้ตามความเหมาะสม</p></div></div><div class="cl-plan-asset-group"><div class="cl-plan-section-head"><div><h4><i class="hgi-stroke hgi-task-02"></i> แบบทดสอบ</h4><p>ข้อสอบที่บันทึกไว้ในคลังและเชื่อมกับแผนนี้</p></div><div class="cl-plan-section-actions"><button class="btn" type="button" onclick="openLessonQuizLinks()"><i class="hgi-stroke hgi-link-01"></i> เลือกข้อสอบจากคลัง</button><button class="btn btn-primary" type="button" onclick="createQuizFromLessonPlan()"><i class="hgi-stroke hgi-ai-magic"></i> สร้างข้อสอบจากแผน</button></div></div><div class="cl-plan-linked-list">${quizList}</div></div><div class="cl-plan-asset-group"><div class="cl-plan-section-head"><div><h4><i class="hgi-stroke hgi-note-02"></i> ใบงาน</h4><p>ใบงานที่บันทึกไว้ในคลังและเชื่อมกับแผนนี้</p></div><div class="cl-plan-section-actions"><button class="btn" type="button" onclick="openLessonWorksheetLinks()"><i class="hgi-stroke hgi-link-01"></i> เลือกใบงานจากคลัง</button><button class="btn btn-primary" type="button" onclick="createWorksheetFromLessonPlan()"><i class="hgi-stroke hgi-ai-magic"></i> สร้างใบงานจากแผน</button></div></div><div class="cl-plan-linked-list">${worksheetList}</div></div><div class="cl-plan-asset-group"><div class="cl-plan-section-head"><div><h4><i class="hgi-stroke hgi-magic-wand-01"></i> สื่อโต้ตอบจาก Mini Lab</h4><p>สื่อที่สร้างจากแผนนี้จะแสดงและเปิดดูได้จากรายการนี้</p></div><button class="btn" type="button" onclick="reloadLessonPlanMediaAssets()"><i class="hgi-stroke hgi-refresh"></i> รีเฟรช</button></div><div id="lesson-plan-media-assets" class="cl-plan-linked-list">${interactiveMediaList}</div></div></section><section class="card cl-plan-preview cl-plan-detail-preview"><header><h3>เนื้อหาแผน</h3><p>รายละเอียดสำหรับตรวจทานหรือส่งออกเป็น Word หรือ PDF แบบฟอร์ม A4</p></header>${lessonPlanContentHtml(d,p)}</section>${lessonQuizLinkModal(d)}${lessonWorksheetLinkModal(d)}</div>`;
  }
  window.openLessonInMiniLab = function () {
    const d = state.lessonDraft; const p = d?.plan || {}; if (!d?.id) return;
    const token = uid();
    const context = { lessonPlanId:d.id, planNumber:d.planNumber, title:p.title || d.title || d.topic, topic:d.topic, courseName:d.courseName, courseCode:d.courseCode, grade:d.grade, duration:d.duration, standards:(d.standards || []).slice(0,8), indicators:(d.indicators || []).slice(0,12), learningObjectives:(p.objectives || []).slice(0,8), subjectGroup:d.subjectGroup || d.subject };
    try { localStorage.setItem(`classkru.lesson-plan-context.${token}`, JSON.stringify(context)); }
    catch (_) { showToast('ส่งบริบทแผนไป Mini Lab ไม่สำเร็จ กรุณาลองใหม่', 'warning'); return; }
    const href = window.location.protocol === 'file:' ? new URL(`./v5.html?lessonContext=${encodeURIComponent(token)}`, window.location.href).href : new URL(`/mini-lab-v5?lessonContext=${encodeURIComponent(token)}`, window.location.origin).href;
    window.location.assign(href);
  };
  function lessonQuizLinkModal(plan) { if (!state.lessonQuizLinkOpen) return ''; const quizzes = library().filter(item => item.type === 'quiz'); const selected = Array.isArray(plan.linkedQuizIds) ? plan.linkedQuizIds : []; return `<div class="cl-detail-edit-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-quiz-link-title"><div class="cl-detail-edit-dialog"><div class="cl-detail-edit-dialog-head"><div><span class="cl-saved-type cl-plan-type"><i class="hgi-stroke hgi-link-01"></i> สื่อที่เชื่อม</span><h3 id="lesson-quiz-link-title">เชื่อมแบบทดสอบกับแผน</h3></div><button class="cl-modal-close" type="button" onclick="closeLessonQuizLinks()" aria-label="ปิด"><i class="hgi-stroke hgi-cancel-01"></i></button></div><div class="cl-detail-edit-form"><p class="cl-modal-note">เลือกข้อสอบที่ใช้ประกอบแผนนี้ได้หลายชุด ข้อสอบต้นฉบับยังอยู่ในคลังตามเดิม</p><div class="cl-link-picker">${quizzes.length ? quizzes.map(quiz => `<label><input type="checkbox" name="lesson-linked-quiz" value="${escapeHtml(quiz.id)}" ${selected.includes(quiz.id) ? 'checked' : ''}><span><strong>${escapeHtml(quiz.title || 'ข้อสอบไม่มีชื่อ')}</strong><small>${escapeHtml(quiz.classLabel || 'ยังไม่ระบุห้อง')} · ${Number(quiz.questions?.length || 0)} ข้อ</small></span></label>`).join('') : '<div class="cl-empty-library">ยังไม่มีข้อสอบในคลัง สร้างข้อสอบจากแผนนี้ได้เลย</div>'}</div></div><div class="cl-detail-edit-dialog-actions"><button class="btn" type="button" onclick="closeLessonQuizLinks()">ยกเลิก</button><button class="btn btn-primary" type="button" onclick="saveLessonPlanQuizLinks()"><i class="hgi-stroke hgi-floppy-disk"></i> บันทึกการเชื่อม</button></div></div></div>`; }
  function lessonWorksheetLinkModal(plan) { if (!state.lessonWorksheetLinkOpen) return ''; const worksheets = library().filter(item => item.type === 'worksheet'); const selected = Array.isArray(plan.linkedWorksheetIds) ? plan.linkedWorksheetIds : []; return `<div class="cl-detail-edit-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-worksheet-link-title"><div class="cl-detail-edit-dialog"><div class="cl-detail-edit-dialog-head"><div><span class="cl-saved-type cl-worksheet-type"><i class="hgi-stroke hgi-link-01"></i> สื่อที่เชื่อม</span><h3 id="lesson-worksheet-link-title">เชื่อมใบงานกับแผน</h3></div><button class="cl-modal-close" type="button" onclick="closeLessonWorksheetLinks()" aria-label="ปิด"><i class="hgi-stroke hgi-cancel-01"></i></button></div><div class="cl-detail-edit-form"><p class="cl-modal-note">เลือกใบงานที่ใช้ประกอบแผนนี้ได้หลายใบ ใบงานต้นฉบับยังอยู่ในคลังตามเดิม</p><div class="cl-link-picker">${worksheets.length ? worksheets.map(item => `<label><input type="checkbox" name="lesson-linked-worksheet" value="${escapeHtml(item.id)}" ${selected.includes(item.id) ? 'checked' : ''}><span><strong>${escapeHtml(item.title || 'ใบงานไม่มีชื่อ')}</strong><small>${escapeHtml(item.classLabel || 'ยังไม่ระบุห้อง')} · ${escapeHtml(item.activityType || 'กิจกรรม')}</small></span></label>`).join('') : '<div class="cl-empty-library">ยังไม่มีใบงานในคลัง สร้างใบงานจากแผนนี้ได้เลย</div>'}</div></div><div class="cl-detail-edit-dialog-actions"><button class="btn" type="button" onclick="closeLessonWorksheetLinks()">ยกเลิก</button><button class="btn btn-primary" type="button" onclick="saveLessonPlanWorksheetLinks()"><i class="hgi-stroke hgi-floppy-disk"></i> บันทึกการเชื่อม</button></div></div></div>`; }
  window.editSavedLessonPlan = function () { state.lessonEditing = true; state.lessonView = 'review'; render(); };
  window.openLessonQuizLinks = function () { state.lessonQuizLinkOpen = true; render(); };
  window.closeLessonQuizLinks = function () { state.lessonQuizLinkOpen = false; render(); };
  window.saveLessonPlanQuizLinks = function () { const plan = state.lessonDraft; if (!plan) return; const linkedQuizIds = [...document.querySelectorAll('input[name="lesson-linked-quiz"]:checked')].map(input => input.value); saveLessonPlan({ ...plan, linkedQuizIds }); state.lessonQuizLinkOpen = false; render(); showToast('บันทึกการเชื่อมข้อสอบแล้ว'); };
  window.openLessonWorksheetLinks = function () { state.lessonWorksheetLinkOpen = true; render(); };
  window.closeLessonWorksheetLinks = function () { state.lessonWorksheetLinkOpen = false; render(); };
  window.saveLessonPlanWorksheetLinks = function () { const plan = state.lessonDraft; if (!plan) return; const linkedWorksheetIds = [...document.querySelectorAll('input[name="lesson-linked-worksheet"]:checked')].map(input => input.value); saveLessonPlan({ ...plan, linkedWorksheetIds }); state.lessonWorksheetLinkOpen = false; render(); showToast('บันทึกการเชื่อมใบงานแล้ว'); };
  window.createQuizFromLessonPlan = function () { const plan = state.lessonDraft; if (!plan) return; state.selectedClassId = plan.classId || state.selectedClassId; state.subjectId = plan.subjectId || subjectIdFromName(plan.subjectGroup || plan.subject || selectedClass()?.subject); state.grade = gradeIdFromLabel(plan.grade || selectedClass()?.gradeLevel || state.grade); state.standardId = 'all'; state.indicatorCodes = (plan.indicators || []).map(item => item.code); state.quizPrefill = { source:plan.topic || plan.title || '', title:`แบบทดสอบหลังเรียน เรื่อง ${plan.topic || plan.title || ''}`.trim(), instructions:`อ้างอิงแผนการสอน “${plan.title || plan.topic || ''}” และตัวชี้วัดที่เลือก`, lessonPlanId:plan.id, planNumber:plan.planNumber, courseName:plan.courseName, courseCode:plan.courseCode, standards:plan.standards || [], classLabel:plan.classLabel }; state.lessonView = 'home'; state.view = 'quiz'; state.aiQuota = null; render(); refreshAiQuota('quiz'); };
  window.createWorksheetFromLessonPlan = function () { const plan = state.lessonDraft; if (!plan) return; state.selectedClassId = plan.classId || state.selectedClassId; state.subjectId = plan.subjectId || subjectIdFromName(plan.subjectGroup || plan.subject || selectedClass()?.subject); state.grade = gradeIdFromLabel(plan.grade || selectedClass()?.gradeLevel || state.grade); state.worksheetIndicatorCodes = (plan.indicators || []).map(item => item.code); state.worksheetPrefill = { title:`ใบงานเรื่อง ${plan.topic || plan.title || ''}`.trim(), topic:plan.topic || plan.title || '', classId:plan.classId, classLabel:plan.classLabel, courseName:plan.courseName, courseCode:plan.courseCode, planNumber:plan.planNumber, standards:plan.standards || [], indicators:plan.indicators || [], activityType:'สืบค้นและรวบรวมข้อมูล', lessonPlanId:plan.id, resources:Array.isArray(plan.plan?.resources) ? plan.plan.resources.join('\n') : '', focus:Array.isArray(plan.plan?.assessment) ? plan.plan.assessment.join('\n') : '' }; state.lessonView = 'home'; state.worksheetView = 'form'; state.aiQuota = null; render(); refreshAiQuota('worksheet'); };
  window.openQuizCreator = function () { state.creationContextOptional = true; state.selectedClassId = ''; state.subjectId = ''; state.grade = ''; state.worksheetView = 'home'; state.lessonView = 'home'; state.view = 'quiz'; state.draft = null; state.quizPrefill = null; state.quizReturnPlanId = ''; state.aiQuota = null; render(); refreshAiQuota('quiz'); };
  window.closeQuizCreator = function () { const returnPlanId = state.quizPrefill?.lessonPlanId || state.quizReturnPlanId; const returnPlan = returnPlanId ? library().find(item => item.id === returnPlanId && item.type === 'lesson_plan') : null; state.creationContextOptional = false; state.view = 'home'; state.draft = null; state.quizPrefill = null; state.quizReturnPlanId = ''; if (returnPlan) { state.lessonDraft = clone(returnPlan); state.lessonDraftOrigin = 'saved'; state.lessonView = 'detail'; } render(); };
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
  window.setQuizQuestionCount = function (value) {
    const custom = document.getElementById('quiz-count-custom');
    if (value === 'custom') { if (custom) custom.hidden = false; return; }
    state.quizQuestionCount = value;
    if (custom) { custom.value = value; custom.hidden = true; }
  };
  window.setQuizCustomQuestionCount = function (value) { state.quizQuestionCount = value; };

  function quizCountOption() {
    const count = String(state.quizQuestionCount || '10');
    const presets = [5,10,15,20,30];
    const isPreset = presets.includes(Number(count));
    const choices = presets.map(value => `<option value="${value}" ${count === String(value) ? 'selected' : ''}>${value} ข้อ</option>`).join('');
    return `<div class="cl-field"><span>จำนวนข้อ</span><select id="quiz-count" class="form-control" onchange="setQuizQuestionCount(this.value)">${choices}<option value="custom" ${isPreset ? '' : 'selected'}>กำหนดเอง</option></select><input id="quiz-count-custom" class="form-control cl-count-custom" type="number" min="1" max="30" step="1" inputmode="numeric" aria-label="จำนวนข้อที่กำหนดเอง" value="${escapeHtml(count)}" oninput="setQuizCustomQuestionCount(this.value)" ${isPreset ? 'hidden' : ''}><small class="cl-field-hint">เลือก 5, 10, 15, 20, 30 ข้อ หรือกำหนดเองได้ 1–30 ข้อ</small></div>`;
  }

  function quizWizardHtmlBase() {
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
        <div class="cl-field full"><span class="cl-indicator-field-label">ตัวชี้วัด/ผลการเรียนรู้ <small class="cl-indicator-selection-note">(เลือกได้หลายข้อ ไม่เลือกก็ได้)</small></span><div class="cl-indicator-table" role="group" aria-label="เลือกรายการตัวชี้วัด"><div class="cl-indicator-table-head"><span></span><span>รหัส</span><span>รายละเอียดตัวชี้วัด</span></div>${indicatorRows.slice(0,18).map(i => `<label class="cl-indicator-row"><input type="checkbox" value="${escapeHtml(i.code)}" ${state.indicatorCodes.includes(i.code) ? 'checked' : ''} onchange="toggleQuizIndicator(this.value,this.checked)"><strong>${escapeHtml(i.code)}</strong><span>${escapeHtml(i.text)}</span></label>`).join('') || '<div class="cl-indicator-empty">ไม่พบตัวชี้วัดที่ตรงกับข้อมูลที่เลือก — คุณยังสร้างจากเนื้อหาได้</div>'}</div></div></div>
        <hr style="border:0;border-top:1px solid var(--border-color);margin:22px 0;">
        <h3>2. กำหนดข้อสอบ</h3><p class="cl-form-note">AI จะสร้างเป็นฉบับร่างเพื่อให้ครูตรวจแก้ก่อนบันทึก</p><div class="cl-source-tabs"><button class="cl-source-tab ${type === 'topic' ? 'active' : ''}" type="button" onclick="setQuizSource('topic')"><i class="hgi-stroke hgi-bulb"></i> จากหัวข้อ</button><button class="cl-source-tab ${type === 'text' ? 'active' : ''}" type="button" onclick="setQuizSource('text')"><i class="hgi-stroke hgi-text"></i> วางเนื้อหา</button></div>
        <div class="cl-form-grid">${sourceField}<label class="cl-field"><span>ชื่อข้อสอบ</span><input id="quiz-title" class="form-control" maxlength="160" value="${escapeHtml(prefill.title || '')}" placeholder="เช่น แบบทดสอบก่อนเรียน เรื่องสมการ"></label>${quizCountOption()}<label class="cl-field"><span>ระดับความยาก</span><select id="quiz-difficulty" class="form-control"><option value="ง่าย">ง่าย</option><option value="ปานกลาง" selected>ปานกลาง</option><option value="ยาก">ยาก</option></select></label><div class="cl-field full"><span>ประเภทคำถาม</span><div class="cl-choices"><label class="cl-choice"><input type="checkbox" name="quiz-type" value="multiple_choice" checked> ปรนัย 4 ตัวเลือก</label><label class="cl-choice"><input type="checkbox" name="quiz-type" value="true_false"> ถูก / ผิด</label><label class="cl-choice"><input type="checkbox" name="quiz-type" value="short_answer"> คำตอบสั้น</label></div></div><label class="cl-field full"><span>คำสั่งเพิ่มเติม <small style="font-weight:600;color:var(--text-muted)">(ถ้ามี)</small></span><textarea id="quiz-instructions" class="form-control" maxlength="1200" placeholder="เช่น เน้นการคิดวิเคราะห์ ไม่ใช้โจทย์คำนวณยาว และมีคำอธิบายเฉลยทุกข้อ">${escapeHtml(prefill.instructions || '')}</textarea></label></div>
        ${aiQuotaHtml()}<div class="cl-actions"><button class="btn" type="button" onclick="closeQuizCreator()">ยกเลิก</button><button class="btn btn-primary" type="button" onclick="generateQuizDraft()"${state.aiQuota?.remaining === 0 ? ' disabled aria-disabled="true"' : ''}><i class="hgi-stroke hgi-ai-magic"></i> ${state.aiQuota?.remaining === 0 ? 'โควตาครบแล้ว' : 'สร้างร่างข้อสอบ'}</button></div>
      </section></div>`;
  }
  function quizWizardHtml() {
    return quizWizardHtmlBase()
      .replace('เริ่มจากเลือกห้องเรียนและขอบเขตเนื้อหา', 'เริ่มจากหัวข้อหรือเนื้อหาที่ต้องการ — เลือกห้องเรียนได้ถ้าต้องการ')
      .replace('<span>ห้องเรียน <em style="color:#d04b3f;font-style:normal">*</em></span><select id="quiz-class" class="form-control" onchange="setQuizClass(this.value)"><option value="">เลือกห้องเรียน</option>', '<span>ห้องเรียน <small>(ไม่บังคับ)</small></span><select id="quiz-class" class="form-control" onchange="setQuizClass(this.value)"><option value="">ยังไม่เลือก — สร้างร่างอิสระ</option>');
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
    if (state.aiGenerating) return;
    if (state.aiQuota?.remaining === 0) { showToast('วันนี้ใช้โควตาการสร้างข้อสอบ/ใบงาน/แผนการสอนครบแล้ว กรุณาลองใหม่พรุ่งนี้', 'warning', 7000); return; }
    const room = selectedClass();
    const source = document.getElementById('quiz-source')?.value.trim() || '';
    const types = [...document.querySelectorAll('input[name="quiz-type"]:checked')].map(input => input.value);
    if (source.length < 3) { showToast(state.sourceType === 'topic' ? 'กรุณาระบุหัวข้อ' : 'กรุณาวางเนื้อหาบทเรียน', 'warning'); return; }
    if (!types.length) { showToast('กรุณาเลือกประเภทคำถามอย่างน้อย 1 แบบ', 'warning'); return; }
    const countControl = document.getElementById('quiz-count');
    const questionCount = Number(countControl?.value === 'custom' ? document.getElementById('quiz-count-custom')?.value : countControl?.value || state.quizQuestionCount);
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 30) { showToast('กรุณาระบุจำนวนข้อเป็นจำนวนเต็ม 1–30', 'warning'); document.getElementById('quiz-count-custom')?.focus(); return; }
    state.quizQuestionCount = String(questionCount);
    const title = document.getElementById('quiz-title')?.value.trim() || `ข้อสอบ ${source.slice(0, 60)}`;
    const subjectName = (catalog()?.subjects || []).find(item => item.id === state.subjectId)?.name || room?.subject || '';
    const payload = { title, classId:room?.id || '', classLabel:state.quizPrefill?.classLabel || (room ? `${subjectName} · ${room.className}` : 'ยังไม่ได้เชื่อมห้องเรียน'), subjectId:state.subjectId, subject:subjectName, subjectGroup:subjectName, courseName:state.quizPrefill?.courseName || '', courseCode:state.quizPrefill?.courseCode || '', grade:gradeLabel(state.grade), standards:state.quizPrefill?.standards || [], lessonPlanNumber:state.quizPrefill?.planNumber || null, sourceType:state.sourceType, source, questionCount, types, difficulty:document.getElementById('quiz-difficulty')?.value || 'ปานกลาง', mode:'assessment', instructions:document.getElementById('quiz-instructions')?.value.trim() || '', indicators:selectedIndicators().map(row => indicatorReference(row)) };
    state.aiGenerating = true;
    ensureProcessingOverlay(); processing(true);
    try {
      const session = await supabaseClient?.auth?.getSession();
      const token = session?.data?.session?.access_token;
      const response = await fetch('/api/ai/generate-quiz', { method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) }, body:JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      applyAiQuota(result.quota);
      if (!response.ok) { updateAiQuotaUi(); throw new Error(result.message || result.error || 'ไม่สามารถสร้างข้อสอบได้'); }
      state.draft = { ...payload, id:uid(), createdAt:new Date().toISOString(), lessonPlanId:state.quizPrefill?.lessonPlanId || '', questions:Array.isArray(result.questions) ? result.questions : [], qualityWarnings:Array.isArray(result.warnings) ? result.warnings : [] };
      if (!state.draft.questions.length) throw new Error('AI ไม่ได้ส่งคำถามกลับมา กรุณาลองใหม่');
      state.view = 'review'; render();
    } catch (error) {
      console.warn('Quiz generation failed:', error);
      showToast(`สร้างข้อสอบไม่สำเร็จ: ${error.message || 'กรุณาลองใหม่'}`, 'warning', 7000);
    } finally { state.aiGenerating = false; processing(false); }
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
    return `<div class="cl-wizard cl-detail"><div class="cl-wizard-top"><div class="cl-wizard-title"><span class="cl-create-icon"><i class="hgi-stroke hgi-task-02"></i></span><div><h2>รายละเอียดข้อสอบ</h2><p>ตรวจแก้หรือส่งออกเอกสารได้จากหน้านี้</p></div></div><button class="btn" type="button" onclick="closeQuizCreator()"><i class="hgi-stroke hgi-arrow-left-01"></i> <span>กลับคลัง</span></button></div><section class="card cl-detail-head"><div><span class="cl-saved-type"><i class="hgi-stroke hgi-task-02"></i> ข้อสอบ · ร่าง</span><h2>${escapeHtml(quiz.title || 'ข้อสอบไม่มีชื่อ')}</h2><p>${escapeHtml(quiz.classLabel || 'ยังไม่ได้เชื่อมห้องเรียน')} · ${quiz.questions?.length || 0} ข้อ · ${quiz.mode === 'practice' ? 'โหมดฝึกฝน' : 'โหมดแบบทดสอบ'}</p>${selected.length ? `<div class="cl-detail-indicators">${selected.map(item => `<span>${escapeHtml(item.code)}</span>`).join('')}</div>` : ''}</div><div class="cl-detail-actions"><button class="btn cl-export-btn word" type="button" data-export-type="word" onclick="exportQuizDocx()"><i class="hgi-stroke hgi-file-download"></i> ส่งออก Word</button><button class="btn cl-export-btn pdf" type="button" data-export-type="pdf" title="เปิดหน้าพิมพ์ข้อสอบเพื่อเลือกบันทึกเป็น PDF ขนาด A4" onclick="exportQuizPdf()"><i class="hgi-stroke hgi-printer"></i> PDF · แบบฟอร์ม A4</button><button class="btn btn-primary" type="button" onclick="editSavedQuiz()"><i class="hgi-stroke hgi-edit-02"></i> แก้ไขข้อสอบ</button></div></section><div class="cl-detail-list">${(quiz.questions || []).map(detailQuestionHtml).join('') || '<div class="cl-empty-library">ข้อสอบนี้ยังไม่มีคำถาม</div>'}</div><div class="cl-detail-danger"><button class="btn" type="button" onclick="deleteSavedQuiz()"><i class="hgi-stroke hgi-delete-02"></i> ลบข้อสอบชุดนี้</button></div></div>`;
  }
  function renderDetailMetaControls(root) {
    const quiz = state.draft;
    const head = root.querySelector('.cl-detail-head');
    const info = head?.firstElementChild;
    const meta = info?.querySelector('p');
    const actions = head?.querySelector('.cl-detail-actions');
    if (!quiz || !info || !meta || !actions) return;
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
  function libraryA4PrintStyles() {
    return `<style>
      @page { size: A4 portrait; margin: 13mm; }
      html, body { margin: 0; padding: 0; background: #fff !important; color: #202624; }
      body.cl-a4-print { font-family: "Sarabun", Tahoma, sans-serif; font-size: 11pt; line-height: 1.55; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .cl-a4-page { width: 100%; max-width: none !important; min-width: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #fff !important; color: #202624 !important; }
      .cl-a4-page *, .cl-a4-page *::before, .cl-a4-page *::after { box-sizing: border-box; }
      .cl-a4-page h1, .cl-a4-page h2, .cl-a4-page h3, .cl-a4-page h4 { color: #17211d; break-after: avoid-page; page-break-after: avoid; }
      .cl-a4-page p, .cl-a4-page li { overflow-wrap: anywhere; }
      .cl-a4-plan .cl-plan-form-heading { padding: 0 0 10px; margin: 0 0 12px; border: 0; border-bottom: 1px solid #7b8580; border-radius: 0; background: #fff; }
      .cl-a4-plan .cl-plan-form-heading > h2 { margin: 0 0 10px; padding: 0; border: 0; text-align: center; font-size: 17pt; }
      .cl-a4-plan .cl-plan-form-metadata { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 5px 14px; }
      .cl-a4-plan .cl-plan-form-metadata span { font-size: 9.5pt; }
      .cl-a4-plan .cl-guidance-unit-summary, .cl-a4-plan .cl-plan-after-class { margin: 10px 0; padding: 10px; border: 1px solid #b8c8bf; border-radius: 5px; background: #f7faf8 !important; }
      .cl-a4-plan .cl-guidance-unit-goals, .cl-a4-plan .cl-plan-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
      .cl-a4-plan .cl-plan-grid article, .cl-a4-plan .cl-guidance-unit-goals > div { padding: 9px; border: 1px solid #c8d0cc; border-radius: 4px; background: #fff !important; break-inside: avoid; page-break-inside: avoid; }
      .cl-a4-plan .cl-plan-grid article.cl-plan-wide { grid-column: 1 / -1; }
      .cl-a4-plan .cl-plan-grid article h3, .cl-a4-plan .cl-plan-after-class h3 { margin: 0 0 5px; font-size: 11pt; }
      .cl-a4-plan .cl-plan-grid article p, .cl-a4-plan .cl-plan-grid article ul, .cl-a4-plan .cl-plan-after-class p, .cl-a4-plan .cl-guidance-unit-goals p, .cl-a4-plan .cl-guidance-unit-goals ul { font-size: 9.5pt; line-height: 1.5; }
      .cl-a4-worksheet .cl-student-sheet { max-width: none; padding: 0; background: #fff; }
      .cl-a4-worksheet .cl-student-sheet header, .cl-a4-worksheet > .cl-student-sheet-header { padding-bottom: 10px; border-bottom: 1px solid #68736d; text-align: center; }
      .cl-a4-worksheet .cl-student-sheet header h2, .cl-a4-worksheet > .cl-student-sheet-header h1 { margin: 6px 0; font-size: 17pt; }
      .cl-a4-worksheet .cl-worksheet-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
      .cl-a4-worksheet .cl-worksheet-grid article { padding: 10px; border: 1px solid #c8d0cc; border-radius: 4px; background: #fff !important; break-inside: avoid; page-break-inside: avoid; }
      .cl-a4-worksheet .cl-worksheet-wide { grid-column: 1 / -1; }
      .cl-a4-worksheet .cl-sheet-block { margin: 12px 0; break-inside: avoid; page-break-inside: avoid; }
      .cl-a4-worksheet .cl-sheet-block h3 { font-size: 12pt; }
      .cl-a4-worksheet .cl-sheet-table-scroll { overflow: visible; }
      .cl-a4-worksheet table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .cl-a4-worksheet th, .cl-a4-worksheet td { border: 1px solid #747d78; padding: 6px; overflow-wrap: anywhere; }
      .cl-a4-worksheet thead { display: table-header-group; }
      .cl-a4-worksheet tr { break-inside: avoid; page-break-inside: avoid; }
      .cl-a4-worksheet .cl-sheet-drawing-box { min-height: 45mm; background: #fff; }
      .cl-a4-worksheet .cl-sheet-answer-line { height: 9mm; }
      .cl-a4-quiz > header { margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #68736d; text-align: center; }
      .cl-a4-quiz > header h1 { margin: 4px 0; font-size: 18pt; }
      .cl-a4-student-fields { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; margin: 14px 0; text-align: left; }
      .cl-a4-student-fields span { min-height: 9mm; padding: 4px 2px; border-bottom: 1px dotted #727b76; }
      .cl-a4-question { margin: 12px 0; padding: 0 0 8px; border-bottom: 1px solid #d4dad7; break-inside: avoid; page-break-inside: avoid; }
      .cl-a4-question > p { margin: 0 0 6px; font-weight: 700; }
      .cl-a4-options { margin: 5px 0 0; padding-left: 26px; }
      .cl-a4-options li { padding: 2px 0 2px 4px; }
      .cl-a4-answer-lines { margin-top: 7px; }
      .cl-a4-answer-lines span { display: block; height: 9mm; border-bottom: 1px dotted #7b8580; }
      @media print { a { color: inherit !important; text-decoration: none !important; } }
    </style>`;
  }
  function openLibraryA4PrintWindow(title, content, documentType) {
    if (!content) { showToast('ไม่พบเนื้อหาสำหรับสร้างแบบฟอร์ม A4', 'warning'); return false; }
    const popup = window.open('', '_blank');
    if (!popup) { showToast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาตป๊อปอัปแล้วลองใหม่', 'warning'); return false; }
    const stylesheet = path => escapeHtml(new URL(path, window.location.href).href);
    let printStarted = false;
    const printWhenReady = () => {
      if (printStarted) return;
      printStarted = true;
      Promise.resolve(popup.document.fonts?.ready).catch(() => {}).then(() => setTimeout(() => {
        try { popup.focus(); popup.print(); }
        catch (_) { showToast('เปิดแบบฟอร์มแล้ว แต่เริ่มหน้าพิมพ์ไม่ได้ กรุณาลองกดพิมพ์ในหน้าต่างใหม่', 'warning'); }
      }, 120));
    };
    popup.addEventListener('load', printWhenReady, { once: true });
    popup.onafterprint = () => { try { popup.close(); } catch (_) {} };
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="${stylesheet('css/01-base-layout.css')}"><link rel="stylesheet" href="${stylesheet('css/13-content-library.css')}"><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">${libraryA4PrintStyles()}</head><body class="cl-a4-print"><main class="cl-a4-page cl-a4-${documentType}">${content}</main></body></html>`);
    popup.document.close();
    setTimeout(() => { if (popup.document.readyState === 'complete') printWhenReady(); }, 0);
    showToast('เปิดแบบฟอร์ม A4 แล้ว เลือก “บันทึกเป็น PDF” ในหน้าพิมพ์');
    return true;
  }
  function quizA4Html(quiz) {
    const questions = (quiz.questions || []).map((question, index) => {
      const type = question.type || 'multiple_choice';
      let response = '';
      if (type === 'multiple_choice') {
        response = `<ol class="cl-a4-options" type="A">${(question.options || []).map(option => `<li>${escapeHtml(option)}</li>`).join('')}</ol>`;
      } else if (type === 'true_false') {
        response = '<p>□ ถูก　　□ ผิด</p>';
      } else {
        response = '<div class="cl-a4-answer-lines"><span></span><span></span><span></span></div>';
      }
      return `<article class="cl-a4-question"><p>${index + 1}. ${escapeHtml(question.prompt || '')}</p>${response}</article>`;
    }).join('');
    const indicators = (quiz.indicators || []).map(item => escapeHtml(item.code)).filter(Boolean).join(' · ');
    return `<header><small>ข้อสอบ · ${quiz.mode === 'practice' ? 'แบบฝึก' : 'แบบทดสอบ'}</small><h1>${escapeHtml(quiz.title || 'ข้อสอบ')}</h1><p>${escapeHtml(quiz.classLabel || '')}${quiz.description ? ` · ${escapeHtml(quiz.description)}` : ''}</p><div class="cl-a4-student-fields"><span>ชื่อ–นามสกุล ........................................................</span><span>ชั้น/ห้อง ............</span><span>เลขที่ ............</span></div>${indicators ? `<small>ตัวชี้วัด: ${indicators}</small>` : ''}</header>${questions}`;
  }
  window.exportQuizPdf = function () {
    const quiz = state.draft;
    if (!quiz?.questions?.length) { showToast('ข้อสอบนี้ยังไม่มีคำถามสำหรับส่งออก', 'warning'); return; }
    openLibraryA4PrintWindow(quiz.title || 'ข้อสอบ', quizA4Html(quiz), 'quiz');
  };
  window.exportLessonPlanPdf = function () {
    const plan = state.lessonDraft;
    const preview = document.querySelector('.cl-plan-detail-preview');
    if (!plan?.plan || !preview) { showToast('ไม่พบข้อมูลแผนการสอนสำหรับส่งออก', 'warning'); return; }
    const printable = preview.cloneNode(true);
    printable.querySelector(':scope > header')?.remove();
    openLibraryA4PrintWindow(plan.plan.title || plan.title || plan.topic || 'แผนการสอน', printable.innerHTML, 'plan');
  };
  window.exportWorksheetPdf = function () {
    const worksheet = state.worksheetDraft;
    const preview = document.querySelector('.cl-worksheet-detail-preview');
    if (!worksheet?.worksheet || !preview) { showToast('ไม่พบข้อมูลใบงานสำหรับส่งออก', 'warning'); return; }
    const printable = preview.cloneNode(true);
    printable.querySelectorAll('.cl-sheet-key, .cl-worksheet-wide').forEach(item => item.remove());
    const studentSheet = printable.querySelector('.cl-student-sheet');
    const content = studentSheet
      ? studentSheet.outerHTML
      : `<header class="cl-student-sheet-header"><small>ใบงาน · ${escapeHtml(worksheet.subject || '')} · ${escapeHtml(worksheet.grade || '')}</small><h1>${escapeHtml(worksheet.worksheet.title || worksheet.title || 'ใบงาน')}</h1><p>${escapeHtml(worksheet.classLabel || '')} · ${escapeHtml(worksheet.activityType || '')} · ${escapeHtml(worksheet.duration || '')}</p><p>ชื่อ–นามสกุล ................................................ ชั้น ........ เลขที่ ........</p><small>ตัวชี้วัด: ${(worksheet.indicators || []).map(item => escapeHtml(item.code)).join(' · ')}</small></header>${printable.innerHTML}`;
    openLibraryA4PrintWindow(worksheet.worksheet.title || worksheet.title || 'ใบงาน', content, 'worksheet');
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
  window.addEventListener('classkru:curriculum-catalog-updated', event => {
    if (event.detail?.subjectId === 'guidance' && state.lessonView === 'form' && state.subjectId === 'guidance') render();
  });
})();
