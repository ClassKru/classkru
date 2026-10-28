(function () {
  'use strict';

  const controls = document.getElementById('ck-ai-brief-controls');
  const toggle = document.getElementById('ck-ai-brief-toggle');
  const menu = document.getElementById('ck-ai-brief-menu');
  if (!controls || !toggle || !menu) return;
  const label = toggle.querySelector('.ck-ai-brief-label');

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
    const version = activeVersion || window.classKruAiBriefVersion || 'v1';
    window.configureClassKruAiDeveloper?.(true, version);
    window.configureClassKruAiModelSelector?.(true);
    updateToggle(window.classKruAiBriefVersion || version);
    controls.hidden = false;
  }

  function hideDeveloperControls() {
    controls.hidden = true;
    menu.hidden = true;
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
    showDeveloperControls(data.activeVersion);
    const selected = window.classKruAiBriefVersion || data.activeVersion;
    updateToggle(selected);
    menu.replaceChildren();
    for (const version of data.versions) {
      if (typeof version?.id !== 'string' || typeof version?.label !== 'string') continue;
      const option = document.createElement('button');
      option.type = 'button';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(version.id === selected));
      option.textContent = `${version.id === selected ? '✓ ' : ''}${version.label}`;
      option.addEventListener('click', () => {
        window.setClassKruAiBriefVersion(version.id);
        updateToggle(version.id);
        for (const item of menu.querySelectorAll('[role="option"]')) item.setAttribute('aria-selected', String(item === option));
        closeMenu();
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
    const token = session?.access_token;
    const isDeveloper = Boolean(token && typeof window.isClassKruMediaDeveloper === 'function'
      && window.isClassKruMediaDeveloper(session?.user?.email));
    if (!isDeveloper) { hideDeveloperControls(); return; }

    showDeveloperControls();
    try {
      const response = await fetch('/api/ai/brief-versions', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) { showBriefLoadError('โหลดชุดบรีฟจากเซิร์ฟเวอร์ไม่ได้'); return; }
      render(await response.json());
    } catch (_) {
      showBriefLoadError('เชื่อมต่อรายการบรีฟไม่ได้');
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
