// Teacher workspace. Generated code is never inserted into the application DOM.
(() => {
  'use strict';
  let root, preview, selected=null, selectedVersion=null, snapshot=null, config=null, poll=null, busy=false, returnFocus=null, epoch=0, authListener=null;
  const running=new Set();
  let requestedClass='';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>document.getElementById(`ms-${id}`);
  const errors={
    authentication_required:'กรุณาเข้าสู่ระบบก่อนใช้คลังสื่อ',invalid_session:'หมดเวลาเข้าสู่ระบบ กรุณาล็อกอินใหม่',
    ai_not_configured:'ยังไม่ได้เปิดบริการ AI กรุณาติดต่อผู้ดูแล',storage_not_configured:'พื้นที่เก็บสื่อหรือกุญแจเข้ารหัสยังไม่พร้อม กรุณาติดต่อผู้ดูแล',storage_bucket_unsafe:'พื้นที่เก็บสื่อต้องเป็นส่วนตัว กรุณาติดต่อผู้ดูแล',storage_integrity_failed:'ตรวจสอบไฟล์ไม่ผ่าน กรุณาติดต่อผู้ดูแล',storage_unavailable:'ติดต่อพื้นที่เก็บไฟล์ไม่สำเร็จ กรุณาลองใหม่',workspace_busy:'บัญชีนี้กำลังบันทึกงาน กรุณารอสักครู่แล้วลองใหม่',request_conflict:'คำขอนี้ถูกใช้แล้ว กรุณาส่งใหม่',link_limit:'งานนี้สร้างลิงก์ครบขีดจำกัดแล้ว กรุณาติดต่อผู้ดูแล',
    media_host_not_configured:'ยังไม่ได้ตั้งเว็บเปิดสื่อ กรุณาติดต่อผู้ดูแล',invalid_media_origin:'การตั้งค่าเว็บเปิดสื่อไม่ถูกต้อง',
    daily_limit:'วันนี้ใช้โควตาสร้างและคุยกับ AI ครบแล้ว ลองใหม่ภายหลัง',project_limit:'คลังมีครบ 100 งานแล้ว',version_limit:'งานนี้มีครบ 30 เวอร์ชันแล้ว',
    project_busy:'งานนี้กำลังประมวลผล กรุณารอให้เสร็จก่อน',queue_limit:'มีงานรออยู่หลายงาน กรุณารอก่อน',
    ai_busy:'ผู้ให้บริการ AI กำลังรับงานมาก ลองส่งใหม่ภายหลัง',ai_incomplete:'AI ส่งโค้ดมาไม่ครบ ลองลดขอบเขตสื่อแล้วส่งใหม่',ai_refused:'AI ไม่สามารถทำตามคำขอนี้ ลองปรับโจทย์ใหม่',
    ai_request_failed:'ติดต่อ AI ไม่สำเร็จ กรุณาลองใหม่',ai_invalid_response:'คำตอบจาก AI ไม่ครบตามรูปแบบ กรุณาลองใหม่',
    unsafe_html:'สื่อใช้ส่วนประกอบที่ยังไม่รองรับ ลองขอให้สร้างด้วย HTML และ canvas พื้นฐาน',unsafe_css:'รูปแบบสื่อมีการอ้างอิงภายนอก กรุณาขอสร้างแบบไม่ใช้ไฟล์ภายนอก',unsafe_script:'โค้ดขอใช้ความสามารถที่ไม่ได้อนุญาต กรุณาขอปรับใหม่',
    invalid_javascript:'โค้ดที่ AI ส่งมายังทำงานไม่ได้ กรุณาสั่งสร้างใหม่',invalid_artifact:'ไฟล์สื่อไม่ครบหรือใหญ่เกินไป ลองลดความซับซ้อน',
    preview_failed:'สื่อยังไม่ผ่านการทดสอบการทำงาน กรุณาสั่งปรับใหม่',preview_layout_failed:'สื่อยังแสดงผลบนมือถือไม่ครบ กรุณาขอปรับให้พอดีจอ',preview_timeout:'สื่อใช้เวลาประมวลผลมากเกินไป กรุณาขอปรับให้เบาลง',
    job_expired:'งานนี้หมดเวลาประมวลผล คุณส่งคำขอใหม่ได้',generation_failed:'สร้างสื่อไม่สำเร็จ กรุณาลองปรับคำขอแล้วส่งใหม่',project_archived:'งานนี้เก็บเข้ากรุแล้ว กรุณานำกลับมาก่อน',
    database_unavailable:'ติดต่อคลังสื่อไม่ได้ กรุณาลองใหม่',not_found:'ไม่พบงานนี้หรือบัญชีนี้ไม่มีสิทธิ์เปิด',review_required:'กรุณาทดลองและยืนยันตรวจสื่อก่อนเผยแพร่'
  };
  const starterIdea='อยากสร้างเกมเรื่องพลังงานศักย์และพลังงานจลน์ ให้นักเรียนเห็นว่าความสูงจุดปล่อยส่งผลต่อความเร็วอย่างไร โดยปรับความสูง มวล และแรงเสียดทานได้';
  const starterQuestions=['เด็กควรเล่นเดี่ยวหรือเป็นกลุ่ม?','ต้องการใช้เวลาในคาบกี่นาที?','อยากให้แรงเสียดทานเป็นตัวแปรหลักไหม?'];
  const errorText=error=>errors[String(error.code||'').toLowerCase()]||error.message||'เกิดข้อผิดพลาด กรุณาลองใหม่';
  function notice(message,isError=false) { if ($('notice')) { $('notice').textContent=message; $('notice').classList.toggle('ms-error',isError); } }
  function chatStatus(message) {
    if (!$('conversation')) return;
    $('reply-status')?.remove();
    if (message) {
      const bubble=document.createElement('article');bubble.id='ms-reply-status';bubble.className='ms-message assistant';
      const label=document.createElement('strong');label.textContent='สถานะการตอบกลับ';
      const text=document.createElement('p');text.textContent=message;bubble.append(label,text);$('conversation').append(bubble);
    }
    $('conversation').scrollTop=$('conversation').scrollHeight;
  }
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
  function classContext() {
    const classes=typeof appState!=='undefined'?appState.classes||[]:[];
    const cls=classes.find(c=>c.id===(requestedClass||(typeof swipeClassId!=='undefined'?swipeClassId:null)));
    return {subject:cls?.subject||'',classroom:cls?.className||'',duration_minutes:15};
  }
  function closePreview() { preview?.remove();preview=null; }
  function close() {
    epoch++;clearTimeout(poll);closePreview();root?.remove();root=null;selected=null;snapshot=null;busy=false;
    authListener?.unsubscribe();authListener=null;
    document.body.classList.remove('modal-open');returnFocus?.focus();
  }
  async function list() {
    const result=await api('list',{archived:$('archived')?.checked?'true':'false'},true);
    if (!root) return;
    $('library').innerHTML=result.projects.length?result.projects.map(p=>`<button type="button" class="ms-project ${selected===p.id?'active':''}" data-project="${esc(p.id)}"><strong>${esc(p.title)}</strong><small>${esc(p.context?.subject||'สื่อการสอน')} · ${new Date(p.updated_at).toLocaleDateString('th-TH')}</small></button>`).join(''):'<p class="ms-empty">ยังไม่มีงานในคลังนี้</p>';
  }
  function controls() {
    const active=snapshot?.jobs?.some(j=>['queued','running'].includes(j.status));
    const archived=snapshot?.project?.archived;
    const hasPlan=Boolean(snapshot?.project?.plan);
    const hasVersion=Boolean(selectedVersion);
    $('send').disabled=busy||active||archived||!config?.ai||!config?.storage;
    $('build').disabled=busy||active||archived||!hasPlan||!config?.ai||!config?.storage||!config?.media_origin;
    $('build').textContent=snapshot?.versions?.length?'สร้างเวอร์ชันปรับปรุง':'สร้างสื่อที่เล่นได้';
    $('build-help').hidden=hasPlan||active||archived;
    $('preview').disabled=!hasVersion||busy||!config?.media_origin||archived;
    $('publish').disabled=!hasVersion||!$('review').checked||busy||archived||!config?.media_origin;
    $('archive').hidden=!selected;
    $('archive').textContent=archived?'นำกลับมาใช้งาน':'เก็บงานเข้ากรุ';
    $('step-plan').classList.toggle('is-current',!hasPlan);
    $('step-build').classList.toggle('is-current',hasPlan&&!hasVersion);
    $('step-review').classList.toggle('is-current',hasVersion);
  }
  function renderState(data) {
    snapshot=data;
    const showGuide=!selected&&!data.turns.length;
    $('title').textContent=data.project.title;
    $('conversation').innerHTML=showGuide?`<div class="ms-example-label">ตัวอย่างบทสนทนา · ยังไม่เรียก AI</div><article class="ms-message teacher"><strong>คุณครู</strong><p>อยากสร้างเกมเรื่องพลังงานศักย์และพลังงานจลน์ ให้นักเรียนเห็นตัวแปรที่เปลี่ยนไปได้ง่าย</p></article><article class="ms-message assistant"><strong>AI ผู้ช่วยออกแบบ</strong><p>ลองเริ่มจาก <b>รางรถไฟพลังงาน</b> ค่ะ เด็กจะปรับความสูงจุดปล่อย แล้วสังเกตว่ารถไฟเคลื่อนที่เร็วขึ้นเมื่ออยู่ต่ำลงอย่างไร</p><p>อาจต่อยอดเป็นเกมภารกิจให้พารถไฟถึงสถานีด้วยพลังงานที่พอดี ก่อนสร้างจริง AI จะช่วยปรับระดับความยาก เวลา และอุปกรณ์ให้เหมาะกับห้องเรียนของคุณครู</p></article>`:data.turns.map(turn=>`<article class="ms-message ${turn.role}"><strong>${turn.role==='teacher'?'คุณครู':'AI ผู้ช่วยออกแบบ'}</strong><p>${esc(turn.message)}</p></article>`).join('')||'<p class="ms-empty">บอกสิ่งที่อยากให้นักเรียนเข้าใจ แล้วเราจะเริ่มออกแบบด้วยกัน</p>';
    $('conversation').scrollTop=$('conversation').scrollHeight;
    const p=data.project.plan;
    const guidedPlan={title:'รางรถไฟพลังงาน: ปรับความสูงจุดปล่อย',objective:'เชื่อมความสัมพันธ์ของพลังงานศักย์ พลังงานจลน์ และความเร็ว',observation:'อยู่สูง → ปล่อย → เคลื่อนที่เร็วขึ้น',variables:'ความสูง · มวล · แรงเสียดทาน',mission:'พารถไฟให้ถึงสถานีด้วยพลังงานที่พอดี'};
    const visiblePlan=p?{title:p.title,objective:p.objective,observation:p.observation,variables:(p.variables||[]).join(' · '),mission:p.mission}:showGuide?guidedPlan:null;
    $('plan').innerHTML=visiblePlan?`<div class="ms-plan-title"><span>${p?'สรุปที่พร้อมสร้าง':'ตัวอย่างแผนสื่อ · ยังไม่บันทึก'}</span><h3>${esc(visiblePlan.title)}</h3></div>${[['เป้าหมาย',visiblePlan.objective],['สิ่งที่เด็กจะเห็น',visiblePlan.observation],['ตัวแปร',visiblePlan.variables],['ภารกิจ',visiblePlan.mission]].map(([label,value])=>`<div class="ms-plan-row"><small>${label}</small><p>${esc(value)}</p></div>`).join('')}${showGuide?'<button type="button" class="btn btn-primary ms-use-starter" data-use-starter="true">ใช้ไอเดียนี้ แล้วให้ AI ช่วยต่อ</button>':''}`:'<div class="ms-plan-empty"><strong>AI จะสรุปแผนให้ที่นี่</strong><p>เมื่อคุยกันแล้ว คุณครูจะเห็นเป้าหมาย สิ่งที่เด็กสังเกต ตัวแปร และภารกิจ ก่อนตัดสินใจสร้าง</p></div>';
    $('followups').innerHTML=(p?.next_questions||[]).map(q=>`<button class="btn" type="button" data-question="${esc(q)}">${esc(q)}</button>`).join('')||(showGuide?starterQuestions.map(q=>`<button class="btn" type="button" data-starter-question="${esc(q)}">${esc(q)}</button>`).join(''):'' );
    $('starters').hidden=showGuide;
    const oldVersion=selectedVersion;
    if (!data.versions.some(v=>v.id===selectedVersion)) selectedVersion=data.versions[0]?.id||null;
    if (oldVersion!==selectedVersion) $('review').checked=false;
    $('versions').innerHTML=data.versions.map((v,i)=>`<option value="${esc(v.id)}">เวอร์ชัน ${data.versions.length-i} · ${esc(v.title)}</option>`).join('')||'<option value="">ยังไม่มีสื่อ</option>';
    $('versions').value=selectedVersion||'';
    $('version-summary').textContent=data.versions.find(v=>v.id===selectedVersion)?.summary||'คุยจนได้แนวทาง แล้วกดสร้างสื่อที่เล่นได้';
    $('links').innerHTML=data.links.map(link=>`<div class="ms-link"><a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">เปิดลิงก์สื่อ</a><button type="button" class="btn" data-copy="${esc(link.url)}">คัดลอก</button><button type="button" class="btn" data-revoke="${esc(link.id)}">ปิดลิงก์</button></div>`).join('');
    const job=data.jobs[0];
    $('job').textContent=job?.status==='queued'?'รอคิวสร้างสื่อ…':job?.status==='running'?'AI กำลังทำงานและระบบกำลังตรวจสื่อ…':job?.status==='failed'?errorText({code:job.error_code}):'';
    chatStatus(['queued','running'].includes(job?.status)?(job.kind==='plan'?'AI กำลังอ่านไอเดียและเตรียมคำตอบ…':'AI กำลังสร้างและตรวจสอบสื่อ…'):job?.status==='failed'?errorText({code:job.error_code}):'');
    controls();
  }
  async function load(projectId,selectNewest=false) {
    const stamp=epoch;
    const data=await api('get',{id:projectId},true);
    if (!root||selected!==projectId||stamp!==epoch) return;
    if(selectNewest)selectedVersion=null;
    renderState(data);
    clearTimeout(poll);
    const active=data.jobs.filter(j=>['queued','running'].includes(j.status));
    for (const job of active.filter(j=>j.status==='queued')) processJob(job.id,projectId);
    if(active.length)poll=setTimeout(()=>pollJobs(projectId),5000);
  }
  async function pollJobs(projectId) {
    const stamp=epoch;
    try {
      const data=await api('jobs',{id:projectId},true);
      if(!root||selected!==projectId||stamp!==epoch)return;
      if(JSON.stringify(data.jobs)!==JSON.stringify(snapshot?.jobs))return await load(projectId);
      for(const job of data.jobs.filter(j=>j.status==='queued'))processJob(job.id,projectId);
      if(data.jobs.some(j=>['queued','running'].includes(j.status)))poll=setTimeout(()=>pollJobs(projectId),5000);
    } catch(e) {
      if(root&&selected===projectId&&stamp===epoch){notice(errorText(e),true);poll=setTimeout(()=>pollJobs(projectId),10000);}
    }
  }
  function processJob(jobId,projectId) {
    if(running.has(jobId))return;
    running.add(jobId);
    const stamp=epoch;
    api('run',{project_id:projectId,job_id:jobId}).then(()=>{if(root&&selected===projectId&&epoch===stamp)return load(projectId,true);}).catch(e=>{if(root&&selected===projectId&&epoch===stamp){notice(errorText(e),true);chatStatus(errorText(e));}}).finally(()=>running.delete(jobId));
  }
  async function choose(projectId) {
    epoch++;clearTimeout(poll);closePreview();selected=projectId;selectedVersion=null;snapshot=null;$('review').checked=false;
    notice('กำลังเปิดงาน…');await load(projectId);await list();notice('บันทึกงานและบทสนทนาในบัญชีของคุณครู');
  }
  async function send(kind) {
    if(busy||snapshot?.jobs?.some(j=>['queued','running'].includes(j.status)))return;
    let message=$('input').value.trim();
    if(kind==='build'&&!message)message='สร้างสื่อที่เล่นได้ตามแผนที่คุยกัน พร้อมตัวแปร ภารกิจ และปุ่มเริ่มใหม่';
    if(message.length<3){notice('พิมพ์ไอเดียหรือสิ่งที่อยากปรับอย่างน้อย 3 ตัวอักษร',true);return;}
    busy=true;controls();chatStatus('กำลังส่งข้อความให้ AI…');
    try {
      if(!selected){const result=await api('create',{title:message.slice(0,70),context:classContext()});selected=result.project.id;}
      const result=await api('enqueue',{project_id:selected,kind,message,request_key:crypto.randomUUID()});
      $('input').value='';notice('บันทึกคำขอแล้ว · เปิดงานนี้ภายหลังเพื่อดูผลได้');
      await load(selected);await list();processJob(result.job.id,selected);
    } catch(e){notice(errorText(e),true);chatStatus(errorText(e));}
    finally {busy=false;if(root)controls();}
  }
  async function previewMedia() {
    const link=await api('preview',{project_id:selected,version_id:selectedVersion});
    if(!root)return;
    const url=new URL(link.url);
    if(url.origin!==config.media_origin)throw new Error('เว็บเปิดสื่อไม่ตรงกับการตั้งค่า');
    closePreview();preview=document.createElement('div');preview.className='ms-preview';
    preview.innerHTML='<section role="dialog" aria-modal="true" aria-label="ทดลองสื่อ"><header><strong>ทดลองเล่นก่อนเผยแพร่</strong><button class="btn" type="button">ปิดการทดลอง</button></header></section>';
    const frame=document.createElement('iframe');frame.title='ตัวเปิดสื่อ ClassKru';frame.referrerPolicy='no-referrer';
    // Only the trusted, separate-origin player gets same-origin. Its artifact iframe never does.
    frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.src=url.href;
    preview.firstChild.append(frame);preview.querySelector('button').onclick=()=>{closePreview();$('review').focus();};
    root.append(preview);preview.querySelector('button').focus();
  }
  async function action(event) {
    const button=event.target.closest('button');if(!button)return;
    try {
      if(button.dataset.project)return await choose(button.dataset.project);
      if(button.dataset.useStarter){$('input').value=starterIdea;await send('plan');return;}
      if(button.dataset.starterQuestion){$('input').value=`${starterIdea}\n\n${button.dataset.starterQuestion}`;await send('plan');return;}
      if(button.dataset.question){$('input').value=button.dataset.question;await send('plan');return;}
      if(button.dataset.starter){$('input').value=button.dataset.starter;$('input').focus();return;}
      if(button.dataset.copy){await navigator.clipboard.writeText(button.dataset.copy);notice('คัดลอกลิงก์แล้ว');return;}
      if(button.dataset.revoke){await api('revoke',{project_id:selected,link_id:button.dataset.revoke});await load(selected);notice('ปิดลิงก์แล้ว ผู้เปิดครั้งถัดไปจะเข้าไม่ได้');return;}
      switch(button.id){
        case 'ms-close':close();break;
        case 'ms-new':epoch++;clearTimeout(poll);closePreview();selected=null;selectedVersion=null;snapshot=null;renderState({project:{title:'สื่อใหม่'},turns:[],versions:[],jobs:[],links:[]});await list();$('input').focus();break;
        case 'ms-build':await send('build');break;
        case 'ms-preview':await previewMedia();break;
        case 'ms-publish':{if(!$('review').checked)return;const result=await api('publish',{project_id:selected,version_id:selectedVersion,reviewed:true});await load(selected);notice('เผยแพร่แล้ว คัดลอกลิงก์ด้านล่างส่งให้นักเรียนได้');break;}
        case 'ms-archive':{const archived=!snapshot.project.archived;if(archived&&!confirm('เก็บงานนี้เข้ากรุและปิดลิงก์ที่แชร์ทั้งหมด? คุณนำงานกลับมาได้'))return;await api('archive',{project_id:selected,archived});await load(selected);await list();break;}
      }
    }catch(e){notice(errorText(e),true);}
  }
  window.openInteractiveMediaStudio=async function(classId='') {
    if(root)return;
    requestedClass=classId;config=null;
    returnFocus=document.activeElement;root=document.createElement('div');root.className='ms-overlay';
    root.innerHTML=`<section class="ms-dialog" role="dialog" aria-modal="true" aria-labelledby="ms-title"><header class="ms-header"><div><small>ClassKru · สร้างสื่อกับ AI</small><h2 id="ms-title">สื่อใหม่</h2></div><button id="ms-close" type="button" class="btn" aria-label="ปิดหน้าต่าง">ปิด</button></header>
      <div class="ms-layout"><aside class="ms-library"><button id="ms-new" type="button" class="btn btn-primary">+ สร้างงานใหม่</button><h3>คลังสื่อของฉัน</h3><label><input id="ms-archived" type="checkbox"> งานที่เก็บเข้ากรุ</label><div id="ms-library"></div></aside>
      <main class="ms-main"><p id="ms-notice" role="status">กำลังเปิดคลังสื่อ…</p><div class="ms-intro"><div><p class="ms-kicker">เริ่มจากไอเดียสั้น ๆ ก็ได้</p><h3>ออกแบบสื่อร่วมกับ AI ก่อน แล้วค่อยสร้างเมื่อเห็นภาพตรงกัน</h3></div><p class="ms-privacy">บทสนทนานี้บันทึกในบัญชีคุณครูเพื่อคุยต่อได้ กรุณาไม่ใส่ข้อมูลส่วนตัวของนักเรียน</p></div><ol class="ms-steps" aria-label="ขั้นตอนสร้างสื่อ"><li id="ms-step-plan" class="is-current"><span>1</span>คุยและวางแผน</li><li id="ms-step-build"><span>2</span>สร้างและทดลอง</li><li id="ms-step-review"><span>3</span>ตรวจและเผยแพร่</li></ol><div class="ms-workspace"><div class="ms-chat"><div class="ms-chat-heading"><div><p class="ms-kicker">บทสนทนากับ AI</p><h3>คุณอยากให้เด็กเข้าใจอะไร</h3></div><span>ตอบทีละขั้น</span></div><div id="ms-conversation" role="log" aria-live="polite"></div><div id="ms-followups"></div><div id="ms-starters" class="ms-starters" aria-label="ไอเดียเริ่มต้น"><button type="button" data-starter="อยากสร้างเกมพลังงานศักย์และพลังงานจลน์ ให้เด็กเห็นว่าความสูงส่งผลต่อความเร็วอย่างไร">เกมพลังงานและการเคลื่อนที่</button><button type="button" data-starter="อยากทำกิจกรรมคณิตศาสตร์ที่เด็กปรับตัวแปรและอธิบายเหตุผลของคำตอบได้">กิจกรรมให้ปรับตัวแปร</button><button type="button" data-starter="อยากเปลี่ยนบทเรียนนี้ให้เป็นภารกิจสั้น ๆ ในเวลา 15 นาที">ภารกิจสั้น 15 นาที</button></div><form id="ms-form"><label for="ms-input">เล่าไอเดีย หรือบอกสิ่งที่อยากปรับ</label><textarea id="ms-input" rows="3" maxlength="6000" placeholder="เช่น อยากสร้างเกมพลังงานศักย์และพลังงานจลน์ ให้เด็กเห็นว่าความสูงส่งผลต่อความเร็วอย่างไร"></textarea><div class="ms-composer-actions"><button id="ms-send" type="submit" class="btn">ให้ AI ช่วยวางแผน</button><button id="ms-build" type="button" class="btn btn-primary">สร้างสื่อที่เล่นได้</button></div><p id="ms-build-help" class="ms-action-help">วางแผนกับ AI ก่อน แล้วจึงสร้างสื่อที่ตรงกับห้องเรียน</p></form><p id="ms-job" role="status"></p></div><aside class="ms-plan"><div class="ms-plan-heading"><p class="ms-kicker">แผนสื่อ</p><span>อัปเดตจากบทสนทนา</span></div><div id="ms-plan"></div></aside></div>
      <section class="ms-output"><div class="ms-output-heading"><div><p class="ms-kicker">ขั้นตอนสุดท้าย</p><label for="ms-versions">ทดลอง ตรวจ แล้วเผยแพร่</label></div><select id="ms-versions"></select></div><p id="ms-version-summary"></p><div class="ms-output-actions"><button id="ms-preview" type="button" class="btn">1. ทดลองเล่น</button><label><input id="ms-review" type="checkbox"> 2. ฉันทดลองและตรวจเนื้อหาของเวอร์ชันนี้แล้ว</label><button id="ms-publish" type="button" class="btn btn-primary">3. เผยแพร่ลิงก์</button></div><div id="ms-links"></div></section><button id="ms-archive" type="button" class="btn" hidden>เก็บงานเข้ากรุ</button></main></div></section>`;
    document.body.append(root);document.body.classList.add('modal-open');root.addEventListener('click',action);
    root.addEventListener('keydown',event=>{
      if(event.key==='Escape'){if(preview)closePreview();else close();return;}
      if(event.key==='Tab'){const scope=preview||root;const items=[...scope.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')].filter(el=>el.offsetParent!==null);const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
    });
    $('form').addEventListener('submit',event=>{event.preventDefault();send('plan');});
    $('review').addEventListener('change',controls);
    $('versions').addEventListener('change',()=>{selectedVersion=$('versions').value;$('review').checked=false;$('version-summary').textContent=snapshot?.versions.find(v=>v.id===selectedVersion)?.summary||'';controls();});
    $('archived').addEventListener('change',()=>list().catch(e=>notice(errorText(e),true)));
    renderState({project:{title:'สื่อใหม่'},turns:[],versions:[],jobs:[],links:[]});$('close').focus();
    try {
      config=await api('config',{},true);await list();
      if(!root)return;
      notice(!config.ai?'คลังพร้อม · บริการ AI ยังรอผู้ดูแลตั้งค่า':!config.media_origin?'คุยวางแผนได้ · ตัวเปิดสื่อยังรอตั้งค่า':'เล่าไอเดียเพื่อเริ่มต้น หรือเลือกงานเดิมเพื่อคุยต่อ');controls();
      const {data}=await supabaseClient.auth.getSession();const owner=data.session?.user.id;
      authListener=supabaseClient.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(session&&session.user.id!==owner))close();}).data.subscription;
    } catch(e){notice(errorText(e),true);if(root)controls();}
  };
})();
