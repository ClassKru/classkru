'use strict';

const { Document, Packer, Paragraph, TextRun, PageBreak, AlignmentType } = require('docx');
const { sendJson, parseBody, requestOriginIsValid } = require('../_lib/http');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dzntiiuyqvkaxqpqzxeh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_SePLBF-dsJfx5T6Yvvcuew_vntSr3Vc';
const clean = (value, max = 3000) => String(value || '').trim().slice(0, max);

async function authenticatedUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
  return response.ok ? response.json() : null;
}
function paragraph(text, options = {}) {
  return new Paragraph({ ...options, children: [new TextRun({ text: clean(text), font: 'TH SarabunPSK', size: options.size || 24, bold: Boolean(options.bold) })] });
}
function answerText(question) {
  if (question.type === 'multiple_choice') return question.options?.[Number(question.answerIndex)] || 'ไม่ระบุ';
  return clean(question.answer, 1000) || 'ไม่ระบุ';
}
function questionBlocks(questions, withAnswers) {
  return questions.flatMap((question, index) => {
    const blocks = [paragraph(`${index + 1}. ${clean(question.prompt, 1400)}`, { bold: true, spacing: { before: 180, after: 80 } })];
    if (question.type === 'multiple_choice') {
      const labels = ['ก.', 'ข.', 'ค.', 'ง.'];
      (Array.isArray(question.options) ? question.options.slice(0, 4) : []).forEach((option, optionIndex) => blocks.push(paragraph(`${labels[optionIndex]} ${clean(option, 500)}`, { indent: { left: 420 }, spacing: { after: 35 } })));
    } else if (question.type === 'short_answer' && !withAnswers) {
      blocks.push(paragraph('........................................................................................................', { spacing: { after: 50 } }));
    }
    if (withAnswers) {
      blocks.push(paragraph(`เฉลย: ${answerText(question)}`, { size: 22, bold: true, spacing: { before: 50, after: 25 } }));
      if (question.explanation) blocks.push(paragraph(`คำอธิบาย: ${clean(question.explanation, 1200)}`, { size: 21, spacing: { after: 60 } }));
    }
    return blocks;
  });
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
    const header = [
      paragraph(title, { size: 34, bold: true, alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
      paragraph(clean(quiz.classLabel, 220), { size: 22, alignment: AlignmentType.CENTER, spacing: { after: 150 } }),
      paragraph('ชื่อ-สกุล ............................................................................... ชั้น ............... เลขที่ ...............', { size: 22, spacing: { after: 180 } }),
      paragraph(`คำชี้แจง: ${quiz.mode === 'practice' ? 'ทำแบบฝึกหัดให้ครบทุกข้อ' : 'ทำแบบทดสอบให้ครบทุกข้อ'}`, { size: 22, spacing: { after: 60 } }),
      ...(indicators.length ? [paragraph(`ตัวชี้วัดที่เกี่ยวข้อง: ${indicators.join(', ')}`, { size: 19, spacing: { after: 100 } })] : [])
    ];
    const document = new Document({
      styles: { default: { document: { run: { font: 'TH SarabunPSK', size: 24 } } } },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
        children: [...header, ...questionBlocks(questions, false), new Paragraph({ children: [new PageBreak()] }), paragraph('เฉลย', { size: 30, bold: true, alignment: AlignmentType.CENTER, spacing: { after: 160 } }), ...questionBlocks(questions, true)]
      }]
    });
    const buffer = await Packer.toBuffer(document);
    const fileName = encodeURIComponent(`${title}.docx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="quiz.docx"; filename*=UTF-8''${fileName}`);
    res.setHeader('Cache-Control', 'no-store, private');
    res.status(200).send(buffer);
  } catch (error) {
    console.error('Quiz docx export error:', error);
    return sendJson(res, 500, { error: 'export_failed', message: 'เกิดข้อผิดพลาดขณะสร้างไฟล์ Word' });
  }
};
