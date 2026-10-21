'use strict';

const crypto = require('node:crypto');
const { resolveContext } = require('../conversation-ai/card-registry');
const { normalizeMediaMode } = require('../conversation-ai/media-mode');
const { normalizeSubjects } = require('../teacher-context/idea-discovery-context');
const { classifyRevisionIntent } = require('../../revision-intent');

const CONTRACT_VERSION = '1.1';
const RETRYABLE = new Set(['conversation_ai_timeout', 'conversation_ai_rate_limited', 'conversation_ai_provider_unavailable', 'prompt_architect_timeout', 'prompt_architect_rate_limited', 'prompt_architect_provider_unavailable', 'prompt_architect_invalid_response', 'build_specification_invalid', 'html_builder_timeout', 'html_builder_rate_limited', 'html_builder_provider_unavailable']);
function codedError(code) { return Object.assign(new Error(code), { code }); }

function collectTaskJobs(selected, allJobs) {
  const jobs = new Map([[selected.id, selected]]);
  let conversationId = selected.conversation_id || null;
  let changed = true;
  while (changed) {
    changed = false;
    if (!conversationId) {
      const linkedConversation = [...jobs.values()].find(job => job.conversation_id)?.conversation_id;
      if (linkedConversation) { conversationId = linkedConversation; changed = true; }
    }
    for (const candidate of allJobs) {
      if (jobs.has(candidate.id)) continue;
      const sameConversation = conversationId && candidate.conversation_id === conversationId;
      const linkedRevision = [...jobs.values()].some(job =>
        candidate.revision?.parent_job_id === job.id ||
        job.revision?.parent_job_id === candidate.id ||
        (candidate.revision?.parent_artifact_id && candidate.revision.parent_artifact_id === job.artifact_id) ||
        (job.revision?.parent_artifact_id && job.revision.parent_artifact_id === candidate.artifact_id)
      );
      if (sameConversation || linkedRevision) {
        jobs.set(candidate.id, candidate);
        if (!conversationId && candidate.conversation_id) conversationId = candidate.conversation_id;
        changed = true;
      }
    }
  }
  return { conversationId, jobs };
}

function rootJobId(job, jobsById) {
  let current = job;
  const visited = new Set([job.id]);
  while (current.revision?.parent_job_id) {
    const parent = jobsById.get(current.revision.parent_job_id);
    if (!parent || visited.has(parent.id)) break;
    current = parent;
    visited.add(parent.id);
  }
  return current.id;
}

function libraryTaskId(job, jobsById) {
  const rootId = rootJobId(job, jobsById);
  const root = jobsById.get(rootId);
  return root?.conversation_id ? `conversation:${root.conversation_id}` : `job:${rootId}`;
}

function briefRevisionInstruction(brief) {
  const intent = { learning: brief.learning, media_intent: brief.media_intent, constraints: brief.constraints };
  return `ปรับปรุงสื่อเดิมตาม Confirmed Brief ฉบับล่าสุดและ Structured Build Specification ที่ระบบสร้างใหม่ ให้ Specification ล่าสุดเป็นข้อกำหนดหลัก และคงส่วนเดิมไว้เฉพาะส่วนที่ยังสอดคล้องกับข้อกำหนดเหล่านั้น\n${JSON.stringify(intent)}`;
}

function isRevisionDescendant(candidate, ancestorId, jobsById) {
  let current = candidate;
  const visited = new Set();
  while (current?.revision?.parent_job_id && !visited.has(current.id)) {
    visited.add(current.id);
    const parentId = current.revision.parent_job_id;
    if (parentId === ancestorId) return true;
    current = jobsById.get(parentId);
  }
  return false;
}

