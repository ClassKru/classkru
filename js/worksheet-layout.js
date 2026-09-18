(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WorksheetLayout = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const text = value => typeof value === 'string' ? value.trim().slice(0, 1200) : '';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function normalize(raw, options = {}) {
    if (!text(raw?.title) || !Array.isArray(raw?.directions) || !raw.directions.some(text)) throw new Error('กรุณาระบุชื่อใบงานและคำชี้แจง');
    if (!raw || !Array.isArray(raw.blocks) || !raw.blocks.length || raw.blocks.length > 12) throw new Error('ใบงานต้องมีโจทย์หรือตารางให้ทำ');
    const lines = {short:1, medium:2, long:4}[options.answerSpace] || 2;
    const blocks = raw.blocks.map((b, index) => {
      if (!b || !['question','table','matching','drawing_form'].includes(b.type)) throw new Error('รูปแบบกิจกรรมไม่รองรับ');
      const block = {type:b.type, title:text(b.title) || `กิจกรรม ${index + 1}`, instruction:text(b.instruction), answer:text(b.answer), lines};
      if (!block.instruction) throw new Error('โจทย์ยังไม่ครบ');
      if (b.type === 'table') {
        if (!Array.isArray(b.columns) || b.columns.length < 2 || b.columns.length > 4 || !b.columns.every(c => text(c))) throw new Error('ตารางต้องมีหัวคอลัมน์ 2–4 ช่อง');
        if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 10) throw new Error('ตารางต้องมีรายการให้ทำ 1–10 แถว');
        block.columns = b.columns.map(text);
        block.rows = b.rows.map(row => {
          if (!Array.isArray(row) || row.length !== block.columns.length || !row.some(c => c === null) || !row.some(c => text(c))) throw new Error('แต่ละแถวต้องมีข้อมูลโจทย์และช่องว่างสำหรับตอบ');
          return row.map(c => c === null ? null : text(c));
        });
      }
      if (b.type === 'matching') {
        if (!Array.isArray(b.leftItems) || !Array.isArray(b.rightItems) || b.leftItems.length < 1 || b.leftItems.length > 10 || b.leftItems.length !== b.rightItems.length) throw new Error('ใบงานจับคู่ต้องมีรายการซ้ายและขวาจำนวนเท่ากัน 1–10 รายการ');
        block.leftItems = b.leftItems.map(text);
        block.rightItems = b.rightItems.map(text);
        if (block.leftItems.some(item => !item) || block.rightItems.some(item => !item)) throw new Error('รายการจับคู่ต้องมีข้อความครบทุกช่อง');
        if (!Array.isArray(b.answerPairs) || b.answerPairs.length !== block.leftItems.length) throw new Error('ใบงานจับคู่ต้องมีเฉลยครบทุกคู่');
        const pairs = b.answerPairs.map(pair => Array.isArray(pair) ? pair.map(Number) : [Number(pair?.left), Number(pair?.right)]);
        if (pairs.some(pair => pair.length !== 2 || !pair.every(Number.isInteger) || pair[0] < 0 || pair[0] >= block.leftItems.length || pair[1] < 0 || pair[1] >= block.rightItems.length) || new Set(pairs.map(pair => pair[0])).size !== pairs.length || new Set(pairs.map(pair => pair[1])).size !== pairs.length) throw new Error('เฉลยจับคู่ไม่ครบหรือมีหมายเลขซ้ำ');
        block.answerPairs = pairs;
      }
      if (b.type === 'drawing_form') {
        if (!Array.isArray(b.items) || !b.items.length || b.items.length > 10) throw new Error('ใบงานวาดภาพต้องมีภารกิจ 1–10 รายการ');
        block.items = b.items.map(item => ({prompt:text(item?.prompt), fields:(Array.isArray(item?.fields) ? item.fields : []).map(text).filter(Boolean).slice(0,6)}));
        if (block.items.some(item => !item.prompt)) throw new Error('ภารกิจวาดภาพต้องมีคำสั่งครบทุกข้อ');
        block.rubric = (Array.isArray(b.rubric) ? b.rubric : []).map(text).filter(Boolean).slice(0,6);
        if (!block.rubric.length) throw new Error('ใบงานวาดภาพต้องมีเกณฑ์หรือแนวทางตรวจ');
      }
      if (options.answerKey === 'no') block.answer = '';
      else if (!block.answer) throw new Error('ขาดเฉลยหรือแนวทางตรวจสำหรับครู');
      return block;
    });
    const count = blocks.reduce((n,b) => n + (b.type === 'table' ? b.rows.length : b.type === 'matching' ? b.leftItems.length : b.type === 'drawing_form' ? b.items.length : 1), 0);
    if (options.itemCount && count !== Number(options.itemCount)) throw new Error(`จำนวนข้อไม่ตรงที่เลือก (${count}/${options.itemCount})`);
    if (options.worksheetType === 'questions' && blocks.some(b => b.type !== 'question')) throw new Error('แม่แบบตอบคำถามต้องมีเฉพาะโจทย์คำถาม');
    if (['table','inquiry'].includes(options.worksheetType)) {
      if (blocks.length !== 1 || blocks[0].type !== 'table') throw new Error('แม่แบบนี้ต้องมีตารางเดียวและนับจำนวนจากแถวในตาราง');
    }
    if (options.worksheetType === 'matching' && (blocks.length !== 1 || blocks[0].type !== 'matching')) throw new Error('แม่แบบจับคู่ต้องมีบล็อกจับคู่เดียว');
    if (options.worksheetType === 'drawing_form' && (blocks.length !== 1 || blocks[0].type !== 'drawing_form')) throw new Error('แม่แบบวาดภาพ/แบบฟอร์มต้องมีบล็อกเดียว');
    return {version:2, title:text(raw.title), directions:(Array.isArray(raw.directions) ? raw.directions : []).map(text).filter(Boolean).slice(0,3), blocks};
  }
  function html(d, editing = false) {
    const w = d.worksheet;
    const field = (label, value, path) => `<label class="cl-field"><span>${esc(label)}</span><textarea class="form-control" rows="2" oninput="setWorksheetBlockField('${path}',this.value)">${esc(value)}</textarea></label>`;
    if (editing) return `<div class="cl-plan-edit-grid">${field('ชื่อใบงาน',w.title,'title')}${field('คำชี้แจง (แยกบรรทัด)',w.directions.join('\n'),'directions')}${w.blocks.map((b,i) => `<section class="cl-sheet-edit">${field('หัวข้อกิจกรรม',b.title,`${i}.title`)}${field('โจทย์ / คำสั่ง',b.instruction,`${i}.instruction`)}${b.type === 'table' ? b.columns.map((c,j) => field(`หัวคอลัมน์ ${j+1}`,c,`${i}.columns.${j}`)).join('') + b.rows.map((r,j) => r.map((c,k) => c === null ? '' : field(`ข้อมูลแถว ${j+1} ช่อง ${k+1}`,c,`${i}.rows.${j}.${k}`)).join('')).join('') : ''}${b.type === 'matching' ? field('รายการฝั่งซ้าย (แยกบรรทัด)',b.leftItems.join('\n'),`${i}.leftItems`) + field('รายการฝั่งขวา (แยกบรรทัด)',b.rightItems.join('\n'),`${i}.rightItems`) : ''}${b.type === 'drawing_form' ? field('ภารกิจวาดภาพ (แยกบรรทัด)',b.items.map(item=>item.prompt).join('\n'),`${i}.drawingItems`) : ''}${d.answerKey !== 'no' ? field('เฉลย / แนวทางตรวจ (สำหรับครู)',b.answer,`${i}.answer`) : ''}</section>`).join('')}</div>`;
    const matchingHtml = b => `<div class="cl-sheet-matching"><table><thead><tr><th>รายการ</th><th>คำตอบ</th><th>รายการจับคู่</th></tr></thead><tbody>${b.leftItems.map((item,j)=>`<tr><td><strong>${j+1}.</strong> ${esc(item)}</td><td><div class="cl-sheet-match-blank"></div></td><td><strong>${String.fromCharCode(65+j)}.</strong> ${esc(b.rightItems[j])}</td></tr>`).join('')}</tbody></table><small>ให้นักเรียนเขียนตัวอักษรของรายการฝั่งขวาลงในช่องคำตอบ</small></div>`;
    const drawingHtml = b => b.items.map((item,j)=>`<div class="cl-sheet-drawing-item"><h4>${j+1}. ${esc(item.prompt)}</h4><div class="cl-sheet-drawing-box" aria-label="พื้นที่วาดภาพ"></div>${item.fields.map(label=>`<div class="cl-sheet-field-line"><span>${esc(label)}</span><i></i></div>`).join('')}</div>`).join('');
    return `<article class="cl-student-sheet"><header><small>ใบงาน · ${esc(d.subject)} · ${esc(d.grade)}</small><h2>${esc(w.title)}</h2><p>ชื่อ–สกุล ................................................ ชั้น ........ เลขที่ ........</p><small>ตัวชี้วัด: ${(d.indicators || []).map(i=>esc(i.code)).join(' · ')}</small></header><p>${w.directions.map(esc).join('<br>')}</p>${w.blocks.map((b,i) => `<section class="cl-sheet-block"><h3>${i+1}. ${esc(b.title)}</h3><p>${esc(b.instruction)}</p>${b.type === 'table' ? `<div class="cl-sheet-table-scroll"><table><thead><tr>${b.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r=>`<tr>${r.map(c=>`<td>${c === null ? `<div class="cl-sheet-blank" style="min-height:${b.lines*24}px" aria-label="ช่องคำตอบ"></div>` : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : b.type === 'matching' ? matchingHtml(b) : b.type === 'drawing_form' ? drawingHtml(b) : Array.from({length:b.lines},()=>'<div class="cl-sheet-answer-line" aria-label="บรรทัดคำตอบ"></div>').join('')}</section>`).join('')}</article>${w.blocks.some(b=>b.answer) ? `<details class="cl-sheet-key"><summary>เฉลยสำหรับครู — แยกจากใบงานนักเรียน</summary>${w.blocks.map((b,i)=>`<p><strong>${i+1}. ${esc(b.title)}</strong><br>${esc(b.answer)}${b.type === 'matching' ? `<br>คู่คำตอบ: ${b.answerPairs.map(pair=>`${pair[0]+1}-${String.fromCharCode(65+pair[1])}`).join(', ')}` : b.type === 'drawing_form' ? `<br>เกณฑ์: ${b.rubric.map(esc).join(' · ')}` : ''}</p>`).join('')}</details>` : ''}`;
  }
  return {normalize, html};
});
