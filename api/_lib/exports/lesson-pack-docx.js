'use strict';

const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, PageBreak, AlignmentType, LevelFormat } = require('docx');
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

const planBorders = { top:{style:BorderStyle.SINGLE,size:1,color:'D9E2DD'}, bottom:{style:BorderStyle.SINGLE,size:1,color:'D9E2DD'}, left:{style:BorderStyle.SINGLE,size:1,color:'D9E2DD'}, right:{style:BorderStyle.SINGLE,size:1,color:'D9E2DD'}, insideHorizontal:{style:BorderStyle.SINGLE,size:1,color:'D9E2DD'}, insideVertical:{style:BorderStyle.SINGLE,size:1,color:'D9E2DD'} };
const noPlanBorders = Object.fromEntries(['top','bottom','left','right','insideHorizontal','insideVertical'].map(edge => [edge,{style:BorderStyle.NONE,size:0,color:'FFFFFF'}]));

function planMetadata(lessonPlan) {
  const left = [
    `รหัสวิชา ${clean(lessonPlan.courseCode,80) || '................................'}`,
    `ระดับชั้น ${clean(lessonPlan.grade,80) || '................................'}`,
    `${lessonPlan.subjectId === 'guidance' ? 'หน่วยการจัดกิจกรรมที่' : 'หน่วยการเรียนรู้ที่'} ${clean(lessonPlan.unitNumber,40) || '....'} ${clean(lessonPlan.unitName,180)}`,
    `เรื่อง ${clean(lessonPlan.topic,220) || '................................'}`,
    `ผู้สอน ${clean(lessonPlan.teacherName,160) || '................................'}`
  ];
  const right = [
    `รายวิชา ${clean(lessonPlan.courseName,180) || '................................'}`,
    `ภาคเรียนที่ ${clean(lessonPlan.semester,20) || '....'} ปีการศึกษา ${clean(lessonPlan.academicYear,10) || '........'}`,
    `${lessonPlan.subjectId === 'guidance' ? 'เวลาแผนนี้' : 'เวลา'} ${clean(lessonPlan.duration,80) || '................................'}${lessonPlan.subjectId === 'guidance' && clean(lessonPlan.unitHours,20) ? ` · รวมหน่วย ${clean(lessonPlan.unitHours,20)} ชั่วโมง` : ''}`,
    `ชั้น/ห้อง ${(lessonPlan.classSections || []).map(item => clean(item,80)).filter(Boolean).join(', ') || '................................'}`,
    `กลุ่มสาระ/กิจกรรม ${clean(lessonPlan.subjectGroup || lessonPlan.subject,180) || '................................'}`
  ];
  return new Table({ width:{size:100,type:WidthType.PERCENTAGE}, columnWidths:[4820,4820], borders:noPlanBorders, rows:left.map((value,index) => new TableRow({ children:[value,right[index]].map(text => new TableCell({ width:{size:50,type:WidthType.PERCENTAGE}, margins:{top:30,bottom:30,left:80,right:80}, borders:noPlanBorders, children:[paragraph(text)] })) })) });
}

function planAssessmentTable(plan) {
  const records = Array.isArray(plan.assessmentMatrix) ? plan.assessmentMatrix.slice(0,12) : [];
  const header = ['สิ่งที่วัดและประเมินผล','วิธีการ/เป้าหมาย','เครื่องมือ','เกณฑ์'];
  const rows = [new TableRow({ tableHeader:true, children:header.map(text => new TableCell({ width:{size:25,type:WidthType.PERCENTAGE}, shading:{fill:'EAF6F1',type:ShadingType.SOLID}, margins:{top:70,bottom:70,left:80,right:80}, borders:planBorders, children:[paragraph(text,{bold:true,alignment:AlignmentType.CENTER})] })) })];
  for (const item of records) rows.push(new TableRow({ children:[item.domain,item.target,item.instrument,item.criterion].map(text => new TableCell({ width:{size:25,type:WidthType.PERCENTAGE}, margins:{top:60,bottom:60,left:80,right:80}, borders:planBorders, children:[paragraph(text || '................................')] })) }));
  if (!records.length) rows.push(new TableRow({ children:header.map(() => new TableCell({ width:{size:25,type:WidthType.PERCENTAGE}, margins:{top:60,bottom:60,left:80,right:80}, borders:planBorders, children:[paragraph('................................................................')] })) }));
  return new Table({ width:{size:100,type:WidthType.PERCENTAGE}, columnWidths:[2410,2410,2410,2410], borders:planBorders, rows });
}

