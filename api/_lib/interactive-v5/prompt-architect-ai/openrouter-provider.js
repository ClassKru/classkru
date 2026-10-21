'use strict';

const { buildSpecificationSchema, codedError } = require('./contracts');

function createOpenRouterProvider({ fetchImpl = globalThis.fetch } = {}) {
  return Object.freeze({
    async respond({ config, request }) {
      if (!config?.apiKey || !config?.modelId) throw codedError('prompt_architect_not_configured');
      const attempts = [];
      for (let attempt = 0; attempt < 2; attempt++) {
      let response;
      try {
        response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`, ...(config.siteUrl ? { 'HTTP-Referer': config.siteUrl } : {}), 'X-Title': 'ClassKru Prompt Architect AI' }, signal: AbortSignal.timeout(config.timeoutMs),
          body: JSON.stringify({ model: config.modelId, messages: [{ role: 'system', content: request.systemPrompt }, ...request.messages, ...(attempt ? [{ role: 'user', content: 'Return only a complete valid JSON object matching the required schema. Do not include markdown or explanatory text.' }] : [])], ...(!/^openai\/gpt-6-luna(?:-pro)?(?:[-:]|$)/.test(config.modelId) ? { temperature: config.temperature } : {}), max_tokens: config.maxTokens, provider: { data_collection: 'deny', require_parameters: true }, response_format: { type: 'json_schema', json_schema: { name: 'classkru_build_specification', strict: true, schema: buildSpecificationSchema } } })
        });
      } catch (error) { throw Object.assign(codedError(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'prompt_architect_timeout' : 'prompt_architect_provider_unavailable'), { attempts }); }
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw Object.assign(codedError(response.status === 429 ? 'prompt_architect_rate_limited' : 'prompt_architect_provider_unavailable'), { attempts });
      const content = payload?.choices?.[0]?.message?.content;
      const finishReason = ['stop', 'length', 'content_filter', 'tool_calls', 'error'].includes(payload?.choices?.[0]?.finish_reason) ? payload.choices[0].finish_reason : 'unknown';
      let reason = typeof content !== 'string' ? 'missing_content' : !content.trim() ? 'empty_content' : null;
      let data;
      if (!reason) {
        const stripped = content.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i, '$1');
        try { data = JSON.parse(stripped); } catch (_) { reason = 'invalid_json'; }
      }
      attempts.push({ reason: reason || 'parsed', finish_reason: finishReason, usage: sanitizeUsage(payload?.usage) });
      if (!reason) return Object.freeze({ data, usage: payload?.usage || null, finishReason, attempts });
      }
      throw Object.assign(codedError('prompt_architect_invalid_response'), { attempts });
    }
  });
}

function sanitizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  return { input_tokens: number(usage.prompt_tokens ?? usage.input_tokens), output_tokens: number(usage.completion_tokens ?? usage.output_tokens), total_tokens: number(usage.total_tokens), cost: number(usage.cost) };
}

module.exports = { createOpenRouterProvider };


