import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBootstrapReplacementChain } from './install-bootstrap-replacement-chain.mjs';

const path = '/srv/baci-cwv/sealed/bootstrap.sha256';
const policyFileSha256 = 'e'.repeat(64);
const absent = { absent: true };
const file = (digit) => ({
  mode: '0600',
  owner: 'root:root',
  sha256: digit.repeat(64),
});
const captured = (source, capture, prior, files) => ({
  captureSha256: capture.repeat(64),
  files: { [path]: files },
  phase: 'captured',
  policyFileSha256,
  prior: { [path]: prior },
  sourceManifestSha256: source.repeat(64),
  sourceSha: source.repeat(40),
});
const completed = (state, receipt) => ({
  ...state,
  phase: 'complete',
  receipt: {
    files: state.files,
    policyFileSha256,
    sourceManifestSha256: state.sourceManifestSha256,
    sourceSha: state.sourceSha,
  },
  receiptSha256: receipt.repeat(64),
});

test('retires superseded completed no-op generations before a later change', () => {
  const original = completed(captured('1', 'a', absent, file('1')), 'f');
  const firstNoop = completed(captured('2', 'b', file('1'), file('1')), 'd');
  const secondNoop = completed(captured('3', 'c', file('1'), file('1')), 'e');
  const changed = captured('4', 'f', file('1'), file('4'));

  assert.deepEqual(
    resolveBootstrapReplacementChain(
      [secondNoop, changed, original, firstNoop],
      changed
    ).map((state) => state.sourceSha),
    [original.sourceSha, changed.sourceSha]
  );
});
