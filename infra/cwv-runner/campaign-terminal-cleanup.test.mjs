import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  cleanupTerminalReceipt,
  terminalActionPath,
} from './campaign-terminal-cleanup.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const temporary = async (prefix, context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  context.after(() => rm(root, { recursive: true, force: true }));
  return root;
};
const run = (args) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [
      fileURLToPath(
        new URL('./campaign-terminal-cleanup.mjs', import.meta.url)
      ),
      ...args,
    ]);
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) => resolve({ code, stderr }));
  });

test('rejects inherited terminal action names', () => {
  assert.throws(
    () => terminalActionPath('toString', { schemaVersion: 1 }, 'tx', {}),
    /closed terminal action required/
  );
});

test('cleans only an exact receipt-bound terminal artifact and retries idempotently', async (context) => {
  const root = await temporary('cwv-terminal-', context);
  const artifact = path.join(root, 'nonce', 'handoff', 'release.json');
  await mkdir(path.dirname(artifact), { mode: 0o700, recursive: true });
  await writeFile(artifact, 'bound-bytes', { mode: 0o600 });
  const rootDetails = await lstat(root);
  const details = await lstat(artifact);
  const receipt = {
    schemaVersion: 1,
    root,
    rootDev: rootDetails.dev,
    rootIno: rootDetails.ino,
    relative: 'nonce/handoff/release.json',
    type: 'file',
    dev: details.dev,
    ino: details.ino,
    uid: process.getuid(),
    mode: 0o600,
    contentSha256: digest('bound-bytes'),
  };
  const roots = { registrationRelease: root };
  assert.equal(
    terminalActionPath('registration-release-created', receipt, 'tx', roots),
    artifact
  );
  await cleanupTerminalReceipt(
    'registration-release-created',
    receipt,
    'tx',
    process.getuid(),
    roots
  );
  await assert.rejects(lstat(artifact));
  await cleanupTerminalReceipt(
    'registration-release-created',
    receipt,
    'tx',
    process.getuid(),
    roots
  );
});

test('rejects cross-root, symlink, identity, and content substitutions', async (context) => {
  const root = await temporary('cwv-terminal-', context);
  const artifact = path.join(root, 'nonce', 'handoff', 'release.json');
  await mkdir(path.dirname(artifact), { mode: 0o700, recursive: true });
  await writeFile(artifact, 'one', { mode: 0o600 });
  const rootDetails = await lstat(root);
  const details = await lstat(artifact);
  const receipt = {
    schemaVersion: 1,
    root,
    rootDev: rootDetails.dev,
    rootIno: rootDetails.ino,
    relative: 'nonce/handoff/release.json',
    type: 'file',
    dev: details.dev,
    ino: details.ino,
    uid: process.getuid(),
    mode: 0o600,
    contentSha256: digest('one'),
  };
  const roots = { registrationRelease: root };
  assert.throws(
    () =>
      terminalActionPath(
        'registration-release-created',
        { ...receipt, root: '/tmp' },
        'tx',
        roots
      ),
    /fixed root/
  );
  await writeFile(artifact, 'two');
  await chmod(artifact, 0o600);
  await assert.rejects(
    cleanupTerminalReceipt(
      'registration-release-created',
      receipt,
      'tx',
      process.getuid(),
      roots
    ),
    /identity|content/
  );
});

test('permits mutable cleanup only for the exact prepare import tree', async (context) => {
  const root = await temporary('cwv-prepare-import-', context);
  const artifact = path.join(root, 'prepare-a');
  await mkdir(artifact, { mode: 0o700 });
  await writeFile(path.join(artifact, 'partial'), 'before', { mode: 0o600 });
  const rootDetails = await lstat(root);
  const details = await lstat(artifact);
  const receipt = {
    schemaVersion: 1,
    root,
    rootDev: rootDetails.dev,
    rootIno: rootDetails.ino,
    relative: 'prepare-a',
    type: 'tree',
    dev: details.dev,
    ino: details.ino,
    uid: process.getuid(),
    mode: 0o700,
    contentSha256: digest('initial'),
    mutable: true,
  };
  const roots = { prepareImport: root, registrationStaging: `${root}-other` };
  await writeFile(path.join(artifact, 'partial'), 'changed', { mode: 0o600 });

  await cleanupTerminalReceipt(
    'prepare-import-created',
    receipt,
    'prepare-a',
    process.getuid(),
    roots
  );
  await assert.rejects(lstat(artifact));
  assert.throws(
    () =>
      terminalActionPath(
        'registration-staging-created',
        receipt,
        'prepare-a',
        roots
      ),
    /fixed root/
  );
  assert.throws(
    () =>
      terminalActionPath(
        'prepare-import-created',
        { ...receipt, mutable: false },
        'prepare-a',
        roots
      ),
    /mutable/
  );
  assert.throws(
    () =>
      terminalActionPath(
        'prepare-import-created',
        { ...receipt, extra: true },
        'prepare-a',
        roots
      ),
    /receipt/
  );
});

