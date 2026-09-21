'use strict';

const { Document, Packer, Paragraph, TextRun, PageBreak, AlignmentType, LevelFormat } = require('docx');
const { normalize } = require('../../../js/worksheet-layout');
const { sendJson, parseBody, requestOriginIsValid } = require('../http');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dzntiiuyqvkaxqpqzxeh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_SePLBF-dsJfx5T6Yvvcuew_vntSr3Vc';
const BODY_FONT = 'TH SarabunPSK';
const BODY_SIZE = 28;
const SUBHEADING_SIZE = 32;
const TITLE_SIZE = 36;

const clean = (value, max = 2200) => String(value || '').trim().slice(0, max);
const asList = (value, maxItems = 24) => (Array.isArray(value) ? value : []).map(item => clean(item, 1600)).filter(Boolean).slice(0, maxItems);

async function authenticatedUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
  return response.ok ? response.json() : null;
}

function paragraph(text, options = {}) {
  return new Paragraph({ ...options, children: [new TextRun({ text: clean(text), font: BODY_FONT, size: options.size || BODY_SIZE, bold: Boolean(options.bold) })] });
}

function heading(text, options = {}) {
  return paragraph(text, { size: options.size || SUBHEADING_SIZE, bold: true, spacing: { before: options.before || 190, after: options.after || 80 }, ...options });
}

function sectionBlocks(title, values) {
  const list = asList(values);
  return [heading(title), ...(list.length ? list.map(item => new Paragraph({ numbering: { reference: 'pack-bullets', level: 0 }, children: [new TextRun({ text: item, font: BODY_FONT, size: BODY_SIZE })] })) : [paragraph('........................................................................................................................')])];
}

function planBlocks(lessonPlan) {
  const data = lessonPlan.plan && typeof lessonPlan.plan === 'object' ? lessonPlan.plan : {};
  const indicators = Array.isArray(lessonPlan.indicators) ? lessonPlan.indicators.map(item => `${clean(item.code, 80)} ${clean(item.text, 900)}`.trim()).filter(Boolean) : [];
  return [
    paragraph('แผนการจัดการเรียนรู้รายคาบ', { size: TITLE_SIZE, bold: true, alignment: AlignmentType.CENTER, spacing: { after: 70 } }),
    paragraph(clean(data.title || lessonPlan.title || lessonPlan.topic, 240), { size: TITLE_SIZE, bold: true, alignment: AlignmentType.CENTER, spacing: { after: 170 } }),
    paragraph(`กลุ่มสาระการเรียนรู้ ${clean(lessonPlan.subject, 180) || '................................'}    ระดับชั้น ${clean(lessonPlan.grade, 80) || '................................'}`, { spacing: { after: 35 } }),
    paragraph(`ห้องเรียน ${clean(lessonPlan.classLabel, 220) || '................................'}    เวลาเรียน ${clean(lessonPlan.duration, 80) || '................................'}`, { spacing: { after: 35 } }),
    paragraph(`รูปแบบการจัดการเรียนรู้ ${clean(lessonPlan.method, 140) || '................................'}`, { spacing: { after: 90 } }),
    ...sectionBlocks('ตัวชี้วัด / ผลการเรียนรู้', indicators),
    ...sectionBlocks('สาระสำคัญ', data.keyConcepts),
    ...sectionBlocks('จุดประสงค์การเรียนรู้', data.objectives),
    ...sectionBlocks('ขั้นตอนการจัดกิจกรรมการเรียนรู้', data.activities),
    ...sectionBlocks('สื่อและแหล่งเรียนรู้', data.resources),
    ...sectionBlocks('การวัดและประเมินผล', data.assessment),
    ...sectionBlocks('หลักฐานที่ควรเก็บ', data.evidence),
    paragraph('บันทึกหลังสอน', { bold: true, spacing: { before: 230, after: 70 } }),
    paragraph('ผลการจัดการเรียนรู้ ........................................................................................................................................'),
    paragraph('ปัญหา / อุปสรรค ..............................................................................................................................................'),
    paragraph('แนวทางแก้ไข / ข้อเสนอแนะ .................................................................................................................................')
  ];
}

