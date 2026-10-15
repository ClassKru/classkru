'use strict';
const crypto = require('node:crypto');
const { authenticatedUser } = require('./supabase-user');
const storage = require('./media-db');
const { sendJson, requestOriginIsValid } = require('./http');
const { callOpenRouter } = require('./media-lab-v2-ai');
const { config: v2Config, estimateV2Complexity, classifyBuildError, retryDelay } = require('./media-lab-v2-policy');
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
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
function runtimeMonitorHtml(html) {
  const source = String(html);
  const monitor = '<script>(function(){var reported=false;function report(){if(reported)return;reported=true;try{parent.postMessage({type:"classkru-media-v2-runtime-error"},"*")}catch(_){}}window.addEventListener("error",report);window.addEventListener("unhandledrejection",report)})();</script>';
  const closingTags = [...source.matchAll(/<\/body\s*>/gi)];
  const closingTag = closingTags.at(-1);
  if (!closingTag) return source;
  const index = closingTag.index;
  return source.slice(0, index) + monitor + closingTag[0] + source.slice(index + closingTag[0].length);
}
function optionalDirections(content) {
  const directions = [];
  String(content || '').replace(/\[ทางเลือก\]([\s\S]{1,800}?)\[\/ทางเลือก\]/g, (_tag, value) => {
    const direction = String(value).replace(/\s+/g, ' ').trim();
    if (direction && !directions.includes(direction)) directions.push(direction);
    return '';
  });
  return directions.slice(0, 1);
}

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
  const prefixes = ['sessions', 'messages', 'runs', 'usage', 'builds'];
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
  const call = { id: uuid(), session_id: sessionId, created_at: now(), phase, backend: 'openrouter', provider: 'openrouter', model,
    input_tokens: providerUsage.prompt_tokens ?? providerUsage.input_tokens ?? null,
    output_tokens: providerUsage.completion_tokens ?? providerUsage.output_tokens ?? null,
    total_tokens: providerUsage.total_tokens ?? null,
    usage_source: providerUsage.total_tokens == null ? 'unavailable' : 'provider',
    finish_reason: result.finishReason || null,
    response_chars: Number.isFinite(result.responseChars) ? result.responseChars : null,
    build_id: result.buildId || null,
    response_status: Number.isFinite(result.responseStatus) ? result.responseStatus : null,
    duration_ms: Number.isFinite(result.durationMs) ? result.durationMs : null,
    output_size: Number.isFinite(result.responseChars) ? result.responseChars : null,
    error_category: result.errorCategory || null,
    retry_count: Number.isFinite(result.retryCount) ? result.retryCount : 0 };
  await storage.put(`${root}/usage/${recordName(sessionId, 'usage', call.id)}`, call);
}
async function writeBuildRecord(root, sessionId, record) {
  const saved = { ...record, session_id: sessionId, created_at: record.created_at || now(), updated_at: now() };
  await storage.put(`${root}/builds/${recordName(sessionId, 'build', saved.id)}`, saved);
  const meta = await sessionIndex(root, sessionId);
  if (meta) {
    const latest_build = {
      id: saved.id,
      status: saved.status,
      error_category: saved.error_category || null,
      run_id: saved.run_id || null,
      suggested_action: saved.suggested_action || null,
      duration_ms: saved.duration_ms,
      retry_count: saved.retry_count,
      created_at: saved.created_at
    };
    await writeSessionEvent(root, sessionId, { ...meta, latest_build, updated_at: now() });
  }
  return saved;
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
  return { id: sessionId, title: meta.title, goal_id: meta.goal_id || null, brief: meta.brief || null, latest_build: meta.latest_build || null, messages: orderedMessages, pending_start, usage, latest_run_id: latest[0]?.id || null, latest_run: latest[0] ? { id: latest[0].id, title: latest[0].title, summary: latest[0].summary, status: 'passed', artifact_mime: 'text/html', runtime_url: `/api/v2/runtime/${latest[0].id}` } : null };
}
async function addMessage(root, sessionId, role, content, kind = 'v2_chat', extra = {}) {
  const message = { id: uuid(), session_id: sessionId, role, kind, content: String(content).slice(0, 6000), ...extra, created_at: now() };
  await storage.put(`${root}/messages/${recordName(sessionId, 'message', message.id)}`, message);
  return message;
}
function requireComplete(result) {
  if (result.finishReason !== 'stop') throw Object.assign(new Error('ai_incomplete'), { code: 'ai_incomplete', status: 502 });
  if (!result.text) throw Object.assign(new Error('ai_invalid_response'), { code: 'ai_invalid_response', status: 502 });
}
function publicBuildMessage(category) {
  const messages = {
    complexity_exceeded: 'ก่อนส่งให้ AI สร้าง ระบบพบว่าแนวคิดกว้างเกินขอบเขตสื่อหน้าเดียว ลองลดจำนวนฉากหรือเลือก interaction หลักก่อน',
    timeout: 'การสร้างใช้เวลานานเกินกำหนด ระบบเก็บบทสนทนาและแนวทางที่เลือกไว้แล้ว ลองสร้างอีกครั้งได้',
    rate_limit: 'ขณะนี้ AI มีคำขอจำนวนมาก ระบบเก็บบทสนทนาและแนวทางที่เลือกไว้แล้ว ลองอีกครั้งภายหลัง',
    provider_error: 'เชื่อมต่อบริการ AI ไม่สำเร็จ ระบบเก็บบทสนทนาและแนวทางที่เลือกไว้แล้ว ลองอีกครั้งได้',
    output_truncated: 'ผลลัพธ์ถูกตัดก่อนจบ ระบบเก็บแนวทางเดิมไว้ ลองปรับให้เหลือหนึ่งหน้าจอและหนึ่ง interaction แล้วสร้างอีกครั้ง',
    invalid_response_schema: 'รูปแบบคำตอบจาก AI ไม่ครบตามสัญญา ระบบเก็บแนวทางเดิมไว้ ลองสร้างอีกครั้งได้',
    invalid_html: 'HTML ไม่ผ่านการตรวจสอบ ระบบเก็บแนวทางเดิมไว้และลองซ่อมหนึ่งครั้งแล้ว ลองปรับแนวทางให้เรียบง่ายขึ้น',
    javascript_error: 'JavaScript ในสื่อมี syntax ที่ Runtime ใช้ไม่ได้ ระบบลองซ่อมหนึ่งครั้งแล้ว แนวทางเดิมยังอยู่',
    runtime_error: 'Runtime ตรวจพบข้อผิดพลาดระหว่างทำงาน ระบบเก็บแนวทางเดิมไว้',
    unknown_error: 'การสร้างสื่อไม่สำเร็จ ระบบเก็บบทสนทนาและแนวทางที่เลือกไว้แล้ว'
  };
  return messages[category] || messages.unknown_error;
}
function suggestedBuildAction(category, complexity) {
  if (complexity?.suggestions?.length) return complexity.suggestions.join(' ');
  if (category === 'output_truncated') return 'ช่วยลดขอบเขตให้เหลือหนึ่งหน้าจอและหนึ่ง interaction หลัก';
  if (category === 'invalid_html' || category === 'javascript_error') return 'ช่วยทำสื่อนี้ให้เรียบง่ายลง โดยคงเป้าหมายการเรียนรู้และแนวทางที่เลือกไว้';
  return '';
}
function addBuildUsage(context, usage) {
  if (!usage) return;
  const input = Number(usage.prompt_tokens ?? usage.input_tokens);
  const output = Number(usage.completion_tokens ?? usage.output_tokens);
  if (Number.isFinite(input)) context.inputTokens = (context.inputTokens || 0) + input;
  if (Number.isFinite(output)) context.outputTokens = (context.outputTokens || 0) + output;
}
async function callBuildModel(root, sessionId, model, prompt, options, context) {
  while (true) {
    const remaining = v2Config.retryPolicy.maxBuildDurationMs - (Date.now() - context.startedAt);
    if (remaining < 1000) throw Object.assign(new Error('ai_timeout'), { code: 'ai_timeout', status: 504 });
    let recorded = false;
    try {
      const result = await callOpenRouter(model, prompt, {
        ...options,
        timeoutMs: Math.min(options.timeoutMs || v2Config.retryPolicy.requestTimeoutMs, remaining)
      });
      result.buildId = context.id;
      result.retryCount = context.retryCount;
      await recordUsage(root, sessionId, options.phase, model, result);
      recorded = true;
      context.responseStatus = result.responseStatus ?? null;
      context.finishReason = result.finishReason || null;
      context.outputSize = Number.isFinite(result.responseChars) ? result.responseChars : null;
      addBuildUsage(context, result.usage);
      if (result.finishReason !== 'stop') {
        const error = Object.assign(new Error('output_truncated'), { code: 'output_truncated', finishReason: result.finishReason, responseStatus: result.responseStatus, usageRecorded: true });
        throw error;
      }
      if (!result.text) throw Object.assign(new Error('invalid_response_schema'), { code: 'invalid_response_schema', responseStatus: result.responseStatus, usageRecorded: true });
      return result;
    } catch (error) {
      const category = classifyBuildError(error);
      if (!recorded && !error.usageRecorded) {
        await recordUsage(root, sessionId, options.phase, model, {
          buildId: context.id, responseStatus: error.responseStatus, durationMs: error.durationMs,
          errorCategory: category, retryCount: context.retryCount, responseChars: 0
        });
      }
      const remainingAfter = v2Config.retryPolicy.maxBuildDurationMs - (Date.now() - context.startedAt);
      const canRetry = v2Config.retryPolicy.retryableCategories.includes(category)
        && error.code !== 'ai_not_configured'
        && context.retryCount < v2Config.retryPolicy.maxRetries
        && remainingAfter > v2Config.retryPolicy.minRetryWindowMs;
      if (!canRetry) throw error;
      const delayMs = retryDelay(context.retryCount, v2Config.retryPolicy);
      if (remainingAfter <= delayMs + v2Config.retryPolicy.minRetryWindowMs) throw error;
      context.retryCount += 1;
      await wait(delayMs);
    }
  }
}
async function createBuildRecord(root, sessionId, context, fields) {
  const record = {
    id: context.id,
    build_id: context.id,
    provider: 'openrouter',
    model: context.model,
    input_tokens: context.inputTokens ?? null,
    output_tokens: context.outputTokens ?? null,
    response_status: context.responseStatus ?? null,
    finish_reason: context.finishReason ?? null,
    duration_ms: Date.now() - context.startedAt,
    output_size: context.outputSize ?? 0,
    validation_result: context.validationResult || null,
    retry_count: context.retryCount,
    repair_count: context.repairCount,
    complexity: context.complexity?.metrics || null,
    has_confirmed_brief: Boolean(context.brief?.selected_direction),
    ...fields
  };
  return writeBuildRecord(root, sessionId, record);
}
async function executeBuild(root, sessionId, current, model) {
  const promptModule = await prompts();
  const history = current.messages.filter(item => item.kind === 'v2_chat' || item.kind === 'v2_pending_start');
  if (!history.some(item => item.role === 'teacher')) {
    return { status: 400, body: { error: 'conversation_required' } };
  }
  const context = {
    id: uuid(), model, brief: current.brief || null, startedAt: Date.now(),
    retryCount: 0, repairCount: 0, inputTokens: null, outputTokens: null,
    responseStatus: null, finishReason: null, outputSize: 0,
    validationResult: null
  };
  const complexity = estimateV2Complexity(history, context.brief, v2Config.complexityBudget);
  context.complexity = complexity;
  if (!complexity.allowed) {
    const category = 'complexity_exceeded';
    const suggestion = complexity.suggestions.join(' ');
    await createBuildRecord(root, sessionId, context, {
      status: 'failed', error_category: category, suggested_action: suggestion,
      validation_result: null, retry_count: 0
    });
    return { status: 409, body: {
      error: category, error_category: category, build_id: context.id,
      message: publicBuildMessage(category), suggested_action: suggestion,
      complexity: { metrics: complexity.metrics, violations: complexity.violations }
    } };
  }
  try {
    let result;
    try {
      result = await callBuildModel(root, sessionId, model, promptModule.buildV2ArtifactPrompt('', history, context.brief), {
        maxTokens: v2Config.retryPolicy.builderMaxTokens, temperature: 0.25, jsonMode: true, phase: 'v2_build'
      }, context);
    } catch (error) {
      if (classifyBuildError(error) !== 'output_truncated' || context.retryCount >= v2Config.retryPolicy.maxRetries) throw error;
      context.retryCount += 1;
      result = await callBuildModel(root, sessionId, model, promptModule.buildV2ArtifactPrompt('', history, context.brief, { compact: true }), {
        maxTokens: v2Config.retryPolicy.builderMaxTokens, temperature: 0.2, jsonMode: true, phase: 'v2_build_compact'
      }, context);
    }
    let artifact;
    try { artifact = promptModule.parseV2Artifact(result.text); }
    catch { throw Object.assign(new Error('invalid_response_schema'), { code: 'invalid_response_schema' }); }
    let validation = promptModule.validateV2Html(artifact.html);
    context.validationResult = validation;
    if (!validation.ok && context.repairCount < v2Config.retryPolicy.maxRepairAttempts) {
      context.repairCount += 1;
      const repair = await callBuildModel(root, sessionId, model, promptModule.buildV2RepairPrompt(artifact, validation.errors), {
        maxTokens: v2Config.retryPolicy.repairMaxTokens, temperature: 0.15, jsonMode: true, phase: 'v2_repair'
      }, context);
      try { artifact = promptModule.parseV2Artifact(repair.text); }
      catch { throw Object.assign(new Error('invalid_response_schema'), { code: 'invalid_response_schema' }); }
      validation = promptModule.validateV2Html(artifact.html);
      context.validationResult = validation;
    }
    if (!validation.ok) {
      const category = classifyBuildError({}, validation);
      throw Object.assign(new Error(category), { code: category, validation });
    }
    const monitoredHtml = runtimeMonitorHtml(artifact.html);
    validation = promptModule.validateV2Html(monitoredHtml);
    context.validationResult = validation;
    if (!validation.ok) {
      const category = classifyBuildError({}, validation);
      throw Object.assign(new Error(category), { code: category, validation });
    }
    context.outputSize = monitoredHtml.length;
    const runId = uuid(), created_at = now();
    const run = { id: runId, session_id: sessionId, title: artifact.title || 'สื่อการเรียนรู้', summary: artifact.summary || '', html: monitoredHtml, status: 'passed', created_at };
    await storage.put(`mini-lab-v2/runtime/${runId}.json`, { html: monitoredHtml, created_at });
    try { await storage.put(`${root}/runs/${recordName(sessionId, 'run', runId)}`, run); }
    catch (error) { await storage.remove(`mini-lab-v2/runtime/${runId}.json`); throw error; }
    const meta = await sessionIndex(root, sessionId);
    await writeSessionEvent(root, sessionId, { ...meta, title: artifact.title || meta.title, updated_at: now() });
    await addMessage(root, sessionId, 'assistant', 'สร้างสื่อ HTML เสร็จแล้ว: ' + run.title, 'v2_build_completed');
    await createBuildRecord(root, sessionId, context, { status: 'passed', error_category: null, run_id: runId });
    return { status: 200, body: { run: { id: runId, title: run.title, summary: run.summary, status: 'passed', runtime_url: '/api/v2/runtime/' + runId }, artifact_url: '/api/v2/runtime/' + runId, build_id: context.id } };
  } catch (error) {
    const category = classifyBuildError(error, error.validation || context.validationResult);
    const suggested_action = suggestedBuildAction(category, complexity);
    await createBuildRecord(root, sessionId, context, {
      status: 'failed', error_category: category, suggested_action,
      validation_result: context.validationResult,
      response_status: context.responseStatus ?? error.responseStatus ?? null,
      finish_reason: context.finishReason ?? error.finishReason ?? null
    });
    const code = category === 'output_truncated' ? 'ai_output_incomplete'
      : category === 'invalid_response_schema' ? 'ai_output_unparseable'
      : category === 'invalid_html' || category === 'javascript_error' ? 'v2_output_invalid'
      : category;
    const status = category === 'rate_limit' ? 429
      : category === 'provider_error' || category === 'timeout' ? 502
      : 422;
    return { status, body: {
      error: code, error_category: category, build_id: context.id,
      message: publicBuildMessage(category), suggested_action,
      retry_count: context.retryCount, repair_count: context.repairCount,
      validation: context.validationResult ? { ok: context.validationResult.ok, errors: context.validationResult.errors, error_categories: context.validationResult.error_categories, warnings: context.validationResult.warnings } : null
    } };
  }
}
async function executeRuntimeRepair(root, sessionId, runId, model, brief) {
  const original = await storage.get(`${root}/runs/${recordName(sessionId, 'run', runId)}`);
  if (!original || original.session_id !== sessionId) return { status: 404, body: { error: 'run_not_found' } };
  const lockPath = `${root}/builds/${sessionId}_runtime_repair_${runId}.json`;
  const acquired = await storage.put(lockPath, { run_id: runId, status: 'attempted', created_at: now() });
  if (!acquired) return { status: 409, body: { error: 'runtime_repair_already_attempted', error_category: 'runtime_error', message: publicBuildMessage('runtime_error') } };
  const context = {
    id: uuid(), model, brief: brief || null, startedAt: Date.now(), retryCount: 0, repairCount: 1,
    inputTokens: null, outputTokens: null, responseStatus: null, finishReason: null,
    outputSize: 0, validationResult: null
  };
  try {
    const promptModule = await prompts();
    const artifact = { title: original.title, summary: original.summary, html: original.html };
    const repair = await callBuildModel(root, sessionId, model, promptModule.buildV2RepairPrompt(artifact, [
      'Runtime error: a JavaScript exception was detected in the isolated browser Runtime. Fix the runtime failure while preserving the learning goal and interaction. Do not add external resources or dependencies.'
    ]), { maxTokens: v2Config.retryPolicy.repairMaxTokens, temperature: 0.12, jsonMode: true, phase: 'v2_runtime_repair' }, context);
    let repaired;
    try { repaired = promptModule.parseV2Artifact(repair.text); }
    catch { throw Object.assign(new Error('invalid_response_schema'), { code: 'invalid_response_schema' }); }
    let validation = promptModule.validateV2Html(repaired.html);
    context.validationResult = validation;
    if (!validation.ok) {
      const category = classifyBuildError({}, validation);
      throw Object.assign(new Error(category), { code: category, validation });
    }
    const monitoredHtml = runtimeMonitorHtml(repaired.html);
    validation = promptModule.validateV2Html(monitoredHtml);
    context.validationResult = validation;
    if (!validation.ok) {
      const category = classifyBuildError({}, validation);
      throw Object.assign(new Error(category), { code: category, validation });
    }
    context.outputSize = monitoredHtml.length;
    const nextRunId = uuid(), created_at = now();
    const nextRun = { id: nextRunId, session_id: sessionId, title: repaired.title || original.title || 'สื่อการเรียนรู้', summary: repaired.summary || original.summary || '', html: monitoredHtml, status: 'passed', created_at, source_run_id: runId };
    await storage.put(`mini-lab-v2/runtime/${nextRunId}.json`, { html: monitoredHtml, created_at });
    try { await storage.put(`${root}/runs/${recordName(sessionId, 'run', nextRunId)}`, nextRun); }
    catch (error) { await storage.remove(`mini-lab-v2/runtime/${nextRunId}.json`); throw error; }
    const meta = await sessionIndex(root, sessionId);
    await writeSessionEvent(root, sessionId, { ...meta, title: nextRun.title, updated_at: now() });
    await addMessage(root, sessionId, 'assistant', 'ตรวจพบ Runtime error และสร้างเวอร์ชันที่ซ่อมแล้ว: ' + nextRun.title, 'v2_build_completed');
    await createBuildRecord(root, sessionId, context, { status: 'passed', error_category: null, trigger_category: 'runtime_error', source_run_id: runId, run_id: nextRunId });
    return { status: 200, body: { run: { id: nextRunId, title: nextRun.title, summary: nextRun.summary, status: 'passed', runtime_url: '/api/v2/runtime/' + nextRunId } } };
  } catch (error) {
    const category = classifyBuildError(error, error.validation || context.validationResult);
    const suggested_action = suggestedBuildAction(category, null);
    await createBuildRecord(root, sessionId, context, {
      status: 'failed', error_category: category, trigger_category: 'runtime_error',
      source_run_id: runId, suggested_action, validation_result: context.validationResult,
      response_status: context.responseStatus ?? error.responseStatus ?? null,
      finish_reason: context.finishReason ?? error.finishReason ?? null
    });
    return { status: category === 'rate_limit' ? 429 : category === 'provider_error' || category === 'timeout' ? 502 : 422, body: {
      error_category: category, error: category, message: publicBuildMessage(category), suggested_action
    } };
  }
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
    if (action === 'sessions' && isId(parts[1]) && parts.length === 3 && req.method === 'POST' && parts[2] === 'brief') {
      const current = await sessionData(root, parts[1], false);
      if (!current) return sendJson(res, 404, { error: 'session_not_found' });
      const messageId = String(input.message_id || '');
      const selected = current.messages.find(item => item.id === messageId && item.role === 'assistant' && item.kind === 'v2_chat');
      if (!selected) return sendJson(res, 400, { error: 'direction_not_selectable' });
      const requestedDirection = String(input.direction || '').replace(/\s+/g, ' ').trim();
      const direction = optionalDirections(selected.content).find(item => item === requestedDirection);
      if (!direction) return sendJson(res, 400, { error: 'direction_not_selectable' });
      const brief = { selected_direction: direction, source_message_id: selected.id, updated_at: now() };
      const meta = await sessionIndex(root, parts[1]);
      await writeSessionEvent(root, parts[1], { ...meta, brief, updated_at: now() });
      return sendJson(res, 200, { brief });
    }
    if (action === 'sessions' && isId(parts[1]) && parts.length === 3 && req.method === 'POST' && parts[2] === 'runtime-error') {
      if (!isId(input.run_id)) return sendJson(res, 400, { error: 'run_id_required' });
      const current = await sessionData(root, parts[1], false);
      if (!current) return sendJson(res, 404, { error: 'session_not_found' });
      const result = await executeRuntimeRepair(root, parts[1], input.run_id, selectedModel(input, user), current.brief);
      if (isDeveloper) result.body.usage = await usageData(root, parts[1]);
      return sendJson(res, result.status, result.body);
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
      const latestTeacherMessage = [...history].reverse().find(item => item.role === 'teacher' && String(item.content || '').trim());
      const topic = latestTeacherMessage?.content
        || (savedStart?.has_topic !== false ? message : '');
      const chatPrompt = current.goal_id
        ? promptModule.buildV2GoalChatPrompt('', current.goal_id, topic, history, current.brief)
        : promptModule.buildV2ChatPrompt('', history, current.brief);
      const answer = await callOpenRouter(model, chatPrompt, { maxTokens: v2Config.retryPolicy.conversationMaxTokens, temperature: 0.5, systemPrompt: promptModule.V2_CONVERSATION_SYSTEM_CONTEXT });
      await recordUsage(root, sessionId, 'v2_chat', model, answer);
      requireComplete(answer);
      const assistantMessage = await addMessage(root, sessionId, 'assistant', answer.text);
      const meta = await sessionIndex(root, sessionId);
      const title = meta.title === 'สื่อใหม่' && message ? message.replace(/\s+/g, ' ').slice(0, 80) : meta.title;
      await writeSessionEvent(root, sessionId, { ...meta, title, updated_at: now() });
      return sendJson(res, 200, { reply: answer.text, message_id: assistantMessage.id, ...(isDeveloper ? { usage: await usageData(root, sessionId) } : {}) });
    }
    if (action === 'sessions' && isId(parts[1]) && parts.length === 3 && req.method === 'POST' && parts[2] === 'build') {
      const sessionId = parts[1], current = await sessionData(root, sessionId, isDeveloper);
      if (!current) return sendJson(res, 404, { error: 'session_not_found' });
      const result = await executeBuild(root, sessionId, current, selectedModel(input, user));
      if (isDeveloper) result.body.usage = await usageData(root, sessionId);
      return sendJson(res, result.status, result.body);
    }
    return sendJson(res, 404, { error: 'not_found' });
  } catch (error) { return responseError(res, error); }
}
module.exports = handler;
