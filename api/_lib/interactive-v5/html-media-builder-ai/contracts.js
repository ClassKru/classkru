'use strict';

const vm = require('node:vm');
const CONTRACT_VERSION = '1.1';
const LEGACY_CONTRACT_VERSION = '1.0';
const MEDIA_TYPES = new Set(['interactive', 'simulation', 'practice', 'game', 'visualization', 'explainer']);
const INTERACTION_REQUIREMENTS = new Set(['none', 'optional', 'required']);
const RENDERING_STRATEGIES = new Set(['html-css-js', 'html-css-svg-js', 'html-css-canvas-js', 'html-css-three-js']);

const artifactSchema = Object.freeze({ type: 'object', additionalProperties: false, required: ['title', 'summary', 'html'], properties: { title: { type: 'string' }, summary: { type: 'string' }, html: { type: 'string' } } });
function codedError(code) { return Object.assign(new Error(code), { code }); }
function text(value, max = 500) { return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''; }
function nullableText(value, max = 500) { return typeof value === 'string' ? text(value, max) || null : null; }
function texts(value, maxItems, maxLength = 300) { return Array.isArray(value) ? [...new Set(value.map(item => text(item, maxLength)).filter(Boolean))].slice(0, maxItems) : []; }

function validateBuildSpecification(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw codedError('build_specification_invalid');
  if (value.schema_version === LEGACY_CONTRACT_VERSION) return validateLegacySpecification(value);
  if (value.schema_version !== CONTRACT_VERSION) throw codedError('build_specification_invalid');
  const ref = value.brief_ref || {}, media = value.media || {}, learning = value.learning_design || {}, interaction = value.interaction || {}, ui = value.ui || {}, html = value.html_requirements || {}, runtime = value.runtime_requirements || {};
  const normalized = Object.freeze({
    schema_version: CONTRACT_VERSION, brief_ref: { brief_id: text(ref.brief_id, 100), revision: Number(ref.revision) },
    media: { title: text(media.title, 160), format: text(media.format, 50), presentation_type: text(media.presentation_type, 40), rendering_strategy: text(media.rendering_strategy, 40), presentation_strategy: text(media.presentation_strategy, 500), design_rationale: text(media.design_rationale, 800) },
    learning_design: { intent: text(learning.intent, 500), objective_alignment: texts(learning.objective_alignment, 5), learner_experience: texts(learning.learner_experience, 6), academic_rules: texts(learning.academic_rules, 8) },
    interaction: { requirement: text(interaction.requirement, 20), primary_action: nullableText(interaction.primary_action), media_response: nullableText(interaction.media_response), states: texts(interaction.states, 6), feedback_rules: texts(interaction.feedback_rules, 6) },
    content: { key_concepts: texts(value.content?.key_concepts, 8), teacher_review_required: texts(value.content?.teacher_review_required, 5) },
    ui: { components: texts(ui.components, 10), responsive_viewports: texts(ui.responsive_viewports, 3), accessibility_requirements: texts(ui.accessibility_requirements, 8) },
    html_requirements: { single_page: html.single_page === true, document_structure: texts(html.document_structure, 6), max_html_characters: Number(html.max_html_characters) },
    runtime_requirements: { network: text(runtime.network, 20), persistent_storage: text(runtime.persistent_storage, 20), external_dependencies: text(runtime.external_dependencies, 20), allowed_browser_apis: texts(runtime.allowed_browser_apis, 8) },
    acceptance_criteria: texts(value.acceptance_criteria, 12)
  });
  const valid = normalized.brief_ref.brief_id && Number.isInteger(normalized.brief_ref.revision) && normalized.brief_ref.revision > 0
    && normalized.media.title && normalized.media.format === 'single-page-html' && MEDIA_TYPES.has(normalized.media.presentation_type) && RENDERING_STRATEGIES.has(normalized.media.rendering_strategy) && normalized.media.presentation_strategy && normalized.media.design_rationale
    && normalized.learning_design.intent && normalized.learning_design.objective_alignment.length && normalized.learning_design.learner_experience.length
    && INTERACTION_REQUIREMENTS.has(normalized.interaction.requirement) && (normalized.interaction.requirement !== 'required' || (normalized.interaction.primary_action && normalized.interaction.media_response))
    && (normalized.interaction.requirement !== 'none' || (!normalized.interaction.primary_action && !normalized.interaction.media_response))
    && normalized.ui.components.length && normalized.ui.accessibility_requirements.length && normalized.html_requirements.single_page && normalized.html_requirements.document_structure.includes('doctype')
    && Number.isInteger(normalized.html_requirements.max_html_characters) && normalized.html_requirements.max_html_characters > 0 && normalized.html_requirements.max_html_characters <= 45000
    && normalized.runtime_requirements.network === 'deny' && normalized.runtime_requirements.persistent_storage === 'deny' && normalized.runtime_requirements.external_dependencies === 'deny' && normalized.acceptance_criteria.length;
  if (!valid) throw codedError('build_specification_invalid');
  return normalized;
}

