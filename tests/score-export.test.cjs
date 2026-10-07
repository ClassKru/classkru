'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('xlsx-js-style');
const { unzipSync } = require('fflate');

function makeContext() {
  const context = vm.createContext({
    console,
    window: {},
    document: { getElementById: () => null }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/scores.js'), 'utf8'), context);
  context.clampMark = (value, max) => value === '' || value == null ? '' : Math.min(Number(value), Number(max));
  context.computeStudentScore = (_classroom, studentId) => ({ total: studentId === 's1' ? 82 : 0 });
  context.effectiveGrade = (_classroom, studentId) => studentId === 's1' ? '3' : '0';
  context.XLSX = XLSX;
  return context;
}

test('score export builds a styled, readable workbook without filter dropdowns or trailing decimal points', () => {
  const context = makeContext();
  const classroom = {
    subject: 'คณิตศาสตร์',
    className: 'ป.1/2',
    students: [
      { id: 's1', no: 1, studentCode: '13001', name: 'ด.ช.ตัวอย่าง' },
      { id: 's2', no: 2, studentCode: '13002', name: 'ด.ญ.ตัวอย่าง' },
      { id: 's3', no: 3, studentCode: '13003', name: 'ด.ช.ยังไม่กรอกคะแนน' }
    ],
    scores: {
      items: [
        { id: 'work1', name: 'ใบงานที่ 1', bucket: 'before', max: 10 },
        { id: 'mid', name: 'สอบกลางภาค', bucket: 'mid', max: 20 }
      ],
      marks: { work1: { s1: 10, s2: 8.5 }, mid: { s1: 17, s2: '' } },
      gradeOverride: {}
    }
  };

  const built = context.buildScoreSheet(classroom, true);
  assert.equal(built.aoa[0][0], 'สมุดคะแนน · คณิตศาสตร์ ป.1/2');
  assert.ok(built.merges.some(range => range.s.r === 0 && range.s.c === 0 && range.e.c === 2));
  assert.deepEqual(Array.from(built.aoa[1]), ['เลขที่', 'เลขประจำตัว', 'ชื่อ-สกุล', 'ใบงานที่ 1', 'สอบกลางภาค', 'รวม', 'ระดับผลการเรียน']);
  assert.equal(built.aoa[3][3], 10);
  assert.equal(built.aoa[4][3], 8.5);
  assert.equal(built.aoa[4][5], 0);
  assert.equal(built.aoa[5][5], '');
  assert.equal(built.aoa[5][6], '');

  const worksheet = context.XLSX.utils.aoa_to_sheet(built.aoa);
  worksheet['!merges'] = built.merges;
  worksheet['!cols'] = built.cols;
  context.styleScoreWorksheet(worksheet, built, classroom.students.length);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'คะแนน');
  const generatedFile = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const zip = unzipSync(new Uint8Array(generatedFile));
  const stylesXml = new TextDecoder().decode(zip['xl/styles.xml']);
  const sheetXml = new TextDecoder().decode(zip['xl/worksheets/sheet1.xml']);
  const pageHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const cellStyle = address => {
    const match = sheetXml.match(new RegExp(`<c r="${address}"([^>]*)>`));
    assert.ok(match, `generated workbook contains cell ${address}`);
    return match[1].match(/\bs="(\d+)"/)?.[1];
  };

  assert.match(stylesXml, /<name val="TH SarabunPSK"\/>/);
  assert.match(stylesXml, /<sz val="14"\/>/);
  assert.match(stylesXml, /rgb="FF0F6E56"/);
  assert.match(stylesXml, /rgb="FFF4FAF6"/);
  assert.match(stylesXml, /rgb="FFE8F3ED"/);
  assert.match(stylesXml, /formatCode="0\.##"/);
  assert.notEqual(cellStyle('A1'), undefined, 'merged title has an applied style');
  assert.notEqual(cellStyle('D2'), undefined, 'header has an applied style');
  assert.notEqual(cellStyle('D4'), undefined, 'score cells have an applied style');
  assert.notEqual(cellStyle('D4'), cellStyle('D5'), 'alternating score rows use distinct styles');
  assert.match(sheetXml, /<mergeCell ref="A1:C1"\/>/);
  assert.match(sheetXml, /<row r="1"[^>]*ht="36"/);
  assert.match(sheetXml, /<row r="2"[^>]*ht="44"/);
  assert.doesNotMatch(sheetXml, /<autoFilter\b/, 'export contains no filter dropdowns');
  assert.match(pageHtml, /xlsx-js-style@1\.2\.0\/dist\/xlsx\.bundle\.js/, 'the app loads the style-capable writer');
  assert.equal(worksheet['!rows'][0].hpt, 36);
  assert.equal(worksheet['!rows'][1].hpt, 44);
});
