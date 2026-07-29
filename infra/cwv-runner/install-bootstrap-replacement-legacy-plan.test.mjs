import assert from 'node:assert/strict';
import { lstat, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  beginBootstrap,
  persistBootstrapCapture,
} from './install-bootstrap.mjs';
import { authorizeBootstrapReplacementIfNeeded } from './install-bootstrap-replacement-controller.mjs';

const sourceSha = 'b'.repeat(40);
const path = '/srv/baci-cwv/sealed/bootstrap.sha256';
const input = {
  transactionId: 'bootstrap-bbbbbbbbbbbb',
  sourceSha,
  sourceManifestSha256: 'c'.repeat(64),
  policyFileSha256: 'd'.repeat(64),
  files: {
    [path]: { sha256: 'e'.repeat(64), mode: '0600', owner: 'root:root' },
  },
  prior: { [path]: { absent: true } },
};
const state = beginBootstrap(input);
const details = {
  gid: process.getgid(),
  mode: 0o100600,
  nlink: 1,
  uid: process.getuid(),
};
const options = {
  stateRoot: '/state',
  currentDirectory: `/state/${input.transactionId}`,
  root: '/srv/baci-cwv',
  prepareRoot: '/prepare',
};

test('removes a legacy plan only when its exact bytes bind to a captured transaction', async (context) => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'baci-legacy-plan-'));
  context.after(() => rm(stateRoot, { recursive: true, force: true }));
  const currentDirectory = await persistBootstrapCapture(stateRoot, state);
  const legacy = join(stateRoot, '.plan.A1b2C3');
  await writeFile(legacy, `${JSON.stringify(input)}\n`, { mode: 0o600 });

  const result = await authorizeBootstrapReplacementIfNeeded({
    ...options,
    stateRoot,
    currentDirectory,
  });

  assert.equal(result, null);
  await assert.rejects(lstat(legacy), { code: 'ENOENT' });
});

test('refuses a legacy-looking plan whose bytes do not match its capture', async () => {
  const drifted = { ...input, sourceManifestSha256: 'f'.repeat(64) };
  let removed = false;

  await assert.rejects(
    authorizeBootstrapReplacementIfNeeded(options, {
      listDirectories: async () => [input.transactionId, '.plan.A1b2C3'],
      readPinnedFile: async () => ({
        bytes: Buffer.from(`${JSON.stringify(drifted)}\n`),
        details,
      }),
      readState: async () => state,
      removeFile: () => {
        removed = true;
      },
    }),
    /invalid legacy bootstrap plan/
  );
  assert.equal(removed, false);
});

test('retains the closed inventory for arbitrary plan-like names', async () => {
  await assert.rejects(
    authorizeBootstrapReplacementIfNeeded(options, {
      listDirectories: async () => [input.transactionId, '.plan.A1b2C3.extra'],
      readState: async () => state,
    }),
    /invalid bootstrap replacement state inventory/
  );
});
