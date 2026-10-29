'use strict';

const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType, LevelFormat } = require('docx');
const { sendJson, parseBody, requestOriginIsValid } = require('../http');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dzntiiuyqvkaxqpqzxeh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_SePLBF-dsJfx5T6Yvvcuew_vntSr3Vc';
const BODY_SIZE = 28;
const TITLE_SIZE = 36;

const clean = (value, max = 2200) => String(value || '').trim().slice(0, max);
const asList = (value, maxItems = 18) => (Array.isArray(value) ? value : []).map(item => clean(item, 1500)).filter(Boolean).slice(0, maxItems);

async function authenticatedUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
  return response.ok ? response.json() : null;
}

function paragraph(text, options = {}) {
  return new Paragraph({ ...options, children: [new TextRun({ text: clean(text), font: 'TH SarabunPSK', size: options.size || BODY_SIZE, bold: Boolean(options.bold) })] });
}

function sectionBlocks(title, values) {
  const list = asList(values);
  return [
    paragraph(title, { bold:true, spacing:{ before:170, after:60 } }),
    ...(list.length ? list.map(item => new Paragraph({ numbering:{ reference:'plan-bullets', level:0 }, children:[new TextRun({ text:item, font:'TH SarabunPSK', size:BODY_SIZE })] })) : [paragraph('........................................................................................................................', { spacing:{ after:50 } })])
  ];
}

const tableBorders = { top:{style:BorderStyle.SINGLE,size:1,color:'D9E2DD'}, bottom:{style:BorderStyle.SINGLE,size:1,color:'D9E2DD'}, left:{style:BorderStyle.SINGLE,size:1,color:'D9E2DD'}, right:{style:BorderStyle.SINGLE,size:1,color:'D9E2DD'}, insideHorizontal:{style:BorderStyle.SINGLE,size:1,color:'D9E2DD'}, insideVertical:{style:BorderStyle.SINGLE,size:1,color:'D9E2DD'} };
const noBorders = Object.fromEntries(['top','bottom','left','right','insideHorizontal','insideVertical'].map(edge => [edge,{style:BorderStyle.NONE,size:0,color:'FFFFFF'}]));

function metadataTable(lessonPlan) {
  const left = [
    `รหัสวิชา ${clean(lessonPlan.courseCode, 80) || '................................'}`,
    `ระดับชั้น ${clean(lessonPlan.grade, 80) || '................................'}`,
    `${lessonPlan.subjectId === 'guidance' ? 'หน่วยการจัดกิจกรรมที่' : 'หน่วยการเรียนรู้ที่'} ${clean(lessonPlan.unitNumber, 40) || '....'} ${clean(lessonPlan.unitName, 180)}`,
    `เรื่อง ${clean(lessonPlan.topic, 220) || '................................'}`,
    `ผู้สอน ${clean(lessonPlan.teacherName, 160) || '................................'}${lessonPlan.teacherCode ? ` · รหัส ${clean(lessonPlan.teacherCode, 80)}` : ''}`
  ];
  const right = [
    `รายวิชา ${clean(lessonPlan.courseName, 180) || '................................'}`,
    `ภาคเรียนที่ ${clean(lessonPlan.semester, 20) || '....'} ปีการศึกษา ${clean(lessonPlan.academicYear, 10) || '........'}`,
    `${lessonPlan.subjectId === 'guidance' ? 'เวลาแผนนี้' : 'เวลา'} ${clean(lessonPlan.duration, 80) || '................................'}${lessonPlan.subjectId === 'guidance' && clean(lessonPlan.unitHours, 20) ? ` · รวมหน่วย ${clean(lessonPlan.unitHours,20)} ชั่วโมง` : ''}`,
    `ชั้น/ห้อง ${(Array.isArray(lessonPlan.classSections) ? lessonPlan.classSections : []).map(item => clean(item, 80)).filter(Boolean).join(', ') || '................................'}`,
    `กลุ่มสาระ/กิจกรรม ${clean(lessonPlan.subjectGroup || lessonPlan.subject, 180) || '................................'}`
  ];
  const rows = left.map((text, index) => new TableRow({ children:[left[index], right[index]].map(value => new TableCell({ width:{size:50,type:WidthType.PERCENTAGE}, margins:{top:30,bottom:30,left:80,right:80}, borders:noBorders, children:[paragraph(value,{spacing:{after:0}})] })) }));
  return new Table({ width:{size:100,type:WidthType.PERCENTAGE}, columnWidths:[4820,4820], borders:noBorders, rows });
}

