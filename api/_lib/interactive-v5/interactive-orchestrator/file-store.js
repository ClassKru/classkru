'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function createLocalFileWorkflowStore({ root, idFactory = crypto.randomUUID, clock = () => new Date() } = {}) {
  if (!root) throw new TypeError('local_store_root_required');
  const files = Object.fromEntries(['conversations', 'jobs', 'events', 'idempotency'].map(name => [name, path.join(root, `${name}.json`)]));
  const read = file => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
  };
  const data = Object.fromEntries(Object.entries(files).map(([name, file]) => [name, read(file)]));
  const running = new Set();
  const now = () => clock().toISOString();
  const save = () => {
    fs.mkdirSync(root, { recursive: true });
    for (const [name, file] of Object.entries(files)) fs.writeFileSync(file, JSON.stringify(data[name]), 'utf8');
  };
  const event = (id, type, details = {}) => {
    const item = { id: idFactory(), job_id: id, type, at: now(), ...details };
    data.events[id] = [...(data.events[id] || []), item]; save(); return item;
  };
  return Object.freeze({
    saveConversation(conversation) { data.conversations[conversation.id] = conversation; save(); return conversation; },
    getConversation(id) { return data.conversations[id] || null; },
    listConversations() { return Object.values(data.conversations); },
    addConversationEvent(id, type, details) { return event(`conversation:${id}`, type, details); },
    createJob({ brief, idempotencyKey, conversationId = null, specification = null, revision = null }) {
      const old = data.idempotency[idempotencyKey];
      if (old) return { job: data.jobs[old], created: false };
      const job = { id: idFactory(), state: 'queued', brief, conversation_id: conversationId, specification, revision, artifact_id: null, error: null, failed_stage: null, attempts: { architect: 0, builder: 0 }, created_at: now(), updated_at: now() };
      data.jobs[job.id] = job; data.idempotency[idempotencyKey] = job.id; save();
      event(job.id, 'job.queued', { contract_version: brief.schema_version });
      return { job, created: true };
    },
    getJob(id) { return data.jobs[id] || null; },
    listJobs() { return Object.values(data.jobs); },
    getJobByIdempotencyKey(key) { return data.jobs[data.idempotency[key]] || null; },
    deleteTask({ conversationId = null, jobIds = [] } = {}) {
      const ids = [...new Set(jobIds)];
      const deletedJobs = ids.map(id => data.jobs[id]).filter(Boolean);
      const deletedConversation = conversationId ? data.conversations[conversationId] || null : null;
      const deletedEvents = new Map();
      const deletedIdempotency = new Map();
      for (const id of ids) if (data.events[id]) deletedEvents.set(id, data.events[id]);
      if (conversationId && data.events[`conversation:${conversationId}`]) deletedEvents.set(`conversation:${conversationId}`, data.events[`conversation:${conversationId}`]);
      for (const [key, value] of Object.entries(data.idempotency)) if (ids.includes(value)) deletedIdempotency.set(key, value);

      for (const id of ids) { delete data.jobs[id]; delete data.events[id]; running.delete(id); }
      if (conversationId) { delete data.conversations[conversationId]; delete data.events[`conversation:${conversationId}`]; }
      for (const key of deletedIdempotency.keys()) delete data.idempotency[key];
      try { save(); }
      catch (error) {
        for (const job of deletedJobs) data.jobs[job.id] = job;
        if (deletedConversation) data.conversations[conversationId] = deletedConversation;
        for (const [id, events] of deletedEvents) data.events[id] = events;
        for (const [key, value] of deletedIdempotency) data.idempotency[key] = value;
        try { save(); } catch (_) { /* Preserve the original failure; caller can retry deletion. */ }
        throw error;
      }
      return { conversation: deletedConversation, jobs: deletedJobs };
    },
    updateJob(id, patch, type, details = {}) {
      if (!data.jobs[id]) return null;
      const job = data.jobs[id] = { ...data.jobs[id], ...patch, updated_at: now() }; save();
      if (type) event(id, type, details);
      return job;
    },
    eventsFor(id) { return [...(data.events[id] || [])]; },
    isClaimed(id) { return running.has(id); },
    claim(id) { if (!data.jobs[id] || running.has(id)) return false; running.add(id); return true; },
    release(id) { running.delete(id); }
  });
}

module.exports = { createLocalFileWorkflowStore };