function createInteractiveWorkflow({ conversationClient, architectClient, builderClient, runtimeClient, store, usageMode = 'live', idFactory = crypto.randomUUID } = {}) {
  if (!conversationClient?.createConversation || !conversationClient?.reply || !conversationClient?.confirm) throw new TypeError('conversation_contract_client_required');
  if (!architectClient?.createSpecification) throw new TypeError('architect_contract_client_required');
  if (!builderClient?.build) throw new TypeError('builder_contract_client_required');
  if (!runtimeClient?.loadPreview) throw new TypeError('runtime_contract_client_required');
  if (!store?.saveConversation || !store?.createJob || !store?.claim) throw new TypeError('workflow_store_required');
  const deletingJobs = new Set();
  const deletingConversations = new Set();
  const activeConversations = new Set();
  const activeIdeaDiscoveryStarts = new Map();

  function startConversation(context, startKey, mediaMode = 'normal') {
    if (startKey && (typeof startKey !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(startKey))) throw codedError('start_key_invalid');
    const previous = startKey && store.listConversations?.().find(item => item.start_key === startKey);
    if (previous) return previous;
    const cardContext = context ? resolveContext(context) : null;
    const conversation = { ...conversationClient.createConversation(), media_mode:normalizeMediaMode(mediaMode), ...(cardContext ? { card_context:cardContext } : {}), ...(startKey ? { start_key:startKey } : {}) };
    store.saveConversation(conversation); store.addConversationEvent(conversation.id, 'conversation.started', { contract_version: CONTRACT_VERSION });
    return conversation;
  }
  function startIdeaDiscovery({ subjects = [], subjectStatus = 'empty', startKey, teacherMessage = '', mediaMode = 'normal' } = {}) {
    if (!['available', 'empty', 'unavailable'].includes(subjectStatus)) throw codedError('teacher_subjects_status_invalid');
    if (!startKey || typeof startKey !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(startKey)) throw codedError('start_key_invalid');
    if (activeIdeaDiscoveryStarts.has(startKey)) return activeIdeaDiscoveryStarts.get(startKey);
    const operation = (async () => {
      let conversation = startConversation({ conversation_mode:'idea_discovery' }, startKey, mediaMode);
      if (conversation.last_request_key === startKey) {
        const lastTurn = conversation.turns.at(-1);
        return { conversation, reply:lastTurn?.content || '', suggested_actions:lastTurn?.suggested_actions || [], draft:conversation.draft, usage:null, context_status:conversation.idea_discovery_status || subjectStatus };
      }
      if (!conversation.turns.length && !conversation.idea_discovery_context) {
        const normalizedSubjects = normalizeSubjects(subjects);
        const status = normalizedSubjects.length ? 'available' : subjectStatus === 'unavailable' ? 'unavailable' : 'empty';
        conversation = { ...conversation, idea_discovery_context:{ subjects:normalizedSubjects }, idea_discovery_status:status };
        store.saveConversation(conversation);
      }
      if (conversation.turns.length) {
        const lastTurn = conversation.turns.at(-1);
        return { conversation, reply:lastTurn?.content || '', suggested_actions:lastTurn?.suggested_actions || [], draft:conversation.draft, usage:null, context_status:conversation.idea_discovery_status || subjectStatus };
      }
      const result = await sendTeacherMessage({ conversationId:conversation.id, message:teacherMessage, requestKey:startKey });
      return { ...result, context_status:result.conversation.idea_discovery_status || subjectStatus };
    })();
    activeIdeaDiscoveryStarts.set(startKey, operation);
    operation.finally(() => activeIdeaDiscoveryStarts.delete(startKey)).catch(() => {});
    return operation;
  }
  function updateCardContext({ conversationId, context }) {
    if (deletingConversations.has(conversationId)) throw codedError('task_delete_in_progress');
    if (activeConversations.has(conversationId)) throw codedError('conversation_request_in_progress');
    const existing = store.getConversation(conversationId); if (!existing) throw codedError('conversation_not_found');
    const cardContext = resolveContext({ ...existing.card_context, ...context });
    const conversation = { ...existing, card_context:cardContext, updated_at:new Date().toISOString() };
    store.saveConversation(conversation);
    store.addConversationEvent(conversationId, 'conversation.card_changed', { card_context:cardContext });
    return conversation;
  }
  async function sendTeacherMessage({ conversationId, message, requestKey }) {
    if (requestKey && (typeof requestKey !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(requestKey))) throw codedError('request_key_invalid');
    if (deletingConversations.has(conversationId)) throw codedError('task_delete_in_progress');
    if (activeConversations.has(conversationId)) throw codedError('conversation_request_in_progress');
    const conversation = store.getConversation(conversationId); if (!conversation) throw codedError('conversation_not_found');
    if (requestKey && conversation.last_request_key === requestKey) return { conversation, reply:conversation.turns.at(-1)?.content || '', suggested_actions:conversation.turns.at(-1)?.suggested_actions || [], draft:conversation.draft, usage:null };
    activeConversations.add(conversationId);
    try {
      const result = await conversationClient.reply({ conversation, teacherMessage: message });
      const saved = requestKey ? { ...result.conversation, last_request_key:requestKey } : result.conversation;
      store.saveConversation(saved); store.addConversationEvent(conversationId, 'conversation.replied', { suggested_action_count: result.suggested_actions.length, usage: result.usage || null, usage_mode: usageMode });
      return { ...result, conversation:saved };
    } catch (error) {
      store.addConversationEvent(conversationId, 'conversation.failed', { code: safeCode(error) });
      throw error;
    } finally { activeConversations.delete(conversationId); }
  }
  function confirmAndQueue({ conversationId, editedDraft, parentJobId = null, idempotencyKey = idFactory() }) {
    if (deletingConversations.has(conversationId)) throw codedError('task_delete_in_progress');
    const conversation = store.getConversation(conversationId); if (!conversation) throw codedError('conversation_not_found');
    const existing = store.getJobByIdempotencyKey?.(idempotencyKey);
    if (existing) return Object.freeze({ brief: existing.brief, job: existing, created: false });
    let parent = null;
    if (parentJobId) {
      if (deletingJobs.has(parentJobId)) throw codedError('artifact_delete_in_progress');
      parent = store.getJob(parentJobId);
      if (!parent || parent.state !== 'succeeded' || !parent.artifact_id || !parent.specification || (parent.conversation_id && parent.conversation_id !== conversationId)) throw codedError('revision_parent_not_found');
      assertCurrentRevisionSource(parent);
    }
    const confirmed = conversationClient.confirm({ conversation, editedDraft }); store.saveConversation(confirmed.conversation);
    const revision = parent ? { parent_job_id: parent.id, parent_artifact_id: parent.artifact_id, instruction: briefRevisionInstruction(confirmed.brief) } : null;
    const created = store.createJob({ brief: confirmed.brief, conversationId, idempotencyKey, revision });
    return Object.freeze({ brief: confirmed.brief, job: created.job, created: created.created });
  }
  function reviseAndQueue({ parentJobId, instruction, idempotencyKey = idFactory(), confirmedScope = false }) {
    if (deletingJobs.has(parentJobId)) throw codedError('artifact_delete_in_progress');
    const parent = store.getJob(parentJobId);
    if (!parent || parent.state !== 'succeeded' || !parent.artifact_id || !parent.specification) throw codedError('revision_parent_not_found');
    assertCurrentRevisionSource(parent);
    if (parent.conversation_id && deletingConversations.has(parent.conversation_id)) throw codedError('task_delete_in_progress');
    const text = typeof instruction === 'string' ? instruction.trim() : '';
    if (!text || text.length > 6000) throw codedError('revision_instruction_invalid');
    const intent = classifyRevisionIntent(text);
    if (intent.requires_confirmation && confirmedScope !== true) throw codedError(intent.clarification_required ? 'revision_scope_confirmation_required' : 'revision_content_confirmation_required');
    if (intent.requires_architect && typeof architectClient.reviseSpecification !== 'function') throw codedError('revision_architect_unavailable');
    const revision = { parent_job_id: parent.id, parent_artifact_id: parent.artifact_id, instruction: text, intent, requires_architect: intent.requires_architect, confirmed_scope: confirmedScope === true };
    return store.createJob({ brief: parent.brief, specification: intent.requires_architect ? null : parent.specification, conversationId: parent.conversation_id || null, idempotencyKey, revision });
  }
  function assertCurrentRevisionSource(parent) {
    const allJobs = store.listJobs?.() || [];
    const jobsById = new Map(allJobs.map(job => [job.id, job]));
    const descendants = allJobs.filter(job => job.id !== parent.id && isRevisionDescendant(job, parent.id, jobsById));
    if (descendants.some(job => ['queued', 'architecting', 'building'].includes(job.state))) throw codedError('revision_in_progress');
    if (descendants.some(job => job.state === 'succeeded' && job.artifact_id)) throw codedError('revision_source_superseded');
  }
  async function deleteTask(jobId) {
    const selected = store.getJob(jobId);
    if (!selected) throw codedError('job_not_found');
    const allJobs = store.listJobs?.() || [];
    const { conversationId, jobs: taskJobs } = collectTaskJobs(selected, allJobs);
    const jobIds = [...taskJobs.keys()];
    if (jobIds.some(id => deletingJobs.has(id)) || (conversationId && deletingConversations.has(conversationId))) throw codedError('task_delete_in_progress');
    if (conversationId && activeConversations.has(conversationId)) throw codedError('task_generation_in_progress');
    if (taskJobs.size && [...taskJobs.values()].some(job => store.isClaimed?.(job.id) || ['architecting', 'building'].includes(job.state))) throw codedError('task_generation_in_progress');
    if (typeof store.deleteTask !== 'function' || (typeof builderClient.deleteArtifacts !== 'function' && typeof builderClient.deleteArtifact !== 'function')) throw codedError('task_delete_unavailable');
    for (const id of jobIds) deletingJobs.add(id);
    if (conversationId) deletingConversations.add(conversationId);
    try {
      const artifactIds = [...new Set([...taskJobs.values()].map(job => job.artifact_id).filter(Boolean))];
      if (typeof builderClient.deleteArtifacts === 'function') await builderClient.deleteArtifacts({ artifactIds });
      else for (const artifactId of artifactIds) await builderClient.deleteArtifact({ artifactId });
      const deleted = store.deleteTask({ conversationId, jobIds });
      if (!deleted) throw codedError('task_delete_failed');
      return Object.freeze({ deleted: true, conversation_id: conversationId, deleted_job_ids: jobIds, deleted_artifact_ids: artifactIds });
    } finally {
      for (const id of jobIds) deletingJobs.delete(id);
      if (conversationId) deletingConversations.delete(conversationId);
    }
  }
  function listLibrary() {
    const allJobs = store.listJobs?.() || [];
    const jobsById = new Map(allJobs.map(job => [job.id, job]));
    const latestByTask = new Map();
    for (const job of allJobs) {
      if (job.state !== 'succeeded' || !job.artifact_id) continue;
      const taskId = libraryTaskId(job, jobsById);
      const previous = latestByTask.get(taskId);
      if (!previous || job.created_at.localeCompare(previous.created_at) >= 0) latestByTask.set(taskId, job);
    }
    return [...latestByTask.values()].map(job => ({ id: job.id, artifact_id: job.artifact_id, conversation_id: collectTaskJobs(job, allJobs).conversationId, title: job.specification?.media?.title || job.brief?.learning?.topic || 'สื่อการเรียนรู้', created_at: job.created_at, parent_job_id: job.revision?.parent_job_id || null })).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async function pruneSupersededArtifacts(job) {
    const allJobs = store.listJobs?.() || [];
    const jobsById = new Map(allJobs.map(candidate => [candidate.id, candidate]));
    const artifactIds = new Set();
    let current = job;
    const visited = new Set([job.id]);
    while (current?.revision?.parent_artifact_id) {
      const artifactId = current.revision.parent_artifact_id;
      if (artifactId !== job.artifact_id) artifactIds.add(artifactId);
      const parent = jobsById.get(current.revision.parent_job_id) || allJobs.find(candidate => candidate.artifact_id === artifactId);
      if (!parent || visited.has(parent.id)) break;
      current = parent;
      visited.add(parent.id);
    }
    if (job.conversation_id) {
      const jobIndex = allJobs.findIndex(candidate => candidate.id === job.id);
      for (const [index, candidate] of allJobs.entries()) {
        if (index < jobIndex && candidate.conversation_id === job.conversation_id && candidate.state === 'succeeded' && candidate.artifact_id && candidate.artifact_id !== job.artifact_id) artifactIds.add(candidate.artifact_id);
      }
    }
    const ids = [...artifactIds];
    if (!ids.length) return;
    try {
      if (typeof builderClient.deleteArtifacts === 'function') await builderClient.deleteArtifacts({ artifactIds: ids });
      else if (typeof builderClient.deleteArtifact === 'function') {
        for (const artifactId of ids) await builderClient.deleteArtifact({ artifactId });
      } else throw codedError('artifact_delete_unavailable');
    } catch (error) {
      try { store.updateJob(job.id, {}, 'artifact.cleanup_failed', { code: safeCode(error), pending_artifact_count: ids.length }); } catch (_) { /* Keep the completed revision available if cleanup logging fails. */ }
    }
  }
  function summarizeUsage(conversations, jobs) {
    const services = new Map();
    const add = (service, usage) => {
      const summary = services.get(service) || { service, call_count: 0, token_usage_calls: 0, input_usage_calls: 0, output_usage_calls: 0, cost_usage_calls: 0, total_tokens: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
      summary.call_count++;
      const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
      const input = number(usage?.input_tokens), output = number(usage?.output_tokens);
      const total = number(usage?.total_tokens) ?? (input !== null || output !== null ? (input || 0) + (output || 0) : null);
      const cost = number(usage?.cost);
      if (total !== null) { summary.token_usage_calls++; summary.total_tokens += total; }
      if (input !== null) { summary.input_usage_calls++; summary.input_tokens += input; }
      if (output !== null) { summary.output_usage_calls++; summary.output_tokens += output; }
      if (cost !== null) { summary.cost_usage_calls++; summary.cost_usd += cost; }
      services.set(service, summary);
    };
    const hasUsage = usage => usage && Object.values(usage).some(value => typeof value === 'number' && Number.isFinite(value));
    const includeEvent = event => event.usage_mode !== 'mock' && (event.usage_mode === 'live' || hasUsage(event.usage));
    for (const conversation of conversations) {
      for (const event of store.eventsFor(`conversation:${conversation.id}`)) {
        if (event.type === 'conversation.replied' && includeEvent(event)) add('conversation_ai', event.usage);
      }
    }
    for (const job of jobs) {
      for (const event of store.eventsFor(job.id)) {
        if (['architect.succeeded', 'architect.failed'].includes(event.type)) {
          if (Array.isArray(event.attempts)) { for (const attempt of event.attempts) if (includeEvent({ ...attempt, usage_mode: event.usage_mode })) add('prompt_architect_ai', attempt.usage); }
          else if (event.type === 'architect.succeeded' && includeEvent(event)) add('prompt_architect_ai', event.usage);
        }
        if (event.type === 'builder.succeeded' && includeEvent(event)) add('html_media_builder_ai', event.usage);
      }
    }
    const finalize = summary => ({ ...summary, usage_unavailable_calls: summary.call_count - summary.token_usage_calls, cost_unavailable_calls: summary.call_count - summary.cost_usage_calls, total_tokens: summary.token_usage_calls ? summary.total_tokens : null, input_tokens: summary.input_usage_calls ? summary.input_tokens : null, output_tokens: summary.output_usage_calls ? summary.output_tokens : null, cost_usd: summary.cost_usage_calls ? summary.cost_usd : null });
    const by_service = [...services.values()].map(finalize);
    const totals = by_service.reduce((sum, item) => {
      sum.call_count += item.call_count; sum.token_usage_calls += item.token_usage_calls; sum.input_usage_calls += item.input_usage_calls; sum.output_usage_calls += item.output_usage_calls; sum.cost_usage_calls += item.cost_usage_calls;
      if (item.total_tokens !== null) sum.total_tokens = (sum.total_tokens || 0) + item.total_tokens;
      if (item.input_tokens !== null) sum.input_tokens = (sum.input_tokens || 0) + item.input_tokens;
      if (item.output_tokens !== null) sum.output_tokens = (sum.output_tokens || 0) + item.output_tokens;
      if (item.cost_usd !== null) sum.cost_usd = (sum.cost_usd || 0) + item.cost_usd;
      return sum;
    }, { call_count: 0, token_usage_calls: 0, input_usage_calls: 0, output_usage_calls: 0, cost_usage_calls: 0, total_tokens: null, input_tokens: null, output_tokens: null, cost_usd: null });
    return { ...finalize(totals), by_service };
  }
  function usageSummary() {
    return summarizeUsage(store.listConversations?.() || [], store.listJobs?.() || []);
  }
  function usageSummaryForConversation(conversationId) {
    const conversation = store.getConversation(conversationId);
    if (!conversation) throw codedError('conversation_not_found');
    const jobs = (store.listJobs?.() || []).filter(job => job.conversation_id === conversationId);
    return summarizeUsage([conversation], jobs);
  }
  function isRetryable(jobId) {
    const job = store.getJob(jobId);
    return Boolean(job && (job.state === 'retryable_failed' || (job.state === 'failed' && RETRYABLE.has(job.error?.code))));
  }
  async function process(jobId) {
    if (deletingJobs.has(jobId)) throw codedError('task_delete_in_progress');
    const initial = store.getJob(jobId); if (!initial) throw codedError('job_not_found');
    if (initial.state === 'succeeded') return initial;
    if (!store.claim(jobId)) return store.getJob(jobId);
    try {
      let job = store.getJob(jobId);
      if (job.revision?.requires_architect && !job.revision.architecture_completed) {
        const parent = store.getJob(job.revision.parent_job_id);
        if (!parent?.specification) return failJob(job, 'architect', codedError('revision_parent_not_found'));
        job = store.updateJob(jobId, { state: 'architecting', error: null, failed_stage: null, attempts: { ...job.attempts, architect: job.attempts.architect + 1 } }, 'architect.revision_started', { scope:job.revision.intent?.category || 'mixed' });
        try {
          const architect = await architectClient.reviseSpecification({ confirmedBrief:job.brief, previousSpecification:parent.specification, instruction:job.revision.instruction, intent:job.revision.intent });
          job = store.updateJob(jobId, { specification:architect.specification, revision:{ ...job.revision, architecture_completed:true }, state:'queued', error:null }, 'architect.succeeded', { usage:architect.usage || null, ...(architect.attempts ? { attempts:architect.attempts } : {}), usage_mode:usageMode, revision:true });
        } catch (error) { return failJob(job, 'architect', error); }
      } else if (!job.specification) {
        job = store.updateJob(jobId, { state: 'architecting', error: null, failed_stage: null, attempts: { ...job.attempts, architect: job.attempts.architect + 1 } }, 'architect.started');
        try {
          const architect = await architectClient.createSpecification({ confirmedBrief: job.brief });
          job = store.updateJob(jobId, { specification: architect.specification, state: 'queued', error: null }, 'architect.succeeded', { usage: architect.usage || null, ...(architect.attempts ? { attempts: architect.attempts } : {}), usage_mode: usageMode });
        } catch (error) { return failJob(job, 'architect', error); }
      }
      job = store.updateJob(jobId, { state: 'building', error: null, failed_stage: null, attempts: { ...job.attempts, builder: job.attempts.builder + 1 } }, 'builder.started');
      try {
        const built = await builderClient.build({ specification: job.specification, revision: job.revision || null });
        const completed = store.updateJob(jobId, { state: 'succeeded', artifact_id: built.artifact_id, error: null, failed_stage: null }, 'builder.succeeded', { artifact_id: built.artifact_id, retry_count: built.retry_count, usage: built.usage || null, usage_mode: usageMode });
        if (completed) await pruneSupersededArtifacts(completed);
        return completed;
      } catch (error) { return failJob(job, 'builder', error); }
    } finally { store.release(jobId); }
  }
  function failJob(job, stage, error) {
    const code = safeCode(error); const retryable = RETRYABLE.has(code);
    return store.updateJob(job.id, { state: retryable ? 'retryable_failed' : 'failed', error: { code, retryable }, failed_stage: stage }, `${stage}.failed`, { code, retryable, ...(stage === 'architect' && Array.isArray(error?.attempts) ? { attempts: error.attempts, usage_mode: usageMode } : {}) });
  }
  async function retry(jobId) {
    if (deletingJobs.has(jobId)) throw codedError('task_delete_in_progress');
    const job = store.getJob(jobId); if (!job) throw codedError('job_not_found');
    if (job.state !== 'retryable_failed' && !(job.state === 'failed' && RETRYABLE.has(job.error?.code))) throw codedError('job_not_retryable');
    store.updateJob(jobId, { state: 'queued', error: null }, 'job.retry_requested', { failed_stage: job.failed_stage });
    return process(jobId);
  }
  async function recoverStalled(jobId) {
    if (deletingJobs.has(jobId)) throw codedError('task_delete_in_progress');
    const job = store.getJob(jobId); if (!job) throw codedError('job_not_found');
    if (!['architecting', 'building'].includes(job.state) || store.isClaimed?.(jobId)) throw codedError('job_not_recoverable');
    store.updateJob(jobId, { state: 'queued', error: { code: 'stalled_job_recovered', retryable: true }, failed_stage: job.specification ? 'builder' : 'architect' }, 'job.recovered', { resumed_stage: job.specification ? 'builder' : 'architect' });
    return process(jobId);
  }
  async function preview(jobId) {
    const job = store.getJob(jobId); if (!job) throw codedError('job_not_found');
    if (job.state !== 'succeeded' || !job.artifact_id) throw codedError('artifact_not_ready');
    const preview = await runtimeClient.loadPreview(job.artifact_id);
    if (!preview) throw codedError('artifact_not_found');
    return preview;
  }
  return Object.freeze({ startConversation, startIdeaDiscovery, updateCardContext, sendTeacherMessage, confirmAndQueue, reviseAndQueue, deleteTask, listLibrary, usageSummary, usageSummaryForConversation, process, retry, recoverStalled, preview, getConversation: store.getConversation, getJob: store.getJob, listJobs: store.listJobs, isRetryable, eventsFor: store.eventsFor });
}
function safeCode(error) { return typeof error?.code === 'string' && /^[a-z0-9_]+$/.test(error.code) ? error.code : 'workflow_unknown_error'; }
module.exports = { CONTRACT_VERSION, RETRYABLE, createInteractiveWorkflow };


