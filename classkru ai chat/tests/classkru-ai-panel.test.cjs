'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fakeElement() {
  const classes = new Set();
  const listeners = new Map();
  return {
    hidden: false, value: '', textContent: '', children: [], scrollTop: 0, scrollHeight: 0,
    classList: {
      add(name) { classes.add(name); }, remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
      toggle(name, force) { const on = force === undefined ? !classes.has(name) : force; if (on) classes.add(name); else classes.delete(name); return on; }
    },
    addEventListener(name, callback) { listeners.set(name, callback); },
    fire(name, event = {}) { return listeners.get(name)?.(event); },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren() { this.children = []; },
    setAttribute() {}, focus() { this.focused = true; }
  };
}

test('panel keeps chat on page changes, reopens, and minimizes on mobile guidance', async () => {
  const ids = ['ck-ai-panel','ck-ai-history','ck-ai-input','ck-ai-form','ck-ai-send','ck-ai-status','ck-ai-starters','ck-ai-minimize','ck-ai-expand','ck-ai-close','classkru-ai-launcher'];
  const elements = Object.fromEntries(ids.map(id => [id, fakeElement()]));
  elements['ck-ai-panel'].hidden = true;
  const localStorage = { getItem: key => key === 'classkru_state_owner_v1' ? 'teacher-a' : null };
  const window = {};
  const document = { getElementById: id => elements[id], createElement: fakeElement, addEventListener() {} };
  const source = fs.readFileSync(path.join(__dirname, '../frontend/js/classkru-ai-panel.js'), 'utf8');
  vm.runInNewContext(source, {
    window, document, localStorage,
    supabaseClient: { auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) } },
    ClassKruAiActions: { context: () => ({ screen: 'dashboard' }), execute: async () => ({ ok: true, guided: true }), hideGuide() {} },
    fetch: async () => ({ ok: true, json: async () => ({ reply: 'เปิดหน้าเช็กชื่อแล้วค่ะ', action: { type:'navigate', target:'checkin' } }) }),
    matchMedia: () => ({ matches: true }), AbortSignal, showToast() {}
  });
  window.openClassKruAi();
  assert.equal(elements['ck-ai-panel'].hidden, false);
  assert.equal(elements['ck-ai-history'].children.length, 1);
  elements['ck-ai-input'].value = 'พาไปหน้าเช็กชื่อ';
  elements['ck-ai-form'].fire('submit', { preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements['ck-ai-history'].children.length, 3);
  assert.equal(elements['ck-ai-panel'].classList.contains('is-minimized'), true);
  elements['ck-ai-close'].fire('click');
  assert.equal(elements['ck-ai-panel'].hidden, true);
  window.openClassKruAi();
  assert.equal(elements['ck-ai-history'].children.length, 3);
  assert.equal(elements['ck-ai-panel'].classList.contains('is-minimized'), false);
});
