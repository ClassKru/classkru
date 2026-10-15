'use strict';

const artifactSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'html'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    html: { type: 'string' }
  }
};

function fail(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

async function callOpenRouter(model, prompt, { maxTokens, temperature, jsonMode = false, systemPrompt = '', timeoutMs = jsonMode ? 220000 : 90000 }) {
  const key = process.env.OPENROUTER_MEDIA_PLANNER_API_KEY;
  if (!key) throw fail('ai_not_configured', 503);
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://classkru-kohl.vercel.app',
      'X-Title': 'ClassKru Mini Lab V2'
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      messages: [...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []), { role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
      provider: { data_collection: 'deny', ...(jsonMode ? { require_parameters: true } : {}) },
      ...(jsonMode ? { response_format: { type: 'json_schema', json_schema: { name: 'classkru_media_v2_artifact', strict: true, schema: artifactSchema } } } : {})
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw fail(response.status === 429 ? 'ai_busy' : 'ai_request_failed', 502);
  const choice = payload.choices?.[0];
  const text = choice?.message?.content;
  if (typeof text !== 'string') throw fail('ai_invalid_response', 502);
  return {
    text: text.trim(),
    usage: payload.usage || null,
    finishReason: String(choice.finish_reason || 'unknown'),
    responseChars: text.length
  };
}

module.exports = { artifactSchema, callOpenRouter };
