'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const handler=require('../media-host/api/render');
const token='a'.repeat(64),secret='fixture-app-bypass-secret-not-a-real-credential';
const payload={html:'<!doctype html><p>สื่อทดสอบ</p>',csp:"default-src 'none'; sandbox allow-scripts",policy_version:1};

function setup(t,overrides={}) {
  const values={NODE_ENV:'production',CLASSKRU_APP_ORIGIN:'https://app.example.test',CLASSKRU_APP_BYPASS_SECRET:secret,VERCEL_AUTOMATION_BYPASS_SECRET:'fixture-media-project-secret',...overrides};
  const previous=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));
  for(const [key,value] of Object.entries(values)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  t.after(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
}
function request(overrides={}) {
  return {method:'GET',headers:{host:'media.example.test','sec-fetch-dest':'iframe'},query:{token},...overrides};
}
function response() {
  return {headers:{},setHeader(key,value){this.headers[key.toLowerCase()]=value;},status(value){this.statusCode=value;return this;},send(value){this.body=value;return this;}};
}
function assertPrivate(res) {
  const output=JSON.stringify(res);
  assert.ok(!output.includes(secret));
  assert.ok(!output.includes('fixture-media-project-secret'));
  assert.equal(res.headers['set-cookie'],undefined);
  assert.equal(res.headers.location,undefined);
  assert.equal(res.headers['x-vercel-protection-bypass'],undefined);
  assert.equal(res.headers['cache-control'],'no-store');
}

test('media host sends only the app bypass header to its configured fixed endpoint',async t=>{
  setup(t);
  const fetchMock=t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,`https://app.example.test/api/media-studio/public?token=${token}`);
    assert.deepEqual(options.headers,{Accept:'application/json','x-vercel-protection-bypass':secret});
    assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.ok(options.signal instanceof AbortSignal);
    return {ok:true,status:200,headers:new Headers({'set-cookie':`bypass=${secret}`}),json:async()=>payload};
  });
  const req=request();
  req.headers.cookie='teacher-session=private';req.headers.authorization='Bearer private';
  req.headers['x-vercel-protection-bypass']='attacker';req.headers['x-vercel-set-bypass-cookie']='true';
  req.headers['x-forwarded-host']='evil.example';
  Object.assign(req.query,{origin:'https://evil.example',url:'https://evil.example/private','x-vercel-protection-bypass':'attacker'});
  const res=response();await handler(req,res);
  assert.equal(fetchMock.mock.callCount(),1);assert.equal(res.statusCode,200);assert.equal(res.body,payload.html);
  assert.match(res.headers['content-security-policy'],/frame-ancestors 'self' https:\/\/app\.example\.test$/);
  assertPrivate(res);
});

test('public production and local development still work without an app bypass secret',async t=>{
  setup(t,{CLASSKRU_APP_BYPASS_SECRET:undefined});
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.deepEqual(options.headers,{Accept:'application/json'});
    assert.equal(options.headers['x-vercel-protection-bypass'],undefined,'never use the media project automatic secret');
    return {ok:true,json:async()=>payload};
  });
  for(const origin of ['https://app.example.test','http://127.0.0.1:3511',undefined]) {
    process.env.NODE_ENV='development';
    if(origin===undefined)delete process.env.CLASSKRU_APP_ORIGIN;else process.env.CLASSKRU_APP_ORIGIN=origin;
    const res=response();await handler(request(),res);assert.equal(res.statusCode,200);assertPrivate(res);
  }
});

