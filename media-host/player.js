'use strict';
(() => {
  const token = new URLSearchParams(location.search).get('token');
  const status = document.getElementById('status');
  const holder = document.getElementById('player');
  function start() {
    holder.replaceChildren();
    if (!/^[a-f0-9]{64}$/.test(token || '')) {status.textContent='ลิงก์สื่อไม่ถูกต้อง กรุณาเปิดลิงก์ที่ครูแชร์';return;}
    const frame=document.createElement('iframe');
    frame.title='สื่อการสอนแบบโต้ตอบ';
    frame.setAttribute('sandbox','allow-scripts');
    frame.referrerPolicy='no-referrer';
    frame.src=`api/render?token=${token}`;
    holder.append(frame);
    status.textContent='ทดลองและเรียนรู้ได้เลย · หากสื่อไม่ตอบสนองให้กดหยุดสื่อ';
  }
  document.getElementById('restart').addEventListener('click',start);
  document.getElementById('stop').addEventListener('click',()=>{holder.replaceChildren();status.textContent='หยุดสื่อแล้ว';});
  start();
})();
