const {test} = require('node:test');
const assert = require('node:assert/strict');
const {normalize,html} = require('../js/worksheet-layout');
const {createWorksheetDocument} = require('../api/_lib/worksheet-document');
const {Packer} = require('docx');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const raw = {title:'จำนวนจริง: จำแนกและอธิบาย',directions:['จำแนกจำนวนที่กำหนด แล้วอธิบายเหตุผล'],blocks:[{type:'table',title:'จำแนกจำนวน',instruction:'เขียนว่าเป็นจำนวนตรรกยะหรืออตรรกยะ พร้อมอธิบายเหตุผล',columns:['จำนวน','ประเภท','เหตุผล'],rows:[['−3',null,null],['0.25',null,null],['√2',null,null],['0.333…',null,null]],answer:'แถว 1: ตรรกยะ เขียนเป็น −3/1 ได้; แถว 2: ตรรกยะ เท่ากับ 1/4; แถว 3: อตรรกยะ ไม่สามารถเขียนเป็นอัตราส่วนจำนวนเต็มได้; แถว 4: ตรรกยะ เพราะเท่ากับ 1/3'}]};
const options = {itemCount:4,answerSpace:'long',answerKey:'yes',worksheetType:'table'};
const fixture = {subject:'คณิตศาสตร์',grade:'ม.2',duration:'1 คาบ',indicators:[{code:'ค 1.1 ม.2/2'}],...options,worksheet:normalize(raw,options)};
module.exports = {fixture};
test('structured worksheet preserves blanks, enforces count and separates answers',()=>{
  assert.equal(fixture.worksheet.blocks[0].rows[0][1],null);
  assert.equal(fixture.worksheet.blocks[0].lines,4);
  assert.throws(()=>normalize(raw,{...options,itemCount:8}),/จำนวนข้อ/);
  const invalid = structuredClone(raw); invalid.blocks[0].rows[0] = ['3','ตรรกยะ','เหตุผล'];
  assert.throws(()=>normalize(invalid,options),/ช่องว่าง/);
  const noKey = normalize(raw,{...options,answerKey:'no'});
  assert.ok(noKey.blocks.every(b=>!b.answer));
  const rendered = html(fixture);
  assert.match(rendered,/<table>/);
  assert.ok(!rendered.split('</article>')[0].includes('ตรรกยะ เขียนเป็น'));
  const hostile = structuredClone(fixture); hostile.worksheet.blocks[0].rows[0][0] = '<img src=x onerror=alert(1)>';
  assert.ok(!html(hostile).includes('<img'));
});
test('Word contains editable table, blank cells and teacher page break',async()=>{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'classkru-worksheet-'));
  const file = path.join(dir,'worksheet.docx');
  fs.writeFileSync(file,await Packer.toBuffer(createWorksheetDocument(fixture)));
  const xml = execFileSync('unzip',['-p',file,'word/document.xml'],{encoding:'utf8'});
  assert.match(xml,/<w:tbl>/); assert.match(xml,/<w:pageBreakBefore\/>/);
  assert.match(xml,/จำแนกจำนวน/); assert.match(xml,/เฉลย/);
  console.log('Worksheet sample:',file);
});
test('API passes structured output through validation and rejects incomplete content',async()=>{
  const originalFetch = global.fetch; const originalKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-placeholder';
  const handler = require('../api/ai/generate-worksheet');
  let output = raw; let called=0;
  global.fetch = async (url,init)=>{
    if (url.includes('/auth/v1/user')) return {ok:true,json:async()=>({id:'test-user'})};
    called++; const request = JSON.parse(init.body);
    assert.match(request.messages[1].content,/จำนวนข้อ\/แถวที่นักเรียนต้องทำรวมทั้งหมด/);
    assert.match(request.messages[1].content,/แบบพอดี/);
    assert.match(request.messages[1].content,/table เพียง 1 บล็อก/);
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({worksheet:output})}}]})};
  };
  const response = ()=>({setHeader(){},status(n){this.code=n;return this;},json(b){this.body=b;}});
  try {
    const req={method:'POST',headers:{authorization:'Bearer test'},body:{...fixture,title:raw.title}};
    const good=response(); await handler(req,good); assert.equal(good.code,200); assert.equal(good.body.worksheet.version,2);
    output={title:'incomplete',directions:['do something'],tasks:['make a table']};
    const bad=response(); await handler(req,bad); assert.equal(bad.code,502); assert.equal(called,2);
  } finally {global.fetch=originalFetch; if(originalKey===undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY=originalKey;}
});
