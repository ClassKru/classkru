'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function response() {
  return { headers:{}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
}

test('quiz generation requests concise explanations tailored to each question', async t => {
  const oldKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-key';
  t.after(() => { if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = oldKey; });

  let aiRequest;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).endsWith('/auth/v1/user')) return { ok:true, json:async () => ({ id:'teacher-test' }) };
    aiRequest = JSON.parse(options.body);
    return { ok:true, json:async () => ({ choices:[{ message:{ content:JSON.stringify({ questions:[
      { type:'multiple_choice', prompt:'คำนวณระยะทางเมื่อเดินทาง 3 ชั่วโมงด้วยความเร็ว 4 เมตรต่อวินาที', options:['12 เมตร','43,200 เมตร','7 เมตร','1.3 เมตร'], answerIndex:1, explanation:'ระยะทาง = ความเร็ว × เวลา = 4 × (3 × 3,600) = 43,200 เมตร' },
      { type:'short_answer', prompt:'อธิบายว่าเหตุใดพืชจึงต้องได้รับแสง', answer:'เพื่อสังเคราะห์ด้วยแสง', explanation:'พืชใช้พลังงานแสงในการสังเคราะห์ด้วยแสงเพื่อสร้างอาหาร' }
    ]}) } }] }) };
  });

  const handler = require('../api/ai/generate-quiz');
  const res = response();
  await handler({ method:'POST', headers:{ host:'classkru.test', authorization:'Bearer test-token' }, body:{
    subject:'วิทยาศาสตร์', grade:'ม.2', sourceType:'topic', source:'การเคลื่อนที่และการสังเคราะห์ด้วยแสง', questionCount:2, types:['multiple_choice','short_answer']
  } }, res);

  assert.equal(res.code, 200);
  assert.match(aiRequest.messages[0].content, /ทุกข้อ ต้องมี explanation/);
  assert.match(aiRequest.messages[0].content, /ถ้ามีการคำนวณ.*ขั้นคำนวณสำคัญ/);
  assert.match(aiRequest.messages[0].content, /โจทย์แนวคิดหรือบรรยาย.*หลักการ/);
  assert.match(aiRequest.messages[0].content, /โจทย์ผสม.*ทั้งวิธีคำนวณและเหตุผล/);
  assert.deepEqual(res.body.questions.map(question => question.explanation), [
    'ระยะทาง = ความเร็ว × เวลา = 4 × (3 × 3,600) = 43,200 เมตร',
    'พืชใช้พลังงานแสงในการสังเคราะห์ด้วยแสงเพื่อสร้างอาหาร'
  ]);
});
