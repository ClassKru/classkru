'use strict';

const { sendJson, requestOriginIsValid } = require('../_lib/http');

const DEFAULT_SUPABASE_URL = 'https://dzntiiuyqvkaxqpqzxeh.supabase.co';
const MAX_IMAGE_CHARS = 6_000_000;

function fail(res, status, error, detail) {
  return sendJson(res, status, { error, ...(detail ? { detail } : {}) });
}

async function verifySupabaseSession(req) {
  const authorization = String(req.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) return false;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey) return false;
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: supabaseKey, Authorization: authorization }
  });
  return response.ok;
}

function parseJsonContent(content) {
  const text = Array.isArray(content)
    ? content.map(part => typeof part === 'string' ? part : part?.text || '').join('')
    : String(content || '');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  try { return JSON.parse(candidate); } catch (_) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error('โมเดลส่งผลลัพธ์ไม่ใช่ JSON');
  }
}

function normalizeEntries(payload) {
  const entries = Array.isArray(payload) ? payload : payload?.entries;
  if (!Array.isArray(entries)) throw new Error('ไม่พบรายการคาบเรียนในผลลัพธ์ AI');
  const dayMap = { 'อาทิตย์': 0, 'จันทร์': 1, 'อังคาร': 2, 'พุธ': 3, 'พฤหัสบดี': 4, 'พฤหัส': 4, 'ศุกร์': 5, 'เสาร์': 6 };
  return entries.map(entry => {
    const dayValue = entry.day_of_week ?? entry.dow ?? entry.day;
    const dow = typeof dayValue === 'number' ? dayValue : dayMap[String(dayValue || '').replace(/^วัน/, '').trim()];
    const period = Number(entry.period);
    return {
      dow: Number.isFinite(dow) ? dow : null,
      period: Number.isInteger(period) && period > 0 && period <= 16 ? period : null,
      subjectCode: String(entry.subjectCode || entry.subject_code || '').trim().slice(0, 80),
      subject: String(entry.subject || '').trim().slice(0, 180),
      sourceGroup: String(entry.group || entry.grade || entry.className || '').trim().slice(0, 160),
      type: String(entry.type || 'teaching').trim().slice(0, 40),
      confidence: String(entry.confidence || 'review').trim().slice(0, 20),
      rawText: String(entry.rawText || '').trim().slice(0, 500)
    };
  }).filter(entry => entry.dow >= 1 && entry.dow <= 5 && entry.period && entry.subject);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed');
  if (!requestOriginIsValid(req)) return fail(res, 403, 'invalid_origin');
  if (!process.env.OPENROUTER_API_KEY) return fail(res, 503, 'openrouter_not_configured', 'ตั้งค่า OPENROUTER_API_KEY ใน Vercel ก่อน');

  try {
    if (!(await verifySupabaseSession(req))) return fail(res, 401, 'authentication_required');
  } catch (error) {
    return fail(res, 503, 'authentication_unavailable', error.message);
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const image = String(body.image || '');
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image)) return fail(res, 400, 'invalid_image');
  if (image.length > MAX_IMAGE_CHARS) return fail(res, 413, 'image_too_large', 'ลดขนาดรูปก่อนอัปโหลด');

  const model = process.env.OPENROUTER_VISION_MODEL || 'openrouter/free';
  const prompt = `คุณเป็นผู้ช่วยจัดข้อมูลตารางสอนภาษาไทยจากภาพเอกสาร
อ่านข้อความในตาราง แล้วส่ง JSON เท่านั้นตาม schema นี้:
{"entries":[{"day_of_week":1,"period":1,"subject_code":"ค23102","subject":"คณิตศาสตร์","group":"ม.3","type":"teaching","confidence":"high","raw_text":"ข้อความในช่อง"}]}

กติกา:
- ตารางมีวันจันทร์ถึงศุกร์ และคาบ 1-9; ใช้ day_of_week 1-5
- อ่านเฉพาะข้อมูลภายในช่องตาราง ไม่เอาชื่อเอกสาร หัวตาราง ลายเซ็น หรือวันที่เริ่มใช้
- ไม่ต้องใส่ Homeroom เว้นแต่เป็นวิชาหลักที่มีข้อมูลชัดเจน
- ห้ามเดาห้องย่อย เช่น ม.3 ห้ามเปลี่ยนเป็น ม.3/1; เก็บไว้ใน group ตามที่เห็น
- แยกรหัสวิชา ชื่อวิชา และระดับ/กลุ่มเรียนให้ชัดเจน
- กิจกรรม เช่น แนะแนว ลูกเสือ ชุมนุม ใส่ type เป็น activity
- ถ้าอ่านไม่ชัด ให้เก็บข้อความที่เห็นและตั้ง confidence เป็น review
- ห้ามสร้างข้อมูลที่ไม่มีในภาพ และห้ามใส่ markdown นอก JSON`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://classkru-kohl.vercel.app',
      'X-OpenRouter-Title': process.env.OPENROUTER_SITE_NAME || 'ClassKru'
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 5000,
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: image } }
      ] }]
    })
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 800);
    return fail(res, response.status === 429 ? 429 : 502, 'openrouter_request_failed', detail);
  }
  const result = await response.json();
  try {
    const parsed = parseJsonContent(result?.choices?.[0]?.message?.content);
    return sendJson(res, 200, { model, entries: normalizeEntries(parsed) });
  } catch (error) {
    return fail(res, 502, 'invalid_ai_output', error.message);
  }
};
