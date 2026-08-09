import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import { createRemediationFallbackStore } from './remediation-state-fallback.mjs';

it('reconciles fallback evidence under the canonical case key', () => {
  const path = join(
    mkdtempSync(join(tmpdir(), 'baci-fallback-')),
    'state.json'
  );
  const candidate = {
    caseKey: 'vercel:vercel_timeout:shared',
    fingerprint: 'shared',
    lastSeen: '2026-08-09T10:00:00.000Z',
  };
  const store = createRemediationFallbackStore(path);
  const state = { handled: {}, reservations: {} };
  store.persist(candidate, '2026-08-09T10:01:00.000Z');

  assert.deepEqual(
    store.reconcile(state, [candidate], '2026-08-09T10:02:00.000Z'),
    [candidate]
  );
  assert.equal(
    state.handled[candidate.caseKey].observation,
    candidate.lastSeen
  );
  store.clear(candidate);
});
