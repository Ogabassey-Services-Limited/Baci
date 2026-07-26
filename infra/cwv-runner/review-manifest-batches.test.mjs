import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalizeReviewManifest,
  MAX_BATCH_ENTRIES,
  parseReviewManifest,
  partitionReviewManifest,
  serializeReviewManifest,
  verifyReviewManifestBatches,
} from './review-manifest-batches.mjs';

const hash = (value) => value.repeat(64).slice(0, 64);
const record = (path, suffix = 'a', overrides = {}) => ({
  status: 'A',
  mode: '100644',
  blobSha256: hash(suffix),
  path,
  ...overrides,
});
const manifest = (records) =>
  canonicalizeReviewManifest(serializeReviewManifest(records));
const recordBytes = (path, suffix = 'a') =>
  Buffer.from(['A', '100644', hash(suffix), path, ''].join('\0'));

test('canonicalizes safe paths by raw UTF-8 bytes', () => {
  const canonical = canonicalizeReviewManifest(
    serializeReviewManifest([
      record('infra/cwv-runner/zeta.mjs', 'a'),
      record('infra/cwv-runner/a-line.mjs', 'b'),
      record('.github/scripts/alpha.mjs', 'c'),
    ])
  );

  assert.deepEqual(
    parseReviewManifest(canonical).map(({ path }) => path),
    [
      '.github/scripts/alpha.mjs',
      'infra/cwv-runner/a-line.mjs',
      'infra/cwv-runner/zeta.mjs',
    ]
  );
});

test('rejects control characters and unsafe spellings in manifest paths', () => {
  for (const path of [
    'infra/cwv-runner/a\nline.mjs',
    'infra/cwv-runner/a\rline.mjs',
    'infra/cwv-runner/a\u0001line.mjs',
    'infra/cwv-runner/back\\slash.mjs',
    'infra/cwv-runner/café.mjs',
  ])
    assert.throws(() => parseReviewManifest(recordBytes(path)));

  assert.throws(() =>
    parseReviewManifest(
      Buffer.from(
        ['A', '100644', hash('a'), 'infra/cwv-runner/nul\0path.mjs', ''].join(
          '\0'
        )
      )
    )
  );
});

test('groups the closed H0 profile in its audited domain order', () => {
  const result = partitionReviewManifest(
    manifest([
      record('.github/workflows/cwv-runner-attestation.yml', 'a'),
      record('infra/cwv-runner/entrypoint.mjs', 'b'),
      record('infra/cwv-runner/campaign-watchdog.sh', 'c'),
      record('infra/cwv-runner/exact-run-contract.mjs', 'd'),
      record('infra/cwv-runner/install.sh', 'e'),
      record('infra/cwv-runner/install-prepare.mjs', 'f'),
      record('infra/cwv-runner/owner-api-transport.mjs', '0'),
      record('infra/cwv-runner/registration-root-system.mjs', '1'),
      record('infra/cwv-runner/root-runtime-executor.mjs', '2'),
    ])
  );

  assert.equal(MAX_BATCH_ENTRIES, 60);
  assert.deepEqual(
    result.batches.map(({ domain, records }) => [
      domain,
      records.map(({ path }) => path),
    ]),
    [
      [
        'control-plane-image',
        [
          '.github/workflows/cwv-runner-attestation.yml',
          'infra/cwv-runner/entrypoint.mjs',
        ],
      ],
      ['campaign-host-measurement', ['infra/cwv-runner/campaign-watchdog.sh']],
      ['exact-run-source-policy', ['infra/cwv-runner/exact-run-contract.mjs']],
      [
        'installer',
        ['infra/cwv-runner/install-prepare.mjs', 'infra/cwv-runner/install.sh'],
      ],
      [
        'owner-transport-registration-controller',
        ['infra/cwv-runner/owner-api-transport.mjs'],
      ],
      [
        'registration-root-network-terminal',
        ['infra/cwv-runner/registration-root-system.mjs'],
      ],
      [
        'runtime-and-review-contracts',
        ['infra/cwv-runner/root-runtime-executor.mjs'],
      ],
    ]
  );
});

