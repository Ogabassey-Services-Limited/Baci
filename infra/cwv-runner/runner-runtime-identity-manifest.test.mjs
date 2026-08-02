import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import {
  deriveRunnerRuntimeIdentity,
  publishRunnerRuntimeProjection,
  runnerRuntimeImageEnvelope,
  verifyRunnerRuntimeProjection,
  writeRunnerRuntimeProjection,
} from './runner-runtime-identity-manifest.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const imageId = `sha256:${'a'.repeat(64)}`;
const file = (path, value) => ({
  bytes: Buffer.from(value),
  path,
  sha256: sha256(value),
});

function fixture() {
  const contract = {
    builderSources: {
      runtime: {
        chrome: {
          debianPackage: {
            architecture: 'amd64',
            name: 'google-chrome-stable',
            version: '150.0.7871.128-1',
          },
          debianSha256: 'd'.repeat(64),
          targetPath: '/opt/google/chrome/google-chrome',
          version: '150.0.7871.128',
        },
        node: { version: '24.18.0' },
        pnpm: {
          packageProjection: {
            bin: 'bin/pnpm.cjs',
            name: 'pnpm',
            version: '11.7.0',
          },
          version: '11.7.0',
        },
        runnerFiles: [
          'bin/Runner.Listener',
          'bin/Runner.Worker',
          'entrypoint.mjs',
        ],
        runnerVersion: '2.335.1',
      },
    },
    schemaVersion: 1,
  };
  const runtimeFiles = {
    chrome: file('opt/google/chrome/google-chrome', 'chrome'),
    node: file('opt/node/bin/node', 'node'),
    pnpm: file('opt/pnpm/bin/pnpm.cjs', 'pnpm'),
    pnpmPackage: file(
      'opt/pnpm/package.json',
      canonicalJson({
        bin: { pnpm: 'bin/pnpm.cjs' },
        name: 'pnpm',
        version: '11.7.0',
      })
    ),
  };
  const runnerFiles = [
    file('bin/Runner.Listener', 'listener'),
    file('bin/Runner.Worker', 'worker'),
    file('entrypoint.mjs', 'entrypoint'),
  ];
  const runnerManifest = {
    files: runnerFiles.map(({ path, sha256: hash }) => ({
      mode: path === 'entrypoint.mjs' ? '0444' : '0555',
      path,
      sha256: hash,
    })),
    imageId,
    receiptBinding: 'runner-runtime-closure-v1',
    schemaVersion: 1,
  };
  const imageReceipt = {
    imageId,
    platform: 'linux/amd64',
    processMap: {
      sealed: [
        { path: '/opt/node/bin/node', sha256: runtimeFiles.node.sha256 },
        { path: '/opt/pnpm/bin/pnpm.cjs', sha256: runtimeFiles.pnpm.sha256 },
      ],
    },
    provenance: {
      chrome: {
        receipt: {
          artifactSha256: contract.builderSources.runtime.chrome.debianSha256,
          version: contract.builderSources.runtime.chrome.debianPackage.version,
        },
      },
      pnpm: {
        receipt: { version: contract.builderSources.runtime.pnpm.version },
      },
    },
    schemaVersion: 1,
  };
  const imageReceiptBytes = canonicalJson(imageReceipt);
  return {
    contract,
    identityContractBytes: Buffer.from(JSON.stringify(contract)),
    imageReceipt,
    imageReceiptBytes,
    runnerFiles,
    runnerManifest,
    runtimeFiles,
  };
}

test('derives the collector-shaped runtime identity and finite image evidence', () => {
  const input = fixture();
  const result = deriveRunnerRuntimeIdentity(input);

  assert.equal(result.identityManifest.runtime.imageId, imageId);
  assert.deepEqual(result.identityManifest.runtime.runtimeRunner.files, [
    { path: 'bin/Runner.Listener', sha256: sha256('listener') },
    { path: 'bin/Runner.Worker', sha256: sha256('worker') },
    { path: 'entrypoint.mjs', sha256: sha256('entrypoint') },
  ]);
  assert.equal(
    result.runtimeIdentitySha256,
    sha256(canonicalJson(result.identityManifest.runtime))
  );
  assert.deepEqual(result.imageEvidence, {
    id: imageId,
    imageReceiptSha256: sha256(input.imageReceiptBytes),
    platform: 'linux/amd64',
    runtimeIdentitySha256: result.runtimeIdentitySha256,
    runtimeManifestSha256: sha256(result.identityManifestBytes),
    schemaVersion: 1,
  });
  assert.deepEqual(
    JSON.parse(runnerRuntimeImageEnvelope(result.imageEvidence).canonical),
    result.imageEvidence
  );
});

