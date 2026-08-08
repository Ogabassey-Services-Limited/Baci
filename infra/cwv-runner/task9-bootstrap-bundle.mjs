// biome-ignore-all format: compact fail-closed generator stays below the 300-line limit
import { createHash, randomBytes } from 'node:crypto';
import { closeSync, fchmodSync, fsyncSync, lstatSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifySourceManifest } from './source-manifest.mjs';
import { authorizeTask9Bundle, BUNDLE_ENTRIES, canonicalJson, parseUstar } from './task9-bootstrap.mjs';
import { fsyncTask9Directory } from './task9-fsync-directory.mjs';
import { readHeldTask9File } from './task9-held-file.mjs';
import { withTask9OutputDirectory } from './task9-output-directory.mjs';
import { readPublishedTask9Files } from './task9-published-files.mjs';

const DIGEST = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const TRANSACTION_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
const REF_PART = /^[A-Za-z0-9._/-]+$/;
const MODES = Object.freeze({
  'manifest.json': '100400',
  'manifest.sha256': '100400',
  'node-provenance.json': '100400',
  node: '100500',
  'source.tar': '100400',
  'source.tar.sha256': '100400',
  'task9-bootstrap.mjs': '100400',
});
const CHECKOUT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => { throw new TypeError(message); };
const exact = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());

function checkedIdentity(input, manifest, policy) {
  const repository = policy.repository;
  if (
    !exact(repository, ['id', 'name']) ||
    !Number.isSafeInteger(repository.id) ||
    repository.id < 1 ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository.name)
  )
    fail('invalid repository identity');
  if (
    !SHA.test(input.deploymentSha) ||
    input.deploymentSha !== manifest.mergeSha ||
    !REF_PART.test(input.headRef) ||
    !Number.isSafeInteger(input.workflowId) ||
    input.workflowId < 1 ||
    !DIGEST.test(input.admissionId)
  )
    fail('invalid source identity');
  return {
    base: { ref: 'refs/heads/main', sha: manifest.baseSha },
    exactRun: { admissionId: input.admissionId, workflow: { id: input.workflowId, path: '.github/workflows/cwv-runner-attestation.yml', ref: 'refs/heads/main' } },
    mergeSha: manifest.mergeSha,
    pullRequest: { headRef: input.headRef, number: manifest.prNumber },
    ref: `refs/pull/${manifest.prNumber}/merge`,
    repository,
    reviewedSha: manifest.reviewedHeadSha,
  };
}

function checkedProvenance(bytes, nodeBytes, policy) {
  let value;
  try {
    value = JSON.parse(bytes);
  } catch {
    fail('invalid Node provenance');
  }
  if (
    canonicalJson(value) !== bytes.toString() ||
    !exact(value, ['archiveSha256', 'artifact', 'checksumSha256', 'executableSha256', 'keyringSha256', 'schemaVersion', 'sha256', 'signatureSha256', 'version']) ||
    value.artifact !== 'node' ||
    value.schemaVersion !== 1 ||
    value.sha256 !== hash(nodeBytes) ||
    value.executableSha256 !== hash(nodeBytes) ||
    value.archiveSha256 !== policy.supplyChain?.node?.ownerDarwinArm64Sha256 ||
    value.version !== policy.supplyChain?.node?.version ||
    value.checksumSha256 !== policy.supplyChainProvenance?.node?.checksumsSha256 ||
    value.keyringSha256 !== policy.supplyChainProvenance?.node?.keyringSha256 ||
    value.signatureSha256 !== policy.supplyChainProvenance?.node?.signatureSha256
  )
    fail('invalid Node provenance');
  return value;
}

