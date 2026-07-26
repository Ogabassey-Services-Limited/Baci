import assert from 'node:assert/strict';
import test from 'node:test';

import {
  controllerContext,
  registrationExecutor,
  resourceContract,
} from './controller-contract.fixture.mjs';
import {
  absenceReceipt,
  cleanupOperationReceipt,
} from './registration-cleanup-receipt.fixture.mjs';
import {
  registrationLayout,
  runRegistrationController,
} from './registration-controller.mjs';

test('publishes terminal success with cleanup proof before releasing the campaign lock', async () => {
  const fixture = registrationExecutor(registrationLayout(controllerContext));
  const execute = fixture.dependencies.execute;
  fixture.dependencies.execute = async (operation, payload) => {
    const result = await execute(operation, payload);
    if (operation === 'remove-registration-container')
      return {
        containerId: payload.containerId,
        removed: true,
        schemaVersion: 1,
      };
    if (operation === 'prove-registration-cleanup')
      return absenceReceipt(payload.containerId);
    return cleanupOperationReceipt(operation, {}) ?? result;
  };
  const published = [];
  fixture.dependencies.publishTerminal = (receipt) => {
    published.push({
      disarmSeen: fixture.calls.includes('disarm-watchdog'),
      receipt,
      releaseLockSeen: fixture.calls.includes('release-lock'),
    });
  };
  await runRegistrationController(
    controllerContext,
    resourceContract,
    fixture.dependencies
  );
  assert.equal(published.length, 1);
  assert.equal(published[0].disarmSeen, true);
  assert.equal(published[0].releaseLockSeen, false);
  assert.match(published[0].receipt.cleanupSha256, /^[a-f0-9]{64}$/);
  assert.equal(fixture.calls.at(-1), 'release-lock');
  assert.ok(
    fixture.calls.indexOf('disarm-watchdog') <
      fixture.calls.indexOf('release-lock')
  );
});

test('does not publish terminal success when watchdog disarm fails', async () => {
  const fixture = registrationExecutor(registrationLayout(controllerContext), {
    failAt: 'disarm-watchdog',
  });
  const execute = fixture.dependencies.execute;
  fixture.dependencies.execute = async (operation, payload) => {
    const result = await execute(operation, payload);
    if (operation === 'remove-registration-container')
      return {
        containerId: payload.containerId,
        removed: true,
        schemaVersion: 1,
      };
    if (operation === 'prove-registration-cleanup')
      return absenceReceipt(payload.containerId);
    return cleanupOperationReceipt(operation, {}) ?? result;
  };
  let published = false;
  fixture.dependencies.publishTerminal = () => {
    published = true;
  };
  await assert.rejects(
    runRegistrationController(
      controllerContext,
      resourceContract,
      fixture.dependencies
    ),
    /registration cleanup failed/
  );
  assert.equal(published, false);
  assert.equal(fixture.calls.includes('release-lock'), false);
});
