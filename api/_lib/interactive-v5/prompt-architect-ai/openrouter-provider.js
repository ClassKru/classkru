'use strict';

const { buildSpecificationSchema, codedError } = require('./contracts');

function logProviderFailure(logger, diagnostic) {
  try { logger?.error?.('[interactive-v5 prompt architect] OpenRouter request failed', diagnostic); } catch (_) {}
}

function safeProviderField(value) {
  if (Number.isInteger(value) && value >= 0 && value <= 999) return value;
  if (typeof value === 'string' && /^[a-z0-9_.-]{1,80}$/i.test(value)) return value;
  return null;
}

function classifyProviderFailure(error) {
  const metadata = error?.metadata;
  const raw = metadata?.raw;
  let rawPayload = raw && typeof raw === 'object' ? raw : null;
  if (!rawPayload && typeof raw === 'string') {
    try { rawPayload = JSON.parse(raw); } catch (_) { /* Provider errors are often plain text. */ }
  }
  const rawError = rawPayload?.error && typeof rawPayload.error === 'object' ? rawPayload.error : rawPayload;
  const candidates = [
    error?.message,
    rawError?.message,
    rawError?.type,
    rawError?.param,
    error?.type,
    error?.param,
    typeof raw === 'string' ? raw : null,
    metadata?.message
  ].filter(value => typeof value === 'string');
  const message = candidates.join(' ').toLowerCase();
  const knownFields = new Set([
    'response_format', 'json_schema', 'strict', 'reasoning', 'reasoning.effort', 'temperature',
    'max_tokens', 'max_completion_tokens', 'maxlength', 'minlength', 'pattern', 'format',
    'minimum', 'maximum', 'minitems', 'maxitems', 'additionalproperties', 'anyof', 'oneof',
    'enum', 'type', 'required', 'properties', 'items'
  ]);
  let field = null;
  for (const candidate of candidates) {
    const matches = [
      candidate.match(/(?:unsupported|unknown|invalid|unrecognized)\s+(?:parameter|keyword|field|property)\s*[:=]?\s*["'`]?([a-z0-9_.$-]{1,80})/i),
      candidate.match(/["'`]([a-z0-9_.$-]{1,80})["'`]\s+(?:is not permitted|is not supported|is unsupported|not allowed)/i)
    ];
    const value = matches.find(Boolean)?.[1]?.toLowerCase();
    if (value && knownFields.has(value)) { field = value; break; }
  }
  if (!field) {
    for (const value of [error?.param, rawError?.param]) {
      if (typeof value === 'string' && knownFields.has(value.toLowerCase())) { field = value.toLowerCase(); break; }
    }
  }
  const category = field?.startsWith('reasoning')
    ? 'reasoning_parameter'
    : field === 'temperature' || field === 'max_tokens' || field === 'max_completion_tokens'
      ? field === 'temperature' ? 'sampling_parameter' : 'token_limit'
      : field
        ? 'structured_output'
        : /no endpoints|no matching providers?|no available providers?|provider.{0,20}unavailable/.test(message)
    ? 'no_matching_provider'
    : /response.?format|json.?schema|structured.?output|schema/.test(message)
      ? 'structured_output'
      : /reasoning/.test(message)
        ? 'reasoning_parameter'
        : /temperature|top_p|top_k/.test(message)
          ? 'sampling_parameter'
          : /max_tokens|max_completion_tokens|token limit/.test(message)
            ? 'token_limit'
            : /unsupported|unknown parameter|invalid parameter/.test(message)
              ? 'unsupported_parameter'
              : 'provider_rejected_request';
  const provider = ['OpenAI', 'Amazon Bedrock', 'Azure'].includes(metadata?.provider_name) ? metadata.provider_name : null;
  const errorFields = ['code', 'type', 'param', 'message', 'metadata'].filter(field => Object.hasOwn(error || {}, field));
  const metadataFields = ['provider_name', 'raw', 'message', 'error_type', 'error_code', 'upstream_status'].filter(field => Object.hasOwn(metadata || {}, field));
  const rawFields = ['code', 'type', 'param', 'message', 'error', 'details'].filter(key => Object.hasOwn(rawPayload || {}, key));
  const rawErrorFields = ['code', 'type', 'param', 'message', 'error', 'details'].filter(key => Object.hasOwn(rawError || {}, key));
  return { category, ...(field ? { field } : {}), error_fields: errorFields, metadata_fields: metadataFields, raw_fields: rawFields, raw_error_fields: rawErrorFields, ...(provider ? { provider } : {}) };
}

function createOpenRouterProvider({ fetchImpl = globalThis.fetch, logger = console } = {}) {
  return Object.freeze({
    async respond({ config, request }) {
      if (!config?.apiKey || !config?.modelId) throw codedError('prompt_architect_not_configured');
      const attempts = [];
      for (let attempt = 0; attempt < 2; attempt++) {
      let response;
      try {
        response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`, ...(config.siteUrl ? { 'HTTP-Referer': config.siteUrl } : {}), 'X-Title': 'ClassKru Prompt Architect AI' }, signal: AbortSignal.timeout(config.timeoutMs),
          body: JSON.stringify({ model: config.modelId, ...(config.reasoningEffort ? { reasoning: { effort: config.reasoningEffort } } : {}), messages: [{ role: 'system', content: request.systemPrompt }, ...request.messages, ...(attempt ? [{ role: 'user', content: 'Return only a complete valid JSON object matching the required schema. Do not include markdown or explanatory text.' }] : [])], ...(!/^openai\/gpt-6-luna(?:-pro)?(?:[-:]|$)/.test(config.modelId) ? { temperature: config.temperature } : {}), max_tokens: config.maxTokens, provider: { data_collection: 'deny', require_parameters: true }, response_format: { type: 'json_schema', json_schema: { name: 'classkru_build_specification', strict: true, schema: buildSpecificationSchema } } })
        });
      } catch (error) {
        const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
        logProviderFailure(logger, { kind: timedOut ? 'timeout' : 'network' });
        throw Object.assign(codedError(timedOut ? 'prompt_architect_timeout' : 'prompt_architect_provider_unavailable'), { attempts });
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const status = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
        const diagnostic = { kind: 'http', status, ...classifyProviderFailure(payload?.error) };
        for (const field of ['code', 'type', 'param']) {
          const value = safeProviderField(payload?.error?.[field]);
          if (value !== null && value !== status) diagnostic[field] = value;
        }
        logProviderFailure(logger, diagnostic);
        throw Object.assign(codedError(response.status === 429 ? 'prompt_architect_rate_limited' : 'prompt_architect_provider_unavailable'), { attempts });
      }
      const message = payload?.choices?.[0]?.message;
      const content = message?.content;
      const finishReason = ['stop', 'length', 'content_filter', 'tool_calls', 'error'].includes(payload?.choices?.[0]?.finish_reason) ? payload.choices[0].finish_reason : 'unknown';
      let data = message?.parsed && typeof message.parsed === 'object' && !Array.isArray(message.parsed) ? message.parsed : undefined;
      let reason = data ? null : content === undefined || content === null ? (finishReason === 'length' ? 'truncated_output' : 'missing_content') : null;
      const textContent = typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.filter(part => part && typeof part.text === 'string').map(part => part.text).join('\n')
          : '';
      if (!data && !reason && !textContent.trim()) reason = typeof content === 'string' || Array.isArray(content) ? 'empty_content' : 'unsupported_content_type';
      if (!data && !reason) {
        data = parseJsonResponse(textContent);
        if (data === undefined) reason = finishReason === 'length' ? 'truncated_output' : 'invalid_json';
      }
      attempts.push({ reason: reason || 'parsed', finish_reason: finishReason, usage: sanitizeUsage(payload?.usage) });
      if (!reason) return Object.freeze({ data, usage: payload?.usage || null, finishReason, attempts });
      }
      throw Object.assign(codedError('prompt_architect_invalid_response'), { attempts });
    }
  });
}

function parseJsonResponse(content) {
  const text = content.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : text;
  try { return JSON.parse(candidate); } catch (_) { /* Recover JSON wrapped in provider-added prose. */ }
  const objectText = extractFirstJsonObject(candidate);
  if (!objectText) return undefined;
  try { return JSON.parse(objectText); } catch (_) { return undefined; }
}

function extractFirstJsonObject(text) {
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0, inString = false, escaped = false;
    for (let index = start; index < text.length; index++) {
      const character = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === '{') depth++;
      else if (character === '}' && --depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function sanitizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  return { input_tokens: number(usage.prompt_tokens ?? usage.input_tokens), output_tokens: number(usage.completion_tokens ?? usage.output_tokens), total_tokens: number(usage.total_tokens), cost: number(usage.cost) };
}

module.exports = { createOpenRouterProvider, parseJsonResponse };




