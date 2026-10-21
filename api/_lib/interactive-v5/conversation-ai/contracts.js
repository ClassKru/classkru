'use strict';

const BRIEF_SCHEMA_VERSION = '1.1';
const MEDIA_TYPES = new Set(['interactive', 'simulation', 'practice', 'game', 'visualization', 'explainer']);
const MEDIA_TYPE_REQUIREMENTS = new Set(['required', 'preferred', 'open']);
const INTERACTION_PREFERENCES = new Set(['required', 'avoid', 'ai_decides']);

const assistantResponseSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'suggested_actions', 'brief'],
  properties: {
    reply: { type: 'string' },
    suggested_actions: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    brief: {
      type: 'object',
      additionalProperties: false,
      required: ['topic', 'learning_objectives', 'learner_level', 'media_type', 'media_type_requirement', 'learner_action', 'interaction_preference', 'constraints', 'assumptions'],
      properties: {
        topic: { type: 'string' },
        learning_objectives: { type: 'array', items: { type: 'string' }, maxItems: 5 },
        learner_level: { type: ['string', 'null'] },
        media_type: { type: ['string', 'null'], enum: [...MEDIA_TYPES, null] },
        media_type_requirement: { type: 'string', enum: [...MEDIA_TYPE_REQUIREMENTS] },
        learner_action: { type: ['string', 'null'] },
        interaction_preference: { type: 'string', enum: [...INTERACTION_PREFERENCES] },
        constraints: { type: 'array', items: { type: 'string' }, maxItems: 8 },
        assumptions: { type: 'array', items: { type: 'string' }, maxItems: 5 }
      }
    }
  }
});

function string(value, max = 500) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function strings(value, maxItems, maxLength = 300) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => string(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function normalizeDraft(input = {}) {
  const mediaType = string(input.media_type, 40);
  return Object.freeze({
    topic: string(input.topic),
    learning_objectives: strings(input.learning_objectives, 5),
    learner_level: string(input.learner_level, 100) || null,
    media_type: MEDIA_TYPES.has(mediaType) ? mediaType : null,
    media_type_requirement: MEDIA_TYPE_REQUIREMENTS.has(input.media_type_requirement) ? input.media_type_requirement : (mediaType && MEDIA_TYPES.has(mediaType) ? 'preferred' : 'open'),
    learner_action: string(input.learner_action) || null,
    interaction_preference: INTERACTION_PREFERENCES.has(input.interaction_preference) ? input.interaction_preference : 'ai_decides',
    constraints: strings(input.constraints, 8),
    assumptions: strings(input.assumptions, 5)
  });
}

function mergeDraft(previous, next, { replaceAssumptions = false } = {}) {
  const prior = normalizeDraft(previous);
  const incoming = normalizeDraft(next);
  const has = key => Object.prototype.hasOwnProperty.call(next || {}, key);
  return Object.freeze({
    topic: incoming.topic || prior.topic,
    learning_objectives: incoming.learning_objectives.length ? incoming.learning_objectives : prior.learning_objectives,
    learner_level: incoming.learner_level || prior.learner_level,
    media_type: has('media_type') ? incoming.media_type : prior.media_type,
    media_type_requirement: has('media_type_requirement') ? incoming.media_type_requirement : prior.media_type_requirement,
    learner_action: has('learner_action') ? incoming.learner_action : prior.learner_action,
    interaction_preference: has('interaction_preference') ? incoming.interaction_preference : prior.interaction_preference,
    constraints: incoming.constraints.length ? incoming.constraints : prior.constraints,
    assumptions: replaceAssumptions || incoming.assumptions.length ? incoming.assumptions : prior.assumptions
  });
}

function validateAssistantResponse(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw codedError('assistant_response_invalid');
  const reply = string(value.reply, 3000);
  if (!reply) throw codedError('assistant_reply_required');
  return Object.freeze({
    reply,
    suggested_actions: strings(value.suggested_actions, 3, 180),
    brief: normalizeDraft(value.brief)
  });
}

function confirmedBrief({ briefId, revision, draft, confirmedAt }) {
  const value = normalizeDraft(draft);
  if (!value.topic || value.learning_objectives.length === 0) throw codedError('brief_not_ready_for_confirmation');
  if (value.media_type_requirement === 'required' && !value.media_type) throw codedError('brief_not_ready_for_confirmation');
  return Object.freeze({
    schema_version: BRIEF_SCHEMA_VERSION,
    brief_id: String(briefId),
    revision: Number(revision),
    status: 'confirmed',
    learning: {
      topic: value.topic,
      learner_level: value.learner_level,
      objectives: value.learning_objectives
    },
    media_intent: {
      type: value.media_type,
      type_requirement: value.media_type_requirement,
      learner_action: value.interaction_preference === 'avoid' ? null : value.learner_action,
      interaction_preference: value.interaction_preference
    },
    constraints: value.constraints,
    assumptions: value.assumptions,
    confirmed_at: confirmedAt
  });
}

function codedError(code) {
  return Object.assign(new Error(code), { code });
}

module.exports = { BRIEF_SCHEMA_VERSION, MEDIA_TYPES, MEDIA_TYPE_REQUIREMENTS, INTERACTION_PREFERENCES, assistantResponseSchema, normalizeDraft, mergeDraft, validateAssistantResponse, confirmedBrief, codedError };


