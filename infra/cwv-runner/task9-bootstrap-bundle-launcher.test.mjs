import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { runTask9BootstrapBundleLauncher } from './task9-bootstrap-bundle-launcher.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const checkout = join(root, '../..');
const composerPath = join(root, 'task9-bootstrap-bundle-cli.mjs');
const composerSha256 = createHash('sha256').update(readFileSync(composerPath)).digest('hex');

test('rejects a modified composer before importing it', async () => {
  await assert.rejects(
    runTask9BootstrapBundleLauncher({ composerPath, composerSha256: '0'.repeat(64), argv: [], cwd: checkout }),
    /invalid Task 9 composer/
  );
});

test('hash-checks the composer before invoking its closed CLI', async () => {
  await assert.rejects(
    runTask9BootstrapBundleLauncher({ composerPath, composerSha256, argv: [], cwd: checkout }),
    /invalid Task 9 bundle invocation/
  );
});
