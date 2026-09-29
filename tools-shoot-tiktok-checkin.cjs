// Creates a silent 9:16 TikTok demo using only fictional students and the live ClassKru check-in UI.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEPS = path.join(os.tmpdir(), 'classkru-tiktok-video-deps', 'node_modules');
const puppeteer = require(path.join(DEPS, 'puppeteer-core'));
const ffmpeg = require(path.join(DEPS, 'ffmpeg-static'));
const ROOT = __dirname;
const OUT = path.join(ROOT, 'promo', 'tiktok', 'clip-01-checkin');
const FRAMES = path.join(OUT, 'frames');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const students = [
  'กานต์ชนา ใจดี', 'ธนกฤต รุ่งเรือง', 'พิมพ์ชนก แสงทอง', 'วรเมธ สุขใจ',
  'ณิชาภา มั่นคง', 'ภาณุพงศ์ วัฒนะ', 'ชลธิชา บุญมี', 'กิตติพงษ์ เมตตา'
].map((name, index) => ({ id: `demo-${index + 1}`, no: index + 1, name, studentCode: `670${String(index + 1).padStart(3, '0')}` }));

const seed = JSON.stringify({
  id: 'demo-checkin', subject: 'วิทยาศาสตร์', className: 'ม.2/1', students, attendance: {}, scores: { items: [], marks: {} }
});

function captionHtml(text, detail) {
  return `<div id="ck-tiktok-caption"><strong>${text}</strong><span>${detail}</span></div>`;
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3500/index.html', { waitUntil: 'networkidle2' });
  await page.evaluate((classroom) => {
    const login = document.getElementById('login-overlay');
    if (login) { login.classList.remove('show'); login.style.display = 'none'; }
    const main = document.getElementById('main-app');
    if (main) main.style.display = 'flex';
    appState = { classes: [classroom], timetable: [{ classId: classroom.id, dow: new Date().getDay(), period: 1, week: 'A' }], activeWebScreen: 'dashboard', holidays: [], periodSettings: { startTime: '08:30', duration: 50, breakTime: 0, count: 7 } };
    openSwipeAttendance(classroom.id);
  }, JSON.parse(seed));
  await page.addStyleTag({ content: `
    #ck-tiktok-caption{position:fixed;z-index:99999;top:28px;left:18px;right:18px;padding:15px 17px;border-radius:18px;color:#fff;background:rgba(12,40,34,.92);box-shadow:0 12px 28px rgba(0,0,0,.2);font-family:'LINE Seed Sans TH',Sarabun,sans-serif;text-align:center}
    #ck-tiktok-caption strong{display:block;font-size:28px;line-height:1.22}#ck-tiktok-caption span{display:block;margin-top:6px;color:#d9f7ed;font-size:17px;line-height:1.3}
    *,*::before,*::after{animation:none!important;transition:none!important}
  ` });

  const frames = [];
  async function take(text, detail, duration) {
    await page.evaluate((html) => { document.getElementById('ck-tiktok-caption')?.remove(); document.body.insertAdjacentHTML('beforeend', html); }, captionHtml(text, detail));
    const file = path.join(FRAMES, `frame-${String(frames.length).padStart(2, '0')}.png`);
    await page.screenshot({ path: file });
    frames.push({ file, duration });
  }

  await take('เช็กชื่อ 40 คน', 'ไม่ต้องไล่หาชื่อในกระดาษ', 1.6);
  await page.evaluate(() => moveSwipeStudent(1));
  await take('เลื่อนดูรายชื่อ', 'ดูทีละคนได้ทันที', 1.1);
  await page.evaluate(() => markSwipeStatus('present'));
  await new Promise(resolve => setTimeout(resolve, 240));
  await take('กดสถานะในครั้งเดียว', 'มา · สาย · ขาด · ลา', 1.2);
  await page.evaluate(() => markSwipeStatus('late'));
  await new Promise(resolve => setTimeout(resolve, 240));
  await take('สถานะถูกบันทึกแล้ว', 'ระบบเลื่อนไปยังคนถัดไปอัตโนมัติ', 1.2);
  await page.evaluate(() => markSwipeStatus('present'));
  await new Promise(resolve => setTimeout(resolve, 240));
  await take('เช็กชื่อได้ต่อเนื่อง', 'ClassKru สำหรับครูไทย', 1.8);
  await browser.close();

  const concat = path.join(OUT, 'frames.txt');
  fs.writeFileSync(concat, frames.map(frame => `file '${frame.file.replace(/\\/g, '/')}'\nduration ${frame.duration}`).join('\n') + `\nfile '${frames.at(-1).file.replace(/\\/g, '/')}'\n`);
  const target = path.join(OUT, 'classkru-checkin-slide-and-tap.mp4');
  const result = spawnSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', concat, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-movflags', '+faststart', target], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('ffmpeg could not create the video');
  console.log(`Created ${target}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
