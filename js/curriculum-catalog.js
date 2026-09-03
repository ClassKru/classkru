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
    social: window.CK_CURRICULUM_SOCIAL_2560 || null,
    health: window.CK_CURRICULUM_HEALTH_2551 || null,
    art: window.CK_CURRICULUM_ART_2551 || null,
    career: window.CK_CURRICULUM_CAREER_2551 || null,
    foreign: window.CK_CURRICULUM_FOREIGN_2551 || null
  };
  const gradeOrder = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M4_6'];
  function inferGrades(dataset) {
    if (!dataset) return ['M1', 'M2', 'M3'];
    const used = new Set(dataset.indicators.map(item => item.grade).filter(Boolean));
    return gradeOrder.filter(grade => used.has(grade));
  }
  const subjects = [
    { id: 'thai', code: 'ท', name: 'ภาษาไทย', shortName: 'ภาษาไทย' },
    { id: 'math', code: 'ค', name: 'คณิตศาสตร์', shortName: 'คณิตศาสตร์' },
    { id: 'science', code: 'ว', name: 'วิทยาศาสตร์และเทคโนโลยี', shortName: 'วิทยาศาสตร์' },
    { id: 'social', code: 'ส', name: 'สังคมศึกษา ศาสนา และวัฒนธรรม', shortName: 'สังคมศึกษา' },
    { id: 'health', code: 'พ', name: 'สุขศึกษาและพลศึกษา', shortName: 'สุขศึกษา' },
    { id: 'art', code: 'ศ', name: 'ศิลปะ', shortName: 'ศิลปะ' },
    { id: 'career', code: 'ง', name: 'การงานอาชีพ', shortName: 'การงานอาชีพ' },
    { id: 'foreign', code: 'ต', name: 'ภาษาต่างประเทศ', shortName: 'ภาษาอังกฤษ' }
  ].map(subject => ({
    ...subject,
    available: !!datasets[subject.id],
    grades: subject.grades || inferGrades(datasets[subject.id]),
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
      .filter(unit => !grade || unit.grade === grade)
      .map(unit => ({
        ...unit,
        indicatorCount: dataset.indicators.filter(item => item.grade === unit.grade && item.unitId === unit.id).length
      }));
  }

  function getStandards(subjectId, grade) {
    const dataset = getSubject(subjectId).dataset;
    if (!dataset) return [];
    const used = new Set(dataset.indicators.filter(item => !grade || item.grade === grade).map(item => item.standard));
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
      if (grade && item.grade !== grade) return false;
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

  function getStats() {
    return subjects.reduce((summary, subject) => {
      const count = subject.dataset?.indicators.length || 0;
      summary.subjects += 1;
      summary.availableSubjects += subject.available ? 1 : 0;
      summary.indicators += count;
      return summary;
    }, { subjects: 0, availableSubjects: 0, indicators: 0 });
  }

  window.CKCurriculumCatalog = {
    subjects,
    getGrades,
    getStandard,
    getStandards,
    getStats,
    getSubject,
    getUnit,
    getUnits,
    search
  };
})();
