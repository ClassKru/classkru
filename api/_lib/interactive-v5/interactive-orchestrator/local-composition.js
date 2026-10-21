'use strict';

const path = require('node:path');
const { createConversationService } = require('../conversation-ai/service');
const { createPromptArchitectService } = require('../prompt-architect-ai/service');
const { createOpenRouterProvider: conversationOpenRouter } = require('../conversation-ai/openrouter-provider');
const { createOpenRouterProvider: architectOpenRouter } = require('../prompt-architect-ai/openrouter-provider');
const { createOpenRouterProvider: builderOpenRouter } = require('../html-media-builder-ai/openrouter-provider');
const { fromEnvironment: conversationConfig } = require('../conversation-ai/config');
const { fromEnvironment: architectConfig } = require('../prompt-architect-ai/config');
const { fromEnvironment: builderConfig } = require('../html-media-builder-ai/config');
const { createLocalFileWorkflowStore } = require('./file-store');
const { createLocalFileArtifactStore } = require('../html-media-builder-ai/file-artifact-store');
const { createRuntimePreviewService } = require('../html-media-builder-ai/runtime-preview');
const { createInteractiveWorkflow } = require('./workflow');
const { createBackgroundJobRunner } = require('./job-runner');
const { createMockTeacherContextProviderFromEnvironment } = require('../teacher-context/mock-provider');
const { createBriefVersions } = require('./local-brief-versions');
const { createLocalModelSettings, withSelectedModel } = require('./local-model-settings');

function createLocalComposition({ root, mode = process.env.INTERACTIVE_V5_LOCAL_MODE || 'mock', env = process.env } = {}) {
  if (!root) throw new TypeError('local_root_required');
  if (!['mock', 'live'].includes(mode)) throw Object.assign(new Error('invalid_local_mode'), { code: 'invalid_local_mode' });
  const localRoot = path.join(root, '.interactive-v5-local');
  const store = createLocalFileWorkflowStore({ root: path.join(localRoot, 'workflow') });
  const artifactStore = createLocalFileArtifactStore({ root: path.join(localRoot, 'artifacts') });
  const runtime = createRuntimePreviewService({ artifactStore, runtimeBasePath: '/api/local/v5/runtime' });
  const v2OpenRouterKey = mode === 'live' ? String(env.OPENROUTER_MEDIA_PLANNER_API_KEY || env.OPENROUTER_API_KEY || '') : '';
  const withLocalV2KeyFallback = serviceConfig => Object.freeze({
    ...serviceConfig,
    apiKey: serviceConfig.apiKey || v2OpenRouterKey
  });
  const config = mode === 'live' ? null : Object.freeze({ apiKey: 'local-mock', modelId: 'local/mock-luna-6-pro', maxTokens: 14000, temperature: 0.2, timeoutMs: 150000, maxHistoryTurns: 16, maxSuggestedActions: 3, maxRetries: 0, maxHtmlCharacters: 45000 });
  const liveConversationConfig = mode === 'live' ? withLocalV2KeyFallback(conversationConfig(env)) : null;
  const liveArchitectConfig = mode === 'live' ? withLocalV2KeyFallback(architectConfig(env)) : null;
  const liveBuilderConfig = mode === 'live' ? withLocalV2KeyFallback(builderConfig(env)) : null;
  const modelSettings = createLocalModelSettings({ root:localRoot, defaults:{ conversation:conversationConfig(env).modelId, architect:architectConfig(env).modelId, builder:builderConfig(env).modelId } });

  const briefVersions = createBriefVersions({ root, localRoot });

  const conversationProvider = mode === 'live' ? conversationOpenRouter() : { respond: async () => ({ data: mockConversation(), usage: null, finishReason: 'mock' }) };
  const architectProvider = mode === 'live' ? architectOpenRouter() : { respond: async ({ request }) => {
    const brief = JSON.parse(request.messages[0].content.split('\n').slice(1).join('\n'));
    return { data: mockSpecification(brief), usage: null, finishReason: 'mock' };
  } };
  const builderProvider = mode === 'live' ? builderOpenRouter() : { respond: async () => ({ data: mockArtifact(), usage: null, finishReason: 'mock' }) };

  const conversation = createConversationService({ buildRequest: briefVersions.builder('conversation'), config: config || liveConversationConfig, provider: withSelectedModel(conversationProvider, modelSettings, 'conversation', env) });
  const architect = createPromptArchitectService({ buildRequest: briefVersions.builder('architect'), config: config || liveArchitectConfig, provider: withSelectedModel(architectProvider, modelSettings, 'architect', env) });
  let builderClient = null;
  const getBuilderClient = () => {
    if (!builderClient) {
      const { createHtmlMediaBuilderService } = require('../html-media-builder-ai/service');
      builderClient = createHtmlMediaBuilderService({ buildRequest: briefVersions.builder('builder'), config: config || liveBuilderConfig, artifactStore, runtimePreview: runtime, provider: withSelectedModel(builderProvider, modelSettings, 'builder', env) });
    }
    return builderClient;
  };
  const builder = Object.freeze({
    build: request => getBuilderClient().build(request),
    async deleteArtifacts({ artifactIds = [] } = {}) {
      const ids = [...new Set(artifactIds.filter(id => typeof id === 'string' && id))];
      if (typeof artifactStore.deleteValidatedMany === 'function') return artifactStore.deleteValidatedMany(ids);
      const deleted = [];
      for (const id of ids) if (await artifactStore.deleteValidated(id)) deleted.push(id);
      return deleted;
    }
  });
  const workflow = createInteractiveWorkflow({ conversationClient: conversation, architectClient: architect, builderClient: builder, runtimeClient: runtime, store, usageMode: mode });
  const worker = createBackgroundJobRunner({
    workflow,
    listJobs:store.listJobs,
    onError(error, jobId) {
      const code = typeof error?.code === 'string' && /^[a-z0-9_]+$/.test(error.code) ? error.code : 'background_job_error';
      console.error(`Background V5 job ${jobId} stopped (${code}).`);
    }
  });
  return Object.freeze({ mode, modelSettings, briefVersions, teacherContextProvider:createMockTeacherContextProviderFromEnvironment(env), workflow, worker });
}

