'use strict';

const crypto = require('node:crypto');
const { isConfigured } = require('./config');
const { normalizeDraft, mergeDraft, validateAssistantResponse, confirmedBrief, codedError } = require('./contracts');
const { buildRequest } = require('./prompts');
const { normalizeMediaMode } = require('./media-mode');
const { guidance } = require('./card-registry');

function nowIso(clock) { return clock().toISOString(); }

function createConversationService({ provider, config, buildRequest: selectedBuildRequest = buildRequest, clock = () => new Date(), idFactory = crypto.randomUUID } = {}) {
  if (!provider || typeof provider.respond !== 'function') throw new TypeError('conversation_provider_required');
  if (!isConfigured(config)) throw codedError('conversation_ai_not_configured');

  async function reply({ conversation, teacherMessage }) {
    const message = String(teacherMessage || '').trim().slice(0, 6000);
    const state = conversation || createConversation();
    if (!message && (!state.card_context || state.turns.length) && !state.idea_discovery_context) throw codedError('teacher_message_required');
    const history = message ? [...state.turns, { id: idFactory(), role: 'teacher', content: message, created_at: nowIso(clock) }] : [...state.turns];
    const context = state.card_context ? guidance(state.card_context) : null;
    const requestHistory = message ? history : [...history, { role:'teacher', content:state.idea_discovery_context ? 'ช่วยเริ่มสนทนาเพื่อค้นหาไอเดีย โดยยังไม่ได้ระบุหัวข้อหรือบทเรียน' : 'เริ่มช่วยคิดตามแนวทางที่เลือก โดยยังไม่มีหัวข้อจากครู' }];
    const request = selectedBuildRequest({ history:requestHistory, draft: state.draft, maxHistoryTurns: config.maxHistoryTurns, cardContext:context, ideaDiscoveryContext:state.idea_discovery_context || null, mediaMode:normalizeMediaMode(state.media_mode) });
    const result = await provider.respond({ config, request });
    const response = validateAssistantResponse(result.data);
    const draft = mergeDraft(state.draft, response.brief, { replaceAssumptions:true });
    const suggestedActions = response.suggested_actions.slice(0, config.maxSuggestedActions);
    const assistantTurn = { id: idFactory(), role: 'assistant', content: response.reply, suggested_actions: suggestedActions, created_at: nowIso(clock) };
    return Object.freeze({
      conversation: Object.freeze({ ...state, idea_discovery_context:null, status: 'draft', draft, turns: [...history, assistantTurn], updated_at: assistantTurn.created_at }),
      reply: response.reply,
      suggested_actions: suggestedActions,
      draft,
      usage: sanitizeUsage(result.usage),
      finish_reason: result.finishReason || 'unknown'
    });
  }

  function confirm({ conversation, editedDraft }) {
    if (!conversation) throw codedError('conversation_required');
    const draft = mergeDraft(conversation.draft, editedDraft || {});
    const confirmedAt = nowIso(clock);
    const baseBrief = confirmedBrief({ briefId: idFactory(), revision: Number(conversation.revision || 0) + 1, draft, confirmedAt });
    const recentConversation = (conversation.turns || []).slice(-16).map(({role,content}) => ({role,content}));
    const brief = Object.freeze({ ...baseBrief, design_context: { media_mode:normalizeMediaMode(conversation.media_mode), selected_cards: conversation.card_context ? guidance(conversation.card_context) : null, recent_conversation:recentConversation, ai_proposals:recentConversation.filter(turn => turn.role === 'assistant').map(turn => turn.content), unconfirmed_suggestions: draft.assumptions } });
    return Object.freeze({
      conversation: Object.freeze({ ...conversation, draft, status: 'confirmed', revision: brief.revision, confirmed_brief: brief, updated_at: confirmedAt }),
      brief
    });
  }

  function createConversation() {
    const createdAt = nowIso(clock);
    return Object.freeze({ id: idFactory(), revision: 0, status: 'draft', media_mode:'normal', draft: normalizeDraft(), turns: [], created_at: createdAt, updated_at: createdAt });
  }

  return Object.freeze({ createConversation, reply, confirm });
}

function sanitizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  return Object.freeze({
    input_tokens: number(usage.prompt_tokens ?? usage.input_tokens),
    output_tokens: number(usage.completion_tokens ?? usage.output_tokens),
    total_tokens: number(usage.total_tokens),
    cost: number(usage.cost)
  });
}

module.exports = { createConversationService, sanitizeUsage };


