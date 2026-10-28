'use strict';

const { sendJson } = require('../../../api/_lib/http');
const handlers = Object.freeze({
  navigation: require('./navigation'),
  'brief-versions': require('./brief-versions'),
  'model-settings': require('./model-settings')
});

module.exports = async function gateway(req, res) {
  const route = req.query?.path;
  if (typeof route !== 'string' || !Object.hasOwn(handlers, route)) return sendJson(res, 404, { error: 'not_found' });
  return handlers[route](req, res);
};
