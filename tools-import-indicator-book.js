const fs = require('fs');
const path = require('path');

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const digit = value => String(value).replace(/[๐-๙]/g, value => String(THAI_DIGITS.indexOf(value)));
const clean = value => value
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/\s+/g, ' ')
  .trim();

const subjects = [
  { id: 'thai', key: 'THAI', letter: 'ท', prefix: 'TH', name: 'ภาษาไทย', revision: 2551, pages: { M1: [19, 31], M2: [19, 31], M3: [19, 31] } },
  { id: 'math', key: 'MATH', letter: 'ค', prefix: 'MA', name: 'คณิตศาสตร์', revision: 2560, pages: { M1: [46, 55], M2: [46, 55], M3: [46, 55] } },
  { id: 'social', key: 'SOCIAL', letter: 'ส', prefix: 'SO', name: 'สังคมศึกษา ศาสนา และวัฒนธรรม', revision: 2560, pages: { M1: [131, 152], M2: [131, 152], M3: [131, 152] } },
  { id: 'health', key: 'HEALTH', letter: 'พ', prefix: 'HE', name: 'สุขศึกษาและพลศึกษา', revision: 2551, pages: { M1: [168, 180], M2: [168, 180], M3: [168, 180] } },
  { id: 'art', key: 'ART', letter: 'ศ', prefix: 'AR', name: 'ศิลปะ', revision: 2551, pages: { M1: [195, 206], M2: [195, 206], M3: [195, 206] } },
  { id: 'career', key: 'CAREER', letter: 'ง', prefix: 'CA', name: 'การงานอาชีพ', revision: 2551, pages: { M1: [214, 218], M2: [214, 218], M3: [214, 218] } },
  { id: 'foreign', key: 'FOREIGN', letter: 'ต', prefix: 'FO', name: 'ภาษาต่างประเทศ (ภาษาอังกฤษ)', revision: 2551, pages: { M1: [235, 248], M2: [235, 248], M3: [235, 248] } }
];

function extractPages(html) {
  const start = html.indexOf('<div class="flip-basic-text">');
  const end = html.indexOf('<div class="flip-book-nav">', start);
  return html.slice(start, end > start ? end : undefined)
    .split('<div class="flip-basic-text">')
    .slice(1)
    .map(clean);
}

function normalizeStandard(letter, raw) {
  const match = digit(raw).match(new RegExp(`${letter}\\s*[.]?\\s*(\\d+)\\s*[.]\\s*(\\d+)`));
  return match ? `${match[1]}.${match[2]}` : null;
}

function extractSubject(subject, pages) {
  const selected = [];
  Object.entries(subject.pages).forEach(([grade, [first, last]]) => {
    for (let page = first; page <= last; page += 1) selected.push({ grade, page, text: digit(pages[page - 1] || '') });
  });

  const standardTitles = new Map();
  const standardStrands = new Map();
  let currentStrand = '';
  selected.forEach(({ text }) => {
    const eventPattern = new RegExp(`สาระที่\\s*\\d+\\s+([^]*?)(?=กลุ่มที่|มาตรฐาน)|มาตรฐาน\\s+${subject.letter}\\s*\\d+\\s*[.]\\s*\\d+\\s+([^]*?)(?=มาตรฐาน|\\s+\\d+\\s+${subject.letter}\\s*\\d+\\s*[.]|สาระที่|$)`, 'g');
    let event;
    while ((event = eventPattern.exec(text))) {
      if (event[1]) {
        currentStrand = event[1].trim();
      } else {
        const header = event[0];
        const code = normalizeStandard(subject.letter, header);
        const title = (event[2] || '')
          .split(new RegExp(`(?=\\s+\\d+\\s+-?\\s*${subject.letter}\\s*[.]?\\s*\\d+\\s*[.]|รวม\\s*\\d+\\s*ตัวชี้วัด)`))[0]
          .replace(/\s+กลุ่มที่.*$/, '')
          .trim();
        const previous = standardTitles.get(code) || '';
        if (code && title.length > 12 && (!previous || title.length < previous.length)) standardTitles.set(code, title);
        if (code && currentStrand) standardStrands.set(code, currentStrand);
      }
    }
  });

  const indicators = [];
  const seen = new Set();
  const codePattern = new RegExp(`${subject.letter}\\s*[.]?\\s*(\\d+)\\s*[.]\\s*(\\d+)\\s*ม[.]?\\s*([123])\\s*[/]\\s*(\\d+)`, 'g');
  selected.forEach(({ grade, page, text }) => {
    const matches = [...text.matchAll(codePattern)].filter(match => `M${match[3]}` === grade);
    matches.forEach((match, index) => {
      let standardNumber = `${match[1]}.${match[2]}`;
      const itemNumber = Number(match[4]);
      let description = text.slice(match.index + match[0].length, matches[index + 1]?.index ?? text.length);
      description = description
        .split(/(?=สาระที่\s*\d+|มาตรฐาน\s+[ก-ฮ]\s*\d+\s*[.]|รวม\s*\d+\s*ตัวชี้วัด|หมายเหตุ\s*[*]?)/)[0]
        .replace(/\s+(?:\d+|-)\s*$/, '')
        .trim();
      // The 2566 consolidated table has three known printing errors. Correct them
      // to the codes in the subject curriculum before de-duplication.
      if (subject.id === 'social' && grade === 'M2' && page === 138 && standardNumber === '3.2' && /ปัจจัยการผลิต|คุ้มครองสิทธิ/.test(description)) standardNumber = '3.1';
      if (subject.id === 'social' && grade === 'M3' && page === 142 && standardNumber === '1.1' && itemNumber === 5 && /ดำรงชีวิตอย่างมีความสุข/.test(description)) standardNumber = '2.1';
      const code = `${subject.letter} ${standardNumber} ม.${match[3]}/${itemNumber}`;
      if (seen.has(code)) return;
      if (!description || description.length < 5) throw new Error(`Missing text for ${code} on page ${page}`);
      seen.add(code);
      indicators.push({
        id: `${subject.prefix}${subject.revision}-${standardNumber.replace('.', '')}-M${match[3]}-${itemNumber}`,
        code,
        standard: `${subject.prefix}${standardNumber}`,
        grade,
        unitId: `${grade.toLowerCase()}-${subject.prefix.toLowerCase()}${standardNumber.replace('.', '-')}`,
        text: description,
        sourcePage: page,
        sourcePdfPage: page
      });
    });
  });

  const standardsUsed = [...new Set(indicators.map(item => item.standard))];
  const standards = standardsUsed.map(id => {
    const number = id.slice(subject.prefix.length);
    return {
      id,
      code: `${subject.letter} ${number}`,
      title: standardTitles.get(number) || `มาตรฐาน ${subject.letter} ${number}`,
      strand: standardStrands.get(number) || subject.name
    };
  });
  const units = [];
  for (const grade of ['M1', 'M2', 'M3']) {
    standards.filter(standard => indicators.some(item => item.grade === grade && item.standard === standard.id)).forEach(standard => {
      units.push({
        id: `${grade.toLowerCase()}-${standard.id.toLowerCase().replace('.', '-')}`,
        grade,
        title: standard.strand,
        description: standard.title
      });
    });
  }
  return { standards, units, indicators };
}

