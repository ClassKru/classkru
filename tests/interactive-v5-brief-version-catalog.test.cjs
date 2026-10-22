'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { createBriefVersionCatalog } = require('../api/_lib/interactive-v5/cloud/brief-version-catalog');

test('every listed brief version can build requests for all AI roles', () => {
  const catalog = createBriefVersionCatalog({ root: path.resolve(__dirname, '../brief-versions') });
  const versions = catalog.status().versions.map(version => version.id);

  assert.deepEqual(versions, [
    'original',
    '01-ชุดเริ่มต้น',
    '02-ชุดทดลอง',
    '03-visual-intelligence',
    '04-visual-interaction-intelligence',
    '05-visual-refinement-quality'
  ]);

  for (const version of versions) {
    for (const role of ['conversation', 'architect', 'builder']) {
      const input = role === 'conversation'
        ? { history: [], draft: {}, maxHistoryTurns: 4, mediaMode: 'normal' }
        : {};
      const request = catalog.builder(version, role)(input);
      assert.equal(typeof request.systemPrompt, 'string', `${version}/${role} system prompt`);
      assert.ok(request.systemPrompt.length > 0, `${version}/${role} system prompt is not empty`);
    }
  }
});
