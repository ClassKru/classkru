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
  const startedAt = Date.now();
  let response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    const failure = fail(timedOut ? 'ai_timeout' : 'ai_provider_error', timedOut ? 504 : 502);
    failure.durationMs = Date.now() - startedAt;
    throw failure;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failure = fail(response.status === 429 ? 'ai_rate_limit' : (response.status === 408 || response.status === 504 ? 'ai_timeout' : 'ai_provider_error'), 502);
    failure.responseStatus = response.status;
    failure.durationMs = Date.now() - startedAt;
    throw failure;
  }
  const choice = payload.choices?.[0];
  const text = choice?.message?.content;
  if (typeof text !== 'string') {
    const failure = fail('ai_invalid_response_schema', 502);
    failure.responseStatus = response.status;
    failure.durationMs = Date.now() - startedAt;
    throw failure;
  }
  return {
    text: text.trim(),
    usage: payload.usage || null,
    finishReason: String(choice.finish_reason || 'unknown'),
    responseChars: text.length,
    responseStatus: response.status,
    durationMs: Date.now() - startedAt
  };
}

module.exports = { artifactSchema, callOpenRouter };
