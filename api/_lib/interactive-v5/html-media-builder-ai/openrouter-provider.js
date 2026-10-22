'use strict';

const { artifactSchema, codedError } = require('./contracts');

function createOpenRouterProvider({ fetchImpl = globalThis.fetch } = {}) {
  return Object.freeze({
    async respond({ config, request }) {
      if (!config?.apiKey || !config?.modelId) throw codedError('html_builder_not_configured');

      // Some providers ignore json_schema and wrap valid JSON in prose or content
      // parts. Correct once before consuming an artifact-repair attempt.
      for (let attempt = 0; attempt < 2; attempt++) {
        let response;
        try {
          response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`, ...(config.siteUrl ? { 'HTTP-Referer': config.siteUrl } : {}), 'X-Title': 'ClassKru HTML Media Builder AI' },
            signal: AbortSignal.timeout(config.timeoutMs),
            body: JSON.stringify({
              model: config.modelId,
              messages: [{ role: 'system', content: request.systemPrompt }, ...request.messages, ...(attempt ? [{ role: 'user', content: 'Return only one complete JSON object with title, summary, and html. Do not use markdown or explanatory text.' }] : [])],
              ...(!/^openai\/gpt-6-luna(?:-pro)?(?:[-:]|$)/.test(config.modelId) ? { temperature: config.temperature } : {}),
              max_tokens: config.maxTokens,
              provider: { data_collection: 'deny', require_parameters: true },
              response_format: { type: 'json_schema', json_schema: { name: 'classkru_html_media_artifact', strict: true, schema: artifactSchema } }
            })
          });
        } catch (error) {
          throw codedError(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'html_builder_timeout' : 'html_builder_provider_unavailable');
        }
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw codedError(response.status === 429 ? 'html_builder_rate_limited' : 'html_builder_provider_unavailable');
        const message = payload?.choices?.[0]?.message;
        const data = message?.parsed && typeof message.parsed === 'object' && !Array.isArray(message.parsed)
          ? message.parsed
          : parseJsonResponse(contentText(message?.content));
        if (data !== undefined) return Object.freeze({ data, usage: payload.usage || null, finishReason: String(payload?.choices?.[0]?.finish_reason || 'unknown') });
      }
      throw codedError('html_builder_invalid_response');
    }
  });
}

function contentText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter(part => part && typeof part.text === 'string').map(part => part.text).join('\n');
  return '';
}

function parseJsonResponse(content) {
  const text = content.trim();
  if (!text) return undefined;
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : text;
  try { return JSON.parse(candidate); } catch (_) { /* A provider may add a preface or suffix. */ }
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
      } else if (character === '"') inString = true;
      else if (character === '{') depth++;
      else if (character === '}' && --depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

module.exports = { createOpenRouterProvider, parseJsonResponse };
