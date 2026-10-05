'use strict';

const state = { view: 'overview', overview: null, business: null, businessAccountSort: 'registered', reports: [], billing: null, v2Media: null, ideas: { biggy: [], petchpetch: [] }, mediaModels: null, mediaCatalog: { text: [], image: [] } };
const byId = id => document.getElementById(id);
const ui = {
  loginView: byId('login-view'), consoleView: byId('console-view'), loginForm: byId('login-form'),
  password: byId('password-input'), togglePassword: byId('toggle-password'), loginButton: byId('login-button'),
  loginStatus: byId('login-status'), logout: byId('logout-button'), refresh: byId('refresh-button'),
  globalStatus: byId('global-status'), summary: byId('summary-grid'),
  recent: byId('recent-list'), lastUpdated: byId('last-updated'), reportFilters: byId('report-filters'),
  searchFilter: byId('search-filter'), categoryFilter: byId('category-filter'), statusFilter: byId('status-filter'),
  reportsCards: byId('reports-cards'), reportsEmpty: byId('reports-empty'), tableSelect: byId('table-select'),
  loadTable: byId('load-table-button'), databaseTable: byId('database-table'), modal: byId('detail-modal'),
  modalTitle: byId('detail-title'), modalContent: byId('detail-content'), closeModal: byId('close-modal')
  ,billingSummary: byId('billing-summary'), billingTable: byId('billing-table'), billingSalesTable: byId('billing-sales-table'),
  mediaModelsForm: byId('media-models-form'), mediaModelsUpdated: byId('media-models-updated'), mediaModelCatalogKind: byId('media-model-catalog-kind'), mediaModelSearch: byId('media-model-search'), mediaModelRefresh: byId('media-model-refresh'), mediaPlannerModel: byId('media-planner-model'), mediaBuilderModel: byId('media-builder-model'), mediaImageModel: byId('media-image-model'), mediaModelSave: byId('media-model-save'), mediaModelSaveStatus: byId('media-model-save-status'),
  businessSummary: byId('business-summary'), businessAvailable: byId('business-available'), businessFuture: byId('business-future'), businessUpdated: byId('business-updated'), businessAccountList: byId('business-account-list'), usageSearch: byId('usage-search'), usageFilter: byId('usage-filter'), usageList: byId('usage-list'), usageCount: byId('usage-count'), usageUpdated: byId('usage-updated'), v2MediaRows: byId('v2-media-rows'), v2MediaCount: byId('v2-media-count'), v2MediaUpdated: byId('v2-media-updated'), v2MediaRefresh: byId('v2-media-refresh')
};

const STATUS_LABELS = Object.freeze({ new: 'ใหม่', reviewing: 'กำลังตรวจสอบ', resolved: 'แก้ไขแล้ว', closed: 'ปิดรายการ' });
const CATEGORY_LABELS = Object.freeze({ issue: 'แจ้งปัญหา', feature: 'เสนอฟีเจอร์ใหม่' });
const DEVELOPER_LABELS = Object.freeze({ biggy: 'Biggy', petchpetch: 'PetchPetch' });

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'request_failed');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function formatDate(value, includeTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('th-TH', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { day: '2-digit', month: 'short', year: '2-digit' }).format(new Date(value));
}

function setLoginStatus(message, type = '') {
  ui.loginStatus.textContent = message;
  ui.loginStatus.className = `form-status ${type}`.trim();
}

function showLogin(message = '') {
  ui.loginView.hidden = false;
  ui.consoleView.hidden = true;
  if (message) setLoginStatus(message);
  ui.password.focus();
}

function showConsole() {
  ui.loginView.hidden = true;
  ui.consoleView.hidden = false;
  switchView('overview');
}

function statusPill(status) {
  return element('span', `status-pill status-${status}`, STATUS_LABELS[status] || status || '—');
}

function categoryPill(category) {
  const value = category === 'feature' ? 'feature' : 'issue';
  return element('span', `category-pill category-${value}`, CATEGORY_LABELS[value]);
}

function reportDetail(report) {
  ui.modalTitle.textContent = 'รายละเอียดความคิดเห็น';
  ui.modalContent.replaceChildren();
  const fields = [
    ['หมวดหมู่', CATEGORY_LABELS[report.category] || CATEGORY_LABELS.issue],
    ['สถานะ', STATUS_LABELS[report.status] || report.status],
    ['วันที่และเวลา', formatDate(report.created_at, true)],
    ['ความคิดเห็น', report.message],
    ['หน้าที่พบปัญหา', report.page_url || 'ไม่ได้ระบุ'],
    ['ข้อมูลเบราว์เซอร์', report.browser_info || 'ไม่ได้ระบุ'],
    ['Reporter ID', report.reporter_id || 'ไม่ระบุ'],
    ['Report ID', report.id]
  ];
  fields.forEach(([label, value]) => {
    const box = element('div', 'detail-field');
    box.append(element('span', '', label), element('p', '', value || '—'));
    ui.modalContent.append(box);
  });
  ui.modal.hidden = false;
  ui.closeModal.focus();
}

