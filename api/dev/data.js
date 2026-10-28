'use strict';

const { sendJson } = require('../_lib/http');
const { verifySession } = require('../_lib/dev-auth');
const { selectRows } = require('../_lib/supabase-admin');
const storage = require('../_lib/media-db');
const { loadBusinessAnalytics } = require('../_lib/business-analytics');
const { loadStudioMedia } = require('../_lib/developer-v2-media');
const { createCloudArtifactStore } = require('../_lib/interactive-v5/html-media-builder-ai/cloud-artifact-store');
const { RUNTIME_CSP, instrumentRuntimeHtml, runtimeCspForHost } = require('../_lib/interactive-v5/html-media-builder-ai/runtime-preview');

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISSUE_REPORT_FIELDS = 'id,reporter_id,category,message,page_url,browser_info,status,created_at,updated_at';
const LEGACY_ISSUE_REPORT_FIELDS = 'id,reporter_id,message,page_url,browser_info,status,created_at,updated_at';

function normalize(value, maxLength = 120) {
  return String(value || '').trim().toLocaleLowerCase('th-TH').slice(0, maxLength);
}

function reportCategory(report) {
  const legacyCategory = String(report.browser_info || '').match(/feedback-category:(issue|feature)/)?.[1];
  if (legacyCategory) return legacyCategory;
  return report.category === 'feature' ? 'feature' : 'issue';
}

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

async function loadReportRows() {
  const options = { order: 'created_at.desc', limit: 500 };
  try {
    const rows = await selectRows('issue_reports', { ...options, select: ISSUE_REPORT_FIELDS });
    return rows
      .filter(report => !String(report.page_url || '').startsWith('developer-'))
      .map(report => ({ ...report, category: reportCategory(report) }));
  } catch (error) {
    if (error.code !== 'DATABASE_REQUEST_FAILED') throw error;
    const rows = await selectRows('issue_reports', { ...options, select: LEGACY_ISSUE_REPORT_FIELDS });
    return rows
      .filter(report => !String(report.page_url || '').startsWith('developer-'))
      .map(report => ({ ...report, category: reportCategory(report) }));
  }
}

function filterReports(rows, query) {
  const category = normalize(query.category, 30);
  const status = normalize(query.status, 30);
  const search = normalize(query.q, 100);
  return rows.filter(row => {
    if (category && row.category !== category) return false;
    if (status && row.status !== status) return false;
    if (!search) return true;
    return normalize(row.message, 4000).includes(search);
  });
}

async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
  const session = verifySession(req);
  if (!session.ok) return sendJson(res, 401, { error: 'authentication_required' });

  try {
    const resource = normalize(req.query.resource || 'overview', 30);
    if (resource === 'business') return sendJson(res, 200, await loadBusinessAnalytics());
    if (resource === 'studio-media' || resource === 'v2-media') return sendJson(res, 200, await loadStudioMedia());
    if (resource === 'studio-media-preview') {
      const teacherId = queryValue(req.query.teacher_id);
      const jobId = queryValue(req.query.job_id);
      const artifactId = queryValue(req.query.artifact_id);
      if (!validId(teacherId) || !validId(jobId) || !validId(artifactId)) return sendJson(res, 400, { error: 'invalid_preview' });
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
    }
    const reportRows = await loadReportRows();

    if (resource === 'overview') {
      const statuses = { new: 0, reviewing: 0, resolved: 0, closed: 0 };
      const categories = { issue: 0, feature: 0 };
      reportRows.forEach(report => {
        statuses[report.status] = (statuses[report.status] || 0) + 1;
        const category = report.category === 'feature' ? 'feature' : 'issue';
        categories[category] += 1;
      });
      return sendJson(res, 200, {
        total: reportRows.length,
        statuses,
        categories,
        recent: reportRows.slice(0, 8)
      });
    }

    if (resource === 'reports') {
      const filtered = filterReports(reportRows, req.query);
      return sendJson(res, 200, { total: filtered.length, rows: filtered });
    }

    if (resource === 'table') {
      const table = normalize(req.query.table, 40);
      if (table !== 'issue_reports') return sendJson(res, 400, { error: 'table_not_allowed' });
      return sendJson(res, 200, {
        table,
        readOnly: true,
        total: reportRows.length,
        rows: reportRows.slice(0, 200)
      });
    }

    if (resource === 'billing') {
      const teachers = await selectRows('teacher_profiles', { select: 'teacher_id,email,subscription_status,paid_until,updated_at', order: 'updated_at.desc', limit: 2000 });
      const orders = await selectRows('payment_orders', { select: 'id,teacher_id,plan_id,amount_satang,status,gateway,gateway_charge_id,paid_at,created_at', order: 'created_at.desc', limit: 2000 });
      const now = Date.now();
      const paidOrders = orders.filter(row => row.status === 'paid');
      return sendJson(res, 200, {
        totalTeachers: teachers.length,
        activeTeachers: teachers.filter(row => row.subscription_status !== 'expired' && (!row.paid_until || new Date(row.paid_until).getTime() >= now)).length,
        expiredTeachers: teachers.filter(row => row.subscription_status === 'expired' || (row.paid_until && new Date(row.paid_until).getTime() < now)).length,
        paidOrders: paidOrders.length,
        paidAmountSatang: paidOrders.reduce((total, row) => total + Number(row.amount_satang || 0), 0),
        rows: teachers,
        orders
      });
    }

    return sendJson(res, 400, { error: 'unknown_resource' });
  } catch (error) {
    const status = error.code === 'SUPABASE_NOT_CONFIGURED' ? 503 : 502;
    return sendJson(res, status, { error: error.code || 'database_unavailable' });
  }
}

module.exports = handler;