test('bypass fails closed before fetch for unsafe or ambiguous origin configuration',async t=>{
  setup(t);
  const fetchMock=t.mock.method(globalThis,'fetch',async()=>{throw new Error('must not fetch');});
  for(const origin of [undefined,'','http://app.example.test','http://127.0.0.1:3511','https://localhost','https://[::1]','https://user:pass@app.example.test','https://app.example.test/path','https://app.example.test/?x=1','https://app.example.test/#fragment','https://media.example.test','not-a-url']) {
    if(origin===undefined)delete process.env.CLASSKRU_APP_ORIGIN;else process.env.CLASSKRU_APP_ORIGIN=origin;
    process.env.NODE_ENV='development';
    const res=response();await handler(request(),res);assert.equal(res.statusCode,503);assertPrivate(res);
  }
  process.env.CLASSKRU_APP_ORIGIN='https://app.example.test';
  for(const value of [' leading-space-secret','trailing-space-secret ',`${secret}\r\nx-test: injected`,'short','x'.repeat(4097)]) {
    process.env.CLASSKRU_APP_BYPASS_SECRET=value;
    const res=response();await handler(request(),res);assert.equal(res.statusCode,503);assertPrivate(res);
  }
  assert.equal(fetchMock.mock.callCount(),0);
});

test('invalid player requests never reach the protected app',async t=>{
  setup(t);const fetchMock=t.mock.method(globalThis,'fetch',async()=>{throw new Error('must not fetch');});
  for(const req of [request({method:'POST'}),request({query:{token:'invalid'}}),request({headers:{host:'media.example.test'}}),request({query:{token:`${token}&url=https://evil.example`}})]) {
    const res=response();await handler(req,res);assert.equal(res.statusCode,400);assertPrivate(res);
  }
  assert.equal(fetchMock.mock.callCount(),0);
});

test('upstream errors, login redirects and exceptions do not expose headers or credentials',async t=>{
  setup(t);let upstreamStatus=302;
  const fetchMock=t.mock.method(globalThis,'fetch',async()=>({ok:false,status:upstreamStatus,headers:new Headers({location:`https://evil.example/${secret}`,'set-cookie':secret}),json:async()=>{throw new Error('must not parse error body');}}));
  for(const status of [302,401,403,404,500]) {
    upstreamStatus=status;const res=response();await handler(request(),res);
    assert.equal(res.statusCode,status===404?404:503);assertPrivate(res);
  }
  const logs=t.mock.method(console,'error',()=>{});
  fetchMock.mock.mockImplementation(async()=>{throw new Error(`upstream failure ${secret}`);});
  const res=response();await handler(request(),res);assert.equal(res.statusCode,503);assertPrivate(res);assert.equal(logs.mock.callCount(),0);
});

test('malformed bundles and upstream credential reflections are rejected',async t=>{
  setup(t);let bundle;
  t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>bundle}));
  for(const value of [{...payload,html:secret},{...payload,csp:payload.csp+`; report-uri https://evil.example/${secret}`},{...payload,policy_version:2},{...payload,csp:"default-src 'none'"},{...payload,html:null},{...payload,html:'x'.repeat(524289)}]) {
    bundle=value;const res=response();await handler(request(),res);assert.equal(res.statusCode,503);assertPrivate(res);
  }
});

test('native fetch refuses an upstream redirect without sending the bypass to its destination',async t=>{
  setup(t);const nativeFetch=globalThis.fetch;let destinationHits=0,upstreamHits=0;
  const server=http.createServer((req,res)=>{
    if(req.url==='/capture'){destinationHits++;res.end('unexpected');return;}
    upstreamHits++;assert.equal(req.headers['x-vercel-protection-bypass'],secret);
    res.writeHead(302,{Location:`http://127.0.0.1:${server.address().port}/capture`});res.end();
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  // Only this test transport maps the configured HTTPS app to a local fixture.
  t.mock.method(globalThis,'fetch',(url,options)=>{
    assert.equal(new URL(url).origin,'https://app.example.test');
    return nativeFetch(`http://127.0.0.1:${server.address().port}/redirect`,options);
  });
  const res=response();await handler(request(),res);
  assert.equal(res.statusCode,503);assert.equal(upstreamHits,1);assert.equal(destinationHits,0);assertPrivate(res);
});