test('keeps source, test, and .github mirror records in their shared domain', () => {
  const result = partitionReviewManifest(
    manifest([
      record('.github/scripts/cwv-runner-authority-core.mjs', 'a'),
      record('infra/cwv-runner/cwv-runner-authority-core.test.mjs', 'b'),
      record('infra/cwv-runner/cwv-runner-authority-core.mjs', 'c'),
      record('infra/cwv-runner/review-manifest-batches.test.mjs', 'd'),
      record('infra/cwv-runner/review-manifest-batches.mjs', 'e'),
    ])
  );

  assert.deepEqual(
    result.batches.map(({ domain, records }) => [domain, records.length]),
    [
      ['control-plane-image', 3],
      ['runtime-and-review-contracts', 2],
    ]
  );
});

test('rejects unmatched and ambiguously matched paths', () => {
  assert.throws(
    () => partitionReviewManifest(manifest([record('apps/web/src/page.tsx')])),
    /does not match an H0 review domain/
  );
  assert.throws(
    () =>
      partitionReviewManifest(manifest([record('.github/campaign-owned.mjs')])),
    /matches multiple H0 review domains/
  );
});

test('enforces canonical domain batches of at most 60 records', () => {
  const records = Array.from({ length: 60 }, (_, index) =>
    record(
      `infra/cwv-runner/install-${String(59 - index).padStart(2, '0')}.mjs`,
      index.toString(16)
    )
  );
  const result = partitionReviewManifest(manifest(records));

  assert.equal(result.batches.length, 1);
  assert.equal(result.batches[0].records.length, 60);
  assert.deepEqual(
    result.batches[0].bytes,
    canonicalizeReviewManifest(result.batches[0].bytes)
  );
  assert.throws(
    () =>
      partitionReviewManifest(
        manifest([
          ...records,
          record('infra/cwv-runner/install-over-cap.mjs', 'f'),
        ])
      ),
    /exceeds 60 records/
  );
});

test('accepts reordered batches but rejects mode and blob coverage mismatches', () => {
  const canonical = manifest([
    record('infra/cwv-runner/campaign-alpha.mjs', 'a'),
    record('infra/cwv-runner/install-beta.mjs', 'b'),
  ]);
  const result = partitionReviewManifest(canonical);

  assert.doesNotThrow(() =>
    verifyReviewManifestBatches(canonical, [...result.batches].reverse())
  );

  assert.throws(
    () =>
      verifyReviewManifestBatches(canonical, [
        {
          ...result.batches[0],
          bytes: serializeReviewManifest([
            record('infra/cwv-runner/campaign-alpha.mjs', 'a', {
              mode: '100755',
            }),
          ]),
        },
        {
          ...result.batches[1],
          bytes: serializeReviewManifest([
            record('infra/cwv-runner/install-beta.mjs', 'c'),
          ]),
        },
      ]),
    /coverage mismatch/
  );
});

test('rejects malformed, duplicate, and noncanonical manifests', () => {
  assert.throws(() =>
    parseReviewManifest(
      Buffer.from(['A', '100644', hash('a'), 'path'].join('\0'))
    )
  );
  assert.throws(() =>
    parseReviewManifest(
      Buffer.concat([recordBytes('same'), recordBytes('same', 'b')])
    )
  );
  assert.throws(() =>
    partitionReviewManifest(
      Buffer.concat([
        recordBytes('infra/cwv-runner/install-z.mjs'),
        recordBytes('infra/cwv-runner/install-a.mjs', 'b'),
      ])
    )
  );
});

test('rejects invalid mode, hash, and path fields', () => {
  for (const fields of [
    ['A', '100600', hash('a'), 'safe.mjs', ''],
    ['A', '100644', 'A'.repeat(64), 'safe.mjs', ''],
    ['A', '100644', hash('a'), '../unsafe.mjs', ''],
  ])
    assert.throws(() => parseReviewManifest(Buffer.from(fields.join('\0'))));
});
