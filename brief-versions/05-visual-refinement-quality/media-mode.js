'use strict';

const MEDIA_MODES = Object.freeze(['normal', '3d']);

function codedError(code) { return Object.assign(new Error(code), { code }); }

function normalizeMediaMode(value = 'normal') {
  const mode = value ?? 'normal';
  if (!MEDIA_MODES.includes(mode)) throw codedError('media_mode_invalid');
  return mode;
}

function mediaModeInstruction(value = 'normal') {
  const mediaMode = normalizeMediaMode(value);
  return mediaMode === '3d'
    ? 'Teacher-selected startup media mode: 3D with Three.js. Treat Three.js as the intended rendering mode for this task and carry it through idea discovery and design without asking the teacher to repeat it. Use a purposeful 3D scene unless the teacher later explicitly changes the format. Decide whether learners need interaction separately from the 3D rendering mode, according to the learning goal and the teacher’s interaction preference.'
    : 'Teacher-selected startup media mode: normal, non-3D. Choose a suitable 2D HTML, CSS, SVG, or Canvas design and do not add Three.js or a 3D scene unless the teacher later explicitly changes the format.';
}

module.exports = { MEDIA_MODES, normalizeMediaMode, mediaModeInstruction };


