const $ = selector => document.querySelector(selector);
const API = '/api/v2';
const SESSION_KEY = 'classkru.mediaLab.v2.sessionId';
const SETTINGS_KEY = 'classkru.mediaLab.v2.settings';
const DEVELOPER_EMAILS = new Set(['petch.0231@gmail.com', 'supakit.radiation@gmail.com', 'classkru.dev@gmail.com']);
const supabaseClient = window.supabase?.createClient('https://dzntiiuyqvkaxqpqzxeh.supabase.co', 'sb_publishable_SePLBF-dsJfx5T6Yvvcuew_vntSr3Vc');
const state = { userId: '', email: '', isDeveloper: false, sessionId: '', backend: 'openrouter', provider: 'ollama', model: 'openrouter/free', modelSelections: {}, busy: false };
let authGeneration = 0;

function userStorageKey(key) { return `${key}:${state.userId}`; }

async function api(path, options = {}) {
  const { data } = await supabaseClient.auth.getSession();
  const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
  if (data.session?.access_token) headers.authorization = `Bearer ${data.session.access_token}`;
  const response = await fetch(path, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || body.error || `HTTP ${response.status}`);
    error.payload = body;
    throw error;
  }
  return body;
}

function requestSettings() {
  return state.isDeveloper ? { backend: state.backend, local_provider: state.provider, model: state.model } : {};
}

function setBusy(value, status = '') {
  state.busy = value;
  $('#send-button').disabled = value;
  $('#build-button').disabled = value || !state.sessionId || !$('#chat-log .message.teacher');
  $('#status-text').textContent = status || (value ? 'กำลังทำงาน…' : 'พิมพ์สั้น ๆ ได้เลย แล้วค่อยช่วยกันคิดต่อ');
  $('#message-input').disabled = value;
}

function addMessage(role, text, pending = false) {
  const node = document.createElement('div');
  node.className = `message ${role}${pending ? ' pending' : ''}`;
  node.textContent = text;
  $('#chat-log').append(node);
  $('#chat-log').scrollTop = $('#chat-log').scrollHeight;
  $('#build-button').disabled = state.busy || !$('#chat-log .message.teacher');
  return node;
}

function renderMessages(messages = []) {
  $('#chat-log').replaceChildren();
  for (const message of messages) {
    if (message.kind !== 'v2_chat' && message.kind !== 'v2_build_completed') continue;
    addMessage(message.role === 'teacher' ? 'teacher' : 'assistant', message.content);
  }
}

function renderUsage(usage = {}) {
  const panel = $('#usage-panel');
  if (!state.isDeveloper) { panel.replaceChildren(); return; }
  if (!usage.call_count) { panel.textContent = 'ยังไม่มีข้อมูลการเรียก AI ในเซสชันนี้'; return; }
  const summary = document.createElement('div');
  summary.className = 'usage-grid';
  const total = document.createElement('span');
  total.className = 'usage-chip';
  total.textContent = `${Number(usage.total_tokens || 0).toLocaleString()} tokens รวม · ${usage.call_count} calls`;
  summary.append(total);
  if (usage.unavailable_calls) {
    const missing = document.createElement('span');
    missing.className = 'usage-chip';
    missing.textContent = `${usage.unavailable_calls} calls ไม่มี token usage จาก backend`;
    summary.append(missing);
  }
  for (const phase of usage.by_phase || []) {
    const chip = document.createElement('span');
    chip.className = 'usage-chip';
    chip.textContent = `${phase.phase}: รวม ${Number(phase.total_tokens || 0).toLocaleString()} · เข้า ${Number(phase.input_tokens || 0).toLocaleString()} · ออก ${Number(phase.output_tokens || 0).toLocaleString()} (${phase.call_count} calls)`;
    summary.append(chip);
  }
  for (const call of usage.calls || []) {
    const row = document.createElement('span');
    row.className = 'usage-chip usage-call';
    row.textContent = `${call.phase} · ${call.model} · in ${call.input_tokens ?? '—'} / out ${call.output_tokens ?? '—'} / total ${call.total_tokens ?? '—'} · ${call.usage_source}`;
    summary.append(row);
  }
  panel.replaceChildren(summary);
}

