import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { expectedBuildReceipt, parseSourceManifest } from './build-image.mjs';
import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';
import { archiveFixture } from './image-projection.fixture.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';
import {
  createRunnerRuntimeReceipt,
  validateRunnerRuntimeReceipt,
  writeRunnerRuntimeReceipt,
} from './runner-runtime-manifest-producer.mjs';
import { readRunnerRuntimeReceipt } from './runner-runtime-manifest-receipt-reader.mjs';
import { sourceArchiveFixturePaths } from './source-manifest.fixture.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const policyBytes = readFileSync(new URL('policy.json', import.meta.url));
const policy = parseRunnerPolicy(JSON.parse(policyBytes));
const sourceManifest = () => ({
  authority: policy.authority,
  baseSha: '2'.repeat(40),
  entries: [
    {
      blobSha256: '4'.repeat(64),
      mode: '100644',
      path: 'docs/cwv.md',
      status: 'M',
    },
  ],
  mergeSha: '3'.repeat(40),
  policyCanonicalSha256: canonicalSha256(policy),
  policyFileSha256: hash(policyBytes),
  prNumber: 3131,
  reviewedHeadSha: '1'.repeat(40),
  schemaVersion: 1,
  sourceArchive: {
    entries: sourceArchiveFixturePaths.map((path) => ({
      blobSha256: path.endsWith('/policy.json')
        ? hash(policyBytes)
        : hash('sealed'),
      mode: '100644',
      path,
    })),
    prefix: 'infra/cwv-runner/',
  },
});
function input(context) {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), 'runner-runtime-boundary-')
  );
  const sourceManifestPath = path.join(directory, 'source-manifest.json');
  const bytes = canonicalJson(sourceManifest());
  const sourceManifestSha256 = hash(bytes);
  writeFileSync(sourceManifestPath, bytes);
  const source = parseSourceManifest(sourceManifestPath, sourceManifestSha256);
  const fixture = archiveFixture('valid', sourceManifestSha256);
  context.after(() =>
    Promise.all([
      rm(directory, { force: true, recursive: true }),
      rm(fixture.directory, { force: true, recursive: true }),
    ])
  );
  return {
    archive: fixture.archive,
    imageReceipt: expectedBuildReceipt(
      fixture.archive,
      source,
      source.manifest.mergeSha
    ),
    sourceManifestPath,
    sourceManifestSha256,
  };
}
const cli = new URL('runner-runtime-manifest-producer-cli.mjs', import.meta.url)
  .pathname;

test('CLI writes only the closed receipt quartet for the installer', async (context) => {
  const accepted = input(context);
  const output = await mkdtemp(path.join(os.tmpdir(), 'runner-runtime-cli-'));
  const receiptDirectory = path.join(output, 'receipt');
  const projection = path.join(output, 'projection');
  const imageReceiptPath = path.join(
    path.dirname(accepted.sourceManifestPath),
    'cli-image-receipt.json'
  );
  writeFileSync(imageReceiptPath, canonicalJson(accepted.imageReceipt), {
    mode: 0o400,
  });
  context.after(async () => {
    for (const directoryPath of [path.join(projection, 'bin'), projection]) {
      try {
        chmodSync(directoryPath, 0o700);
      } catch {
        // The projection may not have been created before a refused CLI run.
      }
    }
    await rm(output, { force: true, recursive: true });
  });
  const result = spawnSync(
    process.execPath,
    [
      cli,
      '--write',
      '--archive',
      accepted.archive,
      '--image-receipt',
      imageReceiptPath,
      '--source-manifest',
      accepted.sourceManifestPath,
      '--source-manifest-sha256',
      accepted.sourceManifestSha256,
      '--output-directory',
      receiptDirectory,
      '--projection-directory',
      projection,
    ],
    { encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stderr);
  const written = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(written).sort(), ['paths', 'projection']);
  assert.deepEqual(Object.keys(written.paths).sort(), [
    'context',
    'contextReceipt',
    'identityManifest',
    'identityManifestReceipt',
    'manifest',
    'manifestReceipt',
  ]);
  assert.deepEqual(Object.keys(written.projection).sort(), [
    'directory',
    'runtimeManifestSha256',
  ]);
  const nestedReceiptDirectory = path.join(output, 'nested-receipt');
  assert.notEqual(
    spawnSync(
      process.execPath,
      [
        cli,
        '--write',
        '--archive',
        accepted.archive,
        '--image-receipt',
        imageReceiptPath,
        '--source-manifest',
        accepted.sourceManifestPath,
        '--source-manifest-sha256',
        accepted.sourceManifestSha256,
        '--output-directory',
        nestedReceiptDirectory,
        '--projection-directory',
        path.join(nestedReceiptDirectory, 'projection'),
      ],
      { encoding: 'utf8' }
    ).status,
    0
  );
  assert.equal(existsSync(nestedReceiptDirectory), false);
  assert.notEqual(
    spawnSync(process.execPath, [cli, '--write'], { encoding: 'utf8' }).status,
    0
  );
});

