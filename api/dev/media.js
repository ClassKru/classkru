'use strict';

const modelsHandler = require('../_lib/dev-media-models');
const v2MediaHandler = require('../_lib/dev-v2-media');

module.exports = function handler(req, res) {
  const resource = String(req.query?.resource || '');
  if (resource === 'models') return modelsHandler(req, res);
  if (resource === 'v2') return v2MediaHandler(req, res);
  res.statusCode = 400;
  return res.end(JSON.stringify({ error: 'unknown_resource' }));
};
