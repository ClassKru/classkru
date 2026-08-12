const path = require('path');

global.window = {};
require(path.join(__dirname, 'js/curriculum-science-2560.js'));

const dataset = window.CK_CURRICULUM_SCIENCE_2560;
const expected = { M1: 52, M2: 63, M3: 59 };
const errors = [];
const ids = new Set();
const codes = new Set();
const units = new Set(dataset.units.map(unit => unit.id));
const standards = new Set(dataset.standards.map(standard => standard.id));
const counts = { M1: 0, M2: 0, M3: 0 };

for (const item of dataset.indicators) {
  if (ids.has(item.id)) errors.push(`รหัสข้อมูลซ้ำ: ${item.id}`);
  if (codes.has(item.code)) errors.push(`รหัสตัวชี้วัดซ้ำ: ${item.code}`);
  ids.add(item.id);
  codes.add(item.code);
  if (!counts[item.grade] && counts[item.grade] !== 0) errors.push(`ระดับชั้นไม่รองรับ: ${item.grade}`);
  else counts[item.grade] += 1;
  if (!units.has(item.unitId)) errors.push(`ไม่พบหัวข้อ ${item.unitId}: ${item.code}`);
  if (!standards.has(item.standard)) errors.push(`ไม่พบมาตรฐาน ${item.standard}: ${item.code}`);
  if (!item.text || item.text.length < 12) errors.push(`ข้อความไม่สมบูรณ์: ${item.code}`);
  if (!Number.isInteger(item.sourcePage) || item.sourcePage < 1) errors.push(`เลขหน้าไม่ถูกต้อง: ${item.code}`);
}

for (const [grade, count] of Object.entries(expected)) {
  if (counts[grade] !== count) errors.push(`${grade} ควรมี ${count} รายการ แต่พบ ${counts[grade]}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Curriculum OK: ${dataset.indicators.length} indicators (${Object.entries(counts).map(([grade, count]) => `${grade}=${count}`).join(', ')})`);
