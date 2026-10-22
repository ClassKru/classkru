'use strict';

const DEVELOPER_EMAILS = new Set([
  'petch.0231@gmail.com',
  'supakit.radiation@gmail.com',
  'classkru.dev@gmail.com'
]);

function isClassKruMediaDeveloper(email) {
  return DEVELOPER_EMAILS.has(String(email || '').trim().toLowerCase());
}

module.exports = { isClassKruMediaDeveloper };
