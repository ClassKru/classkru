'use strict';

const SUBJECTS_BY_TEACHER = Object.freeze({
  local_teacher_a: Object.freeze([
    Object.freeze({ subject: 'วิทยาศาสตร์', gradeLevel: 'ม.2' }),
    Object.freeze({ subject: 'ฟิสิกส์', gradeLevel: 'ม.5' }),
    Object.freeze({ subject: 'วิทยาศาสตร์', gradeLevel: 'ม.2' }),
    Object.freeze({ subject: 'วิทยาศาสตร์', gradeLevel: 'ม.3' })
  ]),
  local_teacher_b: Object.freeze([
    Object.freeze({ subject: 'ภาษาไทย', gradeLevel: 'ป.4' }),
    Object.freeze({ subject: 'สังคมศึกษา', gradeLevel: 'ป.5' })
  ]),
  local_teacher_no_subjects: Object.freeze([])
});

function codedError(code) { return Object.assign(new Error(code), { code }); }

function createMockTeacherContextProvider({ teacherId = 'local_teacher_a', authenticated = true, subjectsStatus = 'available' } = {}) {
  let identity = { teacherId, authenticated: authenticated === true, subjectsStatus };
  function setMockIdentity(next = {}) {
    identity = {
      teacherId: next.teacherId ?? identity.teacherId,
      authenticated: next.authenticated ?? identity.authenticated,
      subjectsStatus: next.subjectsStatus ?? identity.subjectsStatus
    };
  }
  return Object.freeze({
    async getAuthenticatedTeacher() {
      if (!identity.authenticated) throw codedError('teacher_authentication_required');
      return Object.freeze({ authenticated: true, teacherId: identity.teacherId });
    },
    async getSubjectsForTeacher(teacher) {
      if (!identity.authenticated || !teacher || teacher.authenticated !== true || teacher.teacherId !== identity.teacherId) {
        throw codedError('teacher_authentication_invalid');
      }
      if (identity.subjectsStatus === 'unavailable') throw codedError('teacher_subjects_unavailable');
      if (!Object.hasOwn(SUBJECTS_BY_TEACHER, identity.teacherId)) throw codedError('teacher_subjects_unavailable');
      return SUBJECTS_BY_TEACHER[identity.teacherId].map(item => ({ ...item }));
    },
    setMockIdentity
  });
}

function createMockTeacherContextProviderFromEnvironment(env = process.env) {
  const authenticated = env.INTERACTIVE_V5_MOCK_AUTHENTICATED !== 'false';
  const subjectsStatus = env.INTERACTIVE_V5_MOCK_SUBJECTS_STATUS === 'unavailable' ? 'unavailable' : 'available';
  return createMockTeacherContextProvider({
    teacherId: env.INTERACTIVE_V5_MOCK_TEACHER_ID || 'local_teacher_a',
    authenticated,
    subjectsStatus
  });
}

module.exports = { createMockTeacherContextProvider, createMockTeacherContextProviderFromEnvironment };


