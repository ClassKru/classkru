const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const studentsSource = fs.readFileSync(path.join(root, 'js/students.js'), 'utf8');
const attendanceCss = fs.readFileSync(path.join(root, 'css/06-attendance.css'), 'utf8');

function renderRoster(students) {
  const cards = [];
  const elements = {
    'web-students-list': { innerHTML: '', appendChild(card) { cards.push(card); } },
    'web-student-class-filter': { value: 'class-1', innerHTML: '' },
    'web-students-content-area': { style: {} },
    'web-students-empty-state': { style: {} },
    'students-classtab-holder': { innerHTML: '' },
    'web-students-detail-title': { innerHTML: '' },
    'web-student-search-input': { value: '' },
    'web-students-count-label': { innerText: '' }
  };
  const context = {
    window: { addEventListener() {} },
    document: {
      getElementById(id) { return elements[id] || null; },
      createElement() {
        return { setAttribute() {}, className: '', tabIndex: 0, innerHTML: '' };
      }
    },
    appState: {
      classes: [{ id: 'class-1', subject: 'วิทยาศาสตร์', className: 'ม.2/1', students }]
    },
    renderClassTabBar: () => '',
    getClassColor: () => ({ text: '#168c68' }),
    mscAvatar: () => ({ bg: '#e1f5ee', fg: '#0f6e56' }),
    mscAvatarImageSource(student) {
      if (student.photoBase64) return student.photoBase64;
      return `/assets/student-avatar-cartoon-v2-${student.no}.png`;
    }
  };
  vm.runInNewContext(studentsSource, context, { filename: 'students.js' });
  context.renderWebStudents();
  return cards.map(card => card.innerHTML);
}

test('roster shows a default cartoon portrait and preserves a teacher-uploaded photo', () => {
  const markup = renderRoster([
    { id: 'student-1', no: 1, name: 'นักเรียน ตัวอย่าง' },
    { id: 'student-2', no: 2, name: 'นักเรียน อีกคน', photoBase64: 'data:image/png;base64,teacher-photo' }
  ]);

  assert.match(markup[0], /class="is-default-avatar" src="\/assets\/student-avatar-cartoon-v2-1\.png"/);
  assert.match(markup[0], /loading="lazy" decoding="async"/);
  assert.match(markup[1], /class="is-uploaded-avatar" src="data:image\/png;base64,teacher-photo"/);
});

test('cartoon roster portraits are bundled and fit transparent artwork on desktop and mobile', () => {
  for (let version = 2; version <= 3; version += 1) {
    for (const number of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
      const asset = `/assets/student-avatar-cartoon-v${version}-${number}.png`;
      assert.ok(fs.existsSync(path.join(root, asset.slice(1))), `${asset} should exist`);
    }
  }

  assert.match(attendanceCss, /\.student-card-avatar img\.is-default-avatar\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(attendanceCss, /@media \(max-width: 640px\)\s*\{[\s\S]*?\.student-card-avatar\s*\{[^}]*border-radius:\s*50%/);
});
