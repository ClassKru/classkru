const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../js/curriculum-catalog.js'), 'utf8');
const science = ['physics', 'chemistry', 'biology'];
function makeClient(status, missingSubject) {
  const sid = 'TH-SCI-ADDITIONAL-2560';
  const data = {
    curriculum_sources: [{source_id:sid, title:'source', status}],
    curriculum_standards: science.map(id => ({source_id:sid,subject_id:id,standard_id:`${id}-1`,code:'สาระ 1',title:'สาระ',strand:'วิทยาศาสตร์เพิ่มเติม'})),
    curriculum_units: science.map(id => ({source_id:sid,subject_id:id,unit_id:`${id}-unit`,grade:'M4',title:'หน่วย',description:''})),
    curriculum_outcomes: science.filter(id => id !== missingSubject).flatMap(id => Array.from({length:21},(_,i)=>({source_id:sid,subject_id:id,outcome_id:`${id}-${String(i).padStart(2,'0')}`,standard_id:`${id}-1`,grade:'M4',unit_id:`${id}-unit`,code:`${id}-${i}`,outcome_text:`ผลการเรียนรู้ ${i}`}))),
    curriculum_references: []
  };
  return { from(table) { const filters=[]; const q={select(){return q}, eq(k,v){filters.push([k,v]);return q}, then(resolve){return Promise.resolve({data:(data[table]||[]).filter(x=>filters.every(([k,v])=>x[k]===v)),error:null}).then(resolve)}, maybeSingle(){return Promise.resolve({data:(data[table]||[]).find(x=>filters.every(([k,v])=>x[k]===v))||null,error:null})}};return q; } };
}
function loadCatalog() {
  const events=[]; const window={dispatchEvent:e=>events.push(e)};
  vm.runInNewContext(source,{window,CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail}}});
  return {catalog:window.CKCurriculumCatalog,events};
}
test('draft data is hidden', async()=>{const {catalog}=loadCatalog();await catalog.loadFromSupabase(makeClient('draft'));for(const id of science) assert.equal(catalog.getSubject(id).available,false);});
test('reviewed science loads all subjects even when guidance is missing', async()=>{const {catalog,events}=loadCatalog();assert.equal(await catalog.loadFromSupabase(makeClient('reviewed')),true);for(const id of science){assert.equal(catalog.getSubject(id).available,true);assert.equal(catalog.getSubject(id).scoreCompatible,false);assert.equal(catalog.search({subjectId:id,grade:'M4'}).length,21);assert.equal(catalog.search({subjectId:id,grade:'M5'}).length,0);}assert.equal(events.length,3);});
test('incomplete data does not expose a partial catalog',async()=>{const {catalog,events}=loadCatalog();await catalog.loadFromSupabase(makeClient('reviewed','biology'));for(const id of science)assert.equal(catalog.getSubject(id).available,false);assert.equal(events.length,0);});
