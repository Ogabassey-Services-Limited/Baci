import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { expectedBuildReceipt, parseSourceManifest } from './build-image.mjs';
import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';
import { archiveFixture } from './image-projection.fixture.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';
import {
  createRunnerRuntimeBundle,
  writeRunnerRuntimeBundle,
} from './runner-runtime-manifest-producer.mjs';
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
    entries: sourceArchiveFixturePaths.map((entryPath) => ({
      blobSha256: entryPath.endsWith('/policy.json')
        ? hash(policyBytes)
        : hash('sealed'),
      mode: '100644',
      path: entryPath,
    })),
    prefix: 'infra/cwv-runner/',
  },
});

function acceptedInput(context) {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), 'runner-runtime-transaction-input-')
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

test('rolls back receipt outputs when projection fails so the exact bundle can retry', async (context) => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), 'runner-runtime-transaction-')
  );
  const receiptDirectory = path.join(root, 'receipt');
  const projectionParent = path.join(root, 'projection-parent');
  const projectionDirectory = path.join(projectionParent, 'projection');
  const bundle = createRunnerRuntimeBundle(acceptedInput(context));
  context.after(async () => {
    for (const directory of [
      'bin',
      'externals/node24/bin',
      'externals/node24',
      'externals',
      '',
    ])
      await chmod(path.join(projectionDirectory, directory), 0o700).catch(
        () => undefined
      );
    await rm(root, { force: true, recursive: true });
  });
  writeFileSync(projectionParent, 'not a directory');

  await assert.rejects(
    writeRunnerRuntimeBundle(receiptDirectory, projectionDirectory, bundle)
  );
  assert.equal(existsSync(receiptDirectory), false);

  rmSync(projectionParent);
  await mkdir(projectionParent);
  const written = await writeRunnerRuntimeBundle(
    receiptDirectory,
    projectionDirectory,
    bundle
  );
  assert.equal(written.projection.directory, projectionDirectory);
});
