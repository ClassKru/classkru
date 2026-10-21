'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createCloudConversation } = require('../api/_lib/interactive-v5/cloud/cloud-conversation');

function memoryStore() {
  const rows = new Map();
  return {
    async create(id, state) { if (rows.has(id)) throw new Error('duplicate'); const row = { id, revision: 0, state: structuredClone(state) }; rows.set(id, row); return structuredClone(row); },
    async get(id) { const row = rows.get(id); return row ? structuredClone(row) : null; },
    async update(id, revision, state) { const row = rows.get(id); if (!row || row.revision !== revision) throw new Error('conflict'); const next = { ...row, revision: revision + 1, state: structuredClone(state) }; rows.set(id, next); return structuredClone(next); }
  };
}

test('V5 idea discovery uses its dedicated prompt context and is idempotent', async () => {
  const store = memoryStore();
  const observed = [];
  const client = {
    createConversation: () => ({ id: 'new-id', revision: 0, turns: [], draft: {}, status: 'draft' }),
    async reply({ conversation, teacherMessage }) {
      observed.push({ idea_discovery_context: conversation.idea_discovery_context, teacherMessage });
      return { conversation: { ...conversation, idea_discovery_context: null, turns: [{ id: 'turn-1', role: 'assistant', content: 'ลองทำสื่อเรื่องแรงโน้มถ่วง' }], last_reply: 'ลองทำสื่อเรื่องแรงโน้มถ่วง' } };
    }
  };
  const service = createCloudConversation({ store, conversationClient: client, teacherId: '4fd1ac02-31e2-4e0a-9897-392ad93fa3b2' });
  const first = await service.startIdeaDiscovery({ subjectStatus: 'unavailable', startKey: 'idea-start-1', message: '' });
  const second = await service.startIdeaDiscovery({ subjectStatus: 'unavailable', startKey: 'idea-start-1', message: '' });
  assert.equal(first.context_status, 'unavailable');
  assert.equal(second.conversation.id, first.conversation.id);
  assert.equal(observed.length, 1);
  assert.deepEqual(observed[0].idea_discovery_context, { subjects: [] });
});
