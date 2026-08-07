'use strict';

const state = { view: 'overview', overview: null, reports: [], ideas: { biggy: [], petchpetch: [] } };
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
  if (view === 'reports') loadReports();
  if (view === 'ideas-biggy') loadIdeas('biggy');
  if (view === 'ideas-petchpetch') loadIdeas('petchpetch');
  if (view === 'database') loadDatabase();
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
ui.reportFilters.addEventListener('submit', event => { event.preventDefault(); loadReports(); });
ui.loadTable.addEventListener('click', loadDatabase);
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