function backendLabel() {
  if (!state.isDeveloper) { $('#backend-label').textContent = 'ClassKru AI'; return; }
  const label = state.backend === 'codex' ? 'Codex CLI ในเครื่อง' : state.backend === 'local' ? `${state.provider} local` : 'OpenRouter API';
  $('#backend-label').textContent = `${label} · ${state.model || 'เลือกโมเดล'}`;
}

function saveSettings() {
  state.backend = $('#backend-select').value;
  state.provider = $('#provider-select').value;
  state.model = $('#model-select').value;
  state.modelSelections[modelSelectionKey(state.backend, state.provider)] = state.model;
  persistSettings();
  $('#provider-row').hidden = state.backend !== 'local';
  backendLabel();
}

function modelSelectionKey(backend, provider) {
  return backend === 'local' ? provider : backend;
}

function persistSettings() {
  localStorage.setItem(userStorageKey(SETTINGS_KEY), JSON.stringify({ backend: state.backend, provider: state.provider, model: state.model, modelSelections: state.modelSelections }));
}

async function initializeLegacy() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const config = await api('/api/config');
    state.backend = ['openrouter', 'codex', 'local'].includes(saved.backend) ? saved.backend : 'openrouter';
    state.provider = ['ollama', 'lmstudio'].includes(saved.provider) ? saved.provider : 'ollama';
    state.model = String(saved.model || config.defaultBuilderModel || 'openrouter/free');
    state.modelSelections = saved.modelSelections && typeof saved.modelSelections === 'object' ? saved.modelSelections : {};
    if (saved.model) state.modelSelections[modelSelectionKey(state.backend, state.provider)] ||= String(saved.model);
    $('#backend-select').value = state.backend;
    $('#provider-select').value = state.provider;
    $('#provider-row').hidden = state.backend !== 'local';
    if (state.backend === 'openrouter' && !config.configured) $('#key-note').textContent = 'OpenRouter key belum terpasangใน local server (.env.local). หน้านี้จะไม่อ่านหรือแสดง key';
    backendLabel();
  } catch (error) {
    $('#status-text').textContent = `เชื่อมต่อ MiniLab ไม่สำเร็จ: ${error.message}`;
    return;
  }
  try {
    let sessionId = localStorage.getItem(SESSION_KEY) || '';
    let result;
    if (sessionId) {
      try { result = await api(`${API}/sessions/${encodeURIComponent(sessionId)}`); }
      catch { sessionId = ''; }
    }
    if (!sessionId) {
      result = await api(`${API}/sessions`, { method: 'POST', body: '{}' });
      sessionId = result.session.id;
      localStorage.setItem(SESSION_KEY, sessionId);
    }
    state.sessionId = sessionId;
    if (!result?.session) result = await api(`${API}/sessions/${encodeURIComponent(sessionId)}`);
    renderMessages(result.session.messages);
    renderUsage(result.session.usage);
    setBusy(false);
  } catch (error) {
    $('#status-text').textContent = `เปิดบทสนทนาไม่สำเร็จ: ${error.message}`;
  }
}

function renderRun(run) {
  if (!run?.runtime_url || run.status !== 'passed') {
    $('#result-panel').hidden = true;
    $('#preview-frame').removeAttribute('src');
    $('#runtime-link').hidden = true;
    return;
  }
  $('#result-title').textContent = run.title || 'สื่อการเรียนรู้';
  $('#result-summary').textContent = run.summary || '';
  $('#preview-frame').src = run.runtime_url;
  $('#runtime-link').href = run.runtime_url;
  $('#runtime-link').hidden = false;
  $('#result-panel').hidden = false;
}

function renderSession(session) {
  state.sessionId = session.id;
  localStorage.setItem(userStorageKey(SESSION_KEY), state.sessionId);
  renderMessages(session.messages);
  renderUsage(session.usage);
  renderRun(session.latest_run);
  setBusy(false);
}

