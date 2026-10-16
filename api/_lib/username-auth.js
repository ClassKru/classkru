'use strict';

const crypto = require('node:crypto');

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;
const PASSWORD_MIN_LENGTH = 8;
const USERNAME_EMAIL_DOMAIN = 'username.classkru.local';

function normalizeUsername(value) {
  return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

function validateUsername(value) {
  const username = normalizeUsername(value);
  const length = Array.from(username).length;
  if (length < USERNAME_MIN_LENGTH || length > USERNAME_MAX_LENGTH) return null;
  if (!/^[\p{L}\p{N}][\p{L}\p{N}\p{M}._-]*$/u.test(username)) return null;
  if (/[._-]$/.test(username) || /[._-]{2}/.test(username)) return null;
  return username;
}

function usernameAuthEmail(value) {
  const username = validateUsername(value);
  if (!username) return null;
  const digest = crypto.createHash('sha256').update(username).digest('hex').slice(0, 32);
  return `user-${digest}@${USERNAME_EMAIL_DOMAIN}`;
}

module.exports = {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_EMAIL_DOMAIN,
  normalizeUsername,
  validateUsername,
  usernameAuthEmail
};