test('refuses unbound image bytes, executable hashes, package projection, and runner rows', () => {
  for (const mutate of [
    (value) => (value.imageReceiptBytes = `${value.imageReceiptBytes} `),
    (value) => (value.runtimeFiles.node.sha256 = '0'.repeat(64)),
    (value) => (value.runtimeFiles.pnpmPackage.bytes = Buffer.from('{}')),
    (value) => value.runnerManifest.files.pop(),
  ]) {
    const value = fixture();
    mutate(value);
    assert.throws(() => deriveRunnerRuntimeIdentity(value));
  }
});

test('refuses Chrome receipt versions that are not the frozen Debian package version', () => {
  for (const version of [
    '150.0.7871.128',
    '150.0.7871.128-2',
    '150.0.7871.128-1ubuntu1',
  ]) {
    const value = fixture();
    value.imageReceipt.provenance.chrome.receipt.version = version;
    value.imageReceiptBytes = canonicalJson(value.imageReceipt);
    assert.throws(() => deriveRunnerRuntimeIdentity(value));
  }
});

test('writes, verifies, and idempotently publishes one exact sealed projection', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'cwv-runtime-projection-'));
  context.after(async () => {
    for (const path of [join(root, 'staged/bin'), join(root, 'staged')])
      await chmod(path, 0o755).catch(() => undefined);
    await rm(root, { force: true, recursive: true });
  });
  const input = fixture();
  const identity = deriveRunnerRuntimeIdentity(input);
  const projection = {
    identityContractBytes: input.identityContractBytes,
    runtimeManifestBytes: Buffer.from(identity.identityManifestBytes),
    runnerFiles: input.runnerFiles,
  };
  const staged = join(root, 'staged');
  const installed = join(root, 'installed');
  const owner = { gid: process.getgid(), uid: process.getuid() };

  await writeRunnerRuntimeProjection(staged, projection, owner);
  await verifyRunnerRuntimeProjection(staged, projection, owner);
  await publishRunnerRuntimeProjection(staged, installed, projection, owner);
  await publishRunnerRuntimeProjection(staged, installed, projection, owner);
  assert.equal(
    await readFile(join(installed, 'runtime-manifest.json'), 'utf8'),
    identity.identityManifestBytes
  );

  await chmod(join(installed, 'runtime-manifest.json'), 0o644);
  await assert.rejects(
    verifyRunnerRuntimeProjection(installed, projection, owner)
  );
  await chmod(join(installed, 'bin'), 0o755);
  await chmod(installed, 0o755);
  await rm(installed, { force: true, recursive: true });
  await symlink(staged, installed);
  await assert.rejects(
    verifyRunnerRuntimeProjection(installed, projection, owner)
  );
});

test('refuses a staged projection containing an extra path', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'cwv-runtime-extra-'));
  context.after(async () => {
    for (const path of [join(root, 'projection/bin'), join(root, 'projection')])
      await chmod(path, 0o755).catch(() => undefined);
    await rm(root, { force: true, recursive: true });
  });
  const input = fixture();
  const identity = deriveRunnerRuntimeIdentity(input);
  const projection = {
    identityContractBytes: input.identityContractBytes,
    runtimeManifestBytes: Buffer.from(identity.identityManifestBytes),
    runnerFiles: input.runnerFiles,
  };
  const owner = { gid: process.getgid(), uid: process.getuid() };
  const projectionRoot = join(root, 'projection');
  await writeRunnerRuntimeProjection(projectionRoot, projection, owner);
  await chmod(projectionRoot, 0o755);
  await writeFile(join(projectionRoot, 'unexpected'), 'extra');
  await chmod(projectionRoot, 0o555);
  await assert.rejects(
    verifyRunnerRuntimeProjection(projectionRoot, projection, owner)
  );
});
