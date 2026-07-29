import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authorizeBootstrapReplacement,
  authorizeBootstrapReplacementIfNeeded,
  completeBootstrapReplacement,
  verifyBootstrapReplacementCompletion,
} from './install-bootstrap-replacement-controller.mjs';

const oldSource = 'a'.repeat(40);
const newSource = 'b'.repeat(40);
const policy = 'e'.repeat(64);
const path = '/srv/baci-cwv/sealed/bootstrap.sha256';
const oldFile = { sha256: '1'.repeat(64), mode: '0600', owner: 'root:root' };
const newFile = { sha256: '2'.repeat(64), mode: '0600', owner: 'root:root' };
const previous = {
  phase: 'complete',
  sourceSha: oldSource,
  sourceManifestSha256: '3'.repeat(64),
  policyFileSha256: policy,
  receiptSha256: '4'.repeat(64),
  receipt: {
    sourceSha: oldSource,
    sourceManifestSha256: '3'.repeat(64),
    policyFileSha256: policy,
    files: { [path]: oldFile },
  },
  files: { [path]: oldFile },
};
const current = {
  phase: 'captured',
  sourceSha: newSource,
  sourceManifestSha256: '5'.repeat(64),
  policyFileSha256: policy,
  captureSha256: '6'.repeat(64),
  prior: { [path]: oldFile },
  files: { [path]: newFile },
};
const inert = {
  acceptedImageFiles: 0,
  activeDedicatedUnits: 0,
  prepareTransactions: 0,
  registrationArtifacts: 0,
  runnerConfigurationFiles: 0,
  unsafeUnitStates: 0,
  watchdogInstances: 0,
};
const validated = (state) => ({
  journalTipSha256: state.captureSha256 ?? state.receiptSha256,
  sealReceiptSha256: state.sourceSha[0].repeat(64),
  sourceSha: state.sourceSha,
});

test('discovers the complete chain and persists its source provenance', async () => {
  const persisted = [];
  const result = await authorizeBootstrapReplacement(
    {
      stateRoot: '/state',
      currentDirectory: '/state/bootstrap-bbbbbbbbbbbb',
      downstreamState: inert,
    },
    {
      listDirectories: async () => [
        'bootstrap-aaaaaaaaaaaa',
        'bootstrap-bbbbbbbbbbbb',
      ],
      readState: async (directory) =>
        directory.endsWith('aaaaaaaaaaaa') ? previous : current,
      readProjection: async () => ({ [path]: oldFile }),
      readIntent: () => {
        const error = new Error('missing');
        error.code = 'ENOENT';
        throw error;
      },
      validateSourceState: async ({ state }) => validated(state),
      persistIntent: async (_directory, intent) => persisted.push(intent),
    }
  );
  assert.deepEqual(result.replace, [path]);
  assert.deepEqual(
    persisted[0].authorityChain.map((row) => row.sourceSha),
    [oldSource, newSource]
  );
  assert.equal(persisted[0].baselineKind, 'complete');
  assert.equal(persisted[0].baselineSourceSha, previous.sourceSha);
  assert.equal(persisted[0].baselineStateSha256, previous.receiptSha256);
});

test('skips only a fresh all-absent bootstrap and refuses unbound residue', async () => {
  const options = {
    stateRoot: '/state',
    currentDirectory: '/state/bootstrap-bbbbbbbbbbbb',
    root: '/srv/baci-cwv',
    prepareRoot: '/prepare',
  };
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

test('refuses an orphan captured transaction outside the complete chain', async () => {
  const orphan = {
    ...current,
    sourceSha: 'c'.repeat(40),
    captureSha256: 'c'.repeat(64),
    prior: { [path]: { ...oldFile, sha256: 'c'.repeat(64) } },
  };
  await assert.rejects(
    authorizeBootstrapReplacement(
      {
        stateRoot: '/state',
        currentDirectory: '/state/bootstrap-bbbbbbbbbbbb',
        downstreamState: inert,
      },
      {
        listDirectories: async () => [
          'bootstrap-aaaaaaaaaaaa',
          'bootstrap-bbbbbbbbbbbb',
          'bootstrap-cccccccccccc',
        ],
        readState: async (directory) =>
          directory.endsWith('aaaaaaaaaaaa')
            ? previous
            : directory.endsWith('cccccccccccc')
              ? orphan
              : current,
        readProjection: async () => ({ [path]: oldFile }),
        validateSourceState: async ({ state }) => validated(state),
      }
    ),
    /replacement authority chain/
  );
});

test('publishes a generation receipt only after the target projection is complete', async () => {
  const intent = {
    schemaVersion: 1,
    baselineKind: 'complete',
    baselineSourceSha: oldSource,
    baselineStateSha256: previous.receiptSha256,
    sourceSha: newSource,
    captureSha256: current.captureSha256,
    installedProjectionSha256: '7'.repeat(64),
    pathSetSha256: '8'.repeat(64),
    policyFileSha256: policy,
    authorityChain: [],
    transitionPaths: [path],
  };
  const complete = {
    ...current,
    phase: 'complete',
    receiptSha256: '9'.repeat(64),
    receipt: { files: current.files },
  };
  const persisted = [];
  const receipt = await completeBootstrapReplacement(
    { currentDirectory: '/state/bootstrap-bbbbbbbbbbbb' },
    {
      readState: async () => complete,
      readIntent: async () => intent,
      readProjection: async () => current.files,
      persistReceipt: async (_directory, value) => persisted.push(value),
    }
  );
  assert.equal(receipt.receiptSha256, complete.receiptSha256);
  assert.deepEqual(persisted, [receipt]);
});

test('refuses downstream verification until the replacement receipt is exact', async () => {
  const complete = {
    ...current,
    phase: 'complete',
    receiptSha256: '9'.repeat(64),
  };
  const intent = {
    schemaVersion: 1,
    baselineKind: 'complete',
    baselineSourceSha: oldSource,
    baselineStateSha256: previous.receiptSha256,
    sourceSha: newSource,
  };
  const expected = { ...intent, receiptSha256: complete.receiptSha256 };
  await assert.rejects(
    verifyBootstrapReplacementCompletion(
      { currentDirectory: '/state/bootstrap-bbbbbbbbbbbb' },
      {
        readState: async () => complete,
        readIntent: async () => intent,
        readReceipt: () => {
          const error = new Error('missing digest');
          error.code = 'ENOENT';
          throw error;
        },
      }
    ),
    /missing digest/
  );
  assert.deepEqual(
    await verifyBootstrapReplacementCompletion(
      { currentDirectory: '/state/bootstrap-bbbbbbbbbbbb' },
      {
        readState: async () => complete,
        readIntent: async () => intent,
        readReceipt: async () => expected,
      }
    ),
    expected
  );
});