function worksheetBlocks(worksheet) {
  const data = worksheet.worksheet && typeof worksheet.worksheet === 'object' ? worksheet.worksheet : worksheet;
  const blocks = [];
  if (data.version === 2) {
    try {
      const normalized = normalize(data, { ...worksheet, itemCount: undefined });
      normalized.blocks.forEach((block, index) => {
        blocks.push(heading(`${index + 1}. ${clean(block.title, 220)}`), paragraph(block.instruction));
        if (block.type === 'question') {
          for (let line = 0; line < Number(block.lines || 2); line += 1) blocks.push(paragraph('................................................................................................................'));
        } else if (block.type === 'drawing_form') {
          (block.items || []).forEach((item, itemIndex) => blocks.push(paragraph(`${itemIndex + 1}. ${clean(item.prompt, 700)}`), paragraph('พื้นที่สำหรับทำงาน ................................................................................................................')));
        } else if (block.type === 'matching') {
          blocks.push(paragraph(`รายการ: ${(block.leftItems || []).map(clean).join(' | ')}`), paragraph(`ตัวเลือก: ${(block.rightItems || []).map(clean).join(' | ')}`), paragraph('คำตอบ ................................................................................................................'));
        } else {
          (block.columns || []).forEach(column => blocks.push(paragraph(`${clean(column, 180)}: ................................................................................................................`)));
        }
      });
      const answers = normalized.blocks.filter(block => block.answer || block.rubric).map((block, index) => `${index + 1}. ${clean(block.answer || block.rubric, 1200)}`);
      return { student: blocks, teacher: answers };
    } catch (error) {
      // Fall through to the legacy fields if an older saved worksheet cannot be normalized.
    }
  }
  return {
    student: [
      ...sectionBlocks('คำชี้แจง', data.directions),
      ...sectionBlocks('สถานการณ์หรือโจทย์กิจกรรม', data.context),
      ...sectionBlocks('ขั้นตอนการทำงาน', data.steps),
      ...sectionBlocks('ภารกิจ / คำถามชี้นำ', data.tasks),
      ...sectionBlocks('สิ่งที่นักเรียนต้องทำหรือบันทึก', data.responseAreas),
      ...sectionBlocks('ชิ้นงานที่ต้องส่ง', data.submission)
    ],
    teacher: asList(data.assessmentCriteria)
  };
}

function worksheetSection(worksheet, index) {
  const data = worksheet.worksheet && typeof worksheet.worksheet === 'object' ? worksheet.worksheet : worksheet;
  const title = clean(data.title || worksheet.title, 240) || `ใบงานที่ ${index + 1}`;
  const content = worksheetBlocks(worksheet);
  return {
    student: [
      new Paragraph({ children: [new PageBreak()] }),
      heading(`ใบงานที่ ${index + 1}`, { size: TITLE_SIZE, before: 0, after: 70 }),
      paragraph(title, { size: SUBHEADING_SIZE, bold: true, spacing: { after: 120 } }),
      paragraph(`วิชา ${clean(worksheet.subject, 180)}    ระดับชั้น ${clean(worksheet.grade, 80)}    เวลา ${clean(worksheet.duration, 80)}`),
      paragraph(`ตัวชี้วัด: ${(worksheet.indicators || []).map(item => clean(item.code, 80)).filter(Boolean).join(' · ')}`),
      paragraph('ชื่อ-สกุล ........................................................................ ชั้น ........ เลขที่ ........', { spacing: { after: 120 } }),
      ...content.student
    ],
    teacher: content.teacher.length ? [new Paragraph({ children: [new PageBreak()] }), heading(`แนวทางตรวจใบงานที่ ${index + 1}`, { size: TITLE_SIZE, before: 0 }), paragraph(title, { size: SUBHEADING_SIZE, bold: true }), ...content.teacher.map((item, itemIndex) => paragraph(`${itemIndex + 1}. ${item}`))] : []
  };
}

