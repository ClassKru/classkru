'use strict';

const { isConfigured } = require('./config');
const { validateConfirmedBrief, normalizeSpecification, codedError } = require('./contracts');
const { buildRequest } = require('./prompts');

function createPromptArchitectService({ provider, config, buildRequest: selectedBuildRequest = buildRequest } = {}) {
  if (!provider || typeof provider.respond !== 'function') throw new TypeError('prompt_architect_provider_required');
  if (!isConfigured(config)) throw codedError('prompt_architect_not_configured');
  return Object.freeze({
    async createSpecification({ confirmedBrief }) {
      const brief = validateConfirmedBrief(confirmedBrief);
      const result = await provider.respond({ config, request: selectedBuildRequest(brief) });
      try {
        return Object.freeze({ specification: normalizeSpecification(result.data, brief), usage: sanitizeUsage(result.usage), attempts: result.attempts, finish_reason: result.finishReason || 'unknown' });
      } catch (error) { if (result.attempts) error.attempts = result.attempts; throw error; }
    },
    async reviseSpecification({ confirmedBrief, previousSpecification, instruction, intent }) {
      const brief = validateConfirmedBrief(confirmedBrief);
      const previous = normalizeSpecification(previousSpecification, brief);
      const text = typeof instruction === 'string' ? instruction.trim().slice(0, 6000) : '';
      if (!text) throw codedError('revision_instruction_invalid');
      const result = await provider.respond({ config, request: selectedBuildRequest(brief, { instruction:text, intent, previousSpecification:previous }) });
      try {
        return Object.freeze({ specification: normalizeSpecification(result.data, brief), usage: sanitizeUsage(result.usage), attempts: result.attempts, finish_reason: result.finishReason || 'unknown' });
      } catch (error) { if (result.attempts) error.attempts = result.attempts; throw error; }
    }
  });
}

function sanitizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  return Object.freeze({ input_tokens: number(usage.prompt_tokens ?? usage.input_tokens), output_tokens: number(usage.completion_tokens ?? usage.output_tokens), total_tokens: number(usage.total_tokens), cost: number(usage.cost) });
}

module.exports = { createPromptArchitectService, sanitizeUsage };


