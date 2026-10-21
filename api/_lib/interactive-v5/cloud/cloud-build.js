'use strict';

const crypto = require('node:crypto');
const { classifyRevisionIntent } = require('../../revision-intent');
const RETRYABLE = new Set(['conversation_ai_timeout','conversation_ai_rate_limited','conversation_ai_provider_unavailable','prompt_architect_timeout','prompt_architect_rate_limited','prompt_architect_provider_unavailable','prompt_architect_invalid_response','build_specification_invalid','html_builder_timeout','html_builder_rate_limited','html_builder_provider_unavailable']);
function fail(code) { return Object.assign(new Error(code),{code}); }
function safeCode(error) { return typeof error?.code === 'string' && /^[a-z0-9_]+$/i.test(error.code) ? error.code.toLowerCase() : 'workflow_unknown_error'; }

function createCloudBuild({store,conversationClient,architectClient,builderClient,artifactStore,clock=()=>Date.now(),idFactory=crypto.randomUUID,leaseMs=300000}={}) {
  async function task(id) { const row=await store.get(id); if (!row) throw fail('conversation_not_found'); if(row.state.deletion_pending) throw fail('task_deletion_pending'); return row; }
  async function find(jobId) {
    const row=store.findByJobId ? await store.findByJobId(jobId) : (await store.list()).find(item=>(item.state.jobs||[]).some(job=>job.id===jobId));
    if (!row) throw fail('job_not_found');
    return {row,job:(row.state.jobs||[]).find(job=>job.id===jobId)};
  }
  const locked = row => Boolean(row.state.active_operation && row.state.active_operation.expires_at > clock());
  const replaceJob = (row,job,patch={}) => store.update(row.id,row.revision,{...row.state,...patch,jobs:(row.state.jobs||[]).map(item=>item.id===job.id?job:item)});
  async function execute(jobId) {
    let {row,job}=await find(jobId);
    if (row.state.deletion_pending) throw fail('task_deletion_pending');
    if (job.state==='succeeded') return job;
    if (locked(row)) throw fail('conversation_request_in_progress');
    const operation={id:idFactory(),expires_at:clock()+leaseMs};
    row=await store.update(row.id,row.revision,{...row.state,active_operation:operation});
    try {
      job=(row.state.jobs||[]).find(item=>item.id===jobId);
      if (job.revision?.requires_architect && !job.revision.architecture_completed) {
        const parent=(row.state.jobs||[]).find(item=>item.id===job.revision.parent_job_id);
        if (!parent?.specification) throw fail('revision_parent_not_found');
        job={...job,state:'architecting',error:null,failed_stage:null};
        row=await replaceJob(row,job);
        try {
          const result=await architectClient.reviseSpecification({confirmedBrief:job.brief,previousSpecification:parent.specification,instruction:job.revision.instruction,intent:job.revision.intent});
          job={...job,specification:result.specification,revision:{...job.revision,architecture_completed:true},state:'queued'};
          row=await replaceJob(row,job);
        } catch(error) {
          const code=safeCode(error); job={...job,state:RETRYABLE.has(code)?'retryable_failed':'failed',error:{code,retryable:RETRYABLE.has(code)},failed_stage:'architect'};
          row=await replaceJob(row,job); return job;
        }
      } else if (!job.specification) {
        job={...job,state:'architecting',error:null,failed_stage:null}; row=await replaceJob(row,job);
        try {
          const result=await architectClient.createSpecification({confirmedBrief:job.brief});
          job={...job,specification:result.specification,state:'queued'};
          row=await replaceJob(row,job);
        } catch(error) {
          const code=safeCode(error); job={...job,state:RETRYABLE.has(code)?'retryable_failed':'failed',error:{code,retryable:RETRYABLE.has(code)},failed_stage:'architect'};
          row=await replaceJob(row,job); return job;
        }
      }
      job={...job,state:'building',error:null,failed_stage:null}; row=await replaceJob(row,job);
      try {
        const result=await builderClient.build({specification:job.specification,revision:job.revision||null});
        job={...job,state:'succeeded',artifact_id:result.artifact_id,error:null,failed_stage:null};
        row=await replaceJob(row,job);
        const obsolete=[...new Set((row.state.jobs||[]).filter(item=>item.id!==job.id&&item.state==='succeeded'&&item.artifact_id&&item.artifact_id!==job.artifact_id).map(item=>item.artifact_id))];
        for(const artifactId of obsolete) { try { await artifactStore.deleteValidated(artifactId); } catch (_) {} }
        return job;
      } catch(error) {
        const code=safeCode(error); job={...job,state:RETRYABLE.has(code)?'retryable_failed':'failed',error:{code,retryable:RETRYABLE.has(code)},failed_stage:'builder'};
        row=await replaceJob(row,job); return job;
      }
    } finally {
      try { await store.update(row.id,row.revision,{...row.state,active_operation:null}); } catch (_) {}
    }
  }
  async function queueRetry(jobId) {
    const {row,job}=await find(jobId);
    if(!RETRYABLE.has(job.error?.code)&&job.state!=='retryable_failed') throw fail('job_not_retryable');
    if(locked(row)) throw fail('conversation_request_in_progress');
    const queued={...job,state:'queued',error:null};
    await replaceJob(row,queued);
    return queued;
  }
  return Object.freeze({
    async confirm({conversationId,editedDraft,parentJobId,idempotencyKey}) {
      if(typeof idempotencyKey!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(idempotencyKey)) throw fail('idempotency_key_invalid');
      const row=await task(conversationId); if(locked(row)) throw fail('conversation_request_in_progress');
      const existing=(row.state.jobs||[]).find(job=>job.idempotency_key===idempotencyKey);
      if(existing) return {job:existing,brief:existing.brief,created:false};
      const parent=parentJobId&&(row.state.jobs||[]).find(job=>job.id===parentJobId&&job.state==='succeeded');
      if(parentJobId&&!parent) throw fail('revision_parent_not_found');
      const confirmed=conversationClient.confirm({conversation:row.state.conversation,editedDraft});
      const revision=parent?{parent_job_id:parent.id,parent_artifact_id:parent.artifact_id,instruction:`ปรับสื่อจาก Brief ที่ยืนยันล่าสุด ${JSON.stringify({learning:confirmed.brief.learning,media_intent:confirmed.brief.media_intent,constraints:confirmed.brief.constraints})}`,intent:{category:'pedagogical',requires_architect:true},requires_architect:true}:null;
      const job={id:idFactory(),conversation_id:conversationId,brief:confirmed.brief,state:'queued',specification:null,artifact_id:null,revision,idempotency_key:idempotencyKey,created_at:new Date(clock()).toISOString()};
      await store.update(row.id,row.revision,{...row.state,conversation:confirmed.conversation,jobs:[...(row.state.jobs||[]),job]});
      return {job,brief:confirmed.brief,created:true};
    },
    async get(jobId) { return (await find(jobId)).job; },
    queueRetry,
    async retry(jobId) {
      await queueRetry(jobId);
      return execute(jobId);
    },
    async revise({parentJobId,instruction,idempotencyKey,confirmedScope=false}) {
      const {row,job:parent}=await find(parentJobId); if(locked(row)) throw fail('conversation_request_in_progress');
      if(parent.state!=='succeeded'||!parent.artifact_id||!parent.specification) throw fail('revision_parent_not_found');
      if(typeof instruction!=='string'||!instruction.trim()||instruction.length>6000) throw fail('revision_instruction_invalid');
      if(typeof idempotencyKey!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(idempotencyKey)) throw fail('idempotency_key_invalid');
      const intent=classifyRevisionIntent(instruction);
      if(intent.requires_confirmation&&confirmedScope!==true) throw fail(intent.clarification_required?'revision_scope_confirmation_required':'revision_content_confirmation_required');
      const existing=(row.state.jobs||[]).find(job=>job.idempotency_key===idempotencyKey);
      if(existing) return {job:existing,created:false};
      const revision={parent_job_id:parent.id,parent_artifact_id:parent.artifact_id,instruction:instruction.trim(),intent,requires_architect:intent.requires_architect,confirmed_scope:confirmedScope===true};
      const job={id:idFactory(),conversation_id:parent.conversation_id||row.id,brief:parent.brief,state:'queued',specification:intent.requires_architect?null:parent.specification,artifact_id:null,revision,idempotency_key:idempotencyKey,created_at:new Date(clock()).toISOString()};
      await store.update(row.id,row.revision,{...row.state,jobs:[...(row.state.jobs||[]),job]});
      return {job,created:true};
    },
    async deleteTask(jobId) {
      let {row}=await find(jobId);
      if(locked(row)) throw fail('conversation_request_in_progress');
      const operation={id:idFactory(),expires_at:clock()+leaseMs};
      row=await store.update(row.id,row.revision,{...row.state,deletion_pending:true,active_operation:operation});
      const artifactIds=[...new Set((row.state.jobs||[]).map(job=>job.artifact_id).filter(Boolean))];
      try {
        for(const id of artifactIds) await artifactStore.deleteValidated(id);
        await store.delete(row.id,row.revision);
        return {deleted:true,conversation_id:row.id,deleted_artifact_ids:artifactIds,deleted_job_ids:(row.state.jobs||[]).map(job=>job.id)};
      } catch(error) {
        try { await store.update(row.id,row.revision,{...row.state,active_operation:null}); } catch (_) {}
        throw error;
      }
    },
    async preview(jobId) {
      const {row,job}=await find(jobId);
      if(row.state.deletion_pending) throw fail('task_deletion_pending');
      if(job.state!=='succeeded'||!job.artifact_id) throw fail('artifact_not_ready');
      const artifact=await artifactStore.getValidated(job.artifact_id);
      if(!artifact) throw fail('artifact_not_found');
      return artifact;
    },
    async library() {
      const rows=await store.list();
      return rows.map(row=>{
        const latest=(row.state.jobs||[]).filter(job=>job.state==='succeeded').at(-1);
        return latest&&{id:latest.id,artifact_id:latest.artifact_id,conversation_id:row.id,title:latest.specification?.media?.title||latest.brief?.learning?.topic||'สื่อการเรียนรู้',created_at:latest.created_at,parent_job_id:latest.revision?.parent_job_id||null};
      }).filter(Boolean);
    },
    async process(jobId) { return execute(jobId); }
  });
}
module.exports={RETRYABLE,createCloudBuild};

