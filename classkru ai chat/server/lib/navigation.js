'use strict';

const registry = require('../../assets/classkru-ai-actions.json');
const byId = new Map(registry.map(entry => [entry.id, entry]));

function cleanHistory(value) {
  return (Array.isArray(value) ? value : []).slice(-8).map(turn => ({
    role: turn?.role === 'assistant' ? 'assistant' : 'user',
    content: String(turn?.content || '').slice(0, 800)
  })).filter(turn => turn.content);
}

function validateAnswer(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_ai_response');
  const reply = String(value.reply || '').trim().slice(0, 1500);
  if (!reply) throw new Error('invalid_ai_response');
  if (value.action == null) return { reply, action: null };
  const action = value.action;
  if (!action || action.type !== 'navigate' || !byId.has(action.target)) throw new Error('action_not_allowed');
  return { reply, action: { type: 'navigate', target: action.target, highlight: action.highlight === true } };
}

function mockReply(message, context = {}) {
  const text = String(message).toLowerCase();
  const hasClass = Boolean(context.selectedClassId);
  if (/เช็กชื่อ|เช็คชื่อ|ลงเวลา/.test(text)) return {
    reply: hasClass ? 'จะพาไปหน้าเช็กชื่อของห้องที่เลือก โดยยังไม่บันทึกการเช็กชื่อให้นะคะ' : 'ไปที่ห้องเรียนของฉันก่อน แล้วเลือกห้องที่ต้องการเช็กชื่อค่ะ',
    action: { type: 'navigate', target: hasClass ? 'checkin' : 'classrooms', highlight: true }
  };
  if (/สร้างรายวิชา|เพิ่มรายวิชา|สร้างห้อง|เพิ่มห้อง/.test(text)) return {
    reply: 'เปิดหน้าห้องเรียนแล้วค่ะ กดปุ่ม “เพิ่มห้องเรียน” เพื่อสร้างรายวิชาของคุณ',
    action: { type: 'navigate', target: 'add_class', highlight: true }
  };
  if (/เพิ่มนักเรียน|รายชื่อนักเรียน/.test(text)) return {
    reply: hasClass ? 'เปิดรายชื่อนักเรียนแล้วค่ะ กดปุ่ม “เพิ่มนักเรียน” เพื่อกรอกข้อมูลด้วยตัวเอง' : 'เลือกห้องเรียนก่อนค่ะ แล้วจึงเปิดรายชื่อนักเรียนเพื่อเพิ่มนักเรียน',
    action: { type: 'navigate', target: hasClass ? 'add_student' : 'classrooms', highlight: true }
  };
  const destinations = [
    [/ตารางสอน/, 'timetable'], [/คะแนน/, 'scores'], [/รายงาน/, 'reports'],
    [/คลังสื่อ|สื่อการสอน/, 'library'], [/ตัวชี้วัด/, 'curriculum'],
    [/เครื่องมือ/, 'tools'], [/เกม/, 'games'], [/ตั้งค่า/, 'settings'], [/ช่วยเหลือ|คู่มือ/, 'help'], [/หน้าหลัก/, 'dashboard']
  ];
  const destination = destinations.find(([pattern]) => pattern.test(text));
  if (destination) {
    const entry = byId.get(destination[1]);
    if (entry.requiresClass && !hasClass) return { reply: `เลือกห้องเรียนก่อนเข้า${entry.label}ค่ะ`, action: { type: 'navigate', target: 'classrooms', highlight: true } };
    return { reply: `จะพาไป${entry.label}ค่ะ`, action: { type: 'navigate', target: entry.id, highlight: true } };
  }
  return { reply: 'ClassKru ช่วยจัดการห้องเรียน เช็กชื่อ ตารางสอน คะแนน รายงาน และสื่อการสอนได้ค่ะ บอกได้เลยว่าอยากไปหน้าหรือทำขั้นตอนไหน แล้วฉันจะช่วยชี้ทางให้', action: null };
}

module.exports = { registry, cleanHistory, validateAnswer, mockReply };