function rawDetail(title, row) {
  ui.modalTitle.textContent = title;
  ui.modalContent.replaceChildren();
  const box = element('div', 'detail-field');
  box.append(element('span', '', 'JSON แบบอ่านอย่างเดียว'));
  const pre = element('pre', '', JSON.stringify(row, null, 2));
  box.append(pre);
  ui.modalContent.append(box);
  ui.modal.hidden = false;
  ui.closeModal.focus();
}

function renderOverview(data) {
  state.overview = data;
  ui.summary.replaceChildren();
  const cards = [
    ['ทั้งหมด', data.total || 0, 'total'],
    ['แจ้งปัญหา', data.categories?.issue || 0, 'issue'], ['เสนอฟีเจอร์ใหม่', data.categories?.feature || 0, 'feature'],
    ['ใหม่', data.statuses?.new || 0, 'new'],
    ['กำลังตรวจสอบ', data.statuses?.reviewing || 0, 'reviewing'], ['แก้ไขแล้ว', data.statuses?.resolved || 0, 'resolved'],
    ['ปิดรายการ', data.statuses?.closed || 0, 'closed']
  ];
  cards.forEach(([label, value, type]) => {
    const card = element('article', `summary-card ${type}`);
    card.append(element('span', '', label), element('strong', '', value));
    ui.summary.append(card);
  });

  ui.recent.replaceChildren();
  (data.recent || []).forEach(report => {
    const button = element('button', 'recent-item');
    button.type = 'button';
    button.append(element('span', 'recent-date', formatDate(report.created_at)));
    const copy = element('span');
    copy.append(element('strong', '', report.message), element('small', '', formatDate(report.created_at, true)));
    const badges = element('span', 'recent-badges');
    badges.append(categoryPill(report.category), statusPill(report.status));
    button.append(copy, badges);
    button.addEventListener('click', () => reportDetail(report));
    ui.recent.append(button);
  });
  if (!(data.recent || []).length) ui.recent.append(element('p', 'database-note', 'ยังไม่มีความคิดเห็น'));
  ui.lastUpdated.textContent = `อัปเดต ${formatDate(new Date().toISOString(), true)}`;
}

async function loadOverview() {
  ui.globalStatus.textContent = 'กำลังโหลดข้อมูลจากฐานข้อมูล…';
  try {
    const data = await request('/api/dev/data?resource=overview');
    renderOverview(data);
    ui.globalStatus.textContent = '';
  } catch (error) {
    handleDataError(error);
  }
}

function renderReports(data) {
  state.reports = data.rows || [];
  ui.reportsCards.replaceChildren();
  state.reports.forEach(report => {
    const card = element('article', 'feedback-card');
    const header = element('header', 'feedback-card-header');
    const date = element('time', 'feedback-card-time', formatDate(report.created_at, true));
    date.dateTime = report.created_at;
    const badges = element('span', 'feedback-card-badges');
    badges.append(categoryPill(report.category), statusPill(report.status));
    header.append(date, badges);
    const message = element('p', 'feedback-card-message', report.message);
    const footer = element('footer', 'feedback-card-footer');
    footer.append(element('span', '', report.page_url || 'ไม่ระบุหน้า'));
    const button = element('button', 'row-button', 'ดูรายละเอียด');
    button.type = 'button';
    button.addEventListener('click', () => reportDetail(report));
    footer.append(button);
    card.append(header, message, footer);
    ui.reportsCards.append(card);
  });
  ui.reportsEmpty.hidden = state.reports.length > 0;
}

async function loadReports() {
  ui.globalStatus.textContent = 'กำลังโหลดรายงาน…';
  const params = new URLSearchParams({ resource: 'reports' });
  if (ui.searchFilter.value.trim()) params.set('q', ui.searchFilter.value.trim());
  if (ui.categoryFilter.value) params.set('category', ui.categoryFilter.value);
  if (ui.statusFilter.value) params.set('status', ui.statusFilter.value);
  try {
    renderReports(await request(`/api/dev/data?${params}`));
    ui.globalStatus.textContent = '';
  } catch (error) {
    handleDataError(error);
  }
}

