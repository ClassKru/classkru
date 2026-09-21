// Teacher-owned conversation workspace. The active phase is chat and planning only.
(() => {
  'use strict';
  let root, selected=null, snapshot=null, config=null, poll=null, busy=false, returnFocus=null, epoch=0, authListener=null;
  const running=new Set();
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>document.getElementById(`ms-${id}`);
  const errors={
    authentication_required:'กรุณาเข้าสู่ระบบก่อนใช้พื้นที่สนทนา',invalid_session:'หมดเวลาเข้าสู่ระบบ กรุณาล็อกอินใหม่',
    ai_not_configured:'ยังไม่ได้เปิดบริการ AI กรุณาติดต่อผู้ดูแล',storage_not_configured:'พื้นที่เก็บบทสนทนาหรือกุญแจเข้ารหัสยังไม่พร้อม กรุณาติดต่อผู้ดูแล',storage_bucket_unsafe:'พื้นที่เก็บบทสนทนาต้องเป็นส่วนตัว กรุณาติดต่อผู้ดูแล',storage_integrity_failed:'ตรวจสอบข้อมูลบทสนทนาไม่ผ่าน กรุณาติดต่อผู้ดูแล',storage_unavailable:'ติดต่อพื้นที่เก็บบทสนทนาไม่ได้ กรุณาลองใหม่',workspace_busy:'บัญชีนี้กำลังบันทึกงาน กรุณารอสักครู่แล้วลองใหม่',request_conflict:'คำขอนี้ถูกใช้แล้ว กรุณาส่งใหม่',
    daily_limit:'วันนี้ใช้โควตาคุยกับ AI ครบแล้ว ลองใหม่ภายหลัง',project_limit:'มีบทสนทนาครบ 100 รายการแล้ว',project_busy:'บทสนทนานี้กำลังประมวลผล กรุณารอให้เสร็จก่อน',queue_limit:'มีข้อความรออยู่หลายรายการ กรุณารอก่อน',
    ai_busy:'ผู้ให้บริการ AI กำลังรับงานมาก ลองส่งใหม่ภายหลัง',ai_incomplete:'AI ส่งคำตอบมาไม่ครบ ลองส่งใหม่อีกครั้ง',ai_refused:'AI ไม่สามารถทำตามคำขอนี้ ลองปรับข้อความใหม่',ai_request_failed:'ติดต่อ AI ไม่สำเร็จ กรุณาลองใหม่',ai_invalid_response:'คำตอบจาก AI ไม่ครบตามรูปแบบ กรุณาลองใหม่',
    job_expired:'คำขอนี้หมดเวลาประมวลผล คุณส่งใหม่ได้',generation_failed:'AI ตอบกลับไม่สำเร็จ กรุณาลองใหม่',project_archived:'บทสนทนานี้ถูกเก็บเข้ากรุแล้ว',not_found:'ไม่พบบทสนทนานี้หรือบัญชีนี้ไม่มีสิทธิ์เปิด'
  };
  const errorText=error=>errors[String(error.code||'').toLowerCase()]||error.message||'เกิดข้อผิดพลาด กรุณาลองใหม่';
  function notice(message,isError=false) { if ($('notice')) { $('notice').textContent=message; $('notice').classList.toggle('ms-error',isError); } }
  async function api(action,data={},get=false) {
    if (typeof supabaseClient==='undefined' || !supabaseClient) throw {code:'authentication_required'};
    const {data:session,error}=await supabaseClient.auth.getSession();
    if (error || !session.session) throw {code:'authentication_required'};
    const query=get?'?'+new URLSearchParams({action,...data}):'';
    const response=await fetch('/api/media-studio'+query,{method:get?'GET':'POST',headers:{Authorization:`Bearer ${session.session.access_token}`,'Content-Type':'application/json'},body:get?undefined:JSON.stringify({action,...data})});
    const result=await response.json().catch(()=>({error:'server_unavailable'}));
    if (!response.ok) throw {code:result.error,message:errors[result.error]||'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่'};
    return result;
  }
  function close() {
    epoch++;clearTimeout(poll);root?.remove();root=null;selected=null;snapshot=null;busy=false;
    authListener?.unsubscribe();authListener=null;
    document.body.classList.remove('modal-open');returnFocus?.focus();
  }
  async function list() {
    const result=await api('list',{},true);
    if (!root) return;
    $('library').innerHTML=result.projects.length
      ?result.projects.map(p=>`<button type="button" class="ms-project ${selected===p.id?'active':''}" data-project="${esc(p.id)}"><strong>${esc(p.title)}</strong><small>บทสนทนาล่าสุด · ${new Date(p.updated_at).toLocaleDateString('th-TH')}</small></button>`).join('')
      :'<p class="ms-empty">ยังไม่มีบทสนทนา</p>';
  }
  function controls() {
    const active=snapshot?.jobs?.some(job=>['queued','running'].includes(job.status));
    const archived=snapshot?.project?.archived;
    $('send').disabled=busy||active||archived||!config?.ai||!config?.storage;
    $('build').disabled=true;
  }
  function renderState(data) {
    snapshot=data;
    $('title').textContent=data.project.title;
    $('conversation').innerHTML=data.turns.map(turn=>`<article class="ms-message ${turn.role}"><strong>${turn.role==='teacher'?'คุณครู':'AI ผู้ช่วยออกแบบ'}</strong><p>${esc(turn.message)}</p></article>`).join('');
    $('conversation').scrollTop=$('conversation').scrollHeight;
    const plan=data.project.plan;
    $('plan').innerHTML=plan
      ?`<h3>${esc(plan.title)}</h3>${[['เป้าหมาย',plan.objective],['สิ่งที่เด็กจะสังเกต',plan.observation],['ตัวแปร',(plan.variables||[]).join(' · ')],['ภารกิจ',plan.mission]].map(([label,value])=>`<div class="ms-plan-row"><small>${label}</small><p>${esc(value)}</p></div>`).join('')}`
      :'<p class="ms-empty">—</p>';
    $('followups').innerHTML=(plan?.next_questions||[]).map(question=>`<button class="btn" type="button" data-question="${esc(question)}">${esc(question)}</button>`).join('');
    const job=data.jobs[0];
    $('job').textContent=job?.status==='queued'?'กำลังส่งข้อความให้ AI…':job?.status==='running'?'AI กำลังเรียบเรียงคำตอบ…':job?.status==='failed'?errorText({code:job.error_code}):'';
    if(job?.status==='succeeded') notice('AI ตอบกลับแล้ว');
    controls();
  }
  async function load(projectId) {
    const stamp=epoch;
    const data=await api('get',{id:projectId},true);
    if (!root||selected!==projectId||stamp!==epoch) return;
    renderState(data);
    clearTimeout(poll);
    const active=data.jobs.filter(job=>['queued','running'].includes(job.status));
    for(const job of active.filter(job=>job.status==='queued')) processJob(job.id,projectId);
    if(active.length) poll=setTimeout(()=>pollJobs(projectId),5000);
  }
  async function pollJobs(projectId) {
    const stamp=epoch;
    try {
      const data=await api('jobs',{id:projectId},true);
      if(!root||selected!==projectId||stamp!==epoch)return;
      if(JSON.stringify(data.jobs)!==JSON.stringify(snapshot?.jobs))return await load(projectId);
      for(const job of data.jobs.filter(job=>job.status==='queued'))processJob(job.id,projectId);
      if(data.jobs.some(job=>['queued','running'].includes(job.status)))poll=setTimeout(()=>pollJobs(projectId),5000);
    } catch(error) {
      if(root&&selected===projectId&&stamp===epoch){notice(errorText(error),true);poll=setTimeout(()=>pollJobs(projectId),10000);}
    }
  }
  function processJob(jobId,projectId) {
    if(running.has(jobId))return;
    running.add(jobId);
    api('run',{project_id:projectId,job_id:jobId}).then(result=>{if(result.started&&root&&selected===projectId)return load(projectId);}).catch(error=>{if(root)notice(errorText(error),true);}).finally(()=>running.delete(jobId));
  }
  async function choose(projectId) {
    epoch++;clearTimeout(poll);selected=projectId;snapshot=null;
    notice('กำลังเปิดบทสนทนา…');await load(projectId);await list();notice('บทสนทนานี้เก็บไว้ในบัญชีของคุณครู');
  }
  async function send() {
    if(busy)return;
    const message=$('input').value.trim();
    if(message.length<3){notice('พิมพ์ข้อความอย่างน้อย 3 ตัวอักษร',true);return;}
    busy=true;controls();
    try {
      if(!selected){const result=await api('create',{title:message.slice(0,70)});selected=result.project.id;}
      const result=await api('enqueue',{project_id:selected,kind:'plan',message,request_key:crypto.randomUUID()});
      $('input').value='';notice('กำลังรอคำตอบจาก AI…');
      await load(selected);await list();processJob(result.job.id,selected);
    } catch(error){notice(errorText(error),true);}
    finally {busy=false;if(root)controls();}
  }
  async function action(event) {
    const button=event.target.closest('button');if(!button)return;
    try {
      if(button.dataset.project)return await choose(button.dataset.project);
      if(button.dataset.question){$('input').value=button.dataset.question;$('input').focus();return;}
      if(button.id==='ms-close')close();
      if(button.id==='ms-new'){
        epoch++;clearTimeout(poll);selected=null;snapshot=null;
        renderState({project:{title:'การสนทนาใหม่'},turns:[],jobs:[]});await list();$('input').focus();
      }
    }catch(error){notice(errorText(error),true);}
  }
  window.openInteractiveMediaStudio=async function() {
    if(root)return;
    config=null;returnFocus=document.activeElement;root=document.createElement('div');root.className='ms-overlay';
    root.innerHTML=`<section class="ms-dialog" role="dialog" aria-modal="true" aria-labelledby="ms-title"><header class="ms-header"><div><small>ClassKru · พื้นที่สนทนา</small><h2 id="ms-title">การสนทนาใหม่</h2></div><button id="ms-close" type="button" class="btn" aria-label="ปิดหน้าต่าง">ปิด</button></header>
      <div class="ms-layout"><aside class="ms-library"><button id="ms-new" type="button" class="btn btn-primary">+ บทสนทนาใหม่</button><h3>บทสนทนาก่อนหน้า</h3><div id="ms-library"></div></aside>
      <main class="ms-main"><p id="ms-notice" role="status">กำลังเปิดคลังบทสนทนา…</p><p class="ms-privacy">ข้อความจะส่งให้ AI และเก็บไว้ในบัญชีของคุณครูเพื่อกลับมาปรับต่อ</p><div class="ms-workspace"><div class="ms-chat"><div id="ms-conversation" role="log" aria-live="polite"></div><form id="ms-form"><label for="ms-input">ข้อความถึง AI</label><textarea id="ms-input" rows="3" maxlength="6000"></textarea><div class="ms-composer-actions"><button id="ms-send" type="submit" class="btn btn-primary">ส่งข้อความ</button><button id="ms-build" type="button" class="btn" disabled>สร้างสื่อ · เร็ว ๆ นี้</button></div></form><p id="ms-job" role="status"></p></div><aside class="ms-plan"><h3>แนวทางจาก AI</h3><div id="ms-plan"></div><div id="ms-followups"></div></aside></div></main></div></section>`;
    document.body.append(root);document.body.classList.add('modal-open');root.addEventListener('click',action);
    root.addEventListener('keydown',event=>{
      if(event.key==='Escape'){close();return;}
      if(event.key==='Tab'){const items=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')].filter(element=>element.offsetParent!==null);const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
    });
    $('form').addEventListener('submit',event=>{event.preventDefault();send();});
    renderState({project:{title:'การสนทนาใหม่'},turns:[],jobs:[]});$('close').focus();
    try {
      config=await api('config',{},true);await list();
      if(!root)return;
      notice(!config.ai?'คลังพร้อม · บริการ AI ยังรอผู้ดูแลตั้งค่า':!config.storage?'คลังยังไม่พร้อม · พื้นที่เก็บบทสนทนายังรอผู้ดูแลตั้งค่า':'เลือกบทสนทนาเดิม หรือเริ่มบทสนทนาใหม่');controls();
      const {data}=await supabaseClient.auth.getSession();const owner=data.session?.user.id;
      authListener=supabaseClient.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(session&&session.user.id!==owner))close();}).data.subscription;
    } catch(error){notice(errorText(error),true);if(root)controls();}
  };
})();