function writeExclusive(path, bytes, mode) {
  const fd = openSync(path, 'wx', mode);
  try {
    writeFileSync(fd, bytes);
    fchmodSync(fd, mode);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function logicalId(prefix, supplied) {
  const value = supplied ?? `${prefix}-${randomBytes(16).toString('hex')}`;
  if (!ID.test(value)) fail(`invalid ${prefix} id`);
  return value;
}

function checkedTransactionId(supplied) {
  const value = supplied ?? `task9-${randomBytes(16).toString('hex')}`;
  if (!TRANSACTION_ID.test(value)) fail('invalid transaction id');
  return value;
}

export function generateTask9BootstrapBundle(
  input,
  { afterPayloadRead = () => undefined, beforeVerify = () => undefined, makeOutputDirectory = mkdirSync, outputParent = '/private/tmp' } = {}
) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    fail('invalid Task 9 bundle input');
  const transactionId = checkedTransactionId(input.transactionId);
  const bundleId = logicalId('task9-bundle', input.bundleId);
  const outputRoot = resolve(input.outputRoot ?? join(outputParent, `baci-cwv-task9-bootstrap-${transactionId}`));
  if (
    dirname(outputRoot) !== resolve(outputParent) ||
    basename(outputRoot) !== `baci-cwv-task9-bootstrap-${transactionId}` ||
    lstatSync(outputRoot, { throwIfNoEntry: false })
  )
    fail('unsafe Task 9 output');
  if (resolve(input.cwd) !== CHECKOUT_ROOT) fail('unsafe Task 9 checkout');
  const manifestInput = readHeldTask9File(input.sourceManifestPath, 0o600);
  const manifestDigestInput = readHeldTask9File(input.sourceManifestDigestPath, 0o600);
  const archiveInput = readHeldTask9File(input.sourceArchivePath, 0o600);
  const archiveDigestInput = readHeldTask9File(input.sourceArchiveDigestPath, 0o600);
  const node = readHeldTask9File(input.nodePath, 0o500);
  const nodeProvenance = readHeldTask9File(input.nodeProvenancePath, 0o400);
  if (
    !DIGEST.test(manifestDigestInput.bytes.toString().trim()) ||
    manifestDigestInput.bytes.toString() !==
      `${hash(manifestInput.bytes)}\n` ||
    !DIGEST.test(archiveDigestInput.bytes.toString().trim()) ||
    archiveDigestInput.bytes.toString() !== `${hash(archiveInput.bytes)}\n`
  )
    fail('invalid frozen digest');
  let manifest;
  try { manifest = JSON.parse(manifestInput.bytes); }
  catch { fail('invalid frozen manifest'); }
  if (canonicalJson(manifest) !== manifestInput.bytes.toString()) fail('invalid frozen manifest');
  if (
    !manifest.sourceArchive ||
    typeof manifest.sourceArchive !== 'object' ||
    !Array.isArray(manifest.sourceArchive.entries)
  )
    fail('invalid frozen manifest');
  const expected = manifest.sourceArchive.entries.map(({ blobSha256: sha256, mode, path }) => ({ mode, path, sha256 }));
  const rows = parseUstar(archiveInput.bytes, expected);
  const byPath = new Map(rows.map((row) => [row.path, row]));
  const policyRow = byPath.get('infra/cwv-runner/policy.json');
  const transportRow = byPath.get('infra/cwv-runner/owner-api-transport.mjs');
  const bootstrapRow = byPath.get('infra/cwv-runner/task9-bootstrap.mjs');
  const launcherRow = byPath.get('infra/cwv-runner/task9-bootstrap-runtime.mjs');
  if (!policyRow || !transportRow || !bootstrapRow || !launcherRow)
    fail('incomplete Task 9 source archive');
  let policy;
  try {
    policy = JSON.parse(policyRow.bytes);
  } catch {
    fail('invalid Task 9 policy');
  }
  const identity = checkedIdentity(input, manifest, policy);
  const provenance = checkedProvenance(nodeProvenance.bytes, node.bytes, policy);
  beforeVerify();
  const verifiedManifest = verifySourceManifest({
    baseSha: manifest.baseSha,
    cwd: input.cwd,
    input: manifestInput.path,
    inputDigest: manifestDigestInput.path,
    mergeSha: manifest.mergeSha,
    prNumber: manifest.prNumber,
    reviewedHeadSha: manifest.reviewedHeadSha,
    sourceArchive: archiveInput.path,
    sourceArchiveDigest: archiveDigestInput.path,
  });
  if (canonicalJson(verifiedManifest) !== canonicalJson(manifest))
    fail('held source changed during verification');
  if (!Number.isSafeInteger(input.generation) || input.generation < 0)
    fail('invalid generation');
  const payload = {
    'manifest.json': manifestInput.bytes,
    'manifest.sha256': Buffer.from(`${hash(manifestInput.bytes)}  manifest.json\n`),
    'node-provenance.json': nodeProvenance.bytes,
    node: node.bytes,
    'source.tar': archiveInput.bytes,
    'source.tar.sha256': Buffer.from(`${hash(archiveInput.bytes)}  source.tar\n`),
    'task9-bootstrap.mjs': bootstrapRow.bytes,
  };
  const runtime = {
    bootstrapSha256: hash(bootstrapRow.bytes),
    launcherSha256: hash(launcherRow.bytes),
    nodeProvenanceSha256: hash(nodeProvenance.bytes),
    nodeSha256: hash(node.bytes),
    nodeVersion: provenance.version,
  };
  runtime.runtimeSha256 = hash(Buffer.from(canonicalJson(runtime)));
  const envelope = {
    base: identity.base,
    bundleId,
    deploymentSha: input.deploymentSha,
    exactRun: identity.exactRun,
    generation: input.generation,
    mergeSha: identity.mergeSha,
    payload: {
      entries: [...BUNDLE_ENTRIES].sort().map((name) => ({
        mode: MODES[name],
        path: `payload/${name}`,
        sha256: hash(payload[name]),
        type: 'file',
      })),
    },
    policy: { path: policyRow.path, sha256: hash(policyRow.bytes) },
    pullRequest: identity.pullRequest,
    purpose: 'task9-exact-run',
    ref: identity.ref,
    repository: identity.repository,
    reviewedSha: identity.reviewedSha,
    runtime,
    schemaVersion: 1,
    source: {
      archiveSha256: hash(archiveInput.bytes),
      manifestSha256: hash(manifestInput.bytes),
    },
    transactionId,
    transport: { path: transportRow.path, sha256: hash(transportRow.bytes) },
  };
  const envelopeBytes = Buffer.from(canonicalJson(envelope));
  const envelopeSha256 = hash(envelopeBytes);
  const memoryFiles = Object.fromEntries(BUNDLE_ENTRIES.map((name) => [name, {
    bytes: payload[name], mode: MODES[name], owner: process.getuid(), symlink: false,
  }]));
  authorizeTask9Bundle({
    bundleId,
    envelopeBytes,
    envelopeSha256,
    files: memoryFiles,
    owner: process.getuid(),
    reviewedEnvelopeSha256: envelopeSha256,
  });
  const payloadDirectory = join(outputRoot, 'payload');
  return withTask9OutputDirectory(outputRoot, () => {
    fsyncTask9Directory(dirname(outputRoot));
    mkdirSync(payloadDirectory, { mode: 0o700 });
    for (const name of BUNDLE_ENTRIES)
      writeExclusive(
        join(payloadDirectory, name),
        payload[name],
        name === 'node' ? 0o500 : 0o400
      );
    fsyncTask9Directory(payloadDirectory);
    const envelopePath = join(outputRoot, 'bootstrap-review-envelope.json');
    const envelopeSha256Path = join(outputRoot, 'bootstrap-review-envelope.sha256');
    writeExclusive(envelopePath, envelopeBytes, 0o400);
    writeExclusive(envelopeSha256Path, `${envelopeSha256}\n`, 0o400);
    fsyncTask9Directory(outputRoot);
    fsyncTask9Directory(dirname(outputRoot));
    const heldEnvelope = readHeldTask9File(envelopePath, 0o400);
    const heldEnvelopeDigest = readHeldTask9File(envelopeSha256Path, 0o400);
    if (
      !heldEnvelope.bytes.equals(envelopeBytes) ||
      heldEnvelopeDigest.bytes.toString() !== `${envelopeSha256}\n`
    )
      fail('published envelope changed');
    const heldPayload = readPublishedTask9Files(payloadDirectory, process.getuid(), { afterRead: afterPayloadRead });
    try {
      authorizeTask9Bundle({
        bundleId,
        envelopeBytes: heldEnvelope.bytes,
        envelopeSha256,
        files: heldPayload.files,
        owner: process.getuid(),
        reviewedEnvelopeSha256: envelopeSha256,
      });
      heldPayload.verify();
      return Object.freeze({
        bundleId,
        envelopePath,
        envelopeSha256,
        envelopeSha256Path,
        outputRoot,
        payloadDirectory,
        transactionId,
      });
    } finally {
      heldPayload.close();
    }
  }, { makeDirectory: makeOutputDirectory });
}
