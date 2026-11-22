'use strict';

const crypto=require('node:crypto');
const {RUNTIME_CSP}=require('../html-media-builder-ai/runtime-preview');
const {UUID:ID}=require('./task-store');
const TOKEN=/^[a-f0-9]{64}$/i;

function fail(code,status=404) { return Object.assign(new Error(code),{code,status}); }
function validId(value) { return typeof value==='string'&&ID.test(value); }

function createShareLinks({storage,artifactStoreForTeacher,previewAllowed,clock=()=>new Date().toISOString(),tokenFactory=()=>crypto.randomBytes(32).toString('hex')}={}) {
  if(!storage||typeof storage.get!=='function'||typeof storage.put!=='function'||typeof storage.list!=='function'||typeof storage.documents!=='function'||typeof storage.remove!=='function') throw new TypeError('share_storage_required');
  const prefix=(teacherId,jobId)=>{
    if(!validId(teacherId)||!validId(jobId)) throw fail('share_not_found');
    return `mini-lab-v5/share-links/${teacherId}/${jobId}`;
  };
  const name=(teacherId,jobId,token)=>{
    if(!TOKEN.test(String(token||''))) throw fail('share_not_found');
    return `${prefix(teacherId,jobId)}/${token}.json`;
  };
  const url=record=>`/api/v5/share/${record.teacher_id}/${record.job_id}/${record.token}`;

  async function rows(teacherId,jobId) {
    return storage.documents(prefix(teacherId,jobId),{limit:200,search:'',column:'created_at',order:'desc'});
  }
  async function recordIsAvailable(record,teacherId,jobId) {
    if(!record||record.teacher_id!==teacherId||record.job_id!==jobId||!TOKEN.test(String(record.token||''))||!validId(record.artifact_id)) return false;
    if(!await previewAllowed(teacherId,jobId,record.artifact_id)) return false;
    return Boolean(await artifactStoreForTeacher(teacherId).getValidated(record.artifact_id));
  }
  async function active(teacherId,jobId) {
    for(const record of await rows(teacherId,jobId)) if(await recordIsAvailable(record,teacherId,jobId)) return record;
    return null;
  }
  async function status(teacherId,jobId) {
    const record=await active(teacherId,jobId);
    return record?{shared:true,share_url:url(record)}:{shared:false};
  }
  async function revoke(teacherId,jobId) {
    const folder=prefix(teacherId,jobId);
    const entries=await storage.list(folder,{limit:200,search:'',column:'created_at',order:'desc'});
    await Promise.all(entries.map(entry=>{
      if(typeof entry?.name!=='string'||!/^[a-f0-9]{64}\.json$/i.test(entry.name)) return null;
      return storage.remove(`${folder}/${entry.name}`);
    }));
    return {shared:false};
  }
  async function issue(teacherId,jobId,artifactId) {
    if(!validId(teacherId)||!validId(jobId)||!validId(artifactId)) throw fail('share_not_found');
    if(!await previewAllowed(teacherId,jobId,artifactId)||!await artifactStoreForTeacher(teacherId).getValidated(artifactId)) throw fail('share_not_found');
    const existing=await active(teacherId,jobId);
    if(existing?.artifact_id===artifactId) return {shared:true,share_url:url(existing)};
    await revoke(teacherId,jobId);
    for(let attempt=0;attempt<3;attempt++) {
      const token=tokenFactory();
      if(!TOKEN.test(String(token||''))) throw Object.assign(new Error('share_token_invalid'),{code:'share_token_invalid',status:500});
      const record={teacher_id:teacherId,job_id:jobId,artifact_id:artifactId,token,created_at:clock()};
      if(await storage.put(name(teacherId,jobId,token),record)) return {shared:true,share_url:url(record)};
    }
    throw Object.assign(new Error('share_link_unavailable'),{code:'share_link_unavailable',status:503});
  }
  async function load(teacherId,jobId,token) {
    const record=await storage.get(name(teacherId,jobId,token));
    if(!await recordIsAvailable(record,teacherId,jobId)) throw fail('share_not_found');
    const artifact=await artifactStoreForTeacher(teacherId).getValidated(record.artifact_id);
    if(!artifact) throw fail('share_not_found');
    return {html:artifact.html,csp:RUNTIME_CSP};
  }

  return Object.freeze({issue,status,revoke,load});
}

module.exports={createShareLinks};
