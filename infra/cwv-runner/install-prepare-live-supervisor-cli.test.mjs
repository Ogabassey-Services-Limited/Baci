import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('documents the required parent start time in watch usage', () => {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('./install-prepare-live-supervisor-cli.mjs', import.meta.url)
      ),
      'watch',
    ],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /watch <transaction> <capture> <capture-sha> <policy> <directory> <start>/
  );
});
