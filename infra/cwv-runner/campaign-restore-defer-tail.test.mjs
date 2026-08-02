import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('deferred registration executes without post-commit cleanup', async () => {
  const source = await fs.readFile(
    new URL('./campaign-restore.sh', import.meta.url),
    'utf8'
  );
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cwv-defer-tail-'));
  const runner = path.join(root, 'tail.sh');
  const cleanup = path.join(root, 'cleanup');
  const tail = source.slice(source.lastIndexOf('restore_complete=1'));
  await fs.writeFile(
    runner,
    `#!/bin/sh\nset -eu\npost_commit_cleanup() { touch '${cleanup}'; }\nterminal_action=--defer-lease-release\n${tail}`
  );
  assert.equal(spawnSync('/bin/sh', [runner]).status, 0);
  await assert.rejects(fs.access(cleanup));
  await fs.rm(root, { force: true, recursive: true });
});
