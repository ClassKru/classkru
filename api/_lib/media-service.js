'use strict';
const crypto=require('node:crypto');
const db=require('./media-db');
const {id,base,key,project,publicArtifact}=require('./media-records');
const leases=require('./media-lease');
const ai=require('./media-ai');
const artifactTools=require('./media-artifact');
function text(value,max) { return String(value||'').trim().slice(0,max); }
function context(value={}) { return {subject:text(value?.subject,100),classroom:text(value?.classroom,100),goal:text(value?.goal,800),duration_minutes:Math.max(3,Math.min(180,Number(value?.duration_minutes)||15))}; }
function mediaType(value) {
  if (value===undefined || value===null || value==='') return '';
  if (!['image','motion','game'].includes(value)) throw db.fail('invalid_media_type');
  return value;
}
function mediaOrigin() {
  const value=process.env.MEDIA_ORIGIN,app=process.env.CLASSKRU_APP_ORIGIN||'https://classkru-kohl.vercel.app';
  if(!value) throw db.fail('media_host_not_configured',503);
  let url;try {url=new URL(value);} catch(_){throw db.fail('media_host_not_configured',503);}
  const local=process.env.NODE_ENV!=='production' && ['127.0.0.1','localhost'].includes(url.hostname);
  if((!local&&url.protocol!=='https:')||url.origin===new URL(app).origin||url.username||url.password||url.pathname!=='/'||url.search||url.hash) throw db.fail('invalid_media_origin',503);
  return url.origin;
}
const now=()=>new Date().toISOString();
const linkUrl=link=>`${mediaOrigin()}/?token=${link.token}`;
async function list(teacher,archived=false) {
  const rows=await db.list(`${base(teacher)}/projects`,{limit:100});
  const result=[];
  for(let i=0;i<rows.length;i+=8) result.push(...await Promise.all(rows.slice(i,i+8).map(row=>project(teacher,row.name.slice(0,-5)))));
  return result.filter(p=>p.archived===archived).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
}
async function create(teacher,title,value) {
  id(teacher);await db.ensureBucket();
  return leases.admission(teacher,async()=>{
    if((await db.list(`${base(teacher)}/projects`,{limit:100})).length>=100) throw db.fail('project_limit',429);
    const result={id:crypto.randomUUID(),title:text(title,120)||'สื่อใหม่',context:context(value),archived:false,share_epoch:crypto.randomUUID(),created_at:now(),updated_at:now()};
    await db.put(`${base(teacher)}/projects/${result.id}.json`,result);
    return result;
  });
}
async function outcome(teacher,job) { return await db.get(`${base(teacher)}/results/${job.kind}/${key(job.project_id,job.id)}`)||await db.get(`${base(teacher)}/results/failed/${key(job.project_id,job.id)}`); }
async function status(teacher,job,p) {
  const result=await outcome(teacher,job);
  if(result) return {...job,...result};
  if(p && (p.archived||p.share_epoch!==job.share_epoch)) return {...job,status:'failed',error_code:'project_archived'};
  const claim=await db.get(`${base(teacher)}/claims/${key(job.project_id,job.id)}`);
  if(claim) return {...job,started_at:claim.started_at,status:Date.now()<claim.expires?'running':'failed',error_code:Date.now()<claim.expires?null:'job_expired'};
  return {...job,status:Date.now()-Date.parse(job.created_at)<86400000?'queued':'failed',error_code:'job_expired'};
}
function safeJob(job) { return {id:job.id,project_id:job.project_id,kind:job.kind,status:job.status,error_code:job.status==='failed'?job.error_code:null,created_at:job.created_at,started_at:job.started_at}; }
async function jobs(teacher,projectId,limit=120) { return db.documents(`${base(teacher)}/jobs`,{limit,search:projectId?`${id(projectId)}_`:''}); }
async function jobStatus(teacher,projectId) {
  const p=await project(teacher,projectId),requests=await jobs(teacher,p.id,10);
  return {jobs:await Promise.all(requests.map(async j=>safeJob(await status(teacher,j,p))))};
}
async function versions(teacher,projectId) { return (await db.documents(`${base(teacher)}/results/build`,{limit:30,search:`${id(projectId)}_`})).map(r=>r.version); }
async function activeLinks(teacher,p,kind) {
  const rows=await db.documents(`${base(teacher)}/links/${kind}`,{limit:200,search:`${p.id}_`});
  const result=[];
  for(const row of rows) if(row.share_epoch===p.share_epoch&&!p.archived&&(!row.expires_at||Date.parse(row.expires_at)>Date.now())&&!await db.get(`revoked/${row.token}.json`)) result.push(row);
  return result;
}
async function state(teacher,projectId) {
  const p=await project(teacher,projectId);
  const [requests,vs,links]=await Promise.all([jobs(teacher,p.id),versions(teacher,p.id),activeLinks(teacher,p,'published')]);
  const records=[];
  for(let i=0;i<requests.length;i+=8) records.push(...await Promise.all(requests.slice(i,i+8).map(j=>status(teacher,j,p))));
  const turns=records.slice().reverse().flatMap(j=>[{id:`${j.id}-teacher`,role:'teacher',message:j.message,created_at:j.created_at},...(j.status==='succeeded'?[{id:`${j.id}-ai`,role:'assistant',message:j.assistant_message,created_at:j.finished_at}]:[])]).slice(-120);
  // A plan may predate the visible conversation window.
  const [lastPlan]=await db.documents(`${base(teacher)}/results/plan`,{limit:1,search:`${p.id}_`});
  return {project:{...p,plan:lastPlan?.plan||null},turns,versions:vs,jobs:records.slice(0,10).map(safeJob),links:links.map(l=>({id:l.id,version_id:l.version_id,url:linkUrl(l)}))};
}
async function enqueue(teacher,projectId,kind,message,requestKey,preferredMediaType) {
  projectId=id(projectId);requestKey=id(requestKey);
  if(!['plan','build'].includes(kind)) throw db.fail('invalid_kind');
  message=text(message,6000);if(message.length<3) throw db.fail('invalid_message');
  preferredMediaType=mediaType(preferredMediaType);
  return leases.admission(id(teacher),async()=>{
    const p=await project(teacher,projectId),name=key(p.id,requestKey);
    const previous=await db.get(`${base(teacher)}/jobs/${name}`);
    if(previous) {
      if(previous.kind!==kind||previous.message!==message||(previous.media_type||'')!==preferredMediaType) throw db.fail('request_conflict',409);
      return safeJob(await status(teacher,previous,p));
    }
    if(p.archived) throw db.fail('project_archived');
    if(kind==='build'&&(await versions(teacher,p.id)).length>=30) throw db.fail('version_limit',429);
    const recent=(await jobs(teacher,null,100)).filter(j=>Date.now()-Date.parse(j.created_at)<86400000);
    let pending=0;
    for(let i=0;i<recent.length;i+=8) {
      const batch=await Promise.all(recent.slice(i,i+8).map(async job=>{
        // Completed jobs need only one result read; load project/archive state
        // only for unresolved requests when counting pending capacity.
        if(await outcome(teacher,job)) return null;
        return status(teacher,job,job.project_id===p.id?p:await project(teacher,job.project_id));
      }));
      for(const current of batch) if(current&&['queued','running'].includes(current.status)) {
        pending++;if(current.project_id===p.id) throw db.fail('project_busy',409);
      }
    }
    if(pending>=3) throw db.fail('queue_limit',429);
    const day=new Date(Date.now()+7*3600000).toISOString().slice(0,10),quota=`${base(teacher)}/quota/${day}`;
    if(!await db.get(`${quota}/${name}`)) {
      if((await db.list(quota,{limit:40})).length>=40) throw db.fail('daily_limit',429);
      await db.put(`${quota}/${name}`,{created_at:now()});
    }
    const job={id:requestKey,project_id:p.id,kind,message,media_type:preferredMediaType||null,share_epoch:p.share_epoch,created_at:now()};
    await db.put(`${base(teacher)}/jobs/${name}`,job);
    return safeJob({...job,status:'queued'});
  });
}
async function run(teacher,projectId,jobId) {
  const p=await project(teacher,projectId),name=key(p.id,jobId);
  const job=await db.get(`${base(teacher)}/jobs/${name}`);
  if(!job) throw db.fail('not_found',404);
  if((await status(teacher,job,p)).status!=='queued') return {started:false};
  // Avoid producing ledger records on each browser poll while capacity is full.
  if(!await leases.available(`teacher/${id(teacher)}`)) return {started:false};
  const slots=await Promise.all([0,1].map(n=>leases.available(`global/${n}`)));
  if(!slots.some(Boolean)) return {started:false};
  const ownerLease=await leases.acquire(`teacher/${teacher}`);
  if(!ownerLease) return {started:false};
  let globalLease,claimed=false;
  try {
    for(let n=0;n<2&&!globalLease;n++) if(slots[n]) globalLease=await leases.acquire(`global/${n}`);
    if(!globalLease) return {started:false};
    const expires=Math.min(ownerLease.expires,globalLease.expires);
    claimed=await db.put(`${base(teacher)}/claims/${name}`,{started_at:now(),expires});
    if(!claimed) return {started:false};
    const current=await state(teacher,p.id);
    if(current.project.archived||current.project.share_epoch!==job.share_epoch) throw db.fail('project_archived');
    const input={message:job.message,preferred_media_type:mediaType(job.media_type),context:context(p.context),plan:current.project.plan,recent_conversation:current.turns.slice(-12).map(t=>({role:t.role,text:t.message.slice(0,3000)}))};
    let message,plan=null,version=null;
    if(job.kind==='plan') {
      const raw=await ai.ask('plan',input);
      if(!raw||!['assistant_message','title','objective','observation','mission'].every(k=>typeof raw[k]==='string')||!Array.isArray(raw.variables)||!Array.isArray(raw.next_questions)||![...raw.variables,...raw.next_questions].every(x=>typeof x==='string')) throw db.fail('ai_invalid_response',502);
      plan={title:text(raw.title,120),objective:text(raw.objective,1200),observation:text(raw.observation,1200),variables:raw.variables.slice(0,5).map(x=>text(x,100)),mission:text(raw.mission,1200),next_questions:raw.next_questions.slice(0,3).map(x=>text(x,180))};
      message=text(raw.assistant_message,6000);
    } else {
      if(current.versions[0]) input.previous_artifact=await db.get(current.versions[0].storage_path);
      const artifact=artifactTools.validateArtifact(await ai.ask('build',input));
      const review=await require('./media-check').checkInBrowser(artifact),storage_path=`${base(teacher)}/artifacts/${name}`;
      await db.put(storage_path,artifact);
      version={id:job.id,project_id:p.id,title:artifact.title,summary:artifact.summary,storage_path,sha256:artifactTools.hash(artifact),review,created_at:now()};
      message=`สร้างสื่อ “${artifact.title}” แล้ว เปิดทดลองเล่นก่อนเผยแพร่ได้เลย\n\n${artifact.summary}`;
    }
    const latest=await project(teacher,p.id);
    if(Date.now()>=expires) throw db.fail('job_expired');
    if(latest.archived||latest.share_epoch!==job.share_epoch) throw db.fail('project_archived');
    // One immutable commit object contains both the assistant turn and result.
    await db.put(`${base(teacher)}/results/${job.kind}/${name}`,{status:'succeeded',assistant_message:message,plan,version,finished_at:now()});
    return {started:true,status:'succeeded'};
  } catch(error) {
    if(!claimed) throw error;
    // An upload timeout can follow a successful write. Never erase an artifact
    // or charge for an automatic retry. A committed success wins over failure.
    const saved=await outcome(teacher,job);
    if(saved?.status==='succeeded') return {started:true,status:'succeeded'};
    const allowed=new Set(['project_archived','ai_not_configured','ai_busy','ai_request_failed','ai_incomplete','ai_refused','ai_invalid_response','invalid_artifact','unsafe_html','unsafe_css','unsafe_script','invalid_javascript','preview_failed','preview_layout_failed','preview_timeout','job_expired','storage_unavailable','storage_integrity_failed']);
    const code=allowed.has(error.code)?error.code:'generation_failed';
    await db.put(`${base(teacher)}/results/failed/${name}`,{status:'failed',error_code:code,finished_at:now()});
    return {started:true,status:'failed',error_code:code};
  } finally { await Promise.all([leases.release(globalLease).catch(()=>{}),leases.release(ownerLease).catch(()=>{})]); }
}
async function archive(teacher,projectId,archived) {
  if(typeof archived!=='boolean') throw db.fail('invalid_archive');
  return leases.admission(id(teacher),async lease=>{
    const p=await project(teacher,projectId);
    if(p.archived!==archived) await db.put(`${base(teacher)}/archives/${p.id}/${lease.seq}.json`,{archived,share_epoch:crypto.randomUUID(),created_at:now()});
    return true;
  });
}
async function issueLink(teacher,projectId,versionId,kind) {
  mediaOrigin();id(versionId);
  if(!['preview','published'].includes(kind)) throw db.fail('invalid_kind');
  return leases.admission(id(teacher),async()=>{
    const p=await project(teacher,projectId);
    if(p.archived) throw db.fail('project_archived');
    const result=await db.get(`${base(teacher)}/results/build/${key(p.id,versionId)}`),version=result?.version;
    if(!version) throw db.fail('not_found',404);
    if(version.review.browser_check!=='passed'||version.review.policy_version!==artifactTools.POLICY_VERSION) throw db.fail('review_required');
    let link=(await activeLinks(teacher,p,kind)).find(l=>l.version_id===versionId&&(!l.expires_at||Date.parse(l.expires_at)>Date.now()+60000));
    if(!link) {
      if((await db.list(`${base(teacher)}/links/${kind}`,{limit:200,search:`${p.id}_`})).length>=200) throw db.fail('link_limit',429);
      link={id:crypto.randomUUID(),teacher_id:id(teacher),project_id:p.id,version_id:id(versionId),share_epoch:p.share_epoch,kind,token:crypto.randomBytes(32).toString('hex'),created_at:now(),expires_at:kind==='preview'?new Date(Date.now()+15*60000).toISOString():null};
      await db.put(`links/${link.token}.json`,link);
      await db.put(`${base(teacher)}/links/${kind}/${key(p.id,link.id)}`,link);
    }
    return {id:link.id,url:linkUrl(link),expires_at:link.expires_at};
  });
}
async function revoke(teacher,projectId,linkId) {
  const p=await project(teacher,projectId),link=await db.get(`${base(teacher)}/links/published/${key(p.id,linkId)}`);
  if(!link) throw db.fail('not_found',404);
  await db.put(`revoked/${link.token}.json`,{created_at:now()});return true;
}
module.exports={id,text,context,mediaType,mediaOrigin,safeJob,state,jobStatus,list,create,enqueue,run,archive,issueLink,revoke,publicArtifact};
