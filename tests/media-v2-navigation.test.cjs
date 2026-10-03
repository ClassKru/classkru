'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { launchBrowser } = require('../api/_lib/media-check');
const root = path.join(__dirname, '..');
const id = '00000000-0000-4000-8000-000000000001';
let initial = '', answered = false, chatCalls = 0, releaseAnswer;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
  if (url.pathname === '/api/v2/config') return json({ developer: false, deployment: true, configured: true });
  if (url.pathname === '/api/v2/sessions' && req.method === 'POST') {
    let body = ''; for await (const chunk of req) body += chunk;
    initial = JSON.parse(body).initial_message; answered = false;
    return json({ session: { id } });
  }
  if (url.pathname === `/api/v2/sessions/${id}`) return json({ session: {
    id, messages: [{ id: 'first', role: 'teacher', kind: 'v2_pending_start', content: initial },
      ...(answered ? [{ role: 'assistant', kind: 'v2_chat', content: 'AI response' }] : [])],
    pending_start: answered ? null : { id: 'first', content: initial }, usage: null
  } });
  if (url.pathname === `/api/v2/sessions/${id}/chat`) {
    chatCalls++;
    await new Promise(resolve => { releaseAnswer = resolve; });
    answered = true; return json({ reply: 'AI response' });
  }
  const file = { '/mini-lab-v2': 'v2.html', '/v2.css': 'v2.css', '/v2.js': 'v2.js' }[url.pathname];
  if (!file) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(fs.readFileSync(path.join(root, file)));
});
async function main() {
  if (process.platform === 'win32' && !process.env.MEDIA_BROWSER_EXECUTABLE)
    process.env.MEDIA_BROWSER_EXECUTABLE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', req => req.url().startsWith('http://127.0.0.1:') ? req.continue() : req.abort());
    await page.evaluateOnNewDocument(() => {
      window.supabase = { createClient: () => ({ auth: {
        getSession: async () => ({ data: { session: { access_token: 'fixture', user: { id: 'teacher', email: 'teacher@example.com' } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
      } }) };
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 900 });
      await page.goto(origin + '/mini-lab-v2');
      await page.waitForSelector('[data-view="landing"] #message-input', { visible: true });
      await page.type('#message-input', 'Create a learning activity');
      await Promise.all([page.waitForNavigation(), page.click('#send-button')]);
      await page.waitForFunction(() => document.querySelector('#chat-log .teacher'));
      assert.equal(await page.$eval('#chat-log .teacher', el => el.checkVisibility()), true, 'Teacher message must be visible after navigation');
      await page.waitForSelector('#chat-log .pending', { visible: true });
      assert.equal(await page.$eval('#message-input', el => el.checkVisibility()), true);
      while (!releaseAnswer) await new Promise(resolve => setTimeout(resolve, 20));
      releaseAnswer(); releaseAnswer = null;
      await page.waitForFunction(() => document.querySelector('#chat-log').textContent.includes('AI response'));
      assert.equal(await page.$eval('#chat-log .assistant', el => el.checkVisibility()), true);
      const calls = chatCalls;
      await page.reload();
      await page.waitForSelector('#chat-log .teacher', { visible: true });
      await page.waitForSelector('#chat-log .assistant', { visible: true });
      assert.equal(chatCalls, calls, 'Reopening completed work must not repeat AI request');
    }
    assert.deepEqual(errors, []);
    console.log('PASS: first prompt, pending status, AI reply and reopened work visible at desktop and mobile widths');
  } finally {
    releaseAnswer?.();
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
