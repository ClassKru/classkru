'use strict';

const state = { view: 'overview', overview: null, categories: [], reports: [] };
const byId = id => document.getElementById(id);
const ui = {
  loginView: byId('login-view'), consoleView: byId('console-view'), loginForm: byId('login-form'),
  password: byId('password-input'), togglePassword: byId('toggle-password'), loginButton: byId('login-button'),
  loginStatus: byId('login-status'), logout: byId('logout-button'), refresh: byId('refresh-button'),
  globalStatus: byId('global-status'), summary: byId('summary-grid'), categories: byId('category-grid'),
  recent: byId('recent-list'), lastUpdated: byId('last-updated'), reportFilters: byId('report-filters'),
  searchFilter: byId('search-filter'), categoryFilter: byId('category-filter'), statusFilter: byId('status-filter'),
  reportsBody: byId('reports-body'), reportsEmpty: byId('reports-empty'), tableSelect: byId('table-select'),
  loadTable: byId('load-table-button'), databaseTable: byId('database-table'), modal: byId('detail-modal'),
  modalTitle: byId('detail-title'), modalContent: byId('detail-content'), closeModal: byId('close-modal')
};

const STATUS_LABELS = Object.freeze({ new: 'ใหม่', reviewing: 'กำลังตรวจสอบ', resolved: 'แก้ไขแล้ว', closed: 'ปิดรายการ' });

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

function reportDetail(report) {
  ui.modalTitle.textContent = report.title || 'รายละเอียดรายงาน';
  ui.modalContent.replaceChildren();
  const fields = [
    ['สถานะ', STATUS_LABELS[report.status] || report.status],
    ['หมวดหมู่', report.category?.name || report.category_id],
    ['วันที่แจ้ง', formatDate(report.created_at, true)],
    ['รายละเอียด', report.description],
    ['ขั้นตอนที่ทำให้เกิดปัญหา', report.steps_to_reproduce || 'ไม่ได้ระบุ'],
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
  state.categories = data.categories || [];
  ui.summary.replaceChildren();
  const cards = [
    ['ทั้งหมด', data.total || 0, 'total'], ['ใหม่', data.statuses?.new || 0, 'new'],
    ['กำลังตรวจสอบ', data.statuses?.reviewing || 0, 'reviewing'], ['แก้ไขแล้ว', data.statuses?.resolved || 0, 'resolved'],
    ['ปิดรายการ', data.statuses?.closed || 0, 'closed']
  ];
  cards.forEach(([label, value, type]) => {
    const card = element('article', `summary-card ${type}`);
    card.append(element('span', '', label), element('strong', '', value));
    ui.summary.append(card);
  });

  ui.categories.replaceChildren();
  state.categories.forEach(category => {
    const card = element('article', 'category-card');
    const heading = element('div');
    heading.append(element('strong', '', category.name), element('b', '', category.count || 0));
    card.append(heading, element('p', '', category.description || category.slug));
    ui.categories.append(card);
  });
  if (!state.categories.length) ui.categories.append(element('p', 'database-note', 'ยังไม่มีหมวดหมู่ในฐานข้อมูล'));

  ui.recent.replaceChildren();
  (data.recent || []).forEach(report => {
    const button = element('button', 'recent-item');
    button.type = 'button';
    button.append(element('span', 'recent-date', formatDate(report.created_at)));
    const copy = element('span');
    copy.append(element('strong', '', report.title), element('small', '', report.category?.name || 'ไม่ระบุหมวดหมู่'));
    button.append(copy, statusPill(report.status));
    button.addEventListener('click', () => reportDetail(report));
    ui.recent.append(button);
  });
  if (!(data.recent || []).length) ui.recent.append(element('p', 'database-note', 'ยังไม่มีรายงานปัญหา'));
  ui.lastUpdated.textContent = `อัปเดต ${formatDate(new Date().toISOString(), true)}`;
  populateCategoryFilter();
}

function populateCategoryFilter() {
  const selected = ui.categoryFilter.value;
  ui.categoryFilter.replaceChildren(new Option('ทุกหมวดหมู่', ''));
  state.categories.forEach(category => ui.categoryFilter.add(new Option(category.name, category.id)));
  ui.categoryFilter.value = selected;
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
  if (data.categories?.length) {
    state.categories = data.categories;
    populateCategoryFilter();
  }
  ui.reportsBody.replaceChildren();
  state.reports.forEach(report => {
    const row = document.createElement('tr');
    const date = element('td', '', formatDate(report.created_at, true));
    const category = element('td', '', report.category?.name || '—');
    const titleCell = element('td', 'row-title');
    titleCell.append(element('strong', '', report.title), element('small', '', report.description));
    const status = document.createElement('td');
    status.append(statusPill(report.status));
    const action = document.createElement('td');
    const button = element('button', 'row-button', 'เปิดดู');
    button.type = 'button';
    button.addEventListener('click', () => reportDetail(report));
    action.append(button);
    row.append(date, category, titleCell, status, action);
    ui.reportsBody.append(row);
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

(async function initialize() {
  try {
    const session = await request('/api/dev/session');
    if (session.authenticated) showConsole();
    else showLogin(session.configured ? '' : 'Developer Console ยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์');
  } catch (_) {
    showLogin('ไม่สามารถตรวจสอบสถานะระบบได้');
  }
})();
