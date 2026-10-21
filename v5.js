'use strict';

const $ = selector => document.querySelector(selector);
const CONVERSATION_KEY_BASE = 'classkru.interactive-v5.conversationId';
const JOB_KEY_BASE = 'classkru.interactive-v5.latestJobId';
const THEME_KEY = 'classkru.interactive-v5.theme';
const MEDIA_MODE_KEY_BASE = 'classkru.interactive-v5.mediaMode';
let CONVERSATION_KEY = CONVERSATION_KEY_BASE;
let JOB_KEY = JOB_KEY_BASE;
let MEDIA_MODE_KEY = MEDIA_MODE_KEY_BASE;
const state = { conversation: null, job: null, previewJob: null, busy: false };
let defaultModels = null;
let savedModels = null;
let modelCatalog = [];
const MODEL_ROLES = ['conversation', 'architect', 'builder'];
let savedDraft = '';
let taskUsageEnabled = false;
let cardRegistry = [];
let pendingStart = null;
let authClient = null;
let loadedUserId = null;
let initialization = null;
let serviceReady = false;

function setAccountStorageKeys(userId) {
  const suffix = userId ? `.${userId}` : '';
  CONVERSATION_KEY = `${CONVERSATION_KEY_BASE}${suffix}`;
  JOB_KEY = `${JOB_KEY_BASE}${suffix}`;
  MEDIA_MODE_KEY = `${MEDIA_MODE_KEY_BASE}${suffix}`;
}

function clearAccountView() {
  serviceReady = false;
  state.conversation = null; state.job = null; state.previewJob = null; state.busy = false; pendingStart = null; savedDraft = '';
  $('#chat-log').replaceChildren();
  $('#message-input').value = '';
  $('#task-usage-panel').hidden = true;
  $('#preview-frame').removeAttribute('src'); $('#preview-frame').hidden = true;
  $('#runtime-link').removeAttribute('href'); $('#runtime-link').hidden = true;
  $('#result-panel').hidden = true;
  $('#idea-discovery-notice').hidden = true;
  $('#retry-conversation').hidden = true;
  $('.app-shell').dataset.view = 'landing';
  renderBrief(null); renderBuildStatus(null);
}

function getAuthClient() {
  if (authClient) return authClient;
  if (!window.supabase) throw Object.assign(new Error('authentication_unavailable'), { code:'authentication_unavailable' });
  authClient = window.supabase.createClient('https://dzntiiuyqvkaxqpqzxeh.supabase.co', 'sb_publishable_SePLBF-dsJfx5T6Yvvcuew_vntSr3Vc', { auth:{ autoRefreshToken:true, persistSession:true, detectSessionInUrl:true, flowType:'pkce' } });
  return authClient;
}

function selectedMediaMode() { return $('input[name="media-mode"]:checked')?.value === '3d' ? '3d' : 'normal'; }

function setMediaMode(mode, persist = false) {
  const selected = mode === '3d' ? '3d' : 'normal';
  document.querySelectorAll('input[name="media-mode"]').forEach(input => { input.checked = input.value === selected; });
  if (persist) { try { localStorage.setItem(MEDIA_MODE_KEY, selected); } catch (_) {} }
}

function loadMediaMode() {
  try { setMediaMode(localStorage.getItem(MEDIA_MODE_KEY) || 'normal'); }
  catch (_) { setMediaMode('normal'); }
}

function renderDirections(context) {
  const panel = $('#card-directions');
  panel.hidden = !context || (!context.learning_goal_id && !context.creative_approach_id);
  for (const [selector, group, key] of [['#learning-goal-select','learning_goal','learning_goal_id'], ['#creative-approach-select','creative_approach','creative_approach_id']]) {
    const select = $(selector);
    select.replaceChildren(new Option('ไม่ระบุ', ''));
    cardRegistry.filter(card => card.group === group).forEach(card => select.add(new Option(card.title, card.id)));
    select.value = context?.[key] || '';
  }
}

