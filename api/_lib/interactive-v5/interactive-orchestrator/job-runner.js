'use strict';

const ACTIVE_STATES = new Set(['architecting', 'building']);
const PENDING_STATES = new Set(['queued', ...ACTIVE_STATES]);

function createBackgroundJobRunner({ workflow, listJobs, concurrency = 1, onError = () => {} } = {}) {
  if (!workflow?.getJob || !workflow?.process || !workflow?.recoverStalled || !workflow?.retry) throw new TypeError('job_runner_workflow_required');
  if (typeof listJobs !== 'function') throw new TypeError('job_runner_list_jobs_required');
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new TypeError('job_runner_concurrency_invalid');

  const pending = [];
  const scheduled = new Map();
  let active = 0;

  function pump() {
    while (active < concurrency && pending.length) {
      const item = pending.shift();
      active++;
      Promise.resolve().then(async () => {
        const job = workflow.getJob(item.jobId);
        if (!job) return null;
        if (item.retry) return workflow.retry(item.jobId);
        if (ACTIVE_STATES.has(job.state)) return workflow.recoverStalled(item.jobId);
        if (job.state === 'queued') return workflow.process(item.jobId);
        return job;
      }).catch(error => {
        try { onError(error, item.jobId); } catch (_) {}
      }).finally(() => {
        scheduled.delete(item.jobId);
        active--;
        pump();
      });
    }
  }

  function enqueue(jobId, retry = false) {
    if (typeof jobId !== 'string' || !jobId) throw Object.assign(new Error('job_not_found'), { code: 'job_not_found' });
    const existing = workflow.getJob(jobId);
    if (!existing) throw Object.assign(new Error('job_not_found'), { code: 'job_not_found' });
    if (scheduled.has(jobId)) return acceptedJob(existing, scheduled.get(jobId).retry);
    if (retry && existing.state !== 'retryable_failed' && !(existing.state === 'failed' && workflow.isRetryable?.(jobId))) {
      throw Object.assign(new Error('job_not_retryable'), { code: 'job_not_retryable' });
    }
    if (!retry && !PENDING_STATES.has(existing.state)) return existing;
    const item = { jobId, retry };
    scheduled.set(jobId, item);
    pending.push(item);
    pump();
    return acceptedJob(existing, retry);
  }

  function acceptedJob(job, retry) {
    return retry ? { ...job, state: 'queued', error: null } : job;
  }

  return Object.freeze({
    schedule(jobId) { return enqueue(jobId); },
    scheduleRetry(jobId) { return enqueue(jobId, true); },
    resumePending() {
      const jobs = [...listJobs()].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
      for (const job of jobs) if (PENDING_STATES.has(job.state)) enqueue(job.id);
      return jobs.filter(job => PENDING_STATES.has(job.state)).length;
    },
    whenIdle() {
      if (!scheduled.size) return Promise.resolve();
      return new Promise(resolve => {
        const check = () => scheduled.size ? setTimeout(check, 5) : resolve();
        check();
      });
    }
  });
}

module.exports = { ACTIVE_STATES, PENDING_STATES, createBackgroundJobRunner };


