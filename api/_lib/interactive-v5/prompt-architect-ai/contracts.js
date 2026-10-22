'use strict';

const CONTRACT_VERSION = '1.1';
const LEGACY_CONTRACT_VERSION = '1.0';
const MEDIA_TYPES = new Set(['interactive', 'simulation', 'practice', 'game', 'visualization', 'explainer']);
const INTERACTION_REQUIREMENTS = new Set(['none', 'optional', 'required']);
const RENDERING_STRATEGIES = new Set(['html-css-js', 'html-css-svg-js', 'html-css-canvas-js', 'html-css-three-js']);

const buildSpecificationSchema = Object.freeze({
  type: 'object', additionalProperties: false,
  required: ['schema_version', 'brief_ref', 'media', 'learning_design', 'interaction', 'content', 'ui', 'html_requirements', 'runtime_requirements', 'acceptance_criteria'],
  properties: {
    schema_version: { type: 'string', enum: [CONTRACT_VERSION] },
    brief_ref: { type: 'object', additionalProperties: false, required: ['brief_id', 'revision'], properties: { brief_id: { type: 'string' }, revision: { type: 'integer' } } },
    media: { type: 'object', additionalProperties: false, required: ['title', 'format', 'presentation_type', 'rendering_strategy', 'presentation_strategy', 'design_rationale'], properties: { title: { type: 'string' }, format: { type: 'string', enum: ['single-page-html'] }, presentation_type: { type: 'string', enum: [...MEDIA_TYPES] }, rendering_strategy: { type: 'string', enum: [...RENDERING_STRATEGIES] }, presentation_strategy: { type: 'string' }, design_rationale: { type: 'string' } } },
    three_d_scene: { type: ['object', 'null'], additionalProperties: false, required: ['scene', 'learning_focus', 'objects', 'camera', 'learner_action', 'fallback'], properties: { scene: { type: 'string' }, learning_focus: { type: 'string' }, objects: { type: 'array', items: { type: 'string' } }, camera: { type: 'string' }, learner_action: { type: ['string', 'null'] }, fallback: { type: 'string' } } },
    learning_design: { type: 'object', additionalProperties: false, required: ['intent', 'objective_alignment', 'learner_experience', 'academic_rules'], properties: { intent: { type: 'string' }, objective_alignment: { type: 'array', items: { type: 'string' } }, learner_experience: { type: 'array', items: { type: 'string' } }, academic_rules: { type: 'array', items: { type: 'string' } } } },
    interaction: { type: 'object', additionalProperties: false, required: ['requirement', 'primary_action', 'media_response', 'states', 'feedback_rules'], properties: { requirement: { type: 'string', enum: [...INTERACTION_REQUIREMENTS] }, primary_action: { type: ['string', 'null'] }, media_response: { type: ['string', 'null'] }, states: { type: 'array', items: { type: 'string' } }, feedback_rules: { type: 'array', items: { type: 'string' } } } },
    content: { type: 'object', additionalProperties: false, required: ['key_concepts', 'teacher_review_required'], properties: { key_concepts: { type: 'array', items: { type: 'string' } }, teacher_review_required: { type: 'array', items: { type: 'string' } } } },
    ui: { type: 'object', additionalProperties: false, required: ['components', 'responsive_viewports', 'accessibility_requirements'], properties: { components: { type: 'array', items: { type: 'string' } }, responsive_viewports: { type: 'array', items: { type: 'string' } }, accessibility_requirements: { type: 'array', items: { type: 'string' } } } },
    html_requirements: { type: 'object', additionalProperties: false, required: ['single_page', 'document_structure', 'max_html_characters'], properties: { single_page: { type: 'boolean' }, document_structure: { type: 'array', items: { type: 'string' } }, max_html_characters: { type: 'integer' } } },
    runtime_requirements: { type: 'object', additionalProperties: false, required: ['network', 'persistent_storage', 'external_dependencies', 'allowed_browser_apis'], properties: { network: { type: 'string', enum: ['deny'] }, persistent_storage: { type: 'string', enum: ['deny'] }, external_dependencies: { type: 'string', enum: ['deny'] }, allowed_browser_apis: { type: 'array', items: { type: 'string' } } } },
    acceptance_criteria: { type: 'array', items: { type: 'string' } }
  }
});

function codedError(code) { return Object.assign(new Error(code), { code }); }
function text(value, max = 500) { return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''; }
function nullableText(value, max = 500) { return typeof value === 'string' ? text(value, max) || null : null; }
function texts(value, maxItems, maxLength = 300) { return Array.isArray(value) ? [...new Set(value.map(item => text(item, maxLength)).filter(Boolean))].slice(0, maxItems) : []; }