function renderIdeas(owner, data) {
  state.ideas[owner] = data.rows || [];
  const list = byId(`ideas-list-${owner}`);
  list.replaceChildren();
  state.ideas[owner].forEach(idea => {
    const card = element('article', `idea-card${idea.is_completed ? ' is-completed' : ''}`);
    const header = element('header', 'idea-card-header');
    const time = element('time', 'idea-card-time', formatDate(idea.created_at, true));
    time.dateTime = idea.created_at;
    const completed = element('label', 'idea-complete-control');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(idea.is_completed);
    checkbox.dataset.ideaComplete = idea.id;
    checkbox.dataset.owner = owner;
    completed.append(checkbox, document.createTextNode(' ทำเสร็จแล้ว'));
    header.append(time, completed);
    card.append(header, element('p', 'idea-card-text', idea.idea_text));

    const comments = element('section', 'idea-comments');
    comments.append(element('h3', '', `คอมเมนต์ (${(idea.comments || []).length})`));
    const commentList = element('div', 'idea-comment-list');
    (idea.comments || []).forEach(comment => {
      const item = element('article', 'idea-comment');
      const meta = element('div', 'idea-comment-meta');
      meta.append(element('strong', '', DEVELOPER_LABELS[comment.author] || comment.author), element('time', '', formatDate(comment.created_at, true)));
      item.append(meta, element('p', '', comment.comment_text));
      commentList.append(item);
    });
    if (!(idea.comments || []).length) commentList.append(element('p', 'idea-comment-empty', 'ยังไม่มีคอมเมนต์'));
    comments.append(commentList);

    const form = element('form', 'idea-comment-form');
    form.dataset.commentForm = idea.id;
    form.dataset.owner = owner;
    const authorLabel = element('label', '', 'ผู้คอมเมนต์');
    const author = document.createElement('select');
    author.name = 'author';
    Object.entries(DEVELOPER_LABELS).forEach(([value, label]) => {
      const option = element('option', '', label);
      option.value = value;
      author.append(option);
    });
    author.value = owner === 'biggy' ? 'petchpetch' : 'biggy';
    authorLabel.append(author);
    const commentLabel = element('label', '', 'ข้อความ');
    const input = document.createElement('textarea');
    input.name = 'commentText';
    input.rows = 2;
    input.maxLength = 2000;
    input.minLength = 5;
    input.required = true;
    input.placeholder = 'แสดงความคิดเห็นหรือช่วยต่อยอดไอเดีย… (อย่างน้อย 5 ตัวอักษร)';
    commentLabel.append(input);
    const submit = element('button', 'secondary-button', 'ส่งคอมเมนต์');
    submit.type = 'submit';
    form.append(authorLabel, commentLabel, submit);
    comments.append(form);
    card.append(comments);
    list.append(card);
  });
  if (!state.ideas[owner].length) list.append(element('div', 'empty-state', 'ยังไม่มีไอเดีย เริ่มจดบันทึกใบแรกได้เลย'));
}

async function loadIdeas(owner) {
  ui.globalStatus.textContent = `กำลังโหลดไอเดียของ ${DEVELOPER_LABELS[owner]}…`;
  try {
    renderIdeas(owner, await request(`/api/dev/ideas?owner=${encodeURIComponent(owner)}`));
    ui.globalStatus.textContent = '';
  } catch (error) {
    handleDataError(error);
  }
}

async function saveIdea(form) {
  const owner = form.dataset.ideaForm;
  const textarea = form.querySelector('textarea');
  const ideaText = textarea.value.trim();
  if (!ideaText) return;
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    await request('/api/dev/ideas', { method: 'POST', body: JSON.stringify({ action: 'idea', owner, ideaText }) });
    textarea.value = '';
    await loadIdeas(owner);
  } catch (error) {
    handleDataError(error);
  } finally {
    button.disabled = false;
  }
}

async function saveComment(form) {
  const owner = form.dataset.owner;
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    await request('/api/dev/ideas', {
      method: 'POST',
      body: JSON.stringify({ action: 'comment', ideaId: form.dataset.commentForm, author: form.elements.author.value, commentText: form.elements.commentText.value.trim() })
    });
    await loadIdeas(owner);
  } catch (error) {
    handleDataError(error);
  } finally {
    button.disabled = false;
  }
}

async function toggleIdea(checkbox) {
  checkbox.disabled = true;
  try {
    await request('/api/dev/ideas', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'complete', ideaId: checkbox.dataset.ideaComplete, completed: checkbox.checked })
    });
    await loadIdeas(checkbox.dataset.owner);
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    handleDataError(error);
  } finally {
    checkbox.disabled = false;
  }
}

