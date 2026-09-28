'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { launchBrowser } = require('../api/_lib/media-check');

const root = path.join(__dirname, '..', 'developer');
const files = {
  '/developer/': ['index.html', 'text/html; charset=utf-8'],
  '/developer/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/developer/roadmap.js': ['roadmap.js', 'text/javascript; charset=utf-8'],
  '/developer/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/developer/roadmap.css': ['roadmap.css', 'text/css; charset=utf-8']
};
const now = '2026-09-27T09:00:00.000Z';
const business = {
  generatedAt: now,
  accounts: { total: 2, activated: 1, recordedToday: 1, recorded7d: 1, recorded30d: 1, trial: 1, paid: 1, eligible: 2, expired: 0 },
  payments: { paidOrders: 1, paidAmountSatang: 9900 },
  rows: [
    { teacherId: 'one', email: 'active@example.test', registeredAt: now, subscriptionStatus: 'active', paidUntil: null, classrooms: 2, timetableEntries: 3, attendance30d: 4, scoreItems30d: 1, studentScores30d: 5, lastRecordedAt: now, recordedToday: true, recorded7d: true, recorded30d: true, hasPaid: true },
    { teacherId: 'two', email: 'new@example.test', registeredAt: now, subscriptionStatus: 'trial', paidUntil: null, classrooms: 0, timetableEntries: 0, attendance30d: 0, scoreItems30d: 0, studentScores30d: 0, lastRecordedAt: null, recordedToday: false, recorded7d: false, recorded30d: false, hasPaid: false }
  ]
};

test('developer business and per-account usage work on desktop and mobile', async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/api/dev/session') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ authenticated: true }));
      return;
    }
    if (url.pathname === '/api/dev/data') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(url.searchParams.get('resource') === 'business' ? business : { total: 0, recent: [] }));
      return;
    }
    const asset = files[url.pathname];
    if (!asset) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', asset[1]);
    res.end(fs.readFileSync(path.join(root, asset[0])));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${server.address().port}/developer/`);
    await page.waitForSelector('#console-view:not([hidden])');
    await page.click('[data-view="business"]');
    await page.waitForFunction(() => document.querySelectorAll('#business-summary .summary-card').length === 8);
    assert.match(await page.$eval('#business-summary', node => node.textContent), /บันทึกงานใน 7 วัน/);
    await page.click('[data-account-sort="classrooms"]');
    assert.equal(await page.$eval('#business-account-list .account-preview-item strong', node => node.textContent), 'active@example.test');
    await page.click('[data-account-sort="registered"]');
    await page.click('[data-view="usage"]');
    await page.waitForFunction(() => document.querySelectorAll('.usage-account-card').length === 2);
    await page.select('#usage-filter', 'recorded7d');
    assert.equal(await page.$$eval('.usage-account-card', nodes => nodes.length), 1);
    await page.$eval('.usage-account-card .row-button', node => node.click());
    assert.match(await page.$eval('#detail-content', node => node.textContent), /คะแนนนักเรียนที่แก้ไขใน 30 วัน/);
    await page.$eval('#close-modal', node => node.click());
    await page.setViewport({ width: 390, height: 844 });
    const layout = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(layout.scroll <= layout.viewport + 2, `mobile overflow: ${JSON.stringify(layout)}`);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
