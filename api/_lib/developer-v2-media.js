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

async function teacherEmails() {
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
  return new Map(rows.filter(row => isId(row.teacher_id)).map(row => [row.teacher_id, row.email || row.teacher_id]));
}

function mediaOrigin() {
  try {
    const url = new URL(String(process.env.MEDIA_ORIGIN || ''));
    return url.protocol === 'https:' ? url.origin : '';
  } catch (_) {
    return '';
  }
}

async function publishedMedia(link, emails, origin, projectCache) {
  if (link?.kind !== 'published' || !isId(link.teacher_id) || !isId(link.project_id) || !isId(link.version_id) || !/^[a-f0-9]{64}$/i.test(String(link.token || ''))) return null;
  if (await storage.get(`revoked/${link.token}.json`)) return null;

  const cacheKey = `${link.teacher_id}/${link.project_id}`;
  let projectState = projectCache.get(cacheKey);
  if (!projectState) {
    const root = `users/${link.teacher_id}`;
    const project = await storage.get(`${root}/projects/${link.project_id}.json`);
    const [archive] = project ? await storage.documents(`${root}/archives/${link.project_id}`, { limit: 1, column: 'name', order: 'desc' }) : [];
    projectState = { root, project, archive };
    projectCache.set(cacheKey, projectState);
  }
  const project = projectState.project;
  const shareEpoch = projectState.archive?.share_epoch || project?.share_epoch;
  if (!project || projectState.archive?.archived || shareEpoch !== link.share_epoch) return null;

  const result = await storage.get(`${projectState.root}/results/build/${link.project_id}_${link.version_id}.json`);
  const version = result?.version;
  if (!version || version.project_id !== link.project_id) return null;

  return {
    teacher: emails.get(link.teacher_id) || link.teacher_id,
    title: version.title || project.title || 'สื่อการเรียนรู้',
    updatedAt: link.created_at || version.created_at || project.updated_at,
    // Older published Media Studio records did not persist provider usage.
    chat: { available: false },
    build: { available: false },
    runtimeUrl: origin ? `${origin}/?token=${link.token}` : ''
  };
}

async function loadPublishedMedia() {
  if (!storage.configured()) {
    const error = new Error('storage_not_configured');
    error.code = 'storage_not_configured';
    error.status = 503;
    throw error;
  }
  const [links, emails] = await Promise.all([
    listAllObjects('links', { column: 'created_at', order: 'desc' }),
    teacherEmails()
  ]);
  const linkRecords = await mapLimit(links, 8, file => storage.get(`links/${file.name}`));
  const origin = mediaOrigin();
  const projectCache = new Map();
  const rows = (await mapLimit(linkRecords, 8, link => publishedMedia(link, emails, origin, projectCache)))
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return { generatedAt: new Date().toISOString(), rows, publishedLinksScanned: linkRecords.length, mediaOriginConfigured: Boolean(origin) };
}

module.exports = { loadPublishedMedia };
