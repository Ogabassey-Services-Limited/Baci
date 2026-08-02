import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { policyBuildArguments } from './build-image.mjs';
import { sealedPaths } from './image-process-map.mjs';
import { provenance as sourceProvenance } from './image-projection-receipts.fixture.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';
import { writeRunnerRuntimeProjection } from './runner-runtime-identity-manifest.mjs';
import { writeRunnerRuntimeReceipt } from './runner-runtime-manifest-producer.mjs';

export const canonical = (value) => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const IMAGE = `sha256:${'b'.repeat(64)}`;
export const DIGEST = '2'.repeat(64);
const policy = parseRunnerPolicy(
  JSON.parse(readFileSync(new URL('./policy.json', import.meta.url), 'utf8'))
);
const roles = Object.entries(policy.processAllowSet.executables).map(
  ([role, rule]) => [role, rule.path, rule.maxInstancesByPhase]
);
export const processMap = {
  entries: roles.map(([role, path, maxInstancesByPhase]) => ({
    maxInstancesByPhase,
    mode: '0555',
    owner: '0:0',
    path,
    realpath: path,
    role,
    sha256: DIGEST,
  })),
  phases: policy.processAllowSet.phases,
  receiptBinding: 'image-process-map-v1',
  schemaVersion: 1,
  sealed: [...new Set([...sealedPaths, ...roles.map(([, path]) => path)])]
    .sort()
    .map((path) => ({
      mode: '0555',
      owner: '0:0',
      path,
      realpath: path,
      sha256: DIGEST,
    })),
};
const provenancePaths = {
  baseTools: '/opt/baci-cwv/provenance/base-tools.json',
  chrome: '/opt/baci-cwv/provenance/chrome.json',
  node: '/opt/baci-cwv/provenance/node.json',
  ownerCli: '/opt/baci-cwv/provenance/owner-cli.json',
  pnpm: '/opt/baci-cwv/provenance/pnpm.json',
  runner: '/opt/baci-cwv/provenance/runner.json',
  ubuntu: '/opt/baci-cwv/provenance/ubuntu.json',
};
const sourceProvenanceNames = {
  baseTools: 'base-tools',
  chrome: 'chrome',
  node: 'node',
  ownerCli: 'owner-cli',
  pnpm: 'pnpm',
  runner: 'runner',
  ubuntu: 'ubuntu',
};
const provenance = Object.fromEntries(
  Object.entries(provenancePaths).map(([name, path]) => {
    const receipt = sourceProvenance[sourceProvenanceNames[name]];
    return [name, { path, receipt, sha256: sha256(canonical(receipt)) }];
  })
);
export const buildReceipt = {
  archiveSha256: 'a'.repeat(64),
  configDigest: IMAGE,
  imageId: IMAGE,
  implementationCommit: '1'.repeat(40),
  platform: 'linux/amd64',
  policyCanonicalSha256: 'f'.repeat(64),
  policyFileSha256: 'e'.repeat(64),
  processMap,
  provenance,
  schemaVersion: 1,
  sourceManifestSha256: 'd'.repeat(64),
};
const projectionFiles = [
  ['bin/Runner.Listener', 'listener fixture'],
  ['bin/Runner.Worker', 'worker fixture'],
  ['entrypoint.mjs', 'entrypoint fixture'],
].map(([path, value]) => ({
  bytes: Buffer.from(value),
  path,
  sha256: sha256(value),
}));
const runtimeManifest = {
  files: [
    ['bin/Runner.Listener', '0555'],
    ['bin/Runner.PluginHost', '0555'],
    ['bin/Runner.Worker', '0555'],
    ['entrypoint.mjs', '0444'],
    ['externals/node24/bin/node', '0555'],
  ].map(([path, mode]) => ({
    mode,
    path,
    sha256: projectionFiles.find((row) => row.path === path)?.sha256 ?? DIGEST,
  })),
  imageId: IMAGE,
  receiptBinding: 'runner-runtime-closure-v1',
  schemaVersion: 1,
};

export async function stageRunnerRuntimeReceipt(directory) {
  const imageReceiptBytes = canonical(buildReceipt);
  const manifestBytes = canonical(runtimeManifest);
  const identityManifest = {
    chromeTargetPath: '/opt/google/chrome/google-chrome',
    pnpmPackage: { bin: 'bin/pnpm.cjs', name: 'pnpm', version: '11.7.0' },
    runtime: { imageId: IMAGE, schemaVersion: 1 },
    schemaVersion: 1,
  };
  const identityManifestBytes = canonical(identityManifest);
  const context = {
    archiveSha256: buildReceipt.archiveSha256,
    buildArgumentNames: Object.keys(
      policyBuildArguments(buildReceipt.sourceManifestSha256)
    ),
    buildArgumentsSha256: sha256(
      canonical(policyBuildArguments(buildReceipt.sourceManifestSha256))
    ),
    configDigest: buildReceipt.configDigest,
    imageId: buildReceipt.imageId,
    imageReceiptSha256: sha256(imageReceiptBytes),
    manifestSha256: sha256(manifestBytes),
    platform: buildReceipt.platform,
    receiptBinding: 'runner-runtime-context-v1',
    runtimeIdentitySha256: sha256(canonical(identityManifest.runtime)),
    runtimeManifestSha256: sha256(identityManifestBytes),
    schemaVersion: 1,
    sourceManifestSha256: buildReceipt.sourceManifestSha256,
  };
  const contextBytes = canonical(context);
  const output = join(directory, 'runner-runtime');
  await mkdir(output, { mode: 0o700 });
  writeRunnerRuntimeReceipt(output, {
    context,
    contextBytes,
    contextReceipt: `${sha256(contextBytes)}\n`,
    imageReceiptBytes,
    identityManifest,
    identityManifestBytes,
    identityManifestReceipt: `${sha256(identityManifestBytes)}\n`,
    manifest: runtimeManifest,
    manifestBytes,
    manifestReceipt: `${sha256(manifestBytes)}\n`,
  });
  await writeFile(
    join(directory, 'runner-runtime-image-receipt.json'),
    imageReceiptBytes,
    { mode: 0o400 }
  );
  await writeRunnerRuntimeProjection(
    join(directory, 'runner-runtime-projection'),
    {
      identityContractBytes: await readFile(
        new URL('./identity-contract.json', import.meta.url)
      ),
      runnerFiles: projectionFiles,
      runtimeManifestBytes: Buffer.from(identityManifestBytes),
    },
    { gid: process.getgid(), uid: process.getuid() }
  );
}

export async function removeRequiredRuntimeFile(directory) {
  const output = join(directory, 'runner-runtime');
  const manifestPath = join(output, 'runner-runtime-manifest.json');
  const contextPath = join(output, 'runner-runtime-context.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.files = manifest.files.filter(
    ({ path }) => path !== 'bin/Runner.Listener'
  );
  const manifestBytes = canonical(manifest);
  const context = JSON.parse(await readFile(contextPath, 'utf8'));
  context.manifestSha256 = sha256(manifestBytes);
  const contextBytes = canonical(context);
  for (const [path, bytes] of [
    [manifestPath, manifestBytes],
    [`${manifestPath}.sha256`, `${sha256(manifestBytes)}\n`],
    [contextPath, contextBytes],
    [`${contextPath}.sha256`, `${sha256(contextBytes)}\n`],
  ]) {
    await chmod(path, 0o600);
    await writeFile(path, bytes);
    await chmod(path, 0o400);
  }
}