function renderDatabase(data) {
  ui.databaseTable.replaceChildren();
  if (!data.rows?.length) {
    ui.databaseTable.append(element('div', 'empty-state', 'ตารางนี้ยังไม่มีข้อมูล'));
    return;
  }
  const columns = Object.keys(data.rows[0]);
  const table = document.createElement('table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  columns.forEach(column => headRow.append(element('th', '', column)));
  headRow.append(element('th', '', 'รายละเอียด'));
  head.append(headRow);
  const body = document.createElement('tbody');
  data.rows.forEach(rowData => {
    const row = document.createElement('tr');
    columns.forEach(column => {
      const value = typeof rowData[column] === 'object' ? JSON.stringify(rowData[column]) : rowData[column];
      row.append(element('td', '', value === null || value === undefined ? '—' : value));
    });
    const action = document.createElement('td');
    const button = element('button', 'row-button', 'JSON');
    button.type = 'button';
    button.addEventListener('click', () => rawDetail(`${data.table} · รายการ`, rowData));
    action.append(button);
    row.append(action);
    body.append(row);
  });
  table.append(head, body);
  ui.databaseTable.append(table);
}

async function loadDatabase() {
  ui.globalStatus.textContent = 'กำลังโหลดตารางแบบอ่านอย่างเดียว…';
  try {
    const table = encodeURIComponent(ui.tableSelect.value);
    renderDatabase(await request(`/api/dev/data?resource=table&table=${table}`));
    ui.globalStatus.textContent = '';
  } catch (error) {
    handleDataError(error);
  }
}

function renderBilling(data) {
  state.billing = data;
  ui.billingSummary.replaceChildren();
  const paidAmount = (Number(data.paidAmountSatang || 0) / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  [['บัญชีครูทั้งหมด', data.totalTeachers], ['ใช้งานได้', data.activeTeachers], ['หมดอายุ', data.expiredTeachers], ['รายการชำระสำเร็จ', data.paidOrders], ['ยอดขายรวม', `${paidAmount} บาท`]].forEach(([label, value]) => {
    const card = element('article', 'summary-card');
    card.append(element('span', 'summary-card-label', label), element('strong', 'summary-card-value', value || 0));
    ui.billingSummary.append(card);
  });
  ui.billingSalesTable.replaceChildren();
  const teachersById = new Map((data.rows || []).map(item => [item.teacher_id, item.email]));
  if (!data.orders?.length) ui.billingSalesTable.append(element('div', 'empty-state', 'ยังไม่มีรายการชำระเงิน'));
  else {
    const salesTable = document.createElement('table');
    const salesHead = document.createElement('thead');
    const salesHeader = document.createElement('tr');
    ['วันที่', 'อีเมลครู', 'แพ็กเกจ', 'จำนวนเงิน', 'สถานะ', 'ช่องทาง'].forEach(label => salesHeader.append(element('th', '', label)));
    salesHead.append(salesHeader);
    const salesBody = document.createElement('tbody');
    data.orders.forEach(item => {
      const tr = document.createElement('tr');
      const amount = (Number(item.amount_satang || 0) / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 });
      [formatDate(item.created_at, true), teachersById.get(item.teacher_id) || item.teacher_id || '—', item.plan_id || '—', `${amount} บาท`, item.status || '—', item.gateway || '—'].forEach(value => tr.append(element('td', '', value)));
      salesBody.append(tr);
    });
    salesTable.append(salesHead, salesBody); ui.billingSalesTable.append(salesTable);
  }
  ui.billingTable.replaceChildren();
  if (!data.rows?.length) { ui.billingTable.append(element('div', 'empty-state', 'ยังไม่มีข้อมูลสมาชิก')); return; }
  const table = document.createElement('table');
  const head = document.createElement('thead');
  const row = document.createElement('tr');
  ['อีเมล', 'สถานะ', 'วันหมดอายุ', 'อัปเดตล่าสุด'].forEach(label => row.append(element('th', '', label)));
  head.append(row);
  const body = document.createElement('tbody');
  data.rows.forEach(item => {
    const tr = document.createElement('tr');
    [item.email, item.subscription_status, formatDate(item.paid_until), formatDate(item.updated_at, true)].forEach(value => tr.append(element('td', '', value || '—')));
    body.append(tr);
  });
  table.append(head, body); ui.billingTable.append(table);
}

async function loadBilling() {
  ui.globalStatus.textContent = 'กำลังโหลดข้อมูลสมาชิก…';
  try { renderBilling(await request('/api/dev/data?resource=billing')); ui.globalStatus.textContent = ''; }
  catch (error) { handleDataError(error); }
}

function setMediaModelStatus(message, type = '') {
  ui.mediaModelSaveStatus.textContent = message;
  ui.mediaModelSaveStatus.className = type;
}

function modelLabel(model) {
  const prices = model.prompt_price || model.completion_price ? ` · $${model.prompt_price || '0'}/$${model.completion_price || '0'} ต่อ token` : '';
  return `${model.name} — ${model.id}${prices}`;
}

function populateModelSelect(select, models, selectedId) {
  select.replaceChildren();
  const matched = models.some(model => model.id === selectedId);
  if (selectedId && !matched) select.append(new Option(`${selectedId} (ค่าปัจจุบัน — ไม่พบใน catalog)`, selectedId));
  models.forEach(model => select.append(new Option(modelLabel(model), model.id)));
  select.value = selectedId || models[0]?.id || '';
}

function renderMediaModels() {
  const settings = state.mediaModels;
  if (!settings) return;
  const query = ui.mediaModelSearch.value.trim().toLocaleLowerCase('th-TH');
  const matches = kind => state.mediaCatalog[kind].filter(model => !query || `${model.id} ${model.name} ${model.description}`.toLocaleLowerCase('th-TH').includes(query));
  populateModelSelect(ui.mediaPlannerModel, matches('text'), settings.planner_model);
  populateModelSelect(ui.mediaBuilderModel, matches('text'), settings.builder_model);
  populateModelSelect(ui.mediaImageModel, matches('image'), settings.image_model);
  ui.mediaModelsUpdated.textContent = settings.storage_ready
    ? `บันทึกล่าสุด ${formatDate(settings.updated_at, true)}`
    : 'ยังไม่พบตารางการตั้งค่า — ต้องรัน migration ก่อนบันทึก';
}

async function loadMediaCatalog(kind, force = false) {
  if (!force && state.mediaCatalog[kind].length) return;
  const data = await request(`/api/dev/media-models?resource=catalog&kind=${encodeURIComponent(kind)}`);
  state.mediaCatalog[kind] = data.models || [];
}

async function loadMediaModels() {
  ui.globalStatus.textContent = 'กำลังโหลดการตั้งค่า AI Media Studio…';
  try {
    const data = await request('/api/dev/media-models?resource=settings');
    state.mediaModels = data.settings;
    await Promise.all([loadMediaCatalog('text'), loadMediaCatalog('image')]);
    renderMediaModels();
    setMediaModelStatus(data.catalog_configured ? '' : 'ยังไม่พบ OpenRouter key สำหรับโหลด catalog', data.catalog_configured ? '' : 'error');
    ui.globalStatus.textContent = '';
  } catch (error) {
    handleDataError(error);
    setMediaModelStatus('โหลดโมเดลไม่สำเร็จ กรุณาตรวจ OpenRouter key และ migration', 'error');
  }
}

async function refreshMediaCatalog() {
  const kind = ui.mediaModelCatalogKind.value;
  ui.mediaModelRefresh.disabled = true;
  setMediaModelStatus(`กำลังโหลดโมเดล${kind === 'image' ? 'สร้างภาพ' : 'ข้อความ'}…`);
  try {
    await loadMediaCatalog(kind, true);
    renderMediaModels();
    setMediaModelStatus(`โหลดรายการ ${state.mediaCatalog[kind].length} โมเดลแล้ว`, 'success');
  } catch (error) {
    handleDataError(error);
    setMediaModelStatus('โหลดรายการโมเดลไม่สำเร็จ', 'error');
  } finally {
    ui.mediaModelRefresh.disabled = false;
  }
}

async function saveMediaModels(event) {
  event.preventDefault();
  const payload = { action: 'save', planner_model: ui.mediaPlannerModel.value, builder_model: ui.mediaBuilderModel.value, image_model: ui.mediaImageModel.value };
  if (!payload.planner_model || !payload.builder_model || !payload.image_model) return setMediaModelStatus('กรุณาเลือกโมเดลให้ครบ', 'error');
  ui.mediaModelSave.disabled = true;
  setMediaModelStatus('กำลังบันทึก…');
  try {
    const data = await request('/api/dev/media-models', { method: 'POST', body: JSON.stringify(payload) });
    state.mediaModels = data.settings;
    renderMediaModels();
    setMediaModelStatus('บันทึกแล้ว · งานใหม่จะใช้โมเดลที่เลือกทันที', 'success');
  } catch (error) {
    if (error.status === 401) return handleDataError(error);
    setMediaModelStatus(error.payload?.error === 'model_not_supported_for_task' ? 'โมเดลนี้ไม่รองรับประเภทงานที่เลือก' : 'บันทึกไม่สำเร็จ กรุณาตรวจ migration และรายการโมเดล', 'error');
  } finally {
    ui.mediaModelSave.disabled = false;
  }
}
function renderBusiness(data) {
  state.business = data;
  const accounts = data.accounts || {};
  const payments = data.payments || {};
  const paidAmount = (Number(payments.paidAmountSatang || 0) / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  ui.businessSummary.replaceChildren();
  [
    ['บัญชีทั้งหมด', accounts.total, 'business-total'],
    ['มีห้องเรียนแล้ว', accounts.activated, 'business-active'],
    ['บันทึกงานวันนี้', accounts.recordedToday, 'business-active'],
    ['บันทึกงานใน 7 วัน', accounts.recorded7d, 'business-active'],
    ['บันทึกงานใน 30 วัน', accounts.recorded30d, 'business-active'],
    ['บัญชีทดลอง', accounts.trial, 'business-trial'],
    ['บัญชีที่จ่ายเงินแล้ว', accounts.paid, 'business-paid'],
    ['ยอดชำระสำเร็จ', `${paidAmount} บาท`, 'business-revenue']
  ].forEach(([label, value, type]) => {
    const card = element('article', `summary-card ${type}`);
    card.append(element('span', '', label), element('strong', '', value ?? '—'));
    ui.businessSummary.append(card);
  });
  const renderList = (target, rows, disabled = false) => {
    target.replaceChildren();
    rows.forEach(([title, detail]) => {
      const item = element('div', `business-availability-item${disabled ? ' is-disabled' : ''}`);
      item.append(element('strong', '', title), element('span', '', detail));
      target.append(item);
    });
  };
  renderList(ui.businessAvailable, [
    ['บัญชีผู้ใช้', 'จำนวนจาก teacher_profiles'],
    ['มีห้องเรียนแล้ว', `${accounts.activated ?? 0} จาก ${accounts.total ?? 0} บัญชี`],
    ['สถานะสมาชิก', `${accounts.eligible ?? 0} บัญชีสถานะปกติ · ${accounts.expired ?? 0} หมดอายุ`],
    ['คำสั่งซื้อที่ชำระแล้ว', `${payments.paidOrders || 0} รายการ`],
    ['ยอดชำระรวม', `${paidAmount} บาท`]
  ]);
  renderList(ui.businessFuture, [
    ['ออนไลน์ตอนนี้', 'ต้องเพิ่ม heartbeat หรือ session presence'],
    ['เปิดเว็บโดยไม่บันทึกงาน', 'ต้องเพิ่ม activity log'],
    ['เอกสารที่สร้าง', 'ต้องเพิ่ม document usage event'],
    ['AI token และค่าใช้จ่าย', 'ต้องเพิ่ม AI usage ledger']
  ], true);
  ui.businessUpdated.textContent = `อัปเดต ${formatDate(data.generatedAt, true)}`;
  renderBusinessAccounts();
  renderUsage();
}

function renderBusinessAccounts() {
  const rows = [...(state.business?.rows || [])];
  const sort = state.businessAccountSort;
  rows.sort((a, b) => {
    if (sort === 'classrooms') return (b.classrooms || 0) - (a.classrooms || 0) || String(a.email).localeCompare(String(b.email));
    if (sort === 'activity') return (Date.parse(b.lastRecordedAt || '') || 0) - (Date.parse(a.lastRecordedAt || '') || 0) || String(a.email).localeCompare(String(b.email));
    return (Date.parse(b.registeredAt || '') || 0) - (Date.parse(a.registeredAt || '') || 0) || String(a.email).localeCompare(String(b.email));
  });
  ui.businessAccountList.replaceChildren();
  rows.slice(0, 5).forEach(row => {
    const button = element('button', 'account-preview-item');
    button.type = 'button';
    const detail = sort === 'classrooms' ? `${row.classrooms || 0} ห้องเรียน` : sort === 'activity' ? (row.lastRecordedAt ? formatDate(row.lastRecordedAt, true) : 'ยังไม่พบงานที่บันทึก') : formatDate(row.registeredAt, true);
    button.append(element('strong', '', row.email), element('span', '', detail));
    button.addEventListener('click', () => accountDetail(row));
    ui.businessAccountList.append(button);
  });
  if (!rows.length) ui.businessAccountList.append(element('p', 'database-note', 'ยังไม่มีบัญชีผู้ใช้'));
}

function accountDetail(row) {
  ui.modalTitle.textContent = row.email || 'รายละเอียดบัญชี';
  ui.modalContent.replaceChildren();
  const fields = [
    ['อีเมล', row.email],
    ['สถานะสมาชิก', row.subscriptionStatus || 'ไม่ระบุ'],
    ['สมัครเมื่อ', formatDate(row.registeredAt, true)],
    ['วันหมดอายุ', formatDate(row.paidUntil)],
    ['เคยชำระเงิน', row.hasPaid ? 'ใช่' : 'ยังไม่พบรายการชำระสำเร็จ'],
    ['จำนวนห้องเรียน', row.classrooms ?? 0],
    ['รายการตารางสอน', row.timetableEntries ?? 0],
    ['รายการเช็กชื่อที่แก้ไขใน 30 วัน', row.attendance30d ?? 0],
    ['หัวข้อคะแนนที่แก้ไขใน 30 วัน', row.scoreItems30d ?? 0],
    ['คะแนนนักเรียนที่แก้ไขใน 30 วัน', row.studentScores30d ?? 0],
    ['งานล่าสุดที่พบ', formatDate(row.lastRecordedAt, true)],
    ['บัญชี ID', row.teacherId]
  ];
  fields.forEach(([label, value]) => {
    const box = element('div', 'detail-field');
    box.append(element('span', '', label), element('p', '', value ?? '—'));
    ui.modalContent.append(box);
  });
  ui.modal.hidden = false;
  ui.closeModal.focus();
}

function renderUsage() {
  const data = state.business;
  if (!data) return;
  const query = ui.usageSearch.value.trim().toLocaleLowerCase('th-TH');
  const filter = ui.usageFilter.value;
  const rows = (data.rows || []).filter(row => {
    if (query && !String(row.email || '').toLocaleLowerCase('th-TH').includes(query)) return false;
    if (filter === 'recorded7d') return row.recorded7d;
    if (filter === 'recorded30d') return row.recorded30d;
    if (filter === 'activated') return row.classrooms > 0;
    if (filter === 'unactivated') return row.classrooms === 0;
    if (filter === 'paid') return row.hasPaid;
    return true;
  });
  ui.usageList.replaceChildren();
  rows.forEach(row => {
    const card = element('article', 'usage-account-card');
    const main = element('div', 'usage-account-main');
    main.append(element('strong', '', row.email), element('span', '', `สถานะ ${row.subscriptionStatus || 'ไม่ระบุ'} · สมัคร ${formatDate(row.registeredAt)}`));
    const metrics = element('div', 'usage-account-metrics');
    metrics.append(
      element('span', '', `${row.classrooms} ห้องเรียน`),
      element('span', '', `เช็กชื่อ 30 วัน ${row.attendance30d}`),
      element('span', '', row.recorded7d ? 'บันทึกงานใน 7 วัน' : 'ไม่พบบันทึกงานใน 7 วัน'),
      element('span', '', row.lastRecordedAt ? `งานล่าสุด ${formatDate(row.lastRecordedAt, true)}` : 'ยังไม่พบงานที่บันทึก')
    );
    const button = element('button', 'row-button', 'รายละเอียด');
    button.type = 'button';
    button.addEventListener('click', () => accountDetail(row));
    card.append(main, metrics, button);
    ui.usageList.append(card);
  });
  if (!rows.length) ui.usageList.append(element('div', 'empty-state', 'ไม่พบบัญชีที่ตรงกับตัวกรอง'));
  ui.usageCount.textContent = `แสดง ${rows.length} จาก ${data.rows?.length || 0} บัญชี`;
  ui.usageUpdated.textContent = `อัปเดต ${formatDate(data.generatedAt, true)}`;
}

async function loadBusiness() {
  ui.globalStatus.textContent = 'กำลังโหลดภาพรวมธุรกิจ…';
  try { renderBusiness(await request('/api/dev/data?resource=business')); ui.globalStatus.textContent = ''; }
  catch (error) { handleDataError(error); }
}

function tokenCell(usage) {
  const cell = element('td', 'v2-token-cell');
  if (usage?.available === false) {
    cell.append(element('strong', '', '—'), element('small', '', 'ไม่มี usage log ย้อนหลัง'));
    return cell;
  }
  cell.append(element('strong', '', Number(usage?.tokens || 0).toLocaleString('th-TH')));
  if (usage?.unavailable) cell.append(element('small', '', `ไม่รายงาน ${usage.unavailable} ครั้ง`));
  return cell;
}

function renderV2Media(data) {
  state.v2Media = data;
  ui.v2MediaRows.replaceChildren();
  const rows = data.rows || [];
  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.append(element('td', 'v2-media-user', row.teacher || '—'));
    const title = element('td', 'v2-media-title', row.title || 'สื่อการเรียนรู้');
    const version = row.versionId ? ` · Ver ${String(row.versionId).slice(0, 8)}` : '';
    title.append(element('small', '', `${formatDate(row.updatedAt, true)}${version}`));
    tr.append(title, tokenCell(row.chat), tokenCell(row.build));
    const runtimeCell = document.createElement('td');
    if (row.runtimeUrl) {
      const runtime = element('a', 'secondary-button v2-runtime-link', 'เปิด Runtime');
      runtime.href = row.runtimeUrl;
      runtime.target = '_blank';
      runtime.rel = 'noopener noreferrer';
      runtimeCell.append(runtime);
    } else runtimeCell.append(element('span', 'muted-text', 'ยังไม่ตั้งค่า Media Host'));
    tr.append(runtimeCell);
    ui.v2MediaRows.append(tr);
  }
  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.append(element('td', 'empty-state', 'ยังไม่พบสื่อที่สร้าง Runtime สำเร็จ'));
    tr.firstElementChild.colSpan = 5;
    ui.v2MediaRows.append(tr);
  }
  ui.v2MediaCount.textContent = `พบ ${Number(data.generatedVersions || rows.length).toLocaleString('th-TH')} Version จาก ${Number(data.generatedSessions || 0).toLocaleString('th-TH')} Session · ตรวจ ${Number(data.scannedTeachers || 0).toLocaleString('th-TH')} บัญชี`;
  ui.v2MediaUpdated.textContent = `อัปเดต ${formatDate(data.generatedAt, true)}`;
}

