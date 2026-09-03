const path = require('path');

global.window = {};
const definitions = [
  { id: 'thai', file: 'curriculum-thai-2551.js', key: 'CK_CURRICULUM_THAI_2551', expected: { P1: 22, P2: 27, P3: 31, P4: 33, P5: 33, P6: 34, M1: 35, M2: 32, M3: 36, M4_6: 36 } },
  { id: 'math', file: 'curriculum-math-2560.js', key: 'CK_CURRICULUM_MATH_2560', expected: { P1: 10, P2: 16, P3: 28, P4: 22, P5: 19, P6: 21, M1: 9, M2: 12, M3: 12, M4: 3, M5: 4, M6: 1 } },
  { id: 'science', file: 'curriculum-science-2560.js', key: 'CK_CURRICULUM_SCIENCE_2560', expected: { P1: 15, P2: 16, P3: 25, P4: 21, P5: 32, P6: 30, M1: 52, M2: 63, M3: 59, M4: 28, M5: 49, M6: 25 } },
  { id: 'social', file: 'curriculum-social-2560.js', key: 'CK_CURRICULUM_SOCIAL_2560', expected: { P1: 31, P2: 34, P3: 39, P4: 38, P5: 36, P6: 39, M1: 45, M2: 45, M3: 50, M4_6: 61 } },
  { id: 'health', file: 'curriculum-health-2551.js', key: 'CK_CURRICULUM_HEALTH_2551', expected: { P1: 15, P2: 21, P3: 18, P4: 19, P5: 25, P6: 22, M1: 23, M2: 25, M3: 24, M4_6: 29 } },
  { id: 'art', file: 'curriculum-art-2551.js', key: 'CK_CURRICULUM_ART_2551', expected: { P1: 18, P2: 25, P3: 29, P4: 29, P5: 26, P6: 27, M1: 27, M2: 27, M3: 32, M4_6: 39 } },
  { id: 'career', file: 'curriculum-career-2551.js', key: 'CK_CURRICULUM_CAREER_2551', expected: { P1: 3, P2: 3, P3: 3, P4: 5, P5: 6, P6: 5, M1: 6, M2: 6, M3: 6, M4_6: 11 } },
  { id: 'foreign', file: 'curriculum-foreign-2551.js', key: 'CK_CURRICULUM_FOREIGN_2551', expected: { P1: 16, P2: 16, P3: 18, P4: 20, P5: 20, P6: 20, M1: 20, M2: 21, M3: 21, M4_6: 21 } }
];

for (const definition of definitions) require(path.join(__dirname, 'js', definition.file));

const errors = [];
const globalIds = new Set();
const globalCodes = new Set();
let total = 0;

for (const definition of definitions) {
  const dataset = window[definition.key];
  if (!dataset) {
    errors.push(`ไม่พบชุดข้อมูล: ${definition.id}`);
    continue;
  }
  const unitIds = new Set(dataset.units.map(unit => unit.id));
  const standardIds = new Set(dataset.standards.map(standard => standard.id));
  const counts = Object.fromEntries(Object.keys(definition.expected).map(grade => [grade, 0]));
  for (const item of dataset.indicators) {
    if (globalIds.has(item.id)) errors.push(`รหัสข้อมูลซ้ำ: ${item.id}`);
    if (globalCodes.has(item.code)) errors.push(`รหัสตัวชี้วัดซ้ำ: ${item.code}`);
    globalIds.add(item.id);
    globalCodes.add(item.code);
    if (!(item.grade in counts)) errors.push(`ระดับชั้นไม่รองรับ: ${item.grade}`);
    else counts[item.grade] += 1;
    if (!unitIds.has(item.unitId)) errors.push(`ไม่พบหัวข้อ ${item.unitId}: ${item.code}`);
    if (!standardIds.has(item.standard)) errors.push(`ไม่พบมาตรฐาน ${item.standard}: ${item.code}`);
    if (!item.text || item.text.length < 8) errors.push(`ข้อความไม่สมบูรณ์: ${item.code}`);
    if (/ตัวชี้วัดระหว่างทาง|ตัวชี้วัดปลายทาง|รวม\s+\d+\s+ตัวชี้วัด/.test(item.text)) errors.push(`ข้อความมีหัวตารางปะปน: ${item.code}`);
    if (!Number.isInteger(item.sourcePage) || item.sourcePage < 1) errors.push(`เลขหน้าไม่ถูกต้อง: ${item.code}`);
  }
  for (const [grade, expectedCount] of Object.entries(definition.expected)) {
    if (counts[grade] !== expectedCount) errors.push(`${definition.id} ${grade} ควรมี ${expectedCount} รายการ แต่พบ ${counts[grade]}`);
    const byStandard = new Map();
    dataset.indicators.filter(item => item.grade === grade).forEach(item => {
      if (!byStandard.has(item.standard)) byStandard.set(item.standard, []);
      byStandard.get(item.standard).push(Number(item.code.split('/')[1]));
    });
    if (grade === 'M4_6') continue;
    for (const [standard, numbers] of byStandard) {
      for (let number = 1; number <= Math.max(...numbers); number += 1) {
        if (!numbers.includes(number)) errors.push(`ลำดับตัวชี้วัดขาด: ${definition.id} ${grade} ${standard}/${number}`);
      }
    }
  }
  total += dataset.indicators.length;
  console.log(`${definition.id}: ${dataset.indicators.length} indicators (${Object.entries(counts).map(([grade, count]) => `${grade}=${count}`).join(', ')})`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
require(path.join(__dirname, 'js', 'curriculum-catalog.js'));
const stats = window.CKCurriculumCatalog.getStats();
if (stats.subjects !== 8 || stats.availableSubjects !== 8 || stats.indicators !== total) {
  console.error(`Catalog summary mismatch: ${JSON.stringify(stats)}`);
  process.exit(1);
}
for (const definition of definitions) {
  const first = window[definition.key].indicators[0];
  const results = window.CKCurriculumCatalog.search({ subjectId: definition.id, grade: first.grade, query: first.code });
  if (!results.some(item => item.id === first.id)) {
    console.error(`Catalog search failed: ${definition.id} ${first.code}`);
    process.exit(1);
  }
}
console.log(`Curriculum OK: ${total} indicators across ${definitions.length} subjects`);
