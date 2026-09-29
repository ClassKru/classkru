'use strict';

const crypto = require('crypto');
const { selectRows } = require('./supabase-admin');

function encryptionKey() {
  const secret = process.env.DEV_CONFIG_ENCRYPTION_KEY || '';
  return secret.length >= 32 ? crypto.createHash('sha256').update(secret).digest() : null;
}

function decrypt(value) {
  const key = encryptionKey();
  if (!key) throw Object.assign(new Error('encryption_not_configured'), { code: 'encryption_not_configured' });
  const [iv, tag, ciphertext] = String(value).split('.').map(part => Buffer.from(part, 'base64url'));
  if (!iv || iv.length !== 12 || !tag || tag.length !== 16 || !ciphertext) throw new Error('invalid_ciphertext');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

async function loadAIConfig() {
  let row = null;
  if (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const rows = await selectRows('developer_ai_settings', { filters: { id: 'eq.media_ai' }, limit: 1 });
    row = rows[0] || null;
  }
  return {
    apiKey: row?.encrypted_api_key ? decrypt(row.encrypted_api_key) : process.env.OPENAI_API_KEY || '',
    plannerModel: row?.planner_model || process.env.OPENAI_MEDIA_STUDIO_MODEL || 'gpt-5.6-luna',
    builderModel: row?.builder_model || process.env.OPENAI_MEDIA_STUDIO_MODEL || 'gpt-5.6-luna'
  };
}

module.exports = { loadAIConfig, encryptionKey, decrypt };