async function activateSession(session) {
  if (state.userId === session.user.id && !$('.app-shell').hidden) return;
  const generation = ++authGeneration;
  state.userId = session.user.id;
  state.email = String(session.user.email || '').trim().toLowerCase();
  state.isDeveloper = DEVELOPER_EMAILS.has(state.email);
  $('.app-shell').hidden = false;
  $('#auth-panel').hidden = true;
  $('#settings-open').hidden = !state.isDeveloper;
  try {
    const config = await api('/api/v2/config');
    if (generation !== authGeneration) return;
    state.isDeveloper = Boolean(config.developer);
    document.body.classList.toggle('developer-mode', state.isDeveloper);
    $('#settings-open').hidden = !state.isDeveloper;
    if (config.deployment) {
      for (const option of [...$('#backend-select').options]) if (option.value !== 'openrouter') option.remove();
      $('#provider-row').hidden = true;
      $('#codex-refresh').hidden = true;
    }
    const saved = state.isDeveloper ? JSON.parse(localStorage.getItem(userStorageKey(SETTINGS_KEY)) || '{}') : {};
    state.backend = !config.deployment && ['openrouter', 'codex', 'local'].includes(saved.backend) ? saved.backend : 'openrouter';
    state.provider = ['ollama', 'lmstudio'].includes(saved.provider) ? saved.provider : 'ollama';
    state.model = String(saved.model || config.defaultBuilderModel || '');
    state.modelSelections = saved.modelSelections && typeof saved.modelSelections === 'object' ? saved.modelSelections : {};
    if (saved.model) state.modelSelections[modelSelectionKey(state.backend, state.provider)] ||= String(saved.model);
    $('#backend-select').value = state.backend;
    $('#provider-select').value = state.provider;
    $('#provider-row').hidden = state.backend !== 'local';
    if (state.isDeveloper && state.backend === 'openrouter' && !config.configured) $('#key-note').textContent = 'OpenRouter key ยังไม่พร้อมใน local server (.env.local)';
    backendLabel();
    let sessionId = localStorage.getItem(userStorageKey(SESSION_KEY)) || '';
    let result = await api(`${API}/sessions`);
    if (!sessionId && result.sessions?.length) sessionId = result.sessions[0].id;
    if (sessionId) {
      try { result = await api(`${API}/sessions/${encodeURIComponent(sessionId)}`); }
      catch { sessionId = ''; }
    }
    if (!sessionId) {
      result = await api(`${API}/sessions`, { method: 'POST', body: '{}' });
      renderSession(result.session);
      return;
    }
    renderSession(result.session);
  } catch (error) {
    if (generation !== authGeneration) return;
    $('#auth-status').textContent = `เปิด Mini Lab ไม่สำเร็จ: ${error.message}`;
    $('.app-shell').hidden = true;
    $('#auth-panel').hidden = false;
  }
}

function signOutView() {
  authGeneration++;
  state.userId = ''; state.email = ''; state.isDeveloper = false; state.sessionId = '';
  document.body.classList.remove('developer-mode');
  $('.app-shell').hidden = true;
  $('#settings-open').hidden = true;
  $('#work-dialog').hidden = true;
  $('#auth-panel').hidden = false;
}

$('#auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#auth-submit');
  button.disabled = true;
  $('#auth-status').textContent = 'กำลังเข้าสู่ระบบ…';
  const { error } = await supabaseClient.auth.signInWithPassword({ email: $('#auth-email').value.trim(), password: $('#auth-password').value });
  if (error) $('#auth-status').textContent = error.message === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : `เข้าสู่ระบบไม่สำเร็จ: ${error.message}`;
  else $('#auth-status').textContent = '';
  button.disabled = false;
});

async function initialize() {
  if (!supabaseClient) { $('#auth-panel').hidden = false; $('#auth-status').textContent = 'โหลดระบบเข้าสู่ระบบ ClassKru ไม่สำเร็จ กรุณารีเฟรชหน้า'; return; }
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session) void activateSession(session);
    else signOutView();
  });
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) { $('#auth-panel').hidden = false; $('#auth-status').textContent = `ตรวจสอบบัญชีไม่สำเร็จ: ${error.message}`; return; }
  if (data.session) await activateSession(data.session);
  else { $('#auth-panel').hidden = false; $('.app-shell').hidden = true; }
}

