'use strict';

const { sendJson, parseBody, requestOriginIsValid } = require('../_lib/http');
const { verifySession } = require('../_lib/dev-auth');
const { selectRows, mutateRows } = require('../_lib/supabase-admin');

const DEVELOPERS = Object.freeze({ biggy: 'Biggy', petchpetch: 'PetchPetch' });
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEA_PAGE_PREFIX = 'developer-idea:';
const COMMENT_PAGE_PREFIX = 'developer-comment:';

function developer(value) {
  const key = String(value || '').trim().toLowerCase();
  return DEVELOPERS[key] ? key : '';
}

function text(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

async function listIdeas(owner) {
  const rows = await selectRows('issue_reports', {
    select: 'id,message,page_url,browser_info,status,created_at,updated_at',
    order: 'created_at.desc',
    limit: 2000
  });
  const ideas = rows
    .filter(item => item.page_url === `${IDEA_PAGE_PREFIX}${owner}`)
    .map(item => ({
      id: item.id,
      owner,
      idea_text: item.message,
      is_completed: item.status === 'resolved',
      created_at: item.created_at,
      updated_at: item.updated_at
    }));
  const comments = rows
    .filter(item => String(item.page_url || '').startsWith(COMMENT_PAGE_PREFIX))
    .map(item => ({
      id: item.id,
      idea_id: item.page_url.slice(COMMENT_PAGE_PREFIX.length),
      author: String(item.browser_info || '').replace(/^developer-author:/, ''),
      comment_text: item.message,
      created_at: item.created_at
    }));
  const visibleIds = new Set(ideas.map(item => item.id));
  const grouped = Object.create(null);
  comments.forEach(comment => {
    if (!visibleIds.has(comment.idea_id)) return;
    (grouped[comment.idea_id] ||= []).push(comment);
  });
  return ideas.map(item => ({ ...item, comments: grouped[item.id] || [] }));
}

async function handler(req, res) {
  if (!verifySession(req).ok) return sendJson(res, 401, { error: 'authentication_required' });
  if (!requestOriginIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });

  try {
    if (req.method === 'GET') {
      const owner = developer(req.query.owner);
      if (!owner) return sendJson(res, 400, { error: 'invalid_owner' });
      return sendJson(res, 200, { owner, rows: await listIdeas(owner) });
    }

    const body = parseBody(req);
    if (req.method === 'POST' && body.action === 'idea') {
      const owner = developer(body.owner);
      const ideaText = text(body.ideaText, 4000);
      if (!owner || ideaText.length < 5) return sendJson(res, 400, { error: 'invalid_idea' });
      const rows = await mutateRows('issue_reports', 'POST', {
        body: {
          message: ideaText,
          page_url: `${IDEA_PAGE_PREFIX}${owner}`,
          browser_info: 'developer-idea:v1',
          status: 'new'
        }
      });
      return sendJson(res, 201, { row: rows[0] });
    }

    if (req.method === 'POST' && body.action === 'comment') {
      const author = developer(body.author);
      const ideaId = text(body.ideaId, 36);
      const commentText = text(body.commentText, 2000);
      if (!author || !UUID_PATTERN.test(ideaId) || commentText.length < 5) return sendJson(res, 400, { error: 'invalid_comment' });
      const rows = await mutateRows('issue_reports', 'POST', {
        body: {
          message: commentText,
          page_url: `${COMMENT_PAGE_PREFIX}${ideaId}`,
          browser_info: `developer-author:${author}`,
          status: 'closed'
        }
      });
      return sendJson(res, 201, { row: rows[0] });
    }

    if (req.method === 'PATCH' && body.action === 'complete') {
      const ideaId = text(body.ideaId, 36);
      if (!UUID_PATTERN.test(ideaId) || typeof body.completed !== 'boolean') return sendJson(res, 400, { error: 'invalid_status' });
      const rows = await mutateRows('issue_reports', 'PATCH', {
        query: { id: `eq.${ideaId}` },
        body: { status: body.completed ? 'resolved' : 'new', updated_at: new Date().toISOString() }
      });
      return sendJson(res, 200, { row: rows[0] });
    }

    return sendJson(res, 405, { error: 'method_not_allowed' });
  } catch (error) {
    const status = error.code === 'SUPABASE_NOT_CONFIGURED' ? 503 : 502;
    return sendJson(res, status, { error: error.code || 'database_unavailable' });
  }
}

module.exports = handler;
