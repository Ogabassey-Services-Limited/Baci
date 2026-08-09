import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { authenticatedTreeRows } from './source-manifest-tree.mjs';

test('walks authenticated nested tree bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'source-manifest-tree-'));
  try {
    execFileSync('/usr/bin/git', ['init', '-q', root]);
    execFileSync('/usr/bin/git', ['-C', root, 'config', 'user.name', 'test']);
    execFileSync('/usr/bin/git', [
      '-C',
      root,
      'config',
      'user.email',
      'test@invalid',
    ]);
    mkdirSync(join(root, 'nested'), { recursive: true });
    writeFileSync(join(root, 'nested/file.txt'), 'tree\n');
    execFileSync('/usr/bin/git', ['-C', root, 'add', '.']);
    execFileSync('/usr/bin/git', ['-C', root, 'commit', '-qm', 'tree']);
    const sha = execFileSync(
      '/usr/bin/git',
      ['-C', root, 'rev-parse', 'HEAD'],
      { encoding: 'utf8' }
    ).trim();
    assert.deepEqual(
      authenticatedTreeRows(root, sha).map(({ mode, path }) => ({
        mode,
        path,
      })),
      [{ mode: '100644', path: 'nested/file.txt' }]
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects non-commit and malformed-commit objects while authenticating symlinks', () => {
  const root = mkdtempSync(join(tmpdir(), 'source-manifest-tree-invalid-'));
  try {
    execFileSync('/usr/bin/git', ['init', '-q', root]);
    execFileSync('/usr/bin/git', ['-C', root, 'config', 'user.name', 'test']);
    execFileSync('/usr/bin/git', [
      '-C',
      root,
      'config',
      'user.email',
      'test@invalid',
    ]);
    const blob = execFileSync(
      '/usr/bin/git',
      ['-C', root, 'hash-object', '-w', '--stdin'],
      { input: 'blob\n', encoding: 'utf8' }
    ).trim();
    assert.throws(
      () => authenticatedTreeRows(root, blob),
      /source SHA must name a commit/
    );
    const malformed = execFileSync(
      '/usr/bin/git',
      [
        '-C',
        root,
        'hash-object',
        '--literally',
        '-t',
        'commit',
        '-w',
        '--stdin',
      ],
      {
        input: 'author test <test@invalid> 0 +0000\n\nmessage\n',
        encoding: 'utf8',
      }
    ).trim();
    assert.throws(
      () => authenticatedTreeRows(root, malformed),
      /malformed Git commit object/
    );
    execFileSync('/usr/bin/git', [
      '-C',
      root,
      'update-index',
      '--add',
      '--cacheinfo',
      `120000,${blob},link`,
    ]);
    const tree = execFileSync('/usr/bin/git', ['-C', root, 'write-tree'], {
      encoding: 'utf8',
    }).trim();
    const commit = execFileSync(
      '/usr/bin/git',
      ['-C', root, 'commit-tree', tree],
      { input: 'tree\n', encoding: 'utf8' }
    ).trim();
    assert.deepEqual(
      authenticatedTreeRows(root, commit).map(({ mode, path }) => ({
        mode,
        path,
      })),
      [{ mode: '120000', path: 'link' }]
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects non-UTF-8 Git tree names before path projection', () => {
  const root = mkdtempSync(join(tmpdir(), 'source-manifest-tree-utf8-'));
  try {
    execFileSync('/usr/bin/git', ['init', '-q', root]);
    const blob = execFileSync(
      '/usr/bin/git',
      ['-C', root, 'hash-object', '-w', '--stdin'],
      { input: Buffer.from('blob\n') }
    )
      .toString()
      .trim();
    const treeBytes = Buffer.concat([
      Buffer.from('100644 invalid'),
      Buffer.from([0xff, 0]),
      Buffer.from(blob, 'hex'),
    ]);
    const tree = execFileSync(
      '/usr/bin/git',
      ['-C', root, 'hash-object', '--literally', '-t', 'tree', '-w', '--stdin'],
      { input: treeBytes }
    )
      .toString()
      .trim();
    const commit = execFileSync(
      '/usr/bin/git',
      [
        '-c',
        'user.name=test',
        '-c',
        'user.email=test@invalid',
        '-C',
        root,
        'commit-tree',
        tree,
      ],
      {
        input:
          'author test <test@invalid> 0 +0000\ncommitter test <test@invalid> 0 +0000\n\ninvalid\n',
      }
    )
      .toString()
      .trim();
    assert.throws(
      () => authenticatedTreeRows(root, commit),
      /non-UTF-8 Git tree name/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
