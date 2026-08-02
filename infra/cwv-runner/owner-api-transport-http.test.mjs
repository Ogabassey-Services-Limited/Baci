import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bindNetworkPolicy,
  jsonResponse,
  sealTransportPolicy,
  validateNetworkPlanPolicy,
  validateRequestDeadlines,
} from './owner-api-transport-http.mjs';

const policy = Object.freeze({
  allowedQueryKeys: Object.freeze(['rscd', 'sig', 'sp']),
  hostPattern: '^productionresultssa[0-9]+\\.blob\\.core\\.windows\\.net$',
  maxBytes: 1_048_576,
  pathPrefix: '/actions-results/',
  timeoutsMs: Object.freeze({
    bodyInactivity: 10_000,
    connect: 10_000,
    headers: 10_000,
    overall: 30_000,
  }),
});
const policyFileSha256 = 'a'.repeat(64);

test('rejects a sealed network policy without an independent expected digest', () => {
  const sealed = sealTransportPolicy(policy, policyFileSha256);

  const validateWithoutReceipt = () => validateNetworkPlanPolicy(sealed);

  assert.throws(validateWithoutReceipt, /transport policy/);
});

test('normalizes empty documented successful response bodies without relaxing JSON parsing', () => {
  for (const status of [201, 202, 204])
    assert.equal(
      jsonResponse({ body: Buffer.alloc(0), status }).body,
      undefined
    );
  assert.deepEqual(
    jsonResponse({ body: Buffer.from('{"accepted":true}'), status: 201 }).body,
    { accepted: true }
  );
  assert.throws(
    () => jsonResponse({ body: Buffer.alloc(0), status: 200 }),
    /invalid JSON response/
  );
});

test('seals exact distinct transport deadlines and rejects semantic drift', () => {
  const sealed = sealTransportPolicy(policy, policyFileSha256);
  assert.deepEqual(sealed.policy.timeoutsMs, {
    bodyInactivity: 10_000,
    connect: 10_000,
    headers: 10_000,
    overall: 30_000,
  });
  assert.equal(validateNetworkPlanPolicy(sealed, policyFileSha256), true);
  const plan = bindNetworkPolicy(
    { address: '8.8.8.8' },
    {
      deadlineMonotonicMs: 25_000,
      digests: { policy: policyFileSha256 },
    },
    1_000,
    sealed
  );
  assert.deepEqual(validateRequestDeadlines(plan, 1_000), {
    bodyInactivityMs: 10_000,
    connectMs: 10_000,
    headersMs: 10_000,
    overallMs: 24_000,
  });
  assert.equal(plan.maxBytes, policy.maxBytes);
  assert.throws(
    () =>
      validateNetworkPlanPolicy(
        {
          ...sealed,
          policy: {
            ...sealed.policy,
            timeoutsMs: { ...sealed.policy.timeoutsMs, connect: 3_001 },
          },
        },
        policyFileSha256
      ),
    /transport policy/
  );
  assert.throws(
    () =>
      sealTransportPolicy({ ...policy, timeoutMs: 10_000 }, policyFileSha256),
    /transport policy/
  );
  assert.throws(
    () =>
      validateRequestDeadlines(
        { ...plan, connectDeadlineMonotonicMs: 1_001 },
        1_000
      ),
    /transport policy/
  );
});
