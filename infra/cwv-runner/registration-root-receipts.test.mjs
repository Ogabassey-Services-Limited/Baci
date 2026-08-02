import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { canonicalSha256 } from './canonical-json.mjs';
import { controllerContext } from './controller-contract.fixture.mjs';
import {
  captureRegistrationTerminalReceipt,
  createRegistrationReceiptOperations,
  registrationTokenUnmountReceipt,
} from './registration-root-receipts.mjs';

test('reads only fixed root-bound ready, release, and output receipts', async () => {
  const releaseSha = createHash('sha256').update('release\n').digest('hex');
  const root = '/srv/baci-cwv/registration-staging/fixed';
  const readyMarker = 'a'.repeat(64);
  const values = new Map([
    [`${root}/registration-ready.sha256`, Buffer.from(`${readyMarker}\n`)],
    [
      `${root}/release-read-once.json`,
      Buffer.from(`{"reads":1,"sha256":"${releaseSha}"}\n`),
    ],
    [
      `${root}/registration-output.json`,
      Buffer.from(
        '{"runnerRelativePath":"actions-runner","schemaVersion":1}\n'
      ),
    ],
  ]);
  const details = (path) => ({
    dev: 1,
    gid: 10001,
    ino: path.length,
    isFile: () => true,
    isSymbolicLink: () => false,
    mode: 0o100400,
    size: values.get(path).length,
    uid: 10001,
  });
  const verified = [];
  const receipts = createRegistrationReceiptOperations(
    { context: controllerContext },
    {
      paths: { staging: root },
      verifyRelease: (sha256) => verified.push(sha256),
    },
    {
      lstat: (path) => details(path),
      open: (path) => ({
        close: () => undefined,
        readFile: () => values.get(path),
        stat: () => details(path),
      }),
    }
  );
  assert.deepEqual(await receipts.waitReady(), {
    registrationReadySha256: canonicalSha256({
      markerSha256: readyMarker,
      schemaVersion: 1,
    }),
  });
  assert.deepEqual(await receipts.waitReleaseReadOnce(), {
    reads: 1,
    sha256: releaseSha,
  });
  assert.deepEqual(await receipts.validateOutput(), {});
  assert.deepEqual(verified, [releaseSha]);
});

test('records a canonical absent token layout without claiming a tmpfs mount', () => {
  const receipt = registrationTokenUnmountReceipt(
    { filesystems: [] },
    'absent'
  );
  assert.deepEqual(receipt, {
    tokenUnmountSha256: canonicalSha256({
      namespaceMounts: { filesystems: [] },
      schemaVersion: 1,
      tokenParentFilesystem: 'absent',
    }),
  });
});

test('binds the ready digest to the normalized live marker, not configuration', async () => {
  const root = '/srv/baci-cwv/registration-staging/fixed';
  const marker = createHash('sha256').update('live-ready').digest('hex');
  const details = {
    dev: 1,
    gid: 10001,
    ino: 2,
    isFile: () => true,
    isSymbolicLink: () => false,
    mode: 0o100400,
    size: 65,
    uid: 10001,
  };
  const receipts = createRegistrationReceiptOperations(
    { context: controllerContext },
    { paths: { staging: root }, verifyRelease: () => undefined },
    {
      lstat: () => details,
      open: () => ({
        close: () => undefined,
        readFile: () => Buffer.from(`${marker}\n`),
        stat: () => details,
      }),
    }
  );
  const receipt = await receipts.waitReady();
  assert.equal(
    receipt.registrationReadySha256,
    canonicalSha256({ markerSha256: marker, schemaVersion: 1 })
  );
  assert.notEqual(
    receipt.registrationReadySha256,
    controllerContext.registrationReadySha256
  );
});

