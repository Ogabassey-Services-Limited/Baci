import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyBaseline } from './campaign-restore-baseline.mjs';
import { validateOwnership } from './campaign-restore-network.mjs';

const transactionId = 'tx';
const captureSha256 = 'a'.repeat(64);
const inputChain = 'BACI_CWV_IN_deadbeef';
const forwardChain = 'BACI_CWV_FW_deadbeef';
const bridge = 'baci-cwv0';
const subnet = '172.31.255.0/28';
const comment = 'baci-cwv:tx';
const network = 'baci-cwv-net';
const applied = (id, args) => ({
  id,
  args,
  status: 'applied',
  readbackSha256: 'b'.repeat(64),
});
const intent = (id, args) => ({
  id,
  args,
  status: 'intent',
  readbackSha256: null,
});

const plan = {
  schemaVersion: 1,
  name: network,
  bridge,
  gateway: '172.31.255.1',
  subnet,
  labels: {
    'baci.cwv.capture': captureSha256,
    'baci.cwv.transaction': transactionId,
  },
  baselineSha256: 'c'.repeat(64),
  externalInterface: { name: 'eth0', ifindex: 2 },
  inventories: {},
};
const capture = { priorState: { network: plan } };
const ownership = (steps, networkStatus = 'applied') => ({
  schemaVersion: 2,
  transactionId,
  captureSha256,
  network: {
    status: networkStatus,
    plan,
    identity: networkStatus === 'applied' ? { id: 'network' } : null,
  },
  isolation: { steps },
  accounting: null,
});
const validate = (steps, networkStatus) =>
  validateOwnership({
    capture,
    ownership: ownership(steps, networkStatus),
    transactionId,
    captureSha256,
    network,
    bridge,
    gateway: '172.31.255.1',
    subnet,
    inputChain,
    forwardChain,
    comment,
    accountingFamily: 'inet',
    accountingTable: 'baci_cwv',
  });

const input = ['-N', inputChain];
const forward = ['-N', forwardChain];
const source = [
  '-A',
  inputChain,
  '-i',
  bridge,
  '!',
  '-s',
  subnet,
  '-j',
  'REJECT',
];

test('bounds every network-baseline command and reports a timeout', () => {
  const calls = [];
  const spawn = (file, args, options) => {
    calls.push({ args, file, options });
    return {
      error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }),
    };
  };

  assert.throws(
    () => verifyBaseline(capture, '/tmp/capture', spawn),
    /timed out/
  );
  assert.equal(calls.length, 1);
  assert.ok(Number.isSafeInteger(calls[0].options.timeout));
  assert.ok(calls[0].options.timeout > 0);
});

test('bounds snapshot output and identifies an exhausted output buffer', () => {
  const calls = [];
  const spawn = (file, args, options) => {
    calls.push({ args, file, options });
    return {
      error: Object.assign(new Error('output buffer exhausted'), {
        code: 'ENOBUFS',
      }),
    };
  };

  assert.throws(
    () => verifyBaseline(capture, '/tmp/capture', spawn),
    /output buffer exhausted/
  );
  assert.equal(calls.length, 1);
  assert.ok(Number.isSafeInteger(calls[0].options.maxBuffer));
  assert.ok(calls[0].options.maxBuffer >= 16 * 1024 * 1024);
});

test('accepts the network-intent crash boundary with no isolation steps', () => {
  assert.doesNotThrow(() => validate([], 'intent'));
});

test('accepts each first-chain progressive crash boundary', () => {
  assert.doesNotThrow(() => validate([intent('input-chain', input)]));
  assert.doesNotThrow(() => validate([applied('input-chain', input)]));
});

test('accepts each second-chain progressive crash boundary', () => {
  assert.doesNotThrow(() =>
    validate([applied('input-chain', input), intent('forward-chain', forward)])
  );
  assert.doesNotThrow(() =>
    validate([applied('input-chain', input), applied('forward-chain', forward)])
  );
});

test('accepts a partial applied isolation-rule boundary', () => {
  assert.doesNotThrow(() =>
    validate([
      applied('input-chain', input),
      applied('forward-chain', forward),
      intent('input-source', source),
    ])
  );
});

test('rejects reordered, missing-middle, extra, and drifted isolation ownership', () => {
  assert.throws(
    () => validate([applied('forward-chain', forward)]),
    /ownership receipt required/
  );
  assert.throws(
    () =>
      validate([
        applied('input-chain', input),
        applied('input-source', source),
      ]),
    /ownership receipt required/
  );
  assert.throws(
    () =>
      validate([
        applied('input-chain', input),
        applied('forward-chain', forward),
        applied('foreign', ['-A', inputChain, '-j', 'ACCEPT']),
      ]),
    /ownership receipt required/
  );
  assert.throws(
    () =>
      validate([
        applied('input-chain', input),
        applied('forward-chain', forward),
        applied('input-source', [
          '-A',
          inputChain,
          '-i',
          'eth1',
          '!',
          '-s',
          subnet,
          '-j',
          'REJECT',
        ]),
      ]),
    /ownership receipt required/
  );
});
