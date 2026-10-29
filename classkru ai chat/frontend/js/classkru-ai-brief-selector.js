(function () {
  'use strict';

  const controls = document.getElementById('ck-ai-brief-controls');
  const toggle = document.getElementById('ck-ai-brief-toggle');
  const menu = document.getElementById('ck-ai-brief-menu');
  if (!controls || !toggle || !menu) return;
  const label = toggle.querySelector('.ck-ai-brief-label');
  let currentSession = null;
  let generation = 0;
  let saving = false;
  function cacheKey() { return `classkru-ai-brief:${currentSession?.user?.id || ''}`; }
  function cachedVersion() { try { return localStorage.getItem(cacheKey()); } catch (_) { return null; } }

  function ensureTokenTotal() {
    let total = document.getElementById('ck-ai-token-total');
    if (total) return total;
    const dock = document.getElementById('classkru-ai-dock');
    if (!dock) return null;
    total = document.createElement('output');
    total.id = 'ck-ai-token-total';
    total.className = 'ck-ai-token-total';
    total.setAttribute('aria-live', 'polite');
    total.setAttribute('aria-label', 'ยอดโทเคนรวมของบทสนทนาชั่วคราว');
    total.textContent = 'โทเคนรวม 0';
    dock.appendChild(total);
    return total;
  }

  function updateToggle(version) {
    const shortVersion = version.toUpperCase();
    if (label) label.textContent = `Brief ${shortVersion}`;
    toggle.setAttribute('aria-label', `เลือกชุดบรีฟ ปัจจุบัน ${shortVersion}`);
    toggle.title = `เลือกชุดบรีฟ · ${shortVersion}`;
  }

  function closeMenu() {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }

  function showDeveloperControls(activeVersion = null) {
    const version = activeVersion || window.classKruAiBriefVersion;
    window.configureClassKruAiDeveloper?.(true, version);
    window.configureClassKruAiModelSelector?.(true, currentSession?.user?.id);
    const tokenTotal = ensureTokenTotal();
    if (tokenTotal) tokenTotal.hidden = false;
    if (version) updateToggle(window.classKruAiBriefVersion || version);
    controls.hidden = false;
  }

  function hideDeveloperControls() {
    controls.hidden = true;
    menu.hidden = true;
    const tokenTotal = document.getElementById('ck-ai-token-total');
    if (tokenTotal) tokenTotal.hidden = true;
    window.configureClassKruAiDeveloper?.(false);
    window.configureClassKruAiModelSelector?.(false);
  }

  function showBriefLoadError(message = 'โหลดรายการบรีฟไม่สำเร็จ') {
    menu.replaceChildren();
    const note = document.createElement('button');
    note.type = 'button';
    note.setAttribute('role', 'option');
    note.disabled = true;
    note.textContent = message;
    menu.appendChild(note);
  }

  function render(data) {
    if (!data?.developer || !Array.isArray(data.versions) || !data.versions.length) {
      showBriefLoadError('โหลดชุดบรีฟจากเซิร์ฟเวอร์ไม่ได้');
      return;
    }
    const preferred = data.selectedVersion || cachedVersion() || window.classKruAiBriefVersion;
    const selected = data.versions.some(item => item.id === preferred) ? preferred : data.activeVersion;
    showDeveloperControls(selected);
    updateToggle(selected);
    menu.replaceChildren();
    for (const version of data.versions) {
      if (typeof version?.id !== 'string' || typeof version?.label !== 'string') continue;
      const option = document.createElement('button');
      option.type = 'button';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(version.id === selected));
      option.textContent = `${version.id === selected ? '✓ ' : ''}${version.label}`;
      option.addEventListener('click', async () => {
        if (saving) return;
        saving = true;
        const request = ++generation;
        const session = currentSession;
        for (const item of menu.querySelectorAll('[role="option"]')) item.disabled = true;
        try {
          const response = await fetch('/api/ai/brief-versions', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ briefVersion: version.id }), cache: 'no-store', signal: AbortSignal.timeout(12000) });
          const result = await response.json();
          if (!response.ok || result.selectedVersion !== version.id) throw new Error('save_failed');
          if (request !== generation) return;
          try { localStorage.setItem(cacheKey(), version.id); } catch (_) {}
          window.setClassKruAiBriefVersion(version.id);
          render({ ...data, selectedVersion: version.id });
          closeMenu();
        } catch (_) {
          if (request === generation) showBriefLoadError('บันทึกบรีฟไม่สำเร็จ กรุณาโหลดหน้าใหม่เพื่อลองอีกครั้ง');
        } finally { saving = false; }
      });
      menu.appendChild(option);
    }
    controls.hidden = !menu.childElementCount;
  }

  toggle.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    toggle.setAttribute('aria-expanded', String(!menu.hidden));
    if (!menu.hidden) menu.querySelector('[aria-selected="true"]')?.focus();
  });
  document.addEventListener('click', event => { if (!controls.contains(event.target)) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeMenu(); toggle.focus(); } });

  async function loadVersions(session) {
    if (saving && session?.user?.id === currentSession?.user?.id) { currentSession = session; return; }
    const request = ++generation;
    if (session?.user?.id !== currentSession?.user?.id) hideDeveloperControls();
    currentSession = session;
    const token = session?.access_token;
    const isDeveloper = Boolean(token && typeof window.isClassKruMediaDeveloper === 'function'
      && window.isClassKruMediaDeveloper(session?.user?.email));
    if (!isDeveloper) { hideDeveloperControls(); return; }

    showDeveloperControls(cachedVersion());
    try {
      const response = await fetch('/api/ai/brief-versions', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (request !== generation) return;
      if (!response.ok) { showBriefLoadError('โหลดชุดบรีฟจากเซิร์ฟเวอร์ไม่ได้'); return; }
      const data = await response.json();
      if (request === generation) render(data);
    } catch (_) {
      if (request === generation) showBriefLoadError('เชื่อมต่อรายการบรีฟไม่ได้');
    }
  }

  async function initialize() {
    try {
      const auth = supabaseClient?.auth;
      const session = await auth?.getSession();
      await loadVersions(session?.data?.session);
      auth?.onAuthStateChange((_event, nextSession) => { void loadVersions(nextSession); });
    } catch (_) {
      hideDeveloperControls();
    }
  }

  if (document.readyState === 'complete') {
    void initialize();
  } else {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  }
})();
