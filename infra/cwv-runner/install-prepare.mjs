import { readFileSync } from 'node:fs';
import { validateImageProcessMap } from './image-process-map.mjs';
import { validateBuildProvenance } from './install-prepare-provenance.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';

const HEX = /^[0-9a-f]{64}$/;
const IMAGE = /^sha256:[0-9a-f]{64}$/;
const TRANSACTION = /^prepare-[a-z0-9][a-z0-9-]{0,52}$/;
const PROCESS_MAP_POLICY = parseRunnerPolicy(
  JSON.parse(readFileSync(new URL('./policy.json', import.meta.url), 'utf8'))
);
const fail = (message) => {
  throw new TypeError(message);
};
const exactKeys = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...keys].sort());
const digest = (value, field) => {
  if (typeof value !== 'string' || !HEX.test(value)) fail(`invalid ${field}`);
  return value;
};
const externalIdentity = (value) => {
  if (!exactKeys(value, ['path', 'device', 'inode']))
    fail('invalid external identity');
  if (typeof value.path !== 'string' || !value.path.startsWith('/'))
    fail('invalid external path');
  if (
    typeof value.device !== 'string' ||
    typeof value.inode !== 'string' ||
    !/^[0-9]+$/.test(value.device) ||
    !/^[0-9]+$/.test(value.inode)
  )
    fail('invalid external identity');
  return { path: value.path, device: value.device, inode: value.inode };
};

export function beginPrepare(input) {
  if (
    !exactKeys(input, [
      'transactionId',
      'external',
      'expected',
      'sourceManifestSha256',
      'policyFileSha256',
    ]) ||
    !TRANSACTION.test(input.transactionId)
  )
    fail('invalid prepare input');
  if (!exactKeys(input.external, ['archive', 'receipt']))
    fail('invalid external projection');
  if (!exactKeys(input.expected, ['archiveSha256', 'receiptSha256']))
    fail('invalid owner-frozen projection');
  return {
    schemaVersion: 1,
    transactionId: input.transactionId,
    phase: 'captured',
    external: {
      archive: externalIdentity(input.external.archive),
      receipt: externalIdentity(input.external.receipt),
    },
    expected: {
      archiveSha256: digest(input.expected.archiveSha256, 'archive digest'),
      receiptSha256: digest(input.expected.receiptSha256, 'receipt digest'),
    },
    sourceManifestSha256: digest(
      input.sourceManifestSha256,
      'source manifest digest'
    ),
    policyFileSha256: digest(input.policyFileSha256, 'policy digest'),
  };
}

export function verifyCopiedInputs(state, actual) {
  if (
    state.phase !== 'watchdog-armed' ||
    !HEX.test(state.watchdogReceiptSha256)
  )
    fail('durable watchdog receipt required');
  if (
    !exactKeys(actual, ['archiveSha256', 'receiptSha256', 'buildReceipt']) ||
    actual.archiveSha256 !== state.expected.archiveSha256 ||
    actual.receiptSha256 !== state.expected.receiptSha256
  )
    fail('owner-frozen input digest mismatch');
  const receipt = actual.buildReceipt;
  if (
    !exactKeys(receipt, [
      'schemaVersion',
      'archiveSha256',
      'sourceManifestSha256',
      'policyFileSha256',
      'policyCanonicalSha256',
      'imageId',
      'configDigest',
      'platform',
      'implementationCommit',
      'processMap',
      'provenance',
    ]) ||
    receipt.schemaVersion !== 1 ||
    receipt.archiveSha256 !== actual.archiveSha256 ||
    receipt.sourceManifestSha256 !== state.sourceManifestSha256 ||
    receipt.policyFileSha256 !== state.policyFileSha256 ||
    typeof receipt.policyCanonicalSha256 !== 'string' ||
    !HEX.test(receipt.policyCanonicalSha256) ||
    typeof receipt.imageId !== 'string' ||
    !IMAGE.test(receipt.imageId) ||
    typeof receipt.configDigest !== 'string' ||
    !IMAGE.test(receipt.configDigest) ||
    receipt.imageId !== receipt.configDigest ||
    receipt.platform !== 'linux/amd64' ||
    typeof receipt.implementationCommit !== 'string' ||
    !/^[0-9a-f]{40}$/.test(receipt.implementationCommit)
  )
    fail('build receipt binding mismatch');
  try {
    validateImageProcessMap(receipt.processMap, PROCESS_MAP_POLICY);
    validateBuildProvenance(receipt.provenance, PROCESS_MAP_POLICY);
  } catch {
    fail('build receipt binding mismatch');
  }
  return {
    ...state,
    phase: 'copies-verified',
    imageId: receipt.imageId,
    imageConfigDigest: receipt.configDigest,
  };
}

export function verifySyntheticProof(state, proof) {
  if (state.phase !== 'copies-verified') fail('copied inputs required');
  if (
    !exactKeys(proof, [
      'networkMode',
      'cleaned',
      'productionUnchanged',
      'dedicatedSocket',
    ]) ||
    proof.networkMode !== 'none' ||
    proof.dedicatedSocket !== '/run/baci-cwv/docker.sock' ||
    proof.cleaned !== true ||
    proof.productionUnchanged !== true
  )
    fail('network-none synthetic containment required');
  return { ...state, phase: 'synthetic-proven' };
}

export function acceptTarget(state, proof) {
  if (state.phase !== 'synthetic-proven') fail('synthetic proof required');
  if (
    !exactKeys(proof, [
      'imageId',
      'imageConfigDigest',
      'productionUnchanged',
      'supervisorReceiptSha256',
    ]) ||
    proof.imageId !== state.imageId ||
    proof.imageConfigDigest !== state.imageConfigDigest ||
    proof.productionUnchanged !== true ||
    !HEX.test(proof.supervisorReceiptSha256)
  )
    fail('target verification mismatch');
  return {
    ...state,
    phase: 'target-accepted',
    supervisorReceiptSha256: proof.supervisorReceiptSha256,
  };
}

export function recoveryPlan(state) {
  return {
    retainTarget: state.phase === 'target-accepted',
    removeImport: true,
    removeSynthetic: true,
  };
}
