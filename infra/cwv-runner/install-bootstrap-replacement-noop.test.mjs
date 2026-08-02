import assert from 'node:assert/strict';
import test from 'node:test';

import { isBootstrapReplacementNoop } from './install-bootstrap-replacement-noop.mjs';

const file = {
  sha256: 'a'.repeat(64),
  mode: '0600',
  owner: 'root:root',
};
const capture = {
  phase: 'captured',
  sourceSha: 'b'.repeat(40),
  sourceManifestSha256: 'c'.repeat(64),
  policyFileSha256: 'd'.repeat(64),
  captureSha256: 'e'.repeat(64),
};

test('recognizes only captured nonempty identical managed projections', () => {
  assert.equal(
    isBootstrapReplacementNoop({
      ...capture,
      prior: { '/sealed': file },
      files: { '/sealed': { owner: 'root:root', ...file } },
    }),
    true
  );
  assert.equal(
    isBootstrapReplacementNoop({
      ...capture,
      prior: { '/sealed': file },
      files: { '/sealed': { ...file, mode: '0644' } },
    }),
    false
  );
  assert.equal(
    isBootstrapReplacementNoop({ ...capture, prior: {}, files: {} }),
    false
  );
  assert.equal(
    isBootstrapReplacementNoop({
      ...capture,
      sourceSha: 'invalid',
      prior: { '/sealed': file },
      files: { '/sealed': file },
    }),
    false
  );
});
