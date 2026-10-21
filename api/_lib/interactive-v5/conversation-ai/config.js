'use strict';

const DEFAULTS = Object.freeze({
  modelId: 'openai/gpt-6-luna',
  maxTokens: 900,
  temperature: 0.45,
  timeoutMs: 90_000,
  reasoningEffort: 'low',
  maxHistoryTurns: 16,
  maxSuggestedActions: 3
});

function readPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function fromEnvironment(env = process.env) {
  const modelId = String(env.CONVERSATION_MODEL_ID || DEFAULTS.modelId);
  const requestedEffort = String(env.CONVERSATION_REASONING_EFFORT || '').trim().toLowerCase();
  const reasoningEffort = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(requestedEffort)
    ? requestedEffort : /^openai\/gpt-6-luna(?:-pro)?(?:[-:]|$)/.test(modelId) ? DEFAULTS.reasoningEffort : null;
  return Object.freeze({
    provider: 'openrouter',
    apiKey: String(env.CONVERSATION_OPENROUTER_API_KEY || ''),
    modelId,
    reasoningEffort,
    siteUrl: String(env.CONVERSATION_OPENROUTER_SITE_URL || ''),
    maxTokens: readPositiveInt(env.CONVERSATION_MAX_TOKENS, DEFAULTS.maxTokens),
    temperature: readBoundedNumber(env.CONVERSATION_TEMPERATURE, DEFAULTS.temperature, 0, 2),
    timeoutMs: readPositiveInt(env.CONVERSATION_TIMEOUT_MS, DEFAULTS.timeoutMs),
    maxHistoryTurns: readPositiveInt(env.CONVERSATION_MAX_HISTORY_TURNS, DEFAULTS.maxHistoryTurns),
    maxSuggestedActions: readPositiveInt(env.CONVERSATION_MAX_SUGGESTED_ACTIONS, DEFAULTS.maxSuggestedActions)
  });
}

function isConfigured(config) {
  return Boolean(config && config.apiKey && config.modelId);
}

module.exports = { DEFAULTS, fromEnvironment, isConfigured };


