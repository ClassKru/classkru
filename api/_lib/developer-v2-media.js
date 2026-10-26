'use strict';

const { selectRows } = require('./supabase-admin');
const storage = require('./media-db');

const PAGE_SIZE = 1000;
const isId = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const V5_SOURCE_LABEL = 'ClassKru Studio V5';
const V2_SOURCE_LABEL = 'ClassKru Studio V2';

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

async function listAllRows(table, options = {}) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await selectRows(table, { ...options, limit: PAGE_SIZE, offset });
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
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
      source: 'v2',
      sourceLabel: V2_SOURCE_LABEL,
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

function latestSucceededV5Job(state) {
  const jobs = Array.isArray(state?.jobs) ? state.jobs : [];
  return [...jobs]
    .filter(job => job?.state === 'succeeded' && isId(job.id) && isId(job.artifact_id))
    .sort((left, right) => Date.parse(left.updated_at || left.created_at || '') - Date.parse(right.updated_at || right.created_at || ''))
    .at(-1) || null;
}

function mapV5TaskRows(tasks, teachers = new Map()) {
  return tasks.map(task => {
    const teacherId = String(task?.teacher_id || '');
    const job = latestSucceededV5Job(task?.state);
    if (!job || !isId(teacherId)) return null;
    const teacher = teachers.get(teacherId);
    const title = job.specification?.media?.title || job.brief?.learning?.topic || 'สื่อการเรียนรู้';
    const updatedAt = job.updated_at || job.created_at || task.updated_at || task.created_at;
    const preview = new URLSearchParams({
      source: 'v5',
      teacher_id: teacherId,
      job_id: job.id,
      artifact_id: job.artifact_id
    });
    return {
      teacher: teacher?.email || teacherId,
      source: 'v5',
      sourceLabel: V5_SOURCE_LABEL,
      title,
      versionId: job.id,
      sessionId: job.conversation_id || task.id || null,
      updatedAt,
      chat: { available: false },
      build: { available: false },
      runtimeUrl: `/api/dev/media-preview?${preview.toString()}`,
      runtimeLabel: 'เปิด Preview'
    };
  }).filter(Boolean);
}

async function loadV5Media(teachers) {
  const tasks = await listAllRows('interactive_v5_tasks', {
    select: 'teacher_id,id,state,created_at,updated_at',
    order: 'updated_at.asc,teacher_id.asc'
  });
  return mapV5TaskRows(tasks, new Map(teachers.map(teacher => [teacher.teacher_id, teacher])));
}

async function loadStudioMedia() {
  if (!storage.configured()) {
    const error = new Error('storage_not_configured');
    error.code = 'storage_not_configured';
    error.status = 503;
    throw error;
  }
  const teachers = await loadTeachers();
  const [v2Results, v5Result] = await Promise.all([
    mapLimit(teachers, 8, teacherVersions),
    loadV5Media(teachers).catch(error => ({ error }))
  ]);
  const v2Rows = v2Results.flatMap(result => result.rows);
  const v5Rows = v5Result.error ? [] : v5Result;
  const rows = [...v2Rows, ...v5Rows].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const sourceCounts = {
    v2: v2Rows.length,
    v5: v5Rows.length
  };
  const sourceErrors = v5Result.error ? { v5: v5Result.error.code || 'database_unavailable' } : {};
  return {
    generatedAt: new Date().toISOString(),
    rows,
    scannedTeachers: teachers.length,
    generatedSessions: new Set([
      ...v2Results.flatMap(result => result.sessions),
      ...v5Rows.map(row => row.sessionId).filter(Boolean)
    ]).size,
    generatedVersions: rows.length,
    sourceCounts,
    sourceErrors
  };
}

module.exports = {
  loadStudioMedia,
  loadV2Media: loadStudioMedia,
  latestSucceededV5Job,
  mapV5TaskRows
};
