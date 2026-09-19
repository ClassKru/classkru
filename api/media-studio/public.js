'use strict';
const {sendJson} = require('../_lib/http');
const db = require('../_lib/media-db');
const artifact = require('../_lib/media-artifact');
module.exports = async function handler(req,res) {
  if (req.method!=='GET') return sendJson(res,405,{error:'method_not_allowed'});
  const token=String(req.query.token||'');
  if (!/^[a-f0-9]{64}$/.test(token)) return sendJson(res,404,{error:'not_found'});
  try {
    const [link]=await db.rows('media_links',{token:`eq.${token}`,revoked_at:'is.null',limit:1});
    if (!link || (link.expires_at && Date.parse(link.expires_at)<=Date.now())) return sendJson(res,404,{error:'not_found'});
    const project=await db.owned('media_projects',link.project_id,link.teacher_id);
    if (project.archived) return sendJson(res,404,{error:'not_found'});
    const version=await db.owned('media_versions',link.version_id,link.teacher_id);
    if (version.project_id!==project.id || version.review.browser_check!=='passed' || version.review.policy_version!==artifact.POLICY_VERSION) throw db.fail('media_unavailable');
    const bundle=await db.bundle(version.storage_path);
    if (artifact.hash(bundle)!==version.sha256) throw db.fail('media_unavailable');
    // Revalidate on every delivery; do not leak owner/chat/context or storage paths.
    const checked=artifact.validateArtifact(bundle);
    return sendJson(res,200,{...artifact.render(checked),title:checked.title});
  } catch (_) { return sendJson(res,503,{error:'media_unavailable'}); }
};
