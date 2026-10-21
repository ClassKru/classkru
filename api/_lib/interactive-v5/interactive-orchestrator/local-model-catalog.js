'use strict';

const { VALID_MODEL_ID } = require('./local-model-settings');

function createLocalModelCatalog({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  let cached = null;
  let cachedAt = 0;
  return Object.freeze({
    async list({ refresh = false } = {}) {
      if (!refresh && cached && now() - cachedAt < 300_000) return cached;
      let response;
      try { response = await fetchImpl('https://openrouter.ai/api/v1/models', { signal:AbortSignal.timeout(15_000) }); }
      catch (_) { throw Object.assign(new Error('model_catalog_unavailable'), { code:'model_catalog_unavailable' }); }
      if (!response.ok) throw Object.assign(new Error('model_catalog_unavailable'), { code:'model_catalog_unavailable' });
      const body = await response.json().catch(() => null);
      if (!Array.isArray(body?.data)) throw Object.assign(new Error('model_catalog_unavailable'), { code:'model_catalog_unavailable' });
      const seen = new Set();
      const models = body.data.flatMap(item => {
        const id = item?.id;
        if (typeof id !== 'string' || id.length > 160 || !VALID_MODEL_ID.test(id) || seen.has(id)) return [];
        seen.add(id);
        const name = typeof item.name === 'string' ? item.name.trim().slice(0, 160) : '';
        return [{ id, name:name || id, structured_outputs:Array.isArray(item.supported_parameters) && item.supported_parameters.includes('structured_outputs') }];
      }).sort((a, b) => a.name.localeCompare(b.name));
      if (!models.length) throw Object.assign(new Error('model_catalog_unavailable'), { code:'model_catalog_unavailable' });
      cached = Object.freeze(models);
      cachedAt = now();
      return cached;
    }
  });
}

module.exports = { createLocalModelCatalog };


