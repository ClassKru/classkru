'use strict';

const { registry } = require('./navigation');
const { buildV3Messages } = require('./prompt-context');

const schema = Object.freeze({
  type: 'object', additionalProperties: false, required: ['reply', 'action'],
  properties: {
    reply: { type: 'string' },
    action: {
      type: ['object', 'null'], additionalProperties: false, required: ['type', 'target', 'highlight'],
      properties: {
        type: { type: 'string', enum: ['navigate'] },
        target: { type: 'string', enum: registry.map(entry => entry.id) },
        highlight: { type: 'boolean' }
      }
    }
  }
});

function positiveInt(value, fallback, max) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? Math.min(number, max) : fallback;
}

async function respond({ message, context, history, brief, actionRegistry, env = process.env, fetchImpl = globalThis.fetch }) {
  const apiKey = String(env.CLASSKRU_AI_NAV_OPENROUTER_API_KEY || env.OPENROUTER_API_KEY || '');
  const modelId = String(env[brief.config.modelEnv] || env[brief.config.fallbackModelEnv] || '');
  if (!apiKey || !modelId) throw Object.assign(new Error('provider_not_configured'), { code: 'provider_not_configured' });

  const messages = brief.id === 'v3'
    ? buildV3Messages({ message, context, history, brief, actionRegistry })
    : (() => {
      const allowedActions = actionRegistry.map(({ id, screen, label, requiresClass }) => ({ id, screen, label, requiresClass: Boolean(requiresClass) }));
      const systemPrompt = [
        brief.system,
        brief.navigation,
        `\nบริบทปัจจุบัน (ข้อมูลอ้างอิงเท่านั้น): ${JSON.stringify(context)}\nAction Registry ที่อนุญาต (เลือก target จาก id เท่านั้น): ${JSON.stringify(allowedActions)}\nส่งกลับ JSON ตาม schema; เมื่อไม่ควรนำทางให้ action เป็น null.\n`
      ].join('\n\n');
      return [
        { role: 'system', content: systemPrompt },
        ...history.slice(-positiveInt(brief.config.maxHistoryTurns, 8, 16)).map(turn => ({ role: turn.role === 'assistant' ? 'assistant' : 'user', content: turn.content })),
        { role: 'user', content: message }
      ];
    })();

  let response;
  try {
    response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`,
        ...(env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': env.OPENROUTER_SITE_URL } : {}),
        'X-Title': 'ClassKru Navigation AI'
      },
      signal: AbortSignal.timeout(positiveInt(brief.config.timeoutMs, 25000, 60000)),
      body: JSON.stringify({
        model: modelId, messages,
        max_tokens: positiveInt(brief.config.maxTokens, 650, 1200),
        provider: { data_collection: 'deny', require_parameters: true },
        response_format: { type: 'json_schema', json_schema: { name: 'classkru_navigation_action', strict: true, schema } }
      })
    });
  } catch (error) {
    const code = error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'provider_timeout' : 'provider_unavailable';
    throw Object.assign(new Error(code), { code });
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(response.status === 429 ? 'provider_rate_limited' : 'provider_unavailable'), { code: response.status === 429 ? 'provider_rate_limited' : 'provider_unavailable' });
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw Object.assign(new Error('invalid_ai_response'), { code: 'invalid_ai_response' });
  let answer;
  try { answer = JSON.parse(content); } catch (_) { throw Object.assign(new Error('invalid_ai_response'), { code: 'invalid_ai_response' }); }
  return { answer, usage: payload.usage || null, modelId };
}

module.exports = { respond, schema };
