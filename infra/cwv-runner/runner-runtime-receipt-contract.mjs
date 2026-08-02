import { createHash } from 'node:crypto';
import { policyBuildArguments } from './build-image.mjs';
import { canonicalJson } from './canonical-json.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const image = /^sha256:[a-f0-9]{64}$/;
const hash = /^[a-f0-9]{64}$/;
const executables = new Set([
  'bin/Runner.Listener',
  'bin/Runner.PluginHost',
  'bin/Runner.Worker',
  'externals/node24/bin/node',
]);
const required = new Set([...executables, 'entrypoint.mjs']);
const forbidden = new Set([
  '.credentials',
  '.credentials_rsaparams',
  '.runner',
  '.env',
  '.path',
  '_diag',
  'bin/installdependencies.sh',
  'config.sh',
  'diagnostics',
  'env.sh',
  'run-helper.cmd.template',
  'run-helper.sh',
  'run-helper.sh.template',
  'run.sh',
  'safe_sleep.sh',
  'svc.sh',
]);
const exact = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const fail = () => {
  throw new TypeError('runner runtime receipt refused');
};
export const compareRunnerRuntimePaths = (left, right) =>
  Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
export const compareRunnerRuntimeFileRows = (left, right) =>
  compareRunnerRuntimePaths(left.path, right.path);
const safe = (path) =>
  typeof path === 'string' &&
  path &&
  !path.startsWith('/') &&
  !path.endsWith('/') &&
  !path.includes('\\') &&
  path.split('/').every((part) => part && part !== '.' && part !== '..') &&
  ![...path].some(
    (character) =>
      character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
  ) &&
  !forbidden.has(path) &&
  !forbidden.has(path.split('/')[0]);

function manifest(value, imageId) {
  if (
    !exact(value, ['files', 'imageId', 'receiptBinding', 'schemaVersion']) ||
    value.schemaVersion !== 1 ||
    value.receiptBinding !== 'runner-runtime-closure-v1' ||
    value.imageId !== imageId ||
    !Array.isArray(value.files) ||
    !value.files.length ||
    value.files.length > 10_000
  )
    fail();
  let prior;
  const paths = new Set();
  for (const row of value.files) {
    if (
      !exact(row, ['mode', 'path', 'sha256']) ||
      !safe(row.path) ||
      !hash.test(row.sha256 ?? '') ||
      row.mode !== (executables.has(row.path) ? '0555' : '0444') ||
      (prior !== undefined &&
        compareRunnerRuntimePaths(prior, row.path) >= 0) ||
      paths.has(row.path)
    )
      fail();
    paths.add(row.path);
    prior = row.path;
  }
  if ([...required].some((path) => !paths.has(path))) fail();
}

export function validateRunnerRuntimeReceipt(receipt) {
  if (
    !exact(receipt, [
      'context',
      'contextBytes',
      'contextReceipt',
      'imageReceiptBytes',
      'identityManifest',
      'identityManifestBytes',
      'identityManifestReceipt',
      'manifest',
      'manifestBytes',
      'manifestReceipt',
    ]) ||
    receipt.manifestBytes !== canonicalJson(receipt.manifest) ||
    receipt.identityManifestBytes !== canonicalJson(receipt.identityManifest) ||
    receipt.contextBytes !== canonicalJson(receipt.context) ||
    receipt.manifestReceipt !== `${sha256(receipt.manifestBytes)}\n` ||
    receipt.identityManifestReceipt !==
      `${sha256(receipt.identityManifestBytes)}\n` ||
    receipt.contextReceipt !== `${sha256(receipt.contextBytes)}\n`
  )
    fail();
  let imageReceipt;
  try {
    imageReceipt = JSON.parse(receipt.imageReceiptBytes);
  } catch {
    fail();
  }
  const context = receipt.context;
  if (
    !exact(imageReceipt, [
      'archiveSha256',
      'configDigest',
      'imageId',
      'implementationCommit',
      'platform',
      'policyCanonicalSha256',
      'policyFileSha256',
      'processMap',
      'provenance',
      'schemaVersion',
      'sourceManifestSha256',
    ]) ||
    imageReceipt.schemaVersion !== 1 ||
    !image.test(imageReceipt.imageId ?? '') ||
    !hash.test(imageReceipt.archiveSha256 ?? '') ||
    !image.test(imageReceipt.configDigest ?? '') ||
    !/^[a-f0-9]{40}$/.test(imageReceipt.implementationCommit ?? '') ||
    !hash.test(imageReceipt.sourceManifestSha256 ?? '') ||
    canonicalJson(imageReceipt) !== receipt.imageReceiptBytes ||
    !exact(context, [
      'archiveSha256',
      'buildArgumentNames',
      'buildArgumentsSha256',
      'configDigest',
      'imageId',
      'imageReceiptSha256',
      'manifestSha256',
      'platform',
      'receiptBinding',
      'runtimeIdentitySha256',
      'runtimeManifestSha256',
      'schemaVersion',
      'sourceManifestSha256',
    ]) ||
    context.schemaVersion !== 1 ||
    context.receiptBinding !== 'runner-runtime-context-v1'
  )
    fail();
  const buildArguments = policyBuildArguments(context.sourceManifestSha256);
  if (
    canonicalJson(context.buildArgumentNames) !==
      canonicalJson(Object.keys(buildArguments)) ||
    context.buildArgumentsSha256 !== sha256(canonicalJson(buildArguments)) ||
    [
      ['archiveSha256', imageReceipt.archiveSha256],
      ['configDigest', imageReceipt.configDigest],
      ['imageId', imageReceipt.imageId],
      ['platform', imageReceipt.platform],
      ['sourceManifestSha256', imageReceipt.sourceManifestSha256],
    ].some(([key, value]) => context[key] !== value) ||
    context.imageReceiptSha256 !== sha256(receipt.imageReceiptBytes) ||
    context.manifestSha256 !== sha256(receipt.manifestBytes) ||
    context.runtimeManifestSha256 !== sha256(receipt.identityManifestBytes) ||
    context.runtimeIdentitySha256 !==
      sha256(canonicalJson(receipt.identityManifest?.runtime)) ||
    !hash.test(context.runtimeIdentitySha256 ?? '') ||
    !exact(receipt.identityManifest, [
      'chromeTargetPath',
      'pnpmPackage',
      'runtime',
      'schemaVersion',
    ]) ||
    receipt.identityManifest.schemaVersion !== 1 ||
    receipt.identityManifest.runtime?.imageId !== imageReceipt.imageId
  )
    fail();
  manifest(receipt.manifest, imageReceipt.imageId);
}
