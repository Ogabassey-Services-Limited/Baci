import assert from 'node:assert/strict';
import test from 'node:test';

import { archiveIdentity } from './build-image.mjs';
import { archiveFixture } from './image-projection.fixture.mjs';
import {
  policyBytes,
  sealedRuntimePaths,
  sha256,
} from './image-projection-receipts.fixture.mjs';

const source = (fixture) => ({
  sha256: fixture.sourceSha,
  sourceArchive: {
    entries: [
      ...sealedRuntimePaths
        .filter(
          (path) =>
            path.startsWith('opt/baci-cwv/') &&
            !path.endsWith('command-settings-receipt.json')
        )
        .map((path) => path.slice('opt/baci-cwv/'.length)),
      'canonical-json.mjs',
      'policy.json',
      'policy.schema.mjs',
      'sealed-runner.mjs',
    ]
      .sort()
      .map((name) => ({
        blobSha256: sha256(name === 'policy.json' ? policyBytes : 'sealed'),
        mode: '100644',
        path: `infra/cwv-runner/${name}`,
      })),
  },
});

test('checks installed runtime mode against the source-manifest runtime contract', () => {
  const fixture = archiveFixture();
  assert.doesNotThrow(() => archiveIdentity(fixture.archive, source(fixture)));
  const drift = archiveFixture('runtime-source-mode-drift');
  assert.throws(
    () => archiveIdentity(drift.archive, source(drift)),
    /runtime source mode drift/
  );
});
