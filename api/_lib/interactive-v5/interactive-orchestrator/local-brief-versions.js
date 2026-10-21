'use strict';
const fs = require('node:fs');
const path = require('node:path');
const FILES = { conversation:'conversation-prompts.js', architect:'architect-prompts.js', builder:'builder-prompts.js' };
const DEFAULTS = { conversation:'../conversation-ai/prompts', architect:'../prompt-architect-ai/prompts', builder:'../html-media-builder-ai/prompts' };
function createBriefVersions({ root, localRoot }) {
  const versionsRoot = path.join(root, 'brief-versions');
  const settingsFile = path.join(localRoot, 'brief-version.json');
  const invalid = () => Object.assign(new Error('invalid_brief_version'), { code:'invalid_brief_version' });
  let selected = 'original';
  try { const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf8')); if (typeof saved.version === 'string') selected = saved.version; } catch (_) {}
  function available() {
    let entries = [];
    try { entries = fs.readdirSync(versionsRoot, { withFileTypes:true }); } catch (_) {}
    return entries.filter(entry => entry.isDirectory() && !entry.isSymbolicLink() && /^\d{2,}[^/\\]*$/.test(entry.name))
      .filter(entry => [...Object.values(FILES), 'media-mode.js', 'กฎกลาง.md'].every(file => {
        try { const stat = fs.lstatSync(path.join(versionsRoot, entry.name, file)); return stat.isFile() && !stat.isSymbolicLink(); } catch (_) { return false; }
      })).map(entry => ({ id:entry.name, label:entry.name })).sort((a,b) => a.id.localeCompare(b.id, 'th', { numeric:true }));
  }
  function status() {
    const versions = [{ id:'original', label:'ระบบเดิม (services)' }, ...available()];
    const missing = !versions.some(item => item.id === selected);
    return { selected, versions, missing };
  }
  function select(version) {
    if (typeof version !== 'string' || !status().versions.some(item => item.id === version)) throw invalid();
    fs.mkdirSync(localRoot, { recursive:true });
    fs.writeFileSync(settingsFile, JSON.stringify({ version }, null, 2), 'utf8');
    selected = version;
    return status();
  }
  function builder(role) {
    return (...args) => {
      if (selected === 'original') return require(DEFAULTS[role]).buildRequest(...args);
      if (!available().some(item => item.id === selected)) throw invalid();
      const dir = path.join(versionsRoot, selected);
      for (const file of [...Object.values(FILES), 'media-mode.js']) {
        const resolved = require.resolve(path.join(dir, file));
        delete require.cache[resolved];
      }
      const prompts = require(path.join(dir, FILES[role]));
      if (typeof prompts.buildRequest !== 'function') throw invalid();
      return prompts.buildRequest(...args);
    };
  }
  return Object.freeze({ status, select, builder });
}
module.exports = { createBriefVersions };


