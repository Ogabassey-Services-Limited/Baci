import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalSha256 } from './canonical-json.mjs';
import {
  acceptTarget,
  beginPrepare,
  recoveryPlan,
  verifyCopiedInputs,
  verifySyntheticProof,
} from './install-prepare.mjs';
import { buildReceipt as actualBuildReceipt } from './install-prepare-acceptance.fixture.mjs';

const SHA = 'a'.repeat(64);
const IMAGE = `sha256:${'b'.repeat(64)}`;
const begin = () =>
  beginPrepare({
    transactionId: 'prepare-a',
    external: {
      archive: { path: '/owner/stage/image.tar', device: '1', inode: '2' },
      receipt: { path: '/owner/stage/build.json', device: '1', inode: '3' },
    },
    expected: { archiveSha256: SHA, receiptSha256: 'c'.repeat(64) },
    sourceManifestSha256: 'd'.repeat(64),
    policyFileSha256: 'e'.repeat(64),
  });

test('captures external identity without accepting external bytes', () => {
  const capture = begin();

  assert.equal(capture.phase, 'captured');
  assert.equal(JSON.stringify(capture).includes('bytes'), false);
  assert.equal(JSON.stringify(capture).includes('content'), false);
});

test('refuses numeric and coercible external device and inode identities', () => {
  for (const external of [
    {
      archive: { path: '/owner/image.tar', device: 1, inode: '2' },
      receipt: { path: '/owner/build.json', device: '1', inode: '3' },
    },
    {
      archive: { path: '/owner/image.tar', device: '1', inode: '2' },
      receipt: {
        path: '/owner/build.json',
        device: '1',
        inode: { toString: () => '3' },
      },
    },
  ])
    assert.throws(
      () =>
        beginPrepare({
          transactionId: 'prepare-a',
          external,
          expected: { archiveSha256: SHA, receiptSha256: 'c'.repeat(64) },
          sourceManifestSha256: 'd'.repeat(64),
          policyFileSha256: 'e'.repeat(64),
        }),
      /external identity/
    );
});

test('accepts copied inputs only after the durable watchdog is armed', () => {
  const capture = begin();
  const buildReceipt = structuredClone(actualBuildReceipt);

  assert.throws(
    () =>
      verifyCopiedInputs(capture, {
        archiveSha256: SHA,
        receiptSha256: 'c'.repeat(64),
        buildReceipt,
      }),
    /watchdog/
  );
  const armed = {
    ...capture,
    phase: 'watchdog-armed',
    watchdogReceiptSha256: '1'.repeat(64),
  };
  const verified = verifyCopiedInputs(armed, {
    archiveSha256: SHA,
    receiptSha256: 'c'.repeat(64),
    buildReceipt,
  });
  assert.equal(verified.phase, 'copies-verified');
  assert.equal(verified.imageId, IMAGE);
});

test('refuses malformed process maps and provenance envelopes from current build receipts', () => {
  const armed = {
    ...begin(),
    phase: 'watchdog-armed',
    watchdogReceiptSha256: '1'.repeat(64),
  };
  const processMapExtra = structuredClone(actualBuildReceipt);
  processMapExtra.processMap.extra = true;
  const provenanceDigest = structuredClone(actualBuildReceipt);
  provenanceDigest.provenance.node.sha256 = 'Z'.repeat(64);
  const provenanceExtra = structuredClone(actualBuildReceipt);
  provenanceExtra.provenance.node.extra = true;
  const emptyReceipt = structuredClone(actualBuildReceipt);
  emptyReceipt.provenance.node.receipt = {};
  emptyReceipt.provenance.node.sha256 = canonicalSha256({});
  const arbitraryReceipt = structuredClone(actualBuildReceipt);
  arbitraryReceipt.provenance.node.receipt = { arbitrary: true };
  arbitraryReceipt.provenance.node.sha256 = canonicalSha256(
    arbitraryReceipt.provenance.node.receipt
  );
  const digestMismatch = structuredClone(actualBuildReceipt);
  digestMismatch.provenance.node.sha256 = '0'.repeat(64);
  for (const buildReceipt of [
    processMapExtra,
    provenanceDigest,
    provenanceExtra,
    emptyReceipt,
    arbitraryReceipt,
    digestMismatch,
  ])
    assert.throws(
      () =>
        verifyCopiedInputs(armed, {
          archiveSha256: SHA,
          receiptSha256: 'c'.repeat(64),
          buildReceipt,
        }),
      /build receipt/
    );
});

