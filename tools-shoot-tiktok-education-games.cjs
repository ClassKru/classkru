// Creates a silent 9:16 TikTok demo of ClassKru educational games.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEPS = path.join(os.tmpdir(), 'classkru-tiktok-video-deps', 'node_modules');
const puppeteer = require(path.join(DEPS, 'puppeteer-core'));
const ffmpeg = require(path.join(DEPS, 'ffmpeg-static'));
const OUT = path.join(__dirname, 'promo', 'tiktok', 'clip-05-education-games');
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
    appState = { classes: [], activeWebScreen: 'games', onboarding: { done: true } };
    navigateToWebScreen('games');
  });
  await page.addStyleTag({ content: `
    #ck-tiktok-caption{position:fixed;z-index:99999;top:28px;left:18px;right:18px;padding:15px 17px;border-radius:18px;color:#fff;background:rgba(35,17,78,.94);box-shadow:0 12px 28px rgba(0,0,0,.24);font-family:'LINE Seed Sans TH',Sarabun,sans-serif;text-align:center}
    #ck-tiktok-caption strong{display:block;font-size:27px;line-height:1.22}#ck-tiktok-caption span{display:block;margin-top:6px;color:#ebe0ff;font-size:17px;line-height:1.3}
    *,*::before,*::after{transition:none!important}
  ` });

  const frames = [];
  async function take(text, detail, duration) {
    await page.evaluate(html => { document.getElementById('ck-tiktok-caption')?.remove(); document.body.insertAdjacentHTML('beforeend', html); }, captionHtml(text, detail));
    const file = path.join(FRAMES, `frame-${String(frames.length).padStart(2, '0')}.png`);
    await page.screenshot({ path: file });
    frames.push({ file, duration });
  }

  await take('เรียนรู้ผ่านเกมได้เลย', 'เลือกกิจกรรมให้เหมาะกับคาบเรียน', 1.45);
  await page.goto('http://127.0.0.1:3500/math-wizard/index.html', { waitUntil: 'networkidle2' });
  await page.addStyleTag({ content: `
    #ck-tiktok-caption{position:fixed;z-index:99999;top:28px;left:18px;right:18px;padding:15px 17px;border-radius:18px;color:#fff;background:rgba(35,17,78,.94);box-shadow:0 12px 28px rgba(0,0,0,.24);font-family:'LINE Seed Sans TH',Sarabun,sans-serif;text-align:center}
    #ck-tiktok-caption strong{display:block;font-size:27px;line-height:1.22}#ck-tiktok-caption span{display:block;margin-top:6px;color:#ebe0ff;font-size:17px;line-height:1.3}
  ` });
  await take('Math Wizard', 'ตอบโจทย์เพื่อร่ายเวทพิชิตมอนสเตอร์', 1.35);
  await page.click('#modal-primary');
  await page.waitForFunction(() => !document.querySelector('#modal-layer')?.classList.contains('is-visible') && document.querySelectorAll('.answer-button:not([disabled])').length === 4);
  await take('คิดเลข แล้วเลือกคำตอบ', 'ทุกคำตอบที่ถูกต้องคือพลังโจมตี', 1.55);
  await page.evaluate(() => {
    const text = document.getElementById('question-text').textContent.trim().replace(/[−–]/g, '-');
    const match = text.match(/^(\d+)\s*([+-])\s*(\d+)\s*=\s*\?$/);
    if (!match) throw new Error(`Unexpected question: ${text}`);
    const answer = String(match[2] === '+' ? Number(match[1]) + Number(match[3]) : Number(match[1]) - Number(match[3]));
    [...document.querySelectorAll('.answer-button')].find(button => button.querySelector('span').textContent.trim() === answer)?.click();
  });
  await new Promise(resolve => setTimeout(resolve, 550));
  await take('ตอบถูก = ปล่อยเวท!', 'เปลี่ยนโจทย์คณิต ให้เป็นความท้าทาย', 1.5);
  await take('ClassKru เกมการศึกษา', 'พร้อมใช้ในห้องเรียนทันที', 1.65);
  await browser.close();

  const concat = path.join(OUT, 'frames.txt');
  fs.writeFileSync(concat, frames.map(frame => `file '${frame.file.replace(/\\/g, '/')}'\nduration ${frame.duration}`).join('\n') + `\nfile '${frames.at(-1).file.replace(/\\/g, '/')}'\n`);
  const target = path.join(OUT, 'classkru-education-games.mp4');
  const result = spawnSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', concat, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-movflags', '+faststart', target], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('ffmpeg could not create the video');
  console.log(`Created ${target}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