function assessmentTable(plan) {
  const records = Array.isArray(plan.assessmentMatrix) ? plan.assessmentMatrix.slice(0,12) : [];
  const header = ['สิ่งที่วัดและประเมินผล','วิธีการ/เป้าหมาย','เครื่องมือ','เกณฑ์การประเมิน'];
  const rows = [new TableRow({ tableHeader:true, children:header.map(text => new TableCell({ width:{size:25,type:WidthType.PERCENTAGE}, shading:{fill:'EAF6F1',type:ShadingType.SOLID}, margins:{top:80,bottom:80,left:90,right:90}, borders:tableBorders, children:[paragraph(text,{bold:true,alignment:AlignmentType.CENTER})] })) })];
  for (const item of records) {
    const values = [item.domain, item.target, item.instrument, item.criterion].map(value => clean(value,700) || '................................');
    rows.push(new TableRow({ children:values.map(text => new TableCell({ width:{size:25,type:WidthType.PERCENTAGE}, margins:{top:70,bottom:70,left:90,right:90}, borders:tableBorders, children:[paragraph(text)] })) }));
  }
  if (!records.length) rows.push(new TableRow({ children:header.map(() => new TableCell({ width:{size:25,type:WidthType.PERCENTAGE}, margins:{top:70,bottom:70,left:90,right:90}, borders:tableBorders, children:[paragraph('................................................................')] })) }));
  return new Table({ width:{size:100,type:WidthType.PERCENTAGE}, columnWidths:[2410,2410,2410,2410], borders:tableBorders, rows });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error:'method_not_allowed' });
  if (!requestOriginIsValid(req)) return sendJson(res, 403, { error:'invalid_origin' });
  try {
    const user = await authenticatedUser(req);
    if (!user?.id) return sendJson(res, 401, { error:'authentication_required', message:'กรุณาเข้าสู่ระบบใหม่ก่อนส่งออกเอกสาร' });
    const lessonPlan = parseBody(req).lessonPlan || {};
    const plan = lessonPlan.plan && typeof lessonPlan.plan === 'object' ? lessonPlan.plan : {};
    const title = clean(plan.title || lessonPlan.title || lessonPlan.topic, 240);
    if (!title) return sendJson(res, 400, { error:'invalid_lesson_plan', message:'ไม่พบข้อมูลแผนการสอนสำหรับส่งออก' });
    const planTitle = clean(lessonPlan.planTitle, 120) || `แผนการจัดการเรียนรู้ที่ ${clean(lessonPlan.planNumber,12) || '1'}`;
    const indicators = Array.isArray(lessonPlan.indicators) ? lessonPlan.indicators.slice(0, 18).map(item => `${clean(item.code, 80)} ${clean(item.text, 1000)}`.trim()).filter(Boolean) : [];
    const document = new Document({
      styles:{ default:{ document:{ run:{ font:'TH SarabunPSK', size:BODY_SIZE } } } },
      numbering:{ config:[{ reference:'plan-bullets', levels:[{ level:0, format:LevelFormat.BULLET, text:'•', alignment:AlignmentType.LEFT, style:{ paragraph:{ indent:{ left:520, hanging:260 }, spacing:{ after:35 } }, run:{ font:'TH SarabunPSK', size:BODY_SIZE } } }] }] },
      sections:[{
        properties:{ page:{ size:{ width:11906, height:16838 }, margin:{ top:1134, right:1134, bottom:1134, left:1134 } } },
        children:[
          paragraph(planTitle, { size:TITLE_SIZE, bold:true, alignment:AlignmentType.CENTER, spacing:{ after:40 } }),
          paragraph(title, { size:TITLE_SIZE, bold:true, alignment:AlignmentType.CENTER, spacing:{ after:160 } }),
          metadataTable(lessonPlan),
          paragraph('________________________________________________________________________________', { spacing:{ before:75, after:30 } }),
          ...(lessonPlan.subjectId === 'guidance' ? [
            paragraph('ภาพรวมหน่วยการจัดกิจกรรม', { bold:true, spacing:{ before:120, after:40 } }),
            paragraph(`หน่วยที่ ${clean(lessonPlan.unitNumber,40) || '....'} ${clean(lessonPlan.unitName,180)}${clean(lessonPlan.unitHours,20) ? ` · รวม ${clean(lessonPlan.unitHours,20)} ชั่วโมง` : ''}`, { spacing:{ after:45 } }),
            ...sectionBlocks('กรอบแนะแนวที่อ้างอิง', Array.isArray(lessonPlan.standards) ? lessonPlan.standards.map(item => `${clean(item.code,100)} ${clean(item.title,900)}`.trim()) : []),
            ...sectionBlocks('ผลลัพธ์ที่เลือกสำหรับหน่วย', indicators),
            ...sectionBlocks('วัตถุประสงค์ชั้นปี', lessonPlan.yearObjective ? [lessonPlan.yearObjective] : []),
            ...sectionBlocks('วัตถุประสงค์ของหน่วย', lessonPlan.unitObjective || plan.unitObjective ? [lessonPlan.unitObjective || plan.unitObjective] : []),
            ...sectionBlocks('1. สาระสำคัญ', plan.keyConcepts),
            ...sectionBlocks('2. จุดประสงค์การเรียนรู้', plan.objectives),
            ...sectionBlocks('3. สาระการเรียนรู้', [...asList(plan.contentKnowledge).map(item => `ความรู้: ${item}`), ...asList(plan.contentSkills).map(item => `ทักษะ/กระบวนการ: ${item}`)])
          ] : [
            ...sectionBlocks('มาตรฐานการเรียนรู้', Array.isArray(lessonPlan.standards) ? lessonPlan.standards.map(item => `${clean(item.code,100)} ${clean(item.title,900)}`.trim()) : []),
            ...sectionBlocks('ตัวชี้วัด / ผลการเรียนรู้', indicators),
            ...sectionBlocks('สาระสำคัญ', plan.keyConcepts),
            ...sectionBlocks('จุดประสงค์การเรียนรู้', plan.objectives),
            ...sectionBlocks('สาระการเรียนรู้: ความรู้', plan.contentKnowledge),
            ...sectionBlocks('สาระการเรียนรู้: ทักษะ/กระบวนการ', plan.contentSkills)
          ]),
          ...(lessonPlan.subjectId === 'guidance' ? [
            ...sectionBlocks('4. วิธีดำเนินกิจกรรม', plan.activities),
            ...sectionBlocks('5. ชิ้นงาน/ภาระงาน', plan.workProducts),
            ...sectionBlocks('6. สื่อ/อุปกรณ์/แหล่งเรียนรู้', plan.resources),
            paragraph('7. การวัดและประเมินผล', { bold:true, spacing:{ before:170, after:60 } }),
            assessmentTable(plan),
            ...sectionBlocks('สมรรถนะสำคัญของผู้เรียน', plan.competencies),
            ...sectionBlocks('คุณลักษณะอันพึงประสงค์', plan.desirableCharacteristics),
            ...sectionBlocks('ความสามารถและทักษะในศตวรรษที่ 21', plan.skills21)
          ] : [
            ...sectionBlocks('สมรรถนะสำคัญของผู้เรียน', plan.competencies),
            ...sectionBlocks('คุณลักษณะอันพึงประสงค์', plan.desirableCharacteristics),
            ...sectionBlocks('ความสามารถและทักษะในศตวรรษที่ 21', plan.skills21),
            ...sectionBlocks('ชิ้นงาน / ภาระงาน', plan.workProducts),
            paragraph('ขั้นตอนการจัดกิจกรรมการเรียนรู้', { bold:true, spacing:{ before:170, after:60 } }),
            ...sectionBlocks('วิธีดำเนินกิจกรรม', plan.activities),
            ...sectionBlocks('สื่อและแหล่งเรียนรู้', plan.resources),
            paragraph('การวัดและประเมินผล', { bold:true, spacing:{ before:170, after:60 } }),
            assessmentTable(plan)
          ]),
          ...sectionBlocks('รายละเอียดการประเมินเพิ่มเติม', plan.assessment),
          ...sectionBlocks('หลักฐานที่ควรเก็บ', plan.evidence),
          ...sectionBlocks('กิจกรรมเสนอแนะ', plan.suggestedActivities),
          ...sectionBlocks('คำแนะนำการปรับใช้', plan.adaptations),
          paragraph('บันทึกหลังการจัดการเรียนรู้', { bold:true, spacing:{ before:210, after:70 } }),
          paragraph('ผลการจัดการเรียนรู้ ........................................................................................................................................', { spacing:{ after:50 } }),
          paragraph('ปัญหา / อุปสรรค ..............................................................................................................................................', { spacing:{ after:50 } }),
          paragraph('แนวทางแก้ไข / ข้อเสนอแนะ .................................................................................................................................', { spacing:{ after:140 } }),
          paragraph('ลงชื่อ ........................................................................ ครูผู้สอน', { alignment:AlignmentType.RIGHT, spacing:{ after:100 } }),
          paragraph('ความคิดเห็น/ข้อเสนอแนะของหัวหน้ากลุ่มสาระหรือผู้บริหาร', { bold:true, spacing:{ before:190, after:60 } }),
          paragraph('............................................................................................................................................................................', { spacing:{ after:60 } }),
          paragraph('ลงชื่อ ........................................................................ ผู้ตรวจ/ผู้บริหาร', { alignment:AlignmentType.RIGHT })
        ]
      }]
    });
    const buffer = await Packer.toBuffer(document);
    const fileName = encodeURIComponent(`${title}.docx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="lesson-plan.docx"; filename*=UTF-8''${fileName}`);
    res.setHeader('Cache-Control', 'no-store, private');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Lesson plan docx export error:', error);
    return sendJson(res, 500, { error:'export_failed', message:'เกิดข้อผิดพลาดขณะสร้างไฟล์ Word' });
  }
};
