'use strict';
const crypto = require('node:crypto');
const { authenticatedUser } = require('./supabase-user');
const storage = require('./media-db');
const { sendJson, requestOriginIsValid } = require('./http');
const developers = new Set(['petch.0231@gmail.com', 'supakit.radiation@gmail.com', 'classkru.dev@gmail.com']);
const openRouterKey = () => process.env.OPENROUTER_MEDIA_PLANNER_API_KEY;
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const userRoot = id => `users/${id}/mini-lab-v2`;
const isId = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
let v2;
async function prompts() { return v2 ||= await import('./media-lab-v2.mjs'); }
function responseError(res, error) {
  const code = String(error.code || 'server_unavailable').toLowerCase();
  return sendJson(res, ['authentication_required', 'invalid_session'].includes(code) ? 401 : (error.status || 500), { error: code });
}
function recordName(sessionId, kind, id) { return `${sessionId}_${kind}_${id}.json`; }
async function writeSessionEvent(root, sessionId, event) {
  const id = `${Date.now()}_${uuid()}`;
  await storage.put(`${root}/sessions/${recordName(sessionId, 'index', id)}`, event);
}
async function sessionIndex(root, sessionId) {
  const [event] = await storage.documents(`${root}/sessions`, { limit: 1, search: `${sessionId}_index_`, column: 'created_at', order: 'desc' });
  return event || null;
}
async function listSessions(root) {
  const [rows, runRows] = await Promise.all([
    storage.list(`${root}/sessions`, { limit: 1000, column: 'name', order: 'desc' }),
    storage.list(`${root}/runs`, { limit: 1000, column: 'created_at', order: 'desc' })
  ]);
  const latest = new Map();
  for (const row of rows) {
    const name = String(row.name || '');
    const marker = name.indexOf('_index_');
    const sessionId = marker > 0 ? name.slice(0, marker) : '';
    if (!isId(sessionId)) continue;
    const timestamp = Number(name.slice(marker + 7).split('_')[0]);
    const current = latest.get(sessionId);
    if (!current || timestamp > current.timestamp) latest.set(sessionId, { name, timestamp });
  }
  const latestRuns = new Map();
  for (const row of runRows) {
    const name = String(row.name || '');
    const marker = name.indexOf('_run_');
    const sessionId = marker > 0 ? name.slice(0, marker) : '';
    if (!isId(sessionId) || latestRuns.has(sessionId)) continue;
    const runId = name.slice(marker + 5).replace(/\.json$/i, '');
    if (isId(runId)) latestRuns.set(sessionId, runId);
  }
  const items = await Promise.all([...latest.entries()].map(async ([id, row]) => ({ ...(await storage.get(`${root}/sessions/${row.name}`)), id, _timestamp: row.timestamp })));
  return items.filter(item => item.updated_at).sort((a, b) => b._timestamp - a._timestamp).slice(0, 100).map(item => ({
    ...item,
    latest_run: latestRuns.has(item.id) ? { id: latestRuns.get(item.id), title: item.title, status: 'passed', runtime_url: `/api/v2/runtime/${latestRuns.get(item.id)}` } : null
  }));
}
async function listSessionObjects(prefix, sessionId) {
  const output = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const page = await storage.list(prefix, { limit: 1000, offset, search: `${sessionId}_`, column: 'name', order: 'asc' });
    output.push(...page.filter(row => String(row.name || '').startsWith(`${sessionId}_`)));
    if (page.length < 1000) return output;
  }
  throw Object.assign(new Error('session_has_too_many_objects'), { code: 'delete_limit_exceeded', status: 413 });
}
async function deleteSession(root, sessionId) {
  if (!await sessionIndex(root, sessionId)) return false;
  const prefixes = ['sessions', 'messages', 'runs', 'usage'];
  const objects = await Promise.all(prefixes.map(name => listSessionObjects(`${root}/${name}`, sessionId)));
  const files = objects.flatMap((rows, index) => rows.map(row => `${root}/${prefixes[index]}/${row.name}`));
  const runRows = objects[2];
  const runtimeIds = runRows.map(row => {
    const name = String(row.name || ''), marker = name.indexOf('_run_');
    const id = marker < 0 ? '' : name.slice(marker + 5).replace(/\.json$/i, '');
    return isId(id) ? id : '';
  }).filter(Boolean);
  const deletions = [...files, ...runtimeIds.map(id => `mini-lab-v2/runtime/${id}.json`)];
  for (let index = 0; index < deletions.length; index += 8) await Promise.all(deletions.slice(index, index + 8).map(name => storage.remove(name)));
  return true;
}
async function usageData(root, sessionId) {
  const calls = await storage.documents(`${root}/usage`, { limit: 100, search: `${sessionId}_`, column: 'created_at', order: 'asc' });
  const byPhase = new Map();
  let totalTokens = 0, inputTokens = 0, outputTokens = 0, unavailable = 0;
  for (const call of calls) {
    totalTokens += Number(call.total_tokens || 0);
    inputTokens += Number(call.input_tokens || 0);
    outputTokens += Number(call.output_tokens || 0);
    if (call.total_tokens == null) unavailable++;
    const phase = byPhase.get(call.phase) || { phase: call.phase, call_count: 0, total_tokens: 0, input_tokens: 0, output_tokens: 0 };
    phase.call_count++;
    phase.total_tokens += Number(call.total_tokens || 0);
    phase.input_tokens += Number(call.input_tokens || 0);
    phase.output_tokens += Number(call.output_tokens || 0);
    byPhase.set(call.phase, phase);
  }
  return { call_count: calls.length, total_tokens: totalTokens, input_tokens: inputTokens, output_tokens: outputTokens, unavailable_calls: unavailable, by_phase: [...byPhase.values()], calls };
}
async function recordUsage(root, sessionId, phase, model, result) {
  const providerUsage = result.usage || {};
  const call = { id: uuid(), session_id: sessionId, created_at: now(), phase, backend: 'openrouter', model,
    input_tokens: providerUsage.prompt_tokens ?? providerUsage.input_tokens ?? null,
    output_tokens: providerUsage.completion_tokens ?? providerUsage.output_tokens ?? null,
    total_tokens: providerUsage.total_tokens ?? null,
    usage_source: providerUsage.total_tokens == null ? 'unavailable' : 'provider' };
  await storage.put(`${root}/usage/${recordName(sessionId, 'usage', call.id)}`, call);
}
async function sessionData(root, sessionId, includeUsage = false) {
  const meta = await sessionIndex(root, sessionId);
  if (!meta) return null;
  const [messages, latest, usage] = await Promise.all([
    storage.documents(`${root}/messages`, { limit: 500, search: `${sessionId}_`, column: 'name', order: 'asc' }),
    storage.documents(`${root}/runs`, { limit: 1, search: `${sessionId}_`, column: 'created_at', order: 'desc' }),
    includeUsage ? usageData(root, sessionId) : Promise.resolve(null)
  ]);
  const orderedMessages = messages.filter(item => item.session_id === sessionId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const waitingStartIndex = orderedMessages.findIndex(item => item.kind === 'v2_pending_start');
  const waitingStart = waitingStartIndex < 0 ? null : orderedMessages[waitingStartIndex];
  const startHasReply = waitingStart && orderedMessages.slice(waitingStartIndex + 1).some(item => item.kind === 'v2_chat' && item.role === 'assistant');
  const pending_start = waitingStart && !startHasReply ? { id: waitingStart.id, content: waitingStart.content, goal_id: waitingStart.goal_id || meta.goal_id || null, has_topic: waitingStart.has_topic !== false } : null;
  return { id: sessionId, title: meta.title, goal_id: meta.goal_id || null, messages: orderedMessages, pending_start, usage, latest_run_id: latest[0]?.id || null, latest_run: latest[0] ? { id: latest[0].id, title: latest[0].title, summary: latest[0].summary, status: 'passed', artifact_mime: 'text/html', runtime_url: `/api/v2/runtime/${latest[0].id}` } : null };
}
async function addMessage(root, sessionId, role, content, kind = 'v2_chat', extra = {}) {
  const message = { id: uuid(), session_id: sessionId, role, kind, content: String(content).slice(0, 6000), ...extra, created_at: now() };
  await storage.put(`${root}/messages/${recordName(sessionId, 'message', message.id)}`, message);
  return message;
}
async function callOpenRouter(model, prompt, { maxTokens, temperature, jsonMode = false, timeoutMs = jsonMode ? 220000 : 90000 }) {
  const key = openRouterKey();
  if (!key) { const error = new Error('ai_not_configured'); error.status = 503; error.code = 'ai_not_configured'; throw error; }
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://classkru-kohl.vercel.app', 'X-Title': 'ClassKru Mini Lab V2' },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature, max_tokens: maxTokens, ...(jsonMode ? { response_format: { type: 'json_object' } } : {}) })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(payload.error?.message || 'ai_request_failed'); error.code = response.status === 429 ? 'ai_busy' : 'ai_request_failed'; error.status = 502; throw error; }
  const text = payload.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) { const error = new Error('ai_invalid_response'); error.code = 'ai_invalid_response'; error.status = 502; throw error; }
  return { text: text.trim(), usage: payload.usage || null };
}
function selectedModel(input, user) {
  const isDeveloper = developers.has(String(user.email || '').trim().toLowerCase());
  const configured = String(process.env.OPENROUTER_MODEL || process.env.OPENROUTER_MEDIA_PLANNER_MODEL || 'openrouter/free');
  return isDeveloper && typeof input.model === 'string' && input.model.trim() ? input.model.trim().slice(0, 160) : configured;
}
async function handler(req, res) {
  const pathValue = req.query.path;
  const parts = Array.isArray(pathValue) ? pathValue : String(pathValue || '').split('/').filter(Boolean);
  if (req.method === 'GET' && parts[0] === 'runtime' && isId(parts[1])) {
    try {
      if (!storage.configured()) throw Object.assign(new Error(), { code: 'storage_not_configured', status: 503 });
      const artifact = await storage.get(`mini-lab-v2/runtime/${parts[1]}.json`);
      if (!artifact?.html) return sendJson(res, 404, { error: 'not_found' });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts");
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.status(200).send(artifact.html);
    } catch (error) { return responseError(res, error); }
  }
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) return sendJson(res, 405, { error: 'method_not_allowed' });
  if (!requestOriginIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });
  try {
    const user = await authenticatedUser(req);
    if (!user.id || !isId(user.id)) return sendJson(res, 401, { error: 'invalid_session' });
    if (!storage.configured()) throw Object.assign(new Error(), { code: 'storage_not_configured', status: 503 });
    const root = userRoot(user.id);
    const action = parts[0] || '';
    const input = req.body && typeof req.body === 'object' ? req.body : {};
    const isDeveloper = developers.has(String(user.email || '').trim().toLowerCase());
    if (action === 'config' && req.method === 'GET') return sendJson(res, 200, { configured: Boolean(openRouterKey()), deployment: true, developer: isDeveloper, defaultBuilderModel: process.env.OPENROUTER_MODEL || process.env.OPENROUTER_MEDIA_PLANNER_MODEL || 'openrouter/free', backends: ['openrouter'] });
    if (action === 'models' && req.method === 'GET') {
      if (!isDeveloper) return sendJson(res, 403, { error: 'developer_access_required' });
      const response = await fetch('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${openRouterKey() || ''}` }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Object.assign(new Error('model_list_unavailable'), { code: 'model_list_unavailable', status: 502 });
      const data = await response.json();
      return sendJson(res, 200, { models: (data.data || []).map(item => ({ id: item.id, name: item.name || item.id, free: /:free$/.test(item.id) })) });
    }
    if (action === 'sessions' && req.method === 'POST' && parts.length === 1) {
      await storage.ensureBucket();
      const id = uuid(), timestamp = now();
      const initialMessage = String(input.initial_message || '').trim().slice(0, 6000);
      const goalId = String(input.goal_id || '').trim();
      const goals = goalId ? (await prompts()).V2_TEACHING_GOALS : null;
      const goal = goalId && goals && Object.hasOwn(goals, goalId) ? goals[goalId] : null;
      if (goalId && !goal) return sendJson(res, 400, { error: 'invalid_teaching_goal' });
      await writeSessionEvent(root, id, { id, title: 'สื่อใหม่', created_at: timestamp, updated_at: timestamp, ...(goal ? { goal_id: goalId } : {}) });
      if (goal) await addMessage(root, id, 'teacher', initialMessage || `เริ่มจากเป้าหมายการสอน: ${goal.label}`, 'v2_pending_start', { goal_id: goalId, has_topic: Boolean(initialMessage) });
      else if (initialMessage) await addMessage(root, id, 'teacher', initialMessage, 'v2_pending_start', { has_topic: true });
      else await addMessage(root, id, 'assistant', 'เริ่มจากเล่าไอเดีย หรือเลือกการ์ดจุดประกายด้านบนได้เลย', 'v2_welcome');
      return sendJson(res, 201, { session: { id, title: 'สื่อใหม่' } });
    }
    if (action === 'sessions' && req.method === 'GET' && parts.length === 1) {
      const sessions = await listSessions(root);
      const result = sessions.map(meta => ({ id: meta.id, title: meta.title, updated_at: meta.updated_at, latest_run: meta.latest_run }));
      return sendJson(res, 200, { sessions: result });
    }
    if (action === 'sessions' && isId(parts[1]) && parts.length === 2 && req.method === 'GET') {
      const session = await sessionData(root, parts[1], isDeveloper);
      return session ? sendJson(res, 200, { session }) : sendJson(res, 404, { error: 'session_not_found' });
    }
    if (action === 'sessions' && isId(parts[1]) && parts.length === 2 && req.method === 'DELETE') {
      const deleted = await deleteSession(root, parts[1]);
      return deleted ? sendJson(res, 200, { deleted: true }) : sendJson(res, 404, { error: 'session_not_found' });
    }
    if (action === 'sessions' && isId(parts[1]) && parts.length === 3 && req.method === 'POST' && parts[2] === 'chat') {
      const sessionId = parts[1], current = await sessionData(root, sessionId, isDeveloper);
      if (!current) return sendJson(res, 404, { error: 'session_not_found' });
      const pendingStartId = String(input.pending_start_id || '');
      const savedStart = isId(pendingStartId) ? current.messages.find(item => item.id === pendingStartId && item.kind === 'v2_pending_start') : null;
      const message = savedStart ? (savedStart.has_topic === false ? '' : savedStart.content) : String(input.message || '').trim().slice(0, 6000);
      if (!message && !savedStart?.goal_id) return sendJson(res, 400, { error: 'message_required' });
      const history = [...current.messages, ...(savedStart ? [] : [{ role: 'teacher', kind: 'v2_chat', content: message }])]
        .filter(item => item.kind === 'v2_chat' || (item.kind === 'v2_pending_start' && item.has_topic !== false))
        .slice(-16);
      if (!savedStart) await addMessage(root, sessionId, 'teacher', message);
      const model = selectedModel(input, user), promptModule = await prompts();
      const topic = current.messages.find(item => item.kind === 'v2_pending_start' && item.has_topic !== false)?.content
        || current.messages.find(item => item.kind === 'v2_chat' && item.role === 'teacher')?.content
        || (savedStart?.has_topic !== false ? message : '');
      const chatPrompt = current.goal_id
        ? promptModule.buildV2GoalChatPrompt('', current.goal_id, topic, history)
        : promptModule.buildV2ChatPrompt('', history);
      const answer = await callOpenRouter(model, chatPrompt, { maxTokens: 900, temperature: 0.5 });
      await recordUsage(root, sessionId, 'v2_chat', model, answer);
      await addMessage(root, sessionId, 'assistant', answer.text);
      const meta = await sessionIndex(root, sessionId);
      const title = meta.title === 'สื่อใหม่' && message ? message.replace(/\s+/g, ' ').slice(0, 80) : meta.title;
      await writeSessionEvent(root, sessionId, { ...meta, title, updated_at: now() });
      return sendJson(res, 200, { reply: answer.text, ...(isDeveloper ? { usage: await usageData(root, sessionId) } : {}) });
    }
    if (action === 'sessions' && isId(parts[1]) && parts.length === 3 && req.method === 'POST' && parts[2] === 'build') {
      const buildStarted = Date.now();
      const sessionId = parts[1], current = await sessionData(root, sessionId, isDeveloper);
      if (!current) return sendJson(res, 404, { error: 'session_not_found' });
      const history = current.messages.filter(item => item.kind === 'v2_chat' || item.kind === 'v2_pending_start');
      if (!history.some(item => item.role === 'teacher')) return sendJson(res, 400, { error: 'conversation_required' });
      const promptModule = await prompts(), model = selectedModel(input, user);
      const result = await callOpenRouter(model, promptModule.buildV2ArtifactPrompt('', history), { maxTokens: 8000, temperature: 0.25, jsonMode: true });
      await recordUsage(root, sessionId, 'v2_build', model, result);
      let artifact;
      try { artifact = promptModule.parseV2Artifact(result.text); }
      catch (_) { return sendJson(res, 422, { error: 'ai_output_unparseable', message: 'AI ส่งผลลัพธ์ที่แปลงเป็นสื่อไม่ได้ กรุณากดสร้างอีกครั้ง' }); }
      let validation = promptModule.validateV2Html(artifact.html);
      let attemptedRepair = false;
      if (!validation.ok) {
        console.warn('v2_build_validation_failed', validation.errors);
        const repairTimeout = Math.min(150000, 275000 - (Date.now() - buildStarted));
        if (repairTimeout >= 30000) {
          attemptedRepair = true;
          try {
            const repair = await callOpenRouter(model, promptModule.buildV2RepairPrompt(artifact, validation.errors), { maxTokens: 8000, temperature: 0.15, jsonMode: true, timeoutMs: repairTimeout });
            await recordUsage(root, sessionId, 'v2_repair', model, repair);
            const repairedArtifact = promptModule.parseV2Artifact(repair.text);
            const repairedValidation = promptModule.validateV2Html(repairedArtifact.html);
            if (repairedValidation.ok) { artifact = repairedArtifact; validation = repairedValidation; }
            else { validation = repairedValidation; console.warn('v2_build_repair_validation_failed', validation.errors); }
          } catch (error) { console.warn('v2_build_repair_failed', error.code || error.name || 'unknown_error'); }
        }
      }
      if (!validation.ok) return sendJson(res, 422, { error: 'v2_output_invalid', message: attemptedRepair ? 'AI สร้างสื่อไม่ผ่านการตรวจสอบหลังลองปรับอัตโนมัติ กรุณากดสร้างอีกครั้ง' : 'AI สร้างสื่อไม่ผ่านการตรวจสอบ กรุณากดสร้างอีกครั้ง', details: validation.errors });
      const id = uuid(), created_at = now();
      const run = { id, session_id: sessionId, title: artifact.title || 'สื่อการเรียนรู้', summary: artifact.summary || '', html: artifact.html, status: 'passed', created_at };
      await storage.put(`${root}/runs/${recordName(sessionId, 'run', id)}`, run);
      await storage.put(`mini-lab-v2/runtime/${id}.json`, { html: artifact.html, created_at });
      const meta = await sessionIndex(root, sessionId);
      await writeSessionEvent(root, sessionId, { ...meta, title: artifact.title || meta.title, updated_at: now() });
      await addMessage(root, sessionId, 'assistant', `สร้างสื่อ HTML เสร็จแล้ว: ${run.title}`, 'v2_build_completed');
      return sendJson(res, 200, { run: { id, title: run.title, summary: run.summary, status: 'passed', runtime_url: `/api/v2/runtime/${id}` }, artifact_url: `/api/v2/runtime/${id}`, ...(isDeveloper ? { usage: await usageData(root, sessionId) } : {}) });
    }
    return sendJson(res, 404, { error: 'not_found' });
  } catch (error) { return responseError(res, error); }
}
module.exports = handler;
