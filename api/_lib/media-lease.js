'use strict';
const crypto=require('node:crypto');
const db=require('./media-db');
// Append-only leases: late release cannot unlock a newer holder. Exclusive
// uploads elect a single holder. TTL exceeds the 300-second function lifetime.
const TTL=6*60000;
async function latest(scope) {
  const prefix=`leases/${scope}/records`;
  const [entry]=await db.list(prefix,{limit:1,column:'name'});
  if(!entry) return null;
  const record=await db.get(`${prefix}/${entry.name}`);
  if(!record) throw db.fail('storage_unavailable',502);
  return record;
}
async function available(scope) {
  const record=await latest(scope);
  return !record || record.expires<=Date.now() || !!await db.get(`leases/${scope}/done/${record.seq}.json`);
}
async function acquire(scope) {
  const record=await latest(scope);
  if(record && record.expires>Date.now() && !await db.get(`leases/${scope}/done/${record.seq}.json`)) return null;
  const seq=String(Number(record?.seq||0)+1).padStart(16,'0');
  const lease={scope,seq,token:crypto.randomUUID(),expires:Date.now()+TTL};
  return await db.put(`leases/${scope}/records/${seq}.json`,lease)?lease:null;
}
async function release(lease) {
  if(lease) await db.put(`leases/${lease.scope}/done/${lease.seq}.json`,{token:lease.token});
}
async function admission(teacher,fn) {
  const lease=await acquire(`admission/${teacher}`);
  if(!lease) throw db.fail('workspace_busy',409);
  try { return await fn(lease); }
  finally { await release(lease).catch(()=>{}); }
}
module.exports={TTL,available,acquire,release,admission};
