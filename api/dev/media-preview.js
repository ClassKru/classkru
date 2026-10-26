'use strict';

const { sendJson } = require('../_lib/http');
const { verifySession } = require('../_lib/dev-auth');
const { selectRows } = require('../_lib/supabase-admin');
const storage = require('../_lib/media-db');
const { createCloudArtifactStore } = require('../_lib/interactive-v5/html-media-builder-ai/cloud-artifact-store');
const { RUNTIME_CSP, instrumentRuntimeHtml, runtimeCspForHost } = require('../_lib/interactive-v5/html-media-builder-ai/runtime-preview');

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function queryValue(value) {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function validId(value) {
  return ID.test(queryValue(value));
}

async function loadV5Artifact(teacherId, jobId, artifactId) {
  const [row] = await selectRows('interactive_v5_tasks', {
    select: 'state',
    filters: { teacher_id: `eq.${teacherId}`, 'state->jobs': `cs.${JSON.stringify([{ id: jobId }])}` },
    limit: 1
  });
  const job = (row?.state?.jobs || []).find(item => item?.id === jobId && item?.state === 'succeeded' && item?.artifact_id === artifactId);
  if (!job) return null;
  return createCloudArtifactStore({ storage, teacherId }).getValidated(artifactId);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
  if (!verifySession(req).ok) return sendJson(res, 401, { error: 'authentication_required' });
  const teacherId = queryValue(req.query?.teacher_id);
  const jobId = queryValue(req.query?.job_id);
  const artifactId = queryValue(req.query?.artifact_id);
  if (!validId(teacherId) || !validId(jobId) || !validId(artifactId)) return sendJson(res, 400, { error: 'invalid_preview' });

  try {
    if (!storage.configured()) return sendJson(res, 503, { error: 'storage_not_configured' });
    const artifact = await loadV5Artifact(teacherId, jobId, artifactId);
    if (!artifact?.html) return sendJson(res, 404, { error: 'preview_not_found' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Content-Security-Policy', runtimeCspForHost(req.headers?.host, RUNTIME_CSP));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.status(200).send(instrumentRuntimeHtml(artifact.html));
  } catch (error) {
    return sendJson(res, error.status || 502, { error: error.code || 'preview_unavailable' });
  }
};