function planBlocks(lessonPlan) {
  const data = lessonPlan.plan && typeof lessonPlan.plan === 'object' ? lessonPlan.plan : {};
  const indicators = Array.isArray(lessonPlan.indicators) ? lessonPlan.indicators.map(item => `${clean(item.code, 80)} ${clean(item.text, 900)}`.trim()).filter(Boolean) : [];
  return [
    paragraph(clean(lessonPlan.planTitle || `แผนการจัดการเรียนรู้ที่ ${lessonPlan.planNumber || 1}`, 120), { size: TITLE_SIZE, bold: true, alignment: AlignmentType.CENTER, spacing: { after: 40 } }),
    paragraph(clean(data.title || lessonPlan.title || lessonPlan.topic, 240), { size: TITLE_SIZE, bold: true, alignment: AlignmentType.CENTER, spacing: { after: 140 } }),
    planMetadata(lessonPlan),
    paragraph('________________________________________________________________________________', { spacing: { before: 70, after: 20 } }),
    ...(lessonPlan.subjectId === 'guidance' ? [
      paragraph('ภาพรวมหน่วยการจัดกิจกรรม', { bold:true, spacing:{ before:120, after:40 } }),
      paragraph(`หน่วยที่ ${clean(lessonPlan.unitNumber,40) || '....'} ${clean(lessonPlan.unitName,180)}${clean(lessonPlan.unitHours,20) ? ` · รวม ${clean(lessonPlan.unitHours,20)} ชั่วโมง` : ''}`, { spacing:{ after:45 } }),
      ...sectionBlocks('กรอบแนะแนวที่อ้างอิง', (lessonPlan.standards || []).map(item => `${clean(item.code,100)} ${clean(item.title,900)}`.trim())),
      ...sectionBlocks('ผลลัพธ์ที่เลือกสำหรับหน่วย', indicators),
      ...sectionBlocks('วัตถุประสงค์ชั้นปี', lessonPlan.yearObjective ? [lessonPlan.yearObjective] : []),
      ...sectionBlocks('วัตถุประสงค์ของหน่วย', lessonPlan.unitObjective || data.unitObjective ? [lessonPlan.unitObjective || data.unitObjective] : []),
      ...sectionBlocks('1. สาระสำคัญ', data.keyConcepts),
      ...sectionBlocks('2. จุดประสงค์การเรียนรู้', data.objectives),
      ...sectionBlocks('3. สาระการเรียนรู้', [...asList(data.contentKnowledge).map(item => `ความรู้: ${item}`), ...asList(data.contentSkills).map(item => `ทักษะ/กระบวนการ: ${item}`)])
    ] : [
      ...sectionBlocks('มาตรฐานการเรียนรู้', (lessonPlan.standards || []).map(item => `${clean(item.code,100)} ${clean(item.title,900)}`.trim())),
      ...sectionBlocks('ตัวชี้วัด / ผลการเรียนรู้', indicators),
      ...sectionBlocks('สาระสำคัญ', data.keyConcepts),
      ...sectionBlocks('จุดประสงค์การเรียนรู้', data.objectives),
      ...sectionBlocks('สาระการเรียนรู้: ความรู้', data.contentKnowledge),
      ...sectionBlocks('สาระการเรียนรู้: ทักษะ/กระบวนการ', data.contentSkills)
    ]),
    ...(lessonPlan.subjectId === 'guidance' ? [
      ...sectionBlocks('4. วิธีดำเนินกิจกรรม', data.activities),
      ...sectionBlocks('5. ชิ้นงาน/ภาระงาน', data.workProducts),
      ...sectionBlocks('6. สื่อ/อุปกรณ์/แหล่งเรียนรู้', data.resources),
      paragraph('7. การวัดและประเมินผล', { bold:true, spacing:{before:180,after:60} }),
      planAssessmentTable(data),
      ...sectionBlocks('สมรรถนะสำคัญของผู้เรียน', data.competencies),
      ...sectionBlocks('คุณลักษณะอันพึงประสงค์', data.desirableCharacteristics),
      ...sectionBlocks('ความสามารถและทักษะในศตวรรษที่ 21', data.skills21)
    ] : [
      ...sectionBlocks('สมรรถนะสำคัญของผู้เรียน', data.competencies),
      ...sectionBlocks('คุณลักษณะอันพึงประสงค์', data.desirableCharacteristics),
      ...sectionBlocks('ความสามารถและทักษะในศตวรรษที่ 21', data.skills21),
      ...sectionBlocks('ชิ้นงาน / ภาระงาน', data.workProducts),
      ...sectionBlocks('ขั้นตอนการจัดกิจกรรมการเรียนรู้', data.activities),
      ...sectionBlocks('สื่อและแหล่งเรียนรู้', data.resources),
      paragraph('ตารางการวัดและประเมินผล', { bold:true, spacing:{before:180,after:60} }),
      planAssessmentTable(data)
    ]),
    ...sectionBlocks('รายละเอียดการประเมินเพิ่มเติม', data.assessment),
    ...sectionBlocks('หลักฐานที่ควรเก็บ', data.evidence),
    ...sectionBlocks('กิจกรรมเสนอแนะ', data.suggestedActivities),
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
