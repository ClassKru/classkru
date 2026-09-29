// Creates a silent 9:16 TikTok demo of the ClassKru Molecule Builder using fictional game data only.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEPS = path.join(os.tmpdir(), 'classkru-tiktok-video-deps', 'node_modules');
const puppeteer = require(path.join(DEPS, 'puppeteer-core'));
const ffmpeg = require(path.join(DEPS, 'ffmpeg-static'));
const OUT = path.join(__dirname, 'promo', 'tiktok', 'clip-06-molecule-builder');
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
  await page.goto('http://127.0.0.1:3500/molecule-builder/index.html', { waitUntil: 'networkidle2' });
  await page.waitForSelector('.atom-source');
  await page.addStyleTag({ content: `
    body{zoom:.58;min-width:0;width:930px}
    .game-shell{width:930px;max-width:none;padding:22px}
    .game-header{grid-template-columns:minmax(100px,1fr) auto minmax(150px,1fr) auto}
    .hud{grid-column:auto;grid-row:auto;justify-content:flex-end}
    .header-actions{grid-column:auto;grid-row:auto}
    .lab-layout{grid-template-columns:160px minmax(450px,1.55fr) minmax(230px,.66fr)}
    .information-panel{grid-column:auto}.atom-list{grid-template-columns:repeat(2,1fr)}
    .building-area{min-height:465px}
    #ck-tiktok-caption{position:fixed;z-index:99999;top:25px;left:20px;right:20px;padding:16px 18px;border-radius:18px;color:#fff;background:rgba(30,26,84,.94);box-shadow:0 12px 28px rgba(0,0,0,.25);font-family:'Noto Sans Thai',system-ui,sans-serif;text-align:center}
    #ck-tiktok-caption strong{display:block;font-size:42px;line-height:1.2}#ck-tiktok-caption span{display:block;margin-top:6px;color:#e4e0ff;font-size:26px;line-height:1.3}
    *,*::before,*::after{transition:none!important}
  ` });

  const frames = [];
  async function take(text, detail, duration) {
    await page.evaluate((html) => {
      document.getElementById('ck-tiktok-caption')?.remove();
      document.body.insertAdjacentHTML('beforeend', html);
    }, captionHtml(text, detail));
    const file = path.join(FRAMES, `frame-${String(frames.length).padStart(2, '0')}.png`);
    await page.screenshot({ path: file });
    frames.push({ file, duration });
  }

  async function addAtom(symbol) {
    await page.evaluate((target) => document.querySelector(`.atom-source[data-symbol="${target}"]`)?.click(), symbol);
    await new Promise((resolve) => setTimeout(resolve, 140));
  }

  async function selectCanvasAtom(index) {
    const atom = (await page.$$('.canvas-atom'))[index];
    const box = await atom.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await take('เปลี่ยนเรื่องโมเลกุล ให้เด็กได้ลงมือสร้าง', 'เกมวิทยาศาสตร์สำหรับคาบเรียน', 1.6);
  await page.click('#modal-primary');
  await page.waitForFunction(() => !document.querySelector('#modal')?.classList.contains('visible'));
  await take('ภารกิจแรก: สร้างน้ำ H₂O', 'เลือกอะตอมจากคลังด้วยการแตะ', 1.4);

  await addAtom('H');
  await addAtom('H');
  await addAtom('O');
  await page.waitForFunction(() => document.querySelectorAll('.canvas-atom').length === 3);
  await take('หยิบ H 2 อะตอม กับ O 1 อะตอม', 'โมเดลช่วยให้เห็นสูตรอย่างเป็นรูปธรรม', 1.45);

  await selectCanvasAtom(0);
  await selectCanvasAtom(2);
  await selectCanvasAtom(1);
  await selectCanvasAtom(2);
  await take('เชื่อมพันธะเดี่ยว 2 จุด', 'ระบบตรวจเวเลนซ์ระหว่างสร้าง', 1.4);

  await page.click('#check-button');
  await page.waitForFunction(() => document.querySelector('#modal')?.classList.contains('visible') && document.getElementById('modal-title')?.textContent.includes('น้ำ'));
  await take('สร้างสำเร็จ! น้ำ H₂O', 'ได้ข้อมูลสารในชีวิตจริงและภารกิจถัดไป', 1.9);
  await browser.close();

  const concat = path.join(OUT, 'frames.txt');
  fs.writeFileSync(concat, frames.map((frame) => `file '${frame.file.replace(/\\/g, '/')}'\nduration ${frame.duration}`).join('\n') + `\nfile '${frames.at(-1).file.replace(/\\/g, '/')}'\n`);
  const target = path.join(OUT, 'classkru-molecule-builder.mp4');
  const result = spawnSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', concat, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-movflags', '+faststart', target], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('ffmpeg could not create the video');
  console.log(`Created ${target}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
