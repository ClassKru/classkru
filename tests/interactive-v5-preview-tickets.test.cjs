'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPreviewTickets } = require('../api/_lib/interactive-v5/cloud/preview-tickets');

const TEACHER = '4fd1ac02-31e2-4e0a-9897-392ad93fa3b2';
const ARTIFACT = 'a9b720e0-0f30-487e-9f27-3bce6ef4f290';
const JOB = '1beeb5fc-8838-444b-8dde-2aa6f8d59366';
const TICKET = 'c114b768-bf12-46fd-a29a-32c36b4daf31';

test('V5 preview tickets expire and become unusable after the teacher artifact is deleted', async () => {
  const objects = new Map();
  let now = 1000;
  let allowed = true;
  const storage = {
    async put(name, value) { if (objects.has(name)) return false; objects.set(name, structuredClone(value)); return true; },
    async get(name) { return structuredClone(objects.get(name) || null); },
    async remove(name) { objects.delete(name); return true; }
  };
  const tickets = createPreviewTickets({
    storage,
    artifactStoreForTeacher: () => ({ getValidated: async id => id === ARTIFACT ? { id, html: '<!doctype html><title>V5 preview</title>' } : null }),
    previewAllowed: async () => allowed,
    clock: () => now,
    idFactory: () => TICKET,
    ttlMs: 10
  });
  const issued = await tickets.issue(TEACHER, ARTIFACT, JOB);
  const preview = await tickets.load(issued.id);
  assert.equal(preview.html, '<!doctype html><title>V5 preview</title>');
  assert.match(preview.csp, /sandbox allow-scripts/);
  allowed = false;
  await assert.rejects(tickets.load(issued.id), { code: 'preview_not_found' });
  allowed = true;
  now += 11;
  await assert.rejects(tickets.load(issued.id), { code: 'preview_not_found' });
});
