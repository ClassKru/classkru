'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createTaskStore } = require('../api/_lib/interactive-v5/cloud/task-store');
const { createTeacherSettingsStore } = require('../api/_lib/interactive-v5/cloud/teacher-settings');

const TEACHER = '4fd1ac02-31e2-4e0a-9897-392ad93fa3b2';
const TASK = 'a9b720e0-0f30-487e-9f27-3bce6ef4f290';
const JOB = '1beeb5fc-8838-444b-8dde-2aa6f8d59366';

function memoryDb() {
  const tables = new Map();
  return {
    calls: [],
    async selectRows(table, options = {}) {
      this.calls.push({ kind: 'select', table, options });
      let rows = tables.get(table) || [];
      const teacher = options.filters?.teacher_id;
      if (teacher) rows = rows.filter(row => row.teacher_id === teacher.slice(3));
      const id = options.filters?.id;
      if (id) rows = rows.filter(row => row.id === id.slice(3));
      return rows.map(row => structuredClone(row));
    },
    async mutateRows(table, method, options = {}) {
      this.calls.push({ kind: method, table, options });
      let rows = tables.get(table) || [];
      if (method === 'POST') {
        const row = { created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...structuredClone(options.body) };
        rows.push(row); tables.set(table, rows); return [structuredClone(row)];
      }
      const teacher = options.query?.teacher_id?.slice(3);
      const id = options.query?.id?.slice(3);
      const revision = options.query?.revision?.slice(3);
      const index = rows.findIndex(row => (!teacher || row.teacher_id === teacher) && (!id || row.id === id) && (revision === undefined || String(row.revision) === revision));
      if (index < 0) return [];
      if (method === 'PATCH') rows[index] = { ...rows[index], ...structuredClone(options.body) };
      else if (method === 'DELETE') rows.splice(index, 1);
      tables.set(table, rows);
      return method === 'DELETE' ? [{ id }] : [structuredClone(rows[index])];
    }
  };
}

test('V5 task store scopes queued-job reads and uses revision compare-and-swap', async () => {
  const db = memoryDb();
  const store = createTaskStore({ db, teacherId: TEACHER });
  await store.create(TASK, { conversation: { id: TASK }, jobs: [{ id: JOB, state: 'queued' }] });
  const queued = await store.listQueued();
  assert.equal(queued.length, 1);
  const queueQuery = db.calls.find(call => call.kind === 'select' && call.options.filters?.['state->jobs']);
  assert.equal(queueQuery.options.filters.teacher_id, `eq.${TEACHER}`);
  const updated = await store.update(TASK, 0, { conversation: { id: TASK }, jobs: [{ id: JOB, state: 'building' }] });
  assert.equal(updated.revision, 1);
  await assert.rejects(store.update(TASK, 0, { jobs: [] }), { code: 'task_conflict_or_not_found' });
});

test('V5 teacher settings persist only validated model IDs and available brief versions', async () => {
  const db = memoryDb();
  const versions = { status: selected => ({ selected, versions: [{ id: 'original' }, { id: '05-visual-refinement-quality' }] }) };
  const defaults = { conversation: 'openai/gpt-6-luna', architect: 'openai/gpt-6-luna', builder: 'openai/gpt-6-luna' };
  const store = createTeacherSettingsStore({ db, teacherId: TEACHER, defaults, briefVersions: versions });
  assert.deepEqual(await store.getModels(), defaults);
  const selected = { conversation: 'anthropic/claude-3.7-sonnet', architect: defaults.architect, builder: defaults.builder };
  assert.deepEqual(await store.saveModels(selected), selected);
  assert.deepEqual(await store.getModels(), selected);
  assert.equal(await store.saveBriefVersion('05-visual-refinement-quality'), '05-visual-refinement-quality');
  await assert.rejects(store.saveBriefVersion('missing'), { code: 'invalid_brief_version' });
  await assert.rejects(store.saveModels({ ...selected, rogue: 'openai/gpt-6-luna' }), { code: 'invalid_model_settings' });
});
