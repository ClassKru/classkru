'use strict';

const DEFAULTS = Object.freeze({ modelId: 'openai/gpt-6-luna', maxTokens: 12000, temperature: 0.2, timeoutMs: 120_000, reasoningEffort: 'none' });

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function fromEnvironment(env = process.env) {
  const modelId = String(env.ARCHITECT_MODEL_ID || DEFAULTS.modelId);
  const requestedEffort = String(env.ARCHITECT_REASONING_EFFORT || '').trim().toLowerCase();
  const reasoningEffort = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(requestedEffort)
    ? requestedEffort : /^openai\/gpt-6-luna(?:-pro)?(?:[-:]|$)/.test(modelId) ? DEFAULTS.reasoningEffort : null;
  return Object.freeze({
    provider: 'openrouter',
    apiKey: String(env.ARCHITECT_OPENROUTER_API_KEY || ''),
    modelId,
    reasoningEffort,
    siteUrl: String(env.ARCHITECT_OPENROUTER_SITE_URL || ''),
    maxTokens: positiveInt(env.ARCHITECT_MAX_TOKENS, DEFAULTS.maxTokens),
    temperature: boundedNumber(env.ARCHITECT_TEMPERATURE, DEFAULTS.temperature, 0, 2),
    timeoutMs: positiveInt(env.ARCHITECT_TIMEOUT_MS, DEFAULTS.timeoutMs)
  });
}

function isConfigured(config) { return Boolean(config?.apiKey && config?.modelId); }

module.exports = { DEFAULTS, fromEnvironment, isConfigured };



