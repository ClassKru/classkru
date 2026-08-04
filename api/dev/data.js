'use strict';

const { sendJson } = require('../_lib/http');
const { verifySession } = require('../_lib/dev-auth');
const { selectRows } = require('../_lib/supabase-admin');

const ISSUE_REPORT_FIELDS = 'id,reporter_id,message,page_url,browser_info,status,created_at,updated_at';

function normalize(value, maxLength = 120) {
  return String(value || '').trim().toLocaleLowerCase('th-TH').slice(0, maxLength);
}

function filterReports(rows, query) {
  const status = normalize(query.status, 30);
  const search = normalize(query.q, 100);
  return rows.filter(row => {
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
    const reportRows = await selectRows('issue_reports', {
      select: ISSUE_REPORT_FIELDS,
      order: 'created_at.desc',
      limit: 500
    });

    if (resource === 'overview') {
      const statuses = { new: 0, reviewing: 0, resolved: 0, closed: 0 };
      reportRows.forEach(report => { statuses[report.status] = (statuses[report.status] || 0) + 1; });
      return sendJson(res, 200, {
        total: reportRows.length,
        statuses,
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

    return sendJson(res, 400, { error: 'unknown_resource' });
  } catch (error) {
    const status = error.code === 'SUPABASE_NOT_CONFIGURED' ? 503 : 502;
    return sendJson(res, status, { error: error.code || 'database_unavailable' });
  }
}

module.exports = handler;