function mockConversation() {
  return {
    reply: 'ลองให้นักเรียนปรับอุณหภูมิแล้วสังเกตสถานะของน้ำครับ แต่ละช่วงเปลี่ยนเป็นของแข็ง ของเหลว หรือแก๊สอย่างไร',
    suggested_actions: ['เพิ่มคำถามให้ทำนายก่อนทดลอง', 'ปรับให้เหมาะกับชั้นเรียนของฉัน'],
    brief: { topic: 'การเปลี่ยนสถานะของน้ำ', learning_objectives: ['อธิบายการเปลี่ยนสถานะของน้ำได้'], learner_level: 'ประถมศึกษาปีที่ 4', media_type: 'simulation', media_type_requirement: 'preferred', learner_action: 'ปรับอุณหภูมิและสังเกตผล', interaction_preference: 'required', constraints: ['ใช้ภาษาไทย'], assumptions: ['ใช้เป็นสื่อสั้นบนจอหน้าชั้น'] }
  };
}

function mockSpecification(brief) {
  return {
    schema_version: '1.1', brief_ref: { brief_id: brief.brief_id, revision: brief.revision },
    media: { title: 'สำรวจสถานะของน้ำ', format: 'single-page-html', presentation_type: 'simulation', rendering_strategy: 'html-css-svg-js', presentation_strategy: 'ตัวเลื่อนอุณหภูมิคู่กับภาพสถานะและคำอธิบายที่เปลี่ยนตามค่า', design_rationale: 'การปรับตัวแปรและเห็นผลทันทีช่วยให้ผู้เรียนเชื่อมอุณหภูมิกับการเปลี่ยนสถานะของน้ำ' },
    learning_design: { intent: 'เข้าใจผลของอุณหภูมิต่อสถานะของน้ำ', objective_alignment: brief.learning.objectives, learner_experience: ['ทำนายสถานะ', 'ปรับอุณหภูมิ', 'สังเกตการเปลี่ยนแปลง'], academic_rules: ['แสดงสถานะของน้ำสามรูปแบบ', 'หลีกเลี่ยงการเพิ่มข้อเท็จจริงที่ไม่มีใน Brief'] },
    interaction: { requirement: 'required', primary_action: brief.media_intent.learner_action, media_response: 'ภาพสถานะและคำอธิบายเปลี่ยนทันทีตามตำแหน่งตัวเลื่อน', states: ['เริ่มต้น', 'กำลังสำรวจ'], feedback_rules: ['อธิบายสถานะที่แสดง', 'เริ่มทดลองใหม่ได้'] },
    content: { key_concepts: ['ของแข็ง', 'ของเหลว', 'แก๊ส'], teacher_review_required: [] },
    ui: { components: ['ตัวเลื่อนอุณหภูมิ', 'ภาพสถานะ', 'คำอธิบาย', 'ปุ่มเริ่มใหม่'], responsive_viewports: ['390x844', '1280x720'], accessibility_requirements: ['ควบคุมด้วยแป้นพิมพ์ได้', 'แสดง feedback ด้วยข้อความ'] },
    html_requirements: { single_page: true, document_structure: ['doctype', 'html', 'head', 'title', 'body'], max_html_characters: 30000 },
    runtime_requirements: { network: 'deny', persistent_storage: 'deny', external_dependencies: 'deny', allowed_browser_apis: [] },
    acceptance_criteria: ['การปรับตัวเลื่อนเปลี่ยนสถานะและคำอธิบาย', 'มีปุ่มเริ่มใหม่ที่ทำงาน', 'ทำงานได้บนมือถือและ desktop', 'ไม่มี network request']
  };
}

