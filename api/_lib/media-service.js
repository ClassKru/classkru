'use strict';
const crypto = require('node:crypto');
const db = require('./media-db');
const ai = require('./media-ai');
const artifactTools = require('./media-artifact');
const { checkInBrowser } = require('./media-check');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value) { if (!uuidPattern.test(String(value || ''))) throw db.fail('invalid_id'); return value; }
function text(value, max) { return String(value || '').trim().slice(0,max); }
function context(value = {}) {
  return {subject:text(value.subject,100),classroom:text(value.classroom,100),goal:text(value.goal,800),duration_minutes:Math.max(3,Math.min(180,Number(value.duration_minutes)||15))};
}
function mediaOrigin() {
  const value = process.env.MEDIA_ORIGIN;
  const app = process.env.CLASSKRU_APP_ORIGIN || 'https://classkru-kohl.vercel.app';
  if (!value) throw db.fail('media_host_not_configured',503);
  let url;
  try { url = new URL(value); } catch (_) { throw db.fail('media_host_not_configured',503); }
  const local = process.env.NODE_ENV !== 'production' && ['127.0.0.1','localhost'].includes(url.hostname);
  if ((!local && url.protocol!=='https:') || url.origin === new URL(app).origin || url.username || url.password || url.pathname!=='/') throw db.fail('invalid_media_origin',503);
  return url.origin;
}
function linkUrl(link) { return `${mediaOrigin()}/?token=${link.token}`; }
function safeJob(job) { const {claim_token, message, teacher_id, request_key,...safe} = job; return safe; }
async function state(teacher, projectId) {
  const project = await db.owned('media_projects',id(projectId),teacher);
  const filter = {teacher_id:`eq.${teacher}`,project_id:`eq.${project.id}`};
  await db.patch('media_jobs',{...filter,status:'eq.running',started_at:`lt.${new Date(Date.now()-5*60000).toISOString()}`},{status:'failed',error_code:'job_expired',finished_at:new Date().toISOString()});
  const [turns,versions,jobs,links] = await Promise.all([
    db.rows('media_turns',{...filter,select:'id,role,message,created_at',order:'id.desc',limit:120}),
    db.rows('media_versions',{...filter,select:'id,title,summary,sha256,review,created_at',order:'created_at.desc',limit:30}),
    db.rows('media_jobs',{...filter,select:'id,project_id,kind,status,error_code,created_at,started_at',order:'created_at.desc',limit:10}),
    db.rows('media_links',{...filter,kind:'eq.published',revoked_at:'is.null',order:'created_at.desc',limit:30})
  ]);
  return {project,turns:turns.reverse(),versions,jobs,links:links.map(link=>({id:link.id,version_id:link.version_id,url:linkUrl(link)}))};
}
async function run(teacher,jobId) {
  const claim = crypto.randomUUID();
  const [job] = await db.rpc('media_claim',{p_teacher:teacher,p_job:id(jobId),p_claim:claim});
  if (!job) return {started:false};
  let storedPath, cleanupSafe=true;
  try {
    const project = await db.owned('media_projects',job.project_id,teacher);
    if (project.archived) throw db.fail('project_archived');
    const turns = await db.rows('media_turns',{project_id:`eq.${job.project_id}`,teacher_id:`eq.${teacher}`,order:'id.desc',limit:12});
    const input = {message:job.message,context:context(project.context),plan:project.plan,recent_conversation:turns.reverse().map(t=>({role:t.role,text:t.message.slice(0,3000)}))};
    let message, plan = null, version = null;
    if (job.kind==='plan') {
      const raw = await ai.ask('plan',input);
      if (!raw || !['assistant_message','title','objective','observation','mission'].every(key=>typeof raw[key]==='string') || !Array.isArray(raw.variables) || !Array.isArray(raw.next_questions) || ![...raw.variables,...raw.next_questions].every(x=>typeof x==='string')) throw db.fail('ai_invalid_response',502);
      plan = {title:text(raw.title,120),objective:text(raw.objective,1200),observation:text(raw.observation,1200),variables:raw.variables.slice(0,5).map(x=>text(x,100)),mission:text(raw.mission,1200),next_questions:(raw.next_questions||[]).slice(0,3).map(x=>text(x,180))};
      message = text(raw.assistant_message,6000);
    } else {
      const [last] = await db.rows('media_versions',{project_id:`eq.${job.project_id}`,teacher_id:`eq.${teacher}`,order:'created_at.desc',limit:1});
      if (last) input.previous_artifact = await db.bundle(last.storage_path);
      const artifact = artifactTools.validateArtifact(await ai.ask('build',input));
      const review = await checkInBrowser(artifact);
      const versionId = crypto.randomUUID();
      storedPath = `${teacher}/${job.project_id}/${versionId}.json`;
      await db.bundle(storedPath,{method:'POST',body:artifact});
      version = {id:versionId,title:artifact.title,summary:artifact.summary,storage_path:storedPath,sha256:artifactTools.hash(artifact),review};
      message = `สร้างสื่อ “${artifact.title}” แล้ว เปิดทดลองเล่นก่อนเผยแพร่ได้เลย\n\n${artifact.summary}`;
    }
    // A timeout can happen after COMMIT. Never delete a possibly committed bundle.
    cleanupSafe=false;
    const finished = await db.rpc('media_finish',{p_teacher:teacher,p_job:job.id,p_claim:claim,p_message:message,p_plan:plan,p_version:version});
    if (!finished) {cleanupSafe=true;throw db.fail('job_expired');}
    return {started:true,status:'succeeded'};
  } catch(error) {
    if (storedPath && cleanupSafe) await db.bundle(storedPath,{method:'DELETE'}).catch(()=>{});
    const allowed = new Set(['project_archived','ai_not_configured','ai_busy','ai_request_failed','ai_incomplete','ai_refused','ai_invalid_response','invalid_artifact','unsafe_html','unsafe_css','unsafe_script','invalid_javascript','preview_failed','preview_layout_failed','preview_timeout','job_expired','database_unavailable']);
    const code = allowed.has(error.code) ? error.code : 'generation_failed';
    await db.patch('media_jobs',{id:`eq.${job.id}`,teacher_id:`eq.${teacher}`,claim_token:`eq.${claim}`,status:'eq.running'},{status:'failed',error_code:code,finished_at:new Date().toISOString()});
    return {started:true,status:'failed',error_code:code};
  }
}
async function issueLink(teacher,versionId,kind) {
  mediaOrigin();
  const version = await db.owned('media_versions',id(versionId),teacher);
  const project = await db.owned('media_projects',version.project_id,teacher);
  if (project.archived) throw db.fail('project_archived');
  if (version.review.browser_check!=='passed' || version.review.policy_version!==artifactTools.POLICY_VERSION) throw db.fail('review_required');
  let link;
  if (kind==='published') link = await db.rpc('media_publish',{p_teacher:teacher,p_version:version.id,p_token:crypto.randomBytes(32).toString('hex')});
  else {
    [link] = await db.rows('media_links',{teacher_id:`eq.${teacher}`,version_id:`eq.${version.id}`,kind:'eq.preview',revoked_at:'is.null',expires_at:`gt.${new Date(Date.now()+60000).toISOString()}`,limit:1});
    if (!link) [link] = await db.insert('media_links',{teacher_id:teacher,project_id:project.id,version_id:version.id,kind:'preview',token:crypto.randomBytes(32).toString('hex'),expires_at:new Date(Date.now()+15*60000).toISOString()});
  }
  return {id:link.id,url:linkUrl(link),expires_at:link.expires_at};
}
module.exports = {id,text,context,mediaOrigin,safeJob,state,run,issueLink};
