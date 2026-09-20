'use strict';
const {sendJson} = require('../_lib/http');
const service = require('../_lib/media-records');
const artifact = require('../_lib/media-artifact');
module.exports = async function handler(req,res) {
  if (req.method!=='GET') return sendJson(res,405,{error:'method_not_allowed'});
  const token=String(req.query.token||'');
  if (!/^[a-f0-9]{64}$/.test(token)) return sendJson(res,404,{error:'not_found'});
  try {
    const checked=await service.publicArtifact(token);
    return sendJson(res,200,{...artifact.render(checked),title:checked.title});
  } catch (error) { return sendJson(res,error.status===404?404:503,{error:error.status===404?'not_found':'media_unavailable'}); }
};