function setTheme(theme, persist = false) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  const toggle = $('#theme-toggle');
  toggle.setAttribute('aria-pressed', String(isDark));
  toggle.setAttribute('aria-label', isDark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด');
  $('#theme-toggle-icon').textContent = isDark ? '☀' : '☾';
  $('#theme-toggle-label').textContent = isDark ? 'โหมดสว่าง' : 'โหมดมืด';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#0d0f15' : '#f7f8fc');
  if (persist) {
    try { localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light'); } catch (_) {}
  }
}

function updateMessageCount() {
  const input = $('#message-input');
  $('#message-count').textContent = `${input.value.length.toLocaleString('en-US')}/${input.maxLength.toLocaleString('en-US')}`;
}

async function api(path, options = {}) {
  const { data:{ session } } = await getAuthClient().auth.getSession();
  if (!session?.access_token) throw Object.assign(new Error('authentication_required'), { code:'authentication_required' });
  const response = await fetch(path.replace(/^\/api\/local\/v5(?=\/|$)/, '/api/v5'), { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}), Authorization:`Bearer ${session.access_token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || 'local_request_failed'), { code: payload.error || 'local_request_failed', payload, status: response.status });
  return payload;
}

function fillModelSettings(models) {
  for (const role of MODEL_ROLES) {
    const select = $(`#model-${role}`);
    const selected = models[role] || '';
    const entries = new Map(modelCatalog.map(item => [item.id, item.name]));
    for (const id of [selected, savedModels?.[role], defaultModels?.[role]]) if (id && !entries.has(id)) entries.set(id, `${id} · ค่าที่บันทึก/ค่าเริ่มต้น`);
    select.replaceChildren(...[...entries].map(([id, name]) => new Option(name === id ? id : `${name} (${id})`, id)));
    select.value = selected;
  }
}
async function loadModelCatalog(refresh = false) {
  $('#model-catalog-refresh').disabled = true;
  $('#model-catalog-status').textContent = 'กำลังโหลดรายชื่อโมเดลจาก OpenRouter…';
  try {
    const result = await api(`/api/local/v5/models${refresh ? '?refresh=1' : ''}`);
    const selection = Object.fromEntries(MODEL_ROLES.map(role => [role, $(`#model-${role}`).value]));
    modelCatalog = result.models;
    fillModelSettings(selection);
    $('#model-catalog-status').textContent = `โหลดรายชื่อ ${modelCatalog.length} โมเดลแล้ว · ตรวจสอบสิทธิ์ ราคา และความเข้ากันได้ก่อนใช้`;
  } catch (_) {
    $('#model-catalog-status').textContent = 'โหลดรายชื่อจาก OpenRouter ไม่สำเร็จ ยังเลือกค่าที่บันทึกหรือค่าเริ่มต้นได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองโหลดใหม่';
  } finally { $('#model-catalog-refresh').disabled = false; }
}
function closeModelSettings() {
  $('#model-settings-dialog').hidden = true;
  $('.app-shell').inert = false;
  $('#model-settings-open').focus();
}
$('#model-settings-open').addEventListener('click', async () => {
  $('#model-settings-dialog').hidden = false;
  $('.app-shell').inert = true;
  $('#model-settings-form').focus();
  $('#model-settings-status').textContent = 'กำลังโหลดการตั้งค่า…';
  $('#model-settings-save').disabled = true;
  try {
    const result = await api('/api/local/v5/model-settings');
    defaultModels = result.defaults;
    savedModels = result.models;
    fillModelSettings(result.models);
    $('#model-settings-status').textContent = result.mode === 'mock' ? 'โหมด Mock ใช้ข้อมูลจำลอง โมเดลที่เลือกจะใช้เมื่อเปิดโหมด OpenRouter การเปลี่ยนค่ามีผลกับการเรียก AI ครั้งถัดไป' : 'การเปลี่ยนค่ามีผลกับการเรียก AI ครั้งถัดไป งานที่กำลังทำอยู่อาจใช้ค่าต่างกันในแต่ละขั้นตอน';
    $('#model-settings-save').disabled = false;
    void loadModelCatalog();
  } catch (_) { $('#model-settings-status').textContent = 'โหลดการตั้งค่าไม่สำเร็จ กรุณาลองเปิดอีกครั้ง'; }
});
$('#model-settings-close').addEventListener('click', closeModelSettings);
$('#model-settings-dialog').addEventListener('click', event => { if (event.target === event.currentTarget) closeModelSettings(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#model-settings-dialog').hidden) closeModelSettings(); });
$('#model-settings-defaults').addEventListener('click', () => { if (defaultModels) fillModelSettings(defaultModels); });
$('#model-catalog-refresh').addEventListener('click', () => void loadModelCatalog(true));
$('#model-settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  const models = Object.fromEntries(MODEL_ROLES.map(role => [role, $(`#model-${role}`).value]));
  $('#model-settings-save').disabled = true;
  try {
    await api('/api/local/v5/model-settings', { method:'POST', body:JSON.stringify({ models }) });
    savedModels = models;
    $('#model-settings-status').textContent = 'บันทึกแล้ว ใช้กับการเรียก AI ครั้งถัดไป';
  } catch (error) {
    $('#model-settings-status').textContent = error.code === 'invalid_model_settings' ? 'กรุณาเลือกโมเดลให้ครบทุกส่วน' : 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง';
  } finally { $('#model-settings-save').disabled = false; }
});

function closeBriefVersions() {
  $('#brief-versions-dialog').hidden = true;
  $('.app-shell').inert = false;
  $('#brief-versions-open').focus();
}
$('#brief-versions-open').addEventListener('click', async () => {
  $('#brief-versions-dialog').hidden = false;
  $('.app-shell').inert = true;
  $('#brief-versions-form').focus();
  $('#brief-versions-save').disabled = true;
  $('#brief-versions-status').textContent = 'กำลังโหลดชุดบรีฟ…';
  try {
    const result = await api('/api/local/v5/brief-versions');
    $('#brief-version-select').replaceChildren(...result.versions.map(item => new Option(item.label, item.id)));
    $('#brief-version-select').value = result.selected;
    $('#brief-versions-status').textContent = result.missing ? 'ชุดที่เคยเลือกไม่พร้อมใช้งาน กรุณาเลือกชุดใหม่' : 'เลือกชุดแล้วกดบันทึก';
    $('#brief-versions-save').disabled = false;
  } catch (_) { $('#brief-versions-status').textContent = 'โหลดชุดบรีฟไม่สำเร็จ'; }
});
$('#brief-versions-close').addEventListener('click', closeBriefVersions);
$('#brief-versions-dialog').addEventListener('click', event => { if (event.target === event.currentTarget) closeBriefVersions(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#brief-versions-dialog').hidden) closeBriefVersions(); });
$('#brief-versions-form').addEventListener('submit', async event => {
  event.preventDefault();
  $('#brief-versions-save').disabled = true;
  try {
    await api('/api/local/v5/brief-versions', { method:'POST', body:JSON.stringify({ version:$('#brief-version-select').value }) });
    $('#brief-versions-status').textContent = 'บันทึกแล้ว ใช้กับการเรียก AI ครั้งถัดไป';
  } catch (_) { $('#brief-versions-status').textContent = 'บันทึกไม่สำเร็จ ตรวจสอบว่าชุดบรีฟมีไฟล์ครบแล้วลองอีกครั้ง'; }
  finally { $('#brief-versions-save').disabled = false; }
});

const ACTIVE_JOB_STATES = new Set(['queued', 'architecting', 'building']);
const isActiveJob = job => Boolean(job && ACTIVE_JOB_STATES.has(job.state));

async function waitForJob(jobId, initialJob, onUpdate = () => {}) {
  let job = initialJob;
  while (isActiveJob(job)) {
    await new Promise(resolve => setTimeout(resolve, 600));
    const result = await api(`/api/local/v5/jobs/${encodeURIComponent(jobId)}`);
    job = result.job;
    onUpdate(job);
  }
  return job;
}

function setBusy(busy, status = '') {
  state.busy = busy;
  $('.app-shell').dataset.busy = busy ? 'true' : 'false';
  updateMessageCount();
  $('#think-button').disabled = busy;
  $('#send-button').disabled = busy;
  $('#message-input').disabled = busy;
  $('#home-button').disabled = busy;
  $('#library-open').disabled = busy;
  $('#new-conversation').disabled = busy;
  $('#continue-last').disabled = busy;
  $('#revision-submit').disabled = busy;
  $('#revision-instruction').disabled = busy;
  $('#review-brief').disabled = busy || !state.conversation?.draft?.topic;
  document.querySelectorAll('.idea-card, .idea-guide-card, #card-directions select, #media-mode-picker input, #retry-conversation').forEach(element => { element.disabled = busy; });
  $('#status-text').textContent = status || (busy ? 'กำลังทำงาน…' : 'พิมพ์สั้น ๆ ได้เลย แล้วค่อยช่วยกันคิดต่อ');
}

function friendlyJobFailure(code) {
  if (code === 'revision_source_superseded') return 'มีสื่อฉบับใหม่กว่าแล้ว กรุณาเปิดฉบับล่าสุดจากผลงานของฉันก่อนปรับปรุง';
  if (code === 'revision_in_progress') return 'สื่อฉบับนี้กำลังปรับปรุงอยู่ กรุณารอให้การปรับปรุงปัจจุบันเสร็จก่อน';
  if (code === 'revision_scope_confirmation_required') return 'คำขอยังไม่ชัดเจนพอ กรุณาระบุส่วนที่ต้องการปรับปรุงให้ชัดก่อน';
  if (code === 'revision_content_confirmation_required') return 'กรุณายืนยันก่อนปรับวิธีเรียนรู้หรือสาระของสื่อ';
  if (code === 'revision_architect_unavailable') return 'ระบบออกแบบ Specification สำหรับการปรับปรุงนี้ไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง';
  if (code === 'artifact_not_found') return 'สื่อต้นฉบับไม่พร้อมใช้งาน กรุณาเปิดฉบับล่าสุดจากผลงานของฉันก่อนลองใหม่';
  return '';
}

function addMessage(role, content, { pending = false, suggestions = [] } = {}) {
  const node = document.createElement('div');
  node.className = `message ${role}${pending ? ' pending' : ''}`;
  node.textContent = content;
  if (role === 'assistant' && !pending && suggestions.length) {
    const choices = document.createElement('div'); choices.className = 'suggested-actions';
    for (const suggestion of suggestions.slice(0, 3)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'suggested-action'; button.textContent = suggestion;
      button.addEventListener('click', () => { $('#message-input').value = suggestion; $('#chat-form').requestSubmit(); });
      choices.append(button);
    }
    node.append(choices);
  }
  if (role === 'assistant' && !pending && $('.app-shell').dataset.view === 'session') {
    const choices = node.querySelector('.suggested-actions') || document.createElement('div');
    choices.className = 'suggested-actions';
    const ideaButton = $('#think-button');
    ideaButton.querySelector('.think-label').textContent = 'ช่วยคิดต่อจากเรื่องนี้';
    ideaButton.setAttribute('aria-label', 'ขอให้ AI ช่วยคิดต่อจากบทสนทนานี้');
    choices.append(ideaButton);
    if (!choices.isConnected) node.append(choices);
  }
  $('#chat-log').append(node); $('#chat-log').scrollTop = $('#chat-log').scrollHeight;
  return node;
}

function clearSuggestedActions() {
  const ideaButton = $('#think-button');
  if (ideaButton) $('.composer-actions').prepend(ideaButton);
  $('#chat-log').querySelectorAll('.suggested-actions').forEach(node => node.remove());
}

function briefSummary(draft = {}) {
  const mediaType = draft.media_type_requirement === 'open' || !draft.media_type ? 'ให้ AI เลือกตามเป้าหมาย' : `${draft.media_type}${draft.media_type_requirement === 'required' ? ' (กำหนด)' : ' (แนวทาง)'}`;
  const interaction = draft.interaction_preference === 'required' ? 'ต้องมี' : draft.interaction_preference === 'avoid' ? 'ไม่ต้องมี' : 'ให้ AI เลือกตามเป้าหมาย';
  const rows = [draft.topic && `หัวข้อ: ${draft.topic}`, draft.learner_level && `ผู้เรียน: ${draft.learner_level}`, draft.learning_objectives?.length && `เป้าหมาย: ${draft.learning_objectives.join(' / ')}`, `แนวสื่อ: ${mediaType}`, `ปฏิสัมพันธ์: ${interaction}`, draft.learner_action && `สิ่งที่อยากให้นักเรียนทำ: ${draft.learner_action}`, draft.constraints?.length && `ข้อกำหนด: ${draft.constraints.join(' / ')}`, draft.assumptions?.length && `สมมติฐาน: ${draft.assumptions.join(' / ')}`].filter(Boolean);
  return rows.join('\n');
}

function renderBrief(draft = null) {
  const card = $('#brief-card');
  card.hidden = !draft?.topic;
  $('#brief-text').textContent = draft ? briefSummary(draft) : '';
  $('#review-brief').disabled = state.busy || !draft?.topic;
}

function renderConversation(conversation) {
  state.conversation = conversation;
  localStorage.setItem(CONVERSATION_KEY, conversation.id);
  $('.app-shell').dataset.view = conversation.turns?.length ? 'session' : 'landing';
  $('#chat-log').replaceChildren();
  const turns = conversation.turns || [];
  const latestAssistantIndex = turns.length && turns[turns.length - 1].role !== 'teacher' ? turns.length - 1 : -1;
  turns.forEach((turn, index) => addMessage(turn.role === 'teacher' ? 'teacher' : 'assistant', turn.content, {
    suggestions: index === latestAssistantIndex ? turn.suggested_actions || [] : []
  }));
  renderBrief(conversation.draft);
  renderDirections(conversation.card_context);
  void refreshTaskUsage();
}

function formatCount(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : 'ยังไม่มีข้อมูล';
}

function renderTaskUsage(data) {
  const panel = $('#task-usage-panel');
  if (!taskUsageEnabled || !state.conversation?.id) { panel.hidden = true; return; }
  panel.hidden = false;
  const mode = data?.mode === 'live' ? 'Local · OpenRouter' : data?.mode === 'mock' ? 'Local · Mock' : 'Local';
  $('#task-usage-mode').textContent = mode;
  const usage = data?.usage;
  const thbRate = typeof data?.usd_thb_rate === 'number' && Number.isFinite(data.usd_thb_rate) && data.usd_thb_rate > 0 ? data.usd_thb_rate : null;
  $('#task-usage-tokens').textContent = formatCount(usage?.total_tokens);
  $('#task-usage-cost').textContent = typeof usage?.cost_usd === 'number' && thbRate !== null
    ? `฿${(usage.cost_usd * thbRate).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
    : 'ยังไม่มีข้อมูล';
  $('#task-usage-usd').textContent = typeof usage?.cost_usd === 'number' ? `USD ${usage.cost_usd.toFixed(6)}` : '';

  const labels = { conversation_ai: 'Conversation AI', prompt_architect_ai: 'Prompt Architect AI', html_media_builder_ai: 'HTML Media Builder AI' };
  const breakdown = $('#task-usage-breakdown');
  breakdown.replaceChildren();
  for (const item of usage?.by_service || []) {
    const row = document.createElement('div'); row.className = 'task-usage-service';
    const name = document.createElement('strong'); name.textContent = labels[item.service] || item.service;
    const tokens = document.createElement('small'); tokens.textContent = `โทเคน ${formatCount(item.total_tokens)} · ${formatCount(item.call_count)} ครั้ง`;
    const cost = document.createElement('strong');
    cost.textContent = typeof item.cost_usd === 'number' && thbRate !== null
      ? `฿${(item.cost_usd * thbRate).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
      : 'ค่าใช้จ่าย —';
    const usd = document.createElement('small'); usd.textContent = typeof item.cost_usd === 'number' ? `USD ${item.cost_usd.toFixed(6)}` : 'ไม่มีข้อมูลค่าใช้จ่ายจาก Provider';
    row.append(name, cost, tokens, usd); breakdown.append(row);
  }
  if (!usage?.call_count) {
    breakdown.textContent = 'ยังไม่มีการใช้งาน AI ที่บันทึกสำหรับงานนี้';
    $('#task-usage-note').textContent = data?.mode === 'mock'
      ? 'Mock mode ไม่ได้เรียก AI จริง จึงไม่มีโทเคนหรือค่าใช้จ่ายจาก Provider'
      : 'ยอดจะแสดงเมื่อ AI ตอบหรือมีการสร้างสื่อ พร้อมข้อมูลการใช้งานจาก Provider';
    return;
  }
  const notices = [];
  if (usage.usage_unavailable_calls) notices.push(`${usage.usage_unavailable_calls} ครั้งไม่มีข้อมูลโทเคน`);
  if (usage.cost_unavailable_calls) notices.push(`${usage.cost_unavailable_calls} ครั้งไม่มีข้อมูลค่าใช้จ่าย`);
  $('#task-usage-note').textContent = `รวมการเรียก AI ที่บันทึกในงานนี้${notices.length ? ` · ${notices.join(' · ')}` : ''} · คิดเงินบาทตามอัตรา ${thbRate ?? '—'} บาท/USD`;
}

async function refreshTaskUsage() {
  const panel = $('#task-usage-panel');
  const conversationId = state.conversation?.id;
  if (!taskUsageEnabled || !conversationId) { panel.hidden = true; return; }
  panel.hidden = false;
  $('#task-usage-mode').textContent = 'กำลังโหลด';
  try {
    const data = await api(`/api/local/v5/conversations/${encodeURIComponent(conversationId)}/usage`);
    if (state.conversation?.id === conversationId) renderTaskUsage(data);
  } catch (_) {
    if (state.conversation?.id === conversationId) {
      $('#task-usage-mode').textContent = 'ข้อมูลไม่พร้อม';
      $('#task-usage-note').textContent = 'โหลดข้อมูลการใช้โทเคนและค่าใช้จ่ายไม่สำเร็จ ลองเปิดงานนี้อีกครั้ง';
    }
  }
}

function renderBuildStatus(job, message = '') {
  state.job = job || state.job;
  const panel = $('#build-status');
  panel.hidden = !job && !message;
  if (panel.hidden) return;
  const status = state.busy && (!job || ['queued', 'architecting', 'building'].includes(job.state)) ? 'running' : job?.state || 'failed';
  panel.dataset.status = status === 'succeeded' ? 'passed' : status === 'running' ? 'running' : 'failed';
  const code = job?.error?.code;
  $('#build-status-text').textContent = message || (status === 'succeeded' ? 'ตรวจสอบสื่อผ่านแล้ว เปิดดูและทดลองใช้งานได้เลย' : friendlyJobFailure(code) || (code === 'prompt_architect_invalid_response' ? 'ระบบจัดรูปแบบข้อมูลไม่สำเร็จ งานและแนวทางเดิมยังอยู่ กรุณาลองอีกครั้ง' : status === 'retryable_failed' ? 'ระบบขัดข้องชั่วคราว งานและแนวทางเดิมยังอยู่ ลองสร้างอีกครั้งได้' : `สร้างสื่อไม่สำเร็จ${code ? ` (${code})` : ''}`));
  $('#retry-build').hidden = status !== 'retryable_failed' && !(status === 'failed' && ['prompt_architect_invalid_response', 'build_specification_invalid'].includes(job?.error?.code));
}

async function openPreviewInNewTab(jobId, statusElement = $('#library-status')) {
  const tab = window.open('about:blank', '_blank');
  if (!tab) { if (statusElement) statusElement.textContent = 'เบราว์เซอร์บล็อกหน้าต่างใหม่ กรุณาอนุญาตแล้วลองอีกครั้ง'; return; }
  tab.opener = null;
  try {
    const { preview_url } = await api(`/api/local/v5/jobs/${encodeURIComponent(jobId)}/preview`, { method:'POST', body:'{}' });
    tab.location.replace(preview_url);
  } catch (error) {
    tab.close();
    if (statusElement) statusElement.textContent = `เปิดสื่อไม่สำเร็จ (${error.code || 'preview_unavailable'})`;
  }
}

function renderPreview(job) {
  if (!job?.artifact_id || job.state !== 'succeeded') return;
  state.previewJob = job;
  $('#result-title').textContent = 'สื่อของคุณพร้อมให้ทดลองแล้ว';
  $('#result-summary').textContent = `Artifact ${job.artifact_id}`;
  const frame = $('#preview-frame');
  frame.removeAttribute('src'); frame.hidden = true;
  $('#runtime-link').hidden = true;
  $('#result-summary').textContent = 'กำลังเตรียมตัวอย่างที่ปลอดภัย…';
  $('#result-panel').hidden = false;
  void api(`/api/local/v5/jobs/${encodeURIComponent(job.id)}/preview`, { method:'POST', body:'{}' }).then(({ preview_url }) => {
    if (state.previewJob?.id !== job.id || typeof preview_url !== 'string') return;
    frame.src = preview_url; frame.hidden = false;
    $('#runtime-link').href = preview_url; $('#runtime-link').hidden = false;
    $('#result-summary').textContent = `Artifact ${job.artifact_id}`;
  }).catch(error => {
    if (state.previewJob?.id !== job.id) return;
    $('#result-summary').textContent = `เปิดตัวอย่างไม่สำเร็จ (${error.code || 'preview_unavailable'})`;
  });
}

async function refreshLibrary() {
  const list = $('#library-list');
  try {
    const { items } = await api('/api/local/v5/library');
    list.replaceChildren();
    if (!items.length) { list.textContent = 'ยังไม่มีสื่อที่บันทึกไว้'; return; }
    for (const item of items) {
      const row = document.createElement('div'); row.className = 'library-item';
      const info = document.createElement('div'); const title = document.createElement('strong'); title.textContent = item.title;
      const details = document.createElement('small'); details.textContent = `${item.parent_job_id ? 'ฉบับล่าสุด' : 'ฉบับแรก'} · ${new Date(item.created_at).toLocaleString('th-TH')}`;
      info.append(title, details);
      const actions = document.createElement('div'); actions.className = 'library-actions';
      const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'แก้ไข';
      edit.addEventListener('click', async () => {
        if (state.busy) return;
        try {
          const { job } = await api(`/api/local/v5/jobs/${encodeURIComponent(item.id)}`);
          let conversation = null;
          if (job.conversation_id) {
            ({ conversation } = await api(`/api/local/v5/conversations/${encodeURIComponent(job.conversation_id)}`));
          }
          state.job = job; localStorage.setItem(JOB_KEY, job.id);
          if (conversation) renderConversation(conversation);
          else {
            state.conversation = null;
            localStorage.removeItem(CONVERSATION_KEY);
            $('#chat-log').replaceChildren();
            $('#task-usage-panel').hidden = true;
            renderBrief(null);
          }
          $('.app-shell').dataset.view = 'session'; closeLibrary(); renderBuildStatus(job); renderPreview(job); $('#result-panel').scrollIntoView({ behavior: 'smooth' });
        }
        catch (_) { list.insertAdjacentText('afterbegin', 'เปิดงานเพื่อแก้ไขไม่สำเร็จ กรุณาลองใหม่ '); }
      });
      const openInNewTab = document.createElement('a');
      openInNewTab.className = 'library-open-tab';
      openInNewTab.href = '#';
      openInNewTab.target = '_blank'; openInNewTab.rel = 'noopener';
      openInNewTab.setAttribute('aria-label', `เปิดสื่อในแท็บใหม่: ${item.title}`);
      openInNewTab.addEventListener('click', event => {
        event.preventDefault();
        void openPreviewInNewTab(item.id);
      });
      const externalIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      externalIcon.setAttribute('viewBox', '0 0 24 24'); externalIcon.setAttribute('aria-hidden', 'true');
      const externalPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      externalPath.setAttribute('d', 'M14 3h7v7M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6');
      externalIcon.append(externalPath); openInNewTab.append(externalIcon, document.createTextNode('เปิดสื่อ'));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'library-delete-button'; remove.textContent = 'ลบ'; remove.setAttribute('aria-label', `ลบ: ${item.title}`);
      remove.addEventListener('click', async () => {
        const scopeNote = item.conversation_id
          ? 'ระบบจะลบบทสนทนาและสื่อทุกรุ่นของงานนี้ออกจากเครื่องอย่างถาวร และไม่สามารถกู้คืนได้'
          : 'ไม่พบข้อมูลเชื่อมโยงบทสนทนาของงานเดิม ระบบจะลบสื่อและฉบับแก้ไขที่เชื่อมโยงกันออกจากเครื่องอย่างถาวร';
        if (state.busy || !window.confirm(`ยืนยันที่จะลบงานหรือไม่\n\n${item.title}\n\n${scopeNote}`)) return;
        remove.disabled = true; remove.textContent = 'กำลังลบ…'; $('#library-status').textContent = '';
        try {
          const deleted = await api(`/api/local/v5/jobs/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
          const deletedJobIds = new Set(deleted.deleted_job_ids || [item.id]);
          if (state.previewJob && deletedJobIds.has(state.previewJob.id)) {
            state.previewJob = null; $('#preview-frame').removeAttribute('src'); $('#preview-frame').hidden = true; $('#runtime-link').hidden = true; $('#result-panel').hidden = true;
          }
          if (state.job && deletedJobIds.has(state.job.id)) {
            state.job = null; renderBuildStatus(null);
          }
          if (deleted.conversation_id && localStorage.getItem(CONVERSATION_KEY) === deleted.conversation_id) localStorage.removeItem(CONVERSATION_KEY);
          if (deletedJobIds.has(localStorage.getItem(JOB_KEY))) localStorage.removeItem(JOB_KEY);
          const activeTaskDeleted = Boolean(deleted.conversation_id && state.conversation?.id === deleted.conversation_id);
          if (activeTaskDeleted) {
            showHome(true);
          }
          await refreshLibrary();
          await refreshTaskUsage();
          $('#library-status').textContent = deleted.conversation_id
            ? 'ลบงานแล้ว ทั้งบทสนทนาและสื่อทุกฉบับถูกนำออกจากเครื่อง'
            : 'ลบสื่อและฉบับแก้ไขที่เชื่อมโยงแล้ว แต่ไม่พบข้อมูลเชื่อมโยงบทสนทนาของงานเดิม';
        } catch (error) {
          const message = error.code === 'artifact_in_use'
            ? 'ลบไม่ได้ เพราะมีฉบับแก้ไขที่ยังรอดำเนินการและต้องใช้สื่อนี้'
            : error.code === 'task_generation_in_progress'
              ? 'งานนี้กำลังประมวลผล กรุณารอให้เสร็จก่อนแล้วลองลบอีกครั้ง'
              : error.code === 'task_delete_in_progress'
                ? 'กำลังลบงานนี้อยู่ กรุณารอสักครู่'
            : `ลบสื่อไม่สำเร็จ (${error.code || 'local_request_failed'}) กรุณาลองอีกครั้ง`;
          $('#library-status').textContent = message; remove.disabled = false; remove.textContent = 'ลบ';
        }
      });
      actions.append(openInNewTab, edit, remove); row.append(info, actions); list.append(row);
    }
  } catch (_) { list.textContent = 'โหลดคลังสื่อไม่สำเร็จ'; }
}

function openLibrary() {
  if (state.busy) return;
  $('#library-status').textContent = '';
  $('#library-dialog').hidden = false;
  $('.app-shell').inert = true;
  $('#library-dialog .settings-dialog').focus();
  void refreshLibrary();
}

function closeLibrary() {
  $('#library-dialog').hidden = true;
  $('.app-shell').inert = false;
  $('#library-open').focus();
}

$('#revision-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (state.busy) { $('#revision-status').textContent = 'กำลังประมวลผล กรุณารอสักครู่'; return; }
  if (!state.previewJob || state.previewJob.state !== 'succeeded') { $('#revision-status').textContent = 'กรุณาเปิดสื่อที่สร้างสำเร็จจากสื่อของฉันก่อน'; return; }
  const input = $('#revision-instruction'); const instruction = input.value.trim();
  if (!instruction) return;
  const parent = state.previewJob;
  const classifyRevision = window.ClassKruRevisionIntent?.classifyRevisionIntent;
  if (typeof classifyRevision !== 'function') { $('#revision-status').textContent = 'ตรวจสอบขอบเขตการปรับปรุงไม่สำเร็จ กรุณารีโหลดหน้าเว็บแล้วลองใหม่'; return; }
  const intent = classifyRevision(instruction);
  let confirmedScope = false;
  if (intent.requires_confirmation) {
    const message = intent.clarification_required
      ? 'คำขอนี้ยังไม่ระบุขอบเขตชัดเจน ระบบจะใช้สื่อฉบับเดิมเป็นบริบทและคงเป้าหมาย เนื้อหา และกลไกจำลองหลักไว้ ต้องการดำเนินการต่อหรือไม่?'
      : 'คำขอนี้อาจเปลี่ยนวิธีเรียนรู้หรือกลไก/สาระของสื่อ ระบบจะปรับเฉพาะขอบเขตที่ระบุและรักษาส่วนอื่นไว้ ยืนยันให้ดำเนินการต่อหรือไม่?';
    if (!window.confirm(message)) return;
    confirmedScope = true;
  }
  $('#revision-status').textContent = 'กำลังสร้างฉบับแก้ไข อาจใช้เวลาสักครู่ โดยฉบับเดิมยังอยู่ในคลัง';
  setBusy(true, 'กำลังสร้างสื่อฉบับแก้ไขจากฉบับที่เลือก…');
  try {
    const queued = await api(`/api/local/v5/jobs/${encodeURIComponent(parent.id)}/revise`, { method: 'POST', body: JSON.stringify({ instruction, confirmed_scope:confirmedScope, idempotency_key: crypto.randomUUID() }) });
    state.job = queued.job; localStorage.setItem(JOB_KEY, queued.job.id);
    await api(`/api/local/v5/jobs/${encodeURIComponent(state.job.id)}/process`, { method:'POST', body:'{}' });
    renderBuildStatus(queued.job, 'กำลังสร้างฉบับแก้ไข ฉบับเดิมยังอยู่ในคลัง');
    const job = await waitForJob(queued.job.id, queued.job, current => {
      state.job = current;
      renderBuildStatus(current, isActiveJob(current) ? 'กำลังสร้างฉบับแก้ไข ฉบับเดิมยังอยู่ในคลัง' : '');
    });
    state.job = job; renderBuildStatus(job);
    if (job.state === 'succeeded') { renderPreview(job); input.value = ''; $('#revision-status').textContent = 'สร้างฉบับแก้ไขสำเร็จแล้ว'; await refreshLibrary(); }
    else { $('#revision-status').textContent = friendlyJobFailure(job.error?.code) || `สร้างฉบับแก้ไขไม่สำเร็จ${job.error?.code ? ` (${job.error.code})` : ''} ลองส่งคำขออีกครั้งได้ ฉบับเดิมยังอยู่ในคลัง`; }
    await refreshTaskUsage();
    setBusy(false, job.state === 'succeeded' ? 'ฉบับแก้ไขพร้อมทดลองแล้ว' : 'สร้างฉบับแก้ไขไม่สำเร็จ ฉบับเดิมยังอยู่ในคลัง');
  } catch (error) {
    const message = friendlyJobFailure(error.code);
    renderBuildStatus({ ...state.job, state: 'failed', error: { code: error.code } }, message);
    $('#revision-status').textContent = message || `สร้างฉบับแก้ไขไม่สำเร็จ (${error.code || 'local_request_failed'}) ลองอีกครั้งได้ ฉบับเดิมยังอยู่ในคลัง`;
    if (['revision_source_superseded', 'artifact_not_found'].includes(error.code)) await refreshLibrary();
    await refreshTaskUsage(); setBusy(false, message || 'สร้างฉบับแก้ไขไม่สำเร็จ ฉบับเดิมยังอยู่ในคลัง');
  }
});

function openBriefEditor() {
  const draft = state.conversation?.draft;
  if (!draft) return;
  $('#brief-topic').value = draft.topic || '';
  $('#brief-level').value = draft.learner_level || '';
  $('#brief-objectives').value = (draft.learning_objectives || []).join('\n');
  const typeRequirement = draft.media_type_requirement || (draft.media_type ? 'preferred' : 'open');
  $('#brief-media-type').value = typeRequirement === 'open' ? '' : draft.media_type || '';
  $('#brief-media-type-requirement').value = typeRequirement;
  $('#brief-interaction-preference').value = draft.interaction_preference || 'ai_decides';
  $('#brief-action').value = draft.learner_action || '';
  $('#brief-constraints').value = (draft.constraints || []).join('\n');
  $('#brief-error').hidden = true;
  $('#brief-dialog').hidden = false; $('.app-shell').inert = true; $('.settings-dialog').focus();
}

function closeBriefEditor() { $('#brief-dialog').hidden = true; $('.app-shell').inert = false; $('#review-brief').focus(); }

function updateContinueButton() {
  $('#continue-last').hidden = !localStorage.getItem(CONVERSATION_KEY) && !localStorage.getItem(JOB_KEY);
}

function showHome(newWork = false) {
  if (state.busy) return;
  if (!newWork && $('.app-shell').dataset.view === 'landing') { window.scrollTo(0, 0); return; }
  if (!newWork && (state.conversation || state.job)) savedDraft = $('#message-input').value;
  if (newWork) savedDraft = '';
  $('.composer-actions').prepend($('#think-button'));
  $('#think-button .think-label').textContent = 'AI ช่วยคิดไอเดียให้';
  $('#think-button').setAttribute('aria-label', 'ช่วยคิดไอเดียสำหรับงานใหม่');
  state.conversation = null; state.job = null; state.previewJob = null;
  $('#idea-discovery-notice').hidden = true; $('#idea-discovery-notice').textContent = '';
  pendingStart = null; $('#retry-conversation').hidden = true; renderDirections(null);
  $('#chat-log').replaceChildren(); $('.app-shell').dataset.view = 'landing'; renderBrief(null); renderBuildStatus(null);
  $('#result-panel').hidden = true; $('#preview-frame').removeAttribute('src'); $('#preview-frame').hidden = true; $('#runtime-link').hidden = true; $('#task-usage-panel').hidden = true;
  $('#message-input').value = ''; $('#revision-instruction').value = ''; $('#revision-status').textContent = '';
  updateContinueButton(); setBusy(false); window.scrollTo(0, 0);
  if (newWork) $('#message-input').focus();
}

async function continueLast() {
  if (state.busy) return;
  setBusy(true, 'กำลังเปิดงานล่าสุด…');
  try {
    const conversationId = localStorage.getItem(CONVERSATION_KEY);
    const jobId = localStorage.getItem(JOB_KEY);
    if (conversationId) {
      const { conversation } = await api(`/api/local/v5/conversations/${encodeURIComponent(conversationId)}`);
      renderConversation(conversation);
    }
    if (jobId) {
      let { job } = await api(`/api/local/v5/jobs/${encodeURIComponent(jobId)}`);
      if (job) {
        state.job = job; renderBuildStatus(job);
        if (isActiveJob(job)) {
          job = await waitForJob(job.id, job, current => { state.job = current; renderBuildStatus(current); });
          state.job = job; renderBuildStatus(job);
        }
        if (job.state === 'succeeded') renderPreview(job);
        else if (job.revision?.parent_job_id) {
          const { job: parent } = await api(`/api/local/v5/jobs/${encodeURIComponent(job.revision.parent_job_id)}`);
          renderPreview(parent);
          $('#revision-status').textContent = 'ฉบับแก้ไขล่าสุดยังไม่สำเร็จ สามารถส่งคำขอแก้ไขจากฉบับเดิมอีกครั้งได้';
        }
      }
    }
    await refreshTaskUsage();
    $('.app-shell').dataset.view = 'session';
    $('#message-input').value = savedDraft;
    setBusy(false);
  } catch (_) { setBusy(false, 'เปิดงานล่าสุดไม่สำเร็จ กรุณาลองใหม่'); }
}

async function startIdeaDiscovery() {
  if (state.busy || !serviceReady) return;
  pendingStart ||= { ideaDiscovery:true, mediaMode:selectedMediaMode(), startKey:crypto.randomUUID() };
  setBusy(true, 'กำลังเริ่มบทสนทนากับ Conversation AI…');
  try {
    const result = await api('/api/local/v5/idea-discovery', {
      method:'POST',
      body:JSON.stringify({ start_key:pendingStart.startKey, message:$('#message-input').value.trim(), media_mode:pendingStart.mediaMode })
    });
    state.conversation = result.conversation;
    localStorage.setItem(CONVERSATION_KEY, state.conversation.id);
    localStorage.removeItem(JOB_KEY);
    $('#message-input').value = '';
    pendingStart = null;
    $('#retry-conversation').hidden = true;
    renderConversation(state.conversation);
    const status = result.context_status === 'unavailable'
      ? 'เริ่มช่วยคิดแล้ว โดยไม่มีบริบทวิชาเนื่องจากดึงรายวิชาไม่สำเร็จ'
      : result.context_status === 'empty'
        ? 'เริ่มสนทนาเพื่อค้นหาไอเดียได้เลย'
        : '';
    $('#idea-discovery-notice').textContent = result.context_status === 'unavailable' ? status : '';
    $('#idea-discovery-notice').hidden = result.context_status !== 'unavailable';
    setBusy(false, status);
  } catch (error) {
    $('#retry-conversation').hidden = false;
    const notice = error.status === 401
      ? 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่ก่อนเริ่มสนทนา'
      : `เริ่มสนทนาไม่สำเร็จ (${error.code || 'local_request_failed'}) ลองอีกครั้งได้`;
    $('#idea-discovery-notice').textContent = notice;
    $('#idea-discovery-notice').hidden = false;
    setBusy(false, notice);
  }
}

async function sendConversation({ context = null, allowEmpty = false } = {}) {
  if (state.busy || !serviceReady) return;
  const input = $('#message-input'), message = input.value.trim(); if (!message && !allowEmpty) return;
  setBusy(true, 'AI กำลังตอบ รอคำตอบก่อนสร้างสื่อ…');
  let pendingNode, slowTimer, finalStatus = '';
  try {
    if (!state.conversation) { pendingStart ||= { context, mediaMode:selectedMediaMode(), startKey:crypto.randomUUID() }; const result = await api('/api/local/v5/conversations', { method: 'POST', body: JSON.stringify({card_context:pendingStart.context, start_key:pendingStart.startKey, media_mode:pendingStart.mediaMode}) }); state.conversation = result.conversation; localStorage.setItem(CONVERSATION_KEY, state.conversation.id); localStorage.removeItem(JOB_KEY); }
    $('.app-shell').dataset.view = 'session';
    renderDirections(state.conversation.card_context);
    clearSuggestedActions();
    if (message) addMessage('teacher', message); pendingNode = addMessage('assistant', 'AI กำลังคิดแนวทางให้คุณ…', { pending: true });
    slowTimer = setTimeout(() => {
      if (!pendingNode.isConnected) return;
      pendingNode.textContent = 'AI ยังตอบอยู่ กรุณารอสักครู่…';
      $('#status-text').textContent = 'AI ยังตอบอยู่ สร้างสื่อได้เมื่อคำตอบพร้อม';
    }, 10000);
    const result = await api(`/api/local/v5/conversations/${encodeURIComponent(state.conversation.id)}/messages`, { method: 'POST', body: JSON.stringify({ message, ...(pendingStart ? {request_key:pendingStart.startKey} : {}) }) });
    pendingNode.remove();
    let savedConversation = result.conversation;
    const hasSavedAssistantTurn = savedConversation?.id === state.conversation.id
      && Array.isArray(savedConversation.turns)
      && savedConversation.turns[savedConversation.turns.length - 1]?.role === 'assistant';
    if (!hasSavedAssistantTurn) {
      const persisted = await api(`/api/local/v5/conversations/${encodeURIComponent(state.conversation.id)}`);
      savedConversation = persisted.conversation;
    }
    if (savedConversation?.id !== state.conversation.id
      || !Array.isArray(savedConversation.turns)
      || savedConversation.turns[savedConversation.turns.length - 1]?.role !== 'assistant') {
      throw Object.assign(new Error('conversation_response_invalid'), { code: 'conversation_response_invalid' });
    }
    input.value = ''; pendingStart = null; $('#retry-conversation').hidden = true; $('#idea-discovery-notice').hidden = true;
    renderConversation(savedConversation);
  } catch (error) {
    pendingNode?.remove(); addMessage('assistant', `ส่งข้อความไม่สำเร็จ (${error.code || 'local_request_failed'})`);
    if (context || pendingStart || (state.conversation?.card_context && !state.conversation.turns?.length)) $('#retry-conversation').hidden = false;
    finalStatus = 'ส่งข้อความไม่สำเร็จ ลองส่งอีกครั้งได้';
  } finally {
    clearTimeout(slowTimer);
    setBusy(false, finalStatus); input.focus();
    void refreshTaskUsage();
  }
}
$('#chat-form').addEventListener('submit', event => { event.preventDefault(); void sendConversation(); });
$('#retry-conversation').addEventListener('click', () => pendingStart?.ideaDiscovery
  ? void startIdeaDiscovery()
  : void sendConversation({ context:pendingStart?.context || state.conversation?.card_context, allowEmpty:true }));

$('#message-input').addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  if (!state.busy) $('#chat-form').requestSubmit();
});

$('#brief-form').addEventListener('submit', async event => {
  event.preventDefault(); if (state.busy || !state.conversation || !serviceReady) return;
  const editedDraft = {
    topic: $('#brief-topic').value.trim(), learner_level: $('#brief-level').value.trim() || null,
    learning_objectives: $('#brief-objectives').value.split('\n').map(value => value.trim()).filter(Boolean),
    media_type: $('#brief-media-type-requirement').value === 'open' ? null : $('#brief-media-type').value,
    media_type_requirement: $('#brief-media-type-requirement').value,
    interaction_preference: $('#brief-interaction-preference').value,
    learner_action: $('#brief-action').value.trim() || null,
    constraints: $('#brief-constraints').value.split('\n').map(value => value.trim()).filter(Boolean), assumptions: state.conversation.draft.assumptions || []
  };
  if (!editedDraft.topic || !editedDraft.learning_objectives.length || (editedDraft.media_type_requirement !== 'open' && !editedDraft.media_type)) { $('#brief-error').textContent = 'กรุณาระบุหัวข้อและเป้าหมายการเรียนรู้ และเลือกรูปแบบสื่อเมื่อกำหนดให้เป็นรูปแบบที่ต้องการ'; $('#brief-error').hidden = false; return; }
  const parentJobId = state.previewJob?.state === 'succeeded' && state.previewJob.artifact_id ? state.previewJob.id : null;
  closeBriefEditor(); setBusy(true, parentJobId ? 'กำลังปรับปรุงสื่อเดิม…' : 'กำลังออกแบบข้อกำหนดและสร้างสื่อ…'); renderBuildStatus(null, parentJobId ? 'กำลังปรับสื่อเดิมตามแนวทางล่าสุด ฉบับเดิมจะยังอยู่จนกว่าฉบับใหม่จะผ่านการตรวจสอบ' : 'กำลังออกแบบรายละเอียดสื่อ ตรวจสอบ และเตรียมตัวอย่างให้ทดลอง');
  try {
    const queued = await api(`/api/local/v5/conversations/${encodeURIComponent(state.conversation.id)}/confirm`, { method: 'POST', body: JSON.stringify({ edited_draft: editedDraft, ...(parentJobId ? { parent_job_id: parentJobId } : {}), idempotency_key: crypto.randomUUID() }) });
    state.conversation = { ...state.conversation, draft: editedDraft, status: 'confirmed', confirmed_brief: queued.brief }; renderBrief(editedDraft);
    state.job = queued.job; localStorage.setItem(JOB_KEY, state.job.id);
    await api(`/api/local/v5/jobs/${encodeURIComponent(state.job.id)}/process`, { method:'POST', body:'{}' });
    const job = await waitForJob(state.job.id, state.job, current => { state.job = current; renderBuildStatus(current); });
    state.job = job; renderBuildStatus(job); if (job.state === 'succeeded') { renderPreview(job); await refreshLibrary(); }
    await refreshTaskUsage();
    setBusy(false, job.state === 'succeeded' ? (parentJobId ? 'ปรับปรุงสื่อเดิมสำเร็จแล้ว · สื่อฉบับล่าสุดพร้อมทดลอง' : 'สื่อพร้อมทดลองแล้ว · อยากปรับอะไร พิมพ์คุยต่อได้เลย') : (parentJobId ? 'ปรับปรุงไม่สำเร็จ สื่อฉบับเดิมยังอยู่ในคลัง' : 'ตรวจสรุปและปรับแนวทางได้ แล้วลองสร้างใหม่'));
    if (job.state === 'succeeded') $('#result-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    const message = friendlyJobFailure(error.code);
    renderBuildStatus({ state: 'failed', error: { code: error.code } }, message);
    if (['revision_source_superseded', 'artifact_not_found'].includes(error.code)) await refreshLibrary();
    await refreshTaskUsage(); setBusy(false, message || 'การสร้างไม่สำเร็จ แก้แนวทางหรือส่งคำขอใหม่ได้');
  }
});

async function retryBuild() {
  if (!serviceReady || !state.job?.id || state.busy) return;
  setBusy(true, 'กำลังลองสร้างงานเดิมอีกครั้ง…'); renderBuildStatus(null, 'กำลังลองใหม่ โดยใช้ Brief และ Specification ที่บันทึกไว้');
  try { const accepted = await api(`/api/local/v5/jobs/${encodeURIComponent(state.job.id)}/retry`, { method: 'POST', body: '{}' }); state.job = accepted.job || accepted; renderBuildStatus(state.job); const job = await waitForJob(state.job.id, state.job, current => { state.job = current; renderBuildStatus(current); }); state.job = job; renderBuildStatus(job); if (job.state === 'succeeded') { renderPreview(job); await refreshLibrary(); } await refreshTaskUsage(); setBusy(false); }
  catch (error) { renderBuildStatus({ ...state.job, state: 'retryable_failed', error: { code: error.code } }); await refreshTaskUsage(); setBusy(false); }
}

$('#review-brief').addEventListener('click', openBriefEditor);
$('#runtime-link').addEventListener('click', event => {
  event.preventDefault();
  if (state.previewJob?.id) void openPreviewInNewTab(state.previewJob.id, $('#result-summary'));
});
$('#library-open').addEventListener('click', openLibrary);
$('#library-close').addEventListener('click', closeLibrary);
$('#library-dialog').addEventListener('click', event => { if (event.target === $('#library-dialog')) closeLibrary(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#library-dialog').hidden) closeLibrary(); });
setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
loadMediaMode();
document.querySelectorAll('input[name="media-mode"]').forEach(input => input.addEventListener('change', () => { if (input.checked) setMediaMode(input.value, true); }));
$('#theme-toggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true));
$('#brief-close').addEventListener('click', closeBriefEditor); $('#brief-cancel').addEventListener('click', closeBriefEditor);
$('#brief-dialog').addEventListener('click', event => { if (event.target === $('#brief-dialog')) closeBriefEditor(); });
$('#brief-media-type').addEventListener('change', event => {
  const requirement = $('#brief-media-type-requirement');
  if (!event.target.value) requirement.value = 'open';
  else if (requirement.value === 'open') requirement.value = 'preferred';
});
$('#brief-media-type-requirement').addEventListener('change', event => {
  if (event.target.value === 'open') $('#brief-media-type').value = '';
});
$('#retry-build').addEventListener('click', () => void retryBuild());
$('#home-button').addEventListener('click', () => showHome());
$('#home-brand').addEventListener('click', event => { event.preventDefault(); showHome(); });
$('#new-conversation').addEventListener('click', () => showHome(true));
$('#continue-last').addEventListener('click', () => void continueLast());
$('#think-button').addEventListener('click', () => {
  const input = $('#message-input');
  const draft = input.value.trim();
  if ($('.app-shell').dataset.view === 'session') {
    const request = 'ช่วยคิดต่อจากบทสนทนานี้ โดยเสนอแนวทางหรือกิจกรรมเพิ่มเติมที่สอดคล้องกับหัวข้อและเป้าหมายที่คุยกัน พร้อมตัวเลือกสั้น ๆ ให้ฉันเลือก';
    input.value = draft ? `${draft}\n\n${request}` : request;
    $('#chat-form').requestSubmit();
    return;
  }
  void startIdeaDiscovery();
});
document.querySelectorAll('.idea-card, .idea-guide-card').forEach((button, index) => button.addEventListener('click', () => {
  const card = cardRegistry[index]; if (!card || state.busy) return;
  const key = card.group === 'learning_goal' ? 'learning_goal_id' : 'creative_approach_id';
  void sendConversation({context:{[key]:card.id, conversation_mode:'guided'},allowEmpty:true});
}));
for (const [selector,key] of [['#learning-goal-select','learning_goal_id'],['#creative-approach-select','creative_approach_id']]) {
  $(selector).addEventListener('change', async event => {
    if (!state.conversation || state.busy) return;
    const value = event.target.value || null;
    setBusy(true, 'กำลังเปลี่ยนแนวทาง…');
    let status = '';
    try { const result = await api(`/api/local/v5/conversations/${encodeURIComponent(state.conversation.id)}/card-context`, {method:'POST',body:JSON.stringify({card_context:{[key]:value}})}); state.conversation = result.conversation; renderDirections(state.conversation.card_context); }
    catch (_) { renderDirections(state.conversation.card_context); status = 'เปลี่ยนแนวทางไม่สำเร็จ กรุณาลองอีกครั้ง'; }
    finally { setBusy(false, status); }
  });
}

$('#message-input').addEventListener('input', updateMessageCount);
document.addEventListener('click', event => {
  if (event.target.closest('[data-seed], #think-button')) updateMessageCount();
});

async function initialize() {
  if (initialization) return initialization;
  initialization = (async () => {
    const { data:{ session } } = await getAuthClient().auth.getSession();
    if (!session?.access_token || !session.user?.id) {
      loadedUserId = null;
      setAccountStorageKeys(null);
      $('#app-shell').hidden = true;
      $('#auth-gate').hidden = false;
      $('#auth-message').textContent = 'กรุณาเข้าสู่ระบบ ClassKru ก่อนใช้ Mini Lab V5';
      $('#auth-status').textContent = 'เมื่อเข้าสู่ระบบแล้ว กลับมาหน้านี้และกดตรวจสอบอีกครั้ง';
      return;
    }
    if (loadedUserId === session.user.id) return;
    if (loadedUserId && loadedUserId !== session.user.id) clearAccountView();
    loadedUserId = session.user.id;
    setAccountStorageKeys(session.user.id);
    serviceReady = false;
    $('#send-button').disabled = true;
    $('#think-button').disabled = true;
    loadMediaMode();
    $('#auth-gate').hidden = true;
    $('#app-shell').hidden = false;
    $('#send-button').disabled = false;
    try {
      const status = await api('/api/local/v5/status');
      serviceReady = status.ready === true;
      $('#local-mode').textContent = `Mini Lab V5 · ${status.mode === 'live' ? 'Cloud' : 'Mock'}`;
      $('#local-mode').classList.add('local-mode');
      $('#send-button').disabled = !serviceReady;
      $('#think-button').disabled = !serviceReady;
      cardRegistry = (await api('/api/local/v5/cards')).cards;
      taskUsageEnabled = status.show_task_usage === true;
      await refreshLibrary();
      updateContinueButton();
      await refreshTaskUsage();
      if (status.ready !== true) {
        const missing = [];
        if (status.database_ready !== true) missing.push('ฐานข้อมูล V5');
        if (status.storage_ready !== true) missing.push('พื้นที่เก็บสื่อ');
        if (status.ai_configured !== true) missing.push('บริการ AI');
        $('#status-text').textContent = `Mini Lab V5 ยังเตรียมระบบไม่ครบ: ${missing.join(', ')} · กรุณาแจ้งผู้ดูแลระบบ`;
        $('#local-mode').textContent = 'Mini Lab V5 · ยังไม่พร้อม';
        $('#service-notice').textContent = $('#status-text').textContent;
        $('#service-notice').hidden = false;
        $('#send-button').disabled = true;
      } else {
        $('#service-notice').hidden = true;
      }
    } catch (error) {
      loadedUserId = null;
      serviceReady = false;
      $('#local-mode').textContent = 'Mini Lab V5 ยังไม่พร้อม';
      $('#status-text').textContent = `เชื่อมต่อบริการ Mini Lab V5 ไม่สำเร็จ (${error.code || 'service_unavailable'})`;
      $('#service-notice').textContent = $('#status-text').textContent;
      $('#service-notice').hidden = false;
      $('#send-button').disabled = true;
      $('#think-button').disabled = true;
    }
  })().catch(error => {
    $('#auth-gate').hidden = false;
    $('#app-shell').hidden = true;
    $('#auth-message').textContent = 'ตรวจสอบบัญชีไม่สำเร็จ';
    $('#auth-status').textContent = error.code || 'authentication_unavailable';
  }).finally(() => { initialization = null; });
  return initialization;
}
$('#auth-retry').addEventListener('click', () => { $('#auth-status').textContent = 'กำลังตรวจสอบบัญชี…'; void initialize(); });
try {
  getAuthClient().auth.onAuthStateChange((_event, session) => {
    if (!session) {
      clearAccountView();
      loadedUserId = null;
      setAccountStorageKeys(null);
      $('#app-shell').hidden = true;
      $('#auth-gate').hidden = false;
      $('#auth-message').textContent = 'เซสชัน ClassKru สิ้นสุดแล้ว กรุณาเข้าสู่ระบบอีกครั้ง';
    } else {
      setTimeout(() => { void initialize(); }, 0);
    }
  });
} catch (_) { /* initialize() shows the authentication error in the gate */ }
void initialize();


