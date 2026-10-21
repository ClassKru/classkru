'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function createLocalFileArtifactStore({ root, idFactory = crypto.randomUUID } = {}) {
  if (!root) throw new TypeError('local_artifact_store_root_required');
  const file = path.join(root, 'artifacts.json');
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') data = {}; else throw error; }
  const save = () => {
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data), 'utf8');
  };
  const deleteValidatedMany = async ids => {
    const removed = new Map();
    for (const id of new Set(ids)) if (data[id]) { removed.set(id, data[id]); delete data[id]; }
    if (!removed.size) return [];
    try { save(); }
    catch (error) {
      for (const [id, artifact] of removed) data[id] = artifact;
      try { save(); } catch (_) { /* Preserve the original failure; caller can retry deletion. */ }
      throw error;
    }
    return [...removed.keys()];
  };
  return Object.freeze({
    async putValidated({ artifact, specification, validationVersion }) {
      const id = idFactory();
      const row = { id, status: 'validated', title: artifact.title, summary: artifact.summary, html: artifact.html, specification_ref: specification.brief_ref, validator_version: validationVersion, created_at: new Date().toISOString() };
      data[id] = row; save(); return row;
    },
    async getValidated(id) { return data[id]?.status === 'validated' ? data[id] : null; },
    async deleteValidated(id) {
      if (!data[id]) return false;
      return (await deleteValidatedMany([id])).includes(id);
    },
    async deleteValidatedMany(ids) { return deleteValidatedMany(ids); }
  });
}

module.exports = { createLocalFileArtifactStore };


