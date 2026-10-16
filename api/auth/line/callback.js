'use strict';

const {
  LINE_TOKEN_URL,
  LINE_USERINFO_URL,
  channelId,
  channelSecret,
  requestOrigin,
  safeReturnTo,
  parseCookies,
  clearAuthCookies,
  redirect,
  errorRedirect,
  linkRedirect,
  verifyLinkContext,
  LINK_CONTEXT_COOKIE,
  lineRequest,
  supabaseAuthRequest,
  syntheticEmail,
  findLineIdentity,
  saveLineIdentity,
  STATE_COOKIE,
  RETURN_TO_COOKIE
} = require('../../_lib/line-auth-shared');

async function getExistingUser(teacherId) {
  return supabaseAuthRequest(`/auth/v1/admin/users/${encodeURIComponent(teacherId)}`);
}

async function ensureSupabaseUser(lineUser) {
  const lineUserId = String(lineUser.sub || lineUser.userId || '').trim();
  if (!lineUserId) throw new Error('LINE user id is missing');

  const existingIdentity = await findLineIdentity(lineUserId);
  if (existingIdentity?.teacher_id) {
    const existingUser = await getExistingUser(existingIdentity.teacher_id);
    return { user: existingUser, lineUserId };
  }

  const email = syntheticEmail(lineUserId);
  let user;
  try {
    user = await supabaseAuthRequest('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email,
        email_confirm: true,
        user_metadata: {
          line_user_id: lineUserId,
          line_display_name: lineUser.name || null,
          line_picture_url: lineUser.picture || null,
          line_email: lineUser.email || null
        },
        app_metadata: { provider: 'line', line_user_id: lineUserId }
      })
    });
  } catch (error) {
    // A retry after a network timeout can race with the first create request.
    if (error.status !== 422 && error.status !== 409) throw error;
    const rows = await findLineIdentity(lineUserId);
    if (!rows?.teacher_id) throw error;
    user = await getExistingUser(rows.teacher_id);
  }

  await saveLineIdentity({
    teacher_id: user.id,
    provider: 'line',
    provider_user_id: lineUserId,
    provider_email: lineUser.email || null,
    updated_at: new Date().toISOString()
  });
  return { user, lineUserId };
}

async function createMagicLink(user, returnTo) {
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) throw new Error('Supabase user email is missing');
  const result = await supabaseAuthRequest('/auth/v1/admin/generate_link', {
    method: 'POST',
    body: JSON.stringify({ type: 'magiclink', email, redirect_to: returnTo })
  });
  const tokenHash = result?.properties?.hashed_token || result?.hashed_token;
  if (tokenHash) {
    const { url } = require('../../_lib/supabase-admin').configuration();
    const verify = new URL(`${url}/auth/v1/verify`);
    verify.searchParams.set('token', tokenHash);
    verify.searchParams.set('type', 'magiclink');
    verify.searchParams.set('redirect_to', returnTo);
    return verify.toString();
  }
  if (result?.action_link) return result.action_link;
  throw new Error('Supabase did not return a sign-in link');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const cookies = parseCookies(req);
  let returnTo = safeReturnTo(req, cookies[RETURN_TO_COOKIE]);
  try {
    if (!cookies[STATE_COOKIE] || !req.query?.state || cookies[STATE_COOKIE] !== String(req.query.state)) {
      return redirect(res, errorRedirect(returnTo, 'invalid_state'), clearAuthCookies());
    }
    if (req.query?.error) return redirect(res, errorRedirect(returnTo, 'line_denied'), clearAuthCookies());
    const code = String(req.query?.code || '').trim();
    if (!code) return redirect(res, errorRedirect(returnTo, 'missing_code'), clearAuthCookies());

    const linkRequested = new URL(returnTo).searchParams.get('line_link') === 'start';
    const linkContext = cookies[LINK_CONTEXT_COOKIE]
      ? verifyLinkContext(cookies[LINK_CONTEXT_COOKIE], req.query.state)
      : null;
    if (linkRequested && !linkContext) {
      return redirect(res, errorRedirect(returnTo, 'invalid_link_context'), clearAuthCookies());
    }

    const origin = requestOrigin(req);
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${origin}/api/auth/line/callback`,
      client_id: channelId(),
      client_secret: channelSecret()
    });
    const token = await lineRequest(LINE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString()
    });
    const lineUser = await lineRequest(LINE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    if (linkContext) {
      const lineUserId = String(lineUser.sub || lineUser.userId || '').trim();
      if (!lineUserId) return redirect(res, errorRedirect(returnTo, 'line_user_missing'), clearAuthCookies());
      const existingIdentity = await findLineIdentity(lineUserId);
      if (existingIdentity?.teacher_id && existingIdentity.teacher_id !== linkContext.teacherId) {
        return redirect(res, linkRedirect(returnTo, 'conflict'), clearAuthCookies());
      }
      if (!existingIdentity) {
        await saveLineIdentity({
          teacher_id: linkContext.teacherId,
          provider: 'line',
          provider_user_id: lineUserId,
          provider_email: lineUser.email || null,
          updated_at: new Date().toISOString()
        });
      }
      return redirect(res, linkRedirect(returnTo, 'success'), clearAuthCookies());
    }
    const { user } = await ensureSupabaseUser(lineUser);
    const signInUrl = await createMagicLink(user, returnTo);
    return redirect(res, signInUrl, clearAuthCookies());
  } catch (error) {
    console.error('LINE auth callback failed:', error.code || error.message);
    return redirect(res, errorRedirect(returnTo, 'callback_failed'), clearAuthCookies());
  }
};
