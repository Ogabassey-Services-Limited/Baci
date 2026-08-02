import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { resolveBootstrapGenerationFileSpecs } from './install-bootstrap-generation-specs.mjs';
import {
  bootstrapFileSpecs,
  buildBootstrapInput,
} from './install-bootstrap-plan.mjs';

const sourceSha = 'a'.repeat(40);
const helper = 'install-bootstrap-rename-exchange.pl';
const helperDestination = `/srv/baci-cwv/sealed/${helper}`;

function filesFor(specs) {
  return Object.fromEntries(
    specs.map((spec) => [
      spec.destination,
      { sha256: 'b'.repeat(64), mode: spec.mode, owner: spec.owner },
    ])
  );
}

function manifestPathsFor(specs) {
  return specs.flatMap((spec) => (spec.source ? [spec.source] : []));
}

test('replays the exact predecessor and current generation path sets', () => {
  const currentSpecs = bootstrapFileSpecs(sourceSha);
  const predecessorSpecs = currentSpecs.filter(
    (spec) => spec.destination !== helperDestination
  );

  const predecessor = resolveBootstrapGenerationFileSpecs({
    sourceSha,
    manifestRelativePaths: manifestPathsFor(predecessorSpecs),
    files: filesFor(predecessorSpecs),
  });
  const current = resolveBootstrapGenerationFileSpecs({
    sourceSha,
    manifestRelativePaths: manifestPathsFor(currentSpecs),
    files: filesFor(currentSpecs),
  });

  assert.equal(
    predecessor.some((spec) => spec.source === helper),
    false
  );
  assert.equal(
    current.some((spec) => spec.source === helper),
    true
  );
  assert.deepEqual(
    predecessor.map((spec) => spec.destination).sort(),
    Object.keys(filesFor(predecessorSpecs)).sort()
  );
  assert.deepEqual(
    current.map((spec) => spec.destination).sort(),
    Object.keys(filesFor(currentSpecs)).sort()
  );
});

test('refuses a captured source-backed path absent from its sealed manifest', () => {
  const currentSpecs = bootstrapFileSpecs(sourceSha);

  assert.throws(
    () =>
      resolveBootstrapGenerationFileSpecs({
        sourceSha,
        manifestRelativePaths: manifestPathsFor(currentSpecs).filter(
          (path) => path !== helper
        ),
        files: filesFor(currentSpecs),
      }),
    /bootstrap generation source is absent from manifest/
  );
});

test('refuses a captured destination unknown to the bootstrap projection', () => {
  assert.throws(
    () =>
      resolveBootstrapGenerationFileSpecs({
        sourceSha,
        manifestRelativePaths: [],
        files: {
          '/unknown': {
            sha256: 'b'.repeat(64),
            mode: '0600',
            owner: 'root:root',
          },
        },
      }),
    /unknown bootstrap generation destination/
  );
});

test('does not read current-only sources while rebuilding a predecessor', async (context) => {
  const sourceRoot = await mkdtemp(join(tmpdir(), 'baci-cwv-predecessor-'));
  context.after(() => rm(sourceRoot, { recursive: true, force: true }));
  await writeFile(join(sourceRoot, 'policy.json'), '{}\n');
  const destination = '/srv/baci-cwv/sealed/policy.json';
  const files = {
    [destination]: {
      sha256: 'b'.repeat(64),
      mode: '0400',
      owner: 'root:root',
    },
  };
  const fileSpecs = resolveBootstrapGenerationFileSpecs({
    sourceSha,
    manifestRelativePaths: ['policy.json'],
    files,
  });

  const input = await buildBootstrapInput({
    sourceRoot,
    sourceSha,
    sourceManifestSha256: 'c'.repeat(64),
    policyFileSha256: 'd'.repeat(64),
    bootstrapFileSha256: 'e'.repeat(64),
    transactionId: `bootstrap-${sourceSha.slice(0, 12)}`,
    fileSpecs,
  });

  assert.deepEqual(Object.keys(input.files), [destination]);
  assert.equal(
    fileSpecs.some((spec) => spec.source === helper),
    false
  );
});
