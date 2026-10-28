'use strict';

const MODEL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._:-]*$/;

function perMillion(value) {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price * 1_000_000 : null;
}

function createModelCatalog({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  let cached = null;
  let cachedAt = 0;
  return Object.freeze({
    async list({ refresh = false } = {}) {
      if (!refresh && cached && now() - cachedAt < 300_000) return cached;
      let response;
      try {
        response = await fetchImpl('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(15000) });
      } catch (_) {
        throw Object.assign(new Error('model_catalog_unavailable'), { code: 'model_catalog_unavailable' });
      }
      if (!response.ok) throw Object.assign(new Error('model_catalog_unavailable'), { code: 'model_catalog_unavailable' });
      const payload = await response.json().catch(() => null);
      if (!Array.isArray(payload?.data)) throw Object.assign(new Error('model_catalog_unavailable'), { code: 'model_catalog_unavailable' });

      const seen = new Set();
      const models = payload.data.flatMap(item => {
        const id = item?.id;
        const supported = Array.isArray(item?.supported_parameters) ? item.supported_parameters : [];
        const outputs = Array.isArray(item?.architecture?.output_modalities) ? item.architecture.output_modalities : [];
        if (typeof id !== 'string' || id.length > 160 || !MODEL_ID.test(id) || seen.has(id)) return [];
        if (!outputs.includes('text') || !(supported.includes('response_format') || supported.includes('structured_outputs'))) return [];
        seen.add(id);
        return [{
          id,
          name: typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 160) : id,
          promptPerMillion: perMillion(item.pricing?.prompt),
          completionPerMillion: perMillion(item.pricing?.completion),
          contextLength: Number.isFinite(Number(item.context_length)) ? Number(item.context_length) : null
        }];
      }).sort((a, b) => a.name.localeCompare(b.name));
      if (!models.length) throw Object.assign(new Error('model_catalog_unavailable'), { code: 'model_catalog_unavailable' });
      cached = Object.freeze(models);
      cachedAt = now();
      return cached;
    }
  });
}

module.exports = { createModelCatalog, MODEL_ID };