test('binds token unmount evidence to the actual mount namespace read-back', () => {
  const first = registrationTokenUnmountReceipt(
    { filesystems: [{ target: '/tmp' }] },
    'tmpfs\n'
  );
  const changed = registrationTokenUnmountReceipt(
    { filesystems: [{ target: '/var/tmp' }] },
    'tmpfs\n'
  );
  assert.match(first.tokenUnmountSha256, /^[a-f0-9]{64}$/);
  assert.notEqual(first.tokenUnmountSha256, changed.tokenUnmountSha256);
  assert.throws(
    () =>
      registrationTokenUnmountReceipt(
        { filesystems: [{ target: '/run/secrets/runner-registration-token' }] },
        'tmpfs\n'
      ),
    /registration root receipt refused/
  );
});

test('captures a no-follow owner-bound token receipt for durable cleanup', async () => {
  const root = '/run/baci-cwv-registration';
  const target = `${root}/${controllerContext.registrationNonce}/token`;
  const mount = path.join(root, controllerContext.registrationNonce);
  const values = new Map([
    [
      root,
      {
        dev: 7,
        gid: 0,
        ino: 10,
        isDirectory: () => true,
        isFile: () => false,
        isSymbolicLink: () => false,
        mode: 0o40700,
        uid: 0,
      },
    ],
    [
      target,
      {
        dev: 8,
        gid: 10001,
        ino: 11,
        isDirectory: () => false,
        isFile: () => true,
        isSymbolicLink: () => false,
        mode: 0o100440,
        uid: 0,
      },
    ],
    [
      mount,
      {
        dev: 8,
        gid: 0,
        ino: 12,
        isDirectory: () => true,
        isFile: () => false,
        isSymbolicLink: () => false,
        mode: 0o40700,
        uid: 0,
      },
    ],
  ]);
  const opened = [];
  const receipt = await captureRegistrationTerminalReceipt(
    'registration-token-created',
    target,
    {
      lstat: (pathname) => values.get(pathname),
      open: (pathname, flags) => {
        opened.push([pathname, flags]);
        return {
          close: () => undefined,
          readFile: () => Buffer.from('token-bytes'),
          stat: () => values.get(pathname),
        };
      },
      readFile: () =>
        Buffer.from(
          `1 2 0:8 / ${mount} rw,nosuid,nodev,noexec - tmpfs tmpfs rw\n`
        ),
    }
  );
  assert.equal(opened.length, 3);
  assert.ok(opened.every(([, flags]) => (flags & constants.O_NOFOLLOW) !== 0));
  assert.deepEqual(receipt, {
    schemaVersion: 1,
    root,
    rootDev: 7,
    rootIno: 10,
    relative: `${controllerContext.registrationNonce}/token`,
    type: 'file',
    dev: 8,
    ino: 11,
    uid: 0,
    mode: 0o440,
    contentSha256: createHash('sha256').update('token-bytes').digest('hex'),
    mountDev: 8,
    mountIno: 12,
    mountRelative: controllerContext.registrationNonce,
  });
});

test('captures a token-layout receipt when its tmpfs device differs from its trusted parent', async () => {
  const root = '/run/baci-cwv-registration';
  const target = `${root}/${controllerContext.registrationNonce}`;
  const values = new Map([
    [
      root,
      {
        dev: 7,
        gid: 0,
        ino: 10,
        isDirectory: () => true,
        isFile: () => false,
        isSymbolicLink: () => false,
        mode: 0o40700,
        uid: 0,
      },
    ],
    [
      target,
      {
        dev: 8,
        gid: 0,
        ino: 11,
        isDirectory: () => true,
        isFile: () => false,
        isSymbolicLink: () => false,
        mode: 0o40700,
        uid: 0,
      },
    ],
  ]);
  await assert.doesNotReject(
    captureRegistrationTerminalReceipt(
      'registration-token-layout-created',
      target,
      {
        lstat: (pathname) => values.get(pathname),
        open: (pathname) => ({
          close: () => undefined,
          readFile: () => Buffer.alloc(0),
          stat: () => values.get(pathname),
        }),
        readFile: () =>
          Buffer.from(
            `1 2 0:8 / ${target} rw,nosuid,nodev,noexec - tmpfs tmpfs rw\n`
          ),
      }
    )
  );
});
