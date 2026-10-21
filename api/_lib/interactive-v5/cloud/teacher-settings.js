'use strict';

const { VALID_MODEL_ID } = require('../interactive-orchestrator/local-model-settings');
const ROLES = ['conversation','architect','builder'];
function fail(code) { return Object.assign(new Error(code),{code}); }
function normalizeModels(models) {
  if(!models||typeof models!=='object'||Array.isArray(models)||Object.keys(models).some(key=>!ROLES.includes(key))) throw fail('invalid_model_settings');
  const result={};
  for(const role of ROLES) {
    const id=models[role];
    if(typeof id!=='string'||id.length>160||!VALID_MODEL_ID.test(id)) throw fail('invalid_model_settings');
    result[role]=id;
  }
  return result;
}
function createTeacherSettingsStore({db,teacherId,defaults,briefVersions}={}) {
  if(!/^[0-9a-f-]{36}$/i.test(String(teacherId||''))) throw fail('invalid_teacher_id');
  const table='interactive_v5_settings';
  async function row() {
    const rows=await db.selectRows(table,{filters:{teacher_id:`eq.${teacherId}`},limit:1});
    return rows[0]||null;
  }
  async function get() {
    const saved=await row();
    const state=saved?.settings&&typeof saved.settings==='object'?saved.settings:{};
    return {models:normalizeModels(state.models||defaults),brief_version:typeof state.brief_version==='string'?state.brief_version:'original'};
  }
  async function write(next) {
    const existing=await row();
    if(existing) {
      const rows=await db.mutateRows(table,'PATCH',{query:{teacher_id:`eq.${teacherId}`},body:{settings:next,updated_at:new Date().toISOString()}});
      if(!rows?.[0]) throw fail('settings_save_failed');
    } else {
      try {
        const rows=await db.mutateRows(table,'POST',{body:{teacher_id:teacherId,settings:next}});
        if(!rows?.[0]) throw fail('settings_save_failed');
      } catch(error) {
        const rows=await db.mutateRows(table,'PATCH',{query:{teacher_id:`eq.${teacherId}`},body:{settings:next,updated_at:new Date().toISOString()}}).catch(()=>[]);
        if(!rows[0]) throw error;
      }
    }
    return next;
  }
  return Object.freeze({
    defaults:()=>({...defaults}),
    async getModels() { return (await get()).models; },
    async saveModels(models) { const old=await get(); const state=await write({...old,models:normalizeModels(models)}); return state.models; },
    async getBriefVersion() { return (await get()).brief_version; },
    async saveBriefVersion(version) {
      if(!briefVersions.status(version).versions.some(item=>item.id===version)) throw fail('invalid_brief_version');
      const old=await get(); return (await write({...old,brief_version:version})).brief_version;
    }
  });
}
module.exports={ROLES,normalizeModels,createTeacherSettingsStore};