function validateLegacySpecification(value) {
  const ref = value.brief_ref || {}, media = value.media || {}, learning = value.learning_design || {}, interaction = value.interaction || {}, ui = value.ui || {}, html = value.html_requirements || {}, runtime = value.runtime_requirements || {};
  const strategy = text(media.rendering_strategy, 40);
  const normalized = Object.freeze({
    schema_version: LEGACY_CONTRACT_VERSION, brief_ref: { brief_id: text(ref.brief_id, 100), revision: Number(ref.revision) },
    media: { title: text(media.title, 160), format: text(media.format, 50), rendering_strategy: strategy },
    learning_design: { objective_alignment: texts(learning.objective_alignment, 5), learner_sequence: texts(learning.learner_sequence, 6), academic_rules: texts(learning.academic_rules, 8) },
    interaction: { primary_action: text(interaction.primary_action), media_response: text(interaction.media_response), states: texts(interaction.states, 6), feedback_rules: texts(interaction.feedback_rules, 6) },
    content: { key_concepts: texts(value.content?.key_concepts, 8), teacher_review_required: texts(value.content?.teacher_review_required, 5) },
    ui: { components: texts(ui.components, 10), responsive_viewports: texts(ui.responsive_viewports, 3), accessibility_requirements: texts(ui.accessibility_requirements, 8) },
    html_requirements: { single_page: html.single_page === true, document_structure: texts(html.document_structure, 6), max_html_characters: Number(html.max_html_characters) },
    runtime_requirements: { network: text(runtime.network, 20), persistent_storage: text(runtime.persistent_storage, 20), external_dependencies: text(runtime.external_dependencies, 20), allowed_browser_apis: texts(runtime.allowed_browser_apis, 8) },
    acceptance_criteria: texts(value.acceptance_criteria, 12)
  });
  const valid = normalized.brief_ref.brief_id && Number.isInteger(normalized.brief_ref.revision) && normalized.brief_ref.revision > 0 && normalized.media.title && normalized.media.format === 'single-page-html' && RENDERING_STRATEGIES.has(strategy) && normalized.learning_design.objective_alignment.length && normalized.interaction.primary_action && normalized.interaction.media_response && normalized.ui.components.length && normalized.html_requirements.single_page && normalized.html_requirements.document_structure.includes('doctype') && Number.isInteger(normalized.html_requirements.max_html_characters) && normalized.html_requirements.max_html_characters > 0 && normalized.runtime_requirements.network === 'deny' && normalized.runtime_requirements.persistent_storage === 'deny' && normalized.runtime_requirements.external_dependencies === 'deny' && normalized.acceptance_criteria.length;
  if (!valid) throw codedError('build_specification_invalid');
  return normalized;
}

function validateArtifact(value, { maxHtmlCharacters, allowThreeJs = false, interactionRequirement = 'required', requireAccessibility = false } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['title', 'summary', 'html'].includes(key))) throw codedError('artifact_response_invalid');
  const artifact = Object.freeze({ title: text(value.title, 160), summary: text(value.summary, 500), html: typeof value.html === 'string' ? value.html.trim() : '' });
  if (!artifact.title || !artifact.html) throw codedError('artifact_response_invalid');

  const errors = [
    ...validateTechnicalHtml(artifact.html, maxHtmlCharacters, allowThreeJs),
    ...validateJavaScript(artifact.html, allowThreeJs),
    ...validateSafety(artifact.html),
    ...validateAccessibility(artifact.html, requireAccessibility),
    ...validateMediaRequirements(artifact.html, allowThreeJs),
    ...validateInteraction(artifact.html, interactionRequirement)
  ];
  if (errors.length) throw Object.assign(codedError('artifact_validation_failed'), { validationErrors: [...new Set(errors)] });
  return artifact;
}

function validateTechnicalHtml(html, maxHtmlCharacters, allowThreeJs) {
  const errors = [];
  if (html.length > maxHtmlCharacters) errors.push('html_too_large');
  if (!/^<!doctype\s+html\b/i.test(html) || !/<html\b/i.test(html) || !/<head\b/i.test(html) || !/<body\b/i.test(html) || !/<title\b[^>]*>\s*[^<]+/i.test(html)) errors.push('html_document_incomplete');
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
  if ([...html.matchAll(/<script\b/gi)].length !== scripts.length) errors.push('script_tag_invalid');
  scripts.forEach((script, index) => {
    const attrs = script[0].match(/^<script\b([^>]*)>/i)?.[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) return;
    let source = script[1];
    if (allowThreeJs && /\btype\s*=\s*["']module["']/i.test(attrs)) source = source.replace(/^\s*import\s+\*\s+as\s+THREE\s+from\s+(["'])\/vendor\/three\.module\.js\1\s*;?\s*$/m, '');
    try { new vm.Script(source, { filename: `builder-artifact-${index + 1}.js` }); } catch (_) { errors.push('javascript_syntax_invalid'); }
  });
  return errors;
}