test('refuses build receipts with mismatched image identity or invalid platform metadata', () => {
  const armed = {
    ...begin(),
    phase: 'watchdog-armed',
    watchdogReceiptSha256: '1'.repeat(64),
  };
  const configDigestMismatch = structuredClone(actualBuildReceipt);
  configDigestMismatch.configDigest = `sha256:${'9'.repeat(64)}`;
  const imageIdMismatch = structuredClone(actualBuildReceipt);
  imageIdMismatch.imageId = `sha256:${'9'.repeat(64)}`;
  const wrongPlatform = structuredClone(actualBuildReceipt);
  wrongPlatform.platform = 'linux/arm64';
  const malformedCommit = structuredClone(actualBuildReceipt);
  malformedCommit.implementationCommit = 'Z'.repeat(40);
  for (const buildReceipt of [
    configDigestMismatch,
    imageIdMismatch,
    wrongPlatform,
    malformedCommit,
  ])
    assert.throws(
      () =>
        verifyCopiedInputs(armed, {
          archiveSha256: SHA,
          receiptSha256: 'c'.repeat(64),
          buildReceipt,
        }),
      /build receipt/
    );
});

test('rejects coercible non-string digest and image identities', () => {
  const digestLike = { toString: () => SHA };
  assert.throws(
    () =>
      beginPrepare({
        transactionId: 'prepare-a',
        external: {
          archive: { path: '/owner/image.tar', device: '1', inode: '2' },
          receipt: { path: '/owner/build.json', device: '1', inode: '3' },
        },
        expected: { archiveSha256: digestLike, receiptSha256: 'c'.repeat(64) },
        sourceManifestSha256: 'd'.repeat(64),
        policyFileSha256: 'e'.repeat(64),
      }),
    /archive digest/
  );
  const armed = {
    ...begin(),
    phase: 'watchdog-armed',
    watchdogReceiptSha256: '1'.repeat(64),
  };
  for (const mutate of [
    (receipt) => {
      receipt.policyCanonicalSha256 = digestLike;
    },
    (receipt) => {
      const imageLike = { toString: () => IMAGE };
      receipt.imageId = imageLike;
      receipt.configDigest = imageLike;
    },
    (receipt) => {
      receipt.implementationCommit = { toString: () => 'a'.repeat(40) };
    },
  ]) {
    const buildReceipt = structuredClone(actualBuildReceipt);
    mutate(buildReceipt);
    assert.throws(
      () =>
        verifyCopiedInputs(armed, {
          archiveSha256: SHA,
          receiptSha256: 'c'.repeat(64),
          buildReceipt,
        }),
      /build receipt/
    );
  }
});

test('requires network-none synthetic containment before target acceptance', () => {
  const capture = begin();
  const armed = {
    ...capture,
    phase: 'watchdog-armed',
    watchdogReceiptSha256: '1'.repeat(64),
  };
  const copied = verifyCopiedInputs(armed, {
    archiveSha256: SHA,
    receiptSha256: 'c'.repeat(64),
    buildReceipt: structuredClone(actualBuildReceipt),
  });
  assert.throws(
    () =>
      verifySyntheticProof(copied, {
        networkMode: 'bridge',
        cleaned: true,
        productionUnchanged: true,
      }),
    /network-none/
  );
  const contained = verifySyntheticProof(copied, {
    networkMode: 'none',
    cleaned: true,
    productionUnchanged: true,
    dedicatedSocket: '/run/baci-cwv/docker.sock',
  });
  const accepted = acceptTarget(contained, {
    imageId: IMAGE,
    imageConfigDigest: IMAGE,
    productionUnchanged: true,
    supervisorReceiptSha256: '2'.repeat(64),
  });
  assert.equal(accepted.phase, 'target-accepted');
  assert.deepEqual(recoveryPlan(accepted), {
    retainTarget: true,
    removeImport: true,
    removeSynthetic: true,
  });
});

test('refuses coherent malicious pairs and pre-acceptance recovery retains no target', () => {
  const capture = begin();
  const armed = {
    ...capture,
    phase: 'watchdog-armed',
    watchdogReceiptSha256: '1'.repeat(64),
  };
  assert.throws(
    () =>
      verifyCopiedInputs(armed, {
        archiveSha256: '9'.repeat(64),
        receiptSha256: '8'.repeat(64),
        buildReceipt: {
          ...structuredClone(actualBuildReceipt),
          archiveSha256: '9'.repeat(64),
        },
      }),
    /owner-frozen/
  );
  assert.deepEqual(recoveryPlan(armed), {
    retainTarget: false,
    removeImport: true,
    removeSynthetic: true,
  });
});
