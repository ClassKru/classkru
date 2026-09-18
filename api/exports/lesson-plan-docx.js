'use strict';

const { Document, Packer, Paragraph, TextRun, AlignmentType, LevelFormat } = require('docx');
const { sendJson, parseBody, requestOriginIsValid } = require('../_lib/http');

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
    const indicators = Array.isArray(lessonPlan.indicators) ? lessonPlan.indicators.slice(0, 18).map(item => `${clean(item.code, 80)} ${clean(item.text, 1000)}`.trim()).filter(Boolean) : [];
    const document = new Document({
      styles:{ default:{ document:{ run:{ font:'TH SarabunPSK', size:BODY_SIZE } } } },
      numbering:{ config:[{ reference:'plan-bullets', levels:[{ level:0, format:LevelFormat.BULLET, text:'•', alignment:AlignmentType.LEFT, style:{ paragraph:{ indent:{ left:520, hanging:260 }, spacing:{ after:35 } }, run:{ font:'TH SarabunPSK', size:BODY_SIZE } } }] }] },
      sections:[{
        properties:{ page:{ size:{ width:11906, height:16838 }, margin:{ top:1134, right:1134, bottom:1134, left:1134 } } },
        children:[
          paragraph('แผนการจัดการเรียนรู้', { size:TITLE_SIZE, bold:true, alignment:AlignmentType.CENTER, spacing:{ after:80 } }),
          paragraph(title, { size:32, bold:true, alignment:AlignmentType.CENTER, spacing:{ after:170 } }),
          paragraph(`กลุ่มสาระการเรียนรู้ ${clean(lessonPlan.subject, 180) || '................................'}    ระดับชั้น ${clean(lessonPlan.grade, 80) || '................................'}`, { spacing:{ after:35 } }),
          paragraph(`ห้องเรียน ${clean(lessonPlan.classLabel, 220) || '................................'}    เวลาเรียน ${clean(lessonPlan.duration, 80) || '................................'}`, { spacing:{ after:35 } }),
          paragraph(`รูปแบบการจัดการเรียนรู้ ${clean(lessonPlan.method, 140) || '................................'}`, { spacing:{ after:100 } }),
          ...sectionBlocks('ตัวชี้วัด / ผลการเรียนรู้', indicators),
          ...sectionBlocks('สาระสำคัญ', plan.keyConcepts),
          ...sectionBlocks('จุดประสงค์การเรียนรู้', plan.objectives),
          ...sectionBlocks('ขั้นตอนการจัดกิจกรรมการเรียนรู้', plan.activities),
          ...sectionBlocks('สื่อและแหล่งเรียนรู้', plan.resources),
          ...sectionBlocks('การวัดและประเมินผล', plan.assessment),
          ...sectionBlocks('หลักฐานที่ควรเก็บ', plan.evidence),
          ...sectionBlocks('คำแนะนำการปรับใช้', plan.adaptations),
          paragraph('บันทึกหลังสอน', { bold:true, spacing:{ before:210, after:70 } }),
          paragraph('ผลการจัดการเรียนรู้ ........................................................................................................................................', { spacing:{ after:50 } }),
          paragraph('ปัญหา / อุปสรรค ..............................................................................................................................................', { spacing:{ after:50 } }),
          paragraph('แนวทางแก้ไข / ข้อเสนอแนะ .................................................................................................................................', { spacing:{ after:140 } }),
          paragraph('ลงชื่อ ........................................................................ ครูผู้สอน', { alignment:AlignmentType.RIGHT })
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
