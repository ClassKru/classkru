'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..', 'briefs');
const registryPath = path.join(root, 'registry.json');
const idPattern = /^[a-z0-9][a-z0-9_-]{0,39}$/i;
const packed = require('../../../api/_lib/classkru-ai-briefs.cjs');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function safeFile(base, name) {
  const file = path.join(base, name);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('invalid_brief_version');
  return file;
}

function catalog() {
  if (!fs.existsSync(registryPath)) return JSON.parse(JSON.stringify(packed.registry));
  const data = readJson(safeFile(root, 'registry.json'));
  if (!Array.isArray(data.versions)) throw new Error('invalid_brief_registry');
  const versions = data.versions.filter(item => item && typeof item.id === 'string' && idPattern.test(item.id) && typeof item.label === 'string')
    .filter(item => {
      try {
        const dir = path.join(root, 'versions', item.id);
        const stat = fs.lstatSync(dir);
        if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
        for (const name of ['system.md', 'navigation.md', 'config.json']) safeFile(dir, name);
        return true;
      } catch (_) { return false; }
    }).map(({ id, label }) => ({ id, label }));
  const has = id => versions.some(version => version.id === id);
  const activeVersion = has(data.activeVersion) ? data.activeVersion : null;
  const defaultVersion = has(data.defaultVersion) ? data.defaultVersion : activeVersion || versions[0]?.id || null;
  if (!defaultVersion) throw new Error('no_brief_versions');
  return { activeVersion: activeVersion || defaultVersion, defaultVersion, versions };
}

function load(id) {
  if (typeof id !== 'string' || !idPattern.test(id)) throw new Error('invalid_brief_version');
  const available = catalog();
  if (!available.versions.some(version => version.id === id)) throw new Error('invalid_brief_version');
  if (!fs.existsSync(registryPath)) {
    if (!packed.versions[id]?.system || !packed.versions[id]?.navigation) throw new Error('invalid_brief_version');
    return JSON.parse(JSON.stringify(packed.versions[id]));
  }
  const dir = path.join(root, 'versions', id);
  const config = readJson(safeFile(dir, 'config.json'));
  const system = fs.readFileSync(safeFile(dir, 'system.md'), 'utf8').trim();
  const navigation = fs.readFileSync(safeFile(dir, 'navigation.md'), 'utf8').trim();
  if (!system || !navigation) throw new Error('invalid_brief_version');
  return { id, label: available.versions.find(version => version.id === id).label, config, system, navigation };
}

module.exports = { catalog, load };
