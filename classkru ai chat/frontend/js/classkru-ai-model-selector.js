(function () {
  'use strict';

  const controls = document.getElementById('ck-ai-model-controls');
  const openButton = document.getElementById('ck-ai-model-open');
  const overlay = document.getElementById('ck-ai-model-overlay');
  const form = document.getElementById('ck-ai-model-form');
  const select = document.getElementById('ck-ai-model-select');
  const providerName = document.getElementById('ck-ai-provider-name');
  const keyStatus = document.getElementById('ck-ai-key-status');
  const detail = document.getElementById('ck-ai-model-detail');
  const status = document.getElementById('ck-ai-model-status');
  const refreshButton = document.getElementById('ck-ai-model-refresh');
  const saveButton = document.getElementById('ck-ai-model-save');
  if (!controls || !openButton || !overlay || !form || !select) return;

  let settings = null;
  let models = [];
  let busy = false;

  window.configureClassKruAiModelSelector = function (enabled) {
    controls.hidden = !enabled;
    if (!enabled) closeDialog(false);
  };
  if (window.classKruAiDeveloper) window.configureClassKruAiModelSelector(true);

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle('error', error);
  }

  function closeDialog(restoreFocus = true) {
    overlay.hidden = true;
    openButton.setAttribute('aria-expanded', 'false');
    if (restoreFocus) openButton.focus();
  }

  function currentSessionToken() {
    return supabaseClient?.auth?.getSession().then(result => result?.data?.session?.access_token || null);
  }

  async function requestSettings({ refresh = false, method = 'GET', modelId = '' } = {}) {
    const token = await currentSessionToken();
    if (!token) throw Object.assign(new Error('กรุณาเข้าสู่ระบบใหม่'), { code: 'authentication_required' });
    const response = await fetch(`/api/ai/model-settings${refresh ? '?refresh=1' : ''}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
      ...(method === 'POST' ? { body: JSON.stringify({ modelId }) } : {}),
      signal: AbortSignal.timeout(20000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload.error || 'model_settings_unavailable'), { code: payload.error || 'model_settings_unavailable' });
    return payload;
  }

  function optionLabel(model) {
    const prices = model.promptPerMillion == null || model.completionPerMillion == null
      ? 'ราคาไม่ระบุ'
      : `$${model.promptPerMillion.toFixed(3)} in / $${model.completionPerMillion.toFixed(3)} out ต่อ 1M tokens`;
    return `${model.name} · ${model.id} · ${prices}`;
  }

  function updateModelDetail() {
    const selected = models.find(model => model.id === select.value);
    if (!selected) {
      detail.textContent = select.value ? `โมเดลปัจจุบัน: ${select.value}` : '';
      return;
    }
    const context = selected.contextLength ? ` · Context ${selected.contextLength.toLocaleString('en-US')}` : '';
    detail.textContent = `${selected.id}${context}`;
  }

  function fillModels(data) {
    settings = data;
    models = Array.isArray(data.models) ? data.models : [];
    const entries = new Map(models.map(model => [model.id, model]));
    const current = data.modelId;
    if (current && !entries.has(current)) entries.set(current, { id: current, name: `${current} · ค่าปัจจุบัน` });
    select.replaceChildren(...[...entries.values()].map(model => new Option(optionLabel(model), model.id)));
    select.value = current || '';
    providerName.textContent = data.provider === 'openrouter' ? 'OpenRouter' : 'Mock';
    keyStatus.textContent = data.keyConfigured ? 'API Key พร้อมใช้งาน · เก็บไว้ฝั่งเซิร์ฟเวอร์' : 'ยังไม่พบ API Key ในเซิร์ฟเวอร์';
    keyStatus.classList.toggle('is-warning', !data.keyConfigured || data.provider !== 'openrouter');
    updateModelDetail();

    const canSave = Boolean(data.settingsWritable && data.catalogAvailable && models.length);
    saveButton.disabled = !canSave || busy;
    if (!data.keyConfigured) setStatus('เพิ่ม OpenRouter API Key ใน .env.local ก่อนเรียกใช้งานจริง', true);
    else if (data.provider !== 'openrouter') setStatus('ขณะนี้เซิร์ฟเวอร์ยังไม่ได้เลือก OpenRouter API', true);
    else if (!data.settingsWritable) setStatus('ไม่พบไฟล์ตั้งค่า local ของ Mini Lab V5; เปลี่ยนโมเดลได้จาก environment ของเซิร์ฟเวอร์', true);
    else if (!data.catalogAvailable) setStatus('โหลดรายชื่อโมเดลไม่สำเร็จ กดโหลดใหม่เพื่อลองอีกครั้ง', true);
    else setStatus(`โหลด ${models.length} โมเดลที่รองรับ Structured Output · บันทึกแล้วมีผลกับคำขอถัดไป`);
  }

  async function loadSettings(refresh = false) {
    busy = true;
    refreshButton.disabled = true;
    saveButton.disabled = true;
    setStatus(refresh ? 'กำลังโหลดรายชื่อโมเดลจาก OpenRouter…' : 'กำลังตรวจสอบ API และโมเดล…');
    try {
      fillModels(await requestSettings({ refresh }));
    } catch (error) {
      const messages = {
        authentication_required: 'กรุณาเข้าสู่ระบบใหม่',
        developer_access_required: 'เมนูนี้ใช้ได้เฉพาะบัญชี Developer',
        model_catalog_unavailable: 'โหลดรายชื่อโมเดลไม่สำเร็จ กรุณาลองอีกครั้ง',
        navigation_disabled: 'ClassKru AI ยังไม่เปิดใช้งานในสภาพแวดล้อมนี้'
      };
      setStatus(messages[error.code] || 'โหลดการตั้งค่า API ไม่สำเร็จ', true);
    } finally {
      busy = false;
      refreshButton.disabled = false;
      if (settings) saveButton.disabled = !(settings.settingsWritable && settings.catalogAvailable && models.length);
    }
  }

  openButton.addEventListener('click', () => {
    overlay.hidden = false;
    openButton.setAttribute('aria-expanded', 'true');
    form.focus();
    void loadSettings();
  });
  select.addEventListener('change', updateModelDetail);
  refreshButton.addEventListener('click', () => void loadSettings(true));
  document.getElementById('ck-ai-model-close').addEventListener('click', closeDialog);
  document.getElementById('ck-ai-model-cancel').addEventListener('click', closeDialog);
  overlay.addEventListener('click', event => { if (event.target === overlay) closeDialog(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !overlay.hidden) closeDialog();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !select.value) return;
    busy = true;
    saveButton.disabled = true;
    refreshButton.disabled = true;
    setStatus('กำลังบันทึกโมเดล…');
    try {
      const saved = await requestSettings({ method: 'POST', modelId: select.value });
      if (settings) settings.modelId = saved.modelId;
      setStatus(`บันทึก ${saved.modelId} แล้ว · ClassKru AI ใช้ทันที; Mini Lab V5 อ่านค่าเดียวกันเมื่อโหลดการตั้งค่าใหม่`);
    } catch (error) {
      const messages = {
        unsupported_model: 'โมเดลนี้ไม่รองรับ Structured Output ที่ ClassKru AI ต้องใช้',
        model_catalog_unavailable: 'ตรวจสอบรายชื่อโมเดลไม่ได้ กรุณาโหลดรายชื่อใหม่',
        model_settings_unavailable: 'บันทึกการตั้งค่า local ไม่สำเร็จ',
        developer_access_required: 'บัญชีนี้ไม่มีสิทธิ์เปลี่ยนโมเดล'
      };
      setStatus(messages[error.code] || 'บันทึกโมเดลไม่สำเร็จ', true);
    } finally {
      busy = false;
      refreshButton.disabled = false;
      saveButton.disabled = !(settings?.settingsWritable && settings?.catalogAvailable && models.length);
    }
  });
})();
