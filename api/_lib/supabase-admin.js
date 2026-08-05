'use strict';

const DEFAULT_SUPABASE_URL = 'https://dzntiiuyqvkaxqpqzxeh.supabase.co';

function configuration() {
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) {
    const error = new Error('Supabase admin access is not configured');
    error.code = 'SUPABASE_NOT_CONFIGURED';
    throw error;
  }
  return { url, key };
}

async function selectRows(table, options = {}) {
  const { url, key } = configuration();
  const query = new URLSearchParams();
  query.set('select', options.select || '*');
  if (options.order) query.set('order', options.order);
  if (options.limit) query.set('limit', String(options.limit));
  const headers = { apikey: key };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  const response = await fetch(`${url}/rest/v1/${table}?${query.toString()}`, { headers });
  if (!response.ok) {
    const error = new Error(`Database request failed (${response.status})`);
    error.code = 'DATABASE_REQUEST_FAILED';
    throw error;
  }
  return response.json();
}

module.exports = { selectRows };
