'use strict';

// V5 permits exactly one validated same-origin module import: the pinned
// Three.js runtime at /vendor/three.module.js. Network APIs remain denied.
const RUNTIME_CSP = "default-src 'none'; script-src 'unsafe-inline' 'self'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts";
function createRuntimePreviewService({ artifactStore, runtimeBasePath = '/runtime/preview' } = {}) {
  if (!artifactStore || typeof artifactStore.getValidated !== 'function') throw new TypeError('validated_artifact_store_required');
  return Object.freeze({
    previewUrl(artifactId) { return `${runtimeBasePath}/${encodeURIComponent(String(artifactId))}`; },
    async loadPreview(artifactId) {
      const artifact = await artifactStore.getValidated(artifactId);
      if (!artifact) return null;
      return Object.freeze({ artifact_id: artifact.id, html: artifact.html, content_security_policy: RUNTIME_CSP, iframe_sandbox: 'allow-scripts' });
    }
  });
}
module.exports = { RUNTIME_CSP, createRuntimePreviewService };