function render(subject, dataset) {
  const source = {
    id: `TH-BEC-2551-${subject.key}-${subject.revision}`,
    title: `ตัวชี้วัดและสาระการเรียนรู้แกนกลาง กลุ่มสาระการเรียนรู้${subject.name}`,
    framework: 'หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พ.ศ. 2551',
    revisionYear: subject.revision,
    publisher: 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน',
    url: 'https://www.academic.obec.go.th/web/news/view/75',
    retrievedAt: '2026-09-02',
    scope: 'มัธยมศึกษาตอนต้น ม.1-ม.3'
  };
  return `/**\n * Generated from the official OBEC indicator tables.\n * Run tools-import-indicator-book.js to regenerate.\n */\n(function () {\n  'use strict';\n\n  const source = ${JSON.stringify(source)};\n  const standards = ${JSON.stringify(dataset.standards, null, 2)};\n  const units = ${JSON.stringify(dataset.units, null, 2)};\n  const indicators = ${JSON.stringify(dataset.indicators, null, 2)};\n\n  window.CK_CURRICULUM_${subject.key}_${subject.revision} = { source, standards, units, indicators };\n})();\n`;
}

const sourcePath = process.argv[2];
const outputDir = process.argv[3];
if (!sourcePath || !outputDir) throw new Error('Usage: node tools-import-indicator-book.js <fliphtml-page> <output-directory>');
const pages = extractPages(fs.readFileSync(sourcePath, 'utf8'));
if (pages.length < 243) throw new Error(`Expected at least 243 pages, found ${pages.length}`);

if (outputDir === '--inspect') {
  pages.forEach((page, index) => {
    if (/สรุปตัวชี้วัดระหว่างทาง|ชั้นมัธยมศึกษาปีที่\s*[123]/.test(page)) {
      console.log(`${index + 1}: ${page.slice(0, 420)}`);
    }
  });
  process.exit(0);
}
if (outputDir === '--pages') {
  process.argv.slice(4).map(Number).forEach(pageNumber => console.log(`\n===== PAGE ${pageNumber} =====\n${pages[pageNumber - 1] || ''}`));
  process.exit(0);
}

for (const subject of subjects) {
  const dataset = extractSubject(subject, pages);
  const counts = Object.fromEntries(['M1', 'M2', 'M3'].map(grade => [grade, dataset.indicators.filter(item => item.grade === grade).length]));
  const target = path.join(outputDir, `curriculum-${subject.id}-${subject.revision}.js`);
  fs.writeFileSync(target, render(subject, dataset), 'utf8');
  console.log(`${subject.id}: ${dataset.indicators.length} (${Object.entries(counts).map(([grade, count]) => `${grade}=${count}`).join(', ')})`);
}
