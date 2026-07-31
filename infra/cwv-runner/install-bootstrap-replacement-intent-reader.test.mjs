import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { readBootstrapReplacementIntent } from './install-bootstrap-replacement-intent-reader.mjs';
import { persistBootstrapReplacementIntent } from './install-bootstrap-replacement-intent-writer.mjs';
import fixture from './install-bootstrap-replacement-receipt.test-fixture.mjs';

test('reads a digest-bound replacement intent and rejects digest drift', async (context) => {
  const directory = await fixture.temporary(
    context,
    'baci-bootstrap-intent-reader-'
  );
  await persistBootstrapReplacementIntent(directory, fixture.intent);
  assert.deepEqual(
    await readBootstrapReplacementIntent(directory),
    fixture.intent
  );

  await writeFile(
    join(directory, 'replacement-intent.sha256'),
    `${'0'.repeat(64)}\n`
  );
  await assert.rejects(
    readBootstrapReplacementIntent(directory),
    /replacement-intent digest mismatch/
  );
});
