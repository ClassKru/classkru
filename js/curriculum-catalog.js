/**
 * ClassKru curriculum browser registry.
 * This module is read-only: it never writes curriculum choices into classroom scores.
 */
(function () {
  'use strict';

  const datasets = {
    thai: window.CK_CURRICULUM_THAI_2551 || null,
    math: window.CK_CURRICULUM_MATH_2560 || null,
    science: window.CK_CURRICULUM_SCIENCE_2560 || null,
    physics: null, chemistry: null, biology: null,
    social: window.CK_CURRICULUM_SOCIAL_2560 || null,
    health: window.CK_CURRICULUM_HEALTH_2551 || null,
    art: window.CK_CURRICULUM_ART_2551 || null,
    career: window.CK_CURRICULUM_CAREER_2551 || null,
    guidance: window.CK_CURRICULUM_GUIDANCE_2559 || null,
    foreign: window.CK_CURRICULUM_FOREIGN_2551 || null
  };
  const gradeOrder = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M4_6'];
  let hydrationPromise = null;
  let hydrated = false;
  function inferGrades(dataset) {
    if (!dataset) return ['M1', 'M2', 'M3'];
    const used = new Set(dataset.indicators.map(item => item.grade).filter(Boolean));
    return gradeOrder.filter(grade => used.has(grade));
  }
  const subjects = [
    { id: 'thai', code: 'ท', name: 'ภาษาไทย', shortName: 'ภาษาไทย' },
    { id: 'math', code: 'ค', name: 'คณิตศาสตร์', shortName: 'คณิตศาสตร์' },
    { id: 'science', code: 'ว', name: 'วิทยาศาสตร์และเทคโนโลยี', shortName: 'วิทยาศาสตร์' },
    { id: 'physics', code: 'ฟ', name: 'ฟิสิกส์เพิ่มเติม', shortName: 'ฟิสิกส์', scoreCompatible: false },
    { id: 'chemistry', code: 'ค', name: 'เคมีเพิ่มเติม', shortName: 'เคมี', scoreCompatible: false },
    { id: 'biology', code: 'ช', name: 'ชีววิทยาเพิ่มเติม', shortName: 'ชีววิทยา', scoreCompatible: false },
    { id: 'social', code: 'ส', name: 'สังคมศึกษา ศาสนา และวัฒนธรรม', shortName: 'สังคมศึกษา' },
    { id: 'health', code: 'พ', name: 'สุขศึกษาและพลศึกษา', shortName: 'สุขศึกษา' },
    { id: 'art', code: 'ศ', name: 'ศิลปะ', shortName: 'ศิลปะ' },
    { id: 'career', code: 'ง', name: 'การงานอาชีพ', shortName: 'การงานอาชีพ' },
    { id: 'guidance', code: 'น', name: 'กิจกรรมแนะแนว', shortName: 'แนะแนว' },
    { id: 'foreign', code: 'ต', name: 'ภาษาต่างประเทศ', shortName: 'ภาษาอังกฤษ' }
  ].map(subject => ({
    ...subject,
    available: !!datasets[subject.id],
    scoreCompatible: subject.scoreCompatible ?? (datasets[subject.id]?.scoreCompatible !== false),
    grades: subject.grades || datasets[subject.id]?.grades || inferGrades(datasets[subject.id]),
    dataset: datasets[subject.id]
  }));

  function normalize(value) {
    return String(value || '')
      .toLocaleLowerCase('th-TH')
      .replace(/[().,/_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getSubject(subjectId) {
    return subjects.find(subject => subject.id === subjectId) || subjects[0];
  }

  function getGrades(subjectId) {
    return getSubject(subjectId).grades || [];
  }

  function getUnits(subjectId, grade) {
    const dataset = getSubject(subjectId).dataset;
    if (!dataset) return [];
    return dataset.units
      .filter(unit => !grade || unit.grade === grade || unit.grade === 'ALL')
      .map(unit => ({
        ...unit,
        indicatorCount: dataset.indicators.filter(item => (!grade || item.grade === grade || item.grade === 'ALL') && item.unitId === unit.id).length
      }));
  }

  function getStandards(subjectId, grade) {
    const dataset = getSubject(subjectId).dataset;
    if (!dataset) return [];
    const used = new Set(dataset.indicators.filter(item => !grade || item.grade === grade || item.grade === 'ALL').map(item => item.standard));
    return dataset.standards.filter(standard => used.has(standard.id));
  }

  function search(options) {
    const subject = getSubject(options?.subjectId);
    const dataset = subject.dataset;
    if (!dataset) return [];
    const grade = options?.grade || null;
    const unitId = options?.unitId || 'all';
    const standardId = options?.standardId || 'all';
    const terms = normalize(options?.query).split(' ').filter(Boolean);
    const unitMap = new Map(dataset.units.map(unit => [unit.id, unit]));
    const standardMap = new Map(dataset.standards.map(standard => [standard.id, standard]));

    return dataset.indicators.filter(item => {
      if (grade && item.grade !== grade && item.grade !== 'ALL') return false;
      if (unitId !== 'all' && item.unitId !== unitId) return false;
      if (standardId !== 'all' && item.standard !== standardId) return false;
      if (!terms.length) return true;
      const unit = unitMap.get(item.unitId);
      const standard = standardMap.get(item.standard);
      const haystack = normalize([
        item.code, item.text, unit?.title, unit?.description,
        standard?.code, standard?.title, standard?.strand
      ].join(' '));
      return terms.every(term => haystack.includes(term));
    });
  }

  function getUnit(subjectId, unitId) {
    return getSubject(subjectId).dataset?.units.find(unit => unit.id === unitId) || null;
  }

  function getStandard(subjectId, standardId) {
    return getSubject(subjectId).dataset?.standards.find(standard => standard.id === standardId) || null;
  }

  function getReference(subjectId) {
    return getSubject(subjectId).dataset?.reference || null;
  }

  function getStats() {
    return subjects.reduce((summary, subject) => {
      const count = subject.dataset?.indicators.length || 0;
      summary.subjects += 1;
      summary.availableSubjects += subject.available ? 1 : 0;
      summary.indicators += count;
      return summary;
    }, { subjects: 0, availableSubjects: 0, indicators: 0 });
  }

  // Additional science is a separate source; its numeric labels are not national indicator codes.
  let additionalScienceHydrated = false;
  async function loadAdditionalScience(client) {
    if (additionalScienceHydrated) return true;
    const sourceId = 'TH-SCI-ADDITIONAL-2560';
    const [sourceResult, standardResult, unitResult, outcomeResult] = await Promise.all([
      client.from('curriculum_sources').select('*').eq('source_id', sourceId).maybeSingle(),
      client.from('curriculum_standards').select('*').eq('source_id', sourceId),
      client.from('curriculum_units').select('*').eq('source_id', sourceId),
      client.from('curriculum_outcomes').select('*').eq('source_id', sourceId)
    ]);
    if ([sourceResult, standardResult, unitResult, outcomeResult].some(result => result.error)) return false;
    const source = sourceResult.data;
    if (!source || source.status !== 'reviewed' || !Array.isArray(outcomeResult.data)) return false;
    const subjectIds = ['physics', 'chemistry', 'biology'];
    for (const id of subjectIds) {
      const subject = subjects.find(item => item.id === id);
      const outcomes = outcomeResult.data.filter(row => row.subject_id === id);
      const standards = (standardResult.data || []).filter(row => row.subject_id === id);
      const units = (unitResult.data || []).filter(row => row.subject_id === id);
      if (!subject || !outcomes.length || outcomes.some(row => !row.outcome_text?.trim()) || !standards.length || !units.length) return false;
    }
    for (const id of subjectIds) {
      const subject = subjects.find(item => item.id === id);
      const outcomes = outcomeResult.data.filter(row => row.subject_id === id).sort((a, b) => String(a.standard_id).localeCompare(String(b.standard_id)) || String(a.grade).localeCompare(String(b.grade)) || String(a.outcome_id).localeCompare(String(b.outcome_id)));
      const dataset = {
        id, title:subject.name, scoreCompatible:false,
        source:{id:source.source_id,title:source.title,framework:source.framework,revisionYear:source.revision_year,publisher:source.publisher,fileName:source.file_name,status:source.status,notice:source.notice,url:(source.related_sources || []).find(item => item?.url)?.url || null,relatedSources:source.related_sources || []},
        standards:(standardResult.data || []).filter(row => row.subject_id === id).map(row => ({id:row.standard_id,code:row.code,title:row.title,strand:row.strand})),
        units:(unitResult.data || []).filter(row => row.subject_id === id).map(row => ({id:row.unit_id,grade:row.grade,title:row.title,description:row.description})),
        indicators:outcomes.map(row => ({id:row.outcome_id,code:row.code,standard:row.standard_id,grade:row.grade,unitId:row.unit_id,text:row.outcome_text,sourcePage:row.source_page,sourcePdfPage:row.source_pdf_page})),
        reference:null
      };
      datasets[id]=dataset; subject.dataset=dataset; subject.available=true; subject.grades=inferGrades(dataset);
      window.dispatchEvent(new CustomEvent('classkru:curriculum-catalog-updated',{detail:{subjectId:id}}));
    }
    additionalScienceHydrated = true;
    return true;
  }

  async function loadFromSupabase(client) {
    if (hydrated) return loadAdditionalScience(client).catch(() => false);
    if (!client?.from) return false;
    if (hydrationPromise) return hydrationPromise;
    hydrationPromise = (async () => {
      const scienceUpdated = await loadAdditionalScience(client).catch(() => false);
      const sourceId = 'TH-BEC-GUIDANCE-2559';
      const [sourceResult, standardResult, unitResult, outcomeResult, referenceResult] = await Promise.all([
        client.from('curriculum_sources').select('*').eq('source_id', sourceId).maybeSingle(),
        client.from('curriculum_standards').select('*').eq('source_id', sourceId).eq('subject_id', 'guidance'),
        client.from('curriculum_units').select('*').eq('source_id', sourceId).eq('subject_id', 'guidance'),
        client.from('curriculum_outcomes').select('*').eq('source_id', sourceId).eq('subject_id', 'guidance'),
        client.from('curriculum_references').select('*').eq('source_id', sourceId).eq('subject_id', 'guidance')
      ]);
      if ([sourceResult, standardResult, unitResult, outcomeResult, referenceResult].some(result => result.error)) return scienceUpdated;
      const sourceRow = sourceResult.data;
      const outcomes = outcomeResult.data || [];
      if (!sourceRow || !outcomes.length) return scienceUpdated;
      const referenceRow = (referenceResult.data || [])[0];
      const dataset = {
        id:'guidance', title:'กิจกรรมแนะแนว', scoreCompatible:false,
        source:{ id:sourceRow.source_id, title:sourceRow.title, framework:sourceRow.framework, revisionYear:sourceRow.revision_year, publisher:sourceRow.publisher, fileName:sourceRow.file_name, status:sourceRow.status, notice:sourceRow.notice, relatedSources:sourceRow.related_sources || [] },
        grades:['P1','P2','P3','P4','P5','P6','M1','M2','M3','M4','M5','M6','M4_6'],
        standards:(standardResult.data || []).map(row => ({ id:row.standard_id, code:row.code, title:row.title, strand:row.strand })),
        units:(unitResult.data || []).map(row => ({ id:row.unit_id, grade:row.grade, title:row.title, description:row.description })),
        indicators:outcomes.map(row => ({ id:row.outcome_id, code:row.code, standard:row.standard_id, grade:row.grade, unitId:row.unit_id, text:row.outcome_text, sourcePage:row.source_page, sourcePdfPage:row.source_pdf_page })),
        reference:referenceRow?.reference_payload || null
      };
      datasets.guidance = dataset;
      const guidanceSubject = subjects.find(subject => subject.id === 'guidance');
      if (guidanceSubject) { guidanceSubject.dataset = dataset; guidanceSubject.available = true; guidanceSubject.grades = dataset.grades; }
      hydrated = true;
      window.dispatchEvent(new CustomEvent('classkru:curriculum-catalog-updated', { detail:{ subjectId:'guidance' } }));
      return true;
    })().catch(() => false).finally(() => { hydrationPromise = null; });
    return hydrationPromise;
  }

  window.CKCurriculumCatalog = {
    subjects,
    getGrades,
    getReference,
    getStandard,
    getStandards,
    getStats,
    getSubject,
    getUnit,
    getUnits,
    loadFromSupabase,
    search
  };
})();
