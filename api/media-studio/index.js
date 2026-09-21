'use strict';
const {authenticatedUser} = require('../_lib/supabase-user');
const {sendJson,requestOriginIsValid} = require('../_lib/http');
const db = require('../_lib/media-db');
const service = require('../_lib/media-service');
const {configured} = require('../_lib/media-ai');
module.exports = async function handler(req,res) {
  if (!['GET','POST'].includes(req.method)) return sendJson(res,405,{error:'method_not_allowed'});
  if (!requestOriginIsValid(req)) return sendJson(res,403,{error:'invalid_origin'});
  try {
    const teacher = await authenticatedUser(req);
    if (!teacher.id) throw db.fail('authentication_required',401);
    let body = req.body || {};
    if (typeof body === 'string') { if (Buffer.byteLength(body)>32000) throw db.fail('body_too_large',413); try {body=JSON.parse(body);} catch (_) {throw db.fail('invalid_json');} }
    if (!body || typeof body!=='object' || Buffer.byteLength(JSON.stringify(body))>32000) throw db.fail('body_too_large',413);
    const action = req.method==='GET' ? req.query.action : body.action;
    let result;
    if (req.method==='GET' && action==='config') {
      let origin = null; try {origin=service.mediaOrigin();} catch (_) { /* report readiness only */ }
      result={ai:configured(),storage:db.configured(),media_origin:origin};
    } else if (req.method==='GET' && action==='list') {
      result={projects:await service.list(teacher.id,req.query.archived==='true')};
    } else if (req.method==='GET' && action==='get') result=await service.state(teacher.id,req.query.id);
    else if (req.method==='GET' && action==='jobs') result=await service.jobStatus(teacher.id,req.query.id);
    else if (req.method==='POST' && action==='create') {
      result={project:await service.create(teacher.id,body.title,body.context)};
    } else if (req.method==='POST' && action==='enqueue') {
      if (!configured()) throw db.fail('ai_not_configured',503);
      if (!['plan','build'].includes(body.kind)) throw db.fail('invalid_kind');
      if (body.kind==='build') service.mediaOrigin();
      const message=service.text(body.message,6000);
      if (message.length<3) throw db.fail('invalid_message');
      result={job:await service.enqueue(teacher.id,body.project_id,body.kind,message,body.request_key)};
    } else if (req.method==='POST' && action==='run') result=await service.run(teacher.id,body.project_id,body.job_id);
    else if (req.method==='POST' && ['preview','publish'].includes(action)) {
      if (action==='publish' && body.reviewed!==true) throw db.fail('review_required');
      result=await service.issueLink(teacher.id,body.project_id,body.version_id,action==='publish'?'published':'preview');
    } else if (req.method==='POST' && action==='revoke') {
      result={ok:await service.revoke(teacher.id,body.project_id,body.link_id)};
    } else if (req.method==='POST' && action==='archive') {
      if (typeof body.archived!=='boolean') throw db.fail('invalid_archive');
      result={ok:await service.archive(teacher.id,body.project_id,body.archived)};
    } else throw db.fail('unknown_action');
    return sendJson(res,200,result);
  } catch(error) {
    const code=String(error.code||'server_unavailable').toLowerCase();
    const status=['authentication_required','invalid_session'].includes(code)?401:(error.status||500);
    return sendJson(res,status,{error:code});
  }
};
