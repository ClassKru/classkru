// Local prototype for classroom creation. OpenRouter can replace the source parser later.
let aiClassroomCandidates = [];

function openAiClassroomImport() {
  resetAiClassroomImport();
  document.getElementById('modal-ai-classroom-import')?.classList.add('show');
}

function closeAiClassroomImport() {
  document.getElementById('modal-ai-classroom-import')?.classList.remove('show');
}

function resetAiClassroomImport() {
  aiClassroomCandidates = [];
  document.getElementById('ai-classroom-source-step').style.display = 'block';
  document.getElementById('ai-classroom-review-step').style.display = 'none';
  const input = document.getElementById('ai-classroom-raw-text');
  if (input) input.value = '';
  const imageInput = document.getElementById('ai-classroom-image-input');
  if (imageInput) imageInput.value = '';
  const status = document.getElementById('ai-classroom-ocr-status');
  if (status) { status.style.display = 'none'; status.innerText = ''; }
}

async function handleAiClassroomImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('กรุณาเลือกไฟล์รูปภาพ เช่น JPG หรือ PNG', 'warning');
    return;
  }
  const status = document.getElementById('ai-classroom-ocr-status');
  if (status) { status.style.display = 'block'; status.innerText = 'กำลังส่งรูปให้ AI วิเคราะห์โครงสร้างตาราง…'; }
  try {
    if (window.location.protocol === 'file:') {
      throw new Error('ฟังก์ชัน AI ต้องเปิด ClassKru ผ่าน localhost หรือเว็บไซต์ที่ deploy แล้ว ไม่รองรับการเปิดไฟล์โดยตรง');
    }
    const imageSrc = await readAiClassroomFile(file);
    const sessionResult = typeof supabaseClient?.auth?.getSession === 'function' ? await supabaseClient.auth.getSession() : null;
    const accessToken = sessionResult?.data?.session?.access_token;
    if (!accessToken) throw new Error('กรุณาเข้าสู่ระบบ ClassKru ก่อนใช้ AI');
    const response = await fetch('/api/ai/classroom-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ image: imageSrc })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || payload.error || `API ตอบกลับ ${response.status}`);
    applyAiClassroomEntries(payload.entries || []);
    if (status) status.innerText = `AI วิเคราะห์เสร็จแล้ว ${payload.entries?.length || 0} รายการ กรุณาตรวจสอบก่อนสร้าง`;
  } catch (error) {
    console.error('AI classroom OCR error:', error);
    if (status) status.innerText = 'AI วิเคราะห์ไม่สำเร็จ ลองใหม่หรือตรวจการตั้งค่า API';
    showToast('เชื่อม AI ไม่สำเร็จ: ' + (error.message || 'ลองใหม่อีกครั้ง'), 'error');
  }
}

function applyAiClassroomEntries(entries) {
  const unique = new Map();
  (entries || []).forEach(entry => {
    const subject = String(entry.subject || '').trim();
    const sourceGroup = String(entry.sourceGroup || '').trim();
    if (!subject) return;
    const key = `${entry.subjectCode || ''}|${subject}|${sourceGroup}`.toLowerCase();
    if (!unique.has(key)) unique.set(key, {
      code: String(entry.subjectCode || '').trim(), subject, sourceGroup,
      className: inferAiClassName(sourceGroup), academicYear: getCurrentThaiAcademicYear(),
      selected: true, existingId: findAiMatchingClass(subject, sourceGroup)?.id || ''
    });
  });
  aiClassroomCandidates = [...unique.values()];
  renderAiClassroomCandidates();
  document.getElementById('ai-classroom-source-step').style.display = 'none';
  document.getElementById('ai-classroom-review-step').style.display = 'block';
}

function readAiClassroomFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const original = reader.result;
      const image = new Image();
      image.onload = () => {
        const maxDimension = 1600;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.onerror = () => resolve(original);
      image.src = original;
    };
    reader.onerror = () => reject(reader.error || new Error('อ่านไฟล์ไม่ได้'));
    reader.readAsDataURL(file);
  });
}

