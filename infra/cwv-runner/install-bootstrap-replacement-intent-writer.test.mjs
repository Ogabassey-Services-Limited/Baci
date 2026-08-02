import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { persistBootstrapReplacementIntent } from './install-bootstrap-replacement-intent-writer.mjs';
import fixture from './install-bootstrap-replacement-receipt.test-fixture.mjs';

test('resumes an interrupted intent digest write without changing value bytes', async (context) => {
  const directory = await fixture.temporary(context, 'baci-bootstrap-intent-');
  await assert.rejects(
    persistBootstrapReplacementIntent(directory, fixture.intent, {
      afterValue: () => {
        throw new Error('crash after replacement intent');
      },
    }),
    /crash after replacement intent/
  );
  const before = await readFile(
    join(directory, 'replacement-intent.json'),
    'utf8'
  );
  await persistBootstrapReplacementIntent(directory, fixture.intent);
  assert.equal(
    await readFile(join(directory, 'replacement-intent.json'), 'utf8'),
    before
  );
  assert.match(
    await readFile(join(directory, 'replacement-intent.sha256'), 'utf8'),
    /^[a-f0-9]{64}\n$/
  );
});

test('persists replacement intents at mode 0600 under a restrictive umask', async (context) => {
  const directory = await fixture.temporary(context, 'baci-bootstrap-mode-');
  const previousUmask = process.umask(0o277);
  try {
    await persistBootstrapReplacementIntent(directory, fixture.intent);
  } finally {
    process.umask(previousUmask);
  }
  assert.equal(
    (await stat(join(directory, 'replacement-intent.json'))).mode & 0o777,
    0o600
  );
  assert.equal(
    (await stat(join(directory, 'replacement-intent.sha256'))).mode & 0o777,
    0o600
  );
});
