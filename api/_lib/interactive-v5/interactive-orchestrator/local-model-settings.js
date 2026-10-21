'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROLES = ['conversation', 'architect', 'builder'];
const VALID_MODEL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._:-]*$/;

function createLocalModelSettings({ root, defaults }) {
  const file = path.join(root, 'model-settings.json');
  const normalize = values => {
    if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).some(key => !ROLES.includes(key))) throw Object.assign(new Error('invalid_model_settings'), { code:'invalid_model_settings' });
    const result = {};
    for (const role of ROLES) {
      const value = values[role];
      if (typeof value !== 'string' || value.length > 160 || !VALID_MODEL_ID.test(value)) throw Object.assign(new Error('invalid_model_settings'), { code:'invalid_model_settings' });
      result[role] = value;
    }
    return result;
  };
  const defaultModels = Object.freeze(normalize(defaults));
  let models = defaultModels;
  if (fs.existsSync(file)) {
    try { models = Object.freeze(normalize(JSON.parse(fs.readFileSync(file, 'utf8')))); }
    catch (_) { models = defaultModels; }
  }
  return Object.freeze({
    get: () => ({ ...models }),
    defaults: () => ({ ...defaultModels }),
    save(values) {
      const next = Object.freeze(normalize(values));
      fs.mkdirSync(root, { recursive:true });
      fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf8');
      models = next;
      return { ...models };
    }
  });
}

function withSelectedModel(provider, settings, role, env = {}) {
  return Object.freeze({ respond(input) {
    const modelId = settings.get()[role];
    const config = { ...input.config, modelId };
    if (role === 'conversation') config.reasoningEffort = require('../conversation-ai/config').fromEnvironment({ ...env, CONVERSATION_MODEL_ID:modelId }).reasoningEffort;
    return provider.respond({ ...input, config });
  } });
}

module.exports = { createLocalModelSettings, withSelectedModel, VALID_MODEL_ID };


