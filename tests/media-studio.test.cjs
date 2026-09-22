'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateArtifact,hash,render}=require('../api/_lib/media-artifact');
const fixture=require('./media-fixture.cjs');
const service=require('../api/_lib/media-service');
test('server browser retains web/site isolation and receives no AI/database credentials',t=>{
  const {serverLaunchArgs,browserEnvironment}=require('../api/_lib/media-check');
  for(const flag of ['--disable-web-security','--disable-site-isolation-trials','--single-process','--allow-running-insecure-content'])assert.ok(!serverLaunchArgs.includes(flag));
  assert.ok(serverLaunchArgs.includes('--site-per-process'));
  const keys=['CLASSKRU_TEST_SECRET','CLASSKRU_APP_BYPASS_SECRET','VERCEL_AUTOMATION_BYPASS_SECRET'];
  const old=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  for(const key of keys)process.env[key]='must-not-reach-browser';
  t.after(()=>{for(const key of keys){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}});
  for(const key of keys)assert.equal(browserEnvironment()[key],undefined);
  assert.equal(browserEnvironment().OPENROUTER_API_KEY,undefined);assert.equal(browserEnvironment().SUPABASE_SECRET_KEY,undefined);
});
test('artifact policy rejects executable markup, external CSS and forbidden APIs',()=>{
  const artifact=validateArtifact(fixture);assert.equal(hash(artifact).length,64);
  for(const html of ['<script>alert(1)</script>','<img src="https://evil.test">','<svg><foreignObject>bad</foreignObject></svg>','<button onclick="alert(1)">x</button>','<input type="password">'])assert.throws(()=>validateArtifact({...fixture,html}));
  for(const js of ['fetch("/api");','new Function("return 1")();','import("x");','top.location="https://evil.test"','const = 1;'])assert.throws(()=>validateArtifact({...fixture,js}));
  assert.throws(()=>validateArtifact({...fixture,css:'body{background:url(https://evil.test)}'}));
  const output=render(artifact);assert.match(output.csp,/sandbox allow-scripts/);assert.match(output.csp,/connect-src 'none'/);assert.doesNotMatch(output.csp,/allow-same-origin/);
  assert.notEqual(render(artifact).csp,output.csp);
});
test('context strips personal fields and media origin cannot be app origin',()=>{
  assert.deepEqual(Object.keys(service.context({students:['private'],subject:'วิทยาศาสตร์'})),['subject','classroom','goal','duration_minutes']);
  assert.equal(service.mediaType('game'),'game');assert.equal(service.mediaType(undefined),'');assert.throws(()=>service.mediaType('video'),{code:'invalid_media_type'});
  process.env.CLASSKRU_APP_ORIGIN='https://app.example.test';process.env.MEDIA_ORIGIN='https://app.example.test';
  assert.throws(()=>service.mediaOrigin());process.env.MEDIA_ORIGIN='https://media.example.test';assert.equal(service.mediaOrigin(),'https://media.example.test');
});
test('AI adapter reuses OpenRouter, keeps keys server-side and fails closed on incomplete output',async t=>{
  const ai=require('../api/_lib/media-ai');
  const names=['OPENROUTER_API_KEY','OPENAI_API_KEY','OPENROUTER_MEDIA_MODEL'];
  const old=Object.fromEntries(names.map(key=>[key,process.env[key]]));
  t.after(()=>{for(const key of names){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}});
  process.env.OPENROUTER_API_KEY='test-router-key';process.env.OPENAI_API_KEY='test-openai-key';process.env.OPENROUTER_MEDIA_MODEL='test-model';
  let endpoint,request;
  const fetchMock=t.mock.method(globalThis,'fetch',async(url,options)=>{endpoint=url;request=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(fixture)}}]})};});
  assert.deepEqual(await ai.ask('build',{message:'สร้างเกม'}),fixture);
  assert.equal(endpoint,'https://openrouter.ai/api/v1/chat/completions');assert.equal(request.model,'test-model');
  assert.deepEqual(request.provider,{data_collection:'deny',require_parameters:true});
  assert.equal(request.response_format.type,'json_schema');assert.equal(request.response_format.json_schema.strict,true);
  assert.equal(request.response_format.json_schema.name,'teaching_artifact');assert.ok(!JSON.stringify(request).includes('test-router-key'));
  fetchMock.mock.mockImplementation(async()=>({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:'{}'}}]})}));
  await assert.rejects(ai.ask('build',{}),{code:'ai_incomplete'});
  delete process.env.OPENROUTER_API_KEY;
  fetchMock.mock.mockImplementation(async(url,options)=>{endpoint=url;request=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output_text:JSON.stringify(fixture)})};});
  await ai.ask('build',{});assert.equal(endpoint,'https://api.openai.com/v1/responses');assert.equal(request.store,false);assert.equal(request.text.format.strict,true);
  delete process.env.OPENAI_API_KEY;await assert.rejects(ai.ask('plan',{}),{code:'ai_not_configured'});
});
test('Media Studio planner uses its dedicated key and structured brief schema',async t=>{
  const planner=require('../api/_lib/media-planner-ai');
  const names=['OPENROUTER_MEDIA_PLANNER_API_KEY','OPENROUTER_MEDIA_PLANNER_MODEL','OPENROUTER_API_KEY'];
  const old=Object.fromEntries(names.map(key=>[key,process.env[key]]));
  t.after(()=>{for(const key of names){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}});
  process.env.OPENROUTER_MEDIA_PLANNER_API_KEY='planner-secret';process.env.OPENROUTER_MEDIA_PLANNER_MODEL='planner-model';delete process.env.OPENROUTER_API_KEY;
  let request,auth;
  const fetchMock=t.mock.method(globalThis,'fetch',async(url,options)=>{request=JSON.parse(options.body);auth=options.headers.Authorization;return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({assistant_message:'เริ่มจากหัวข้อนี้ได้เลย',media_brief:{topic:'ระบบสุริยะ',audience:'',learning_message:'',media_type:'',concept:'',content_structure:'',visual_direction:'',interaction_direction:'',tone:'',constraints:[]},suggested_directions:[],open_questions:['อยากสร้างเป็นสื่อแบบไหน'],ready_to_build:false})}}]})};});
  const result=await planner.ask({message:'ระบบสุริยะ',conversation:[],current_brief:{},selected_media_type:''});
  assert.equal(result.media_brief.topic,'ระบบสุริยะ');assert.equal(request.model,'planner-model');assert.equal(request.response_format.json_schema.name,'media_studio_planner');assert.equal(request.response_format.json_schema.strict,true);assert.equal(auth,'Bearer planner-secret');
  fetchMock.mock.restore();
});
test('HTTP rejects unauthenticated requests and cross-origin writes',async()=>{
  const handler=require('../api/media-studio');
  const recorder=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;}});
  let res=recorder();await handler({method:'POST',headers:{host:'app.test',origin:'https://evil.test'},body:{}},res);assert.equal(res.statusCode,403);
  res=recorder();await handler({method:'POST',headers:{host:'app.test'},body:{}},res);assert.equal(res.statusCode,401);
});
