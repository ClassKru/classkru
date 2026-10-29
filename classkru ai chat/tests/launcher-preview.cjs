'use strict';
// Run from the repository root: node "classkru ai chat/tests/launcher-preview.cjs"
// Local visual review only. Does not load .env or call AI/auth services.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const bar = source.match(/<div id="classkru-ai-dock"[\s\S]*?(?=\s*<section id="ck-ai-panel")/)[0];
const panel = source.match(/<section id="ck-ai-panel"[\s\S]*?<\/section>/)[0];
const modelDialog = source.match(/<section id="ck-ai-model-overlay"[\s\S]*?<\/section>/)[0];
const base = '/classkru%20ai%20chat/frontend/';
const harness = `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ClassKru AI — Local UI Review</title>
<link rel="stylesheet" href="/css/01-base-layout.css"><link rel="stylesheet" href="/css/08-responsive-toast.css">${['16-classkru-ai-launcher','17-classkru-ai-panel','18-classkru-ai-brief-selector','19-classkru-ai-model-selector'].map(n=>`<link rel="stylesheet" href="${base}css/${n}.css">`).join('')}
<style>:root{--bg-app:#fff;--bg-card:#fff;--text-main:#18213b}*{box-sizing:border-box}body{margin:0;font:16px system-ui,sans-serif;background:var(--bg-app);color:var(--text-main);min-height:100vh}.review{padding:32px 24px;max-width:850px}.review a{color:#6741bd;margin-right:18px;line-height:2}.review p{line-height:1.8;color:#697080}.review h1{font-size:22px}</style>
<div id="main-app">${bar}<main class="review app-content"><h1>ClassKru AI · HTML / CSS / SVG</h1><p>Local preview with the actual button, Brief selector and chat opening scripts. All API responses are mocked.</p><nav><a href="/harness?bg=white">White background</a><a href="/harness?bg=gray">Gray background</a><a href="/harness?bg=dark">Dark background</a></nav></main><button class="tour-fab" aria-label="ศูนย์ช่วยเหลือ">?</button><nav class="mobile-bottom-nav" aria-label="เมนูมือถือ">Mobile navigation</nav>${panel}${modelDialog}</div>
<script>
const bg=new URLSearchParams(location.search).get('bg');document.documentElement.style.setProperty('--bg-app',bg==='gray'?'#e7ece9':bg==='dark'?'#18232a':'#ffffff');if(bg==='dark')document.documentElement.style.setProperty('--text-main','#f1f3fa');
window.ClassKruAiActions={hideGuide(){},context(){return {screen:'dashboard'}}};
window.isClassKruMediaDeveloper=()=>true;
window.supabaseClient={auth:{getSession:async()=>({data:{session:{access_token:'local-ui-fixture',user:{id:'11111111-1111-4111-8111-111111111111',email:'developer@example.test'}}}}),onAuthStateChange(){}}};
window.fetch=async(url,opts)=>({ok:true,json:async()=>url.includes('model-settings')?{provider:'mock',keyConfigured:false,modelId:'fixture/model',models:[{id:'fixture/model',name:'Mock model'}],settingsWritable:true,catalogAvailable:true}:opts?.method==='POST'?{selectedVersion:JSON.parse(opts.body).briefVersion}:{developer:true,activeVersion:'v1',selectedVersion:'v2',versions:[{id:'v1',label:'V1 · Production'},{id:'v2',label:'V2 · Intent Test'}]}});
</script>
<script src="${base}js/classkru-ai-panel.js"></script><script src="${base}js/classkru-ai-launcher.js"></script><script src="${base}js/classkru-ai-model-selector.js"></script><script src="${base}js/classkru-ai-brief-selector.js"></script></html>`;
const {createServer} = require(path.join(root, 'scripts/media-dev.cjs'));
createServer({harness}).listen(3527, '127.0.0.1', () => console.log('UI review: http://127.0.0.1:3527/harness'));
