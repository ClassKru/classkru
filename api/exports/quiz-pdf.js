'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { sendJson, parseBody, requestOriginIsValid } = require('../_lib/http');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dzntiiuyqvkaxqpqzxeh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_SePLBF-dsJfx5T6Yvvcuew_vntSr3Vc';
const clean = (value, max = 3000) => String(value || '').trim().slice(0, max);
const regularFontPath = path.join(process.cwd(), 'assets', 'fonts', 'Sarabun-Regular.ttf');
const boldFontPath = path.join(process.cwd(), 'assets', 'fonts', 'Sarabun-Bold.ttf');

async function authenticatedUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
  return response.ok ? response.json() : null;
}
function answerText(question) {
  if (question.type === 'multiple_choice') return question.options?.[Number(question.answerIndex)] || 'ไม่ระบุ';
  return clean(question.answer, 1000) || 'ไม่ระบุ';
}
function createPdf(quiz, questions, indicators) {
  const document = new PDFDocument({ size: 'A4', margins: { top: 54, right: 54, bottom: 54, left: 54 }, info: { Title: clean(quiz.title, 180) } });
  document.registerFont('Sarabun', fs.readFileSync(regularFontPath));
  document.registerFont('Sarabun-Bold', fs.readFileSync(boldFontPath));
  const width = document.page.width - document.page.margins.left - document.page.margins.right;
  const addText = (text, { bold = false, size = 14, indent = 0, gap = 7 } = {}) => {
    document.font(bold ? 'Sarabun-Bold' : 'Sarabun').fontSize(size).fillColor('#172033');
    document.text(clean(text), document.page.margins.left + indent, document.y, { width: width - indent, lineGap: 2 });
    document.moveDown(gap / size);
  };
  const header = () => {
    document.font('Sarabun-Bold').fontSize(18).fillColor('#172033').text(clean(quiz.title, 180), { align: 'center' });
    document.moveDown(.25);
    document.font('Sarabun').fontSize(14).text(clean(quiz.classLabel, 220), { align: 'center' });
    document.moveDown(.5);
    addText('ชื่อ-สกุล ............................................................................... ชั้น ............... เลขที่ ...............', { gap: 8 });
    addText(`คำชี้แจง: ${quiz.mode === 'practice' ? 'ทำแบบฝึกหัดให้ครบทุกข้อ' : 'ทำแบบทดสอบให้ครบทุกข้อ'}`, { gap: 4 });
    if (indicators.length) addText(`ตัวชี้วัดที่เกี่ยวข้อง: ${indicators.join(', ')}`, { gap: 7 });
    document.strokeColor('#cbd5e1').lineWidth(1).moveTo(document.page.margins.left, document.y).lineTo(document.page.width - document.page.margins.right, document.y).stroke();
    document.moveDown(.65);
  };
  const questionsPage = (withAnswers) => {
    questions.forEach((question, index) => {
      const prompt = `${index + 1}. ${clean(question.prompt, 1400)}`;
      const estimatedHeight = document.heightOfString(prompt, { width }) + (question.type === 'multiple_choice' ? 100 : 48);
      if (document.y + estimatedHeight > document.page.height - document.page.margins.bottom) document.addPage();
      addText(prompt, { bold: true, gap: 4 });
      if (question.type === 'multiple_choice') {
        const labels = ['ก.', 'ข.', 'ค.', 'ง.'];
        (Array.isArray(question.options) ? question.options.slice(0, 4) : []).forEach((option, optionIndex) => addText(`${labels[optionIndex]} ${clean(option, 500)}`, { indent: 24, gap: 2 }));
      } else if (question.type === 'short_answer' && !withAnswers) {
        document.strokeColor('#94a3b8').lineWidth(.6).moveTo(document.page.margins.left, document.y + 12).lineTo(document.page.width - document.page.margins.right, document.y + 12).stroke();
        document.moveDown(1.1);
      }
      if (withAnswers) {
        addText(`เฉลย: ${answerText(question)}`, { bold: true, indent: 12, gap: 2 });
        if (question.explanation) addText(`คำอธิบาย: ${clean(question.explanation, 1200)}`, { indent: 12, gap: 4 });
      }
      document.moveDown(.25);
    });
  };
  header();
  questionsPage(false);
  document.addPage();
  document.font('Sarabun-Bold').fontSize(18).fillColor('#172033').text('เฉลย', { align: 'center' });
  document.moveDown(.75);
  questionsPage(true);
  return document;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
  if (!requestOriginIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });
  try {
    const user = await authenticatedUser(req);
    if (!user?.id) return sendJson(res, 401, { error: 'authentication_required', message: 'กรุณาเข้าสู่ระบบใหม่ก่อนส่งออกเอกสาร' });
    const quiz = parseBody(req).quiz || {};
    const questions = Array.isArray(quiz.questions) ? quiz.questions.slice(0, 60) : [];
    const title = clean(quiz.title, 180);
    if (!title || !questions.length) return sendJson(res, 400, { error: 'invalid_quiz', message: 'ไม่พบข้อมูลข้อสอบสำหรับส่งออก' });
    const indicators = Array.isArray(quiz.indicators) ? quiz.indicators.slice(0, 18).map(item => clean(item.code, 100)).filter(Boolean) : [];
    const document = createPdf(quiz, questions, indicators);
    const chunks = [];
    const buffer = await new Promise((resolve, reject) => {
      document.on('data', chunk => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
      document.end();
    });
    const fileName = encodeURIComponent(`${title}.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="quiz.pdf"; filename*=UTF-8''${fileName}`);
    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).send(buffer);
  } catch (error) {
    console.error('Quiz pdf export error:', error);
    return sendJson(res, 500, { error: 'export_failed', message: 'เกิดข้อผิดพลาดขณะสร้างไฟล์ PDF' });
  }
};
