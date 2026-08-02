import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  controllerContext,
  observedAuthority,
  resourceContract,
} from './controller-contract.fixture.mjs';
import { registrationLayout } from './registration-controller.mjs';
import { rootOperationExecutor } from './root-registration-operation-adapter.mjs';

test('creates one root-owned backend session for every lifecycle operation', async () => {
  let created = 0;
  const requests = [];
  const execute = rootOperationExecutor(controllerContext, resourceContract, {
    createBackend: () => {
      created += 1;
      return {
        close: () => undefined,
        execute: (request) => {
          requests.push(JSON.parse(request).operation);
          return '{}\n';
        },
      };
    },
  });
  await execute('create-token-layout', {
    tokenParent: registrationLayout(controllerContext).tokenParent,
  });
  await execute('delete-token-layout', {});
  assert.equal(created, 1);
  assert.deepEqual(requests, ['create-token-layout', 'delete-token-layout']);
});

test('uses an explicit prepared-transaction authority operation and live parent identity', async () => {
  const requests = [];
  const execute = rootOperationExecutor(controllerContext, resourceContract, {
    executeBackend: (request) => {
      requests.push(JSON.parse(request));
      return '{}\n';
    },
  });
  await execute('verify-prepared-transaction', {
    campaignId: controllerContext.campaignId,
  });
  await execute('guard-registration', {
    authority: observedAuthority,
    boundary: 'registration-ready',
  });
  assert.deepEqual(requests, [
    {
      context: { campaignId: controllerContext.campaignId },
      operation: 'verify-prepared-transaction',
      schemaVersion: 1,
    },
    {
      context: { authority: observedAuthority, boundary: 'registration-ready' },
      operation: 'guard-registration',
      schemaVersion: 1,
    },
  ]);
});

test('transports the registration token only as a mutable binary backend secret', async () => {
  const requests = [];
  let backendSecret;
  const execute = rootOperationExecutor(controllerContext, resourceContract, {
    executeBackend: (request, options) => {
      requests.push(request);
      backendSecret = options?.secret;
      return '{}\n';
    },
  });
  const token = Buffer.from(`${'A'.repeat(29)}\n`);
  await execute('write-registration-token', {
    bytes: token,
    token: registrationLayout(controllerContext).token,
  });
  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(requests[0]), {
    context: {},
    operation: 'write-registration-token',
    schemaVersion: 1,
  });
  assert.equal(requests[0].includes('A'.repeat(29)), false);
  assert.equal(backendSecret, token);
  assert.equal(
    token.every((byte) => byte === 0),
    true
  );
});

test('contains no string token serialization in the RPC contract modules', async () => {
  for (const relativePath of [
    './root-registration-operation-adapter.mjs',
    './registration-root-contract.mjs',
    './registration-root-operations.mjs',
  ]) {
    const source = await readFile(
      new URL(relativePath, import.meta.url),
      'utf8'
    );
    assert.equal(source.includes('tokenBase64'), false, relativePath);
    assert.equal(source.includes("toString('base64')"), false, relativePath);
  }
});
