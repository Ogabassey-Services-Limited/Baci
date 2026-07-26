import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, chown, lstat, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  terminalActionPath,
  validateTerminalReceipt,
} from './campaign-terminal-cleanup.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');

test('admits an exact mutable registration staging receipt for crash cleanup', () => {
  const receipt = {
    schemaVersion: 1,
    root: '/srv/baci-cwv/registration-staging',
    rootDev: 1,
    rootIno: 2,
    relative: 'nonce',
    type: 'tree',
    dev: 1,
    ino: 3,
    uid: 10001,
    mode: 0o700,
    contentSha256: digest(''),
    mutable: true,
  };
  assert.equal(
    terminalActionPath('registration-staging-created', receipt, 'tx'),
    '/srv/baci-cwv/registration-staging/nonce'
  );
  assert.throws(
    () =>
      terminalActionPath(
        'registration-staging-created',
        { ...receipt, uid: 0 },
        'tx'
      ),
    /fixed root receipt/
  );
});

test('admits immutable registration layout receipts for ordered reboot cleanup', () => {
  const nonce = 'a'.repeat(32);
  const base = {
    schemaVersion: 1,
    rootDev: 1,
    rootIno: 2,
    relative: nonce,
    type: 'tree',
    dev: 1,
    ino: 3,
    uid: 0,
    mode: 0o700,
    contentSha256: digest(''),
  };
  assert.equal(
    terminalActionPath(
      'registration-token-layout-created',
      {
        ...base,
        mountDev: 8,
        mountIno: 9,
        mountRelative: nonce,
        root: '/run/baci-cwv-registration',
      },
      'tx'
    ),
    `/run/baci-cwv-registration/${nonce}`
  );
  assert.equal(
    terminalActionPath(
      'registration-release-layout-created',
      {
        ...base,
        mode: 0o750,
        relative: `${nonce}/handoff`,
        root: '/run/baci-cwv-registration-release',
      },
      'tx'
    ),
    `/run/baci-cwv-registration-release/${nonce}/handoff`
  );
});

test('validates registration staging using its fixed unprivileged target owner', {
  skip: process.getuid?.() !== 0,
}, async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cwv-registration-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, 'nonce');
  await chmod(root, 0o700);
  await mkdir(target, { mode: 0o700 });
  await chown(target, 10001, 10001);
  const [rootDetails, targetDetails] = await Promise.all([
    lstat(root),
    lstat(target),
  ]);
  const receipt = {
    schemaVersion: 1,
    root,
    rootDev: rootDetails.dev,
    rootIno: rootDetails.ino,
    relative: 'nonce',
    type: 'tree',
    dev: targetDetails.dev,
    ino: targetDetails.ino,
    uid: 10001,
    mode: 0o700,
    contentSha256: digest(''),
    mutable: true,
  };

  assert.equal(
    await validateTerminalReceipt(
      'registration-staging-created',
      receipt,
      'tx',
      0,
      { registrationStaging: root }
    ),
    target
  );
});

test('preserves the supplied owner for other terminal actions', async (context) => {
  const owner = process.getuid?.() ?? 0;
  const root = await mkdtemp(path.join(os.tmpdir(), 'cwv-registration-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, 'tx');
  await chmod(root, 0o700);
  await mkdir(target, { mode: 0o700 });
  const [rootDetails, targetDetails] = await Promise.all([
    lstat(root),
    lstat(target),
  ]);
  const receipt = {
    schemaVersion: 1,
    root,
    rootDev: rootDetails.dev,
    rootIno: rootDetails.ino,
    relative: 'tx',
    type: 'tree',
    dev: targetDetails.dev,
    ino: targetDetails.ino,
    uid: owner,
    mode: 0o700,
    contentSha256: digest(''),
    mutable: true,
  };

  assert.equal(
    await validateTerminalReceipt(
      'prepare-import-created',
      receipt,
      'tx',
      owner,
      { prepareImport: root }
    ),
    target
  );
});