function validateConfirmedBrief(value) {
  const version = value?.schema_version;
  if (!value || typeof value !== 'object' || ![CONTRACT_VERSION, LEGACY_CONTRACT_VERSION].includes(version) || value.status !== 'confirmed') throw codedError('confirmed_brief_invalid');
  const topic = text(value.learning?.topic);
  const objectives = texts(value.learning?.objectives, 5);
  const media = value.media_intent || {};
  const type = text(media.type, 40);
  const action = nullableText(media.learner_action);
  const legacy = version === LEGACY_CONTRACT_VERSION;
  if (!text(value.brief_id, 100) || !Number.isInteger(value.revision) || value.revision < 1 || !topic || !objectives.length) throw codedError('confirmed_brief_invalid');
  if (legacy) {
    if (!action || !MEDIA_TYPES.has(type)) throw codedError('confirmed_brief_invalid');
    return Object.freeze({ schema_version: version, brief_id: text(value.brief_id, 100), revision: value.revision, learning: { topic, learner_level: text(value.learning?.learner_level, 100) || null, objectives }, media_intent: { type, learner_action: action }, constraints: texts(value.constraints, 8), assumptions: texts(value.assumptions, 5), ...(value.design_context && typeof value.design_context === 'object' ? { design_context: value.design_context } : {}) });
  }
  const typeRequirement = media.type_requirement;
  const interactionPreference = media.interaction_preference;
  if ((type && !MEDIA_TYPES.has(type)) || !['required', 'preferred', 'open'].includes(typeRequirement) || !['required', 'avoid', 'ai_decides'].includes(interactionPreference) || (typeRequirement === 'required' && !type)) throw codedError('confirmed_brief_invalid');
  return Object.freeze({ schema_version: version, brief_id: text(value.brief_id, 100), revision: value.revision, learning: { topic, learner_level: text(value.learning?.learner_level, 100) || null, objectives }, media_intent: { type: type || null, type_requirement: typeRequirement, learner_action: interactionPreference === 'avoid' ? null : action, interaction_preference: interactionPreference }, constraints: texts(value.constraints, 8), assumptions: texts(value.assumptions, 5), ...(value.design_context && typeof value.design_context === 'object' ? { design_context: value.design_context } : {}) });
}

function normalizeLegacySpecification(value, brief) {
  const ref = value.brief_ref || {}, media = value.media || {}, learning = value.learning_design || {}, interaction = value.interaction || {}, content = value.content || {}, ui = value.ui || {}, html = value.html_requirements || {}, runtime = value.runtime_requirements || {};
  const strategy = text(media.rendering_strategy, 40);
  const output = Object.freeze({
    schema_version: LEGACY_CONTRACT_VERSION, brief_ref: { brief_id: brief.brief_id, revision: brief.revision },
    media: { title: text(media.title, 160), format: text(media.format, 50), rendering_strategy: strategy },
    learning_design: { objective_alignment: texts(learning.objective_alignment, 5), learner_sequence: texts(learning.learner_sequence, 6), academic_rules: texts(learning.academic_rules, 8) },
    interaction: { primary_action: text(interaction.primary_action), media_response: text(interaction.media_response), states: texts(interaction.states, 6), feedback_rules: texts(interaction.feedback_rules, 6) },
    content: { key_concepts: texts(content.key_concepts, 8), teacher_review_required: texts(content.teacher_review_required, 5) },
    ui: { components: texts(ui.components, 10), responsive_viewports: texts(ui.responsive_viewports, 3), accessibility_requirements: texts(ui.accessibility_requirements, 8) },
    html_requirements: { single_page: html.single_page === true, document_structure: texts(html.document_structure, 6), max_html_characters: Number(html.max_html_characters) },
    runtime_requirements: { network: text(runtime.network, 20), persistent_storage: text(runtime.persistent_storage, 20), external_dependencies: text(runtime.external_dependencies, 20), allowed_browser_apis: texts(runtime.allowed_browser_apis, 8) },
    acceptance_criteria: texts(value.acceptance_criteria, 12)
  });
  const valid = output.media.title && output.media.format === 'single-page-html' && RENDERING_STRATEGIES.has(strategy) && output.learning_design.objective_alignment.length && output.learning_design.learner_sequence.length && output.interaction.primary_action && output.interaction.media_response && output.ui.components.length && output.html_requirements.single_page && output.html_requirements.document_structure.includes('doctype') && Number.isInteger(output.html_requirements.max_html_characters) && output.html_requirements.max_html_characters > 0 && output.html_requirements.max_html_characters <= 45000 && output.runtime_requirements.network === 'deny' && output.runtime_requirements.persistent_storage === 'deny' && output.runtime_requirements.external_dependencies === 'deny' && output.acceptance_criteria.length;
  if (!valid) throw codedError('build_specification_invalid');
  return output;
}

