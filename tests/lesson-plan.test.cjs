const {test} = require('node:test');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function response() {
  return {
    headers:{},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; },
    send(body) { this.body = body; }
  };
}

test('lesson plan API follows teacher-selected frame and normalizes draft sections', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-placeholder';
  const handler = require('../api/ai/generate-lesson-plan');
  let openRouterRequest;
  const generatedPlan = {
    title:'แผนเรื่องระบบนิเวศ',
    keyConcepts:['สิ่งมีชีวิตสัมพันธ์กับสิ่งแวดล้อม'],
    objectives:['อธิบายองค์ประกอบระบบนิเวศได้'],
    activities:['ขั้นนำ: ทบทวนภาพระบบนิเวศ', 'ขั้นสอน: วิเคราะห์ตัวอย่าง', 'ขั้นสรุป: เขียนข้อค้นพบ'],
    resources:['ภาพระบบนิเวศ'],
    assessment:['วิธีประเมิน: ตรวจใบงาน | เครื่องมือ: รูบริก | เกณฑ์: ผ่าน 70%'],
    evidence:['ใบงาน'],
    adaptations:['ลดจำนวนตัวอย่างเมื่อเวลาไม่พอ']
  };
  global.fetch = async (url, init = {}) => {
    if (String(url).includes('/auth/v1/user')) return {ok:true, json:async () => ({id:'teacher-1'})};
    openRouterRequest = JSON.parse(init.body);
    return {ok:true, json:async () => ({choices:[{message:{content:JSON.stringify({plan:generatedPlan, warnings:['ครูควรตรวจความเหมาะสมของเวลา']})}}]})};
  };
  try {
    const req = {method:'POST', headers:{authorization:'Bearer test'}, body:{subject:'วิทยาศาสตร์และเทคโนโลยี', grade:'ม.3', topic:'ระบบนิเวศ', duration:'2 คาบ (100 นาที)', method:'สืบเสาะหาความรู้', learnerContext:'นักเรียนพื้นฐานต่างกัน', resources:'มีภาพตัวอย่าง ไม่มีห้องทดลอง', focus:'ให้ใช้หลักฐานอธิบาย', indicators:[{code:'ว 1.1 ม.3/1', text:'อธิบายปฏิสัมพันธ์ในระบบนิเวศ'}]}};
    const res = response();
    await handler(req, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.plan.title, 'แผนเรื่องระบบนิเวศ');
    assert.deepEqual(res.body.warnings, ['ครูควรตรวจความเหมาะสมของเวลา']);
    assert.match(openRouterRequest.messages[0].content, /ใช้เฉพาะตัวชี้วัดและบริบทที่ได้รับ/);
    assert.match(openRouterRequest.messages[1].content, /วิชา: วิทยาศาสตร์และเทคโนโลยี/);
    assert.match(openRouterRequest.messages[1].content, /ระดับชั้น: ม\.3/);
    assert.match(openRouterRequest.messages[1].content, /หัวข้อ: ระบบนิเวศ/);
    assert.match(openRouterRequest.messages[1].content, /ว 1\.1 ม\.3\/1/);
    assert.match(openRouterRequest.messages[1].content, /ตอบกลับเป็น JSON ล้วนตาม schema นี้/);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  }
});

