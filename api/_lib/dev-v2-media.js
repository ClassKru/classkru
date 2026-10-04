'use strict';

const { sendJson } = require('../_lib/http');
const { verifySession } = require('../_lib/dev-auth');
const { selectRows } = require('../_lib/supabase-admin');
const storage = require('../_lib/media-db');

const PAGE_SIZE = 1000;
const MAX_TEACHERS = 2000;
const MAX_USAGE_OBJECTS_PER_TEACHER = 20000;
const MAX_SESSIONS_PER_TEACHER = 100;
const isId = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

async function mapLimit(items, concurrency, mapper) {
  const result = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      result[index] = await mapper(items[index], index);
    }
  }));
  return result;
}

async function loadTeachers() {
  const rows = await selectRows('teacher_profiles', {
    select: 'teacher_id,email,deleted_at',
    order: 'updated_at.desc,teacher_id.asc',
    limit: MAX_TEACHERS
  });
  return rows.filter(row => isId(row.teacher_id) && !row.deleted_at);
}

function sessionIdFromName(name, kind) {
  const marker = `_${kind}_`;
  const index = String(name || '').indexOf(marker);
  if (index <= 0) return '';
  const id = String(name).slice(0, index);
  return isId(id) ? id : '';
}

function sumUsage(calls) {
  const totals = {
    chat: { tokens: 0, unavailable: 0 },
    build: { tokens: 0, unavailable: 0 }
  };
  for (const call of calls) {
    const target = call.phase === 'v2_chat' ? totals.chat
      : ['v2_build', 'v2_repair'].includes(call.phase) ? totals.build : null;
    if (!target) continue;
    const measuredTokens = call.total_tokens ?? (call.input_tokens != null && call.output_tokens != null
      ? Number(call.input_tokens) + Number(call.output_tokens)
      : null);
    if (measuredTokens == null) target.unavailable++;
    else target.tokens += Math.max(0, Number(measuredTokens) || 0);
  }
  return totals;
}

async function listUsageObjects(prefix) {
  const rows = [];
  let truncated = false;
  for (let offset = 0; offset < MAX_USAGE_OBJECTS_PER_TEACHER; offset += PAGE_SIZE) {
    const limit = Math.min(PAGE_SIZE, MAX_USAGE_OBJECTS_PER_TEACHER - offset);
    const page = await storage.list(prefix, { limit, offset, column: 'created_at', order: 'desc' });
    rows.push(...page);
    if (page.length < limit) return { rows, truncated };
    if (offset + limit >= MAX_USAGE_OBJECTS_PER_TEACHER) truncated = true;
  }
  return { rows, truncated };
}

