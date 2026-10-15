'use strict';

const config = require('./media-lab-v2-config');

const MECHANICS = Object.freeze([
  { key: 'simulation', pattern: /ตัวแปร|จำลองสถานการณ์|ปรับค่า|slider|simulation|simulate|change values/i },
  { key: 'manipulation', pattern: /ลาก(?:แล้ว)?วาง|ลากวาง|จับคู่|จัดเรียง|เรียงลำดับ|drag(?:-|\s)?and(?:-|\s)?drop|match(?:ing)?|sort(?:ing)?/i },
  { key: 'quiz', pattern: /แบบทดสอบ|ตอบคำถาม|quiz|multiple choice|เลือกคำตอบ|คำถามหลายข้อ/i },
  { key: 'free-response', pattern: /พิมพ์คำตอบ|ตอบอิสระ|เขียนตอบ|free response|text input/i },
  { key: 'navigation', pattern: /หลายหน้าจอ|หลายหน้า|หน้าถัดไป|หลายฉาก|หลายด่าน|next screen|multiple screens|multiple scenes|levels?/i },
  { key: 'score-timer', pattern: /จับเวลา|นับถอยหลัง|คะแนนสะสม|leaderboard|countdown|timer|scoreboard/i }
]);

function countScenes(source) {
  const values = [];
  for (const match of source.matchAll(/(?:ฉาก|หน้าจอ|หน้า|scene|screen|frame|level|ด่าน)\s*(?:ที่)?\s*(\d{1,2})/giu)) values.push(Number(match[1]));
  for (const match of source.matchAll(/(\d{1,2})\s*(?:ฉาก|หน้าจอ|หน้า|scenes?|screens?|frames?|levels?|ด่าน)/giu)) values.push(Number(match[1]));
  if (/หลายฉาก|หลายหน้าจอ|หลายหน้า|หลายด่าน|many scenes|multiple scenes|multiple screens/i.test(source)) values.push(config.complexityBudget.maxScenes + 1);
  return Math.max(1, ...values.filter(Number.isFinite));
}

function animationComplexity(source) {
  if (/\b3d\b|particle|shader|physics simulation|หลายเลเยอร์|particles|rigid body/i.test(source)) return 3;
  if (/เคลื่อนไหวหลายฉาก|แอนิเมชันต่อเนื่อง|หลายแอนิเมชัน|complex animation|continuous animation|animate.*(?:scene|screen)|(?:scene|screen).*animate/i.test(source)) return 2;
  if (/แอนิเมชัน|ภาพเคลื่อนไหว|ขยับ|เคลื่อนที่|animation|animated|motion|transition/i.test(source)) return 1;
  return 0;
}

function countAssets(source, assetKinds) {
  const requestedCounts = [];
  for (const match of source.matchAll(/(\d{1,2})\s*(?:ภาพ|รูปภาพ|images?|illustrations?|sounds?|audio clips?|videos?|clips?|3d models?)/giu)) requestedCounts.push(Number(match[1]));
  return Math.max(assetKinds.length, ...requestedCounts.filter(Number.isFinite), 0);
}

