const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const events = [];
const context = vm.createContext({
  console: { ...console, warn() {} },
  structuredClone,
  setTimeout,
  clearTimeout,
  document: { getElementById() { return null; }, querySelector() { return null; } },
  window: { location: { reload() {} } },
  supabaseClient: {
    from() {
      return {
        async upsert(row) {
          const version = row.state.lastModified;
          events.push(`start:${version}`);
          await new Promise(resolve => setTimeout(resolve, version === 1 ? 30 : 0));
          events.push(`end:${version}`);
          return { error: null };
        }
      };
    }
  }
});

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'shared-utils.js'), 'utf8');
vm.runInContext(source, context, { filename: 'shared-utils.js' });

(async () => {
  const first = vm.runInContext("enqueueCloudStateWrite('teacher@example.com',{lastModified:1},{strict:true})", context);
  const second = vm.runInContext("enqueueCloudStateWrite('teacher@example.com',{lastModified:2},{strict:true})", context);
  await Promise.all([first, second]);
  assert.deepEqual(events, ['start:1', 'end:1', 'start:2', 'end:2'], 'cloud writes must finish in the same order they were queued');
  console.log('cloud-write-queue tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
