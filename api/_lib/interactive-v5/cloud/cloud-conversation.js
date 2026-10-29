'use strict';

const crypto = require('node:crypto');
const { resolveContext } = require('../conversation-ai/card-registry');
const { normalizeSubjects } = require('../teacher-context/idea-discovery-context');
function fail(code) { return Object.assign(new Error(code), { code }); }
function normalizeLessonContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const text = (input, max) => String(input || '').trim().slice(0, max);
  const rows = (input, limit, maxText) => (Array.isArray(input) ? input : []).slice(0, limit).map(item => typeof item === 'string' ? text(item, maxText) : Object.fromEntries(['id','code','title','text','standardId','unitId','sourceId'].filter(key => item?.[key] != null).map(key => [key, text(item[key], maxText)])));
  return {
    lessonPlanId:text(value.lessonPlanId, 100), planNumber:text(value.planNumber, 12), title:text(value.title, 240), topic:text(value.topic, 240),
    courseName:text(value.courseName, 180), courseCode:text(value.courseCode, 80), grade:text(value.grade, 80), duration:text(value.duration, 80),
    subjectGroup:text(value.subjectGroup, 180), standards:rows(value.standards, 8, 900), indicators:rows(value.indicators, 12, 900), learningObjectives:rows(value.learningObjectives, 8, 700)
  };
}

function createCloudConversation({ store, conversationClient, teacherId, clock = () => Date.now(), idFactory = crypto.randomUUID, leaseMs = 180000 } = {}) {
  if (!store || !conversationClient) throw fail('conversation_configuration_invalid');
  async function load(id) {
    const row = await store.get(id);
    if (!row) throw fail('conversation_not_found');
    if (row.state.deletion_pending) throw fail('task_deletion_pending');
    return row;
  }
  const isActive = state => Boolean(state.active_operation && state.active_operation.expires_at > clock());
  async function startIdeaDiscovery({ subjects = [], subjectStatus = 'empty', startKey, message = '', mediaMode = 'normal' } = {}) {
    if (!['available', 'empty', 'unavailable'].includes(subjectStatus)) throw fail('teacher_subjects_status_invalid');
    if (typeof startKey !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(startKey)) throw fail('start_key_invalid');
    const normalizedSubjects = normalizeSubjects(subjects);
    const contextStatus = normalizedSubjects.length ? 'available' : subjectStatus === 'unavailable' ? 'unavailable' : 'empty';
    let conversation = await this.start(null, startKey, mediaMode);
    let row = await load(conversation.id);
    if (row.state.last_request_key === startKey && conversation.turns.length) {
      return { conversation, context_status: conversation.idea_discovery_status || contextStatus };
    }
    if (!conversation.turns.length && !conversation.idea_discovery_context) {
      conversation = { ...conversation, idea_discovery_context: { subjects: normalizedSubjects }, idea_discovery_status: contextStatus };
      row = await store.update(row.id, row.revision, { ...row.state, conversation });
    }
    if (conversation.turns.length) return { conversation, context_status: conversation.idea_discovery_status || contextStatus };
    const result = await this.send(conversation.id, message, startKey);
    return { conversation: result, context_status: result.idea_discovery_status || contextStatus };
  }
  return Object.freeze({
    async start(context = null, startKey = null, mediaMode = 'normal', lessonContextInput = null) {
      if (startKey !== null && (typeof startKey !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(startKey) || !teacherId)) throw fail('start_key_invalid');
      const cardContext = context ? resolveContext(context) : null;
      let deterministicId = null;
      if (startKey) {
        const bytes = crypto.createHash('sha256').update(`interactive-v5-start:${teacherId}:${startKey}`).digest().subarray(0,16);
        bytes[6] = (bytes[6] & 15) | 0x40; bytes[8] = (bytes[8] & 63) | 0x80;
        const hex = bytes.toString('hex'); deterministicId = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
        const existing = await store.get(deterministicId);
        if (existing?.state?.start_key === startKey) return existing.state.conversation;
      }
      const lessonContext = normalizeLessonContext(lessonContextInput);
      const conversation = {...conversationClient.createConversation(),media_mode:mediaMode === '3d' ? '3d' : 'normal',...(deterministicId ? {id:deterministicId} : {}),...(cardContext ? {card_context:cardContext} : {}),...(lessonContext ? {lesson_context:lessonContext} : {})};
      try { await store.create(conversation.id,{conversation,active_operation:null,...(startKey ? {start_key:startKey} : {})}); }
      catch (error) {
        const existing = deterministicId && await store.get(deterministicId);
        if (existing?.state?.start_key === startKey) return existing.state.conversation;
        throw error;
      }
      return conversation;
    },
    async get(id) { return (await load(id)).state.conversation; },
    startIdeaDiscovery,
    async changeCards(id, context) {
      const row = await load(id); if (isActive(row.state)) throw fail('conversation_request_in_progress');
      const conversation = {...row.state.conversation,card_context:resolveContext({...row.state.conversation.card_context,...context}),updated_at:new Date(clock()).toISOString()};
      await store.update(id,row.revision,{...row.state,conversation,active_operation:null});
      return conversation;
    },
    async send(id, message, requestKey) {
      if (typeof requestKey !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(requestKey)) throw fail('request_key_invalid');
      const row = await load(id);
      if (row.state.last_request_key === requestKey) return row.state.conversation;
      if (isActive(row.state)) throw fail('conversation_request_in_progress');
      const operation = {id:idFactory(),expires_at:clock()+leaseMs};
      const locked = await store.update(id,row.revision,{...row.state,active_operation:operation});
      try {
        const result = await conversationClient.reply({conversation:locked.state.conversation,teacherMessage:message});
        const next = {...locked.state,conversation:result.conversation,active_operation:null,last_request_key:requestKey};
        await store.update(id,locked.revision,next);
        return result.conversation;
      } catch (error) {
        try { await store.update(id,locked.revision,{...locked.state,active_operation:null}); } catch (_) {}
        throw error;
      }
    }
  });
}
module.exports = { createCloudConversation };

