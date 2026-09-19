'use strict';

const { sendJson } = require('../_lib/http');
// One deployed function, four existing document handlers. Keep the public URLs
// via vercel.json rewrites; never build a require path from user input.
const handlers = Object.freeze({
  'worksheet-docx': require('../_lib/exports/worksheet-docx'),
  'quiz-docx': require('../_lib/exports/quiz-docx'),
  'lesson-plan-docx': require('../_lib/exports/lesson-plan-docx'),
  'lesson-pack-docx': require('../_lib/exports/lesson-pack-docx')
});

module.exports = async function handler(req, res) {
  const document = req.query?.document;
  if (typeof document !== 'string' || !Object.hasOwn(handlers, document)) {
    return sendJson(res, 404, { error: 'not_found' });
  }
  return handlers[document](req, res);
};
