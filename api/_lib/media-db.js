'use strict';
// Media Studio stores encrypted JSON objects, not application SQL tables.
const crypto = require('node:crypto');
const {authConfiguration} = require('./supabase-user');
function fail(code,status=400) { return Object.assign(new Error(code),{code,status}); }
function configured() {
  return !!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) && /^[a-f0-9]{64}$/i.test(process.env.MEDIA_STORAGE_KEY||'');
}
function configuration() {
  if (!configured()) throw fail('storage_not_configured',503);
  const bucket=process.env.MEDIA_STORAGE_BUCKET||'classkru-media-files';
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(bucket)) throw fail('storage_not_configured',503);
  return {url:authConfiguration().url,key:process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,bucket};
}
function path(value) {
  if (typeof value!=='string' || !/^[a-zA-Z0-9_/-]+(?:\.json)?$/.test(value) || value.startsWith('/') || value.includes('//')) throw fail('invalid_storage_path');
  return value;
}
function seal(name,value) {
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(process.env.MEDIA_STORAGE_KEY,'hex'),iv);
  cipher.setAAD(Buffer.from(`${configuration().bucket}/${name}`));
  const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return {format:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
}
function unseal(name,value) {
  try {
    if(value?.format!==1) throw new Error();
    const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(process.env.MEDIA_STORAGE_KEY,'hex'),Buffer.from(value.iv,'base64'));
    decipher.setAAD(Buffer.from(`${configuration().bucket}/${name}`));
    decipher.setAuthTag(Buffer.from(value.tag,'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data,'base64')),decipher.final()]).toString('utf8'));
  } catch (_) { throw fail('storage_integrity_failed',503); }
}
async function request(endpoint,{method='GET',body,missing=false,exclusive=false}={}) {
  const {url,key}=configuration();
  const headers={apikey:key,'Content-Type':'application/json','Cache-Control':'no-store','x-upsert':'false'};
  if(!key.startsWith('sb_secret_')) headers.Authorization=`Bearer ${key}`;
  let response;
  try { response=await fetch(`${url}/storage/v1/${endpoint}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(20000)}); }
  catch (_) { throw fail('storage_unavailable',502); }
  const value=response.status===204?null:await response.json().catch(()=>null);
  if(!response.ok) {
    const code=String(value?.code||value?.error||'');
    if(exclusive && (response.status===409 || /ResourceAlreadyExists|Duplicate|already exists/i.test(`${code} ${value?.message}`))) return false;
    if(missing && (response.status===404 || /NoSuchKey|NoSuchBucket|not found/i.test(`${code} ${value?.message}`))) return null;
    throw fail('storage_unavailable',502);
  }
  if(value===null&&response.status!==204) throw fail('storage_unavailable',502);
  return exclusive?true:value;
}
async function ensureBucket() {
  const {bucket}=configuration();
  let info=await request(`bucket/${bucket}`,{missing:true});
  if(!info) {
    await request('bucket',{method:'POST',body:{id:bucket,name:bucket,public:false,file_size_limit:1048576,allowed_mime_types:['application/json']},exclusive:true});
    info=await request(`bucket/${bucket}`);
  }
  if(!info || info.public!==false) throw fail('storage_bucket_unsafe',503);
}
async function get(name) {
  const value=await request(`object/authenticated/${configuration().bucket}/${path(name)}?fresh=${crypto.randomUUID()}`,{missing:true});
  return value===null?null:unseal(name,value);
}
async function put(name,value) {
  path(name);
  return request(`object/${configuration().bucket}/${name}`,{method:'POST',body:seal(name,value),exclusive:true});
}
async function list(prefix,{limit=100,search='',column='created_at',order='desc',offset=0}={}) {
  path(prefix);
  const result=await request(`object/list/${configuration().bucket}`,{method:'POST',missing:true,body:{prefix,limit,offset,search,sortBy:{column,order}}});
  if(result!==null&&!Array.isArray(result)) throw fail('storage_unavailable',502);
  return (result||[]).filter(row=>row.id && row.name.endsWith('.json'));
}
async function documents(prefix,options) {
  const entries=await list(prefix,options),result=new Array(entries.length);
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(8,entries.length)},async()=>{
    while(cursor<entries.length) { const i=cursor++;result[i]=await get(`${prefix}/${entries[i].name}`); }
  }));
  if(result.some(x=>!x)) throw fail('storage_unavailable',502);
  return result;
}
module.exports={fail,configured,ensureBucket,get,put,list,documents};
