'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const StudentImport = require('../js/student-import.js');

const layouts = [
  {
    name: 'ClassKru-style Thai columns',
    grid: [
      ['เลขที่', 'รหัสนักเรียน', 'ชื่อ', 'นามสกุล'],
      ['1', '00081', 'กานต์', 'ใจดี'],
      ['2', '00082', 'มาลี', 'เรียนเก่ง']
    ],
    mapping: { no: 0, code: 1, firstName: 2, lastName: 3 },
    dataRows: 2
  },
  {
    name: 'school export with title, preamble, and alternate Thai labels',
    grid: [
      ['โรงเรียนตัวอย่าง'],
      ['บัญชีรายชื่อนักเรียน ภาคเรียนที่ 1'],
      [],
      ['ที่นั่ง', 'เลขประจำตัวนักเรียน', 'คำนำหน้า', 'ชื่อจริง', 'สกุล', 'ชั้น/ห้อง'],
      ['๑', '65001', 'ด.ช.', 'สมชาย', 'ขยัน', 'ม.1/1'],
      ['๒', '65002', 'ด.ญ.', 'สมหญิง', 'ตั้งใจ', 'ม.1/1']
    ],
    mapping: { no: 0, code: 1, title: 2, firstName: 3, lastName: 4 },
    headerRow: 3,
    dataRows: 2
  },
  {
    name: 'English roster with reordered columns',
    grid: [
      ['Family Name', 'Roll No.', 'Student Number', 'Given Name', 'Title'],
      ['Smith', '07', '000901', 'Jamie', 'Mx.']
    ],
    mapping: { lastName: 0, no: 1, code: 2, firstName: 3, title: 4 },
    dataRows: 1
  },
  {
    name: 'single full-name column with Thai heading variants',
    grid: [
      ['ชื่อ - สกุล', 'ลำดับที่', 'รหัสประจำตัว'],
      ['ปวีณา นาคทอง', '10', '0010']
    ],
    mapping: { fullName: 0, no: 1, code: 2 },
    dataRows: 1
  },
  {
    name: 'single full-name column with English heading variants',
    grid: [
      ['Student Name', 'Student No', 'Student Code'],
      ['Taylor Example', '3', 'ST-003']
    ],
    mapping: { fullName: 0, no: 1, code: 2 },
    dataRows: 1
  },
  {
    name: 'annotated school headings with generic code labels',
    grid: [
      ['ชื่อ-นามสกุล (Full Name)', 'ลำดับที่', 'รหัส'],
      ['ณัฐชา ทองดี', '5', 'A-005']
    ],
    mapping: { fullName: 0, no: 1, code: 2 },
    dataRows: 1
  },
  {
    name: 'short Thai headings used by classroom registers',
    grid: [
      ['ที่', 'คำนำหน้านาม', 'ชื่อ-นามสกุลนักเรียน', 'เลขประจำตัว'],
      ['9', 'น.ส.', 'อรพรรณ พูลผล', '00990']
    ],
    mapping: { no: 0, title: 1, fullName: 2, code: 3 },
    dataRows: 1
  }
];

for (const layout of layouts) {
  test(`detects ${layout.name}`, () => {
    const table = StudentImport.detectTable(layout.grid);
    assert.deepEqual(table.mapping, layout.mapping);
    if (layout.headerRow !== undefined) assert.equal(table.headerRow, layout.headerRow);
    assert.equal(table.rows.length, layout.dataRows);
  });
}

test('scans past title rows and blank rows to find the header', () => {
  const grid = [
    ['โรงเรียนตัวอย่าง'],
    [],
    ['ข้อมูล ณ วันที่ 1 พฤษภาคม'],
    [],
    ['ชื่อ-นามสกุล', 'เลขที่'],
    ['นที ตัวอย่าง', '4']
  ];
  const table = StudentImport.detectTable(grid);
  assert.equal(table.headerRow, 4);
  assert.deepEqual(table.mapping, { fullName: 0, no: 1 });
  assert.deepEqual(StudentImport.recordsFromTable(table).map(({ name, no }) => ({ name, no })), [
    { name: 'นที ตัวอย่าง', no: 4 }
  ]);
});

