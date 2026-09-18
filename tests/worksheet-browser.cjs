const {chromium}=require('playwright');
const fs=require('fs');
const assert=require('assert');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1100,height:950}});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.setContent('<div id="content-library-root"></div>');
    for(const f of ['css/01-base-layout.css','css/13-content-library.css']) await page.addStyleTag({content:fs.readFileSync(f,'utf8')});
    await page.evaluate(()=>{
      window.appState={classes:[],mediaLibrary:[{id:'test',type:'worksheet',subject:'คณิตศาสตร์',grade:'ม.2',answerKey:'yes',worksheet:{version:2,title:'จำนวนจริง',directions:['จำแนกจำนวนและให้เหตุผล'],blocks:[{type:'table',title:'จำแนก',instruction:'เติมประเภทของจำนวนและอธิบายเหตุผล',columns:['จำนวน','ประเภท','เหตุผล'],rows:[['−3',null,null],['√2',null,null]],lines:2,answer:'−3 เป็นจำนวนตรรกยะ; √2 เป็นจำนวนอตรรกยะ'},{type:'question',title:'อธิบาย',instruction:'0.333… เป็นจำนวนตรรกยะหรือไม่',lines:2,answer:'เป็น เพราะเท่ากับ 1/3'}]}}]};
      window.clone=o=>JSON.parse(JSON.stringify(o));window.saveState=()=>{};window.showToast=()=>{};
    });
    for(const f of ['js/worksheet-layout.js','js/content-library.js']) await page.addScriptTag({content:fs.readFileSync(f,'utf8')});
    await page.evaluate(()=>openSavedWorksheet('test'));
    assert.equal(await page.locator('.cl-student-sheet table').count(),1);
    await page.screenshot({path:'/private/tmp/classkru-worksheet-desktop.png',fullPage:true});
    await page.getByRole('button',{name:'แก้ไขใบงาน',exact:true}).click();
    await page.locator('textarea').first().fill('จำนวนจริง ฉบับแก้ไข');
    await page.getByRole('button',{name:'บันทึกเข้าคลัง',exact:true}).click();
    assert.equal(await page.locator('.cl-student-sheet h2').innerText(),'จำนวนจริง ฉบับแก้ไข');
    await page.setViewportSize({width:390,height:850});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:'/private/tmp/classkru-worksheet-mobile.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('Browser desktop/mobile + editing/save passed');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
