(function exposeStudentImport(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ClassKruStudentImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createStudentImport() {
  'use strict';

  function normalizeHeader(value) {
    return String(value ?? '').toLowerCase().normalize('NFKC').normalize('NFC')
      .replace(/\u0E4D\u0E32/g, '\u0E33')
      .replace(/[\s_\-./()（）【】\[\]:'’]+/g, '');
  }

  function classifyHeader(value) {
    const header = normalizeHeader(value);
    if (!header) return '';

    if (/(คำนำหน้า|คำนำหน้านาม|title|prefix|salutation)/iu.test(header)) return 'title';
    if (/(ชื่อ(และ)?(นามสกุล|สกุล)|นามสกุลและชื่อ|ชื่อนามสกุล|ชื่อสกุล|ชื่อเต็ม)/u.test(header)
      || /(fullname|studentname|nameandsurname|nameofstudent|studentfullname|fullstudentname|learnername)/i.test(header)
      || /^name$/i.test(header)) return 'fullName';
    if (/(นามสกุล|lastname|surname|familyname|forenamefamilyname)/iu.test(header) || /^(สกุล|last)(name)?/u.test(header)) return 'lastName';
    if (/(ชื่อจริง|ชื่อต้น|ชื่อนักเรียน|ชื่อผู้เรียน|ชื่อ|firstname|givenname|first|forename)/iu.test(header)) return 'firstName';
    if (/(รหัสนักเรียน|รหัสผู้เรียน|รหัสประจำตัว|เลขประจำตัว(นักเรียน|ผู้เรียน)?|studentcode|studentid|studentnumber|enrollment(number|id)|admission(number|id))/iu.test(header)
      || /^(รหัส|sid|code|id)$/iu.test(header)) return 'code';
    if (/(เลขที่|ลำดับ(ที่)?|ที่นั่ง|seatno|rollno|rollnumber|classno)/iu.test(header)
      || /^(numberinclass|classnumber)$/i.test(header)
      || /^ที่$/u.test(header)
      || /^(no|number|studentno)$/i.test(header)) return 'no';
    return '';
  }

  function guessColumns(rows) {
    const columns = Math.max(0, ...rows.map(row => row.length));
    const stats = Array.from({ length: columns }, (_, column) => {
      const values = rows.map(row => String(row[column] ?? '').trim()).filter(Boolean);
      const numeric = values.filter(value => /^[0-9๐-๙]+$/.test(value)).length;
      const text = values.reduce((score, value) => {
        const hasLetters = /\p{L}/u.test(value);
        if (!hasLetters) return score;
        if (/[\u0E00-\u0E7F]/u.test(value)) return score + 3;
        if (/\d/u.test(value)) return score;
        return score + (/\s/u.test(value) ? 3 : 2);
      }, 0);
      return { column, text, numeric, filled: values.length };
    });
    const nameCandidate = stats.slice().sort((a, b) => b.text - a.text || b.filled - a.filled)[0];
    const numberCandidate = stats.filter(item => item.column !== nameCandidate?.column).sort((a, b) => b.numeric - a.numeric)[0];
    const mapping = {};
    if (nameCandidate && nameCandidate.text) mapping.fullName = nameCandidate.column;
    if (numberCandidate && numberCandidate.numeric) mapping.no = numberCandidate.column;
    return mapping;
  }

  function detectTable(grid) {
    const rows = (grid || []).map((row, sourceIndex) => ({ cells: Array.isArray(row) ? row : [], sourceIndex }))
      .filter(item => item.cells.some(cell => String(cell ?? '').trim() !== ''));
    if (!rows.length) return { headers: [], rows: [], headerRow: -1, mapping: {}, confidence: 0 };

    let best = { index: -1, endIndex: -1, score: 0, mapping: {}, cells: [] };
    const scanRows = rows.slice(0, 60);
    scanRows.forEach((_, index) => {
      for (let span = 1; span <= 3 && index + span <= scanRows.length; span++) {
        const headerRows = scanRows.slice(index, index + span);
        const width = Math.max(0, ...headerRows.map(item => item.cells.length));
        const cells = Array.from({ length: width }, (_, column) => headerRows
          .map(item => String(item.cells[column] ?? '').trim())
          .filter(Boolean)
          .join(' '));
        const mapping = {};
        cells.forEach((cell, column) => {
          const role = classifyHeader(cell);
          if (role && mapping[role] === undefined) mapping[role] = column;
        });
        const hasName = mapping.fullName !== undefined || mapping.firstName !== undefined;
        const score = Object.keys(mapping).length + (hasName ? 3 : 0) - (span - 1) * 0.25;
        if (score > best.score) best = { index, endIndex: index + span - 1, score, mapping, cells };
      }
    });

    const hasHeader = best.index >= 0 && (best.mapping.fullName !== undefined || best.mapping.firstName !== undefined);
    const headerRow = hasHeader ? rows[best.index].sourceIndex : -1;
    const headerEndRow = hasHeader ? rows[best.endIndex].sourceIndex : -1;
    const width = Math.max(0, ...rows.map(item => item.cells.length));
    const headers = hasHeader
      ? Array.from({ length: width }, (_, column) => String(best.cells[column] || '').trim() || `คอลัมน์ ${column + 1}`)
      : Array.from({ length: width }, (_, column) => `คอลัมน์ ${column + 1}`);
    const dataRows = (hasHeader ? rows.slice(best.endIndex + 1) : rows).map(item => item.cells);
    const mapping = hasHeader ? { ...best.mapping } : guessColumns(dataRows);
    const nameRows = dataRows.filter(row => [mapping.fullName, mapping.firstName, mapping.lastName]
      .some(column => column !== undefined && String(row[column] ?? '').trim())).length;

    return {
      headers,
      rows: dataRows,
      headerRow,
      headerEndRow,
      mapping,
      confidence: (hasHeader ? 20 : 0) + Object.keys(mapping).length * 2 + nameRows * 10
    };
  }

  function selectBestSheet(sheets) {
    return (sheets || []).filter(sheet => sheet && sheet.rows && sheet.rows.length)
      .slice()
      .sort((a, b) => Number(b.headerRow >= 0) - Number(a.headerRow >= 0)
        || b.confidence - a.confidence
        || b.rows.length - a.rows.length)[0] || null;
  }

  function normalizeDigits(value) {
    return String(value ?? '').replace(/[๐-๙]/g, digit => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(digit)));
  }

  function recordsFromTable(table) {
    if (!table) return [];
    const mapping = table.mapping || {};
    return (table.rows || []).map((row, rowIndex) => {
      const cell = column => column === undefined || column === null || column === '' ? '' : String(row[Number(column)] ?? '').trim();
      const title = cell(mapping.title);
      const fullName = cell(mapping.fullName);
      const firstName = cell(mapping.firstName);
      const lastName = cell(mapping.lastName);
      const nameParts = fullName ? [fullName] : [firstName, lastName].filter(Boolean);
      const name = [title, ...nameParts].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      const sourceNo = normalizeDigits(cell(mapping.no)).replace(/,/g, '').trim();
      const parsedNo = sourceNo ? Number(sourceNo) : NaN;
      return {
        rowIndex,
        name,
        no: Number.isSafeInteger(parsedNo) && parsedNo > 0 ? parsedNo : null,
        studentCode: cell(mapping.code)
      };
    }).filter(record => record.name);
  }

  return Object.freeze({ normalizeHeader, classifyHeader, guessColumns, detectTable, selectBestSheet, recordsFromTable });
});
