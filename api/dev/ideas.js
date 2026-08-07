'use strict';

const { sendJson, parseBody, requestOriginIsValid } = require('../_lib/http');
const { verifySession } = require('../_lib/dev-auth');
const { selectRows, mutateRows } = require('../_lib/supabase-admin');

const DEVELOPERS = Object.freeze({ biggy: 'Biggy', petchpetch: 'PetchPetch' });
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function developer(value) {
  const key = String(value || '').trim().toLowerCase();
  return DEVELOPERS[key] ? key : '';
}

function text(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

async function listIdeas(owner) {
  const allIdeas = await selectRows('developer_ideas', {
    select: 'id,owner,idea_text,is_completed,created_at,updated_at',
    order: 'created_at.desc',
    limit: 500
  });
  const ideas = allIdeas.filter(item => item.owner === owner);
  const comments = await selectRows('developer_idea_comments', {
    select: 'id,idea_id,author,comment_text,created_at',
    order: 'created_at.asc',
    limit: 2000
  });
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
      if (!owner || ideaText.length < 3) return sendJson(res, 400, { error: 'invalid_idea' });
      const rows = await mutateRows('developer_ideas', 'POST', { body: { owner, idea_text: ideaText } });
      return sendJson(res, 201, { row: rows[0] });
    }

    if (req.method === 'POST' && body.action === 'comment') {
      const author = developer(body.author);
      const ideaId = text(body.ideaId, 36);
      const commentText = text(body.commentText, 2000);
      if (!author || !UUID_PATTERN.test(ideaId) || commentText.length < 1) return sendJson(res, 400, { error: 'invalid_comment' });
      const rows = await mutateRows('developer_idea_comments', 'POST', {
        body: { idea_id: ideaId, author, comment_text: commentText }
      });
      return sendJson(res, 201, { row: rows[0] });
    }

    if (req.method === 'PATCH' && body.action === 'complete') {
      const ideaId = text(body.ideaId, 36);
      if (!UUID_PATTERN.test(ideaId) || typeof body.completed !== 'boolean') return sendJson(res, 400, { error: 'invalid_status' });
      const rows = await mutateRows('developer_ideas', 'PATCH', {
        query: { id: `eq.${ideaId}` },
        body: { is_completed: body.completed, updated_at: new Date().toISOString() }
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