function validateJavaScript(html, allowThreeJs) {
  const errors = [];
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  let threeImportCount = 0;
  for (const [, attrs, script] of scripts) {
    const isModule = /\btype\s*=\s*["']module["']/i.test(attrs);
    if (isModule) {
      if (!allowThreeJs) errors.push('three_js_not_in_specification');
      const approvedImport = /^\s*import\s+\*\s+as\s+THREE\s+from\s+(["'])\/vendor\/three\.module\.js\1\s*;?\s*$/m;
      const matches = [...script.matchAll(new RegExp(approvedImport.source, 'gm'))];
      threeImportCount += matches.length;
      const remaining = script.replace(approvedImport, '');
      if (!matches.length || /\bimport\b/.test(remaining)) errors.push('module_import_not_allowed');
    } else if (/\bimport\b/.test(script)) errors.push('module_import_not_allowed');
  }
  if (threeImportCount > 1) errors.push('three_js_import_limit_exceeded');
  if (allowThreeJs && threeImportCount !== 1) errors.push('three_js_import_missing');
  return errors;
}

function validateSafety(html) {
  const errors = [];
  const checked = html.replaceAll('http://www.w3.org/2000/svg', '');
  const unsafe = /(?:https?:\/\/|\bsrc\s*=\s*["']?(?!data:)[^"'\s>]+|\bhref\s*=\s*["']?(?!#|data:|mailto:)[^"'\s>]+|url\s*\(\s*["']?(?!#|data:)[^)]+\)|@import\b|javascript\s*:|<script\b[^>]*\bsrc\s*=|\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|<iframe\b|<object\b|<embed\b|\bimport\s*\(|\beval\s*\()/i;
  if (unsafe.test(checked)) errors.push('external_or_unsafe_capability');
  if (/<[a-z][^>]*\son\w+\s*=/i.test(html)) errors.push('inline_event_handler');
  if (/\b(?:localStorage|sessionStorage|indexedDB)\b|\bdocument\.cookie\b|\bnavigator\.serviceWorker\b|\bcaches\.open\s*\(/i.test(html)) errors.push('persistent_storage_forbidden');
  return errors;
}

function validateAccessibility(html, required) {
  if (!required) return [];
  const errors = [];
  if (!/<html\b[^>]*\blang\s*=\s*(?:["'][a-z]{2,3}(?:-[a-z0-9]+)?["']|[a-z]{2,3}(?:-[a-z0-9]+)?)(?:\s|>)/i.test(html)) errors.push('html_language_missing');
  const images = [...html.matchAll(/<img\b([^>]*)>/gi)];
  if (images.some(([, attributes]) => !/\balt\s*=\s*["'][^"']*["']/i.test(attributes))) errors.push('image_alt_missing');
  const svgImages = [...html.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg\s*>/gi)];
  if (svgImages.some(([, attributes, content]) => /\brole\s*=\s*["']img["']/i.test(attributes) && !/\baria-label\s*=|\baria-labelledby\s*=|<title\b/i.test(`${attributes} ${content}`))) errors.push('svg_accessible_name_missing');
  const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button\s*>/gi)];
  if (buttons.some(([, attributes, content]) => !/\b(?:aria-label|title)\s*=/i.test(attributes) && !content.replace(/<[^>]*>/g, '').trim())) errors.push('control_accessible_name_missing');
  const controls = [...html.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)];
  const labels = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label\s*>/gi)].map(([, content]) => content);
  for (const [markup, , attributes] of controls) {
    if (/\b(?:aria-label|title)\s*=/.test(attributes)) continue;
    const id = attributes.match(/\bid\s*=\s*(["'])(.*?)\1/i)?.[2];
    const explicitlyLabelled = id && new RegExp(`<label\\b[^>]*\\bfor\\s*=\\s*["']${escapeRegExp(id)}["']`, 'i').test(html);
    const wrappedByLabel = labels.some(label => label.includes(markup));
    if (!explicitlyLabelled && !wrappedByLabel) { errors.push('control_accessible_name_missing'); break; }
  }
  return errors;
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function validateMediaRequirements(html, allowThreeJs) {
  if (!allowThreeJs && /<canvas\b/i.test(html) && /\bWebGLRenderer\b/i.test(html)) return ['three_js_not_in_specification'];
  return [];
}

function validateInteraction(html, requirement) {
  if (!INTERACTION_REQUIREMENTS.has(requirement)) return ['interaction_requirement_invalid'];
  if (requirement === 'required' && !/<(?:button|input|select|textarea)\b/i.test(html)) return ['interaction_control_missing'];
  return [];
}

module.exports = { CONTRACT_VERSION, LEGACY_CONTRACT_VERSION, MEDIA_TYPES, INTERACTION_REQUIREMENTS, RENDERING_STRATEGIES, artifactSchema, validateBuildSpecification, validateArtifact, codedError };


