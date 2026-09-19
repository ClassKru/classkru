'use strict';
const puppeteer = require('puppeteer-core');
const { fail } = require('./media-db');
const { render, POLICY_VERSION } = require('./media-artifact');
async function launchBrowser() {
  if (process.env.MEDIA_BROWSER_EXECUTABLE) return puppeteer.launch({executablePath:process.env.MEDIA_BROWSER_EXECUTABLE,headless:true,args:['--disable-dev-shm-usage']});
  const chromiumModule = require('@sparticuz/chromium');
  const chromium = chromiumModule.default || chromiumModule;
  return puppeteer.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:true});
}
async function checkInBrowser(artifact) {
  const browser = await launchBrowser();
  let timer;
  const errors = [], network = [];
  const work = async () => {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (/^(data:|blob:|about:)/.test(req.url())) req.continue().catch(()=>{});
      else { network.push('network_blocked'); req.abort().catch(()=>{}); }
    });
    page.on('pageerror', ()=>errors.push('runtime_error'));
    const {html} = render(artifact);
    for (const width of [390,1280]) {
      await page.setViewport({width,height:width===390?844:720});
      // Production also enforces sandbox in the response header. Test opaque origin here.
      await page.setContent('<iframe sandbox="allow-scripts" style="border:0;width:100%;height:700px"></iframe>');
      await page.$eval('iframe',(frame,doc)=>{frame.srcdoc=doc;},html);
      await new Promise(resolve=>setTimeout(resolve,700));
      const frame = page.frames().find(f=>f.parentFrame());
      if (!frame) throw fail('preview_failed');
      const layout = await frame.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,text:document.body.textContent.trim().length}));
      if (!layout.text || layout.scroll > layout.width+8) throw fail('preview_layout_failed');
    }
    if (errors.length || network.length) throw fail('preview_failed');
    return {policy_version:POLICY_VERSION,static_check:'passed',browser_check:'passed',viewports:[390,1280],checked_at:new Date().toISOString(),teacher_review_required:true};
  };
  try {
    return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>{browser.process()?.kill();reject(fail('preview_timeout'));},20000);})]);
  } finally { clearTimeout(timer); await browser.close().catch(()=>{}); }
}
module.exports = { checkInBrowser, launchBrowser };
