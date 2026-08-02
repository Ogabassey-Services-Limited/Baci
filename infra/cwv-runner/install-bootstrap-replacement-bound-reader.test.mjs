import assert from 'node:assert/strict';
import test from 'node:test';

import { readBoundReplacement } from './install-bootstrap-replacement-bound-reader.mjs';
import { persistBoundReplacement } from './install-bootstrap-replacement-bound-writer.mjs';
import fixture from './install-bootstrap-replacement-receipt.test-fixture.mjs';

test('validates a bound replacement against its operation schema', async (context) => {
  const directory = await fixture.temporary(context, 'baci-bootstrap-reader-');
  await persistBoundReplacement(
    directory,
    'replacement-intent',
    fixture.intent,
    'replacement intent drift'
  );
  assert.deepEqual(
    await readBoundReplacement(directory, 'replacement-intent', false),
    fixture.intent
  );

  const invalidDirectory = await fixture.temporary(
    context,
    'baci-bootstrap-invalid-reader-'
  );
  await persistBoundReplacement(
    invalidDirectory,
    'replacement-intent',
    { ...fixture.intent, unexpected: true },
    'replacement intent drift'
  );
  await assert.rejects(
    readBoundReplacement(invalidDirectory, 'replacement-intent', false),
    /invalid bootstrap replacement-intent/
  );
});