function estimateV2Complexity(messages = [], brief = null, budget = config.complexityBudget) {
  const conversation = Array.isArray(messages)
    ? messages.map(item => String(item?.content || '')).join('\n')
    : String(messages || '');
  const selected = String(brief?.selected_direction || brief?.direction || '');
  const source = (conversation + '\n' + selected).slice(-50000);
  const scenes = countScenes(source);
  const mechanics = MECHANICS.filter(item => item.pattern.test(source)).map(item => item.key);
  const animation = animationComplexity(source);
  const assetKinds = ['ภาพ|รูปภาพ|image|illustration', 'เสียง|เพลง|audio|sound', 'วิดีโอ|คลิป|video', 'โมเดล 3d|3d model'].filter(pattern => new RegExp(pattern, 'i').test(source));
  const externalSignals = [
    /https?:\/\//i, /\bcdn\b/i, /external asset|โหลดจากเว็บ|โหลดจาก url/i,
    /youtube|google maps/i, /fetch\s*\(/i, /external library|ไลบรารีภายนอก/i
  ];
  const external = externalSignals.filter(pattern => pattern.test(source)).length;
  const assets = countAssets(source, assetKinds);
  const estimatedHtmlCharacters = 5000 + (scenes * 4200) + (mechanics.length * 3200) + (animation * 2100) + (assets * 1300);
  const estimatedOutputTokens = 1300 + (scenes * 500) + (mechanics.length * 1900) + (animation * 650) + (assets * 450) + (external ? 500 : 0);
  const metrics = {
    scenes,
    mechanics,
    mechanic_count: mechanics.length,
    animation_complexity: animation,
    asset_count: assets,
    external_dependencies: external,
    estimated_html_characters: estimatedHtmlCharacters,
    estimated_output_tokens: estimatedOutputTokens,
    token_budget: { max_output_tokens: config.retryPolicy.builderMaxTokens, preflight_ceiling: budget.maxEstimatedOutputTokens },
    runtime: { single_file: true, network_access: false, external_dependencies: 0, max_html_characters: budget.maxEstimatedHtmlCharacters }
  };
  const violations = [];
  if (scenes > budget.maxScenes) violations.push({ code: 'too_many_scenes', actual: scenes, limit: budget.maxScenes, suggestion: 'ย่อให้เหลือไม่เกิน ' + budget.maxScenes + ' ฉาก โดยเริ่มจากหน้าจอหลักหนึ่งหน้า' });
  if (mechanics.length > budget.maxMechanics) violations.push({ code: 'too_many_mechanics', actual: mechanics.length, limit: budget.maxMechanics, suggestion: 'เลือกกลไกหลักไม่เกิน ' + budget.maxMechanics + ' แบบ แล้วใช้ feedback ช่วยขยายการเรียนรู้' });
  if (animation > budget.maxAnimationComplexity) violations.push({ code: 'animation_too_complex', actual: animation, limit: budget.maxAnimationComplexity, suggestion: 'แทนภาพเคลื่อนไหวซับซ้อนด้วยภาพนิ่งหรือการเปลี่ยนสถานะที่เห็นผลชัดเจน' });
  if (assets > budget.maxAssets) violations.push({ code: 'too_many_assets', actual: assets, limit: budget.maxAssets, suggestion: 'ลดชนิดสื่อประกอบ แล้วใช้รูปทรง สี หรือ SVG ที่ฝังในไฟล์แทน' });
  if (external > budget.maxExternalDependencies) violations.push({ code: 'external_dependency', actual: external, limit: budget.maxExternalDependencies, suggestion: 'ตัด URL, CDN และการเรียกเครือข่าย แล้วใช้เนื้อหาที่อยู่ในไฟล์ HTML เดียว' });
  if (estimatedHtmlCharacters > budget.maxEstimatedHtmlCharacters) violations.push({ code: 'estimated_html_too_large', actual: estimatedHtmlCharacters, limit: budget.maxEstimatedHtmlCharacters, suggestion: 'ลดจำนวนเนื้อหาและองค์ประกอบบนหน้าจอให้พอดีกับไฟล์ HTML หน้าเดียว' });
  if (estimatedOutputTokens > budget.maxEstimatedOutputTokens) violations.push({ code: 'estimated_tokens_too_high', actual: estimatedOutputTokens, limit: budget.maxEstimatedOutputTokens, suggestion: 'ลดขอบเขตให้เหลือหนึ่งเป้าหมายและหนึ่ง interaction เพื่อให้อยู่ในงบสร้างสื่อ' });
  return { allowed: violations.length === 0, metrics, violations, suggestions: violations.map(item => item.suggestion), budget: { ...budget } };
}

function classifyBuildError(error, validation = null) {
  const code = String(error?.code || '').toLowerCase();
  const name = String(error?.name || '').toLowerCase();
  const status = Number(error?.responseStatus || error?.status || 0);
  if (code === 'complexity_exceeded') return 'complexity_exceeded';
  if (code === 'output_truncated' || error?.finishReason === 'length') return 'output_truncated';
  if (code === 'invalid_response_schema' || code.startsWith('v2_output_') || code.startsWith('ai_invalid_response')) return 'invalid_response_schema';
  if (validation?.error_categories?.includes('javascript_error')) return 'javascript_error';
  if (validation && !validation.ok) return 'invalid_html';
  if (code === 'runtime_error') return 'runtime_error';
  if (code === 'ai_rate_limit' || code === 'ai_busy' || status === 429) return 'rate_limit';
  if (code === 'ai_timeout' || name === 'timeouterror' || name === 'aborterror') return 'timeout';
  if (code === 'ai_provider_error' || code === 'ai_request_failed' || code === 'ai_not_configured' || status >= 500 || code === 'fetch_failed') return 'provider_error';
  return 'unknown_error';
}

function retryDelay(retryIndex, policy = config.retryPolicy) {
  return Math.min(policy.maxBackoffMs, policy.initialBackoffMs * (2 ** Math.max(0, retryIndex)));
}

module.exports = { config, estimateV2Complexity, classifyBuildError, retryDelay };
