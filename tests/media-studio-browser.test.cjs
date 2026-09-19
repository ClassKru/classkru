'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createServer}=require('../scripts/media-dev.cjs');
const {validateArtifact,render}=require('../api/_lib/media-artifact');
const {checkInBrowser,launchBrowser}=require('../api/_lib/media-check');
const fixture=require('./media-fixture.cjs');
const projectId='00000000-0000-4000-8000-000000000001',versionId='00000000-0000-4000-8000-000000000002',jobId='00000000-0000-4000-8000-000000000003';
const token='a'.repeat(64);
const current={project:{id:projectId,title:'เกมพลังงาน',context:{subject:'วิทยาศาสตร์'},archived:false},turns:[],versions:[],jobs:[],links:[]};
let exists=false,revoked=false,mediaOrigin;
async function mockApi(req,res){
  assert.equal(req.headers.authorization,'Bearer test-session');
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  const action=req.method==='GET'?req.query.action:body.action;
  let data;
  if(action==='config')data={ai:true,storage:true,media_origin:mediaOrigin};
  else if(action==='list')data={projects:exists?[{...current.project,updated_at:new Date().toISOString()}]:[]};
  else if(action==='create'){exists=true;data={project:current.project};}
  else if(action==='get')data=current;
  else if(action==='enqueue'){
    current.turns.push({role:'teacher',message:body.message});current.jobs=[{id:jobId,status:'queued',kind:body.kind}];data={job:current.jobs[0]};
  }else if(action==='run'){
    const kind=current.jobs[0].kind;current.jobs[0].status='succeeded';
    current.turns.push({role:'assistant',message:kind==='plan'?'ให้เด็กปรับความสูงและสังเกตความเร็ว':'สร้างสื่อพร้อมทดลองแล้ว'});
    if(kind==='plan')current.project.plan={title:'ห้องทดลองพลังงาน',objective:'อธิบายการเปลี่ยนรูปพลังงาน',observation:'ความสูงลด ความเร็วเพิ่ม',variables:['ความสูง'],mission:'ทำนายก่อนทดลอง',next_questions:['เพิ่มแรงเสียดทานไหม?']};
    else current.versions=[{id:versionId,title:fixture.title,summary:fixture.summary,review:{browser_check:'passed'}}];
    data={started:true,status:'succeeded'};
  }else if(action==='preview'||action==='publish'){
    if(action==='publish'){assert.equal(body.reviewed,true);current.links=[{id:'link-1',version_id:versionId,url:`${mediaOrigin}/?token=${token}`}];}
    data={url:`${mediaOrigin}/?token=${token}`};
  }else if(action==='revoke'){revoked=true;current.links=[];data={ok:true};}
  else if(action==='archive'){current.project.archived=body.archived;current.links=[];revoked=true;data={ok:true};}
  else throw new Error('Unexpected action '+action);
  res.status(200).json(data);
}
async function main(){
  if(!process.env.MEDIA_BROWSER_EXECUTABLE&&process.platform==='win32')process.env.MEDIA_BROWSER_EXECUTABLE='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const artifact=validateArtifact(fixture);
  const checked=await checkInBrowser(artifact);assert.equal(checked.browser_check,'passed');
  await assert.rejects(checkInBrowser({...artifact,js:'throw new Error("bad fixture");'}),/preview_failed/);
  const harness=`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/01-base-layout.css"><link rel="stylesheet" href="/css/media-studio.css"></head><body><button onclick="openInteractiveMediaStudio()">เปิด Studio</button><script>const supabaseClient={auth:{getSession:async()=>({data:{session:{access_token:'test-session',user:{id:'teacher'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};const appState={classes:[]};</script><script src="/js/media-studio.js"></script></body></html>`;
  const app=createServer({harness,handler:mockApi,publicHandler:(req,res)=>revoked?res.status(404).json({error:'not_found'}):res.status(200).json({...render(artifact),title:artifact.title})});
  const media=createServer({media:true});
  let navigationRequests=0;app.on('request',req=>{if(req.url==='/blocked-navigation')navigationRequests++;});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));await new Promise(resolve=>media.listen(0,'127.0.0.1',resolve));
  const appOrigin=`http://127.0.0.1:${app.address().port}`;mediaOrigin=`http://127.0.0.1:${media.address().port}`;
  process.env.CLASSKRU_APP_ORIGIN=appOrigin;process.env.MEDIA_ORIGIN=mediaOrigin;
  let browser;
  try{
    browser=await launchBrowser();const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setViewport({width:1440,height:1050});
    await page.goto(appOrigin+'/harness');await page.click('button');
    await page.waitForFunction(()=>!document.getElementById('ms-send').disabled);
    await page.type('#ms-input','อยากสร้างเกมพลังงานศักย์และพลังงานจลน์');await page.click('#ms-send');
    await page.waitForFunction(()=>document.getElementById('ms-plan').textContent.includes('ความสูงลด'));
    await page.click('#ms-build');await page.waitForFunction(()=>!document.getElementById('ms-preview').disabled);
    assert.equal(await page.$eval('#ms-publish',el=>el.disabled),true);
    await page.click('#ms-preview');await page.waitForFunction(()=>!!document.querySelector('.ms-preview iframe'));
    const deadline=Date.now()+12000;let game;
    while(Date.now()<deadline){game=page.frames().find(f=>f.url().includes('/api/render?'));if(game&&await game.$('#readout').catch(()=>null))break;await new Promise(r=>setTimeout(r,100));}
    if(!game)console.log('Frame diagnostic:',await Promise.all(page.frames().map(async f=>({url:f.url(),body:await f.evaluate(()=>document.body.textContent.slice(0,600)).catch(()=>'' )}))));
    assert.ok(game,'Game iframe exists');assert.match(await game.$eval('#readout',el=>el.textContent),/9.90/);
    await game.$eval('#height',el=>{el.value=10;el.dispatchEvent(new Event('input'));});
    assert.match(await game.$eval('#readout',el=>el.textContent),/14.01/);
    const isolation=await game.evaluate(async()=>{
      let storage=false,parentAccess=false,network=false;
      try{localStorage.setItem('test','1');}catch(_){storage=true;}
      try{void parent.document.body;}catch(_){parentAccess=true;}
      try{await fetch('https://example.invalid/leak');}catch(_){network=true;}
      return {storage,parentAccess,network};
    });assert.deepEqual(isolation,{storage:true,parentAccess:true,network:true});
    // The trusted parent frame-src policy blocks an untrusted child's own external navigation.
    await game.evaluate(target=>{location.href=target;},appOrigin+'/blocked-navigation');
    await new Promise(r=>setTimeout(r,300));assert.equal(navigationRequests,0,'CSP blocks external navigation before a network request');
    await page.click('.ms-preview button');await page.click('#ms-review');await page.click('#ms-publish');await page.waitForSelector('[data-revoke]');
    fs.mkdirSync(path.join(__dirname,'../test-results'),{recursive:true});
    await page.screenshot({path:path.join(__dirname,'../test-results/media-studio-desktop.png'),fullPage:true});
    await page.click('#ms-close');await page.click('body>button');await page.waitForSelector('[data-project]');await page.click('[data-project]');
    await page.waitForFunction(()=>document.querySelectorAll('.ms-message').length===4);
    await page.setViewport({width:390,height:844});await page.screenshot({path:path.join(__dirname,'../test-results/media-studio-mobile.png'),fullPage:true});
    const overflow=await page.evaluate(()=>document.querySelector('.ms-dialog').scrollWidth>document.querySelector('.ms-dialog').clientWidth+1);assert.equal(overflow,false);
    await page.click('[data-revoke]');await page.waitForFunction(()=>!document.querySelector('[data-revoke]'));
    const visitor=await browser.newPage();await visitor.goto(`${mediaOrigin}/?token=${token}`);
    await visitor.waitForSelector('iframe');
    await new Promise(r=>setTimeout(r,500));const closedFrame=visitor.frames().find(f=>f.parentFrame());
    assert.match(await closedFrame.evaluate(()=>document.body.textContent),/ปิดการแชร์/);
    assert.equal((await fetch(`${mediaOrigin}/api/render?token=${token}`)).status,400);
    assert.deepEqual(errors,[]);
    console.log('Browser QA passed: chat, build, resume, preview, review, publish, revoke, mobile, sandbox, network and navigation isolation');
  }finally{await browser?.close();await Promise.all([new Promise(r=>app.close(r)),new Promise(r=>media.close(r))]);}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
