import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { authenticatedTreeRows } from './source-manifest-tree.mjs';

test('walks authenticated nested tree bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'source-manifest-tree-'));
  try {
    execFileSync('/usr/bin/git', ['init', '-q', root]);
    execFileSync('/usr/bin/git', ['-C', root, 'config', 'user.name', 'test']);
    execFileSync('/usr/bin/git', ['-C', root, 'config', 'user.email', 'test@invalid']);
    execFileSync('/bin/mkdir', ['-p', join(root, 'nested')]);
    writeFileSync(join(root, 'nested/file.txt'), 'tree\n');
    execFileSync('/usr/bin/git', ['-C', root, 'add', '.']);
    execFileSync('/usr/bin/git', ['-C', root, 'commit', '-qm', 'tree']);
    const sha = execFileSync('/usr/bin/git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    assert.deepEqual(authenticatedTreeRows(root, sha).map(({ mode, path }) => ({ mode, path })), [{ mode: '100644', path: 'nested/file.txt' }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
