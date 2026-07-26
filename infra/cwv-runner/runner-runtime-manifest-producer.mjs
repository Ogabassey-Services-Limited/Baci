import { createHash } from 'node:crypto';
// biome-ignore format: receipt creation and rollback share one closed filesystem boundary.
import { mkdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// biome-ignore format: archive inspection limits form one explicit trust boundary.
import { archiveLimits, createArchiveWorkspace, extractArchiveMember, fileSha256, inspectArchive, readSmallMember, removeArchiveWorkspace } from './archive-stream.mjs';
import {
  expectedBuildReceipt,
  parseSourceManifest,
  policyBuildArguments,
} from './build-image.mjs';
import { canonicalJson } from './canonical-json.mjs';
import { snapshotRunnerArchive } from './runner-runtime-archive-snapshot.mjs';
// biome-ignore format: runtime identity projection helpers remain one closed boundary.
import { deriveRunnerRuntimeIdentity, verifyRunnerRuntimeProjection, writeRunnerRuntimeProjection } from './runner-runtime-identity-manifest.mjs';
import { assertDistinctRunnerRuntimeOutputs } from './runner-runtime-output-paths.mjs';
import * as runtimeReceiptContract from './runner-runtime-receipt-contract.mjs';

export { validateRunnerRuntimeReceipt } from './runner-runtime-receipt-contract.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const identityContractBytes = readFileSync(
  new URL('./identity-contract.json', import.meta.url)
);
const identityContract = JSON.parse(identityContractBytes);
const projectionPaths = new Set(
  identityContract?.builderSources?.runtime?.runnerFiles ?? []
);
const prefix = 'opt/runner/';
const generated = new Set([
  '.credentials',
  '.credentials_rsaparams',
  '.runner',
]);
const forbidden = new Set([
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
const executables = new Set([
  'bin/Runner.Listener',
  'bin/Runner.PluginHost',
  'bin/Runner.Worker',
  'externals/node24/bin/node',
]);
const required = new Set([...executables, 'entrypoint.mjs']);
const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const fail = (message) => {
  throw new TypeError(message);
};
function imageReceipt(archive, source, receipt) {
  try {
    const expected = expectedBuildReceipt(
      archive,
      source,
      source.manifest.mergeSha
    );
    if (canonicalJson(receipt) !== canonicalJson(expected))
      fail('image receipt refused');
    return expected;
  } catch (error) {
    if (error?.message === 'image receipt refused') throw error;
    fail('image receipt refused');
  }
}
function imageLayer(archive, workspace) {
  let manifest;
  try {
    manifest = JSON.parse(
      readSmallMember(
        extractArchiveMember(
          archive,
          'manifest.json',
          workspace,
          'manifest.json'
        )
      ).toString('utf8')
    );
  } catch {
    fail('image archive refused');
  }
  const layer = manifest?.[0]?.Layers?.[0];
  if (!/^[a-f0-9]{64}\/layer\.tar$/.test(layer ?? ''))
    fail('image archive refused');
  return extractArchiveMember(archive, layer, workspace, 'runtime-layer.tar');
}
function exactRuntimeFile(layer, entries, path, workspace, output) {
  const rows = entries.filter((entry) => entry.name === path);
  if (rows.length !== 1 || rows[0].type !== '0')
    fail('runner runtime identity file refused');
  const extracted = extractArchiveMember(layer, path, workspace, output);
  const bytes = readFileSync(extracted);
  return { bytes, path, sha256: sha256(bytes) };
}
function runtimeArchive(archive) {
  const workspace = createArchiveWorkspace();
  try {
    const layer = imageLayer(archive, workspace);
    // biome-ignore format: inner runtime layers have an explicit separate member limit.
    const entries = inspectArchive(layer, archiveLimits, archiveLimits.layerMembers);
    const files = [];
    const projectionFiles = [];
    for (const entry of entries) {
      if (!entry.name.startsWith(prefix)) continue;
      const path = entry.name.slice(prefix.length);
      if (!path) continue;
      if (entry.type === '5') continue;
      if (entry.type !== '0') fail('runner runtime link refused');
      if (generated.has(path)) fail('runner runtime generated state refused');
      if (path === '_diag' || path.startsWith('_diag/')) continue;
      if (forbidden.has(path) || forbidden.has(path.split('/')[0]))
        fail('runner runtime forbidden state refused');
      const mode = executables.has(path) ? '0555' : '0444';
      if (entry.mode !== Number.parseInt(mode, 8))
        fail('runner runtime mode refused');
      const output = `runner-${sha256(Buffer.from(path)).slice(0, 16)}`;
      const extracted = extractArchiveMember(
        layer,
        entry.name,
        workspace,
        output
      );
      const digest = fileSha256(extracted);
      files.push({ mode, path, sha256: digest });
      if (projectionPaths.has(path))
        projectionFiles.push({
          bytes: readFileSync(extracted),
          path,
          sha256: digest,
        });
    }
    files.sort(runtimeReceiptContract.compareRunnerRuntimeFileRows);
    if (!files.length) fail('runner runtime files refused');
    const paths = new Set(files.map((file) => file.path));
    if (files.length > 10_000 || [...required].some((path) => !paths.has(path)))
      fail('runner runtime files refused');
    const runtimeFiles = Object.fromEntries(
      [
        ['chrome', 'opt/google/chrome/google-chrome'],
        ['node', 'opt/node/bin/node'],
        ['pnpm', 'opt/pnpm/bin/pnpm.cjs'],
        ['pnpmPackage', 'opt/pnpm/package.json'],
      ].map(([name, path], index) => [
        name,
        exactRuntimeFile(layer, entries, path, workspace, `identity-${index}`),
      ])
    );
    return { files, projectionFiles, runtimeFiles };
  } finally {
    removeArchiveWorkspace(workspace);
  }
}
export function createRunnerRuntimeBundle(input) {
  if (
    !exactKeys(input, [
      'archive',
      'imageReceipt',
      'sourceManifestPath',
      'sourceManifestSha256',
    ])
  )
    fail('runner runtime input refused');
  let source;
  try {
    source = parseSourceManifest(
      input.sourceManifestPath,
      input.sourceManifestSha256
    );
  } catch {
    fail('runner runtime source refused');
  }
  const workspace = createArchiveWorkspace();
  let accepted;
  let archiveRuntime;
  try {
    const snapshot = snapshotRunnerArchive(input.archive, workspace);
    accepted = imageReceipt(snapshot.path, source, input.imageReceipt);
    if (accepted.archiveSha256 !== snapshot.sha256)
      fail('runner runtime archive refused');
    archiveRuntime = runtimeArchive(snapshot.path);
  } finally {
    removeArchiveWorkspace(workspace);
  }
  const manifest = {
    files: archiveRuntime.files,
    imageId: accepted.imageId,
    receiptBinding: 'runner-runtime-closure-v1',
    schemaVersion: 1,
  };
  const manifestBytes = canonicalJson(manifest);
  const imageReceiptBytes = canonicalJson(accepted);
  const identity = deriveRunnerRuntimeIdentity({
    contract: identityContract,
    imageReceipt: accepted,
    imageReceiptBytes,
    runnerManifest: manifest,
    runtimeFiles: archiveRuntime.runtimeFiles,
  });
  const buildArguments = policyBuildArguments(source.sha256);
  const context = {
    archiveSha256: accepted.archiveSha256,
    buildArgumentNames: Object.keys(buildArguments),
    buildArgumentsSha256: sha256(canonicalJson(buildArguments)),
    configDigest: accepted.configDigest,
    imageId: accepted.imageId,
    imageReceiptSha256: sha256(imageReceiptBytes),
    manifestSha256: sha256(manifestBytes),
    platform: accepted.platform,
    receiptBinding: 'runner-runtime-context-v1',
    schemaVersion: 1,
    sourceManifestSha256: source.sha256,
    runtimeIdentitySha256: identity.runtimeIdentitySha256,
    runtimeManifestSha256: identity.imageEvidence.runtimeManifestSha256,
  };
  const contextBytes = canonicalJson(context);
  const receipt = Object.freeze({
    context: Object.freeze(context),
    contextBytes,
    contextReceipt: `${sha256(contextBytes)}\n`,
    imageReceiptBytes,
    identityManifest: identity.identityManifest,
    identityManifestBytes: identity.identityManifestBytes,
    identityManifestReceipt: identity.identityManifestReceipt,
    manifest: Object.freeze({
      ...manifest,
      files: Object.freeze(manifest.files.map((entry) => Object.freeze(entry))),
    }),
    manifestBytes,
    manifestReceipt: `${sha256(manifestBytes)}\n`,
  });
  return Object.freeze({
    projection: Object.freeze({
      identityContractBytes,
      runnerFiles: Object.freeze(
        archiveRuntime.projectionFiles.map((row) => Object.freeze(row))
      ),
      runtimeManifestBytes: Buffer.from(identity.identityManifestBytes),
    }),
    receipt,
  });
}
export function createRunnerRuntimeReceipt(input) {
  return createRunnerRuntimeBundle(input).receipt;
}

export function writeRunnerRuntimeReceipt(directory, receipt) {
  runtimeReceiptContract.validateRunnerRuntimeReceipt(receipt);
  mkdirSync(directory, { mode: 0o700, recursive: true });
  const paths = {
    context: join(directory, 'runner-runtime-context.json'),
    contextReceipt: join(directory, 'runner-runtime-context.json.sha256'),
    identityManifest: join(directory, 'runner-runtime-identity-manifest.json'),
    identityManifestReceipt: join(
      directory,
      'runner-runtime-identity-manifest.json.sha256'
    ),
    manifest: join(directory, 'runner-runtime-manifest.json'),
    manifestReceipt: join(directory, 'runner-runtime-manifest.json.sha256'),
  };
  for (const [path, bytes] of [
    [paths.manifest, receipt.manifestBytes],
    [paths.manifestReceipt, receipt.manifestReceipt],
    [paths.context, receipt.contextBytes],
    [paths.contextReceipt, receipt.contextReceipt],
    [paths.identityManifest, receipt.identityManifestBytes],
    [paths.identityManifestReceipt, receipt.identityManifestReceipt],
  ])
    writeFileSync(path, bytes, { flag: 'wx', mode: 0o400 });
  return Object.freeze(paths);
}
// biome-ignore format: the transactional boundary stays visible within the source ceiling.
export async function writeRunnerRuntimeBundle(receiptDirectory, projectionDirectory, bundle, owner = { gid: process.getgid(), uid: process.getuid() }) {
  assertDistinctRunnerRuntimeOutputs(receiptDirectory, projectionDirectory);
  const paths = writeRunnerRuntimeReceipt(receiptDirectory, bundle.receipt);
  try {
    await writeRunnerRuntimeProjection(projectionDirectory, bundle.projection, owner);
    const projection = await verifyRunnerRuntimeProjection(projectionDirectory, bundle.projection, owner);
    return Object.freeze({ paths, projection });
  } catch (error) {
    for (const path of Object.values(paths)) rmSync(path, { force: true });
    try { rmdirSync(receiptDirectory); } catch (cleanupError) {
      if (!['ENOENT', 'ENOTEMPTY'].includes(cleanupError.code)) throw cleanupError;
    }
    throw error;
  }
}