function loadAiClassroomScheduleSample() {
  document.getElementById('ai-classroom-raw-text').value = [
    'ค23102 | คณิตศาสตร์ | ม.3',
    'ค31102 | คณิตศาสตร์ | ม.4',
    'ค33126 | คณิตศาสตร์เพิ่มเติม | ม.6 SMET/กีฬา',
    'ค32102 | คณิตศาสตร์ | ม.5',
    'ว30290 | โครงงานวิทย์1 | ม.5',
    'ว30290 | แนะแนว | ม.3',
    'กิจกรรม | ลูกเสือ-เนตรนารี | ไม่ระบุห้อง',
    'ค22204 | คณิตศาสตร์เพิ่มเติม | ม.2',
    'ค32212 | เสริมคณิตศาสตร์4 | ม.5',
    'กิจกรรม | ชุมนุม | ม.1-6',
    'ค21204 | คณิตศาสตร์เพิ่มเติม | ม.1',
    'ค23208 | เสริมคณิตศาสตร์6 | ม.3'
  ].join('\n');
}

function prepareAiClassroomCandidates() {
  const raw = String(document.getElementById('ai-classroom-raw-text')?.value || '').trim();
  if (!raw) { showToast('กรุณาวางข้อมูลหรือกดลองจากตารางตัวอย่างก่อน', 'warning'); return; }
  const parsed = parseAiClassroomCandidates(raw);
  if (!parsed.length) { showToast('ยังแยกข้อมูลรายวิชาไม่ได้ ลองใช้รูปแบบ รหัส | วิชา | ระดับ/กลุ่ม', 'warning'); return; }
  aiClassroomCandidates = parsed;
  renderAiClassroomCandidates();
  document.getElementById('ai-classroom-source-step').style.display = 'none';
  document.getElementById('ai-classroom-review-step').style.display = 'block';
}

