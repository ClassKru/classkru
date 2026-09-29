// Creates a silent 9:16 TikTok demo of ClassKru's dashboard and teaching timetable with fictional data only.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEPS = path.join(os.tmpdir(), 'classkru-tiktok-video-deps', 'node_modules');
const puppeteer = require(path.join(DEPS, 'puppeteer-core'));
const ffmpeg = require(path.join(DEPS, 'ffmpeg-static'));
const OUT = path.join(__dirname, 'promo', 'tiktok', 'clip-03-timetable');
const FRAMES = path.join(OUT, 'frames');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

function captionHtml(text, detail) {
  return `<div id="ck-tiktok-caption"><strong>${text}</strong><span>${detail}</span></div>`;
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3500/index.html', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const login = document.getElementById('login-overlay');
    if (login) { login.classList.remove('show'); login.style.display = 'none'; }
    document.getElementById('main-app').style.display = 'flex';
    const today = new Date().getDay();
    const classOne = { id: 'demo-science', subject: 'วิทยาศาสตร์', className: 'ม.2/1', students: [{ id: 'a', name: 'กานต์ชนา ใจดี' }], attendance: {} };
    const classTwo = { id: 'demo-math', subject: 'คณิตศาสตร์', className: 'ม.1/2', students: [{ id: 'b', name: 'ธนกฤต รุ่งเรือง' }], attendance: {} };
    appState = {
      classes: [classOne, classTwo],
      timetable: [
        { classId: 'demo-science', dow: today, period: 1, week: 'A' },
        { classId: 'demo-math', dow: today, period: 3, week: 'A' },
        { classId: 'demo-science', dow: 1, period: 2, week: 'A' },
        { classId: 'demo-math', dow: 3, period: 4, week: 'A' },
        { classId: 'demo-science', dow: 5, period: 1, week: 'A' }
      ],
      activeWebScreen: 'dashboard', timetableWeek: 'A', holidays: [],
      periodSettings: { startTime: '08:30', duration: 50, breakTime: 0, count: 5 }, onboarding: { done: true }
    };
    navigateToWebScreen('dashboard');
    renderWebDashboard();
  });
  await page.addStyleTag({ content: `
    #ck-tiktok-caption{position:fixed;z-index:99999;top:28px;left:18px;right:18px;padding:15px 17px;border-radius:18px;color:#fff;background:rgba(12,40,34,.92);box-shadow:0 12px 28px rgba(0,0,0,.2);font-family:'LINE Seed Sans TH',Sarabun,sans-serif;text-align:center}
    #ck-tiktok-caption strong{display:block;font-size:27px;line-height:1.22}#ck-tiktok-caption span{display:block;margin-top:6px;color:#d9f7ed;font-size:17px;line-height:1.3}
    *,*::before,*::after{animation:none!important;transition:none!important}
  ` });

  const frames = [];
  async function take(text, detail, duration) {
    await page.evaluate(html => { document.getElementById('ck-tiktok-caption')?.remove(); document.body.insertAdjacentHTML('beforeend', html); }, captionHtml(text, detail));
    const file = path.join(FRAMES, `frame-${String(frames.length).padStart(2, '0')}.png`);
    await page.screenshot({ path: file });
    frames.push({ file, duration });
  }

  await take('วันนี้สอนกี่คาบ?', 'ห้องไหนก่อน?', 1.55);
  await take('เปิดหน้าแรกครั้งเดียว', 'เห็นคาบถัดไปทันที', 1.35);
  await page.evaluate(() => { navigateToWebScreen('timetable'); renderWebTimetable(); });
  await take('ดูตารางสอนทั้งสัปดาห์', 'วิชา · ห้อง · เวลา ครบในที่เดียว', 1.55);
  await take('ไม่ต้องจำทุกคาบเอง', 'ClassKru สำหรับครูไทย', 1.8);
  await browser.close();

  const concat = path.join(OUT, 'frames.txt');
  fs.writeFileSync(concat, frames.map(frame => `file '${frame.file.replace(/\\/g, '/')}'\nduration ${frame.duration}`).join('\n') + `\nfile '${frames.at(-1).file.replace(/\\/g, '/')}'\n`);
  const target = path.join(OUT, 'classkru-timetable.mp4');
  const result = spawnSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', concat, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-movflags', '+faststart', target], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('ffmpeg could not create the video');
  console.log(`Created ${target}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
