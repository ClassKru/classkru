'use strict';

function createLessonPlanMediaLinks({ db, teacherId } = {}) {
  if (!db || typeof db.selectRows !== 'function' || typeof db.mutateRows !== 'function') {
    throw new TypeError('lesson_plan_media_database_required');
  }

  return Object.freeze({
    async link({ lessonPlanId, conversationId, jobId, artifactId, title } = {}) {
      const planId = String(lessonPlanId || '').trim().slice(0, 100);
      const safeArtifactId = String(artifactId || '').trim().slice(0, 120);
      if (!planId || !conversationId || !jobId || !safeArtifactId) return false;

      const plans = await db.selectRows('teaching_library_items', {
        filters: {
          teacher_id: `eq.${teacherId}`,
          id: `eq.${planId}`,
          item_type: 'eq.lesson_plan',
          deleted_at: 'is.null'
        },
        limit: 1
      });
      if (!plans.length) return false;

      const row = {
        teacher_id: teacherId,
        lesson_plan_id: planId,
        conversation_id: conversationId,
        job_id: jobId,
        artifact_id: safeArtifactId,
        title: String(title || '').trim().slice(0, 240),
        deleted_at: null
      };
      const existing = await db.selectRows('lesson_plan_media_assets', {
        filters: { teacher_id: `eq.${teacherId}`, artifact_id: `eq.${safeArtifactId}` },
        limit: 1
      });
      if (existing.length) {
        await db.mutateRows('lesson_plan_media_assets', 'PATCH', {
          query: { teacher_id: `eq.${teacherId}`, artifact_id: `eq.${safeArtifactId}` },
          body: row
        });
      } else {
        await db.mutateRows('lesson_plan_media_assets', 'POST', { body: row });
      }
      return true;
    },
    async unlinkArtifacts(artifactIds = []) {
      for (const artifactId of [...new Set(artifactIds.map(value => String(value || '').trim()).filter(Boolean))]) {
        await db.mutateRows('lesson_plan_media_assets', 'PATCH', {
          query: { teacher_id: `eq.${teacherId}`, artifact_id: `eq.${artifactId}`, deleted_at: 'is.null' },
          body: { deleted_at: new Date().toISOString() }
        });
      }
    }
  });
}

module.exports = { createLessonPlanMediaLinks };
