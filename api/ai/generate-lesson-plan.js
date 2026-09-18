'use strict';

const { sendJson, parseBody, requestOriginIsValid } = require('../_lib/http');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dzntiiuyqvkaxqpqzxeh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_SePLBF-dsJfx5T6Yvvcuew_vntSr3Vc';

function clean(value, max = 1200) { return String(value || '').trim().slice(0, max); }
function asList(value, maxItems = 12) { return (Array.isArray(value) ? value : []).map(item => clean(item, 800)).filter(Boolean).slice(0, maxItems); }
function parsePlan(text) {
  const stripped = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(stripped);
  return parsed?.plan || parsed;
}
async function authenticatedUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  return response.json();
}
function normalizePlan(value) {
  const plan = value && typeof value === 'object' ? value : {};
  return {
    title: clean(plan.title, 240),
    keyConcepts: asList(plan.keyConcepts),
    objectives: asList(plan.objectives),
    activities: asList(plan.activities, 16),
    resources: asList(plan.resources),
    assessment: asList(plan.assessment, 12),
    evidence: asList(plan.evidence, 12),
    adaptations: asList(plan.adaptations, 10)
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
  if (!requestOriginIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });
  if (!process.env.OPENROUTER_API_KEY) return sendJson(res, 503, { error: 'ai_not_configured', message: 'ยังไม่ได้ตั้งค่า OPENROUTER_API_KEY' });
  try {
    const user = await authenticatedUser(req);
    if (!user?.id) return sendJson(res, 401, { error: 'authentication_required', message: 'กรุณาเข้าสู่ระบบใหม่ก่อนใช้งาน AI' });
    const body = parseBody(req);
    const topic = clean(body.topic, 240);
    const indicators = Array.isArray(body.indicators) ? body.indicators.slice(0, 12).map(item => `${clean(item.code, 80)}: ${clean(item.text, 800)}`).filter(Boolean) : [];
    if (topic.length < 3 || !indicators.length) return sendJson(res, 400, { error: 'invalid_request', message: 'กรุณาระบุหัวข้อและตัวชี้วัดอย่างน้อย 1 ข้อ' });
    const rules = 'กติกาคุณภาพ: ใช้เฉพาะตัวชี้วัดและบริบทที่ได้รับ ห้ามสร้างรหัสตัวชี้วัดหรือผลคะแนนขึ้นเอง กิจกรรมต้องทำได้จริงตามเวลาและทรัพยากรที่ระบุ ทุกการประเมินต้องบอกหลักฐานที่ครูเก็บได้ และต้องให้ครูตรวจสอบก่อนใช้';
    const prompt = `คุณเป็นผู้ช่วยออกแบบการเรียนรู้สำหรับครูไทย จัดทำร่างแผนการสอนฉบับใช้งานได้จริง โดยไม่อ้างว่าเป็นแผนทางการ

บริบท
- วิชา: ${clean(body.subject, 160)}
- ระดับชั้น: ${clean(body.grade, 80)}
- หัวข้อ: ${topic}
- เวลาเรียน: ${clean(body.duration, 80)}
- วิธีเรียนที่ต้องการ: ${clean(body.method, 100)}
- ลักษณะผู้เรียน/ปัญหา: ${clean(body.learnerContext, 1600) || 'ไม่ระบุ'}
- อุปกรณ์และข้อจำกัด: ${clean(body.resources, 1000) || 'ไม่ระบุ'}
- สิ่งที่ครูอยากเน้น: ${clean(body.focus, 1000) || 'ไม่ระบุ'}

ตัวชี้วัดที่ ClassKru เลือกไว้:
${indicators.map(item => `- ${item}`).join('\n')}

ตอบกลับเป็น JSON ล้วนตาม schema นี้ ห้ามมี markdown:
{"plan":{"title":"...","keyConcepts":["..."],"objectives":["..."],"activities":["ขั้นนำ: ...","ขั้นสอน: ...","ขั้นสรุป: ..."],"resources":["..."],"assessment":["วิธีประเมิน: ... | เครื่องมือ: ... | เกณฑ์: ..."],"evidence":["..."],"adaptations":["..."]},"warnings":["ข้อควรให้ครูตรวจสอบ"]}`;
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': process.env.APP_URL || 'https://classkru-kohl.vercel.app', 'X-Title': 'ClassKru' },
      body: JSON.stringify({ model: process.env.OPENROUTER_MODEL || 'qwen/qwen3-30b-a3b-instruct-2507', temperature: 0.25, max_tokens: 3200, messages: [{ role:'system', content:rules }, { role:'user', content:prompt }] })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return sendJson(res, 502, { error: 'generation_failed', message: 'AI ยังสร้างแผนการสอนไม่ได้ กรุณาลองใหม่อีกครั้ง' });
    let raw;
    try { raw = parsePlan(payload?.choices?.[0]?.message?.content); } catch (_) { return sendJson(res, 502, { error: 'invalid_ai_response', message: 'AI ส่งรูปแบบแผนไม่ถูกต้อง กรุณาลองใหม่' }); }
    const plan = normalizePlan(raw);
    if (!plan.title || !plan.objectives.length || !plan.activities.length) return sendJson(res, 502, { error: 'empty_ai_response', message: 'AI ยังสร้างแผนที่มีข้อมูลไม่ครบ กรุณาลองใหม่' });
    return sendJson(res, 200, { plan, warnings: asList(raw?.warnings, 8) });
  } catch (error) {
    console.error('Lesson plan generation error:', error);
    return sendJson(res, 500, { error: 'server_error', message: 'เกิดข้อผิดพลาดขณะสร้างแผนการสอน' });
  }
};
