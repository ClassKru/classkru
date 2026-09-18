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
    const formatId = clean(body.worksheetType, 40);
    const format = clean(body.worksheetTypeLabel || formatId, 120);
    const formatSpec = {
      questions: { rule:'สร้าง question เท่านั้น แต่ละ question คือ 1 ข้อ ไม่สร้าง table และไม่สร้างขั้นตอนการทดลอง', example:'{"type":"question","title":"คำถามที่ 1","instruction":"โจทย์ที่มีข้อมูลครบ","answer":"แนวคำตอบ"}' },
      table: { rule:'สร้าง table เพียง 1 บล็อกเท่านั้น จำนวนแถวต้องเท่ากับจำนวนข้อที่เลือก ทุกแถวต้องมีข้อมูลโจทย์และ null เป็นช่องให้นักเรียนเติม', example:'{"type":"table","title":"จำแนกข้อมูล","instruction":"คำสั่งที่มีข้อมูลครบ","columns":["ข้อมูล","คำตอบ"],"rows":[["ข้อมูลข้อแรก",null]],"answer":"แถว 1: แนวคำตอบ"}' },
      inquiry: { rule:'สร้าง table เพียง 1 บล็อกเท่านั้น จำนวนแถวต้องเท่ากับจำนวนข้อที่เลือก ใช้บันทึกการสังเกตจริง ห้ามแต่งผลการทดลองและห้ามสร้างคำถามเพิ่ม', example:'{"type":"table","title":"บันทึกผลการสำรวจ","instruction":"อุปกรณ์และขั้นตอนที่ทำได้จริง","columns":["สิ่งที่สังเกต","ผลที่บันทึก"],"rows":[["รายการที่ 1",null]],"answer":"แนวทางตรวจ: ตรวจว่าบันทึกจากหลักฐานจริง"}' }
    }[formatId] || null;
    if (!formatSpec) return sendJson(res, 400, { error:'invalid_worksheet_type', message:'กรุณาเลือกแม่แบบใบงานที่ระบบรองรับ' });
    const workMode = { individual:'รายบุคคล', pair:'ทำงานเป็นคู่', group:'ทำงานเป็นกลุ่ม' }[clean(body.workMode,40)] || 'รายบุคคล';
    const difficulty = { easy:'พื้นฐาน', medium:'ปานกลาง', hard:'ท้าทาย' }[clean(body.difficulty,40)] || 'ปานกลาง';
    const visuals = 'ใช้ข้อความและตารางเท่านั้น รุ่นนี้ยังไม่รองรับภาพ';
    const answerSpace = { short:'สั้น กระชับ', medium:'พอดี', long:'มีพื้นที่ให้อธิบาย' }[clean(body.answerSpace,40)] || 'พอดี';
    const answerKey = clean(body.answerKey,40) === 'no' ? 'ไม่ต้องสร้างเฉลย' : 'สร้างเฉลยสำหรับครูด้วย';
    const rules = 'ตอบตามแม่แบบที่ผู้ใช้เลือกเท่านั้น สร้างใบงานภาษาไทยที่พร้อมพิมพ์ ไม่สร้างแผนการสอน ไม่เลือกแม่แบบใหม่ และไม่เพิ่มส่วนที่ไม่ได้ขอ';
    const prompt = `จัดทำร่างใบงานสำหรับครูไทยจากกรอบที่ได้รับเท่านั้น
- วิชา: ${clean(body.subject,160)}
- ระดับชั้น: ${clean(body.grade,80)}
- หัวข้อ/ชื่อใบงาน: ${title}
- รูปแบบใบงาน: ${format}
- คำสั่งเฉพาะแม่แบบนี้: ${formatSpec.rule}
- ประเภทกิจกรรม: ${clean(body.activityType,120)}
- เวลา: ${clean(body.duration,80)}
- รูปแบบการทำงาน: ${workMode}
- จำนวนข้อ/แถวที่นักเรียนต้องทำรวมทั้งหมด: ${clean(body.itemCount,40) || '8'}
- ระดับความยาก: ${difficulty}
- ภาพหรือสื่อประกอบ: ${visuals}
- พื้นที่คำตอบ: ${answerSpace}
- เฉลยสำหรับครู: ${answerKey}
- สิ่งที่อยากให้นักเรียนทำหรือส่ง: ${clean(body.learnerOutput,1200) || 'ไม่ระบุ'}
- อุปกรณ์หรือข้อจำกัด: ${clean(body.resources,1000) || 'ไม่ระบุ'}
- สิ่งที่ครูอยากเน้น: ${clean(body.focus,1000) || 'ไม่ระบุ'}
ตัวชี้วัดที่เลือกไว้:\n${indicators.map(item => `- ${item}`).join('\n')}

ทำตามคำสั่งแม่แบบด้านบนเท่านั้น สร้างโจทย์จริงที่นักเรียนทำได้ทันที มีข้อมูล ตัวเลข หรือข้อความครบ ห้ามอ้างภาพหรือเอกสารที่ไม่ได้แนบ ห้ามบอกเพียงว่า "สร้างตาราง"
จำนวนข้อ/แถวที่นักเรียนต้องทำต้องเท่ากับจำนวนที่เลือกแบบพอดี: question นับ 1 ข้อ, table นับจำนวนแถว คำชี้แจงไม่ถูกนับเป็นข้อ
answer เป็นเฉลย/แนวทางตรวจสำหรับครูแยกต่างหาก ระบุเลขแถวให้ตรงกัน สำหรับกิจกรรมจริงให้แนวทางประเมินไม่แต่งผลทดลอง หากไม่ขอเฉลยให้เป็นข้อความว่าง
คำชี้แจงรวมสั้นไม่เกิน 3 ข้อ ไม่ต้องใส่หัวข้อรายงานหรือขั้นตอนการสอน
ตรวจนับก่อนตอบ JSON หากจำนวนไม่ตรงให้ปรับจำนวนแถวหรือจำนวน question จนตรงก่อน ห้ามส่งคำตอบที่จำนวนไม่ตรง
ตอบ JSON ล้วน ห้ามมี markdown และใช้โครงสร้างนี้เท่านั้น:
{"worksheet":{"title":"...","directions":["คำชี้แจงสั้น ๆ"],"blocks":[${formatSpec.example}]},"warnings":[]}`;
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method:'POST', headers:{ Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type':'application/json', 'HTTP-Referer':process.env.APP_URL || 'https://classkru-kohl.vercel.app', 'X-Title':'ClassKru' }, body:JSON.stringify({ model:process.env.OPENROUTER_MODEL || 'qwen/qwen3-30b-a3b-instruct-2507', temperature:0.25, max_tokens:5000, messages:[{ role:'system', content:rules }, { role:'user', content:prompt }] }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return sendJson(res, 502, { error:'generation_failed', message:'AI ยังสร้างใบงานไม่ได้ กรุณาลองใหม่อีกครั้ง' });
    let raw; try { raw = parseJson(payload?.choices?.[0]?.message?.content); } catch (_) { return sendJson(res, 502, { error:'invalid_ai_response', message:'AI ส่งรูปแบบใบงานไม่ถูกต้อง กรุณาลองใหม่' }); }
    let worksheet;
    const requestedItemCount = Number(body.itemCount);
    try { worksheet = normalize(raw?.worksheet || raw, { ...body, itemCount:Number.isInteger(requestedItemCount) && requestedItemCount >= 1 && requestedItemCount <= 10 ? requestedItemCount : 8 }); }
    catch (error) { return sendJson(res, 502, { error:'invalid_worksheet', message:`ร่างใบงานยังไม่ผ่านการตรวจ: ${error.message} กรุณาลองสร้างใหม่` }); }
    if (!worksheet.title || !worksheet.directions.length) return sendJson(res, 502, { error:'empty_ai_response', message:'ใบงานขาดชื่อหรือคำชี้แจง' });
    return sendJson(res, 200, { worksheet, warnings:asList(raw?.warnings, 8) });
  } catch (error) { console.error('Worksheet generation error:', error); return sendJson(res, 500, { error:'server_error', message:'เกิดข้อผิดพลาดขณะสร้างใบงาน' }); }
};
