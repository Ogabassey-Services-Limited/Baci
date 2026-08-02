import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { expectedBuildReceipt, parseSourceManifest } from './build-image.mjs';
import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';
import { archiveFixture } from './image-projection.fixture.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';
import {
  createRunnerRuntimeReceipt,
  writeRunnerRuntimeReceipt,
} from './runner-runtime-manifest-producer.mjs';
import * as receiptContract from './runner-runtime-receipt-contract.mjs';
import { sourceArchiveFixturePaths } from './source-manifest.fixture.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
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
  policyFileSha256: sha256(policyBytes),
  prNumber: 3131,
  reviewedHeadSha: '1'.repeat(40),
  schemaVersion: 1,
  sourceArchive: {
    entries: sourceArchiveFixturePaths.map((path) => ({
      blobSha256: path.endsWith('/policy.json')
        ? sha256(policyBytes)
        : sha256('sealed'),
      mode: '100644',
      path,
    })),
    prefix: 'infra/cwv-runner/',
  },
});

function acceptedFixture(context, variant = 'valid') {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), 'runner-runtime-source-')
  );
  const sourceManifestPath = path.join(directory, 'source-manifest.json');
  const sourceManifestBytes = canonicalJson(sourceManifest());
  const sourceManifestSha256 = sha256(sourceManifestBytes);
  writeFileSync(sourceManifestPath, sourceManifestBytes);
  const source = parseSourceManifest(sourceManifestPath, sourceManifestSha256);
  const fixture = archiveFixture(variant, sourceManifestSha256);
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

test('emits a canonical full runner closure bound to the accepted image receipt', (context) => {
  const input = acceptedFixture(context);
  const receipt = createRunnerRuntimeReceipt(input);

  assert.deepEqual(Object.keys(receipt.manifest).sort(), [
    'files',
    'imageId',
    'receiptBinding',
    'schemaVersion',
  ]);
  assert.equal(receipt.manifest.imageId, input.imageReceipt.imageId);
  assert.equal(receipt.manifest.receiptBinding, 'runner-runtime-closure-v1');
  assert.equal(receipt.manifest.schemaVersion, 1);
  assert.deepEqual(
    receipt.manifest.files.map((entry) => entry.path),
    [...receipt.manifest.files.map((entry) => entry.path)].sort()
  );
  assert.deepEqual(
    receipt.manifest.files
      .filter((entry) => entry.mode === '0555')
      .map((entry) => entry.path),
    [
      'bin/Runner.Listener',
      'bin/Runner.PluginHost',
      'bin/Runner.Worker',
      'externals/node24/bin/node',
    ]
  );
  assert.ok(
    receipt.manifest.files.some((entry) => entry.path === 'entrypoint.mjs')
  );
  assert.ok(
    receipt.manifest.files.every((entry) => !entry.path.startsWith('_diag'))
  );
  assert.equal(receipt.manifestReceipt, `${sha256(receipt.manifestBytes)}\n`);
  assert.equal(receipt.context.buildArgumentNames.length, 31);
  assert.equal(receipt.context.configDigest, input.imageReceipt.configDigest);
  assert.equal(receipt.context.archiveSha256, input.imageReceipt.archiveSha256);
  assert.equal(
    receipt.context.imageReceiptSha256,
    sha256(receipt.imageReceiptBytes)
  );
});

test('emits a sorted runner closure from a realistic layer above the outer cap', (context) => {
  const receipt = createRunnerRuntimeReceipt(
    acceptedFixture(context, 'many-layer-members')
  );
  const paths = receipt.manifest.files.map((entry) => entry.path);
  assert.deepEqual(paths, [...paths].sort());
});

test('orders mixed-case runner paths by canonical UTF-8 bytes', () => {
  assert.equal(typeof receiptContract.compareRunnerRuntimeFileRows, 'function');
  assert.deepEqual(
    [{ path: 'bin/runner.Worker' }, { path: 'bin/Runner.Worker' }].sort(
      receiptContract.compareRunnerRuntimeFileRows
    ),
    [{ path: 'bin/Runner.Worker' }, { path: 'bin/runner.Worker' }]
  );
});