function quizSection(quiz, index) {
  const questions = Array.isArray(quiz.questions) ? quiz.questions.slice(0, 60) : [];
  const student = [new Paragraph({ children: [new PageBreak()] }), heading(`แบบทดสอบที่ ${index + 1}`, { size: TITLE_SIZE, before: 0 }), paragraph(clean(quiz.title, 240), { size: SUBHEADING_SIZE, bold: true, spacing: { after: 110 } }), paragraph(clean(quiz.classLabel, 220)), paragraph('ชื่อ-สกุล ........................................................................ ชั้น ........ เลขที่ ........'), ...questions.flatMap((question, questionIndex) => {
    const rows = [paragraph(`${questionIndex + 1}. ${clean(question.prompt, 1400)}`, { bold: true, spacing: { before: 130, after: 50 } })];
    if (question.type === 'multiple_choice') (question.options || []).slice(0, 4).forEach((option, optionIndex) => rows.push(paragraph(`${['ก.', 'ข.', 'ค.', 'ง.'][optionIndex]} ${clean(option, 600)}`, { indent: { left: 420 } })));
    else rows.push(paragraph('................................................................................................................'));
    return rows;
  })];
  const teacher = [new Paragraph({ children: [new PageBreak()] }), heading(`เฉลยแบบทดสอบที่ ${index + 1}`, { size: TITLE_SIZE, before: 0 }), paragraph(clean(quiz.title, 240), { size: SUBHEADING_SIZE, bold: true }), ...questions.map((question, questionIndex) => {
    const answer = question.type === 'multiple_choice' ? (question.options || [])[Number(question.answerIndex)] : question.answer;
    return paragraph(`${questionIndex + 1}. ${clean(answer, 1200) || 'ไม่ระบุ'}${question.explanation ? ` — ${clean(question.explanation, 1200)}` : ''}`);
  })];
  return { student, teacher };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
  if (!requestOriginIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });
  try {
    const user = await authenticatedUser(req);
    if (!user?.id) return sendJson(res, 401, { error: 'authentication_required', message: 'กรุณาเข้าสู่ระบบใหม่ก่อนส่งออกเอกสาร' });
    const body = parseBody(req);
    const lessonPlan = body.lessonPlan || {};
    const worksheets = Array.isArray(body.worksheets) ? body.worksheets.slice(0, 12) : [];
    const quizzes = Array.isArray(body.quizzes) ? body.quizzes.slice(0, 12).filter(item => Array.isArray(item.questions) && item.questions.length) : [];
    const title = clean(lessonPlan.plan?.title || lessonPlan.title || lessonPlan.topic, 180);
    if (!title) return sendJson(res, 400, { error: 'invalid_lesson_pack', message: 'ไม่พบข้อมูลแผนการสอนสำหรับสร้างชุดเอกสาร' });
    const worksheetSections = worksheets.map(worksheetSection);
    const quizSections = quizzes.map(quizSection);
    const studentSections = [...worksheetSections.flatMap(section => section.student), ...quizSections.flatMap(section => section.student)];
    const teacherSections = [...worksheetSections.flatMap(section => section.teacher), ...quizSections.flatMap(section => section.teacher)];
    const children = [
      ...planBlocks(lessonPlan),
      heading('ชุดเอกสารประกอบคาบ', { size: TITLE_SIZE }),
      paragraph('เอกสารชุดนี้รวมแผนรายคาบ ใบงาน และแบบทดสอบที่ครูเลือกเชื่อมไว้', { spacing: { after: 80 } }),
      heading('สื่อประกอบคาบ', { size: SUBHEADING_SIZE }),
      paragraph(`ใบงาน ${worksheets.length} ชุด · แบบทดสอบ ${quizzes.length} ชุด`, { spacing: { after: 100 } }),
      ...(studentSections.length ? studentSections : [paragraph('ยังไม่มีใบงานหรือข้อสอบที่เชื่อมกับแผนนี้')]),
      ...(teacherSections.length ? [new Paragraph({ children: [new PageBreak()] }), heading('เกณฑ์ตรวจใบงานและเฉลยข้อสอบ', { size: TITLE_SIZE, before: 0 }), paragraph('ส่วนนี้ประกอบด้วยเกณฑ์ตรวจและเฉลยของสื่อที่เชื่อมกับแผนนี้'), ...teacherSections] : [])
    ];
    const document = new Document({
      styles: { default: { document: { run: { font: BODY_FONT, size: BODY_SIZE } } } },
      numbering: { config: [{ reference: 'pack-bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 520, hanging: 260 }, spacing: { after: 35 } }, run: { font: BODY_FONT, size: BODY_SIZE } } }] }] },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } }, children }]
    });
    const buffer = await Packer.toBuffer(document);
    const fileName = encodeURIComponent(`${title} - ชุดเอกสารประกอบคาบ.docx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="lesson-pack.docx"; filename*=UTF-8''${fileName}`);
    res.setHeader('Cache-Control', 'no-store, private');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Lesson pack docx export error:', error);
    return sendJson(res, 500, { error: 'export_failed', message: 'เกิดข้อผิดพลาดขณะสร้างชุดเอกสาร Word' });
  }
};
