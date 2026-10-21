'use strict';
const crypto=require('node:crypto');
const { RUNTIME_CSP }=require('../html-media-builder-ai/runtime-preview');
const { UUID:ID }=require('./task-store');
function fail(code) { return Object.assign(new Error(code),{code}); }
function createPreviewTickets({storage,artifactStoreForTeacher,previewAllowed,clock=()=>Date.now(),idFactory=crypto.randomUUID,ttlMs=600000}={}) {
  const name=id=>{if(typeof id!=='string'||!ID.test(id))throw fail('preview_not_found');return `mini-lab-v5/preview-tickets/${id}.json`;};
  return Object.freeze({
    async issue(teacherId,artifactId,jobId) {
      if(!ID.test(String(teacherId))||!ID.test(String(artifactId))||!ID.test(String(jobId))||!await previewAllowed(teacherId,jobId,artifactId)) throw fail('preview_not_found');
      const artifact=await artifactStoreForTeacher(teacherId).getValidated(artifactId);
      if(!artifact) throw fail('preview_not_found');
      const id=idFactory(),expiresAt=clock()+ttlMs;
      if(!await storage.put(name(id),{teacher_id:teacherId,artifact_id:artifactId,job_id:jobId,expires_at:expiresAt})) throw fail('preview_ticket_conflict');
      return {id,expires_at:expiresAt};
    },
    async load(id) {
      const ticket=await storage.get(name(id));
      if(!ticket||!Number.isFinite(ticket.expires_at)||ticket.expires_at<=clock()||!ID.test(String(ticket.teacher_id))||!ID.test(String(ticket.artifact_id))||!ID.test(String(ticket.job_id))||!await previewAllowed(ticket.teacher_id,ticket.job_id,ticket.artifact_id)) throw fail('preview_not_found');
      const artifact=await artifactStoreForTeacher(ticket.teacher_id).getValidated(ticket.artifact_id);
      if(!artifact) throw fail('preview_not_found');
      return {html:artifact.html,csp:RUNTIME_CSP};
    }
  });
}
module.exports={createPreviewTickets};

