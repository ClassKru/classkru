(() => {
  'use strict';
  const activities = [
    ['🧪', 'ทดลองและสังเกต', 'ปรับตัวแปร แล้วดูผลลัพธ์', 'สร้างกิจกรรมทดลองที่ให้ผู้เรียนสังเกตและอธิบายผล'],
    ['☷', 'เปรียบเทียบและเรียงลำดับ', 'ค้นหาความสัมพันธ์ของข้อเท็จจริง', 'สร้างเกมเปรียบเทียบ จัดกลุ่ม หรือเรียงลำดับ'],
    ['☝', 'ลากและจัดวาง', 'ประกอบ จับคู่ หรือลำดับ', 'สร้างกิจกรรมลากวางเพื่อทบทวนความเข้าใจ'],
    ['🔎', 'สำรวจและค้นหา', 'ค้นหาเหตุผลหรือเรียนรู้เพิ่มเติม', 'สร้างสื่อสำรวจที่ให้ผู้เรียนค้นหาคำตอบด้วยตนเอง'],
    ['🎯', 'ทำภารกิจร่วมเป้าหมาย', 'ฝึกทักษะ คิดวิเคราะห์', 'สร้างภารกิจสั้น ๆ ที่มีเป้าหมายชัดเจน'],
    ['▥', 'จำลองสถานการณ์', 'ตัดสินใจจากข้อมูลจริง', 'สร้างสถานการณ์จำลองพร้อมคำถามชวนคิด']
  ];
  const templates = [
    {subject:'ฟิสิกส์', icon:'🚀', title:'การเคลื่อนที่แบบโพรเจกไทล์', desc:'ปรับมุมและความเร็ว แล้วดูวิถีการเคลื่อนที่', idea:'สร้างสื่อจำลองการเคลื่อนที่แบบโพรเจกไทล์ มีตัวปรับมุมและความเร็ว สำหรับ ม.4'},
    {subject:'คณิตศาสตร์', icon:'🍕', title:'เศษส่วนแสนสนุก', desc:'ลากแบ่งพิซซ่า แล้วดูค่าของเศษส่วน', idea:'สร้างเกมจับคู่เศษส่วนด้วยพิซซ่า สำหรับ ป.5'},
    {subject:'เคมี', icon:'⚛', title:'ประกอบโมเลกุล', desc:'ลากอะตอมมาประกอบเป็นโมเลกุลต่าง ๆ', idea:'สร้างกิจกรรมลากวางประกอบโมเลกุลพื้นฐาน สำหรับ ม.2'},
    {subject:'ชีววิทยา', icon:'🦠', title:'สำรวจเซลล์พืชและเซลล์สัตว์', desc:'คลิกส่วนต่าง ๆ เพื่อดูหน้าที่และรายละเอียด', idea:'สร้างสื่อสำรวจโครงสร้างเซลล์พืชและเซลล์สัตว์ สำหรับ ม.1'},
    {subject:'สิ่งแวดล้อม', icon:'🌱', title:'ผลกระทบของสภาพอากาศต่อเมือง', desc:'ปรับค่าต่าง ๆ แล้วดูการเปลี่ยนแปลงของพื้นที่', idea:'สร้างสถานการณ์จำลองผลกระทบสภาพอากาศต่อชุมชน'},
    {subject:'ภาษาอังกฤษ', icon:'🏠', title:'จับคำศัพท์ในห้อง', desc:'ลากคำศัพท์ไปยังสิ่งของให้ถูกต้อง', idea:'สร้างเกมจับคู่คำศัพท์ภาษาอังกฤษเกี่ยวกับสิ่งของในห้อง สำหรับ ป.3'}
  ];
  let activeSubject = 'ทั้งหมด';
  const byId = id => document.getElementById(id);
  function openIdea(idea) { if (typeof window.openInteractiveMediaStudio === 'function') window.openInteractiveMediaStudio(idea); }
  function render() {
    const activityGrid = byId('media-activity-grid');
    if (activityGrid) activityGrid.innerHTML = activities.map(([icon,title,desc,idea], i) => `<button type="button" class="media-activity activity-${i}" data-idea="${encodeURIComponent(idea)}"><b>${icon}</b><strong>${title}</strong><small>${desc}</small></button>`).join('');
    const chips = byId('media-subject-chips');
    const subjects = ['ทั้งหมด', ...new Set(templates.map(t => t.subject))];
    if (chips) chips.innerHTML = subjects.map(s => `<button type="button" class="${s === activeSubject ? 'active' : ''}" data-subject="${s}">${s}</button>`).join('');
    const templateGrid = byId('media-template-grid');
    const visible = activeSubject === 'ทั้งหมด' ? templates : templates.filter(t => t.subject === activeSubject);
    if (templateGrid) templateGrid.innerHTML = visible.map(t => `<article class="media-template"><div class="media-template-art"><span>${t.icon}</span><em>${t.subject}</em></div><div class="media-template-copy"><h3>${t.title}</h3><p>${t.desc}</p><div><button type="button" class="media-preview-template" data-idea="${encodeURIComponent(t.idea)}">ดูตัวอย่าง</button><button type="button" class="btn btn-primary" data-idea="${encodeURIComponent(t.idea)}">ใช้ไอเดียนี้</button></div></div></article>`).join('');
    const library = byId('media-my-library');
    if (library) library.innerHTML = templates.slice(0,4).map(t => `<button type="button" class="media-library-item" data-idea="${encodeURIComponent(t.idea)}"><span>${t.icon}</span><div><strong>${t.title}</strong><small>${t.subject}</small></div><i class="hgi-stroke hgi-more-vertical-circle-01"></i></button>`).join('');
  }
  document.addEventListener('click', event => {
    const idea = event.target.closest('[data-idea]');
    if (idea) { openIdea(decodeURIComponent(idea.dataset.idea)); return; }
    const subject = event.target.closest('[data-subject]');
    if (subject) { activeSubject = subject.dataset.subject; render(); }
  });
  document.addEventListener('DOMContentLoaded', () => {
    render();
    byId('media-idea-form')?.addEventListener('submit', event => { event.preventDefault(); const value = byId('media-idea-input').value.trim(); if (value) openIdea(value); else byId('media-idea-input').focus(); });
    byId('media-brainstorm')?.addEventListener('click', () => openIdea('ช่วยเสนอไอเดียสื่อการเรียนรู้แบบโต้ตอบที่เหมาะกับบทเรียนของฉัน'));
    document.querySelectorAll('[data-media-idea]').forEach(button => button.addEventListener('click', () => openIdea(button.dataset.mediaIdea)));
  });
})();
