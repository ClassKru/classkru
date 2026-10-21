'use strict';

const crypto = require('node:crypto');

function createInMemoryWorkflowStore({ idFactory = crypto.randomUUID, clock = () => new Date() } = {}) {
  const conversations = new Map();
  const jobs = new Map();
  const idempotency = new Map();
  const events = new Map();
  const running = new Set();
  const timestamp = () => clock().toISOString();
  const append = (jobId, type, details = {}) => {
    const event = Object.freeze({ id: idFactory(), job_id: jobId, type, at: timestamp(), ...details });
    events.set(jobId, [...(events.get(jobId) || []), event]);
    return event;
  };
  return Object.freeze({
    saveConversation(conversation) { conversations.set(conversation.id, conversation); return conversation; },
    getConversation(id) { return conversations.get(id) || null; },
    listConversations() { return [...conversations.values()]; },
    addConversationEvent(conversationId, type, details = {}) { return append(`conversation:${conversationId}`, type, details); },
    createJob({ brief, idempotencyKey, conversationId = null, specification = null, revision = null }) {
      const existingId = idempotency.get(idempotencyKey);
      if (existingId) return { job: jobs.get(existingId), created: false };
      const job = Object.freeze({ id: idFactory(), state: 'queued', brief, conversation_id: conversationId, specification, revision, artifact_id: null, error: null, failed_stage: null, attempts: { architect: 0, builder: 0 }, created_at: timestamp(), updated_at: timestamp() });
      jobs.set(job.id, job); idempotency.set(idempotencyKey, job.id); append(job.id, 'job.queued', { contract_version: brief.schema_version });
      return { job, created: true };
    },
    getJob(id) { return jobs.get(id) || null; },
    listJobs() { return [...jobs.values()]; },
    getJobByIdempotencyKey(key) { const id = idempotency.get(key); return id ? jobs.get(id) : null; },
    deleteTask({ conversationId = null, jobIds = [] } = {}) {
      const deletedJobs = [];
      for (const id of new Set(jobIds)) {
        const job = jobs.get(id);
        if (!job) continue;
        deletedJobs.push(job); jobs.delete(id); running.delete(id); events.delete(id);
        for (const [key, value] of idempotency) if (value === id) idempotency.delete(key);
      }
      const conversation = conversationId ? conversations.get(conversationId) || null : null;
      if (conversationId) { conversations.delete(conversationId); events.delete(`conversation:${conversationId}`); }
      return { conversation, jobs: deletedJobs };
    },
    updateJob(id, patch, eventType, details = {}) {
      const previous = jobs.get(id); if (!previous) return null;
      const job = Object.freeze({ ...previous, ...patch, updated_at: timestamp() }); jobs.set(id, job); if (eventType) append(id, eventType, details); return job;
    },
    eventsFor(id) { return [...(events.get(id) || [])]; },
    isClaimed(id) { return running.has(id); },
    claim(id) { if (!jobs.has(id) || running.has(id)) return false; running.add(id); return true; },
    release(id) { running.delete(id); }
  });
}

module.exports = { createInMemoryWorkflowStore };


