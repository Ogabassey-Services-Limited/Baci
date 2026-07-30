import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import { validateBootstrapReplacementSourceState } from './install-bootstrap-replacement-source.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceSha = 'a'.repeat(40);
const policySha = 'b'.repeat(64);
const installBytes = Buffer.from('#!/bin/sh\n');
const entry = {
  blobSha256: sha256(installBytes),
  mode: '100755',
  path: 'infra/cwv-runner/install.sh',
};
const manifest = {
  schemaVersion: 1,
  mergeSha: sourceSha,
  policyFileSha256: policySha,
  sourceArchive: { prefix: 'infra/cwv-runner/', entries: [entry] },
};
const manifestBytes = Buffer.from(canonicalJson(manifest));
const manifestSha = sha256(manifestBytes);
const treeBytes = Buffer.from(
  `${entry.path}\t${entry.mode}\t${entry.blobSha256}\n`
);
const treeSha = sha256(treeBytes);
const seal = {
  archiveSha256: 'c'.repeat(64),
  manifestSha256: manifestSha,
  schemaVersion: 1,
  sealedTreeSha256: treeSha,
  sourceSha,
};
const state = {
  phase: 'captured',
  transactionId: `bootstrap-${sourceSha.slice(0, 12)}`,
  sourceSha,
  sourceManifestSha256: manifestSha,
  policyFileSha256: policySha,
  captureSha256: 'd'.repeat(64),
  files: {
    '/installed': { sha256: 'e'.repeat(64), mode: '0500', owner: 'root:root' },
  },
  prior: { '/installed': { absent: true } },
};

function dependencies(overrides = {}) {
  const receipts = new Map([
    ['manifest.json', manifestBytes],
    ['manifest.sha256', Buffer.from(`${manifestSha}\n`)],
    ['archive.sha256', Buffer.from(`${seal.archiveSha256}\n`)],
    ['tree.sha256', Buffer.from(`${treeSha}\n`)],
    ['seal-receipt.json', Buffer.from(`${canonicalJson(seal)}\n`)],
  ]);
  return {
    buildInput: async () => ({ files: state.files }),
    resolveFileSpecs: () => [],
    listSourcePaths: async () => ['install.sh'],
    readPinned: async (path) => ({
      bytes: receipts.has(path.split('/').at(-1))
        ? receipts.get(path.split('/').at(-1))
        : installBytes,
      details: {
        gid: 0,
        mode: receipts.has(path.split('/').at(-1)) ? 0o100600 : 0o100755,
        uid: 0,
      },
    }),
    ...overrides,
  };
}

function sealedPathFixture(path) {
  const candidate = { ...entry, path };
  const candidateManifest = {
    ...manifest,
    sourceArchive: { ...manifest.sourceArchive, entries: [candidate] },
  };
  const candidateManifestBytes = Buffer.from(canonicalJson(candidateManifest));
  const candidateManifestSha = sha256(candidateManifestBytes);
  const candidateTreeSha = sha256(
    Buffer.from(`${path}\t${candidate.mode}\t${candidate.blobSha256}\n`)
  );
  const candidateSeal = {
    ...seal,
    manifestSha256: candidateManifestSha,
    sealedTreeSha256: candidateTreeSha,
  };
  const receipts = new Map([
    ['manifest.json', candidateManifestBytes],
    ['manifest.sha256', Buffer.from(`${candidateManifestSha}\n`)],
    ['archive.sha256', Buffer.from(`${candidateSeal.archiveSha256}\n`)],
    ['tree.sha256', Buffer.from(`${candidateTreeSha}\n`)],
    ['seal-receipt.json', Buffer.from(`${canonicalJson(candidateSeal)}\n`)],
  ]);
  return {
    descriptor: dependencies({
      listSourcePaths: async () => [path.slice('infra/cwv-runner/'.length)],
      readPinned: async (file) => ({
        bytes: receipts.get(file.split('/').at(-1)) ?? installBytes,
        details: {
          gid: 0,
          mode: receipts.has(file.split('/').at(-1)) ? 0o100600 : 0o100755,
          uid: 0,
        },
      }),
    }),
    state: { ...state, sourceManifestSha256: candidateManifestSha },
  };
}

test('rederives a bootstrap capture from its sealed source and receipt tree', async () => {
  const result = await validateBootstrapReplacementSourceState(
    { state, sourceRoot: '/srv/source', receiptRoot: '/srv/receipts' },
    dependencies()
  );

  assert.deepEqual(result, {
    journalTipSha256: 'd'.repeat(64),
    sealReceiptSha256: sha256(Buffer.from(`${canonicalJson(seal)}\n`)),
    sourceSha,
  });
});

