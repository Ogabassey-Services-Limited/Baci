import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { parseRunnerPolicy } from './policy.schema.mjs';
import {
  probeRegistrationEgress,
  runRegistrationProbeCli,
} from './registration-egress-probe.mjs';

const wirePolicy = JSON.parse(
  readFileSync(new URL('policy.json', import.meta.url), 'utf8')
);
const policy = parseRunnerPolicy(wirePolicy);

test('accepts the once-decoded policy at the probe boundary', async () => {
  const calls = [];
  const receipt = await probeRegistrationEgress(policy, {
    clearTimeout: () => undefined,
    connect: (options) => calls.push(options),
    now: () => 0,
    resolver: { cancel: () => undefined, resolve4: () => ['8.8.8.8'] },
    setTimeout: () => 1,
  });
  assert.deepEqual(receipt, { ok: true });
  assert.equal(calls.length, 1);
});

test('CLI decodes policy bytes once before the mocked probe runs', async () => {
  const calls = [];
  const receipt = await runRegistrationProbeCli(
    Buffer.from(JSON.stringify(wirePolicy)),
    {
      clearTimeout: () => undefined,
      connect: (options) => calls.push(options),
      now: () => 0,
      resolver: { cancel: () => undefined, resolve4: () => ['8.8.8.8'] },
      setTimeout: () => 1,
    }
  );
  assert.deepEqual(receipt, { ok: true });
  assert.equal(calls[0].servername, 'github.com');
});

test('probe uses only the policy destination and emits a boolean receipt', async () => {
  const calls = [];
  let cleared = 0;
  let resolverCancelled = 0;
  const times = [1_000, 3_000];
  const receipt = await probeRegistrationEgress(policy, {
    clearTimeout: () => {
      cleared += 1;
    },
    resolver: {
      cancel: () => {
        resolverCancelled += 1;
      },
      resolve4: (host) => {
        calls.push(['resolve4', host]);
        return ['8.8.8.8', '1.1.1.1'];
      },
    },
    connect: (options) => {
      calls.push(['connect', options]);
    },
    now: () => times.shift(),
    setTimeout: () => 1,
  });
  assert.deepEqual(receipt, { ok: true });
  assert.equal(calls[0][1], 'github.com');
  assert.deepEqual(calls[1][1], {
    host: '1.1.1.1',
    port: 443,
    rejectUnauthorized: true,
    servername: 'github.com',
    timeout: 8_000,
  });
  assert.equal(calls.length, 2);
  assert.equal(cleared, 1);
  assert.equal(resolverCancelled, 1);
});

test('probe source has no default lookup or second-address fallback', () => {
  const source = readFileSync(
    new URL('registration-egress-probe.mjs', import.meta.url),
    'utf8'
  );
  assert.match(source, /Resolver/);
  assert.match(source, /resolve4\(host\)/);
  assert.doesNotMatch(
    source,
    /\blookup\s*\(|addresses\.slice|for \(const address/
  );
});

test('one policy deadline bounds DNS and prevents a late TLS connection', async () => {
  let connectCalled = false;
  let timeoutDelay;
  await assert.rejects(
    probeRegistrationEgress(policy, {
      clearTimeout: () => undefined,
      connect: () => {
        connectCalled = true;
      },
      resolver: {
        cancel: () => undefined,
        resolve4: async () => {
          await new Promise((resolve) => queueMicrotask(resolve));
          return ['8.8.8.8'];
        },
      },
      now: () => 0,
      setTimeout: (callback, delay) => {
        timeoutDelay = delay;
        queueMicrotask(callback);
        return 1;
      },
    }),
    /registration probe timed out/
  );
  assert.equal(timeoutDelay, 10_000);
  assert.equal(connectCalled, false);
});

test('the shared deadline cancels the exact pending A-record resolver', async () => {
  let resolverActive = true;
  let cancelCalls = 0;
  const resolver = {
    cancel: () => {
      cancelCalls += 1;
      resolverActive = false;
    },
    resolve4: () => new Promise(() => undefined),
  };
  await assert.rejects(
    probeRegistrationEgress(policy, {
      clearTimeout: () => undefined,
      resolver,
      setTimeout: (callback) => {
        queueMicrotask(callback);
        return 1;
      },
    }),
    /registration probe timed out/
  );
  assert.equal(cancelCalls, 1);
  assert.equal(resolverActive, false);
});

test('the whole deadline aborts an active TLS connection', async () => {
  let aborted = false;
  await assert.rejects(
    probeRegistrationEgress(policy, {
      clearTimeout: (handle) => clearImmediate(handle),
      connect: (_options, signal) =>
        new Promise((_, reject) =>
          signal.addEventListener('abort', () => {
            aborted = true;
            reject(new Error('aborted'));
          })
        ),
      now: () => 0,
      resolver: {
        cancel: () => undefined,
        resolve4: () => ['8.8.8.8'],
      },
      setTimeout: (callback) => setImmediate(callback),
    }),
    /registration probe timed out/
  );
  assert.equal(aborted, true);
});

test('probe rejects non-contract destinations', async () => {
  const changed = structuredClone(policy);
  changed.dedicatedRuntime.registrationProbeHost = 'example.com';
  await assert.rejects(
    probeRegistrationEgress(changed, {
      connect: () => undefined,
    }),
    /invalid runner policy/
  );
});

test('probe validates the complete DNS answer set before any TLS contact', async () => {
  let connected = false;
  await assert.rejects(
    probeRegistrationEgress(policy, {
      clearTimeout: () => undefined,
      connect: () => {
        connected = true;
      },
      resolver: {
        cancel: () => undefined,
        resolve4: () => ['8.8.8.8', '127.0.0.1'],
      },
      setTimeout: () => 1,
    }),
    /DNS refused/
  );
  assert.equal(connected, false);
});