test('writes detached manifest and context receipts without accepting image-receipt drift', async (context) => {
  const input = acceptedFixture(context);
  const output = await mkdtemp(
    path.join(os.tmpdir(), 'runner-runtime-receipt-')
  );
  context.after(() => rm(output, { force: true, recursive: true }));
  const receipt = createRunnerRuntimeReceipt(input);
  const paths = await writeRunnerRuntimeReceipt(output, receipt);

  assert.equal(await readFile(paths.manifest, 'utf8'), receipt.manifestBytes);
  assert.equal(
    await readFile(paths.manifestReceipt, 'utf8'),
    receipt.manifestReceipt
  );
  assert.equal((await stat(paths.manifest)).mode & 0o777, 0o400);
  assert.equal((await stat(paths.manifestReceipt)).mode & 0o777, 0o400);
  assert.throws(
    () =>
      createRunnerRuntimeReceipt({
        ...input,
        imageReceipt: {
          ...input.imageReceipt,
          imageId: `sha256:${'0'.repeat(64)}`,
        },
      }),
    /image receipt refused/
  );
  const driftedContext = {
    ...receipt.context,
    imageId: `sha256:${'0'.repeat(64)}`,
  };
  assert.throws(
    () =>
      writeRunnerRuntimeReceipt(output, {
        ...receipt,
        context: driftedContext,
        contextBytes: canonicalJson(driftedContext),
        contextReceipt: `${sha256(canonicalJson(driftedContext))}\n`,
      }),
    /runner runtime receipt refused/
  );
});

test('requires a parsed source manifest, one held archive snapshot, and no generated runner state', (context) => {
  const input = acceptedFixture(context);
  assert.throws(
    () =>
      createRunnerRuntimeReceipt({
        archive: input.archive,
        imageReceipt: input.imageReceipt,
        source: { sha256: input.sourceManifestSha256 },
      }),
    /runner runtime input refused/
  );
  const link = path.join(path.dirname(input.archive), 'archive-link.tar');
  symlinkSync(input.archive, link);
  assert.throws(
    () => createRunnerRuntimeReceipt({ ...input, archive: link }),
    /runner archive snapshot refused/
  );
  for (const generatedPath of [
    '.credentials',
    '.credentials_rsaparams',
    '.runner',
  ]) {
    const generated = acceptedFixture(
      context,
      `runner-generated:${generatedPath}`
    );
    assert.throws(
      () => createRunnerRuntimeReceipt(generated),
      /runner runtime generated state refused/
    );
  }
});

test('preserves raw runner source-member modes in the sealed scratch image', () => {
  const dockerfile = readFileSync(
    new URL('Dockerfile', import.meta.url),
    'utf8'
  );

  assert.match(
    dockerfile,
    /cp \/opt\/baci-cwv\/entrypoint\.mjs \/opt\/runner\/entrypoint\.mjs/
  );
  assert.match(dockerfile, /chmod 0444 \/opt\/runner\/entrypoint\.mjs/);
  assert.doesNotMatch(dockerfile, /find \/opt\/runner -type f -exec chmod/);
  // biome-ignore format: source-member modes must not be rewritten after extraction.
  assert.doesNotMatch(dockerfile, /chmod 0555 \/opt\/runner\/(?:bin|externals)\//);
  for (const stalePath of [
    'bin/installdependencies.sh',
    'run-helper.cmd.template',
    'run-helper.sh',
    'svc.sh',
  ])
    assert.match(
      dockerfile,
      new RegExp(`/opt/runner/${stalePath.replaceAll('/', '\\/')}`)
    );
  for (const generatedPath of [
    '.credentials',
    '.credentials_rsaparams',
    '.runner',
  ])
    assert.match(
      dockerfile,
      new RegExp(`/opt/runner/${generatedPath.replace('.', '\\.')}`)
    );
});
