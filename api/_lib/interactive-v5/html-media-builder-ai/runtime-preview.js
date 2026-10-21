'use strict';

// V5 permits exactly one validated same-origin module import: the pinned
// Three.js runtime at /vendor/three.module.js. Network APIs remain denied.
const RUNTIME_CSP = "default-src 'none'; script-src 'unsafe-inline' 'self'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts";
const RUNTIME_DIAGNOSTICS_SCRIPT = `<script data-v5-runtime-diagnostics>
(() => {
  const messages = {
    script_error: 'สคริปต์สื่อเกิดข้อผิดพลาด',
    module_load_error: 'โหลดโมดูลสามมิติไม่สำเร็จ',
    async_error: 'การเริ่มสื่อไม่สำเร็จ',
    security_policy_blocked: 'เบราว์เซอร์บล็อกทรัพยากรของสื่อ',
    webgl_context_unavailable: 'เบราว์เซอร์สร้างฉากสามมิติไม่ได้'
  };
  let panel;
  function report(code) {
    document.documentElement.dataset.v5RuntimeDiagnostic = code;
    const show = () => {
      if (!document.body) return;
      if (!panel) {
        panel = document.createElement('div');
        panel.setAttribute('role', 'alert');
        panel.setAttribute('aria-live', 'assertive');
        panel.style.cssText = 'position:fixed;z-index:2147483647;left:12px;right:12px;bottom:12px;padding:10px 14px;border-radius:8px;background:#7f1d1d;color:#fff;font:14px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px #0005;pointer-events:none';
        document.body.appendChild(panel);
      }
      panel.textContent = 'Mini Lab V5: ' + (messages[code] || 'เกิดข้อผิดพลาดใน Preview') + ' (' + code + ')';
    };
    if (document.body) show();
    else document.addEventListener('DOMContentLoaded', show, { once: true });
  }
  window.addEventListener('error', event => {
    if (event.target && event.target !== window && String(event.target.tagName).toLowerCase() === 'script') report('module_load_error');
    else if (event instanceof ErrorEvent) report('script_error');
  }, true);
  window.addEventListener('unhandledrejection', () => report('async_error'));
  window.addEventListener('securitypolicyviolation', () => report('security_policy_blocked'));
  const canvasPrototype = window.HTMLCanvasElement && window.HTMLCanvasElement.prototype;
  if (canvasPrototype && typeof canvasPrototype.getContext === 'function') {
    const originalGetContext = canvasPrototype.getContext;
    canvasPrototype.getContext = function (type, ...args) {
      if (!/^webgl2?$|^experimental-webgl$/i.test(String(type))) return originalGetContext.call(this, type, ...args);
      try {
        const context = originalGetContext.call(this, type, ...args);
        if (!context) report('webgl_context_unavailable');
        return context;
      } catch (error) {
        report('webgl_context_unavailable');
        throw error;
      }
    };
  }
})();
</script>`;

function instrumentRuntimeHtml(html) {
  const source = typeof html === 'string' ? html : '';
  if (!source || source.includes('data-v5-runtime-diagnostics')) return source;
  const insertionPoints = [/<head\b[^>]*>/i, /<html\b[^>]*>/i, /<body\b[^>]*>/i, /<!doctype[^>]*>/i];
  for (const pattern of insertionPoints) {
    const match = pattern.exec(source);
    if (match) {
      const index = match.index + match[0].length;
      return `${source.slice(0, index)}${RUNTIME_DIAGNOSTICS_SCRIPT}${source.slice(index)}`;
    }
  }
  return `${RUNTIME_DIAGNOSTICS_SCRIPT}${source}`;
}

function runtimeCspForHost(hostHeader, policy = RUNTIME_CSP) {
  const hostname = String(hostHeader || '').split(':')[0].replace(/\.$/, '').toLowerCase();
  const isClassKruHost = hostname === 'classkru.com' || hostname === 'www.classkru.com';
  const isClassKruVercelDeployment = /^classkru-[a-z0-9-]+\.vercel\.app$/.test(hostname);
  if (!isClassKruHost && !isClassKruVercelDeployment) return policy;
  return policy.replace("script-src 'unsafe-inline' 'self'", `script-src 'unsafe-inline' 'self' https://${hostname}`);
}
function createRuntimePreviewService({ artifactStore, runtimeBasePath = '/runtime/preview' } = {}) {
  if (!artifactStore || typeof artifactStore.getValidated !== 'function') throw new TypeError('validated_artifact_store_required');
  return Object.freeze({
    previewUrl(artifactId) { return `${runtimeBasePath}/${encodeURIComponent(String(artifactId))}`; },
    async loadPreview(artifactId) {
      const artifact = await artifactStore.getValidated(artifactId);
      if (!artifact) return null;
      return Object.freeze({ artifact_id: artifact.id, html: instrumentRuntimeHtml(artifact.html), content_security_policy: RUNTIME_CSP, iframe_sandbox: 'allow-scripts' });
    }
  });
}
module.exports = { RUNTIME_CSP, RUNTIME_DIAGNOSTICS_SCRIPT, instrumentRuntimeHtml, runtimeCspForHost, createRuntimePreviewService };



