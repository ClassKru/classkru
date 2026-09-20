'use strict';
const db=require('./media-db');
const artifactTools=require('./media-artifact');
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value) { if(!uuidPattern.test(String(value||''))) throw db.fail('invalid_id');return String(value).toLowerCase(); }
const base=teacher=>`users/${id(teacher)}`;
const key=(project,item)=>`${id(project)}_${id(item)}.json`;
async function project(teacher,projectId) {
  const value=await db.get(`${base(teacher)}/projects/${id(projectId)}.json`);
  if(!value) throw db.fail('not_found',404);
  const [event]=await db.documents(`${base(teacher)}/archives/${value.id}`,{limit:1,column:'name'});
  return {...value,...(event?{archived:event.archived,share_epoch:event.share_epoch,updated_at:event.created_at}:{})};
}
async function publicArtifact(token) {
  if(!/^[a-f0-9]{64}$/.test(token)) throw db.fail('not_found',404);
  const link=await db.get(`links/${token}.json`);
  if(!link||await db.get(`revoked/${token}.json`)||(link.expires_at&&Date.parse(link.expires_at)<=Date.now())) throw db.fail('not_found',404);
  const p=await project(link.teacher_id,link.project_id);
  if(p.archived||p.share_epoch!==link.share_epoch) throw db.fail('not_found',404);
  const result=await db.get(`${base(link.teacher_id)}/results/build/${key(p.id,link.version_id)}`),v=result?.version;
  if(!v||v.project_id!==p.id||v.review.browser_check!=='passed'||v.review.policy_version!==artifactTools.POLICY_VERSION) throw db.fail('media_unavailable',503);
  const artifact=await db.get(v.storage_path);
  if(artifactTools.hash(artifact)!==v.sha256) throw db.fail('media_unavailable',503);
  return artifactTools.validateArtifact(artifact);
}
module.exports={id,base,key,project,publicArtifact};
