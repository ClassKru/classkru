// Local prototype: OCR + deterministic parsing. OpenRouter can replace parseAiTimetableText later.
let aiTimetableRows = [];

const AI_TIMETABLE_DAY_MAP = {
  'อาทิตย์': 0, 'จันทร์': 1, 'อังคาร': 2, 'พุธ': 3, 'พฤหัสบดี': 4, 'พฤหัส': 4, 'ศุกร์': 5, 'เสาร์': 6
};

function openAiTimetableImport() {
  resetAiTimetableImport();
  document.getElementById('modal-ai-timetable-import')?.classList.add('show');
}

function closeAiTimetableImport() {
  document.getElementById('modal-ai-timetable-import')?.classList.remove('show');
}

function resetAiTimetableImport() {
  aiTimetableRows = [];
  const upload = document.getElementById('ai-timetable-upload-step');
  const processing = document.getElementById('ai-timetable-processing-step');
  const review = document.getElementById('ai-timetable-review-step');
  if (upload) upload.style.display = 'block';
  if (processing) processing.style.display = 'none';
  if (review) review.style.display = 'none';
  const input = document.getElementById('ai-timetable-image-input');
  if (input) input.value = '';
  const raw = document.getElementById('ai-timetable-raw-text');
  if (raw) raw.value = '';
}

function loadAiTimetableSample() {
  const text = [
    'จันทร์ | 1 | วิทยาศาสตร์ | ม.3/1',
    'จันทร์ | 3 | คณิตศาสตร์ | ม.2/2',
    'อังคาร | 2 | ภาษาไทย | ม.1/1',
    'พุธ | 4 | สังคมศึกษา | ม.3/2',
    'พฤหัสบดี | 1 | ภาษาอังกฤษ | ม.2/1',
    'ศุกร์ | 5 | การงานอาชีพ | ม.1/2'
  ].join('\n');
  document.getElementById('ai-timetable-raw-text').value = text;
  parseAiTimetableText();
}

function handleAiTimetableImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('กรุณาเลือกไฟล์รูปภาพ', 'warning');
    return;
  }
  if (typeof Tesseract === 'undefined') {
    showToast('ยังโหลดเครื่องมืออ่านภาพไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง', 'warning');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => startAiTimetableOcr(e.target.result);
  reader.readAsDataURL(file);
}

async function startAiTimetableOcr(imageSrc) {
  setAiTimetableStep('processing');
  setAiTimetableProgress(5, 'กำลังเตรียม OCR ภาษาไทย');
  try {
    const worker = await Tesseract.createWorker('tha+eng', 1, {
      logger: message => {
        if (message.status === 'recognizing text') {
          setAiTimetableProgress(Math.max(8, Math.round(message.progress * 92)), `กำลังอ่านข้อความ… ${Math.round(message.progress * 100)}%`);
        } else if (message.status) {
          setAiTimetableProgress(null, message.status);
        }
      }
    });
    const result = await worker.recognize(imageSrc);
    await worker.terminate();
    setAiTimetableProgress(100, 'อ่านข้อความเสร็จแล้ว กำลังจัดแถวข้อมูล');
    const raw = document.getElementById('ai-timetable-raw-text');
    if (raw) raw.value = result?.data?.text || '';
    setTimeout(() => parseAiTimetableText(), 250);
  } catch (error) {
    console.error('AI timetable OCR error:', error);
    showToast('อ่านรูปไม่สำเร็จ: ' + (error.message || 'ลองใช้ภาพที่คมชัดขึ้น'), 'error');
    setAiTimetableStep('upload');
  }
}

function setAiTimetableProgress(percent, status) {
  const bar = document.getElementById('ai-timetable-progress-bar');
  const text = document.getElementById('ai-timetable-processing-status');
  if (bar && percent !== null) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  if (text && status) text.innerText = status;
}

function setAiTimetableStep(step) {
  document.getElementById('ai-timetable-upload-step').style.display = step === 'upload' ? 'block' : 'none';
  document.getElementById('ai-timetable-processing-step').style.display = step === 'processing' ? 'flex' : 'none';
  document.getElementById('ai-timetable-review-step').style.display = step === 'review' ? 'block' : 'none';
}

function parseAiTimetableText() {
  const raw = String(document.getElementById('ai-timetable-raw-text')?.value || '').trim();
  if (!raw) {
    showToast('กรุณาอัปโหลดรูป หรือวางข้อความตารางก่อน', 'warning');
    return;
  }
  aiTimetableRows = parseAiTimetableRows(raw);
  if (!aiTimetableRows.length) {
    showToast('ยังแยกข้อมูลตารางไม่ได้ ลองใช้รูปที่คมชัดขึ้นหรือรูปแบบ วัน | คาบ | วิชา | ห้อง', 'warning');
    return;
  }
  renderAiTimetableReview();
  setAiTimetableStep('review');
}