async function loadV2Media() {
  ui.globalStatus.textContent = 'กำลังโหลดรายการสื่อและโทเคน…';
  ui.v2MediaRefresh.disabled = true;
  try {
    renderV2Media(await request('/api/dev/data?resource=v2-media'));
    ui.globalStatus.textContent = '';
  } catch (error) {
    if (error.status === 401) handleDataError(error);
    else ui.globalStatus.textContent = error.status === 503
      ? 'ยังไม่พร้อมอ่านข้อมูล ClassKru Media V2 กรุณาตรวจการตั้งค่า Storage และฐานข้อมูล'
      : 'โหลดรายการสื่อ ClassKru Media V2 ไม่สำเร็จ กรุณาลองใหม่';
  } finally {
    ui.v2MediaRefresh.disabled = false;
  }
}

function handleDataError(error) {
  if (error.status === 401) {
    showLogin('Session หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
    return;
  }
  ui.globalStatus.textContent = error.status === 503
    ? 'ระบบฐานข้อมูลฝั่งผู้พัฒนายังไม่ได้ตั้งค่า กรุณาตรวจ Environment Variables และ migration'
    : 'ไม่สามารถโหลดข้อมูลได้ในขณะนี้';
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll('.workspace-view').forEach(panel => panel.classList.toggle('active', panel.id === `view-${view}`));
  document.querySelectorAll('.nav-button').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  if (view === 'overview') loadOverview();
  if (view === 'business' || view === 'usage') loadBusiness();
  if (view === 'reports') loadReports();
  if (view === 'ideas-biggy') loadIdeas('biggy');
  if (view === 'ideas-petchpetch') loadIdeas('petchpetch');
  if (view === 'database') loadDatabase();
  if (view === 'billing') loadBilling();
  if (view === 'media-models') loadMediaModels();
  if (view === 'v2-media') loadV2Media();
}

ui.loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const password = ui.password.value;
  if (!password) return setLoginStatus('กรุณากรอกรหัสผ่าน');
  ui.loginButton.disabled = true;
  setLoginStatus('กำลังตรวจสอบ…');
  try {
    await request('/api/dev/login', { method: 'POST', body: JSON.stringify({ password }) });
    ui.password.value = '';
    setLoginStatus('เข้าสู่ระบบสำเร็จ', 'success');
    showConsole();
  } catch (error) {
    if (error.status === 429) setLoginStatus('ลองรหัสผ่านเกินกำหนด กรุณารอ 15 นาที');
    else if (error.status === 503) setLoginStatus('Developer Console ยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์');
    else setLoginStatus(`รหัสผ่านไม่ถูกต้อง${Number.isInteger(error.payload?.attemptsLeft) ? ` (เหลือ ${error.payload.attemptsLeft} ครั้ง)` : ''}`);
  } finally {
    ui.loginButton.disabled = false;
  }
});

