// Run with NODE_PATH pointing to a Playwright installation (uses installed Edge).
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1150, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<div id="web-scores-matrix-wrap"></div>');
    for (const file of ['css/01-base-layout.css','css/07-scores.css']) await page.addStyleTag({ content: fs.readFileSync(path.join(__dirname,'..',file),'utf8') });
    await page.evaluate(() => {
      window.appState = { classes: [{ id: 'demo', students: Array.from({length:10},(_,i)=>({id:String(i)})), scores: {
        items: ['ใบงานที่ 1','แบบทดสอบเรื่องสารรอบตัว','กิจกรรมกลุ่ม','โครงงานวิทยาศาสตร์','สอบกลางภาค'].map((name,i)=>({id:String(i),name,max:10})),
        marks: Object.fromEntries([0,1,2,3].map(i=>[String(i),Object.fromEntries(Array.from({length:10},(_,j)=>[String(j),(i+j)%11]))]))
      } }] };
    });
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname,'../js/scores.js'),'utf8') });
    await page.evaluate(() => { scoreCurrentClassId='demo';renderScoreReport(appState.classes[0]); });
    await page.locator('.score-report-student-row').first().click();
    assert.equal(await page.locator('.score-report-student-detail-head').count(),1);
    await page.getByRole('button',{name:'ดูแบบ 2D',exact:true}).click();
    assert.equal(await page.locator('.score-report-student-section.mode-2d').count(),1);
    await page.getByRole('button',{name:'ดูแบบ 3D',exact:true}).click();
    assert.equal(await page.locator('.score-report-student-section.mode-3d').count(),1);
    await page.locator('.score-report-track[data-item="2"]').click();
    assert.equal(await page.locator('#score-report-item').inputValue(),'2');
    assert.equal(await page.locator('.score-report-track[data-item="2"]').getAttribute('aria-pressed'),'true');
    await page.selectOption('#score-report-item','4');
    assert.equal(await page.locator('.score-report-pie').count(),0);
    await page.selectOption('#score-report-item','0');
    assert.equal(await page.locator('.score-report-pie-center strong').innerText(),'10 คน');
    await page.screenshot({path:path.join(os.tmpdir(),'classkru-report-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile does not overflow');
    await page.screenshot({path:path.join(os.tmpdir(),'classkru-report-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('Report browser checks passed; screenshots in '+os.tmpdir());
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
