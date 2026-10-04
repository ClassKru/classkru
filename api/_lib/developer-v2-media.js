'use strict';

const { selectRows } = require('./supabase-admin');
const storage = require('./media-db');

const PAGE_SIZE = 1000;
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

async function listAllObjects(prefix, options = {}) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await storage.list(prefix, { ...options, limit: PAGE_SIZE, offset });
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function loadTeachers() {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await selectRows('teacher_profiles', {
      select: 'teacher_id,email',
      order: 'updated_at.desc,teacher_id.asc',
      limit: PAGE_SIZE,
      offset
    });
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows.filter(row => isId(row.teacher_id));
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

function usageByRun(runs, calls) {
  const output = new Map();
  const sessions = new Set(runs.map(run => run.session_id));
  for (const sessionId of sessions) {
    const sessionRuns = runs
      .filter(run => run.session_id === sessionId)
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    const sessionCalls = calls
      .filter(call => call.session_id === sessionId)
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    let callIndex = 0;
    for (const run of sessionRuns) {
      const included = [];
      const runTime = Date.parse(run.created_at);
      while (callIndex < sessionCalls.length && Date.parse(sessionCalls[callIndex].created_at) <= runTime) {
        included.push(sessionCalls[callIndex++]);
      }
      output.set(run.id, sumUsage(included));
    }
  }
  return output;
}

async function teacherVersions(teacher) {
  const root = `users/${teacher.teacher_id}/mini-lab-v2`;
  const [runFiles, usageFiles] = await Promise.all([
    listAllObjects(`${root}/runs`, { column: 'created_at', order: 'asc' }),
    listAllObjects(`${root}/usage`, { column: 'created_at', order: 'asc' })
  ]);
  if (!runFiles.length) return { rows: [], sessions: [] };

  const [runDocs, usageDocs] = await Promise.all([
    mapLimit(runFiles, 8, file => storage.get(`${root}/runs/${file.name}`)),
    mapLimit(usageFiles, 8, file => storage.get(`${root}/usage/${file.name}`))
  ]);
  const runs = runDocs.filter(run => run && isId(run.id) && isId(run.session_id) && run.status === 'passed' && run.created_at);
  const calls = usageDocs.filter(call => call && isId(call.session_id) && call.created_at);
  const totals = usageByRun(runs, calls);

  return {
    sessions: [...new Set(runs.map(run => run.session_id))],
    rows: runs.map(run => ({
      teacher: teacher.email || teacher.teacher_id,
      title: run.title || 'สื่อการเรียนรู้',
      versionId: run.id,
      sessionId: run.session_id,
      updatedAt: run.created_at,
      chat: totals.get(run.id)?.chat || { tokens: 0, unavailable: 0 },
      build: totals.get(run.id)?.build || { tokens: 0, unavailable: 0 },
      runtimeUrl: `/api/v2/runtime/${run.id}`
    }))
  };
}

async function loadV2Media() {
  if (!storage.configured()) {
    const error = new Error('storage_not_configured');
    error.code = 'storage_not_configured';
    error.status = 503;
    throw error;
  }
  const teachers = await loadTeachers();
  const results = await mapLimit(teachers, 8, teacherVersions);
  const rows = results.flatMap(result => result.rows).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return {
    generatedAt: new Date().toISOString(),
    rows,
    scannedTeachers: teachers.length,
    generatedSessions: new Set(results.flatMap(result => result.sessions)).size,
    generatedVersions: rows.length
  };
}

module.exports = { loadV2Media };
