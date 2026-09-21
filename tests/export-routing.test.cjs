'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const handler=require('../api/exports');
const kinds=['worksheet-docx','quiz-docx','lesson-plan-docx','lesson-pack-docx'];
function response(){return {headers:{},setHeader(key,value){this.headers[key]=value;},status(code){this.code=code;return this;},json(body){this.body=body;},send(body){this.body=body;}};}
function request(document,options={}){return {method:'POST',headers:{},query:{document},body:{},...options};}
test('export route is an allowlist, retains authentication, method and origin checks',async()=>{
  for(const value of [undefined,'../_lib/http','__proto__','constructor',['quiz-docx']]){
    const res=response();await handler(request(value),res);assert.equal(res.code,404);
  }
  for(const kind of kinds){
    let res=response();await handler(request(kind),res);assert.equal(res.code,401);
    res=response();await handler(request(kind,{method:'GET'}),res);assert.equal(res.code,405);
    res=response();await handler(request(kind,{headers:{host:'classkru.test',origin:'https://other.test'}}),res);assert.equal(res.code,403);
  }
});
test('all four existing document formats still download through the shared function',async t=>{
  t.mock.method(globalThis,'fetch',async url=>{assert.match(String(url),/\/auth\/v1\/user$/);return {ok:true,json:async()=>({id:'test-teacher'})};});
  const bodies={
    'worksheet-docx':{worksheet:{title:'ใบงานพลังงาน',directions:['ทดลองแล้วอธิบาย'],tasks:['เปรียบเทียบความเร็ว']}},
    'quiz-docx':{quiz:{title:'ข้อสอบพลังงาน',questions:[{type:'short_answer',prompt:'พลังงานจลน์คืออะไร',answer:'พลังงานจากการเคลื่อนที่'}]}},
    'lesson-plan-docx':{lessonPlan:{title:'แผนพลังงาน',plan:{title:'แผนพลังงาน',activities:['ปรับความสูง']}}},
    'lesson-pack-docx':{lessonPlan:{title:'ชุดเอกสารพลังงาน',plan:{title:'ชุดเอกสารพลังงาน'}},worksheets:[],quizzes:[]}
  };
  for(const kind of kinds){
    const res=response();await handler(request(kind,{headers:{authorization:'Bearer fixture'},body:bodies[kind]}),res);
    assert.equal(res.code,200,kind);assert.ok(Buffer.isBuffer(res.body));assert.equal(res.body.subarray(0,2).toString(),'PK');
    assert.match(res.headers['Content-Type'],/wordprocessingml/);assert.match(res.headers['Content-Disposition'],/^attachment;/);
    assert.equal(res.headers['Cache-Control'],'no-store, private');
  }
});
test('Vercel retains the old export URLs and stays within the Hobby function count',()=>{
  const root=path.resolve(__dirname,'..'),config=require('../vercel.json');
  assert.ok(config.rewrites.some(rule=>rule.source==='/api/exports/:document'&&rule.destination==='/api/exports?document=:document'));
  const functions=[];
  function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(/^[_.]/.test(entry.name))continue;
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())visit(file);else if(/\.(?:[cm]?js|ts|py|go|rb)$/.test(entry.name))functions.push(path.relative(root,file));
  }}
  visit(path.join(root,'api'));assert.ok(functions.length<=12,`Too many Vercel functions (${functions.length}): ${functions.join(', ')}`);
  assert.equal(functions.filter(file=>file.replace(/\\/g,'/').startsWith('api/exports/')).length,1);
  for(const kind of kinds)assert.equal(fs.existsSync(path.join(root,'api/exports',kind+'.js')),false);
  console.log(`Vercel function count: ${functions.length}/12`);
});
