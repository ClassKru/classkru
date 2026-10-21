'use strict';

const crypto = require('node:crypto');

function createInMemoryArtifactStore({ idFactory = () => crypto.randomUUID() } = {}) {
  const artifacts = new Map();
  return Object.freeze({
    async putValidated({ artifact, specification, validationVersion }) {
      const id = idFactory();
      const stored = Object.freeze({ id, status: 'validated', title: artifact.title, summary: artifact.summary, html: artifact.html, specification_ref: specification.brief_ref, validator_version: validationVersion, created_at: new Date().toISOString() });
      artifacts.set(id, stored);
      return stored;
    },
    async getValidated(id) { const artifact = artifacts.get(id); return artifact?.status === 'validated' ? artifact : null; },
    async deleteValidated(id) { return artifacts.delete(id); },
    async deleteValidatedMany(ids) {
      const deleted = [];
      for (const id of new Set(ids)) if (artifacts.delete(id)) deleted.push(id);
      return deleted;
    }
  });
}

module.exports = { createInMemoryArtifactStore };


