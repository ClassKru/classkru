const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function fixture(settings={startTime:'08:30',duration:50,breakTime:10,count:3}) {
  const source=fs.readFileSync('js/timetable.js','utf8').split('// ==================== PERIOD SETTINGS MODAL ====================')[1].split('// ==================== ATTENDANCE MATRIX')[0];
  const el={}; for(const id of ['ps-start-time','ps-duration','ps-break','ps-count','ps-preview','ps-settings-error','ps-save','modal-period-settings'])el[id]={value:'',innerHTML:'',textContent:'',disabled:false,classList:{add(){},remove(){}}};
  const state={periodSettings:settings,timetable:[],activeWebScreen:'timetable'};
  const context={document:{getElementById:id=>el[id]},appState:state,saveState(){},renderWebTimetable(){},renderWebDashboard(){},confirm:()=>true};vm.createContext(context);vm.runInContext(source,context);return {context,el,state};
}
test('existing settings populate the form and preview, including custom break',()=>{const {context,el}=fixture();context.openPeriodSettings();assert.equal(el['ps-break'].value,10);assert.match(el['ps-preview'].innerHTML,/08:30–09:20/);assert.match(el['ps-preview'].innerHTML,/09:30–10:20/);assert.equal(el['ps-save'].disabled,false)});
test('saving preserves the data contract and existing timetable entries',()=>{const {context,el,state}=fixture();state.timetable=[{period:5,subject:'science'}];context.openPeriodSettings();el['ps-count'].value='2';context.confirm=()=>false;context.savePeriodSettings();assert.equal(state.periodSettings.count,3);context.confirm=()=>true;context.savePeriodSettings();assert.equal(state.periodSettings.count,2);assert.equal(state.periodSettings.breakTime,10);assert.equal(state.timetable.length,1)});
test('invalid, fractional or overnight settings never save',()=>{const {context,el,state}=fixture();context.openPeriodSettings();for(const [id,value] of [['ps-count','1.5'],['ps-duration',''],['ps-start-time','23:50']]){context.openPeriodSettings();el[id].value=value;context.renderPeriodPreview();assert.equal(el['ps-save'].disabled,true);context.savePeriodSettings();assert.equal(state.periodSettings.count,3)}});
