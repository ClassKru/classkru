'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createServer}=require('../scripts/media-dev.cjs');
const {launchBrowser}=require('../api/_lib/media-check');
const projectId='00000000-0000-4000-8000-000000000001',jobId='00000000-0000-4000-8000-000000000003';
const current={project:{id:projectId,title:'พลังงานกับการเคลื่อนที่',context:{subject:'',classroom:'',goal:'',duration_minutes:15},archived:false},turns:[],versions:[],jobs:[],links:[]};
let exists=false,failNext=false;
async function mockApi(req,res){
  assert.equal(req.headers.authorization,'Bearer test-session');
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  const action=req.method==='GET'?req.query.action:body.action;
  if(['enqueue','run'].includes(action))assert.equal(body.project_id,projectId);
  let data;
  if(action==='config')data={ai:true,storage:true,media_origin:null};
  else if(action==='list')data={projects:exists?[{...current.project,updated_at:new Date().toISOString()}]:[]};
  else if(action==='create'){exists=true;data={project:current.project};}
  else if(action==='get')data=current;
  else if(action==='jobs')data={jobs:current.jobs};
  else if(action==='enqueue'){
    assert.equal(body.kind,'plan');
    assert.equal(body.media_type,undefined);
    failNext=body.message==='ทดสอบข้อผิดพลาด';
    current.turns.push({role:'teacher',message:body.message});current.jobs=[{id:jobId,status:'queued',kind:'plan'}];data={job:current.jobs[0]};
  } else if(action==='run') {
    if(failNext){current.jobs[0].status='failed';current.jobs[0].error_code='ai_request_failed';data={started:true,status:'failed'};return res.status(200).json(data);}
    current.jobs[0].status='succeeded';
    current.turns.push({role:'assistant',message:'ให้เด็กปรับความสูงและสังเกตความเร็ว'});
    current.project.plan={title:'ห้องทดลองพลังงาน',objective:'อธิบายการเปลี่ยนรูปพลังงาน',observation:'ความสูงลด ความเร็วเพิ่ม',variables:['ความสูง'],mission:'ทำนายก่อนทดลอง',next_questions:['เพิ่มแรงเสียดทานไหม?']};
    data={started:true,status:'succeeded'};
  } else throw new Error('Unexpected action '+action);
  res.status(200).json(data);
}
async function main(){
  if(!process.env.MEDIA_BROWSER_EXECUTABLE&&process.platform==='win32')process.env.MEDIA_BROWSER_EXECUTABLE='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const harness=`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/01-base-layout.css"><link rel="stylesheet" href="/css/media-studio.css"></head><body><button onclick="openInteractiveMediaStudio()">เปิด Studio</button><script>const supabaseClient={auth:{getSession:async()=>({data:{session:{access_token:'test-session',user:{id:'teacher'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};</script><script src="/js/media-studio.js"></script></body></html>`;
  const app=createServer({harness,handler:mockApi});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  const appOrigin=`http://127.0.0.1:${app.address().port}`;
  let browser;
  try{
    browser=await launchBrowser();const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setViewport({width:1440,height:900});await page.goto(appOrigin+'/harness');await page.click('button');
    await page.waitForFunction(()=>!document.getElementById('ms-send').disabled);
    assert.equal(await page.$eval('#ms-build',element=>element.disabled),true);
    assert.equal(await page.$$eval('[data-media-type]',elements=>elements.length),3);
    assert.equal(await page.$$eval('[data-starter]',elements=>elements.length),4);
    assert.equal(await page.$$eval('.ms-message',elements=>elements.length),0);
    assert.equal(await page.$eval('#ms-input',element=>element.getAttribute('placeholder')),'เล่าสิ่งที่อยากทำได้เลย ไม่ต้องเขียนเป็นคำสั่ง');
    assert.equal(await page.$eval('#ms-ai-help',element=>!element.hidden),true);
    await page.click('[data-media-type="game"]');assert.equal(await page.$eval('[data-media-type="game"]',element=>element.getAttribute('aria-pressed')),'true');await page.click('[data-media-type="game"]');assert.equal(await page.$eval('[data-media-type="game"]',element=>element.getAttribute('aria-pressed')),'false');
    await page.click('[data-starter="topic"]');assert.equal(await page.$eval('#ms-input',element=>element.placeholder),'กำลังจะสอนเรื่องอะไรครับ?');
    fs.mkdirSync(path.join(__dirname,'../test-results'),{recursive:true});await page.screenshot({path:path.join(__dirname,'../test-results/media-studio-initial-desktop.png'),fullPage:true});
    await page.type('#ms-input','อยากให้นักเรียนเข้าใจพลังงานศักย์และพลังงานจลน์');await page.click('#ms-send');
    await page.waitForFunction(()=>document.querySelectorAll('.ms-message').length===2&&document.getElementById('ms-plan').textContent.includes('ความสูงลด'));
    assert.equal(await page.$eval('#ms-input',element=>element.value),'');
    assert.equal(await page.$eval('#ms-followups',element=>element.textContent),'เพิ่มแรงเสียดทานไหม?');
    fs.mkdirSync(path.join(__dirname,'../test-results'),{recursive:true});await page.screenshot({path:path.join(__dirname,'../test-results/media-studio-desktop.png'),fullPage:true});
    await page.type('#ms-input','ทดสอบข้อผิดพลาด');await page.click('#ms-send');await page.waitForFunction(()=>document.getElementById('ms-job').textContent.includes('ติดต่อ AI ไม่สำเร็จ'));
    assert.equal(await page.$eval('#ms-conversation-view',element=>!element.hidden),true);
    await page.click('#ms-close');await page.setViewport({width:390,height:844});await page.click('body>button');await page.waitForFunction(()=>!document.getElementById('ms-send').disabled);assert.equal(await page.$$eval('.ms-message',elements=>elements.length),0);await page.screenshot({path:path.join(__dirname,'../test-results/media-studio-initial-mobile.png'),fullPage:true});await page.click('#ms-history-toggle');await page.waitForSelector('[data-project]');await page.click('[data-project]');
    await page.waitForFunction(()=>document.querySelectorAll('.ms-message').length===3);
    await page.screenshot({path:path.join(__dirname,'../test-results/media-studio-mobile.png'),fullPage:true});
    const overflow=await page.evaluate(()=>document.querySelector('.ms-dialog').scrollWidth>document.querySelector('.ms-dialog').clientWidth+1);assert.equal(overflow,false);
    assert.deepEqual(errors,[]);
    console.log('Browser QA passed: chat, automatic AI reply, conversation resume, guidance panel and mobile layout');
  }finally{await browser?.close();await new Promise(resolve=>app.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
