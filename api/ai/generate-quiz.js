'use strict';

const { sendJson, parseBody, requestOriginIsValid } = require('../_lib/http');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dzntiiuyqvkaxqpqzxeh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_SePLBF-dsJfx5T6Yvvcuew_vntSr3Vc';
const MAX_SOURCE_LENGTH = 12000;
const ALLOWED_TYPES = new Set(['multiple_choice', 'true_false', 'short_answer']);

function clean(value, max = 1000) { return String(value || '').trim().slice(0, max); }
function mentionsUnavailableVisual(prompt) {
  return /(จากภาพ|จากรูป|ในภาพ|ในรูป|รูปภาพ|แผนภาพ|กราฟ|ตารางต่อไปนี้|ภาพที่กำหนด|รูปที่กำหนด)/i.test(String(prompt || ''));
}
function questionsFromText(text) {
  const stripped = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(stripped);
  return Array.isArray(parsed) ? parsed : parsed.questions;
}
async function authenticatedUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  return response.json();
}
function normalizeQuestion(value, allowedTypes) {
  const type = ALLOWED_TYPES.has(value?.type) && allowedTypes.includes(value.type) ? value.type : allowedTypes[0] || 'multiple_choice';
  const question = { type, prompt: clean(value?.prompt, 1200), explanation: clean(value?.explanation, 900) };
  if (!question.prompt) return null;
  if (mentionsUnavailableVisual(question.prompt)) return null;
  if (type === 'multiple_choice') {
    const options = Array.isArray(value?.options) ? value.options.map(option => clean(option, 400)).filter(Boolean).slice(0, 4) : [];
    if (options.length !== 4) return null;
    if (new Set(options.map(option => option.toLowerCase())).size !== options.length) return null;
    question.options = options;
    const answerIndex = Number(value?.answerIndex);
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) return null;
    question.answerIndex = answerIndex;
  } else if (type === 'true_false') {
    question.answer = clean(value?.answer, 20) === 'ผิด' ? 'ผิด' : 'ถูก';
  } else {
    question.answer = clean(value?.answer, 800);
  }
  return question;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
  if (!requestOriginIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });
  if (!process.env.OPENROUTER_API_KEY) return sendJson(res, 503, { error: 'ai_not_configured', message: 'ยังไม่ได้ตั้งค่า OPENROUTER_API_KEY' });
  try {
    const user = await authenticatedUser(req);
    if (!user?.id) return sendJson(res, 401, { error: 'authentication_required', message: 'กรุณาเข้าสู่ระบบใหม่ก่อนใช้งาน AI' });
    const body = parseBody(req);
    const source = clean(body.source, MAX_SOURCE_LENGTH);
    const requestedQuestionCount = body.questionCount === undefined || body.questionCount === null || body.questionCount === '' ? 10 : Number(body.questionCount);
    if (!Number.isInteger(requestedQuestionCount) || requestedQuestionCount < 1 || requestedQuestionCount > 30) return sendJson(res, 400, { error:'invalid_question_count', message:'จำนวนข้อสอบต้องเป็นจำนวนเต็ม 1–30 ข้อ' });
    const questionCount = requestedQuestionCount;
    const types = Array.isArray(body.types) ? body.types.filter(type => ALLOWED_TYPES.has(type)) : [];
    if (source.length < 3 || !types.length) return sendJson(res, 400, { error: 'invalid_request', message: 'กรุณาระบุเนื้อหาและประเภทคำถาม' });

    const indicators = Array.isArray(body.indicators) ? body.indicators.slice(0, 18).map(item => `${clean(item.code,80)}: ${clean(item.text,800)}`).filter(Boolean) : [];
    const qualityRules = 'กติกาคุณภาพ: ห้ามสร้างโจทย์ที่อ้างถึงรูปภาพ กราฟ แผนภาพ หรือตาราง เพราะระบบส่งให้เฉพาะข้อความ ไม่มีภาพประกอบ; ตัวเลือกปรนัยต้องแตกต่างกันทั้ง 4 ตัวเลือกและมีคำตอบถูกเพียงข้อเดียว; ตรวจเลข เศษส่วน หน่วย และการคำนวณซ้ำก่อนกำหนด answerIndex; ทุกคำถามต้องตอบได้จากแหล่งข้อมูลที่ให้มาเท่านั้น; ทุกข้อ ต้องมี explanation เป็นคำอธิบายเฉลยสั้น ๆ สำหรับครู โดยพิจารณาจากลักษณะของข้อนั้น ไม่ใช่ชื่อวิชาอย่างเดียว: ถ้ามีการคำนวณให้แสดงสูตรหรือหลักที่ใช้ การแทนค่า/ขั้นคำนวณสำคัญ และคำตอบพร้อมหน่วย; ถ้าเป็นโจทย์แนวคิดหรือบรรยายให้อธิบายหลักการ เหตุผล หรือหลักฐานจากโจทย์ที่ทำให้คำตอบถูก; ถ้าเป็นโจทย์ผสมให้อธิบายทั้งวิธีคำนวณและเหตุผล; ถ้าเป็นภาษาให้ชี้กฎภาษา ความหมาย หรือหลักฐานในข้อความตามโจทย์; ห้ามแต่งข้อมูลที่ไม่มีในแหล่งอ้างอิง และไม่ต้องเขียนกระบวนการคิดยาวเกินจำเป็น';
    const prompt = `คุณเป็นผู้ช่วยครูไทย สร้างข้อสอบภาษาไทยจากขอบเขตที่ได้รับเท่านั้น ห้ามแต่งข้อเท็จจริงหรือเนื้อหานอกแหล่งข้อมูล ถ้าข้อมูลไม่พอให้ตั้งคำถามเชิงความเข้าใจจากสิ่งที่มีอยู่ และให้ครูตรวจทานเสมอ\n\nบริบทห้องเรียน\n- วิชา: ${clean(body.subject, 160)}\n- ระดับชั้น: ${clean(body.grade, 80)}\n- ระดับความยาก: ${clean(body.difficulty, 40)}\n- คำสั่งเพิ่มเติม: ${clean(body.instructions, 1200) || 'ไม่มี'}\n- ตัวชี้วัดที่เลือก:\n${indicators.length ? indicators.map(item => `  - ${item}`).join('\n') : '  - ไม่ระบุ'}\n\nแหล่งข้อมูล (${clean(body.sourceType, 20)}):\n${source}\n\nสร้าง ${questionCount} ข้อ ใช้ประเภทคำถามเฉพาะ: ${types.join(', ')}\n\nตอบกลับเป็น JSON ล้วน ห้ามมี markdown หรือคำอธิบายนอก JSON ตาม schema นี้:\n{"questions":[{"type":"multiple_choice","prompt":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"..."},{"type":"true_false","prompt":"...","answer":"ถูก","explanation":"..."},{"type":"short_answer","prompt":"...","answer":"...","explanation":"..."}]}`;
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': process.env.APP_URL || 'https://classkru-kohl.vercel.app', 'X-Title': 'ClassKru' },
      body: JSON.stringify({ model: process.env.OPENROUTER_MODEL || 'qwen/qwen3-30b-a3b-instruct-2507', temperature: 0.25, max_tokens: questionCount > 15 ? 9000 : 4500, messages: [{ role:'system', content:qualityRules }, { role:'user', content:prompt }] })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn('OpenRouter generation failed', response.status, payload?.error?.message || payload);
      return sendJson(res, 502, { error: 'generation_failed', message: 'AI ยังสร้างข้อสอบไม่ได้ กรุณาลองใหม่อีกครั้ง' });
    }
    const content = payload?.choices?.[0]?.message?.content;
    let rows = [];
    try { rows = questionsFromText(content); } catch (_) { return sendJson(res, 502, { error: 'invalid_ai_response', message: 'AI ส่งรูปแบบข้อสอบไม่ถูกต้อง กรุณาลองใหม่' }); }
    const rawRows = Array.isArray(rows) ? rows : [];
    const questions = rawRows.map(item => normalizeQuestion(item, types)).filter(Boolean).slice(0, questionCount);
    if (!questions.length) return sendJson(res, 502, { error: 'empty_ai_response', message: 'AI ยังไม่สามารถสร้างข้อสอบที่ผ่านการตรวจเบื้องต้นจากข้อมูลนี้ได้ กรุณาเพิ่มเนื้อหาให้ชัดเจนขึ้น' });
    const warnings = questions.length < questionCount ? [`AI ส่งข้อสอบมา ${rawRows.length} ข้อ แต่ผ่านการตรวจเบื้องต้น ${questions.length} ข้อ ระบบตัดข้อที่อ้างถึงภาพ/ข้อมูลไม่ครบ/ตัวเลือกซ้ำออกแล้ว`] : [];
    return sendJson(res, 200, { questions, warnings });
  } catch (error) {
    console.error('Quiz generation error:', error);
    return sendJson(res, 500, { error: 'server_error', message: 'เกิดข้อผิดพลาดขณะสร้างข้อสอบ' });
  }
};