function normalizeSpecification(value, brief) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw codedError('build_specification_invalid');
  if (Object.prototype.hasOwnProperty.call(value, 'html')) throw codedError('build_specification_contains_html');
  const ref = value.brief_ref || {};
  if (text(ref.brief_id, 100) !== brief.brief_id || ref.revision !== brief.revision) throw codedError('build_specification_brief_mismatch');
  if (value.schema_version === LEGACY_CONTRACT_VERSION) return normalizeLegacySpecification(value, brief);
  if (value.schema_version !== CONTRACT_VERSION) throw codedError('build_specification_invalid');
  const media = value.media || {}, scene = value.three_d_scene || {}, learning = value.learning_design || {}, interaction = value.interaction || {}, content = value.content || {}, ui = value.ui || {}, html = value.html_requirements || {}, runtime = value.runtime_requirements || {};
  const strategy = text(media.rendering_strategy, 40);
  const requirement = text(interaction.requirement, 20);
  const output = Object.freeze({
    schema_version: CONTRACT_VERSION, brief_ref: { brief_id: brief.brief_id, revision: brief.revision },
    media: { title: text(media.title, 160), format: text(media.format, 50), presentation_type: text(media.presentation_type, 40), rendering_strategy: strategy, presentation_strategy: text(media.presentation_strategy, 500), design_rationale: text(media.design_rationale, 800) },
    three_d_scene: strategy === 'html-css-three-js' ? { scene: text(scene.scene, 500), learning_focus: text(scene.learning_focus, 500), objects: texts(scene.objects, 8), camera: text(scene.camera, 300), learner_action: nullableText(scene.learner_action, 300), fallback: text(scene.fallback, 300) } : null,
    learning_design: { intent: text(learning.intent, 500), objective_alignment: texts(learning.objective_alignment, 5), learner_experience: texts(learning.learner_experience, 6), academic_rules: texts(learning.academic_rules, 8) },
    interaction: { requirement, primary_action: nullableText(interaction.primary_action), media_response: nullableText(interaction.media_response), states: texts(interaction.states, 6), feedback_rules: texts(interaction.feedback_rules, 6) },
    content: { key_concepts: texts(content.key_concepts, 8), teacher_review_required: texts(content.teacher_review_required, 5) },
    ui: { components: texts(ui.components, 10), responsive_viewports: texts(ui.responsive_viewports, 3), accessibility_requirements: texts(ui.accessibility_requirements, 8) },
    html_requirements: { single_page: html.single_page === true, document_structure: texts(html.document_structure, 6), max_html_characters: Number(html.max_html_characters) },
    runtime_requirements: { network: text(runtime.network, 20), persistent_storage: text(runtime.persistent_storage, 20), external_dependencies: text(runtime.external_dependencies, 20), allowed_browser_apis: texts(runtime.allowed_browser_apis, 8) },
    acceptance_criteria: texts(value.acceptance_criteria, 12)
  });
  const legacyBrief = brief.schema_version === LEGACY_CONTRACT_VERSION;
  const matchesRequiredType = brief.media_intent?.type_requirement === 'required' || legacyBrief
    ? output.media.presentation_type === brief.media_intent.type
    : true;
  const matchesInteractionPreference = brief.media_intent?.interaction_preference === 'required' || (legacyBrief && brief.media_intent?.learner_action)
    ? requirement === 'required'
    : brief.media_intent?.interaction_preference === 'avoid'
      ? requirement === 'none'
      : true;
  const valid = output.media.title && output.media.format === 'single-page-html' && MEDIA_TYPES.has(output.media.presentation_type) && RENDERING_STRATEGIES.has(strategy) && output.media.presentation_strategy && output.media.design_rationale
    && output.learning_design.intent && output.learning_design.objective_alignment.length && output.learning_design.learner_experience.length
    && INTERACTION_REQUIREMENTS.has(requirement) && (requirement !== 'required' || (output.interaction.primary_action && output.interaction.media_response))
    && (requirement !== 'none' || (!output.interaction.primary_action && !output.interaction.media_response))
    && output.ui.components.length && output.html_requirements.single_page && output.html_requirements.document_structure.includes('doctype')
    && Number.isInteger(output.html_requirements.max_html_characters) && output.html_requirements.max_html_characters > 0 && output.html_requirements.max_html_characters <= 45000
    && output.runtime_requirements.network === 'deny' && output.runtime_requirements.persistent_storage === 'deny' && output.runtime_requirements.external_dependencies === 'deny'
    && output.acceptance_criteria.length && matchesRequiredType && matchesInteractionPreference
    && (strategy !== 'html-css-three-js' || (output.three_d_scene.scene && output.three_d_scene.learning_focus && output.three_d_scene.objects.length && output.three_d_scene.camera && output.three_d_scene.fallback));
  if (!valid) throw codedError('build_specification_invalid');
  return output;
}

module.exports = { CONTRACT_VERSION, LEGACY_CONTRACT_VERSION, MEDIA_TYPES, INTERACTION_REQUIREMENTS, RENDERING_STRATEGIES, buildSpecificationSchema, validateConfirmedBrief, normalizeSpecification, codedError };


