import assert from 'node:assert/strict';
import test from 'node:test';

import {
  controllerContext,
  observedAuthority,
  registrationExecutor,
  resourceContract,
} from './controller-contract.fixture.mjs';
import {
  absenceReceipt,
  cleanupOperationReceipt,
} from './registration-cleanup-receipt.fixture.mjs';
import {
  registrationContainerArgv,
  registrationLayout,
} from './registration-controller.mjs';
import {
  rootControllerCommands,
  runRootRuntimeController,
} from './root-runtime-executor.mjs';
import {
  registrationOperationNames,
  rootOperationExecutor,
} from './root-runtime-operations.mjs';

const registrationDependencies = () => {
  const fixture = registrationExecutor(registrationLayout(controllerContext));
  const execute = fixture.dependencies.execute;
  return {
    fixture,
    executeOperation: async (operation, payload) => {
      const result = await execute(operation, payload);
      if (operation === 'remove-registration-container')
        return {
          containerId: payload.containerId,
          removed: true,
          schemaVersion: 1,
        };
      const cleanupReceipt = cleanupOperationReceipt(operation, {});
      if (cleanupReceipt) return cleanupReceipt;
      if (operation === 'prove-registration-cleanup')
        return absenceReceipt(payload.containerId);
      return result;
    },
  };
};

test('exposes only the three sealed installer controller commands', () => {
  assert.deepEqual(rootControllerCommands, [
    'probe-isolation',
    'probe-runtime-identity',
    'register-token-stdin',
  ]);
});

test('root operation adapter freezes the complete inventory and backend request schema', async () => {
  const requests = [];
  const execute = rootOperationExecutor(controllerContext, resourceContract, {
    executeBackend: (request) => {
      requests.push(request);
      return '{}\n';
    },
  });
  assert.equal(registrationOperationNames.length, 53);
  assert.equal(
    registrationOperationNames.includes('verify-prepared-transaction'),
    true
  );
  assert.equal(registrationOperationNames.includes('guard-registration'), true);
  assert.equal(registrationOperationNames.includes('release-lock'), true);
  await execute('create-registration-container', {
    argv: registrationContainerArgv(controllerContext, resourceContract),
  });
  assert.deepEqual(JSON.parse(requests[0]), {
    context: {},
    operation: 'create-registration-container',
    schemaVersion: 1,
  });
  await execute('probe-public-tls', {
    campaignId: controllerContext.campaignId,
  });
  assert.deepEqual(JSON.parse(requests[1]), {
    context: { campaignId: controllerContext.campaignId },
    operation: 'probe-public-tls',
    schemaVersion: 1,
  });
  await execute('guard-registration', { boundary: 'before-token-parent' });
  assert.deepEqual(JSON.parse(requests[2]), {
    context: { boundary: 'before-token-parent' },
    operation: 'guard-registration',
    schemaVersion: 1,
  });
  await assert.rejects(
    execute('arbitrary-command', {}),
    /root operation refused/
  );
});

test('drives the complete registration controller through finite operations and stdin only after preflight', async () => {
  const { fixture, executeOperation } = registrationDependencies();
  let stdinReads = 0;
  const receipt = await runRootRuntimeController(
    'register-token-stdin',
    controllerContext,
    resourceContract,
    {
      executeOperation,
      readStdin: () => {
        stdinReads += 1;
        assert.equal(fixture.calls.includes('probe-public-tls'), true);
        return Buffer.from(`${'A'.repeat(29)}\n`);
      },
    }
  );
  assert.equal(stdinReads, 1);
  assert.equal(
    fixture.calls.filter((value) => value === 'read-token').length,
    0
  );
  assert.equal(receipt.imageDigest, controllerContext.imageDigest);
  assert.equal(fixture.calls.includes('remove-registration-container'), true);
});

test('routes both disposable probes through exact controller argv and rejects extra mode inputs', async () => {
  const isolation = await runRootRuntimeController(
    'probe-isolation',
    controllerContext,
    resourceContract,
    {
      executeProbe: (argv) => {
        assert.ok(argv.includes('--network=none'));
        return '{"cgroup":true,"cpuset":true,"gid":true,"readOnlyRoot":true,"resources":true,"shm":true,"uid":true}\n';
      },
    }
  );
  assert.equal(isolation.campaignId, controllerContext.campaignId);
  await assert.rejects(
    runRootRuntimeController(
      'probe-isolation',
      controllerContext,
      resourceContract,
      {
        executeProbe: () => '{}\n',
        extraArguments: ['unexpected'],
      }
    ),
    /root controller refused/
  );
  await assert.rejects(
    runRootRuntimeController(
      'unknown',
      controllerContext,
      resourceContract,
      {}
    ),
    /root controller refused/
  );
  assert.equal(observedAuthority.containerId.length, 64);
});
