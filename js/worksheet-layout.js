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
      if (!b || !['question','table'].includes(b.type)) throw new Error('รูปแบบกิจกรรมไม่รองรับ');
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
      if (options.answerKey === 'no') block.answer = '';
      else if (!block.answer) throw new Error('ขาดเฉลยหรือแนวทางตรวจสำหรับครู');
      return block;
    });
    const count = blocks.reduce((n,b) => n + (b.type === 'table' ? b.rows.length : 1), 0);
    if (options.itemCount && count !== Number(options.itemCount)) throw new Error(`จำนวนข้อไม่ตรงที่เลือก (${count}/${options.itemCount})`);
    if (options.worksheetType === 'questions' && blocks.some(b => b.type !== 'question')) throw new Error('แม่แบบตอบคำถามต้องมีเฉพาะโจทย์คำถาม');
    if (['table','inquiry'].includes(options.worksheetType)) {
      if (blocks.length !== 1 || blocks[0].type !== 'table') throw new Error('แม่แบบนี้ต้องมีตารางเดียวและนับจำนวนจากแถวในตาราง');
    }
    return {version:2, title:text(raw.title), directions:(Array.isArray(raw.directions) ? raw.directions : []).map(text).filter(Boolean).slice(0,3), blocks};
  }
  function html(d, editing = false) {
    const w = d.worksheet;
    const field = (label, value, path) => `<label class="cl-field"><span>${esc(label)}</span><textarea class="form-control" rows="2" oninput="setWorksheetBlockField('${path}',this.value)">${esc(value)}</textarea></label>`;
    if (editing) return `<div class="cl-plan-edit-grid">${field('ชื่อใบงาน',w.title,'title')}${field('คำชี้แจง (แยกบรรทัด)',w.directions.join('\n'),'directions')}${w.blocks.map((b,i) => `<section class="cl-sheet-edit">${field('หัวข้อกิจกรรม',b.title,`${i}.title`)}${field('โจทย์ / คำสั่ง',b.instruction,`${i}.instruction`)}${b.type === 'table' ? b.columns.map((c,j) => field(`หัวคอลัมน์ ${j+1}`,c,`${i}.columns.${j}`)).join('') + b.rows.map((r,j) => r.map((c,k) => c === null ? '' : field(`ข้อมูลแถว ${j+1} ช่อง ${k+1}`,c,`${i}.rows.${j}.${k}`)).join('')).join('') : ''}${d.answerKey !== 'no' ? field('เฉลย / แนวทางตรวจ (สำหรับครู)',b.answer,`${i}.answer`) : ''}</section>`).join('')}</div>`;
    return `<article class="cl-student-sheet"><header><small>ใบงาน · ${esc(d.subject)} · ${esc(d.grade)}</small><h2>${esc(w.title)}</h2><p>ชื่อ–สกุล ................................................ ชั้น ........ เลขที่ ........</p><small>ตัวชี้วัด: ${(d.indicators || []).map(i=>esc(i.code)).join(' · ')}</small></header><p>${w.directions.map(esc).join('<br>')}</p>${w.blocks.map((b,i) => `<section class="cl-sheet-block"><h3>${i+1}. ${esc(b.title)}</h3><p>${esc(b.instruction)}</p>${b.type === 'table' ? `<div class="cl-sheet-table-scroll"><table><thead><tr>${b.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r=>`<tr>${r.map(c=>`<td>${c === null ? `<div class="cl-sheet-blank" style="min-height:${b.lines*24}px" aria-label="ช่องคำตอบ"></div>` : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : Array.from({length:b.lines},()=>'<div class="cl-sheet-answer-line" aria-label="บรรทัดคำตอบ"></div>').join('')}</section>`).join('')}</article>${w.blocks.some(b=>b.answer) ? `<details class="cl-sheet-key"><summary>เฉลยสำหรับครู — แยกจากใบงานนักเรียน</summary>${w.blocks.map((b,i)=>`<p><strong>${i+1}. ${esc(b.title)}</strong><br>${esc(b.answer)}</p>`).join('')}</details>` : ''}`;
  }
  return {normalize, html};
});
