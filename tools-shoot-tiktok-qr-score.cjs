// Creates a silent 9:16 TikTok demo of the live ClassKru QR-score entry UI with fictional data only.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEPS = path.join(os.tmpdir(), 'classkru-tiktok-video-deps', 'node_modules');
const puppeteer = require(path.join(DEPS, 'puppeteer-core'));
const ffmpeg = require(path.join(DEPS, 'ffmpeg-static'));
const OUT = path.join(__dirname, 'promo', 'tiktok', 'clip-02-qr-score');
const FRAMES = path.join(OUT, 'frames');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const classroom = {
  id: 'demo-qr', academicYear: 2569, subject: 'วิทยาศาสตร์', className: 'ม.2/1',
  students: [
    { id: 'student-1', no: 1, name: 'กานต์ชนา ใจดี', studentCode: '670001' },
    { id: 'student-2', no: 2, name: 'ธนกฤต รุ่งเรือง', studentCode: '670002' }
  ],
  scores: { items: [{ id: 'quiz-1', name: 'แบบทดสอบท้ายบท', max: 10, bucket: 'before' }], marks: {} }
};

function captionHtml(text, detail) {
  return `<div id="ck-tiktok-caption"><strong>${text}</strong><span>${detail}</span></div>`;
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3500/index.html', { waitUntil: 'networkidle2' });
  await page.evaluate(data => {
    const login = document.getElementById('login-overlay');
    if (login) { login.classList.remove('show'); login.style.display = 'none'; }
    document.getElementById('main-app').style.display = 'flex';
    appState = { classes: [data], timetable: [], activeWebScreen: 'dashboard', holidays: [], periodSettings: {} };
    openQrScoreScanner();
    selectQrScoreClass(data.id);
    selectQrScoreTask(`${data.id}::quiz-1`);
  }, classroom);
  await page.addStyleTag({ content: `
    #ck-tiktok-caption{position:fixed;z-index:99999;top:28px;left:18px;right:18px;padding:15px 17px;border-radius:18px;color:#fff;background:rgba(12,40,34,.92);box-shadow:0 12px 28px rgba(0,0,0,.2);font-family:'LINE Seed Sans TH',Sarabun,sans-serif;text-align:center}
    #ck-tiktok-caption strong{display:block;font-size:27px;line-height:1.22}#ck-tiktok-caption span{display:block;margin-top:6px;color:#d9f7ed;font-size:17px;line-height:1.3}
    .qr-demo-camera{height:190px;display:grid;place-items:center;border:3px solid #1aa67a;border-radius:18px;color:#167a5b;background:repeating-linear-gradient(45deg,#edfaf5 0,#edfaf5 10px,#e0f6ed 10px,#e0f6ed 20px);font-size:24px;font-weight:800}
    *,*::before,*::after{animation:none!important;transition:none!important}
  ` });

  const frames = [];
  async function take(text, detail, duration) {
    await page.evaluate(html => { document.getElementById('ck-tiktok-caption')?.remove(); document.body.insertAdjacentHTML('beforeend', html); }, captionHtml(text, detail));
    const file = path.join(FRAMES, `frame-${String(frames.length).padStart(2, '0')}.png`);
    await page.screenshot({ path: file });
    frames.push({ file, duration });
  }

  await take('กรอกคะแนนทีละคนอยู่ไหม?', 'เริ่มจากเลือกห้องและงาน', 1.6);
  await page.evaluate(() => {
    qrScoreState.classId = 'demo-qr'; qrScoreState.itemId = 'quiz-1'; qrScoreState.phase = 'scanning';
    document.getElementById('qr-score-setup').style.display = 'none';
    document.getElementById('qr-score-scan').style.display = 'block';
    document.getElementById('qr-score-context').innerHTML = '<div><strong>ม.2/1 • วิทยาศาสตร์</strong><span>แบบทดสอบท้ายบท / 10 คะแนน</span></div>';
    document.getElementById('qr-score-reader').innerHTML = '<div class="qr-demo-camera">⌗<br><small>กำลังสแกน QR</small></div>';
    document.getElementById('qr-score-camera-placeholder').style.display = 'none';
    setQrScoreStatus('พร้อมสแกนนักเรียน', 'ready');
  });
  await take('สแกน QR นักเรียน', 'ไม่ต้องไล่หาชื่อในตาราง', 1.25);
  await page.evaluate(data => {
    const c = appState.classes[0];
    showQrScoreStudent(c.students[0], c);
    document.getElementById('qr-score-new-score').value = '8';
  }, classroom);
  await take('พบชื่อและกรอกคะแนน', 'ตรวจสอบก่อนบันทึกทุกครั้ง', 1.35);
  await page.evaluate(() => {
    const result = document.getElementById('qr-score-result');
    result.classList.add('is-success');
    document.getElementById('qr-score-result-state').innerHTML = '<strong>บันทึกแล้ว: กานต์ชนา ใจดี 8/10</strong><span>พร้อมรับคนถัดไป</span>';
    setQrScoreStatus('บันทึกแล้ว 8/10', 'success');
  });
  await take('บันทึกแล้ว พร้อมคนถัดไป', 'ClassKru สำหรับครูไทย', 1.8);
  await browser.close();

  const concat = path.join(OUT, 'frames.txt');
  fs.writeFileSync(concat, frames.map(frame => `file '${frame.file.replace(/\\/g, '/')}'\nduration ${frame.duration}`).join('\n') + `\nfile '${frames.at(-1).file.replace(/\\/g, '/')}'\n`);
  const target = path.join(OUT, 'classkru-qr-score.mp4');
  const result = spawnSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', concat, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-movflags', '+faststart', target], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('ffmpeg could not create the video');
  console.log(`Created ${target}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