test('reader revalidates the fixed receipt quartet before root promotion', async (context) => {
  const accepted = input(context);
  const output = await mkdtemp(
    path.join(os.tmpdir(), 'runner-runtime-reader-')
  );
  const receipt = createRunnerRuntimeReceipt(accepted);
  const imageReceiptPath = path.join(
    path.dirname(accepted.sourceManifestPath),
    'image-receipt.json'
  );
  writeFileSync(imageReceiptPath, receipt.imageReceiptBytes, { mode: 0o400 });
  const paths = writeRunnerRuntimeReceipt(output, receipt);
  context.after(() => rm(output, { force: true, recursive: true }));
  const owner = { gid: process.getgid(), uid: process.getuid() };
  const checked = readRunnerRuntimeReceipt(output, imageReceiptPath, owner);
  assert.equal(checked.context.manifestSha256, hash(receipt.manifestBytes));
  assert.equal(checked.manifest.imageId, accepted.imageReceipt.imageId);
  assert.equal(checked.paths.manifest, paths.manifest);
});

test('reader brands malformed receipt JSON with its fail-closed contract', async (context) => {
  const accepted = input(context);
  const output = await mkdtemp(
    path.join(os.tmpdir(), 'runner-runtime-malformed-')
  );
  const receipt = createRunnerRuntimeReceipt(accepted);
  const imageReceiptPath = path.join(
    path.dirname(accepted.sourceManifestPath),
    'malformed-image-receipt.json'
  );
  writeFileSync(imageReceiptPath, receipt.imageReceiptBytes, { mode: 0o400 });
  const paths = writeRunnerRuntimeReceipt(output, receipt);
  chmodSync(paths.context, 0o600);
  writeFileSync(paths.context, '{');
  chmodSync(paths.context, 0o400);
  context.after(() => rm(output, { force: true, recursive: true }));
  assert.throws(
    () =>
      readRunnerRuntimeReceipt(output, imageReceiptPath, {
        gid: process.getgid(),
        uid: process.getuid(),
      }),
    /runner runtime receipt reader refused/
  );
});

test('binds the receipt commit and refuses semantic receipt or output-directory drift', async (context) => {
  const accepted = input(context);
  assert.throws(
    () =>
      createRunnerRuntimeReceipt({
        ...accepted,
        imageReceipt: {
          ...accepted.imageReceipt,
          implementationCommit: 'a'.repeat(40),
        },
      }),
    /image receipt refused/
  );
  const receipt = createRunnerRuntimeReceipt(accepted);
  const coherent = (
    manifest = receipt.manifest,
    contextValue = receipt.context
  ) => ({
    ...receipt,
    context: contextValue,
    contextBytes: canonicalJson(contextValue),
    contextReceipt: `${hash(canonicalJson(contextValue))}\n`,
    manifest,
    manifestBytes: canonicalJson(manifest),
    manifestReceipt: `${hash(canonicalJson(manifest))}\n`,
  });
  for (const manifest of [
    { ...receipt.manifest, schemaVersion: 2 },
    { ...receipt.manifest, files: [] },
    {
      ...receipt.manifest,
      files: receipt.manifest.files.filter(
        (row) => row.path !== 'bin/Runner.Listener'
      ),
    },
    {
      ...receipt.manifest,
      files: receipt.manifest.files.map((row) =>
        row.path === 'bin/Runner.Listener' ? { ...row, mode: '0444' } : row
      ),
    },
  ])
    assert.throws(
      () => validateRunnerRuntimeReceipt(coherent(manifest)),
      /runner runtime receipt refused/
    );
  for (const contextValue of [
    { ...receipt.context, buildArgumentNames: [] },
    { ...receipt.context, buildArgumentsSha256: '0'.repeat(64) },
  ])
    assert.throws(
      () =>
        validateRunnerRuntimeReceipt(coherent(receipt.manifest, contextValue)),
      /runner runtime receipt refused/
    );
  const output = await mkdtemp(path.join(os.tmpdir(), 'runner-runtime-extra-'));
  const imageReceiptPath = path.join(
    path.dirname(accepted.sourceManifestPath),
    'extra-image-receipt.json'
  );
  writeFileSync(imageReceiptPath, receipt.imageReceiptBytes, { mode: 0o400 });
  writeRunnerRuntimeReceipt(output, receipt);
  const extra = path.join(output, 'unexpected');
  writeFileSync(extra, 'extra', { mode: 0o400 });
  context.after(() => rm(output, { force: true, recursive: true }));
  assert.throws(
    () =>
      readRunnerRuntimeReceipt(output, imageReceiptPath, {
        gid: process.getgid(),
        uid: process.getuid(),
      }),
    /runner runtime receipt reader refused/
  );
  chmodSync(extra, 0o400);
});
