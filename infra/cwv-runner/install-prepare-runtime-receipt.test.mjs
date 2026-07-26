import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  canonical,
  IMAGE,
  stageRunnerRuntimeReceipt,
} from './install-prepare-acceptance.fixture.mjs';
import { readPreparedRuntimeReceipt } from './install-prepare-runtime-receipt.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('refuses identity-manifest bytes that drift after the receipt snapshot', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-prepared-runtime-'));
  context.after(async () => {
    await chmod(join(directory, 'runner-runtime-projection'), 0o700);
    await chmod(join(directory, 'runner-runtime-projection', 'bin'), 0o700);
    await rm(directory, { force: true, recursive: true });
  });
  await stageRunnerRuntimeReceipt(directory);
  const receiptDirectory = join(directory, 'runner-runtime');
  const identityPath = join(
    receiptDirectory,
    'runner-runtime-identity-manifest.json'
  );
  const projectionPath = join(
    directory,
    'runner-runtime-projection',
    'runtime-manifest.json'
  );
  const identity = JSON.parse(await readFile(identityPath, 'utf8'));
  const drifted = Buffer.from(
    canonical({
      ...identity,
      pnpmPackage: { ...identity.pnpmPackage, version: '0.0.0-drift' },
    })
  );
  let swapped = false;
  const filesystem = {
    readFile: async (path) => {
      if (path === identityPath && !swapped) {
        swapped = true;
        await chmod(join(directory, 'runner-runtime-projection'), 0o700);
        await chmod(projectionPath, 0o600);
        await writeFile(projectionPath, drifted);
        await chmod(projectionPath, 0o444);
        await chmod(join(directory, 'runner-runtime-projection'), 0o555);
        return drifted;
      }
      if (path === `${identityPath}.sha256`)
        return Buffer.from(`${sha256(drifted)}\n`);
      return readFile(path);
    },
  };

  await assert.rejects(
    async () =>
      await readPreparedRuntimeReceipt(
        directory,
        await readFile(join(directory, 'runner-runtime-image-receipt.json')),
        IMAGE,
        { gid: process.getgid(), uid: process.getuid() },
        filesystem
      ),
    /prepared runtime receipt drift/
  );
});

test('refuses a valid manifest bundle swapped after the immutable receipt read', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-prepared-runtime-'));
  context.after(async () => {
    await chmod(join(directory, 'runner-runtime-projection'), 0o700);
    await chmod(join(directory, 'runner-runtime-projection', 'bin'), 0o700);
    await rm(directory, { force: true, recursive: true });
  });
  await stageRunnerRuntimeReceipt(directory);
  const receiptDirectory = join(directory, 'runner-runtime');
  const imageReceiptPath = join(directory, 'runner-runtime-image-receipt.json');
  const manifestPath = join(receiptDirectory, 'runner-runtime-manifest.json');
  const contextPath = join(receiptDirectory, 'runner-runtime-context.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const manifestBytes = Buffer.from(
    canonical({
      ...manifest,
      files: manifest.files.map((file) =>
        file.path === 'bin/Runner.Listener'
          ? { ...file, sha256: 'c'.repeat(64) }
          : file
      ),
    })
  );
  const receiptContext = JSON.parse(await readFile(contextPath, 'utf8'));
  const contextBytes = Buffer.from(
    canonical({ ...receiptContext, manifestSha256: sha256(manifestBytes) })
  );
  const snapshotPaths = [
    imageReceiptPath,
    contextPath,
    `${contextPath}.sha256`,
    join(receiptDirectory, 'runner-runtime-identity-manifest.json'),
    join(receiptDirectory, 'runner-runtime-identity-manifest.json.sha256'),
    manifestPath,
    `${manifestPath}.sha256`,
  ];
  const snapshots = new Map(
    await Promise.all(
      snapshotPaths.map(async (path) => [path, await readFile(path)])
    )
  );
  let swapped = false;
  const filesystem = {
    readFile: async (path) => {
      const snapshot = snapshots.get(path);
      if (!snapshot) return readFile(path);
      if (!swapped) {
        swapped = true;
        for (const [target, bytes] of [
          [manifestPath, manifestBytes],
          [`${manifestPath}.sha256`, Buffer.from(`${sha256(manifestBytes)}\n`)],
          [contextPath, contextBytes],
          [`${contextPath}.sha256`, Buffer.from(`${sha256(contextBytes)}\n`)],
        ]) {
          await chmod(target, 0o600);
          await writeFile(target, bytes);
          await chmod(target, 0o400);
        }
      }
      return snapshot;
    },
  };

  await assert.rejects(
    async () =>
      await readPreparedRuntimeReceipt(
        directory,
        await readFile(imageReceiptPath),
        IMAGE,
        { gid: process.getgid(), uid: process.getuid() },
        filesystem
      ),
    /prepared runtime receipt drift/
  );
});
