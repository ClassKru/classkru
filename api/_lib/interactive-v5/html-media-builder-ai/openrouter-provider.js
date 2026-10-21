'use strict';
const { artifactSchema, codedError } = require('./contracts');
function createOpenRouterProvider({ fetchImpl = globalThis.fetch } = {}) {
  return Object.freeze({ async respond({ config, request }) {
    if (!config?.apiKey || !config?.modelId) throw codedError('html_builder_not_configured');
    let response;
    try { response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`, ...(config.siteUrl ? { 'HTTP-Referer': config.siteUrl } : {}), 'X-Title': 'ClassKru HTML Media Builder AI' }, signal: AbortSignal.timeout(config.timeoutMs), body: JSON.stringify({ model: config.modelId, messages: [{ role: 'system', content: request.systemPrompt }, ...request.messages], ...(!/^openai\/gpt-6-luna(?:-pro)?(?:[-:]|$)/.test(config.modelId) ? { temperature: config.temperature } : {}), max_tokens: config.maxTokens, provider: { data_collection: 'deny', require_parameters: true }, response_format: { type: 'json_schema', json_schema: { name: 'classkru_html_media_artifact', strict: true, schema: artifactSchema } } }) }); }
    catch (error) { throw codedError(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'html_builder_timeout' : 'html_builder_provider_unavailable'); }
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw codedError(response.status === 429 ? 'html_builder_rate_limited' : 'html_builder_provider_unavailable');
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw codedError('html_builder_invalid_response');
    try { return Object.freeze({ data: JSON.parse(content), usage: payload.usage || null, finishReason: String(payload?.choices?.[0]?.finish_reason || 'unknown') }); }
    catch (_) { throw codedError('html_builder_invalid_response'); }
  } });
}
module.exports = { createOpenRouterProvider };