test('accepts the sealed watchdog systemd template repository path', async () => {
  const fixture = sealedPathFixture(
    'infra/cwv-runner/baci-cwv-campaign-watchdog@.service'
  );

  const result = await validateBootstrapReplacementSourceState(
    {
      state: fixture.state,
      sourceRoot: '/srv/source',
      receiptRoot: '/srv/receipts',
    },
    fixture.descriptor
  );

  assert.equal(result.sourceSha, sourceSha);
});

test('rejects unsafe sealed repository path forms', async () => {
  for (const path of [
    '/infra/cwv-runner/install.sh',
    'infra/cwv-runner/.',
    'infra/cwv-runner/../install.sh',
    'infra/cwv-runner/watchdog/service',
    'infra/cwv-runner/watchdog@.service\tinstall.sh',
    'infra/cwv-runner/watchdog@.service:install.sh',
  ]) {
    const fixture = sealedPathFixture(path);
    await assert.rejects(
      validateBootstrapReplacementSourceState(
        {
          state: fixture.state,
          sourceRoot: '/srv/source',
          receiptRoot: '/srv/receipts',
        },
        fixture.descriptor
      ),
      /invalid sealed source entry/,
      path
    );
  }
});

test('refuses source bytes, tree receipts, or projected capture drift', async () => {
  await assert.rejects(
    validateBootstrapReplacementSourceState(
      { state, sourceRoot: '/srv/source', receiptRoot: '/srv/receipts' },
      dependencies({
        readPinned: async (path) => ({
          ...(await dependencies().readPinned(path)),
          ...(path.endsWith('install.sh')
            ? { bytes: Buffer.from('drift') }
            : {}),
        }),
      })
    ),
    /sealed source entry drift/
  );
  await assert.rejects(
    validateBootstrapReplacementSourceState(
      { state, sourceRoot: '/srv/source', receiptRoot: '/srv/receipts' },
      dependencies({ buildInput: async () => ({ files: {} }) })
    ),
    /bootstrap source projection drift/
  );
});

test('rejects dot-segment entries before resolving sealed source paths', async () => {
  const invalidEntry = { ...entry, path: 'infra/cwv-runner/..' };
  const invalidManifest = {
    ...manifest,
    sourceArchive: { ...manifest.sourceArchive, entries: [invalidEntry] },
  };
  const invalidManifestBytes = Buffer.from(canonicalJson(invalidManifest));
  const invalidManifestSha = sha256(invalidManifestBytes);
  const invalidTreeSha = sha256(
    Buffer.from(
      `${invalidEntry.path}\t${invalidEntry.mode}\t${invalidEntry.blobSha256}\n`
    )
  );
  const invalidSeal = {
    ...seal,
    manifestSha256: invalidManifestSha,
    sealedTreeSha256: invalidTreeSha,
  };
  const receipts = new Map([
    ['manifest.json', invalidManifestBytes],
    ['manifest.sha256', Buffer.from(`${invalidManifestSha}\n`)],
    ['archive.sha256', Buffer.from(`${invalidSeal.archiveSha256}\n`)],
    ['tree.sha256', Buffer.from(`${invalidTreeSha}\n`)],
    ['seal-receipt.json', Buffer.from(`${canonicalJson(invalidSeal)}\n`)],
  ]);

  await assert.rejects(
    validateBootstrapReplacementSourceState(
      {
        state: { ...state, sourceManifestSha256: invalidManifestSha },
        sourceRoot: '/srv/source',
        receiptRoot: '/srv/receipts',
      },
      dependencies({
        readPinned: async (path) => ({
          bytes: receipts.get(path.split('/').at(-1)) ?? installBytes,
          details: {
            gid: 0,
            mode: receipts.has(path.split('/').at(-1)) ? 0o100600 : 0o100755,
            uid: 0,
          },
        }),
      })
    ),
    /invalid sealed source entry/
  );
});

test('refuses a completed baseline whose live-unit receipt is not canonical', async () => {
  await assert.rejects(
    validateBootstrapReplacementSourceState(
      {
        state: {
          ...state,
          phase: 'complete',
          receiptSha256: 'f'.repeat(64),
          receipt: {
            captureSha256: state.captureSha256,
            files: state.files,
            policyFileSha256: state.policyFileSha256,
            schemaVersion: 1,
            sourceManifestSha256: state.sourceManifestSha256,
            sourceSha: state.sourceSha,
            unitStates: {
              'baci-cwv-docker.service': 'loaded\nactive\nstatic\n',
            },
          },
        },
        sourceRoot: '/srv/source',
        receiptRoot: '/srv/receipts',
      },
      dependencies()
    ),
    /invalid completed bootstrap source receipt/
  );
});
