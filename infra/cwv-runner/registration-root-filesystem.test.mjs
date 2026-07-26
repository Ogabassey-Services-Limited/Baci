import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  controllerContext,
  resourceContract,
} from './controller-contract.fixture.mjs';

const moduleUrl = new URL(
  './registration-root-filesystem.mjs',
  import.meta.url
);

async function fixture() {
  const temporary = await mkdtemp(
    path.join(os.tmpdir(), 'registration-root-fs-')
  );
  const bases = Object.fromEntries(
    ['token', 'release', 'staging', 'sealed'].map((name) => [
      name,
      path.join(temporary, name),
    ])
  );
  for (const directory of Object.values(bases))
    await mkdir(directory, { mode: 0o700 });
  return { bases, temporary };
}

test('creates fixed layouts and publishes token and release with exact modes', async () => {
  const { createRegistrationRootFilesystem } = await import(moduleUrl);
  const { bases } = await fixture();
  const files = createRegistrationRootFilesystem(
    { context: controllerContext, resources: resourceContract },
    {
      bases,
      owner: { gid: process.getgid(), uid: process.getuid() },
      runner: { gid: process.getgid(), uid: process.getuid() },
    }
  );
  await files.createTokenLayout();
  await files.writeToken(Buffer.from(`${'A'.repeat(29)}\n`));
  await files.createStagingLayout();
  await files.createReleaseLayout();
  const release = `${JSON.stringify({ schemaVersion: 1 })}\n`;
  await files.publishRelease(
    release,
    createHash('sha256').update(release).digest('hex')
  );
  assert.equal(
    (await readFile(files.paths.token, 'utf8')).endsWith('\n'),
    true
  );
  assert.equal((await lstat(files.paths.token)).mode & 0o777, 0o440);
  assert.equal((await lstat(files.paths.release)).mode & 0o777, 0o440);
});

test('fails closed when a nonce path is replaced by a symlink', async () => {
  const { createRegistrationRootFilesystem } = await import(moduleUrl);
  const { bases, temporary } = await fixture();
  const files = createRegistrationRootFilesystem(
    { context: controllerContext, resources: resourceContract },
    {
      bases,
      owner: { gid: process.getgid(), uid: process.getuid() },
      runner: { gid: process.getgid(), uid: process.getuid() },
    }
  );
  await symlink(
    temporary,
    path.join(bases.token, controllerContext.registrationNonce)
  );
  await assert.rejects(
    files.createTokenLayout(),
    /registration root filesystem refused/
  );
});

test('returns idempotent live receipts after token cleanup and absence read-back', async () => {
  const { createRegistrationRootFilesystem } = await import(moduleUrl);
  const { bases } = await fixture();
  const files = createRegistrationRootFilesystem(
    { context: controllerContext, resources: resourceContract },
    {
      bases,
      owner: { gid: process.getgid(), uid: process.getuid() },
      runner: { gid: process.getgid(), uid: process.getuid() },
    }
  );
  await files.createTokenLayout();
  await files.writeToken(Buffer.from(`${'A'.repeat(29)}\n`));
  const deleted = await files.deleteTokenLayout();
  const absent = await files.proveTokenAbsence();
  assert.match(deleted.tokenDeleteSha256, /^[a-f0-9]{64}$/);
  assert.match(absent.tokenAbsenceSha256, /^[a-f0-9]{64}$/);
  assert.notEqual(
    deleted.tokenDeleteSha256,
    controllerContext.tokenDeleteSha256
  );
  assert.notEqual(
    absent.tokenAbsenceSha256,
    controllerContext.tokenAbsenceSha256
  );
  assert.deepEqual(await files.deleteTokenLayout(), deleted);
  assert.deepEqual(await files.proveTokenAbsence(), absent);
});

test('cleans up an owned partial token layout before a token exists', async () => {
  const { createRegistrationRootFilesystem } = await import(moduleUrl);
  const { bases } = await fixture();
  const files = createRegistrationRootFilesystem(
    { context: controllerContext, resources: resourceContract },
    {
      bases,
      owner: { gid: process.getgid(), uid: process.getuid() },
      runner: { gid: process.getgid(), uid: process.getuid() },
    }
  );
  await files.createTokenLayout();
  const receipt = await files.deleteTokenLayout();
  assert.deepEqual(await files.deleteTokenLayout(), receipt);
  assert.match(receipt.tokenDeleteSha256, /^[a-f0-9]{64}$/);
});
