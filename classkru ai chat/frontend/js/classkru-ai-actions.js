(function () {
  'use strict';

  let registryPromise;
  let guideTarget = null;
  let guideScreen = null;
  let guideFrame = 0;
  const ring = document.createElement('div');
  ring.className = 'ck-ai-guide-ring';
  ring.hidden = true;
  const note = document.createElement('div');
  note.className = 'ck-ai-guide-note';
  note.hidden = true;
  const noteText = document.createElement('span');
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = 'ยกเลิก';
  dismiss.setAttribute('aria-label', 'ยกเลิกคำแนะนำ ClassKru AI');
  note.append(noteText, dismiss);
  document.body.append(ring, note);

  function registry() {
    registryPromise ||= fetch('/classkru%20ai%20chat/assets/classkru-ai-actions.json?v=1')
      .then(response => { if (!response.ok) throw new Error('registry_unavailable'); return response.json(); })
      .then(entries => new Map(entries.map(entry => [entry.id, entry])));
    return registryPromise;
  }

  function selectedClassId() {
    const hash = location.hash.replace(/^#/, '');
    const hashParam = hash.includes(':') ? hash.slice(hash.indexOf(':') + 1) : '';
    const candidates = [hashParam, typeof swipeClassId !== 'undefined' ? swipeClassId : null,
      typeof scoreCurrentClassId !== 'undefined' ? scoreCurrentClassId : null,
      typeof currentClassId !== 'undefined' ? currentClassId : null];
    return candidates.find(id => id && appState?.classes?.some(item => item.id === id)) || null;
  }

  function context() {
    return { screen: appState?.activeWebScreen || getScreenFromHash() || 'dashboard', selectedClassId: selectedClassId() };
  }

  function hideGuide() {
    guideTarget = null;
    guideScreen = null;
    ring.hidden = true;
    note.hidden = true;
    cancelAnimationFrame(guideFrame);
  }

  function placeGuide() {
    if (!guideTarget || !guideTarget.isConnected || !guideTarget.getClientRects().length) { hideGuide(); return; }
    const box = guideTarget.getBoundingClientRect();
    if (!box.width || !box.height) { hideGuide(); return; }
    Object.assign(ring.style, { left: `${box.left - 5}px`, top: `${box.top - 5}px`, width: `${box.width + 10}px`, height: `${box.height + 10}px` });
    const noteWidth = Math.min(280, window.innerWidth - 24);
    Object.assign(note.style, {
      width: `${noteWidth}px`,
      left: `${Math.max(12, Math.min(window.innerWidth - noteWidth - 12, box.left))}px`,
      top: `${box.bottom + 12 + 54 < window.innerHeight ? box.bottom + 12 : Math.max(12, box.top - 64)}px`
    });
  }

  function guide(selector, label) {
    hideGuide();
    const target = document.querySelector(selector);
    if (!target || !target.getClientRects().length) return false;
    guideTarget = target;
    guideScreen = context().screen;
    noteText.textContent = `ตรงนี้: ${label}`;
    ring.hidden = false;
    note.hidden = false;
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    placeGuide();
    guideFrame = requestAnimationFrame(() => placeGuide());
    return true;
  }

  function validateAction(action, entries) {
    if (!action || action.type !== 'navigate' || typeof action.target !== 'string') return null;
    const entry = entries.get(action.target);
    return entry ? { entry, highlight: action.highlight === true } : null;
  }

  async function execute(action) {
    const validated = validateAction(action, await registry());
    if (!validated) return { ok: false, reason: 'action_not_allowed' };
    const { entry, highlight } = validated;
    const classId = selectedClassId();
    if (entry.requiresClass && !classId) return { ok: false, reason: 'class_required' };
    hideGuide();
    navigateToWebScreen(entry.screen, entry.requiresClass ? classId : undefined);
    if (appState.activeWebScreen !== entry.screen) return { ok: false, reason: 'navigation_unavailable' };
    let guided = false;
    if (highlight) {
      const selector = entry.id === 'add_student' && matchMedia('(max-width: 768px)').matches
        ? '#btn-students-actions-mobile' : entry.highlight;
      guided = guide(selector, entry.label);
    }
    return { ok: true, guided };
  }

  dismiss.addEventListener('click', hideGuide);
  window.addEventListener('resize', placeGuide);
  window.addEventListener('scroll', placeGuide, true);
  window.addEventListener('hashchange', () => {
    if (guideScreen && guideScreen !== context().screen) hideGuide();
    else placeGuide();
  });
  window.ClassKruAiActions = { context, execute, hideGuide, validateAction, registry };
})();
