'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
// Exercises the real REST adapter + encryption; only the external HTTP service
// is substituted. No SQL server, paid AI calls or production writes.
module.exports=function storageFixture(t) {
  const names=['SUPABASE_SECRET_KEY','MEDIA_STORAGE_KEY','MEDIA_STORAGE_BUCKET','MEDIA_ORIGIN','CLASSKRU_APP_ORIGIN'];
  const before=Object.fromEntries(names.map(k=>[k,process.env[k]]));
  process.env.SUPABASE_SECRET_KEY='sb_secret_test_only';process.env.MEDIA_STORAGE_KEY=crypto.randomBytes(32).toString('hex');
  process.env.MEDIA_STORAGE_BUCKET='classkru-media-files';process.env.MEDIA_ORIGIN='https://media.test';process.env.CLASSKRU_APP_ORIGIN='https://app.test';
  t.after(()=>{for(const k of names) if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];});
  const objects=new Map(),meta=new Map(),calls=[];
  let bucket=null,clock=Date.now();
  const fixture={objects,calls,sessions:new Map(),failAfter:null,get bucket(){return bucket;},set bucket(v){bucket=v;}};
  const reply=(status,value)=>({ok:status>=200&&status<300,status,json:async()=>structuredClone(value)});
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    const path=new URL(url).pathname.replace('/storage/v1/',''),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;
    calls.push({path,method,body});
    if(path==='/auth/v1/user') {
      const owner=fixture.sessions.get(options.headers.Authorization);
      return owner?reply(200,{id:owner,email:'teacher@example.test'}):reply(401,{});
    }
    assert.equal(options.headers.apikey,'sb_secret_test_only');assert.equal(options.headers.Authorization,undefined);
    if(path==='bucket'&&method==='POST') {
      if(bucket)return reply(409,{code:'Duplicate'});
      bucket=body;return reply(200,body);
    }
    if(path==='bucket/classkru-media-files') return bucket?reply(200,bucket):reply(400,{code:'NoSuchBucket',message:'Bucket not found'});
    if(!bucket)return reply(404,{code:'NoSuchBucket'});
    if(path==='object/list/classkru-media-files') {
      let rows=[...meta.values()].filter(r=>r.path.startsWith(`${body.prefix}/`)&&!r.path.slice(body.prefix.length+1).includes('/')&&r.name.includes(body.search||''));
      rows.sort((a,b)=>String(a[body.sortBy.column]).localeCompare(String(b[body.sortBy.column]))*(body.sortBy.order==='desc'?-1:1));
      return reply(200,rows.slice(body.offset||0,(body.offset||0)+body.limit));
    }
    const prefix=method==='GET'?'object/authenticated/classkru-media-files/':'object/classkru-media-files/';
    assert.ok(path.startsWith(prefix),path);
    const name=path.slice(prefix.length);
    if(method==='GET') return objects.has(name)?reply(200,objects.get(name)):reply(400,{code:'NoSuchKey',message:'Object not found'});
    assert.equal(method,'POST','storage implementation must never overwrite or delete');
    assert.equal(options.headers['x-upsert'],'false');
    if(objects.has(name))return reply(400,{code:'ResourceAlreadyExists',message:'The resource already exists'});
    objects.set(name,structuredClone(body));meta.set(name,{id:crypto.randomUUID(),name:name.split('/').at(-1),path:name,created_at:new Date(++clock).toISOString()});
    if(fixture.failAfter?.(name)){fixture.failAfter=null;throw new Error('connection lost after upload');}
    return reply(200,{Key:name});
  });
  return fixture;
};
