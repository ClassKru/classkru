'use strict';

const { selectRows, mutateRows } = require('./supabase-admin');

const defaults = () => ({
  planner_model: process.env.OPENROUTER_MEDIA_PLANNER_MODEL || process.env.OPENROUTER_MEDIA_MODEL || process.env.OPENROUTER_MODEL || 'qwen/qwen3-30b-a3b-instruct-2507',
  builder_model: process.env.OPENROUTER_MEDIA_MODEL || process.env.OPENROUTER_MODEL || 'qwen/qwen3-30b-a3b-instruct-2507',
  image_model: process.env.OPENROUTER_MEDIA_IMAGE_MODEL || 'google/gemini-3.1-flash-image'
});

async function get() {
  const fallback = defaults();
  try {
    const rows = await selectRows('media_ai_model_settings', { select: 'planner_model,builder_model,image_model,updated_at,updated_by', limit: 1 });
    const row = rows[0];
    if (!row) return { ...fallback, overridden: false, storage_ready: false };
    return {
      planner_model: row.planner_model || fallback.planner_model,
      builder_model: row.builder_model || fallback.builder_model,
      image_model: row.image_model || fallback.image_model,
      overridden: Boolean(row.planner_model || row.builder_model || row.image_model),
      storage_ready: true,
      updated_at: row.updated_at,
      updated_by: row.updated_by
    };
  } catch (error) {
    // Keep the existing Vercel defaults working until the additive migration is applied.
    return { ...fallback, overridden: false, storage_ready: false, storage_error: error.code || 'settings_unavailable' };
  }
}

async function save(settings) {
  const rows = await mutateRows('media_ai_model_settings', 'PATCH', {
    query: { id: 'eq.default' },
    body: {
      planner_model: settings.planner_model,
      builder_model: settings.builder_model,
      image_model: settings.image_model,
      updated_at: new Date().toISOString(),
      updated_by: 'developer-console'
    }
  });
  if (!rows.length) {
    const error = new Error('Media AI settings row is missing');
    error.code = 'MEDIA_SETTINGS_NOT_INITIALIZED';
    throw error;
  }
  return rows[0];
}

module.exports = { defaults, get, save };
