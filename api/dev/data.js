'use strict';

const { sendJson } = require('../_lib/http');
const { verifySession } = require('../_lib/dev-auth');
const { selectRows } = require('../_lib/supabase-admin');

const TABLES = Object.freeze({
  issue_reports: 'id,category_id,reporter_id,title,description,steps_to_reproduce,page_url,browser_info,status,created_at,updated_at',
  issue_categories: 'id,slug,name,description,sort_order,is_active,created_at'
});

function normalize(value, maxLength = 120) {
  return String(value || '').trim().toLocaleLowerCase('th-TH').slice(0, maxLength);
}

function enrichReports(reports, categories) {
  const categoryMap = new Map(categories.map(category => [String(category.id), category]));
  return reports.map(report => ({ ...report, category: categoryMap.get(String(report.category_id)) || null }));
}

function filterReports(rows, query) {
  const status = normalize(query.status, 30);
  const categoryId = normalize(query.category, 30);
  const search = normalize(query.q, 100);
  return rows.filter(row => {
    if (status && row.status !== status) return false;
    if (categoryId && String(row.category_id) !== categoryId) return false;
    if (!search) return true;
    const haystack = normalize(`${row.title} ${row.description} ${row.steps_to_reproduce || ''}`, 5000);
    return haystack.includes(search);
  });
}

async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
  const session = verifySession(req);
  if (!session.ok) return sendJson(res, 401, { error: 'authentication_required' });

  try {
    const resource = normalize(req.query.resource || 'overview', 30);
    const categories = await selectRows('issue_categories', {
      select: TABLES.issue_categories,
      order: 'sort_order.asc',
      limit: 100
    });

    if (resource === 'overview' || resource === 'reports') {
      const reportRows = await selectRows('issue_reports', {
        select: TABLES.issue_reports,
        order: 'created_at.desc',
        limit: 500
      });
      const reports = enrichReports(reportRows, categories);
      if (resource === 'overview') {
        const statuses = { new: 0, reviewing: 0, resolved: 0, closed: 0 };
        reports.forEach(report => { statuses[report.status] = (statuses[report.status] || 0) + 1; });
        const categorySummary = categories.map(category => ({
          ...category,
          count: reports.filter(report => String(report.category_id) === String(category.id)).length
        }));
        return sendJson(res, 200, { total: reports.length, statuses, categories: categorySummary, recent: reports.slice(0, 8) });
      }
      const filtered = filterReports(reports, req.query);
      return sendJson(res, 200, { total: filtered.length, rows: filtered, categories });
    }

    if (resource === 'table') {
      const table = normalize(req.query.table, 40);
      if (!Object.prototype.hasOwnProperty.call(TABLES, table)) {
        return sendJson(res, 400, { error: 'table_not_allowed' });
      }
      const rows = table === 'issue_categories'
        ? categories
        : await selectRows(table, { select: TABLES[table], order: 'created_at.desc', limit: 200 });
      return sendJson(res, 200, { table, readOnly: true, total: rows.length, rows });
    }

    return sendJson(res, 400, { error: 'unknown_resource' });
  } catch (error) {
    const status = error.code === 'SUPABASE_NOT_CONFIGURED' ? 503 : 502;
    return sendJson(res, status, { error: error.code || 'database_unavailable' });
  }
}

module.exports = handler;
