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

test('retires authenticated captured no-op generations before a later change', () => {
  const original = completed(captured('1', 'a', absent, file('1')), 'f');
  const firstNoop = captured('2', 'b', file('1'), file('1'));
  const secondNoop = captured('3', 'c', file('1'), file('1'));
  const changed = captured('4', 'd', file('1'), file('4'));

  assert.deepEqual(
    resolveBootstrapReplacementChain(
      [secondNoop, changed, original, firstNoop],
      changed
    ).map((state) => state.sourceSha),
    [original.sourceSha, changed.sourceSha]
  );
});

test('keeps a changed captured generation in the bound authority chain', () => {
  const original = completed(captured('1', 'a', absent, file('1')), 'f');
  const interruptedChange = captured('2', 'b', file('1'), file('2'));
  const changed = captured('3', 'c', file('1'), file('3'));

  assert.deepEqual(
    resolveBootstrapReplacementChain(
      [changed, original, interruptedChange],
      changed
    ).map((state) => state.sourceSha),
    [original.sourceSha, interruptedChange.sourceSha, changed.sourceSha]
  );
});

test('refuses an unbound authenticated captured no-op', () => {
  const original = completed(captured('1', 'a', absent, file('1')), 'f');
  const unboundNoop = captured('2', 'b', file('8'), file('8'));
  const changed = captured('3', 'c', file('1'), file('3'));

  assert.throws(
    () =>
      resolveBootstrapReplacementChain(
        [changed, unboundNoop, original],
        changed
      ),
    /replacement authority chain/
  );
});

test('refuses an unbound authenticated completed no-op', () => {
  const original = completed(captured('1', 'a', absent, file('1')), 'f');
  const unboundNoop = completed(captured('2', 'b', file('8'), file('8')), 'd');
  const changed = captured('3', 'c', file('1'), file('3'));

  assert.throws(
    () =>
      resolveBootstrapReplacementChain(
        [changed, unboundNoop, original],
        changed
      ),
    /replacement authority chain/
  );
});