ui.togglePassword.addEventListener('click', () => {
  const show = ui.password.type === 'password';
  ui.password.type = show ? 'text' : 'password';
  ui.togglePassword.textContent = show ? 'ซ่อน' : 'แสดง';
  ui.togglePassword.setAttribute('aria-pressed', String(show));
  ui.togglePassword.setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
});

ui.logout.addEventListener('click', async () => {
  await request('/api/dev/logout', { method: 'POST' }).catch(() => null);
  showLogin('ออกจากระบบแล้ว');
});
ui.refresh.addEventListener('click', () => switchView(state.view));
ui.v2MediaRefresh.addEventListener('click', loadV2Media);
ui.reportFilters.addEventListener('submit', event => { event.preventDefault(); loadReports(); });
ui.usageSearch.addEventListener('input', renderUsage);
ui.usageFilter.addEventListener('change', renderUsage);
document.querySelectorAll('[data-account-sort]').forEach(button => button.addEventListener('click', () => {
  state.businessAccountSort = button.dataset.accountSort;
  document.querySelectorAll('[data-account-sort]').forEach(tab => {
    const active = tab === button;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  renderBusinessAccounts();
}));
ui.loadTable.addEventListener('click', loadDatabase);
ui.mediaModelsForm.addEventListener('submit', saveMediaModels);
ui.mediaModelRefresh.addEventListener('click', refreshMediaCatalog);
ui.mediaModelSearch.addEventListener('input', () => { if (state.mediaModels) renderMediaModels(); });
ui.closeModal.addEventListener('click', () => { ui.modal.hidden = true; });
ui.modal.addEventListener('click', event => { if (event.target === ui.modal) ui.modal.hidden = true; });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !ui.modal.hidden) ui.modal.hidden = true; });
document.querySelectorAll('.nav-button').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
document.querySelectorAll('[data-open-view]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.openView)));
document.querySelectorAll('[data-idea-form]').forEach(form => form.addEventListener('submit', event => { event.preventDefault(); saveIdea(form); }));
document.addEventListener('submit', event => {
  const form = event.target.closest('[data-comment-form]');
  if (!form) return;
  event.preventDefault();
  saveComment(form);
});
document.addEventListener('change', event => {
  if (event.target.matches('[data-idea-complete]')) toggleIdea(event.target);
});

(async function initialize() {
  try {
    const session = await request('/api/dev/session');
    if (session.authenticated) showConsole();
    else showLogin(session.configured ? '' : 'Developer Console ยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์');
  } catch (_) {
    showLogin('ไม่สามารถตรวจสอบสถานะระบบได้');
  }
})();