function mockArtifact() {
  return {
    title: 'สำรวจสถานะของน้ำ', summary: 'ปรับอุณหภูมิและสังเกตการเปลี่ยนแปลงของน้ำ',
    html: '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>สำรวจสถานะของน้ำ</title><style>*{box-sizing:border-box}body{margin:0;padding:clamp(20px,5vw,48px);font:18px system-ui,sans-serif;color:#17233e;background:linear-gradient(135deg,#eff7ff,#f5f1ff)}main{max-width:720px;margin:auto;padding:28px;border-radius:22px;background:#fff;box-shadow:0 12px 36px #21365a18}h1{font-size:clamp(1.5rem,4vw,2rem)}label{display:block;margin:24px 0 12px;font-weight:700}input{width:100%;accent-color:#2867ee}.state{padding:24px;border-radius:16px;background:#f2f7ff;text-align:center;font-size:1.35rem;font-weight:800}button{min-height:44px;padding:0 18px;border:0;border-radius:11px;background:#2867ee;color:white;font:inherit;font-weight:700;cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #7ba2ff;outline-offset:3px}</style></head><body><main><h1>สถานะของน้ำเปลี่ยนไปอย่างไร?</h1><p>ลองเลื่อนอุณหภูมิ แล้วสังเกตสถานะของน้ำ</p><label for="temperature">อุณหภูมิ: <output id="amount">0</output></label><input id="temperature" type="range" min="0" max="100" value="0"><p id="state" class="state" aria-live="polite">ของแข็ง · ลองเพิ่มอุณหภูมิ</p><button id="restart" type="button">เริ่มใหม่</button></main><script>const input=document.querySelector("#temperature"),amount=document.querySelector("#amount"),state=document.querySelector("#state");function update(){amount.value=input.value;state.textContent=input.value>66?"แก๊ส · อนุภาคเคลื่อนที่อิสระ":input.value>33?"ของเหลว · น้ำไหลและเปลี่ยนรูปตามภาชนะ":"ของแข็ง · น้ำคงรูปร่าง"}input.addEventListener("input",update);document.querySelector("#restart").addEventListener("click",()=>{input.value=0;update()});update();</script></body></html>'
  };
}

module.exports = { createLocalComposition };