async function teacherWorks(teacher) {
  const root = `users/${teacher.teacher_id}/mini-lab-v2`;
  const indexFiles = await storage.list(`${root}/sessions`, { limit: PAGE_SIZE, search: '_index_', column: 'name', order: 'desc' });
  if (!indexFiles.length) return { rows: [], usageTruncated: false, sessionTruncated: false };

  const latestIndices = new Map();
  for (const file of indexFiles) {
    const sessionId = sessionIdFromName(file.name, 'index');
    if (!sessionId || latestIndices.has(sessionId)) continue;
    const timestamp = Number(String(file.name).slice(file.name.indexOf('_index_') + 7).split('_')[0]);
    latestIndices.set(sessionId, { file, timestamp: Number.isFinite(timestamp) ? timestamp : 0 });
  }
  const recentIndices = [...latestIndices.entries()]
    .sort((a, b) => b[1].timestamp - a[1].timestamp)
    .slice(0, MAX_SESSIONS_PER_TEACHER);
  const sessions = await mapLimit(recentIndices, 8, async ([id, item]) => {
    const meta = await storage.get(`${root}/sessions/${item.file.name}`);
    return meta?.updated_at ? { id, meta, updatedAt: meta.updated_at } : null;
  });
  const sessionRows = sessions.filter(Boolean);
  if (!sessionRows.length) return { rows: [], usageTruncated: false, sessionTruncated: indexFiles.length >= PAGE_SIZE || latestIndices.size > MAX_SESSIONS_PER_TEACHER };

  const runFiles = await storage.list(`${root}/runs`, { limit: PAGE_SIZE, column: 'created_at', order: 'desc' });
  const latestRuns = new Map();
  const candidateSessionIds = new Set(sessionRows.map(session => session.id));
  for (const file of runFiles) {
    const sessionId = sessionIdFromName(file.name, 'run');
    if (!candidateSessionIds.has(sessionId) || latestRuns.has(sessionId)) continue;
    const runId = String(file.name).slice(String(file.name).indexOf('_run_') + 5).replace(/\.json$/i, '');
    if (isId(runId)) latestRuns.set(sessionId, runId);
  }

  const generatedSessions = sessionRows.filter(session => latestRuns.has(session.id));
  if (!generatedSessions.length) return { rows: [], usageTruncated: false, sessionTruncated: indexFiles.length >= PAGE_SIZE || latestIndices.size > MAX_SESSIONS_PER_TEACHER };

  const sessionIds = new Set(generatedSessions.map(session => session.id));
  const { rows: usageFiles, truncated: usageTruncated } = await listUsageObjects(`${root}/usage`);
  const relevantUsageFiles = usageFiles.filter(file => sessionIds.has(sessionIdFromName(file.name, 'usage')));
  const usageDocs = await mapLimit(relevantUsageFiles, 8, file => storage.get(`${root}/usage/${file.name}`));
  const usageBySession = new Map();
  for (const call of usageDocs) {
    if (!call || !sessionIds.has(call.session_id)) continue;
    const calls = usageBySession.get(call.session_id) || [];
    calls.push(call);
    usageBySession.set(call.session_id, calls);
  }

  const usageTotals = new Map([...usageBySession.entries()].map(([id, calls]) => [id, sumUsage(calls)]));

  return {
    rows: generatedSessions.map(session => ({
      teacher: teacher.email || teacher.teacher_id,
      title: session.meta.title || 'สื่อการเรียนรู้',
      updatedAt: session.updatedAt,
      chat: usageTotals.get(session.id)?.chat || { tokens: 0, unavailable: 0 },
      build: usageTotals.get(session.id)?.build || { tokens: 0, unavailable: 0 },
      runtimeUrl: `/api/v2/runtime/${latestRuns.get(session.id)}`,
      usageTruncated
    })),
    usageTruncated,
    sessionTruncated: indexFiles.length >= PAGE_SIZE || latestIndices.size > MAX_SESSIONS_PER_TEACHER
  };
}

async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
  if (!verifySession(req).ok) return sendJson(res, 401, { error: 'authentication_required' });
  try {
    if (!storage.configured()) return sendJson(res, 503, { error: 'storage_not_configured' });
    const teachers = await loadTeachers();
    const results = await mapLimit(teachers, 8, teacherWorks);
    const rows = results.flatMap(result => result.rows).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return sendJson(res, 200, {
      generatedAt: new Date().toISOString(),
      rows,
      scannedTeachers: teachers.length,
      profilesTruncated: teachers.length >= MAX_TEACHERS,
      limits: {
        teachers: MAX_TEACHERS,
        sessionsPerTeacher: MAX_SESSIONS_PER_TEACHER,
        usageObjectsPerTeacher: MAX_USAGE_OBJECTS_PER_TEACHER
      },
      usageTruncated: results.some(result => result.usageTruncated),
      sessionsTruncated: results.some(result => result.sessionTruncated)
    });
  } catch (error) {
    const status = error.status || (error.code === 'SUPABASE_NOT_CONFIGURED' ? 503 : 502);
    return sendJson(res, status, { error: error.code || 'media_data_unavailable' });
  }
}

module.exports = handler;
