// ถ่ายภาพหน้าจอแอปด้วยข้อมูลตัวอย่างปลอม สำหรับใช้ในคู่มือ guide.html
// ไม่แตะ production ไม่แตะข้อมูลนักเรียนจริง — รันบน localhost เท่านั้น
// ใช้:  node shoot.js [โฟลเดอร์ปลายทาง]
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:3500';
const OUT = process.argv[2] || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

// clearToday = true -> ล้างการเช็คชื่อของวันนี้ เพื่อให้เห็นการ์ดรอเช็ค (ไม่ใช่จอ "เช็คครบแล้ว")
const seed = (clearToday) => `(function(){
const RAW=['ณัฐวุฒิ ใจดี','ปาริชาต แสงทอง','ธีรภัทร วงศ์สุข','กัญญา พรหมมา','ศิริพร ทองมี','อนุชา บุญมาก','พิมพ์ชนก ศรีสุข','วรากร นาคเงิน','ชลธิชา ดวงแก้ว','ภาณุพงศ์ รักเรียน','สุชานันท์ ทรงศรี','กิตติพงษ์ ยอดเยี่ยม','นภัสสร จันทร์เพ็ญ','ธนกฤต พูลผล','อารียา สมบูรณ์','ปฏิภาณ เกิดผล','เมธาวี ขวัญเมือง','จิรายุ ตั้งใจ','พีรพัฒน์ มั่นคง','ศศิธร บัวงาม'];
const NAMES=RAW.map((name,i)=>({id:'s'+(i+1),name,no:String(i+1),studentNo:String(i+1),studentCode:'3010'+String(i+1).padStart(2,'0')}));
const today=new Date(), iso=d=>d.toISOString().slice(0,10);
const daysAgo=n=>{const d=new Date(today);d.setDate(d.getDate()-n);return iso(d);};
const attendance={};
const startDay=${clearToday ? 1 : 0};
for(let day=startDay;day<12;day++){const date=daysAgo(day);attendance[date]={};
 NAMES.forEach((s,i)=>{const r=(i*7+day*3)%20;attendance[date][s.id]=r===0?'absent':r===1?'late':r===2?'leave':'present';});}
const scoreItems=[{id:'k1',name:'ใบงานที่ 1',max:10,group:'ระหว่างภาค'},{id:'k2',name:'ใบงานที่ 2',max:10,group:'ระหว่างภาค'},{id:'k3',name:'ทดสอบย่อย',max:20,group:'ระหว่างภาค'},{id:'m1',name:'กลางภาค',max:20,group:'กลางภาค'},{id:'f1',name:'ปลายภาค',max:30,group:'ปลายภาค'}];
const scores={};NAMES.forEach((s,i)=>{scores[s.id]={};scoreItems.forEach((it,j)=>{scores[s.id][it.id]=Math.max(0,Math.round(it.max*(0.62+((i*3+j*5)%35)/100)));});});
const classes=[{id:'c1',subject:'วิทยาศาสตร์',className:'ม.3/1',students:NAMES,attendance,scores,scoreItems},
{id:'c2',subject:'วิทยาศาสตร์',className:'ม.3/2',students:NAMES.slice(0,16),attendance:{},scores:{},scoreItems},
{id:'c3',subject:'ฟิสิกส์',className:'ม.6/1',students:NAMES.slice(0,12),attendance:{},scores:{},scoreItems}];
const timetable=[{dow:1,period:1,classId:'c1',week:'A'},{dow:1,period:3,classId:'c2',week:'A'},{dow:2,period:2,classId:'c3',week:'A'},{dow:3,period:1,classId:'c1',week:'A'},{dow:4,period:1,classId:'c1',week:'A'},{dow:4,period:3,classId:'c2',week:'A'},{dow:4,period:5,classId:'c3',week:'A'},{dow:5,period:2,classId:'c1',week:'A'}];
localStorage.setItem('classkru_mobile_v4',JSON.stringify({classes,timetable,timetableWeek:'A',activeWebScreen:'dashboard',holidays:[],periodSettings:{startTime:'08:30',duration:50,breakTime:0,count:7},onboarding:{done:true}}));
})()`;

const ENTER_APP = `(function(){
  const lo=document.getElementById('login-overlay');
  if(lo){lo.classList.remove('show');lo.style.display='none';}
  document.getElementById('main-app').style.display='flex';
  initAppState(); updateHeaderDate();
})()`;

// { name, vp:[w,h], go: JS หลังเข้าแอป, clearToday, crop: selector (ว่าง = เต็มจอ), wait }
const SHOTS = [
  // ── หมวด 1: เริ่มต้นใช้งาน ─────────────────────────────
  { name: '01-classrooms-empty', vp: [1280, 720], clearToday: true, crop: '#web-screen-classrooms',
    go: `appState.classes=[];renderWebClassrooms();navigateToWebScreen('classrooms')` },
  { name: '02-add-class-modal', vp: [1280, 820], crop: '#modal-class .modal-box, #modal-class > div',
    go: `navigateToWebScreen('classrooms');openClassModal()` },
  { name: '03-classrooms-list', vp: [1280, 720], crop: '#web-screen-classrooms',
    go: `navigateToWebScreen('classrooms')` },
  { name: '04-students-list', vp: [1280, 820], crop: '#web-screen-students', wait: 2200,
    go: `switchClassTab('students','c1')` },
  { name: '05-checkin-mobile-card', vp: [390, 844], clearToday: true,
    go: `openSwipeAttendance('c1')` },
  { name: '06-checkin-desktop', vp: [1280, 900], clearToday: true, crop: '#swipe-overlay', wait: 2600,
    go: `openSwipeAttendance('c1')` },
  { name: '07-dashboard', vp: [1280, 780], crop: '#web-screen-dashboard',
    go: `navigateToWebScreen('dashboard')` },
  { name: '08-dashboard-mobile', vp: [390, 844], go: `navigateToWebScreen('dashboard')` }
];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--font-render-hinting=none'] });
  for (const s of SHOTS) {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: s.vp[0], height: s.vp[1], deviceScaleFactor: 2 });
      await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2' });
      await page.evaluate(seed(!!s.clearToday));
      await page.reload({ waitUntil: 'networkidle2' });
      await page.evaluate(ENTER_APP);
      await page.evaluate(s.go);
      await new Promise(r => setTimeout(r, s.wait || 1000));
      // แถวตารางใช้ animation ตอนเลื่อนมาเห็น (IntersectionObserver) — ใน headless แถวใต้จอ
      // ไม่เคยติด เลยค้างจาง ปิด animation ทั้งหมดแล้วบังคับ opacity ก่อนถ่าย
      await page.addStyleTag({ content: `*,*::before,*::after{animation:none!important;transition:none!important;}
        #swipe-overlay *,#web-screen-students *,#web-screen-dashboard *,#web-screen-classrooms *{opacity:1!important;transform:none!important;}` });
      await new Promise(r => setTimeout(r, 250));
      let target = page;
      if (s.crop) {
        for (const sel of s.crop.split(',').map(x => x.trim())) {
          const el = await page.$(sel);
          if (el && await el.boundingBox()) { target = el; break; }
        }
      }
      await target.screenshot({ path: path.join(OUT, s.name + '.png') });
      const sz = fs.statSync(path.join(OUT, s.name + '.png')).size;
      console.log('✓', s.name, s.vp.join('x'), Math.round(sz / 1024) + 'KB', target === page ? '(เต็มจอ)' : '(crop)');
    } catch (e) {
      console.log('✗', s.name, '—', e.message.split('\n')[0]);
    }
    await page.close();
  }
  await browser.close();
})();
