'use strict';

const DEFAULTS = Object.freeze({ modelId: 'openai/gpt-6-luna', maxTokens: 14000, temperature: 0.2, timeoutMs: 150_000, maxRetries: 2, maxHtmlCharacters: 45000 });
function positiveInt(value, fallback) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback; }
function boundedNumber(value, fallback, min, max) { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback; }
function fromEnvironment(env = process.env) {
  return Object.freeze({ provider: 'openrouter', apiKey: String(env.BUILDER_OPENROUTER_API_KEY || ''), modelId: String(env.BUILDER_MODEL_ID || DEFAULTS.modelId), siteUrl: String(env.BUILDER_OPENROUTER_SITE_URL || ''), maxTokens: positiveInt(env.BUILDER_MAX_TOKENS, DEFAULTS.maxTokens), temperature: boundedNumber(env.BUILDER_TEMPERATURE, DEFAULTS.temperature, 0, 2), timeoutMs: positiveInt(env.BUILDER_TIMEOUT_MS, DEFAULTS.timeoutMs), maxRetries: Number.isInteger(Number(env.BUILDER_MAX_RETRIES)) && Number(env.BUILDER_MAX_RETRIES) >= 0 ? Number(env.BUILDER_MAX_RETRIES) : DEFAULTS.maxRetries, maxHtmlCharacters: positiveInt(env.BUILDER_MAX_HTML_CHARACTERS, DEFAULTS.maxHtmlCharacters) });
}
function isConfigured(config) { return Boolean(config?.apiKey && config?.modelId); }
module.exports = { DEFAULTS, fromEnvironment, isConfigured };


