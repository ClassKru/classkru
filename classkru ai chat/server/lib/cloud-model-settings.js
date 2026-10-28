'use strict';
const crypto = require('node:crypto');
const storage = require('../../../api/_lib/media-db');
const { MODEL_ID } = require('./model-catalog');
function createStore(db = storage) {
  function prefix(userId) {
    if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('invalid_teacher_id');
    return `classkru-ai/settings/${userId}`;
  }
  return {
    async get(userId) {
      await db.checkBucket();
      const rows = await db.documents(prefix(userId), { limit: 1, column: 'created_at', order: 'desc' });
      const model = rows[0]?.modelId;
      if (model != null && !MODEL_ID.test(model)) throw new Error('invalid_model_settings');
      return model || null;
    },
    async save(userId, modelId) {
      if (!MODEL_ID.test(modelId)) throw new Error('invalid_model_id');
      await db.checkBucket();
      const saved = await db.put(`${prefix(userId)}/${crypto.randomUUID()}.json`, { modelId });
      if (saved === false) throw new Error('model_settings_save_failed');
    }
  };
}
module.exports = { createStore, enabled: env => env.VERCEL === '1' || env.CLASSKRU_AI_CLOUD_SETTINGS === 'true' };
