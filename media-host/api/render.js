'use strict';
module.exports = async function handler(req,res) {
  res.setHeader('Content-Type','text/plain; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  const token=String(req.query.token||'');
  // Raw untrusted documents are served only inside the trusted player's iframe.
  if (req.method!=='GET' || req.headers['sec-fetch-dest']!=='iframe' || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).send('กรุณาเปิดจากหน้าตัวเล่นสื่อ');
  try {
    // Use the APP project's secret, never this media project's automatically
    // injected VERCEL_AUTOMATION_BYPASS_SECRET. Neither comes from the request.
    const bypass=process.env.CLASSKRU_APP_BYPASS_SECRET || '';
    if (bypass && (!process.env.CLASSKRU_APP_ORIGIN || !/^[\x21-\x7e]{16,4096}$/.test(bypass))) throw new Error('invalid_app_bypass');
    const app=new URL(process.env.CLASSKRU_APP_ORIGIN || 'https://classkru-kohl.vercel.app');
    const loopback=['localhost','127.0.0.1','[::1]'].includes(app.hostname);
    const local=process.env.NODE_ENV!=='production' && loopback;
    if ((!local && app.protocol!=='https:') || (bypass && (app.protocol!=='https:' || loopback)) ||
        app.host===req.headers.host || app.username || app.password ||
        app.pathname!=='/' || app.search || app.hash) throw new Error('invalid_app_origin');
    const headers={Accept:'application/json'};
    if (bypass) headers['x-vercel-protection-bypass']=bypass;
    // Fixed endpoint + configured origin only. Never forward user headers,
    // cookies, a bypass query string, or a request for a bypass cookie.
    const response=await fetch(`${app.origin}/api/media-studio/public?token=${token}`,{headers,signal:AbortSignal.timeout(20000),redirect:'error',cache:'no-store'});
    if (!response.ok) return res.status(response.status===404?404:503).send('สื่อนี้ปิดการแชร์ ลิงก์หมดอายุ หรือยังเปิดไม่ได้ กรุณาติดต่อครู');
    const payload=await response.json();
    if (typeof payload.html!=='string' || payload.html.length>524288 || typeof payload.csp!=='string' || !payload.csp.includes('sandbox allow-scripts') || payload.policy_version!==1) throw new Error('invalid_bundle');
    // Fail closed if an upstream diagnostic ever reflects the credential.
    if (bypass && (payload.html.includes(bypass) || payload.csp.includes(bypass))) throw new Error('invalid_bundle');
    res.setHeader('Content-Security-Policy',`${payload.csp}; frame-ancestors 'self' ${app.origin}`);
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.status(200).send(payload.html);
  } catch (_) { return res.status(503).send('ยังเปิดสื่อไม่ได้ กรุณาลองใหม่ภายหลัง'); }
};
