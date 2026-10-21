'use strict';

const crypto = require('node:crypto');
const { loadIdeaDiscoveryContext } = require('./idea-discovery-context');

async function startIdeaDiscovery({ teacherContextProvider, workflow, startKey, message = '', mediaMode = 'normal' } = {}) {
  if (typeof startKey !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(startKey)) {
    throw Object.assign(new Error('start_key_invalid'), { code:'start_key_invalid' });
  }
  if (!workflow || typeof workflow.startIdeaDiscovery !== 'function') {
    throw Object.assign(new Error('idea_discovery_workflow_unavailable'), { code:'idea_discovery_workflow_unavailable' });
  }
  const teacherContext = await loadIdeaDiscoveryContext(teacherContextProvider);
  const scopedStartKey = `idea-${crypto.createHash('sha256').update(`${teacherContext.teacherId}\u0000${startKey}`).digest('hex')}`;
  const result = await workflow.startIdeaDiscovery({
    subjects:teacherContext.subjects,
    subjectStatus:teacherContext.status,
    startKey:scopedStartKey,
    teacherMessage:message,
    mediaMode
  });
  return Object.freeze({ conversation:result.conversation, context_status:result.context_status });
}

module.exports = { startIdeaDiscovery };