test('combines grouped headers spread across multiple rows', () => {
  const table = StudentImport.detectTable([
    ['ทะเบียนรายชื่อนักเรียน'],
    ['เลขที่', 'รหัส', 'ข้อมูลนักเรียน', '', ''],
    ['', '', 'คำนำหน้า', 'ชื่อจริง', 'นามสกุล'],
    ['1', 'A001', 'ด.ช.', 'ภาคภูมิ', 'รักเรียน']
  ]);
  assert.equal(table.headerRow, 1);
  assert.equal(table.headerEndRow, 2);
  assert.deepEqual(table.mapping, { no: 0, code: 1, title: 2, firstName: 3, lastName: 4 });
  assert.deepEqual(StudentImport.recordsFromTable(table).map(({ name }) => name), ['ด.ช. ภาคภูมิ รักเรียน']);
});

test('guesses likely name and number columns when there is no header row', () => {
  const grid = [
    ['1', 'ด.ช. กฤต', '00051'],
    ['๒', 'ด.ญ. ณิชา', '00052']
  ];
  const table = StudentImport.detectTable(grid);
  assert.equal(table.headerRow, -1);
  assert.deepEqual(table.mapping, { fullName: 1, no: 0 });
  assert.deepEqual(StudentImport.recordsFromTable(table).map(({ name, no, studentCode }) => ({ name, no, studentCode })), [
    { name: 'ด.ช. กฤต', no: 1, studentCode: '' },
    { name: 'ด.ญ. ณิชา', no: 2, studentCode: '' }
  ]);
});

test('does not mistake alphanumeric student codes for English names in a headerless list', () => {
  const table = StudentImport.detectTable([
    ['1', 'ST-001', 'Alex Morgan'],
    ['2', 'ST-002', 'Jamie Taylor']
  ]);
  assert.equal(table.headerRow, -1);
  assert.deepEqual(table.mapping, { fullName: 2, no: 0 });
});

test('preserves leading-zero student codes and combines prefixes with split names', () => {
  const table = StudentImport.detectTable([
    ['รหัสประจำตัวนักเรียน', 'คำนำหน้า', 'ชื่อผู้เรียน', 'นามสกุล', 'เลขที่'],
    ['000045', 'ด.ญ.', 'อรทัย', 'ใจดี', '๐๗']
  ]);
  assert.deepEqual(StudentImport.recordsFromTable(table), [
    { rowIndex: 0, name: 'ด.ญ. อรทัย ใจดี', no: 7, studentCode: '000045' }
  ]);
});

test('supports a teacher-corrected column mapping when headings are unfamiliar', () => {
  const table = {
    rows: [['0012', 'นาย', 'ภาคิน', 'บุญมา']],
    mapping: { code: 0, title: 1, firstName: 2, lastName: 3 }
  };
  assert.deepEqual(StudentImport.recordsFromTable(table), [
    { rowIndex: 0, name: 'นาย ภาคิน บุญมา', no: null, studentCode: '0012' }
  ]);
});

test('selects the strongest student roster among workbook sheets', () => {
  const metadata = { sheetName: 'ข้อมูลโรงเรียน', ...StudentImport.detectTable([['โรงเรียน', 'ปีการศึกษา'], ['ตัวอย่าง', '2569']]) };
  const roster = { sheetName: 'รายชื่อนักเรียน', ...StudentImport.detectTable(layouts[1].grid) };
  const selected = StudentImport.selectBestSheet([metadata, roster]);
  assert.equal(selected.sheetName, 'รายชื่อนักเรียน');
  assert.equal(StudentImport.selectBestSheet([metadata]), metadata);
});

test('returns an empty table for a blank worksheet', () => {
  assert.deepEqual(StudentImport.detectTable([[], [''], [null, '  ']]), {
    headers: [], rows: [], headerRow: -1, mapping: {}, confidence: 0
  });
});
