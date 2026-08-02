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

test('persists the pre-seal retry block before releasing the restored campaign lock', async () => {
  const fixture = registrationExecutor(registrationLayout(controllerContext), {
    failAt: 'seal-runner',
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

  await assert.rejects(
    runRegistrationController(
      controllerContext,
      resourceContract,
      fixture.dependencies
    ),
    /registration transaction failed/
  );
  assert.ok(
    fixture.calls.indexOf('prove-registration-cleanup') <
      fixture.calls.indexOf('mark-registration-ambiguous')
  );
  assert.ok(
    fixture.calls.indexOf('mark-registration-ambiguous') <
      fixture.calls.indexOf('release-lock')
  );
  const tokenReads = fixture.calls.filter(
    (value) => value === 'read-token'
  ).length;
  await assert.rejects(
    runRegistrationController(
      controllerContext,
      resourceContract,
      fixture.dependencies
    ),
    /registration transaction failed/
  );
  assert.equal(
    fixture.calls.filter((value) => value === 'read-token').length,
    tokenReads
  );
});
