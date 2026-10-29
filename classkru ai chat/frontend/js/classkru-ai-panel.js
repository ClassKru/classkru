(function () {
  'use strict';

  const panel = document.getElementById('ck-ai-panel');
  if (!panel) return;
  const historyElement = document.getElementById('ck-ai-history');
  const input = document.getElementById('ck-ai-input');
  const form = document.getElementById('ck-ai-form');
  const sendButton = document.getElementById('ck-ai-send');
  const statusElement = document.getElementById('ck-ai-status');
  const starters = document.getElementById('ck-ai-starters');
  const minimize = document.getElementById('ck-ai-minimize');
  const expand = document.getElementById('ck-ai-expand');
  let history = [];
  let owner = null;
  let busy = false;
  let activeBriefVersion = null;
  let conversationId = null;
  let conversationTokenTotal = 0;

  function renderTokenTotal() {
    const tokenTotalElement = document.getElementById('ck-ai-token-total');
    if (!tokenTotalElement) return;
    const isDeveloper = Boolean(window.classKruAiDeveloper);
    tokenTotalElement.hidden = !isDeveloper;
    if (!isDeveloper) return;
    const formattedTotal = conversationTokenTotal.toLocaleString('en-US');
    tokenTotalElement.textContent = `โทเคนรวม ${formattedTotal}`;
    tokenTotalElement.title = `ยอดรวม input และ output tokens ตาม API ในบทสนทนานี้ · ${formattedTotal} tokens`;
  }

  function addTokenUsage(usage) {
    if (!window.classKruAiDeveloper || !usage || typeof usage !== 'object') return;
    const total = Number.isFinite(Number(usage.total_tokens))
      ? Number(usage.total_tokens)
      : Number(usage.prompt_tokens || 0) + Number(usage.completion_tokens || 0);
    if (!Number.isFinite(total) || total < 0) return;
    conversationTokenTotal += total;
    renderTokenTotal();
  }

  function newConversationId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
      const value = Math.random() * 16 | 0;
      return (char === 'x' ? value : (value & 3 | 8)).toString(16);
    });
  }

  function resetConversation(version = null) {
    history = [];
    conversationTokenTotal = 0;
    renderTokenTotal();
    historyElement.replaceChildren();
    activeBriefVersion = version;
    conversationId = newConversationId();
    status('เริ่มบทสนทนาใหม่สำหรับ Brief เวอร์ชันนี้');
    ClassKruAiActions.hideGuide();
  }

  window.setClassKruAiBriefVersion = function (version) {
    if (!window.classKruAiDeveloper || typeof version !== 'string' || version === activeBriefVersion) return;
    window.classKruAiBriefVersion = version;
    resetConversation(version);
  };

  window.configureClassKruAiDeveloper = function (enabled, activeVersion) {
    const wasDeveloper = Boolean(window.classKruAiDeveloper);
    window.classKruAiDeveloper = Boolean(enabled);
    renderTokenTotal();
    if (!enabled) {
      window.classKruAiBriefVersion = null;
      if (wasDeveloper) resetConversation(null);
    } else if (activeVersion) window.setClassKruAiBriefVersion(activeVersion);
  };

  function status(message, error = false) {
    statusElement.textContent = message;
    statusElement.classList.toggle('error', error);
  }

  function addMessage(role, content) {
    const bubble = document.createElement('p');
    bubble.className = `ck-ai-message ${role}`;
    bubble.textContent = content;
    historyElement.appendChild(bubble);
    historyElement.scrollTop = historyElement.scrollHeight;
    history.push({ role, content });
    history = history.slice(-16);
  }

  function resetForNewTeacher() {
    const nextOwner = localStorage.getItem('classkru_state_owner_v1') || '';
    if (owner !== null && owner !== nextOwner) {
      history = [];
      conversationTokenTotal = 0;
      renderTokenTotal();
      historyElement.replaceChildren();
      conversationId = null;
      status('');
      ClassKruAiActions.hideGuide();
    }
    owner = nextOwner;
  }

  window.openClassKruAi = function () {
    if (localStorage.getItem('classkru-ai-navigation-enabled') === '0') {
      if (typeof showToast === 'function') showToast('ClassKru AI ปิดใช้งานอยู่', 'info');
      return;
    }
    resetForNewTeacher();
    panel.hidden = false;
    panel.classList.remove('is-minimized');
    minimize.setAttribute('aria-label', 'ย่อแผงสนทนา');
    if (!history.length) addMessage('assistant', 'สวัสดีค่ะ บอกได้เลยว่าอยากทำอะไรใน ClassKru ฉันจะช่วยพาไปและชี้ตำแหน่งให้');
    input.focus();
  };

  async function send(message) {
    const text = String(message || '').trim();
    if (busy || !text || text.length > 1000) return;
    const previousHistory = history.slice(-8);
    addMessage('user', text);
    input.value = '';
    busy = true;
    sendButton.disabled = true;
    status('กำลังประมวลผล…');
    try {
      const sessionResult = await supabaseClient?.auth?.getSession();
      const token = sessionResult?.data?.session?.access_token;
      if (!token) throw new Error('กรุณาเข้าสู่ระบบใหม่');
      const response = await fetch('/api/ai/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, context: ClassKruAiActions.context(), history: previousHistory,
          ...(activeBriefVersion ? { briefVersion: activeBriefVersion } : {}), ...(conversationId ? { conversationId } : {}) }),
        signal: AbortSignal.timeout(25000)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const descriptions = {
          navigation_disabled: 'ClassKru AI ยังไม่เปิดใช้งานในสภาพแวดล้อมนี้',
          authentication_required: 'กรุณาเข้าสู่ระบบใหม่',
          rate_limited: 'ส่งข้อความถี่เกินไป กรุณารอสักครู่',
          action_not_allowed: 'คำแนะนำนี้ไม่อยู่ในรายการที่อนุญาต',
          developer_access_required: 'บัญชีนี้ไม่มีสิทธิ์เลือก Brief Version',
          invalid_brief_version: 'ไม่พบ AI Brief Version ที่เลือก',
          provider_not_configured: 'ยังไม่ได้ตั้งค่า OpenRouter สำหรับ ClassKru AI',
          provider_timeout: 'การตอบกลับใช้เวลานานเกินไป กรุณาลองอีกครั้ง',
          active_version_changed: 'AI Brief มีการอัปเดต เริ่มบทสนทนาใหม่แล้ว กรุณาส่งข้อความอีกครั้ง'
        };
        if (['active_version_changed', 'brief_version_changed'].includes(result.error)) {
          resetConversation(window.classKruAiDeveloper ? window.classKruAiBriefVersion : null);
        }
        throw new Error(descriptions[result.error] || 'ผู้ช่วยยังตอบไม่ได้ กรุณาลองอีกครั้ง');
      }
      if (typeof result.reply !== 'string' || !result.reply.trim()) throw new Error('คำตอบจากผู้ช่วยไม่ถูกต้อง');
      activeBriefVersion = result.briefVersion || activeBriefVersion;
      conversationId = result.conversationId || conversationId;
      addTokenUsage(result.tokenUsage);
      addMessage('assistant', result.reply.slice(0, 1500));
      if (result.action) {
        const outcome = await ClassKruAiActions.execute(result.action);
        if (window.classKruAiDeveloper) {
          const session = await supabaseClient?.auth?.getSession().catch(() => null);
          const executionToken = session?.data?.session?.access_token;
          if (executionToken) void fetch('/api/ai/navigation', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${executionToken}` },
            body: JSON.stringify({ event: 'execution', action: result.action.target, result: outcome.ok ? 'navigated' : 'blocked', requestId: result.requestId, briefVersion: result.briefVersion })
          }).catch(() => {});
        }
        if (!outcome.ok) status(outcome.reason === 'class_required' ? 'กรุณาเลือกห้องเรียนก่อน' : 'ไม่สามารถนำทางตามคำแนะนำนี้ได้', true);
        else {
          if (matchMedia('(max-width: 768px)').matches) {
            panel.classList.add('is-minimized');
            minimize.setAttribute('aria-label', 'ขยายแผงสนทนา');
          }
          status(outcome.guided ? 'เน้นตำแหน่งที่เกี่ยวข้องแล้ว' : 'เปิดหน้าที่แนะนำแล้ว');
        }
      } else status('');
    } catch (error) {
      const message = error.name === 'TimeoutError' ? 'การตอบกลับใช้เวลานานเกินไป กรุณาลองอีกครั้ง' : error.message || 'เชื่อมต่อผู้ช่วยไม่ได้';
      status(message, true);
    } finally {
      busy = false;
      sendButton.disabled = false;
    }
  }

  form.addEventListener('submit', event => { event.preventDefault(); void send(input.value); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(input.value); }
  });
  starters.addEventListener('click', event => {
    const prompt = event.target.closest('[data-prompt]')?.dataset.prompt;
    if (prompt) void send(prompt);
  });
  minimize.addEventListener('click', () => {
    const minimized = panel.classList.toggle('is-minimized');
    minimize.setAttribute('aria-label', minimized ? 'ขยายแผงสนทนา' : 'ย่อแผงสนทนา');
    if (!minimized) input.focus();
  });
  expand.addEventListener('click', () => {
    const expanded = panel.classList.toggle('is-expanded');
    expand.setAttribute('aria-label', expanded ? 'ลดขนาดแผงสนทนา' : 'ขยายแผงสนทนา');
  });
  document.getElementById('ck-ai-close').addEventListener('click', () => {
    panel.hidden = true;
    ClassKruAiActions.hideGuide();
    document.getElementById('classkru-ai-launcher')?.focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      ClassKruAiActions.hideGuide();
      panel.hidden = true;
    }
  });
})();
