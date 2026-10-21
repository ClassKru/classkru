'use strict';

const AUTHENTICATION_ERRORS = new Set(['teacher_authentication_required', 'teacher_authentication_invalid']);

function codedError(code) { return Object.assign(new Error(code), { code }); }

function normalizeSubjects(input) {
  if (!Array.isArray(input)) return [];
  const subjects = [];
  const seen = new Set();
  for (const item of input.slice(0, 100)) {
    if (!item || typeof item !== 'object') continue;
    const subject = String(item.subject_name ?? item.subjectName ?? item.subject ?? '').trim().slice(0, 120);
    const gradeLevel = String(item.grade_level ?? item.gradeLevel ?? item.grade ?? '').trim().slice(0, 80);
    if (!subject || !gradeLevel) continue;
    const key = `${subject.toLocaleLowerCase('th')}\u0000${gradeLevel.toLocaleLowerCase('th')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    subjects.push(Object.freeze({ subject, grade_level: gradeLevel }));
  }
  return Object.freeze(subjects);
}

async function loadIdeaDiscoveryContext(provider) {
  if (!provider || typeof provider.getAuthenticatedTeacher !== 'function' || typeof provider.getSubjectsForTeacher !== 'function') {
    throw codedError('teacher_authentication_required');
  }
  const teacher = await provider.getAuthenticatedTeacher();
  if (!teacher || teacher.authenticated !== true || typeof teacher.teacherId !== 'string' || !teacher.teacherId.trim()) {
    throw codedError('teacher_authentication_required');
  }
  let sourceSubjects;
  try {
    sourceSubjects = await provider.getSubjectsForTeacher(teacher);
  } catch (error) {
    if (AUTHENTICATION_ERRORS.has(error?.code)) throw codedError(error.code);
    return Object.freeze({ status: 'unavailable', subjects: Object.freeze([]), teacherId: teacher.teacherId });
  }
  if (!Array.isArray(sourceSubjects)) {
    return Object.freeze({ status:'unavailable', subjects:Object.freeze([]), teacherId:teacher.teacherId });
  }
  const subjects = normalizeSubjects(sourceSubjects);
  if (sourceSubjects.length > 0 && subjects.length === 0) {
    return Object.freeze({ status:'unavailable', subjects:Object.freeze([]), teacherId:teacher.teacherId });
  }
  return Object.freeze({ status: subjects.length ? 'available' : 'empty', subjects, teacherId: teacher.teacherId });
}

module.exports = { loadIdeaDiscoveryContext, normalizeSubjects, AUTHENTICATION_ERRORS };


