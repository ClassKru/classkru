'use strict';
const { authConfiguration } = require('./supabase-user');
function fail(code, status = 400) { return Object.assign(new Error(code), { code, status }); }
function configuration() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw fail('storage_not_configured', 503);
  return { url: authConfiguration().url, key };
}
async function sb(path, { method = 'GET', body, raw = false } = {}) {
  const { url, key } = configuration();
  const headers = { apikey: key, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  const response = await fetch(`${url}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const known = ['not_found','project_limit','project_busy','queue_limit','daily_limit','version_limit'];
    const code = known.find(c => String(payload.message || '').includes(c));
    if (code) throw fail(code, code === 'not_found' ? 404 : 429);
    if (['42P01','PGRST202','PGRST205'].includes(payload.code)) throw fail('migration_required', 503);
    throw fail('database_unavailable', 502);
  }
  return raw ? response.text() : response.status === 204 ? null : response.json();
}
function query(params) { return new URLSearchParams(params).toString(); }
function rows(table, params) { return sb(`/rest/v1/${table}?${query(params)}`); }
function insert(table, body) { return sb(`/rest/v1/${table}`, { method: 'POST', body }); }
function patch(table, params, body) { return sb(`/rest/v1/${table}?${query(params)}`, { method: 'PATCH', body }); }
async function rpc(name, body) {
  const result = await sb(`/rest/v1/rpc/${name}`, { method: 'POST', body });
  // PostgREST can represent a composite return as a one-row array. Keep the
  // service's singleton contract while leaving SETOF claims and booleans intact.
  if (['media_create_project','media_enqueue','media_publish'].includes(name)) {
    if (Array.isArray(result)) {
      if (result.length!==1) throw fail('database_unavailable',502);
      return result[0];
    }
    if (!result || typeof result!=='object') throw fail('database_unavailable',502);
  }
  return result;
}
function bundle(path, options = {}) {
  if (!/^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9-]+\.json$/.test(path)) throw fail('invalid_bundle_path');
  return sb(`/storage/v1/object/media-bundles/${path}`, options);
}
async function owned(table, id, teacher) {
  const result = await rows(table, { id: `eq.${id}`, teacher_id: `eq.${teacher}`, limit: 1 });
  if (!result[0]) throw fail('not_found', 404);
  return result[0];
}
module.exports = { fail, rows, insert, patch, rpc, bundle, owned };
