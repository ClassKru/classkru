'use strict';

const { isConfigured } = require('./config');
const { validateBuildSpecification, validateArtifact, codedError } = require('./contracts');
const { buildRequest } = require('./prompts');
const { classifyRevisionIntent } = require('../../revision-intent');

const RETRYABLE = new Set(['html_builder_timeout', 'html_builder_rate_limited', 'html_builder_provider_unavailable']);
const REPAIRABLE = new Set(['html_builder_invalid_response', 'artifact_response_invalid', 'artifact_validation_failed']);
function createHtmlMediaBuilderService({ provider, artifactStore, runtimePreview, config, buildRequest: selectedBuildRequest = buildRequest, sleep = async () => {} } = {}) {
  if (!provider || typeof provider.respond !== 'function') throw new TypeError('html_builder_provider_required');
  if (!artifactStore || typeof artifactStore.putValidated !== 'function') throw new TypeError('validated_artifact_store_required');
  if (!runtimePreview || typeof runtimePreview.previewUrl !== 'function') throw new TypeError('runtime_preview_required');
  if (!isConfigured(config)) throw codedError('html_builder_not_configured');
  async function deleteArtifacts({ artifactIds = [] } = {}) {
    const ids = [...new Set(artifactIds.filter(id => typeof id === 'string' && id))];
    if (typeof artifactStore.deleteValidatedMany === 'function') return artifactStore.deleteValidatedMany(ids);
    if (typeof artifactStore.deleteValidated !== 'function') throw codedError('artifact_delete_unavailable');
    const deleted = [];
    for (const id of ids) if (await artifactStore.deleteValidated(id)) deleted.push(id);
    return deleted;
  }
  return Object.freeze({
    async deleteArtifact({ artifactId }) {
      const deleted = await deleteArtifacts({ artifactIds: [artifactId] });
      return Object.freeze({ artifact_id: artifactId, deleted: deleted.includes(artifactId) });
    },
    async deleteArtifacts({ artifactIds }) {
      return Object.freeze({ deleted_artifact_ids: await deleteArtifacts({ artifactIds }) });
    },
    async build({ specification, revision = null }) {
      const spec = validateBuildSpecification(specification);
      let revisionInput = null;
      if (revision) {
        const instruction = typeof revision.instruction === 'string' ? revision.instruction.trim().slice(0, 6000) : '';
        if (!instruction || !revision.parent_artifact_id || typeof artifactStore.getValidated !== 'function') throw codedError('revision_invalid');
        const previous = await artifactStore.getValidated(revision.parent_artifact_id);
        if (!previous) throw codedError('artifact_not_found');
        revisionInput = { instruction, intent: revision.intent || classifyRevisionIntent(instruction), html: previous.html };
      }
      let attempt = 0;
      let repairInput = null;
      while (true) {
        try {
          const result = await provider.respond({ config, request: selectedBuildRequest(spec, revisionInput, repairInput) });
          let artifact;
          try {
            artifact = validateArtifact(result.data, { maxHtmlCharacters: Math.min(config.maxHtmlCharacters, spec.html_requirements.max_html_characters), allowThreeJs: spec.media.rendering_strategy === 'html-css-three-js', interactionRequirement: spec.interaction.requirement || 'required', requireAccessibility: spec.schema_version === '1.1' });
          } catch (error) {
            if (REPAIRABLE.has(error?.code)) {
              repairInput = {
                issues: Array.isArray(error.validationErrors) ? error.validationErrors : [error.code],
                artifact: sanitizeRepairArtifact(result.data)
              };
            }
            throw error;
          }
          const stored = await artifactStore.putValidated({ artifact, specification: spec, validationVersion: 'html-media-builder-validator-v3-adaptive-interaction' });
          return Object.freeze({ artifact_id: stored.id, status: stored.status, preview_url: runtimePreview.previewUrl(stored.id), retry_count: attempt, usage: sanitizeUsage(result.usage), finish_reason: result.finishReason || 'unknown' });
        } catch (error) {
          if (!(RETRYABLE.has(error?.code) || REPAIRABLE.has(error?.code)) || attempt >= config.maxRetries) throw Object.assign(error, { retryCount: attempt });
          attempt += 1;
          await sleep(Math.min(1000 * attempt, 3000));
        }
      }
    }
  });
}
function sanitizeRepairArtifact(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    title: typeof value.title === 'string' ? value.title.slice(0, 160) : '',
    summary: typeof value.summary === 'string' ? value.summary.slice(0, 500) : '',
    html: typeof value.html === 'string' ? value.html.slice(0, 50000) : ''
  };
}
function sanitizeUsage(usage) { if (!usage || typeof usage !== 'object') return null; const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null; return Object.freeze({ input_tokens: number(usage.prompt_tokens ?? usage.input_tokens), output_tokens: number(usage.completion_tokens ?? usage.output_tokens), total_tokens: number(usage.total_tokens), cost: number(usage.cost) }); }
module.exports = { RETRYABLE, REPAIRABLE, createHtmlMediaBuilderService, sanitizeUsage };


