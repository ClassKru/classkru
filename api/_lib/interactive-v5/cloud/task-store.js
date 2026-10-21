'use strict';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(code) { return Object.assign(new Error(code), { code }); }
function validateId(id, code = 'invalid_task_id') {
  if (typeof id !== 'string' || !UUID.test(id)) throw fail(code);
}
function createTaskStore({ db, teacherId } = {}) {
  if (!UUID.test(String(teacherId || ''))) throw fail('invalid_teacher_id');
  if (!db || typeof db.selectRows !== 'function' || typeof db.mutateRows !== 'function') throw fail('task_database_required');
  const table = 'interactive_v5_tasks';
  const filters = id => ({ teacher_id:`eq.${teacherId}`, id:`eq.${id}` });
  const validState = state => state && typeof state === 'object' && !Array.isArray(state);
  return Object.freeze({
    async create(id, state) {
      validateId(id); if (!validState(state)) throw fail('invalid_task_state');
      const rows = await db.mutateRows(table, 'POST', { body:{teacher_id:teacherId,id,state,revision:0} });
      if (!rows?.[0]) throw fail('task_save_failed');
      return rows[0];
    },
    async get(id) {
      validateId(id);
      const rows = await db.selectRows(table, {filters:filters(id),limit:1});
      return rows[0] || null;
    },
    async list() {
      return db.selectRows(table, {filters:{teacher_id:`eq.${teacherId}`},order:'updated_at.desc',limit:100});
    },
    async findByJobId(id) {
      validateId(id);
      const rows = await db.selectRows(table, {filters:{teacher_id:`eq.${teacherId}`,'state->jobs':`cs.${JSON.stringify([{id}])}`},limit:1});
      return rows[0] || null;
    },
    async listQueued(limit = 20) {
      const rows = await db.selectRows(table, {filters:{teacher_id:`eq.${teacherId}`,'state->jobs':`cs.${JSON.stringify([{state:'queued'}])}`},order:'updated_at.asc',limit});
      return rows;
    },
    async update(id, revision, state) {
      validateId(id);
      if (!Number.isSafeInteger(revision) || revision < 0 || !validState(state)) throw fail('invalid_task_state');
      const rows = await db.mutateRows(table, 'PATCH', {query:{...filters(id),revision:`eq.${revision}`},body:{state,revision:revision+1,updated_at:new Date().toISOString()}});
      if (!rows?.[0]) throw fail('task_conflict_or_not_found');
      return rows[0];
    },
    async delete(id, revision) {
      validateId(id);
      if (!Number.isSafeInteger(revision) || revision < 0) throw fail('invalid_task_revision');
      const rows = await db.mutateRows(table, 'DELETE', {query:{...filters(id),revision:`eq.${revision}`},body:{}});
      if (!rows?.[0]) throw fail('task_conflict_or_not_found');
      return true;
    }
  });
}
module.exports = { UUID, createTaskStore };

