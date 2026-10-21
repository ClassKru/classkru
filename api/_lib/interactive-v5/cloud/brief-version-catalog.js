'use strict';

const fs=require('node:fs');
const path=require('node:path');
const FILES={conversation:'conversation-prompts.js',architect:'architect-prompts.js',builder:'builder-prompts.js'};
const REQUIRED=[...Object.values(FILES),'media-mode.js','กฎกลาง.md'];
function createBriefVersionCatalog({root=path.resolve(process.cwd(),'brief-versions')}={}) {
  function versions() {
    let entries=[];
    try { entries=fs.readdirSync(root,{withFileTypes:true}); } catch (_) {}
    return entries.filter(entry=>entry.isDirectory()&&!entry.isSymbolicLink()&&/^\d{2,}[^/\\]*$/.test(entry.name))
      .filter(entry=>REQUIRED.every(file=>{try { const stat=fs.lstatSync(path.join(root,entry.name,file)); return stat.isFile()&&!stat.isSymbolicLink(); } catch (_) { return false; }}))
      .map(entry=>({id:entry.name,label:entry.name})).sort((a,b)=>a.id.localeCompare(b.id,'th',{numeric:true}));
  }
  function status(selected='original') { const available=[{id:'original',label:'ระบบเดิม (V5)'},...versions()]; return {selected,versions:available,missing:!available.some(item=>item.id===selected)}; }
  function builder(selected,role) {
    if(!Object.hasOwn(FILES,role)) throw Object.assign(new Error('invalid_brief_version'),{code:'invalid_brief_version'});
    if(selected==='original') return require(`../${role==='conversation'?'conversation-ai':role==='architect'?'prompt-architect-ai':'html-media-builder-ai'}/prompts`).buildRequest;
    if(!versions().some(item=>item.id===selected)) throw Object.assign(new Error('invalid_brief_version'),{code:'invalid_brief_version'});
    const file=path.join(root,selected,FILES[role]); const resolved=require.resolve(file); delete require.cache[resolved];
    const prompts=require(file); if(typeof prompts.buildRequest!=='function') throw Object.assign(new Error('invalid_brief_version'),{code:'invalid_brief_version'});
    return prompts.buildRequest;
  }
  return Object.freeze({versions,status,builder});
}
module.exports={createBriefVersionCatalog};

