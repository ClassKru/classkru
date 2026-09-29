'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const crypto=require('node:crypto');
const {validateArtifact,hash,render}=require('../api/_lib/media-artifact');
const fixture=require('./media-fixture.cjs');
const service=require('../api/_lib/media-service');
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
  process.env.CLASSKRU_APP_ORIGIN='https://app.example.test';process.env.MEDIA_ORIGIN='https://app.example.test';
  assert.throws(()=>service.mediaOrigin());process.env.MEDIA_ORIGIN='https://media.example.test';assert.equal(service.mediaOrigin(),'https://media.example.test');
});
test('real SQL: owner isolation, idempotent jobs, queue claims, immutable versions, publish and revoke',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key); grant usage on schema auth to authenticated;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
    await db.exec(fs.readFileSync(require.resolve('../supabase/migrations/202609190001_media_studio.sql'),'utf8'));
    const a=crypto.randomUUID(),b=crypto.randomUUID();
    await db.query('insert into auth.users values ($1),($2)',[a,b]);
    const create=await db.query('select * from media_create_project($1,$2,$3)',[a,'ครู A','{}']);const project=create.rows[0].id;
    const projectB=(await db.query('select * from media_create_project($1,$2,$3)',[b,'ครู B','{}'])).rows[0].id;
    await assert.rejects(db.query('select * from media_enqueue($1,$2,$3,$4,$5)',[b,project,'build','สร้างเกม',crypto.randomUUID()]),/not_found/);
    const key=crypto.randomUUID();
    const enqueue=()=>db.query('select * from media_enqueue($1,$2,$3,$4,$5)',[a,project,'build','สร้างเกม',key]);
    const job=(await enqueue()).rows[0];assert.equal((await enqueue()).rows[0].id,job.id);
    assert.equal((await db.query('select count(*)::int as n from media_turns')).rows[0].n,1);
    await assert.rejects(db.query('select * from media_enqueue($1,$2,$3,$4,$5)',[a,project,'build','สร้างอีก',crypto.randomUUID()]),/project_busy/);
    const claim=crypto.randomUUID();
    assert.equal((await db.query('select * from media_claim($1,$2,$3)',[b,job.id,claim])).rows.length,0);
    assert.equal((await db.query('select * from media_claim($1,$2,$3)',[a,job.id,claim])).rows.length,1);
    assert.equal((await db.query('select * from media_claim($1,$2,$3)',[a,job.id,crypto.randomUUID()])).rows.length,0);
    const version={id:crypto.randomUUID(),title:'สื่อ',summary:'ทดสอบ',storage_path:`${a}/${project}/v.json`,sha256:'a'.repeat(64),review:{browser_check:'passed',policy_version:1}};
    const finish=await db.query('select media_finish($1,$2,$3,$4,$5,$6) as ok',[a,job.id,claim,'สร้างแล้ว',null,JSON.stringify(version)]);assert.equal(finish.rows[0].ok,true);
    assert.equal((await db.query('select media_finish($1,$2,$3,$4,$5,$6) as ok',[a,job.id,claim,'ซ้ำ',null,JSON.stringify(version)])).rows[0].ok,false);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${b}';`);
    assert.equal((await db.query('select * from media_projects')).rows.length,1);
    assert.equal((await db.query('select * from media_versions')).rows.length,0);
    await assert.rejects(db.query("update media_projects set title='hacked' where id=$1",[project]),/permission denied/);
    await assert.rejects(db.query('select * from media_create_project($1,$2,$3)',[a,'forged','{}']),/permission denied/);
    await db.exec('reset role');
    await assert.rejects(db.query('select * from media_publish($1,$2,$3)',[b,version.id,'b'.repeat(64)]),/not_found/);
    const published=(await db.query('select * from media_publish($1,$2,$3)',[a,version.id,'b'.repeat(64)])).rows[0];
    assert.equal((await db.query('select * from media_publish($1,$2,$3)',[a,version.id,'c'.repeat(64)])).rows[0].id,published.id);
    await db.query('select media_archive($1,$2,true)',[a,project]);
    assert.ok((await db.query('select revoked_at from media_links')).rows[0].revoked_at);
    assert.equal((await db.query('select count(*)::int as n from media_versions')).rows[0].n,1);
    // Student sessions cannot enumerate metadata or bundles.
    await db.exec('set role anon');await assert.rejects(db.query('select * from media_links'),/permission denied/);await db.exec('reset role');
    assert.ok(projectB);
  } finally{await db.close();}
});
test('HTTP rejects unauthenticated requests and cross-origin writes',async()=>{
  const handler=require('../api/media-studio');
  const recorder=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;}});
  let res=recorder();await handler({method:'POST',headers:{host:'app.test',origin:'https://evil.test'},body:{}},res);assert.equal(res.statusCode,403);
  res=recorder();await handler({method:'POST',headers:{host:'app.test'},body:{}},res);assert.equal(res.statusCode,401);
});
