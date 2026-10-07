'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function columnName(index) {
  let value = index + 1;
  let result = '';
  while (value) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

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
  context.XLSX = {
    utils: {
      encode_cell: ({ r, c }) => `${columnName(c)}${r + 1}`,
      aoa_to_sheet(aoa) {
        const sheet = {};
        aoa.forEach((row, r) => row.forEach((value, c) => {
          if (value !== '') sheet[`${columnName(c)}${r + 1}`] = { v: value, t: typeof value === 'number' ? 'n' : 's' };
        }));
        return sheet;
      }
    }
  };
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

  assert.equal(worksheet.A1.s.font.name, 'TH SarabunPSK');
  assert.equal(worksheet.A1.s.font.sz, 14);
  assert.equal(worksheet.D2.s.font.name, 'TH SarabunPSK');
  assert.equal(worksheet.D2.s.font.sz, 14);
  assert.equal(worksheet.D2.s.border.left.color.rgb, 'FFFFFFFF');
  assert.equal(worksheet.E2.s.border.left.color.rgb, 'FFFFFFFF');
  assert.equal(worksheet.D4.s.fill.fgColor.rgb, 'FFF4FAF6');
  assert.equal(worksheet.D5.s.fill.fgColor.rgb, 'FFE8F3ED');
  assert.equal(worksheet.D4.s.numFmt, '0.##');
  assert.equal(worksheet.D5.s.numFmt, '0.##');
  assert.equal(worksheet.F4.s.fill.fgColor.rgb, 'FFE7F3EC');
  assert.equal(worksheet.F5.s.fill.fgColor.rgb, 'FFDDEDE4');
  assert.equal(worksheet['!autofilter'], undefined);
  assert.equal(worksheet['!rows'][0].hpt, 36);
  assert.equal(worksheet['!rows'][1].hpt, 44);
});
