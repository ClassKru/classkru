'use strict';

const { sendJson, parseBody, requestOriginIsValid } = require('../_lib/http');
const { getAiQuota, consumeAiQuota, releaseAiQuota } = require('../_lib/ai-quota');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dzntiiuyqvkaxqpqzxeh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_SePLBF-dsJfx5T6Yvvcuew_vntSr3Vc';

function clean(value, max = 1200) { return String(value || '').trim().slice(0, max); }
function asList(value, maxItems = 12) { return (Array.isArray(value) ? value : []).map(item => clean(item, 800)).filter(Boolean).slice(0, maxItems); }
function asActivityStages(value) {
  return (Array.isArray(value) ? value : []).slice(0, 16).filter(item => item && typeof item === 'object' && !Array.isArray(item)).map((item, index) => ({
    title: clean(item?.title, 180) || `ขั้นที่ ${index + 1}`,
    durationMinutes: Number.isInteger(Number(item?.durationMinutes)) ? Number(item.durationMinutes) : 0,
    teacherActions: clean(item?.teacherActions, 1600),
    learnerActions: clean(item?.learnerActions, 1600),
    materials: clean(item?.materials, 800),
    assessmentEvidence: clean(item?.assessmentEvidence, 1000)
  })).filter(item => item.title || item.teacherActions || item.learnerActions);
}
function asParagraph(value, legacyValues) {
  const text = clean(value, 2400);
  if (text) return text;
  return asList(legacyValues, 8).join(' ');
}
function legacyDurationMinutes(value) {
  const text = clean(value, 120);
  const minutes = text.match(/(\d{1,3})\s*นาที/u);
  if (minutes) return Number(minutes[1]);
  const periods = text.match(/(\d{1,2})\s*คาบ/u);
  return periods ? Number(periods[1]) * 50 : NaN;
}
function parsePlan(text) {
  const stripped = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(stripped);
}
async function authenticatedUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  return response.json();
}
function normalizePlan(value) {
  const plan = value && typeof value === 'object' ? value : {};
  const assessmentMatrix = (Array.isArray(plan.assessmentMatrix) ? plan.assessmentMatrix : []).slice(0, 12).map(item => ({
    domain: clean(item?.domain, 240),
    target: clean(item?.target, 500),
    instrument: clean(item?.instrument, 500),
    criterion: clean(item?.criterion, 500)
  })).filter(item => item.domain || item.target || item.instrument || item.criterion);
  return {
    title: clean(plan.title, 240),
    unitObjective: clean(plan.unitObjective, 1200),
    keyEssence: asParagraph(plan.keyEssence, plan.keyConcepts),
    keyConcepts: asList(plan.keyConcepts),
    objectives: asList(plan.objectives),
    contentKnowledge: asList(plan.contentKnowledge),
    contentSkills: asList(plan.contentSkills),
    competencies: asList(plan.competencies),
    desirableCharacteristics: asList(plan.desirableCharacteristics),
    skills21: asList(plan.skills21),
    workProducts: asList(plan.workProducts),
    activityStages: asActivityStages(plan.activityStages),
    activities: asList(plan.activities, 16),
    resources: asList(plan.resources),
    assessment: asList(plan.assessment, 12),
    assessmentMatrix,
    evidence: asList(plan.evidence, 12),
    suggestedActivities: asList(plan.suggestedActivities, 10),
    adaptations: asList(plan.adaptations, 10)
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    if (!requestOriginIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });
    try {
      const user = await authenticatedUser(req);
      if (!user?.id) return sendJson(res, 401, { error: 'authentication_required', message: 'กรุณาเข้าสู่ระบบใหม่ก่อนใช้งาน AI' });
      return sendJson(res, 200, { quota: await getAiQuota(user.id) });
    } catch (error) {
      const status = error.code === 'SUPABASE_NOT_CONFIGURED' ? 503 : error.code === 'DATABASE_REQUEST_FAILED' ? 502 : 500;
      return sendJson(res, status, { error: error.code || 'ai_quota_failed', message: 'ยังตรวจสอบโควตา AI ไม่ได้' });
    }
  }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
  if (!requestOriginIsValid(req)) return sendJson(res, 403, { error: 'invalid_origin' });
  if (!process.env.OPENROUTER_API_KEY) return sendJson(res, 503, { error: 'ai_not_configured', message: 'ยังไม่ได้ตั้งค่า OPENROUTER_API_KEY' });
  let reservedQuota = null;
  let teacherId = '';
  try {
    const user = await authenticatedUser(req);
    teacherId = user?.id || '';
    if (!user?.id) return sendJson(res, 401, { error: 'authentication_required', message: 'กรุณาเข้าสู่ระบบใหม่ก่อนใช้งาน AI' });
    const body = parseBody(req);
    const topic = clean(body.topic, 240);
    const indicators = Array.isArray(body.indicators) ? body.indicators.slice(0, 12).map(item => `${clean(item.code, 80)}: ${clean(item.text, 800)}`).filter(Boolean) : [];
    if (topic.length < 3 || !indicators.length) return sendJson(res, 400, { error: 'invalid_request', message: 'กรุณาระบุหัวข้อและตัวชี้วัดอย่างน้อย 1 ข้อ' });
    const hasExplicitDuration = body.durationMinutes !== undefined && body.durationMinutes !== null && body.durationMinutes !== '';
    const durationMinutes = hasExplicitDuration ? Number(body.durationMinutes) : legacyDurationMinutes(body.duration);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) return sendJson(res, 400, { error: 'invalid_duration', message: 'กรุณาระบุเวลาเรียนเป็นจำนวนนาทีตั้งแต่ 1 ถึง 600 นาที' });
    const isGuidance = body.subjectId === 'guidance';
    reservedQuota = await consumeAiQuota(user.id);
    const rules = 'กติกาคุณภาพ: ใช้เฉพาะตัวชี้วัดและบริบทที่ได้รับ ห้ามสร้างรหัสตัวชี้วัดหรือผลคะแนนขึ้นเอง กิจกรรมต้องทำได้จริงตามเวลาและทรัพยากรที่ระบุ ทุกการประเมินต้องบอกหลักฐานที่ครูเก็บได้ และต้องให้ครูตรวจสอบก่อนใช้' + (isGuidance ? '\nสำหรับกิจกรรมแนะแนว: ถือเป็นกิจกรรมพัฒนาผู้เรียน ไม่ใช่กลุ่มสาระวิชาหลัก เชื่อมกับด้านการศึกษา ด้านอาชีพ หรือด้านส่วนตัวและสังคมตามผลลัพธ์ที่ครูเลือก ออกแบบให้เหมาะกับวัย ให้ผู้เรียนมีส่วนร่วม สะท้อนคิด และเชื่อมโยงไปใช้ในชีวิตจริง ประเมินจากพฤติกรรมหรือชิ้นงานที่สังเกตได้ ห้ามวินิจฉัยสุขภาพจิตหรือบังคับเปิดเผยข้อมูลส่วนตัว/ครอบครัวที่อ่อนไหว' : '');
    const guidancePlanNote = isGuidance ? '\nกรอบอ้างอิงแผนกิจกรรมแนะแนว: เชื่อมสาระสำคัญ จุดประสงค์ที่สังเกตได้ สาระการเรียนรู้ ขั้นกิจกรรม สื่อ และการประเมินให้สอดคล้องกัน; ระบุสมรรถนะหรือคุณลักษณะที่มุ่งพัฒนาโดยไม่แต่งตัวชี้วัดใหม่; ให้ข้อเสนอแนะสำหรับครู และเว้นบันทึกหลังจัดกิจกรรมไว้ให้ครูบันทึกผลจริง ตัวอย่างจากเอกสาร พ.ศ. 2559 ใช้เป็นแบบรูปแบบ ไม่ใช่การยืนยันว่าเป็นมาตรฐานฉบับล่าสุด. แยกวัตถุประสงค์ชั้นปีและวัตถุประสงค์หน่วยไว้เป็นบริบทระดับหน่วย ไม่ให้นำมานับเป็นข้อ 1 ของแผนรายครั้ง; แผนรายครั้งให้เรียง 1 สาระสำคัญ 2 จุดประสงค์การเรียนรู้ที่สังเกตได้ 3 สาระการเรียนรู้ 4 วิธีดำเนินกิจกรรม 5 ชิ้นงาน/ภาระงาน 6 สื่อ/อุปกรณ์ 7 การวัดและประเมินผล. หากครูกรอกวัตถุประสงค์หน่วยมา ให้รักษาความหมายเดิม หากเว้นว่างจึงช่วยเสนอเป็นร่าง; ห้ามแต่งวัตถุประสงค์ชั้นปีขึ้นเอง' : '';
    const selectedStandards = Array.isArray(body.standards) ? body.standards.slice(0, 8).map(item => `${clean(item.code, 100)} ${clean(item.title, 800)}`).filter(Boolean) : [];
    const prompt = `คุณเป็นผู้ช่วยออกแบบการเรียนรู้สำหรับครูไทย จัดทำร่างแผนการจัดการเรียนรู้รายคาบฉบับใช้งานได้จริง โดยไม่อ้างว่าเป็นแผนทางการ

บริบท
- กลุ่มสาระ/กิจกรรมสำหรับค้นหลักสูตร: ${clean(body.subject, 160)}
- รายวิชาที่สอนจริง: ${clean(body.courseName, 180) || clean(body.subject, 160)}${clean(body.courseCode, 80) ? ` (${clean(body.courseCode, 80)})` : ''}
- ระดับชั้น: ${clean(body.grade, 80)}
- ภาคเรียน/ปีการศึกษา: ${clean(body.semester, 30) || 'ไม่ระบุ'} / ${clean(body.academicYear, 10) || 'ไม่ระบุ'}
- เลขแผน: ${clean(body.planNumber, 12) || '1'}
- ${isGuidance ? 'หน่วยการจัดกิจกรรม' : 'หน่วยการเรียนรู้'}: ${clean(body.unitNumber, 40)} ${clean(body.unitName, 200)}
- วัตถุประสงค์ชั้นปีจากครู/หลักสูตรสถานศึกษา: ${clean(body.yearObjective, 1200) || 'ไม่ได้ระบุ ห้ามแต่งเพิ่ม'}
- วัตถุประสงค์ภาพรวมของหน่วย: ${clean(body.unitObjective, 1200) || 'ครูยังไม่ได้ระบุ ให้ช่วยร่างจากหัวข้อและผลลัพธ์ที่เลือก'}
${isGuidance ? `- เวลาเรียนรวมของหน่วย: ${clean(body.unitHours, 12) ? `${clean(body.unitHours, 12)} ชั่วโมง` : 'ไม่ได้ระบุ'}` : ''}
- ห้องที่ใช้แผน: ${clean(Array.isArray(body.classSections) ? body.classSections.join(', ') : body.classSections, 240)}
- หัวข้อ: ${topic}
- เวลาเรียน: ${durationMinutes} นาที
- วิธีเรียนที่ต้องการ: ${clean(body.method, 100)}
- ชื่อผู้สอน: ${clean(body.teacherName, 160) || 'ไม่ระบุ'}
- ลักษณะผู้เรียน/ปัญหา: ${clean(body.learnerContext, 1600) || 'ไม่ระบุ'}
- อุปกรณ์และข้อจำกัด: ${clean(body.resourceContext, 1000) || 'ไม่ระบุ'}
- สิ่งที่ครูอยากเน้น: ${clean(body.focus, 1000) || 'ไม่ระบุ'}

มาตรฐานการเรียนรู้ที่เลือกจากคลัง (ยึดข้อความนี้ ห้ามสร้างเพิ่ม):
${selectedStandards.length ? selectedStandards.map(item => `- ${item}`).join('\n') : '- ยังไม่มีข้อมูลมาตรฐานจากคลัง'}
${clean(body.standardOverride, 1200) ? `ข้อความมาตรฐานที่ครูแก้ไขเพิ่มเติม:\n${clean(body.standardOverride, 1200)}` : ''}

ตัวชี้วัดที่ ClassKru เลือกไว้:
${indicators.map(item => `- ${item}`).join('\n')}
${guidancePlanNote}

ตอบกลับเป็น JSON ล้วนตาม schema นี้ ห้ามมี markdown:
- keyEssence ต้องเป็นย่อหน้าอธิบายแนวคิดหลัก ความสัมพันธ์ของสาระ และความสำคัญต่อหัวข้อ เขียนเป็นประโยคต่อเนื่องชัดเจน ไม่ส่งเป็นรายการคำหรือวลี
- activityStages ต้องแบ่งเป็นช่วงกิจกรรมที่ครูนำไปใช้สอนได้จริง ทุกช่วงระบุเวลาและรายละเอียดแยกบทบาทครูกับผู้เรียน ใช้กริยาที่สังเกตได้ บอกคำถาม/คำชี้แจงหรือสิ่งที่ครูจัดเตรียมตามจำเป็น และระบุหลักฐานที่ใช้ตรวจความเข้าใจ หลีกเลี่ยงคำกว้าง ๆ เช่น “ทำกิจกรรม” โดยไม่บอกวิธีทำ
- แบ่งกิจกรรมยาวเป็นช่วงย่อยอย่างเหมาะสม โดยเฉพาะแผนที่ยาวเกิน 1 ชั่วโมง ไม่รวมการบรรยายหรือกิจกรรมต่อเนื่องยาวไว้ในขั้นเดียว หากช่วงใดเกิน 45 นาทีให้แบ่งเป็นช่วงย่อย เว้นแต่มีเหตุผลทางการสอนที่ชัดเจน
- เวลาในทุกช่วงต้องเป็นจำนวนนาทีบวกกันได้เท่ากับ ${durationMinutes} นาทีพอดี และเรียงจากขั้นนำ/กระตุ้นความรู้เดิม ไปสู่การเรียนรู้และฝึกใช้ แล้วสรุป/สะท้อนคิดตามความเหมาะสมกับหัวข้อและเวลา
- เนื้อหา กิจกรรม ชิ้นงาน และการประเมินต้องสอดคล้องกับจุดประสงค์และตัวชี้วัด ห้ามรับประกันผลร้อยละ 100 หรือแต่งข้อมูลหลักสูตร
{"plan":{"title":"ชื่อหัวข้อ ไม่ต้องใส่เลขแผน","unitObjective":"วัตถุประสงค์ภาพรวมของหน่วยกิจกรรม แยกจากเป้าหมายรายคาบ","keyEssence":"ย่อหน้าอธิบายแนวคิดหลัก ความสัมพันธ์ของสาระ และความสำคัญของหัวข้อ","objectives":["จุดประสงค์รายคาบที่สังเกตและประเมินได้"],"contentKnowledge":["สาระการเรียนรู้ด้านความรู้"],"contentSkills":["สาระการเรียนรู้ด้านทักษะ/กระบวนการ"],"competencies":["สมรรถนะสำคัญ"],"desirableCharacteristics":["คุณลักษณะอันพึงประสงค์"],"skills21":["ทักษะในศตวรรษที่ 21"],"workProducts":["ชิ้นงาน/ภาระงาน"],"activityStages":[{"title":"ขั้นนำ: กระตุ้นความรู้เดิม","durationMinutes":5,"teacherActions":"ครูแสดง... ตั้งคำถาม... และรับฟังคำตอบ...","learnerActions":"ผู้เรียนสังเกต... แลกเปลี่ยนคำตอบ...","materials":"ภาพ/อุปกรณ์ที่ใช้ หรือ ไม่ใช้","assessmentEvidence":"คำตอบหรือข้อสังเกตที่ครูใช้ตรวจความเข้าใจ"}],"resources":["..."],"assessmentMatrix":[{"domain":"สิ่งที่ประเมิน","target":"พฤติกรรมหรือผลงาน","instrument":"วิธี/เครื่องมือ","criterion":"เกณฑ์ผ่านที่ตรวจสอบได้"}],"assessment":["รายละเอียดเสริมการประเมิน"],"evidence":["หลักฐานที่เก็บ"],"suggestedActivities":["กิจกรรมเสนอแนะ"],"adaptations":["ข้อเสนอแนะสำหรับครู"]},"warnings":["ข้อมูลที่ครูควรตรวจสอบ"]}`;
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': process.env.APP_URL || 'https://classkru-kohl.vercel.app', 'X-Title': 'ClassKru' },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({ model: process.env.OPENROUTER_MODEL || 'qwen/qwen3-30b-a3b-instruct-2507', temperature: 0.25, max_tokens: 6800, messages: [{ role:'system', content:rules }, { role:'user', content:prompt }] })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const quota = await releaseAiQuota(user.id, reservedQuota.date).catch(error => { console.error('AI quota release failed:', error); return reservedQuota; });
      reservedQuota = null;
      return sendJson(res, 502, { error: 'generation_failed', message: 'AI ยังสร้างแผนการสอนไม่ได้ กรุณาลองใหม่อีกครั้ง', quota });
    }
    let raw;
    try { raw = parsePlan(payload?.choices?.[0]?.message?.content); } catch (_) {
      const quota = await releaseAiQuota(user.id, reservedQuota.date).catch(error => { console.error('AI quota release failed:', error); return reservedQuota; });
      reservedQuota = null;
      return sendJson(res, 502, { error: 'invalid_ai_response', message: 'AI ส่งรูปแบบแผนไม่ถูกต้อง กรุณาลองใหม่', quota });
    }
    const plan = normalizePlan(raw?.plan || raw);
    const missing = ['title', 'objectives'].filter(field => field === 'title' ? !plan.title : !plan[field].length);
    if (!plan.keyEssence) missing.push('keyEssence');
    if (!plan.activityStages.length && !plan.activities.length) missing.push('activityStages');
    if (isGuidance) {
      if (!plan.contentKnowledge.length && !plan.contentSkills.length) missing.push('content');
      if (!plan.workProducts.length) missing.push('workProducts');
      if (!plan.resources.length) missing.push('resources');
      if (!plan.assessmentMatrix.length && !plan.assessment.length) missing.push('assessment');
    }
    if (missing.length) {
      const quota = await releaseAiQuota(user.id, reservedQuota.date).catch(error => { console.error('AI quota release failed:', error); return reservedQuota; });
      reservedQuota = null;
      return sendJson(res, 502, { error: 'empty_ai_response', message: isGuidance ? 'ร่างแผนแนะแนวยังขาดหัวข้อหลักบางส่วน กรุณาลองสร้างใหม่' : 'AI ยังสร้างแผนที่มีข้อมูลไม่ครบ กรุณาลองใหม่', missing, quota });
    }
    const warnings = asList(raw?.warnings, 8);
    if (plan.activityStages.length) {
      const activityMinutes = plan.activityStages.reduce((sum, item) => sum + item.durationMinutes, 0);
      if (plan.activityStages.some(item => item.durationMinutes < 1)) warnings.push('บางขั้นยังไม่ระบุเวลาเป็นนาที กรุณาตรวจและปรับก่อนใช้');
      if (plan.activityStages.some(item => !item.teacherActions || !item.learnerActions)) warnings.push('บางขั้นยังระบุบทบาทครูหรือผู้เรียนไม่ครบ กรุณาตรวจรายละเอียดกิจกรรม');
      if (activityMinutes !== durationMinutes) warnings.push(`เวลาของกิจกรรมรวม ${activityMinutes} นาที ไม่ตรงกับเวลาแผน ${durationMinutes} นาที กรุณาปรับก่อนใช้`);
    } else if (plan.activities.length) {
      warnings.push('กิจกรรมที่ AI ส่งกลับยังไม่อยู่ในรูปแบบแยกขั้นและบทบาท กรุณาตรวจรายละเอียดก่อนใช้');
    }
    const quota = reservedQuota;
    reservedQuota = null;
    return sendJson(res, 200, { plan, warnings: [...new Set(warnings)].slice(0, 10), quota });
  } catch (error) {
    if (reservedQuota && teacherId) await releaseAiQuota(teacherId, reservedQuota.date).catch(releaseError => console.error('AI quota release failed:', releaseError));
    if (error.code !== 'AI_DAILY_LIMIT_REACHED') console.error('Lesson plan generation error:', error);
    const status = error.code === 'AI_DAILY_LIMIT_REACHED' ? 429 : error.code === 'SUPABASE_NOT_CONFIGURED' ? 503 : error.code === 'DATABASE_REQUEST_FAILED' ? 502 : error.name === 'TimeoutError' || error.name === 'AbortError' ? 504 : 500;
    const message = error.code === 'AI_DAILY_LIMIT_REACHED' ? 'วันนี้ใช้โควตาการสร้างข้อสอบ/ใบงาน/แผนการสอนครบแล้ว กรุณาลองใหม่พรุ่งนี้' : error.code === 'SUPABASE_NOT_CONFIGURED' ? 'ระบบโควตา AI ยังไม่พร้อมใช้งาน' : error.name === 'TimeoutError' || error.name === 'AbortError' ? 'AI ใช้เวลาสร้างแผนนานเกินไป กรุณาลองอีกครั้ง' : 'เกิดข้อผิดพลาดขณะสร้างแผนการสอน';
    return sendJson(res, status, { error: error.code || 'server_error', message, ...(error.quota ? { quota: error.quota } : {}) });
  }
};
