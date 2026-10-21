'use strict';

const crypto = require('node:crypto');
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validId(value) { return typeof value === 'string' && ID.test(value); }
function fail(code) { return Object.assign(new Error(code), { code }); }

// The caller must provide the authenticated teacher ID, never an ID from the request body.
// storage is an encrypted private object store with exclusive put/get/remove operations.
function createCloudArtifactStore({ storage, teacherId, idFactory = crypto.randomUUID, clock = () => new Date() } = {}) {
  if (!validId(teacherId)) throw fail('teacher_id_invalid');
  if (!storage || !['get','put','remove'].every(name => typeof storage[name] === 'function')) throw fail('artifact_storage_required');
  const objectName = id => {
    if (!validId(id)) throw fail('artifact_id_invalid');
    return `users/${teacherId}/mini-lab-v5/artifacts/${id}.json`;
  };
  async function getValidated(id) {
    const row = await storage.get(objectName(id));
    return row?.status === 'validated' && row.id === id ? row : null;
  }
  async function deleteValidated(id) {
    const name = objectName(id);
    if (!await getValidated(id)) return false;
    await storage.remove(name);
    return true;
  }
  return Object.freeze({
    async putValidated({ artifact, specification, validationVersion }) {
      const id = idFactory(), name = objectName(id);
      const row = { id, status:'validated', title:artifact.title, summary:artifact.summary, html:artifact.html, specification_ref:specification.brief_ref, validator_version:validationVersion, created_at:clock().toISOString() };
      if (!await storage.put(name, row)) throw fail('artifact_id_conflict');
      return row;
    },
    getValidated,
    deleteValidated,
    async deleteValidatedMany(ids) {
      if (!Array.isArray(ids)) throw fail('artifact_ids_invalid');
      const unique = [...new Set(ids)];
      for (const id of unique) objectName(id);
      const deleted = [];
      for (const id of unique) if (await deleteValidated(id)) deleted.push(id);
      return deleted;
    }
  });
}
module.exports = { createCloudArtifactStore };