$('#chat-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (state.busy || !state.sessionId) return;
  const input = $('#message-input');
  const message = input.value.trim();
  if (!message) return;
  addMessage('teacher', message);
  input.value = '';
  setBusy(true, 'AI กำลังคิดกับคุณ…');
  const pending = addMessage('assistant', 'กำลังอ่านบริบท…', true);
  try {
    const result = await api(`${API}/sessions/${encodeURIComponent(state.sessionId)}/chat`, { method: 'POST', body: JSON.stringify({ ...requestSettings(), message }) });
    pending.remove();
    addMessage('assistant', result.reply);
    renderUsage(result.usage);
    setBusy(false);
    input.focus();
  } catch (error) {
    pending.remove();
    addMessage('assistant', `ส่งข้อความไม่สำเร็จ: ${error.message}`);
    if (error.payload?.usage) renderUsage(error.payload.usage);
    setBusy(false);
  }
});

$('#build-button').addEventListener('click', async () => {
  if (state.busy || !state.sessionId) return;
  setBusy(true, 'กำลังออกแบบและสร้างไฟล์ HTML หน้าเดียว…');
  $('#result-panel').hidden = true;
  try {
    const result = await api(`${API}/sessions/${encodeURIComponent(state.sessionId)}/build`, { method: 'POST', body: JSON.stringify(requestSettings()) });
    renderRun({ ...result.run, status: 'passed', runtime_url: result.artifact_url });
    $('#validation-note').hidden = !(result.run.validation && JSON.parse(result.run.validation).warnings?.length);
    $('#validation-note').textContent = result.run.validation ? JSON.parse(result.run.validation).warnings.join(' · ') : '';
    $('#result-panel').hidden = false;
    addMessage('assistant', `สร้างสื่อ HTML หน้าเดียวเสร็จแล้ว: ${result.run.title || 'สื่อการเรียนรู้'}`);
    renderUsage(result.usage);
    if (!$('#work-dialog').hidden) await loadWorkList();
    $('#result-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    addMessage('assistant', `ยังสร้างไฟล์ไม่สำเร็จ: ${error.message} คุณแก้โจทย์หรือกดสร้างใหม่ได้`);
    if (error.payload?.usage) renderUsage(error.payload.usage);
  } finally { setBusy(false); }
});

function openSettings() {
  if (!state.isDeveloper) return;
  $('#settings-dialog').hidden = false;
  $('.app-shell').inert = true;
  $('#backend-select').focus();
  void loadSettingsModels();
}

function closeSettings() {
  $('#settings-dialog').hidden = true;
  $('.app-shell').inert = false;
  $('#settings-open').focus();
}

$('#settings-open').addEventListener('click', openSettings);
$('#settings-close').addEventListener('click', closeSettings);
$('#settings-dialog').addEventListener('click', event => {
  if (event.target === $('#settings-dialog')) closeSettings();
});
document.addEventListener('keydown', event => {
  if ($('#settings-dialog').hidden) return;
  if (event.key === 'Escape') { closeSettings(); return; }
  if (event.key === 'Tab') {
    const focusables = [...$('#settings-dialog').querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')].filter(node => !node.closest('[hidden]'));
    if (!focusables.length) return;
    if (event.shiftKey && document.activeElement === focusables[0]) { event.preventDefault(); focusables.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === focusables.at(-1)) { event.preventDefault(); focusables[0].focus(); }
  }
});
$('#backend-select').addEventListener('change', () => {
  $('#provider-row').hidden = $('#backend-select').value !== 'local';
  void loadSettingsModels();
});
$('#provider-select').addEventListener('change', () => void loadSettingsModels());
$('#codex-refresh').addEventListener('click', () => void loadSettingsModels(true));
$('#model-select').addEventListener('change', () => {
  state.backend = $('#backend-select').value;
  state.provider = $('#provider-select').value;
  state.model = $('#model-select').value;
  state.modelSelections[modelSelectionKey(state.backend, state.provider)] = state.model;
  persistSettings();
  backendLabel();
});
$('#settings-save').addEventListener('click', () => {
  saveSettings();
  closeSettings();
  $('#status-text').textContent = `เลือก ${state.backend === 'codex' ? 'Codex CLI' : state.backend === 'local' ? state.provider : 'OpenRouter'} แล้ว`;
});

async function loadSettingsModels(forceCodexRefresh = false) {
  if (!state.isDeveloper) return;
  const backend = $('#backend-select').value;
  const provider = $('#provider-select').value;
  const select = $('#model-select');
  const refresh = $('#codex-refresh');
  const status = $('#backend-status');
  const key = modelSelectionKey(backend, provider);
  $('#provider-row').hidden = backend !== 'local';
  refresh.hidden = backend !== 'codex';
  select.disabled = true;
  select.replaceChildren(new Option('กำลังโหลดรายการโมเดล…', ''));
  status.textContent = 'กำลังตรวจสอบโมเดลที่ใช้ได้…';
  try {
    let result;
    if (backend === 'openrouter') {
      const config = await api('/api/v2/config');
      if (!config.configured) throw new Error('ยังไม่ได้ตั้งค่า OpenRouter ใน local server');
      result = await api('/api/v2/models');
    } else if (backend === 'codex') {
      result = await api(`/api/v2/models?backend=codex${forceCodexRefresh ? '&refresh=1' : ''}`);
    } else {
      result = await api(`/api/v2/models?backend=local&provider=${encodeURIComponent(provider)}`);
      if (!result.available) throw new Error(result.message || `${provider} ยังไม่พร้อมใช้งาน`);
    }
    const models = Array.isArray(result.models) ? result.models : [];
    if (!models.length) throw new Error(result.message || 'ไม่พบโมเดลที่ใช้งานได้ใน backend นี้');
    const groups = new Map();
    for (const item of models) {
      const groupName = backend === 'openrouter' ? (item.free ? 'OpenRouter · ฟรี' : 'OpenRouter') : backend === 'codex' ? 'โมเดลจาก Codex CLI' : `${provider} · โมเดลในเครื่อง`;
      if (!groups.has(groupName)) groups.set(groupName, document.createElement('optgroup'));
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name || item.id;
      groups.get(groupName).append(option);
    }
    select.replaceChildren(...[...groups.entries()].map(([label, group]) => { group.label = label; return group; }));
    const preferred = state.modelSelections[key] || (backend === state.backend ? state.model : '');
    const selected = models.some(item => item.id === preferred) ? preferred : models[0].id;
    select.value = selected;
    select.disabled = false;
    state.backend = backend;
    state.provider = provider;
    state.model = selected;
    state.modelSelections[key] = selected;
    persistSettings();
    backendLabel();
    if (backend === 'codex') {
      status.textContent = result.authenticated
        ? `${result.message || 'Codex CLI เชื่อมต่อแล้ว'} · ${models.length} โมเดล`
        : `${result.message || 'ไม่พบสถานะล็อกอิน Codex CLI'} · กรุณาเข้าสู่ระบบ Codex CLI ในเครื่อง`;
    } else {
      status.textContent = `${backend === 'local' ? `${provider} พร้อมใช้งาน` : 'OpenRouter พร้อมใช้งาน'} · ${models.length} โมเดล`;
    }
  } catch (error) {
    select.replaceChildren(new Option('โหลดรายการโมเดลไม่สำเร็จ', ''));
    state.backend = backend;
    state.provider = provider;
    state.model = '';
    status.textContent = error.message;
    backendLabel();
  }
}

async function loadWorkList() {
  const list = $('#work-list');
  list.replaceChildren();
  const loading = document.createElement('div');
  loading.className = 'work-empty';
  loading.textContent = 'กำลังโหลดสื่อของคุณ…';
  list.append(loading);
  try {
    const result = await api(`${API}/sessions`);
    list.replaceChildren();
    if (!result.sessions?.length) {
      const empty = document.createElement('div');
      empty.className = 'work-empty';
      empty.textContent = 'ยังไม่มีสื่อที่บันทึกไว้ เริ่มสร้างสื่อชิ้นแรกได้เลย';
      list.append(empty);
      return;
    }
    for (const session of result.sessions) {
      const row = document.createElement('article');
      row.className = 'work-row';
      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = session.title || 'สื่อไม่มีชื่อ';
      const date = document.createElement('small');
      date.textContent = `แก้ไขล่าสุด ${new Date(session.updated_at).toLocaleString('th-TH')}`;
      info.append(title, date);
      const actions = document.createElement('div');
      actions.className = 'work-row-actions';
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = 'ดู / แก้ไข';
      open.addEventListener('click', () => void openWork(session.id));
      actions.append(open);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete-work-button';
      remove.textContent = 'ลบงาน';
      remove.setAttribute('aria-label', `ลบงาน ${session.title || ''}`);
      remove.addEventListener('click', () => void deleteWork(session.id, session.title, remove));
      actions.append(remove);
      if (session.latest_run?.runtime_url) {
        const runtime = document.createElement('a');
        runtime.href = session.latest_run.runtime_url;
        runtime.target = '_blank';
        runtime.rel = 'noopener';
        runtime.textContent = 'หน้า Runtime';
        actions.append(runtime);
      }
      row.append(info, actions);
      list.append(row);
    }
  } catch (error) {
    list.replaceChildren();
    const failure = document.createElement('div');
    failure.className = 'work-empty';
    failure.textContent = `โหลดรายการสื่อไม่สำเร็จ: ${error.message}`;
    list.append(failure);
  }
}

async function deleteWork(sessionId, title, button) {
  if (!confirm(`ลบ “${title || 'สื่อไม่มีชื่อ'}” และบทสนทนาที่เกี่ยวข้องอย่างถาวรหรือไม่?`)) return;
  button.disabled = true;
  try {
    await api(`${API}/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
    if (state.sessionId === sessionId) {
      localStorage.removeItem(userStorageKey(SESSION_KEY));
      state.sessionId = '';
      const result = await api(`${API}/sessions`, { method: 'POST', body: '{}' });
      renderSession(result.session);
      $('#status-text').textContent = 'ลบงานแล้ว เริ่มบทสนทนาใหม่ให้แล้ว';
    }
    await loadWorkList();
  } catch (error) {
    $('#status-text').textContent = `ลบงานไม่สำเร็จ: ${error.message}`;
    button.disabled = false;
  }
}

async function openWork(sessionId) {
  try {
    const result = await api(`${API}/sessions/${encodeURIComponent(sessionId)}`);
    renderSession(result.session);
    $('#work-dialog').hidden = true;
    $('.app-shell').inert = false;
    $('#status-text').textContent = 'เปิดสื่อของคุณแล้ว พิมพ์ต่อเพื่อแก้ไขได้เลย';
    $('#message-input').focus();
  } catch (error) { $('#status-text').textContent = `เปิดสื่อไม่สำเร็จ: ${error.message}`; }
}

async function createNewSession(button) {
  button.disabled = true;
  try {
    const result = await api(`${API}/sessions`, { method: 'POST', body: '{}' });
    renderSession(result.session);
    if (!$('#settings-dialog').hidden) closeSettings();
    $('#work-dialog').hidden = true;
    $('.app-shell').inert = false;
    $('#status-text').textContent = 'เริ่มบทสนทนาใหม่แล้ว';
  } catch (error) { $('#status-text').textContent = `เริ่มใหม่ไม่สำเร็จ: ${error.message}`; }
  finally { button.disabled = false; }
}

$('#my-works-open').addEventListener('click', async () => {
  $('#work-dialog').hidden = false;
  $('.app-shell').inert = true;
  $('#work-close').focus();
  await loadWorkList();
});
$('#work-close').addEventListener('click', () => { $('#work-dialog').hidden = true; $('.app-shell').inert = false; $('#my-works-open').focus(); });
$('#work-dialog').addEventListener('click', event => {
  if (event.target === $('#work-dialog')) { $('#work-dialog').hidden = true; $('.app-shell').inert = false; $('#my-works-open').focus(); }
});
$('#new-session-open').addEventListener('click', event => void createNewSession(event.currentTarget));
$('#new-session').addEventListener('click', event => void createNewSession(event.currentTarget));
$('#signout-button').addEventListener('click', () => void supabaseClient.auth.signOut());

$('#message-input').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('#chat-form').requestSubmit(); }
});

document.querySelectorAll('[data-idea]').forEach(card => card.addEventListener('click', () => {
  const input = $('#message-input');
  const current = input.value.trim();
  input.value = current ? `${current}\n${card.dataset.idea}` : card.dataset.idea;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}));

initialize();