function parseAiClassroomCandidates(raw) {
  const seen = new Set();
  const rows = [];
  raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean).forEach(line => {
    const parts = line.split(/\s*\|\s*|\t+/).map(value => value.trim()).filter(Boolean);
    if (parts.length < 2) return;
    const code = parts.length >= 3 ? parts[0] : '';
    const subject = parts.length >= 3 ? parts[1] : parts[0];
    const sourceGroup = parts.length >= 3 ? parts.slice(2).join(' ') : parts[1];
    const key = `${code}|${subject}|${sourceGroup}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const existing = findAiMatchingClass(subject, sourceGroup);
    rows.push({ code, subject, sourceGroup, className: inferAiClassName(sourceGroup), academicYear: getCurrentThaiAcademicYear(), selected: !existing, existingId: existing?.id || '' });
  });
  return rows;
}

function inferAiClassName(sourceGroup) {
  const value = String(sourceGroup || '').trim();
  const exactRoom = value.match(/((?:ม\.|ป\.)\s*[1-6]\s*\/\s*\d{1,2})/);
  return exactRoom ? exactRoom[1].replace(/\s+/g, '') : '';
}

function findAiMatchingClass(subject, sourceGroup) {
  return (appState.classes || []).find(c => String(c.subject || '').trim() === String(subject || '').trim() && String(c.className || '').trim() === String(sourceGroup || '').trim());
}

function renderAiClassroomCandidates() {
  const body = document.getElementById('ai-classroom-review-body');
  if (!body) return;
  body.innerHTML = aiClassroomCandidates.map((row, index) => {
    const valid = /^((ม|ป)\.)[1-6]\/\d{1,2}$/.test(row.className);
    const existing = row.existingId ? '<span class="is-existing">มีห้องนี้แล้ว</span>' : (!valid ? '<span class="is-blocked">ต้องระบุห้องจริง เช่น ม.3/1</span>' : '');
    return `<tr data-ai-class-row="${index}">
      <td><input type="checkbox" ${row.selected ? 'checked' : ''} onchange="toggleAiClassroomRow(${index}, this.checked)" aria-label="เลือก ${aiClassroomEscape(row.subject)}"></td>
      <td>${aiClassroomEscape(row.code || '—')}</td>
      <td><input type="text" value="${aiClassroomEscape(row.subject)}" onchange="updateAiClassroomRow(${index}, 'subject', this.value)"></td>
      <td>${aiClassroomEscape(row.sourceGroup)} ${existing}</td>
      <td><input type="text" value="${aiClassroomEscape(row.className)}" placeholder="เช่น ม.3/1" onchange="updateAiClassroomRow(${index}, 'className', this.value)"></td>
      <td><input type="number" min="2500" max="2700" value="${row.academicYear}" onchange="updateAiClassroomRow(${index}, 'academicYear', this.value)"></td>
    </tr>`;
  }).join('');
  const selected = aiClassroomCandidates.filter(row => row.selected).length;
  const summary = document.getElementById('ai-classroom-review-summary');
  if (summary) summary.innerText = `${aiClassroomCandidates.length} รายวิชา/กลุ่ม · เลือกสร้าง ${selected} รายการ`;
  renderAiClassroomWarnings();
}

function toggleAiClassroomRow(index, selected) { if (aiClassroomCandidates[index]) aiClassroomCandidates[index].selected = selected; renderAiClassroomWarnings(); }
function toggleAllAiClassroomRows(selected) { aiClassroomCandidates.forEach(row => { row.selected = selected; }); renderAiClassroomCandidates(); }
function updateAiClassroomRow(index, field, value) {
  const row = aiClassroomCandidates[index];
  if (!row) return;
  row[field] = field === 'academicYear' ? Number(value) : String(value || '').trim();
  renderAiClassroomCandidates();
}

function renderAiClassroomWarnings() {
  const warnings = [];
  aiClassroomCandidates.forEach((row, index) => {
    if (!row.selected || row.existingId) return;
    if (!/^((ม|ป)\.)[1-6]\/\d{1,2}$/.test(row.className)) warnings.push(`แถว ${index + 1} “${row.subject}” ยังไม่ระบุห้องจริง เช่น ม.3/1`);
  });
  const box = document.getElementById('ai-classroom-warnings');
  if (!box) return;
  box.style.display = warnings.length ? 'block' : 'none';
  box.innerHTML = warnings.length ? `<strong>ยังสร้างไม่ได้:</strong><br>${warnings.map(aiClassroomEscape).join('<br>')}` : '';
}

function confirmAiClassroomImport() {
  const selected = aiClassroomCandidates.filter(row => row.selected && !row.existingId);
  if (!selected.length) { showToast('ยังไม่มีรายการใหม่ที่เลือกสร้าง', 'warning'); return; }
  const invalid = selected.find(row => !/^((ม|ป)\.)[1-6]\/\d{1,2}$/.test(row.className));
  if (invalid) { showToast(`กรุณาระบุห้องจริงให้ “${invalid.subject}” เช่น ม.3/1`, 'warning'); return; }
  let created = 0;
  selected.forEach(row => {
    const duplicate = (appState.classes || []).some(c => c.subject === row.subject && c.className === row.className && Number(c.academicYear) === Number(row.academicYear));
    if (duplicate) return;
    const gradeNumber = row.className.replace(/^\D+/, '').split('/')[0];
    const stage = row.className.startsWith('ป.') ? 'primary' : 'secondary';
    appState.classes.push({ id: `c_${Date.now()}_${created}`, subject: row.subject, subjectCode: row.code, className: row.className, academicYear: row.academicYear, gradeLevel: `${stage === 'primary' ? 'p' : 'm'}${gradeNumber}`, colorIndex: (appState.classes.length + created) % 8, students: [], attendance: {}, notes: {} });
    created++;
  });
  saveState();
  closeAiClassroomImport();
  renderWebClassrooms();
  showToast(`สร้างห้องเรียนสำเร็จ ${created} ห้อง 🎉`, 'success');
}

function aiClassroomEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}
