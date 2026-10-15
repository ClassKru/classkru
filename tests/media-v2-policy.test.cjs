'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { estimateV2Complexity, classifyBuildError, retryDelay, config } = require('../api/_lib/media-lab-v2-policy');

test('Media V2 keeps a feasible single interaction within the configurable budget', () => {
  const estimate = estimateV2Complexity([{ role: 'teacher', content: 'อยากให้เด็กทดลองปรับตัวแปรแรงเสียดทานด้วย slider แล้วสังเกตผล' }]);
  assert.equal(estimate.allowed, true);
  assert.equal(estimate.metrics.scenes, 1);
  assert.deepEqual(estimate.metrics.mechanics, ['simulation']);
  assert.equal(estimate.metrics.external_dependencies, 0);
  assert.ok(estimate.metrics.estimated_output_tokens < config.complexityBudget.maxEstimatedOutputTokens);
  assert.ok(estimate.metrics.estimated_html_characters < config.complexityBudget.maxEstimatedHtmlCharacters);
});

test('Media V2 keeps representative subjects across learning areas feasible', () => {
  const topics = [
    'ป.5 ทดลองแรงเสียดทาน ปรับค่าตัวแปรเดียวแล้วสังเกตผล',
    'ป.4 เปรียบเทียบเศษส่วนด้วยการเลือกคำตอบ',
    'ภาษาไทย เรียงประโยคด้วยการลากคำให้ถูกตำแหน่ง',
    'ประวัติศาสตร์ สำรวจเส้นเวลาเหตุการณ์สำคัญ 4 เหตุการณ์',
    'ศิลปะ ทดลองผสมสีแดงกับสีน้ำเงินและสังเกตสีใหม่',
    'วิทยาศาสตร์ แสดงวัฏจักรน้ำด้วยภาพเคลื่อนไหวอย่างง่าย'
  ];
  for (const content of topics) assert.equal(estimateV2Complexity([{ role: 'teacher', content }]).allowed, true, content);
});

test('Media V2 identifies scope, interaction, asset and runtime-budget overages', () => {
  const estimate = estimateV2Complexity([{ role: 'teacher', content: 'Make 4 scenes with a 3D simulation slider, quiz, drag and drop, timer, images, audio, video, and load a CDN.' }]);
  assert.equal(estimate.allowed, false);
  assert.ok(estimate.violations.some(item => item.code === 'too_many_scenes'));
  assert.ok(estimate.violations.some(item => item.code === 'too_many_mechanics'));
  assert.ok(estimate.violations.some(item => item.code === 'external_dependency'));
  assert.ok(estimate.suggestions.length > 0);
  assert.ok(estimate.metrics.estimated_output_tokens > 0);
});

test('Media V2 classifies every required build failure category', () => {
  const cases = [
    [{ code: 'ai_provider_error' }, null, 'provider_error'],
    [{ code: 'ai_timeout' }, null, 'timeout'],
    [{ code: 'ai_rate_limit' }, null, 'rate_limit'],
    [{ finishReason: 'length' }, null, 'output_truncated'],
    [{ code: 'v2_output_not_single_json' }, null, 'invalid_response_schema'],
    [{}, { ok: false, error_categories: ['invalid_html'] }, 'invalid_html'],
    [{}, { ok: false, error_categories: ['javascript_error'] }, 'javascript_error'],
    [{ code: 'runtime_error' }, null, 'runtime_error'],
    [{ code: 'complexity_exceeded' }, null, 'complexity_exceeded'],
    [{ code: 'unexpected' }, null, 'unknown_error']
  ];
  for (const [error, validation, expected] of cases) assert.equal(classifyBuildError(error, validation), expected);
});

test('Media V2 retry delays are bounded exponential backoff', () => {
  assert.equal(retryDelay(0), config.retryPolicy.initialBackoffMs);
  assert.equal(retryDelay(1), config.retryPolicy.initialBackoffMs * 2);
  assert.equal(retryDelay(10), config.retryPolicy.maxBackoffMs);
});

test('Media V2 validator enforces inline JavaScript, external-resource and persistence rules', async () => {
  const media = await import('../api/_lib/media-lab-v2.mjs');
  const valid = '<!doctype html><html><head><title>ทดสอบ</title><style>:focus-visible{outline:2px solid}</style></head><body><button>เริ่ม</button><script>document.querySelector(\"button\").addEventListener(\"click\",()=>{});</script></body></html>';
  assert.equal(media.validateV2Html(valid).ok, true);

  const syntax = media.validateV2Html('<!doctype html><html><head><title>x</title></head><body><script>let = ;</script></body></html>');
  assert.equal(syntax.ok, false);
  assert.ok(syntax.error_categories.includes('javascript_error'));

  const external = media.validateV2Html('<!doctype html><html><head><title>x</title></head><body><img src=\"https://example.test/a.png\"></body></html>');
  assert.ok(external.error_categories.includes('invalid_html'));

  const persistent = media.validateV2Html('<!doctype html><html><head><title>x</title></head><body><script>localStorage.setItem(\"x\",\"y\")</script></body></html>');
  assert.ok(persistent.error_categories.includes('invalid_html'));
});

test('Media V2 keeps teacher-selected direction and compact rebuild guidance in the correct prompt', async () => {
  const media = await import('../api/_lib/media-lab-v2.mjs');
  const brief = { selected_direction: 'ทดลองแรงเสียดทานด้วยแถบเลื่อนหนึ่งตัว' };
  const prompt = media.buildV2ArtifactPrompt('', [{ role: 'teacher', content: 'ป.5' }], brief, { compact: true });
  assert.match(prompt, /Confirmed teacher-selected direction/);
  assert.match(prompt, /one primary screen and one core interaction/);
  assert.match(prompt, /ป\.5/);
  assert.match(media.V2_PLANNER_RULES, /\[ทางเลือก\]idea text\[\/ทางเลือก\]/);
  const conversation = media.buildV2ChatPrompt('', [{ role: 'assistant', content: 'คำตอบปกติ\n[ทางเลือก]ไอเดียสำรอง[/ทางเลือก]' }]);
  assert.doesNotMatch(conversation, /ไอเดียสำรอง/);
});

test('Media V2 parser retains supported HTML and fenced JSON normalization while enforcing its schema', async () => {
  const media = await import('../api/_lib/media-lab-v2.mjs');
  assert.equal(media.parseV2Artifact('<!doctype html><html><head><title>Legacy</title></head><body></body></html>').title, 'Legacy');
  const fence = String.fromCharCode(96).repeat(3);
  assert.equal(media.parseV2Artifact(fence + 'json\n{"title":"OK","summary":"สรุป","html":"<!doctype html>"}\n' + fence).title, 'OK');
  assert.throws(() => media.parseV2Artifact('{"title":"OK","summary":"x","html":"<html></html>","css":"body{}"}'), /unapproved_fields/);
});