function parseAiTimetableRows(raw) {
  let currentDay = null;
  const rows = [];
  raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean).forEach(line => {
    const dayMatch = line.match(/(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์)/);
    if (dayMatch) currentDay = AI_TIMETABLE_DAY_MAP[dayMatch[1]];
    const cleaned = line.replace(/วัน?(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์)/g, '').trim();
    const parts = cleaned.split(/\s*\|\s*|\t+|\s{2,}/).map(v => v.trim()).filter(Boolean);
    const periodMatch = cleaned.match(/(?:คาบ\s*)?(\d{1,2})/);
    const period = periodMatch ? Number(periodMatch[1]) : null;
    if (currentDay === null || !period || period < 1 || period > 16) return;
    const periodIndex = parts.findIndex(part => /^(?:คาบ\s*)?\d{1,2}$/.test(part));
    const afterPeriod = periodIndex >= 0 ? parts.slice(periodIndex + 1) : parts.filter(p => p !== String(period));
    const subject = afterPeriod[0] || cleaned.replace(String(period), '').trim();
    const className = afterPeriod.slice(1).join(' ') || '';
    if (!subject || /^[-–—]+$/.test(subject)) return;
    rows.push({ dow: currentDay, period, subject, className, confidence: parts.length >= 3 ? 'high' : 'review' });
  });
  return rows;
}

function renderAiTimetableReview() {
  const body = document.getElementById('ai-timetable-review-body');
  const summary = document.getElementById('ai-timetable-review-summary');
  if (!body) return;
  const dayLabels = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  body.innerHTML = aiTimetableRows.map((row, index) => `
    <tr data-ai-row="${index}">
      <td><select data-field="dow" onchange="updateAiTimetableRow(${index}, this.value)">${[1,2,3,4,5].map(d => `<option value="${d}"${d === row.dow ? ' selected' : ''}>${dayLabels[d]}</option>`).join('')}</select></td>
      <td><input data-field="period" type="number" min="1" max="16" value="${row.period}" onchange="updateAiTimetableRow(${index}, this.value)"></td>
      <td><input data-field="subject" value="${aiTimetableEscape(row.subject)}" onchange="updateAiTimetableRow(${index}, this.value)"></td>
      <td><input data-field="className" value="${aiTimetableEscape(row.className)}" placeholder="เช่น ม.3/1" onchange="updateAiTimetableRow(${index}, this.value)"></td>
      <td><button class="ai-row-delete" type="button" onclick="removeAiTimetableRow(${index})" aria-label="ลบแถว"><i class="hgi-stroke hgi-delete-02"></i></button></td>
    </tr>`).join('');
  if (summary) summary.innerText = `${aiTimetableRows.length} คาบ · กรุณาตรวจสอบวิชาและห้องเรียนก่อนบันทึก`;
  renderAiTimetableWarnings();
}

function updateAiTimetableRow(index, input) {
  const row = aiTimetableRows[index];
  if (!row) return;
  const field = input?.dataset?.field || event?.target?.dataset?.field;
  const value = input?.value ?? input;
  if (field === 'dow' || field === 'period') row[field] = Number(value);
  else if (field) row[field] = String(value || '').trim();
  renderAiTimetableWarnings();
}

function removeAiTimetableRow(index) {
  aiTimetableRows.splice(index, 1);
  renderAiTimetableReview();
}

function renderAiTimetableWarnings() {
  const warnings = [];
  const seen = new Set();
  aiTimetableRows.forEach((row, index) => {
    const key = `${row.dow}:${row.period}`;
    if (seen.has(key)) warnings.push(`มีคาบซ้ำวัน${DAY_NAMES[row.dow]?.slice(3) || ''} คาบ ${row.period} (แถว ${index + 1})`);
    seen.add(key);
    if (!row.subject) warnings.push(`แถว ${index + 1} ยังไม่มีชื่อวิชา`);
  });
  const box = document.getElementById('ai-timetable-review-warnings');
  if (!box) return;
  box.style.display = warnings.length ? 'block' : 'none';
  box.innerHTML = warnings.length ? `<strong>ควรตรวจสอบ:</strong><br>${warnings.map(aiTimetableEscape).join('<br>')}` : '';
}

function confirmAiTimetableImport() {
  if (!aiTimetableRows.length) return;
  const invalid = aiTimetableRows.find(row => !row.dow || !row.period || !row.subject);
  if (invalid) { showToast('กรุณาเติมวัน คาบ และชื่อวิชาให้ครบ', 'warning'); return; }
  const duplicateKeys = new Set();
  aiTimetableRows.forEach(row => {
    const key = `${row.dow}:${row.period}`;
    duplicateKeys.add(key);
    appState.timetable = (appState.timetable || []).filter(entry => !timetableEntryMatches(entry, row.dow, row.period));
    const matchedClass = (appState.classes || []).find(c => String(c.className || '').trim() === row.className);
    appState.timetable.push({ dow: row.dow, period: row.period, classId: matchedClass?.id || '', subject: row.subject, className: row.className, week: 'A' });
  });
  saveState();
  closeAiTimetableImport();
  renderWebTimetable();
  if (typeof renderWebDashboard === 'function') renderWebDashboard();
  showToast(`นำเข้าตารางสอนด้วย AI สำเร็จ ${duplicateKeys.size} คาบ 🎉`, 'success');
}

function aiTimetableEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}
