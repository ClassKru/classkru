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
    await page.setContent('<div id="score-worktab-holder"></div><div id="web-scores-matrix-wrap"></div>');
    for (const file of ['css/01-base-layout.css','css/07-scores.css']) await page.addStyleTag({ content: fs.readFileSync(path.join(__dirname,'..',file),'utf8') });
    await page.evaluate(() => {
      window.appState = { classes: [{ id: 'demo', students: Array.from({length:10},(_,i)=>({id:String(i),no:10-i,name:`นักเรียน ${10-i}`})), scores: {
        items: ['งานที่ 1','แบบทดสอบเรื่องสารรอบตัว','กิจกรรมกลุ่ม','โครงงานวิทยาศาสตร์','สอบกลางภาค'].map((name,i)=>({id:String(i),name,max:10,bucket:['before','after','before','mid','final'][i]})),
        marks: Object.fromEntries([0,1,2,3].map(i=>[String(i),Object.fromEntries(Array.from({length:10},(_,j)=>[String(j),(i+j)%11]))]))
      } }] };
    });
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname,'../js/scores.js'),'utf8') });
    await page.evaluate(() => {
      scoreCurrentClassId='demo';
      scoreWorkspaceMode='report';
      scoreReportTab='items';
      document.querySelector('#score-worktab-holder').innerHTML=scoreWorkTabsHtml(appState.classes[0]);
      renderScoreReport(appState.classes[0]);
    });
    assert.equal(await page.locator('.score-report-student-dialog:not(.score-report-distribution-dialog)').count(),1);
    assert.equal(await page.locator('.score-report-student-dialog:not(.score-report-distribution-dialog)').evaluate(dialog=>dialog.open),false);
    assert.equal(await page.locator('.score-report-matrix').count(),0);
    assert.equal(await page.locator('.score-report-tab').count(),0);
    assert.equal(await page.locator('.score-worktab').count(),6);
    assert.equal(await page.locator('.score-worktab[data-score-worktab="curriculum"]').getAttribute('title'),'อยู่ระหว่างพัฒนา');
    assert.equal(await page.locator('.score-worktab[data-score-worktab="pp5"]').getAttribute('title'),'อยู่ระหว่างพัฒนา');
    assert.equal(await page.locator('.score-worktab[data-score-worktab="report-items"]').getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('.score-report-heading').count(),0);
    assert.equal(await page.locator('.score-report-summary').count(),0);
    assert.equal(await page.locator('.score-report-bar-section').getAttribute('hidden'),null);
    assert.equal(await page.locator('.score-report-pie-section').count(),0);
    assert.equal(await page.locator('.score-report-horizontal-axis').count(),0);
    assert.equal(await page.locator('.score-report-item-average').count(),5);
    assert.ok((await page.locator('.score-report-bar').first().evaluate(bar=>bar.style.getPropertyValue('--score-report-target'))).endsWith('%'));
    await page.locator('.score-worktab[data-score-worktab="report-items"]').click();
    assert.equal(await page.locator('.score-report-bar-section').getAttribute('hidden'),null);
    await page.locator('.score-worktab[data-score-worktab="report-students"]').click();
    assert.equal(await page.locator('.score-report-student-section').getAttribute('hidden'),null);
    assert.notEqual(await page.locator('.score-report-bar-section').getAttribute('hidden'),null);
    assert.equal(await page.locator('.score-report-student-section.mode-2d').count(),0);
    assert.equal(await page.locator('.score-report-student-matrix tbody tr').count(),10);
    assert.equal(await page.locator('.score-report-student-dot').count(),50);
    assert.equal(await page.locator('.score-report-student-open').first().getAttribute('data-student'),'9');
    assert.ok(await page.locator('.score-report-student-dot.is-recorded').count() > 0);
    assert.ok(await page.locator('.score-report-student-dot.is-empty').count() > 0);
    await page.locator('.score-report-student-open').nth(1).click();
    assert.equal(await page.locator('.score-report-student-dialog:not(.score-report-distribution-dialog)').evaluate(dialog=>dialog.open),true);
    assert.ok(await page.locator('.score-report-student-detail').innerText().then(text=>text.includes('คะแนน')));
    await page.locator('.score-report-student-dialog:not(.score-report-distribution-dialog) .score-report-student-dialog-close').click();
    assert.equal(await page.locator('.score-report-student-dialog:not(.score-report-distribution-dialog)').evaluate(dialog=>dialog.open),false);
    assert.equal(await page.locator('.score-report-view-toggle').count(),0);
    await page.locator('.score-worktab[data-score-worktab="report-submission"]').click();
    assert.equal(await page.locator('.score-report-submission-section').getAttribute('hidden'),null);
    assert.notEqual(await page.locator('.score-report-student-section').getAttribute('hidden'),null);
    assert.ok(await page.locator('.score-report-submission-row').count() > 0);
    assert.equal(await page.locator('.score-report-submission-trigger .score-report-item-meter').count(),5);
    assert.equal(await page.locator('.score-report-submission-trigger .is-missing').count(),0);
    await page.locator('.score-report-submission-trigger[data-item="4"]').click();
    assert.equal(await page.locator('.score-report-missing-dialog').evaluate(dialog=>dialog.open),true);
    assert.ok((await page.locator('.score-report-missing-detail').innerText()).includes('ยังไม่ส่ง 10 คน'));
    assert.equal(await page.locator('.score-report-missing-list li').count(),10);
    assert.match(await page.locator('.score-report-missing-list li').first().innerText(),/1\s+นักเรียน 1/);
    await page.locator('.score-report-missing-dialog .score-report-student-dialog-close').click();
    assert.equal(await page.locator('.score-report-missing-dialog').evaluate(dialog=>dialog.open),false);
    await page.locator('.score-worktab[data-score-worktab="report-items"]').click();
    await page.locator('.score-report-track[data-item="2"]').click();
    assert.equal(await page.locator('.score-report-distribution-dialog').evaluate(dialog=>dialog.open),true);
    assert.equal(await page.locator('.score-report-distribution-summary strong').innerText(),'กิจกรรมกลุ่ม');
    assert.equal(await page.locator('.score-report-pie-center strong').innerText(),'10 คน');
    await page.locator('.score-report-distribution-dialog .score-report-student-dialog-close').click();
    assert.equal(await page.locator('.score-report-distribution-dialog').evaluate(dialog=>dialog.open),false);
    await page.screenshot({path:path.join(os.tmpdir(),'classkru-report-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile does not overflow');
    await page.screenshot({path:path.join(os.tmpdir(),'classkru-report-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('Report browser checks passed; screenshots in '+os.tmpdir());
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
