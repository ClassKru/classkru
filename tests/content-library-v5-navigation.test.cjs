'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const libraryScript = fs.readFileSync(path.join(projectRoot, 'js/content-library.js'), 'utf8');
const classKruAuth = fs.readFileSync(path.join(projectRoot, 'js/core.js'), 'utf8');
const v5Client = fs.readFileSync(path.join(projectRoot, 'v5.js'), 'utf8');

test('Mini Lab V5 uses the same persistent Supabase project credentials as ClassKru', () => {
  const classKruUrl = classKruAuth.match(/const SB_URL = '([^']+)'/)?.[1];
  const classKruKey = classKruAuth.match(/const SB_KEY = '([^']+)'/)?.[1];
  const v5ClientConfig = v5Client.match(/createClient\('([^']+)', '([^']+)', \{ auth:\{([^}]+)\}/);
  assert.ok(classKruUrl && classKruKey);
  assert.ok(v5ClientConfig);
  assert.equal(v5ClientConfig[1], classKruUrl);
  assert.equal(v5ClientConfig[2], classKruKey);
  assert.match(classKruAuth, /persistSession:\s*true/);
  assert.match(v5ClientConfig[3], /persistSession:\s*true/);
});

test('AI media card takes a non-developer teacher to Mini Lab V5 in the same tab and origin', () => {
  const start = libraryScript.indexOf('function bindCreationCardActions(root) {');
  const end = libraryScript.indexOf('  function bindLibraryControls(root)', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const bindCreationCardActions = vm.runInNewContext(`(${libraryScript.slice(start, end)})`, {
    URL,
    window: { location: { hostname: 'www.classkru.com', origin: 'https://www.classkru.com' } },
    isClassKruMediaDeveloper: () => false,
    document: {
      createElement(tag) {
        assert.equal(tag, 'a');
        return {
          attributes: {},
          className: '',
          description: { textContent: '' },
          href: '',
          innerHTML: '',
          setAttribute(name, value) { this.attributes[name] = value; },
          querySelector(selector) { return selector === 'p' ? this.description : null; }
        };
      }
    }
  });
  const status = { textContent: '' };
  const card = {
    className: 'cl-create-card interactive cl-media-studio-entry',
    dataset: { createAction: 'interactive' },
    innerHTML: '<span>AI ช่วยสร้างสื่อ</span>',
    querySelector(selector) { return selector === '.cl-media-studio-status' ? status : null; },
    replaceWith(element) { this.replacement = element; }
  };
  bindCreationCardActions({ querySelectorAll: () => [card] });

  assert.equal(card.replacement.href, 'https://www.classkru.com/mini-lab-v5');
  assert.equal(card.replacement.attributes['aria-describedby'], 'cl-media-studio-status');
  assert.equal(card.replacement.target, undefined);
  assert.equal(status.textContent, 'เปิด Mini Lab V5');
  assert.match(card.replacement.description.textContent, /สร้างสื่อโต้ตอบ/);
});
