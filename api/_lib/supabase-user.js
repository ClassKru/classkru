'use strict';

const DEFAULT_SUPABASE_URL = 'https://dzntiiuyqvkaxqpqzxeh.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_SePLBF-dsJfx5T6Yvvcuew_vntSr3Vc';

function authConfiguration() {
  return {
    url: process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL,
    key: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY
  };
}

async function authenticatedUser(req) {
  const authorization = String(req.headers.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error('Authentication is required');
    error.code = 'AUTHENTICATION_REQUIRED';
    throw error;
  }

  const { url, key } = authConfiguration();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${match[1]}` },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    const error = new Error('Session is invalid');
    error.code = 'INVALID_SESSION';
    throw error;
  }

  const user = await response.json();
  return { id: String(user.id || ''), email: String(user.email || '') };
}

module.exports = { authenticatedUser, authConfiguration };
