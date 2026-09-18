'use strict';

const { normalize } = require('../../js/worksheet-layout');
const { sendJson, parseBody, requestOriginIsValid } = require('../_lib/http');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dzntiiuyqvkaxqpqzxeh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_SePLBF-dsJfx5T6Yvvcuew_vntSr3Vc';
function clean(value, max = 1400) { return String(value || '').trim().slice(0, max); }
function asList(value, maxItems = 12) { return (Array.isArray(value) ? value : []).map(item => clean(item, 1200)).filter(Boolean).slice(0, maxItems); }
function parseJson(text) { return JSON.parse(String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')); }
async function authenticatedUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers:{ apikey:SUPABASE_PUBLISHABLE_KEY, Authorization:`Bearer ${token}` } });
  return response.ok ? response.json() : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error:'method_not_allowed' });
  if (!requestOriginIsValid(req)) return sendJson(res, 403, { error:'invalid_origin' });
  if (!process.env.OPENROUTER_API_KEY) return sendJson(res, 503, { error:'ai_not_configured', message:'ยังไม่ได้ตั้งค่า OPENROUTER_API_KEY' });
  try {
    const user = await authenticatedUser(req);
    if (!user?.id) return sendJson(res, 401, { error:'authentication_required', message:'กรุณาเข้าสู่ระบบใหม่ก่อนใช้งาน AI' });
    const body = parseBody(req); const title = clean(body.title, 240);
    const indicators = Array.isArray(body.indicators) ? body.indicators.slice(0, 12).map(item => `${clean(item.code,80)}: ${clean(item.text,800)}`).filter(Boolean) : [];
    if (title.length < 3 || !indicators.length) return sendJson(res, 400, { error:'invalid_request', message:'กรุณาระบุชื่อใบงานและตัวชี้วัดอย่างน้อย 1 ข้อ' });
    const format = clean(body.worksheetTypeLabel || body.worksheetType, 120);
    const formatRules = { 'เติมคำ / ตอบคำถาม':'เน้นคำถามสั้น เติมคำ จับคู่ หรือคำตอบอธิบายสั้น ๆ ไม่ต้องสร้างขั้นตอนทดลอง', 'ตาราง / จำแนกข้อมูล':'เน้นรายการ ตาราง ตัวเลือก การทำเครื่องหมาย การจับคู่ หรือการจัดกลุ่มที่นักเรียนต้องเติมหรือวิเคราะห์', 'ทดลอง / สำรวจ / บันทึกผล':'ต้องมีคำถามนำ อุปกรณ์ ขั้นตอน ตารางบันทึกผล ช่องจดข้อสังเกต คำถามวิเคราะห์ และสรุปผล โดยเว้นช่องให้บันทึกข้อมูลจริง' }[format] || 'เลือกโครงสร้างใบงานที่เหมาะกับหัวข้อและเวลา โดยเน้นกิจกรรมที่นักเรียนต้องลงมือทำ';
    const workMode = { individual:'รายบุคคล', pair:'ทำงานเป็นคู่', group:'ทำงานเป็นกลุ่ม' }[clean(body.workMode,40)] || 'รายบุคคล';
    const difficulty = { easy:'พื้นฐาน', medium:'ปานกลาง', hard:'ท้าทาย' }[clean(body.difficulty,40)] || 'ปานกลาง';
    const visuals = 'ใช้ข้อความและตารางเท่านั้น รุ่นนี้ยังไม่รองรับภาพ';
    const answerSpace = { short:'สั้น กระชับ', medium:'พอดี', long:'มีพื้นที่ให้อธิบาย' }[clean(body.answerSpace,40)] || 'พอดี';
    const answerKey = clean(body.answerKey,40) === 'no' ? 'ไม่ต้องสร้างเฉลย' : 'สร้างเฉลยสำหรับครูด้วย';
    const rules = 'สร้างใบงานภาษาไทยที่พร้อมพิมพ์และครูนำไปปรับใช้ได้จริง ไม่ใช่แผนการสอนหรือคำอธิบายการสอน ห้ามสร้างผลคะแนนหรือข้อมูลนักเรียน ห้ามอ้างว่าเป็นเอกสารทางการ ทุกส่วนต้องสัมพันธ์กับตัวชี้วัด เวลา และทรัพยากรที่ให้มา หากข้อมูลไม่พอให้เสนอเป็นข้อควรตรวจสอบ และต้องไม่ยัดหัวข้อที่ไม่จำเป็นลงในใบงาน';
    const prompt = `จัดทำร่างใบงานสำหรับครูไทยจากกรอบที่ได้รับเท่านั้น
- วิชา: ${clean(body.subject,160)}
- ระดับชั้น: ${clean(body.grade,80)}
- หัวข้อ/ชื่อใบงาน: ${title}
- รูปแบบใบงาน: ${format}
- หลักการของรูปแบบนี้: ${formatRules}
- ประเภทกิจกรรม: ${clean(body.activityType,120)}
- เวลา: ${clean(body.duration,80)}
- รูปแบบการทำงาน: ${workMode}
- จำนวนกิจกรรม/ข้อ: ${clean(body.itemCount,40) || '8'}
- ระดับความยาก: ${difficulty}
- ภาพหรือสื่อประกอบ: ${visuals}
- พื้นที่คำตอบ: ${answerSpace}
- เฉลยสำหรับครู: ${answerKey}
- สิ่งที่อยากให้นักเรียนทำหรือส่ง: ${clean(body.learnerOutput,1200) || 'ไม่ระบุ'}
- อุปกรณ์หรือข้อจำกัด: ${clean(body.resources,1000) || 'ไม่ระบุ'}
- สิ่งที่ครูอยากเน้น: ${clean(body.focus,1000) || 'ไม่ระบุ'}
ตัวชี้วัดที่เลือกไว้:\n${indicators.map(item => `- ${item}`).join('\n')}

สร้างกิจกรรมจริงให้เด็กทำได้จากเอกสารนี้ทันที มีข้อมูล ตัวเลข หรือข้อความโจทย์ครบ ห้ามอ้างภาพ ตาราง หรือเอกสารที่ไม่ได้แนบ ห้ามบอกเพียงว่า "สร้างตาราง" หรือ "ดูภาพ"
ใช้บล็อก question สำหรับโจทย์หนึ่งข้อ หรือ table สำหรับตาราง 2–4 คอลัมน์ มีข้อมูลโจทย์ในแถวและใช้ null เป็นช่องคำตอบที่นักเรียนต้องเติม ห้ามเติมเฉลยในช่อง null
จำนวนข้อรวมต้องเท่ากับจำนวนที่เลือก: question นับ 1 ข้อ, table นับจำนวนแถว ไม่ต้องแยกบล็อกสำหรับคำชี้แจง
แบบตารางและแบบสำรวจต้องมี table อย่างน้อยหนึ่งบล็อก แบบสำรวจห้ามแต่งผลสังเกต ให้ช่องบันทึกผลเป็น null
answer เป็นเฉลย/แนวทางตรวจสำหรับครูแยกต่างหาก ระบุเลขแถวให้ตรงกัน สำหรับกิจกรรมจริงให้แนวทางประเมินไม่แต่งผลทดลอง หากไม่ขอเฉลยให้เป็นข้อความว่าง
คำชี้แจงรวมสั้นไม่เกิน 3 ข้อ ไม่ต้องใส่หัวข้อรายงานหรือขั้นตอนการสอน
ตอบ JSON ล้วน ห้ามมี markdown ตาม schema นี้:
{"worksheet":{"title":"...","directions":["..."],"blocks":[{"type":"table","title":"จำแนกข้อมูล","instruction":"โจทย์ที่มีข้อมูลครบ","columns":["ข้อมูล","คำตอบ","เหตุผล"],"rows":[["ข้อมูลข้อแรก",null,null]],"answer":"แถว 1: เฉลยและเหตุผล"},{"type":"question","title":"อธิบาย","instruction":"คำถามจริง","answer":"แนวคำตอบ"}]},"warnings":[]}`;
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method:'POST', headers:{ Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type':'application/json', 'HTTP-Referer':process.env.APP_URL || 'https://classkru-kohl.vercel.app', 'X-Title':'ClassKru' }, body:JSON.stringify({ model:process.env.OPENROUTER_MODEL || 'qwen/qwen3-30b-a3b-instruct-2507', temperature:0.25, max_tokens:5000, messages:[{ role:'system', content:rules }, { role:'user', content:prompt }] }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return sendJson(res, 502, { error:'generation_failed', message:'AI ยังสร้างใบงานไม่ได้ กรุณาลองใหม่อีกครั้ง' });
    let raw; try { raw = parseJson(payload?.choices?.[0]?.message?.content); } catch (_) { return sendJson(res, 502, { error:'invalid_ai_response', message:'AI ส่งรูปแบบใบงานไม่ถูกต้อง กรุณาลองใหม่' }); }
    let worksheet;
    try { worksheet = normalize(raw?.worksheet || raw, { ...body, itemCount:[4,6,8,10].includes(Number(body.itemCount)) ? Number(body.itemCount) : 8 }); }
    catch (error) { return sendJson(res, 502, { error:'invalid_worksheet', message:`ร่างใบงานยังไม่ผ่านการตรวจ: ${error.message} กรุณาลองสร้างใหม่` }); }
    if (!worksheet.title || !worksheet.directions.length) return sendJson(res, 502, { error:'empty_ai_response', message:'ใบงานขาดชื่อหรือคำชี้แจง' });
    return sendJson(res, 200, { worksheet, warnings:asList(raw?.warnings, 8) });
  } catch (error) { console.error('Worksheet generation error:', error); return sendJson(res, 500, { error:'server_error', message:'เกิดข้อผิดพลาดขณะสร้างใบงาน' }); }
};
