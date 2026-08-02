import assert from 'node:assert/strict';
import test from 'node:test';

import {
  controllerContext,
  observedAuthority,
  registrationSnapshot,
} from './controller-contract.fixture.mjs';
import { registrationLayout } from './registration-controller.mjs';
import {
  observeRegistrationIdentity,
  validateRegistrationSnapshotState,
} from './registration-controller-state.mjs';

test('accepts an observed phase-environment digest rather than a configured echo', () => {
  const layout = registrationLayout(controllerContext);
  const snapshot = registrationSnapshot('node-ready', layout);
  snapshot.environmentSha256 = 'a'.repeat(64);
  assert.doesNotThrow(() =>
    validateRegistrationSnapshotState(
      snapshot,
      'node-ready',
      controllerContext,
      layout,
      observedAuthority
    )
  );
});

test('freezes the observed process parent identity after container creation', () => {
  const layout = registrationLayout(controllerContext);
  const authority = observeRegistrationIdentity(
    registrationSnapshot('node-started', layout),
    observedAuthority.containerId
  );
  const drift = registrationSnapshot('node-ready', layout);
  drift.containers[0].processes[0].parentIdentitySha256 = 'b'.repeat(64);
  assert.throws(
    () =>
      validateRegistrationSnapshotState(
        drift,
        'node-ready',
        controllerContext,
        layout,
        authority
      ),
    /registration inventory refused/
  );
});

test('rejects a malformed observed process parent digest', () => {
  const layout = registrationLayout(controllerContext);
  const snapshot = registrationSnapshot('node-started', layout);
  snapshot.containers[0].processes[0].parentIdentitySha256 = 'not-a-digest';
  assert.throws(
    () => observeRegistrationIdentity(snapshot, observedAuthority.containerId),
    /registration inventory refused/
  );
});
