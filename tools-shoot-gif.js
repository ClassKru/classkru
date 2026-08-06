// สร้าง GIF สาธิตการปัดการ์ดเช็กชื่อ สำหรับคู่มือ
// จำลองการลากตามสูตรจริงใน js/attendance.js: translateX(deltaX) rotate(deltaX*0.05)
// และ class hint-right / hint-left เมื่อ |deltaX| > 40
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:3500';
const FRAMES = path.join(__dirname, 'gif-frames');
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const SEED = fs.readFileSync(path.join(__dirname, 'seed-inline.txt'), 'utf8');

const ENTER = `(function(){
  const lo=document.getElementById('login-overlay');
  if(lo){lo.classList.remove('show');lo.style.display='none';}
  document.getElementById('main-app').style.display='flex';
  initAppState(); updateHeaderDate();
  openSwipeAttendance('c1');
})()`;

// ตั้งตำแหน่งการ์ดตามสูตรจริง
const drag = dx => `(function(){
  const c=document.getElementById('swipe-card');
  c.classList.add('dragging');
  c.style.transform='translateX(${dx}px) rotate(${(dx * 0.05).toFixed(2)}deg)';
  c.classList.remove('hint-right','hint-left');
  if(${dx}>40) c.classList.add('hint-right'); else if(${dx}<-40) c.classList.add('hint-left');
})()`;

const release = status => `(function(){
  const c=document.getElementById('swipe-card');
  c.classList.remove('dragging','hint-right','hint-left');
  c.style.transform='';
  markSwipeStatus('${status}');
})()`;

// ลำดับเฟรม: พัก -> ลากขวา(ขาด) -> ปล่อย -> พัก -> ลากซ้าย(ลา) -> ปล่อย
const steps = [];
const hold = n => { for (let i = 0; i < n; i++) steps.push({ act: null }); };
hold(7);                                                        // พักให้อ่านการ์ดทัน
[0, 25, 55, 85, 110, 132, 150].forEach(dx => steps.push({ act: drag(dx) }));   // ลากขวา
steps.push({ act: release('absent') });                          // ปล่อย = ขาด
hold(6);
[0, -25, -55, -85, -110, -132, -150].forEach(dx => steps.push({ act: drag(dx) })); // ลากซ้าย
steps.push({ act: release('leave') });                           // ปล่อย = ลา
hold(7);

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--font-render-hinting=none'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 720, deviceScaleFactor: 2 });
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2' });
  await page.evaluate(SEED);
  await page.reload({ waitUntil: 'networkidle2' });
  await page.evaluate(ENTER);
  await new Promise(r => setTimeout(r, 1200));
  // ปิด transition ของการ์ด ไม่งั้นตำแหน่งที่ถ่ายจะตามไม่ทันค่าที่สั่ง
  await page.addStyleTag({ content: `#swipe-card{transition:none!important;} *{animation-duration:.01s!important;}` });

  for (let i = 0; i < steps.length; i++) {
    if (steps[i].act) await page.evaluate(steps[i].act);
    await new Promise(r => setTimeout(r, 60));
    await page.screenshot({ path: path.join(FRAMES, String(i).padStart(3, '0') + '.png') });
  }
  console.log('ถ่ายเฟรมแล้ว', steps.length, 'เฟรม');
  await browser.close();
})();