test('lesson plan Word export includes plan frame, indicators and editable teacher notes', async () => {
  const originalFetch = global.fetch;
  const handler = require('../api/_lib/exports/lesson-plan-docx');
  global.fetch = async () => ({ok:true, json:async () => ({id:'teacher-1'})});
  try {
    const lessonPlan = {title:'แผนเรื่องระบบนิเวศ', subject:'วิทยาศาสตร์และเทคโนโลยี', grade:'ม.3', classLabel:'วิทยาศาสตร์และเทคโนโลยี · ม.3/1', duration:'2 คาบ (100 นาที)', method:'สืบเสาะหาความรู้', indicators:[{code:'ว 1.1 ม.3/1', text:'อธิบายปฏิสัมพันธ์ในระบบนิเวศ'}], plan:{title:'แผนเรื่องระบบนิเวศ', keyConcepts:['สิ่งมีชีวิตสัมพันธ์กับสิ่งแวดล้อม'], objectives:['อธิบายองค์ประกอบระบบนิเวศได้'], activities:['ขั้นนำ: ทบทวนภาพระบบนิเวศ'], resources:['ภาพระบบนิเวศ'], assessment:['วิธีประเมิน: ตรวจใบงาน | เครื่องมือ: รูบริก | เกณฑ์: ผ่าน 70%'], evidence:['ใบงาน'], adaptations:['ลดจำนวนตัวอย่างเมื่อเวลาไม่พอ']}};
    const res = response();
    await handler({method:'POST', headers:{authorization:'Bearer test'}, body:{lessonPlan}}, res);
    assert.equal(res.code, 200);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'classkru-plan-'));
    const file = path.join(dir, 'lesson-plan.docx');
    fs.writeFileSync(file, res.body);
    const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'], {encoding:'utf8'});
    assert.match(xml, /แผนการจัดการเรียนรู้/);
    assert.match(xml, /แผนเรื่องระบบนิเวศ/);
    assert.match(xml, /ว 1\.1 ม\.3\/1/);
    assert.match(xml, /บันทึกหลังสอน/);
    assert.match(xml, /w:ascii="TH SarabunPSK"/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('lesson pack Word export includes linked worksheet, quiz and teacher sections', async () => {
  const originalFetch = global.fetch;
  const handler = require('../api/_lib/exports/lesson-pack-docx');
  global.fetch = async () => ({ok:true, json:async () => ({id:'teacher-1'})});
  try {
    const lessonPlan = {title:'แผนเรื่องระบบนิเวศ', subject:'วิทยาศาสตร์และเทคโนโลยี', grade:'ม.3', classLabel:'วิทยาศาสตร์และเทคโนโลยี · ม.3/1', duration:'1 คาบ (50 นาที)', method:'สืบเสาะหาความรู้', indicators:[{code:'ว 1.1 ม.3/1', text:'อธิบายปฏิสัมพันธ์ในระบบนิเวศ'}], plan:{title:'แผนเรื่องระบบนิเวศ', keyConcepts:['สิ่งมีชีวิตสัมพันธ์กับสิ่งแวดล้อม'], objectives:['อธิบายองค์ประกอบระบบนิเวศได้'], activities:['วิเคราะห์ตัวอย่าง'], resources:['ภาพระบบนิเวศ'], assessment:['ตรวจใบงาน'], evidence:['ใบงาน']}};
    const worksheets = [{title:'ใบงานระบบนิเวศ', subject:'วิทยาศาสตร์และเทคโนโลยี', grade:'ม.3', duration:'20 นาที', indicators:lessonPlan.indicators, directions:['ให้นักเรียนวิเคราะห์ภาพ'], tasks:['ระบุความสัมพันธ์ของสิ่งมีชีวิต'], submission:['ส่งคำตอบท้ายใบงาน'], assessmentCriteria:['อธิบายพร้อมหลักฐานอย่างน้อย 2 ข้อ']}];
    const quizzes = [{title:'แบบทดสอบระบบนิเวศ', classLabel:lessonPlan.classLabel, questions:[{type:'multiple_choice', prompt:'ข้อใดเป็นองค์ประกอบของระบบนิเวศ', options:['สิ่งมีชีวิต','ตัวเลข','สี','เสียง'], answerIndex:0, explanation:'สิ่งมีชีวิตเป็นองค์ประกอบหนึ่งของระบบนิเวศ'}]}];
    const res = response();
    await handler({method:'POST', headers:{authorization:'Bearer test'}, body:{lessonPlan, worksheets, quizzes}}, res);
    assert.equal(res.code, 200);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'classkru-pack-'));
    const file = path.join(dir, 'lesson-pack.docx');
    fs.writeFileSync(file, res.body);
    const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'], {encoding:'utf8'});
    assert.match(xml, /ชุดเอกสารประกอบคาบ/);
    assert.match(xml, /ใบงานระบบนิเวศ/);
    assert.match(xml, /แบบทดสอบระบบนิเวศ/);
    assert.match(xml, /เฉลยแบบทดสอบ/);
    assert.match(xml, /เกณฑ์ตรวจใบงาน/);
  } finally {
    global.fetch = originalFetch;
  }
});
