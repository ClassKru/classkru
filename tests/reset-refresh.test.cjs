const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Reload JS globals while retaining browser storage and simulated server rows.
const storage = new Map([
  ['classkru_relational_v1', '1'], ['classkru_skip_sync', '1'],
  ['classmanager_email', 'teacher@example.com']
]);
const tables = new Map();
const rows = table => {
  if (!tables.has(table)) tables.set(table, []);
  return tables.get(table);
};
const client = {
  auth: { async getUser() { return { data: { user: { id: 'teacher-1' } } }; } },
  from(table) {
    let filters = [], values, start = 0, end = Infinity, single = false;
    const query = {
      select() { return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      is(key, value) { filters.push(row => row[key] === value); return query; },
      limit(count) { end = count - 1; return query; },
      range(a, b) { start = a; end = b; return query; },
      maybeSingle() { single = true; return query; },
      update(next) { values = next; return query; },
      async upsert(data, options) {
        for (const row of Array.isArray(data) ? data : [data]) {
          const keys = options.onConflict.split(',');
          const existing = rows(table).find(old => keys.every(key => old[key] === row[key]));
          if (existing) Object.assign(existing, structuredClone(row));
          else rows(table).push(structuredClone(row));
        }
        return { error: null };
      },
      then(resolve, reject) {
        const selected = rows(table).filter(row => filters.every(filter => filter(row)));
        if (values) selected.forEach(row => Object.assign(row, structuredClone(values)));
        const result = structuredClone(selected.slice(start, end + 1));
        return Promise.resolve({ data: single ? result[0] || null : result, error: null }).then(resolve, reject);
      }
    };
    return query;
  }
};

function reload() {
  const context = vm.createContext({
    console, structuredClone, setTimeout, clearTimeout,
    navigator: { onLine: true },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    window: { addEventListener() {}, location: { reload() {} } },
    document: { getElementById() { return null; } },
    appState: {}, STORAGE_KEY: 'state', supabaseClient: client,
    pendingDeepLink: null, pendingDeepLinkParam: null,
    normalizeTimetableEntries: entries => entries || [],
    updateProfileImages() {}, navigateToWebScreen() {}, showToast() {}
  });
  for (const file of ['relational-sync.js', 'shared-utils.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
  }
  vm.runInContext('initAppState()', context);
  return context;
}
const run = (context, code) => vm.runInContext(code, context);

(async () => {
  let context = reload();
  await run(context, "syncBackgroundCloud('teacher@example.com')");
  assert.equal(run(context, 'relationalTeacherIdValue'), 'teacher-1', 'reset must still initialize the authenticated writer');
  assert.equal(storage.has('classkru_skip_sync'), false);
  assert.equal(rows('teacher_profiles').length, 1, 'a new account must have a profile before its first class write');
  await run(context, `appState.classes.push({ id: 'first-class', subject: 'วิทยาศาสตร์', className: 'ม.1/1', students: [], attendance: {} }); saveState()`);
  assert.equal(rows('classrooms').length, 1, 'first classroom must reach the server');
  context = reload();
  await run(context, "syncBackgroundCloud('teacher@example.com')");
  assert.equal(context.appState.classes[0]?.id, 'first-class', 'classroom must survive a refresh');

  // Local cache reset must restore cloud rooms without deleting any remote rows.
  context.showConfirm = (_message, callback) => callback();
  context.setTimeout = () => 0;
  run(context, 'resetApplicationData()');
  assert.equal(storage.has('classkru_skip_sync'), false);
  context = reload();
  await run(context, "syncBackgroundCloud('teacher@example.com')");
  assert.equal(context.appState.classes[0]?.id, 'first-class');
  assert.equal(rows('classrooms')[0].deleted_at, null);

  // Failed cloud writes must not leave a highlight on the closed class form.
  const step = { advance: 'action:class-created' };
  let completed, advances = 0;
  context.Tour = { active: true, steps: [step], i: 0, end(value) { completed = value; this.active = false; } };
  context.notifyTourAction = () => advances++;
  run(context, "notifyTourActionAfterSaved('class-created', Promise.resolve(false))");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed, undefined, 'a failed cloud write must not end the guide');
  assert.equal(context.Tour.active, true);
  assert.equal(advances, 1, 'the guide must continue from the local save');

  context.Tour.active = true;
  let finishSave;
  context.pendingSave = new Promise(resolve => { finishSave = resolve; });
  run(context, "notifyTourActionAfterSaved('class-created', pendingSave)");
  assert.equal(advances, 1, 'guide must wait for the actual save');
  finishSave(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(advances, 2);
  console.log('reset-refresh tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