test('fails closed for a symlinked ancestor and invalid staging identity', async (context) => {
  const root = await temporary('cwv-terminal-', context);
  const outside = await temporary('cwv-terminal-outside-', context);
  const artifact = path.join(root, 'nonce', 'handoff', 'release.json');
  await mkdir(path.dirname(artifact), { mode: 0o700, recursive: true });
  await writeFile(artifact, 'bound-bytes', { mode: 0o600 });
  const rootDetails = await lstat(root);
  const details = await lstat(artifact);
  const receipt = {
    schemaVersion: 1,
    root,
    rootDev: rootDetails.dev,
    rootIno: rootDetails.ino,
    relative: 'nonce/handoff/release.json',
    type: 'file',
    dev: details.dev,
    ino: details.ino,
    uid: process.getuid(),
    mode: 0o600,
    contentSha256: digest('bound-bytes'),
  };
  await mkdir(path.join(outside, 'handoff'), { mode: 0o700 });
  await writeFile(path.join(outside, 'handoff', 'release.json'), 'outside', {
    mode: 0o600,
  });
  await symlink(outside, path.join(root, 'redirect'));
  await assert.rejects(
    cleanupTerminalReceipt(
      'registration-release-created',
      { ...receipt, relative: 'redirect/handoff/release.json' },
      'tx',
      process.getuid(),
      { registrationRelease: root }
    ),
    /ancestor|identity/
  );
  const tree = path.join(root, 'tree');
  await mkdir(tree, { mode: 0o700 });
  await writeFile(path.join(tree, 'child'), 'before', { mode: 0o600 });
  const treeDetails = await lstat(tree);
  const treeReceipt = {
    ...receipt,
    relative: 'tree',
    type: 'tree',
    dev: treeDetails.dev,
    ino: treeDetails.ino,
    mode: 0o700,
    contentSha256: digest(`child:384:${digest('before')}`),
  };
  await writeFile(path.join(tree, 'child'), 'after', { mode: 0o600 });
  await assert.rejects(
    cleanupTerminalReceipt(
      'registration-staging-created',
      treeReceipt,
      'tx',
      process.getuid(),
      { registrationStaging: root }
    ),
    /fixed root/
  );
});

test('reports malformed CLI receipt JSON as a controlled failure', async () => {
  const result = await run(['registration-token-created', 'tx', '{']);
  assert.equal(result.code, 1);
  assert.equal(result.stderr, 'invalid terminal receipt JSON\n');
  const extra = await run(['registration-token-created', 'tx', '{}', 'extra']);
  assert.equal(extra.code, 1);
  assert.equal(extra.stderr, 'invalid terminal receipt invocation\n');
});

test('prunes empty receipt ancestors after a crash already removed the target', async (context) => {
  const root = await temporary('cwv-terminal-', context);
  const handoff = path.join(root, 'nonce', 'handoff');
  await mkdir(handoff, { mode: 0o700, recursive: true });
  const rootDetails = await lstat(root);
  await cleanupTerminalReceipt(
    'registration-release-created',
    {
      schemaVersion: 1,
      root,
      rootDev: rootDetails.dev,
      rootIno: rootDetails.ino,
      relative: 'nonce/handoff/release.json',
      type: 'file',
      dev: rootDetails.dev,
      ino: 1,
      uid: process.getuid(),
      mode: 0o600,
      contentSha256: digest('crash-removed'),
    },
    'tx',
    process.getuid(),
    { registrationRelease: root }
  );
  await assert.rejects(lstat(handoff));
  await assert.rejects(lstat(path.dirname(handoff)));
});
