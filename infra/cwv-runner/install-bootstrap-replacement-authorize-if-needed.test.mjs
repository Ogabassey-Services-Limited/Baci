import assert from 'node:assert/strict';
import test from 'node:test';

import { authorizeBootstrapReplacementIfNeeded } from './install-bootstrap-replacement-authorize-if-needed.mjs';

const path = '/srv/baci-cwv/sealed/bootstrap.sha256';
const current = {
  phase: 'captured',
  sourceSha: 'b'.repeat(40),
  captureSha256: '6'.repeat(64),
  prior: {
    [path]: { sha256: '1'.repeat(64), mode: '0600', owner: 'root:root' },
  },
};
const options = {
  stateRoot: '/state',
  currentDirectory: '/state/bootstrap-bbbbbbbbbbbb',
  root: '/srv/baci-cwv',
  prepareRoot: '/prepare',
};

test('skips only a fresh all-absent bootstrap and refuses unbound residue', async () => {
  assert.equal(
    await authorizeBootstrapReplacementIfNeeded(options, {
      listDirectories: async () => ['bootstrap-bbbbbbbbbbbb'],
      readState: async () => ({
        ...current,
        prior: { [path]: { absent: true } },
      }),
    }),
    null
  );
  await assert.rejects(
    authorizeBootstrapReplacementIfNeeded(options, {
      listDirectories: async () => ['bootstrap-bbbbbbbbbbbb'],
      readState: async () => current,
    }),
    /prior bootstrap generation required/
  );
});

test('skips an unchanged managed projection before inventory and downstream validation', async () => {
  let inventoryRead = false;
  assert.equal(
    await authorizeBootstrapReplacementIfNeeded(options, {
      readState: async () => ({
        ...current,
        sourceSha: 'c'.repeat(40),
        sourceManifestSha256: '7'.repeat(64),
        policyFileSha256: '8'.repeat(64),
        files: current.prior,
      }),
      listDirectories: () => {
        inventoryRead = true;
        throw new Error('stale predecessor must not be inspected');
      },
      readDownstream: () => {
        throw new Error('downstream state must not be inspected');
      },
    }),
    null
  );
  assert.equal(inventoryRead, false);
});
