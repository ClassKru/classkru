// Creates a silent 9:16 TikTok demo of ClassKru's classroom tools with fictional data only.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEPS = path.join(os.tmpdir(), 'classkru-tiktok-video-deps', 'node_modules');
const puppeteer = require(path.join(DEPS, 'puppeteer-core'));
const ffmpeg = require(path.join(DEPS, 'ffmpeg-static'));
const OUT = path.join(__dirname, 'promo', 'tiktok', 'clip-04-teaching-tools');
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
    const students = [
      'กานต์ชนา ใจดี', 'ธนกฤต รุ่งเรือง', 'พิมพ์ชนก แสงทอง', 'ณัฐวุฒิ ทองแท้',
      'ชนาภา บุญช่วย', 'ศุภวิชญ์ มีสุข', 'รินรดา เพชรดี', 'ภูริณัฐ มั่นคง'
    ].map((name, index) => ({ id: `demo-${index + 1}`, no: index + 1, name }));
    appState = {
      classes: [{ id: 'demo-class', subject: 'วิทยาศาสตร์', className: 'ม.2/1', academicYear: 2569, students, attendance: {} }],
      activeWebScreen: 'tools', onboarding: { done: true }
    };
    swipeClassId = 'demo-class';
    swipeResults = Object.fromEntries(students.map(s => [s.id, 'present']));
    navigateToWebScreen('tools');
    renderTeachingToolsPage();
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

  await take('หน้าชั้นเรียนวุ่น ๆ ใช่ไหม?', 'มีเครื่องมือพร้อมใช้ในหน้าเดียว', 1.45);
  await page.evaluate(() => { openRandomNameTool(); _rnSpin(); });
  await new Promise(resolve => setTimeout(resolve, 2200));
  await take('สุ่มรายชื่ออย่างยุติธรรม', 'ไม่ต้องเรียกชื่อเองทีละคน', 1.6);
  await page.evaluate(() => { closeRandomName(); openRandomGroupTool(); _grSetCount(4); _grShuffle(); });
  await new Promise(resolve => setTimeout(resolve, 1750));
  await take('แบ่งกลุ่มได้ทันที', 'รายชื่อทั้งห้อง จัดเป็น 4 กลุ่ม', 1.6);
  await page.evaluate(() => { document.getElementById('tool-group-overlay')?.remove(); openCountdownTool(); _cdSetTotal(30, null); _cdLeft = 30; _cdPaint(); });
  await take('ตั้งเวลาทำกิจกรรม', 'เหลือเวลาเท่าไร เห็นพร้อมกันทั้งห้อง', 1.6);
  await take('ClassKru เครื่องมือหน้าชั้นเรียน', 'เริ่มกิจกรรมได้ โดยไม่ต้องสลับหลายแอป', 1.8);
  await browser.close();

  const concat = path.join(OUT, 'frames.txt');
  fs.writeFileSync(concat, frames.map(frame => `file '${frame.file.replace(/\\/g, '/')}'\nduration ${frame.duration}`).join('\n') + `\nfile '${frames.at(-1).file.replace(/\\/g, '/')}'\n`);
  const target = path.join(OUT, 'classkru-teaching-tools.mp4');
  const result = spawnSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', concat, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-movflags', '+faststart', target], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('ffmpeg could not create the video');
  console.log(`Created ${target}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
