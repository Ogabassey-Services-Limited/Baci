import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readRegistrationRetryBlockReceipt,
  validateRegistrationCapture,
  validateRegistrationCaptureDigest,
  validateRegistrationCaptureReceipt,
} from './registration-command-retry-block.mjs';

const fail = (message) => {
  throw new TypeError(message);
};
const canonical = (bytes) => JSON.parse(bytes.toString('utf8'));
const valid = {
  campaignId: 'registration-01',
  cleanupSha256: '1'.repeat(64),
  commandSha256: '2'.repeat(64),
  disposition: 'owner-row-deletion-required',
  egressReleaseSha256: '3'.repeat(64),
  schemaVersion: 1,
};

test('rejects a post-egress receipt when its command binding is not exact', () => {
  assert.throws(
    () =>
      readRegistrationRetryBlockReceipt({
        bytes: Buffer.from(
          JSON.stringify({ ...valid, commandSha256: '4'.repeat(64) })
        ),
        campaignId: valid.campaignId,
        canonical,
        commandSha256: valid.commandSha256,
        fail,
        isObject: (value) => value !== null && typeof value === 'object',
      }),
    /post-egress recovery binding/
  );
});

test('returns an immutable receipt only when its exact authority fields bind', () => {
  const result = readRegistrationRetryBlockReceipt({
    bytes: Buffer.from(JSON.stringify(valid)),
    campaignId: valid.campaignId,
    canonical,
    commandSha256: valid.commandSha256,
    fail,
    isObject: (value) => value !== null && typeof value === 'object',
  });
  assert.deepEqual(result, valid);
  assert.equal(Object.isFrozen(result), true);
});

test('rejects a capture receipt whose digest is not bound to the campaign capture', () => {
  assert.throws(
    () =>
      validateRegistrationCaptureReceipt({
        bytes: Buffer.from(
          JSON.stringify({
            captureSha256: '4'.repeat(64),
            lockHeld: true,
            mode: 'registration',
            transactionId: valid.campaignId,
          })
        ),
        campaignId: valid.campaignId,
        canonical,
        captureSha256: '5'.repeat(64),
        fail,
        name: 'watchdog',
      }),
    /watchdog captureSha256 mismatch/
  );
});

test('rejects a capture digest that is not derived from its canonical capture', () => {
  const capture = Buffer.from('{"required":true}');
  assert.throws(
    () =>
      validateRegistrationCaptureDigest({
        bytes: Buffer.from(`${'0'.repeat(64)}\n`),
        captureBytes: capture,
        fail,
      }),
    /capture digest/
  );
});

test('reports every absent capture authority field before deriving a command', () => {
  assert.throws(
    () =>
      validateRegistrationCapture({
        bytes: Buffer.from('{}'),
        canonical: JSON.stringify,
        fail,
        parse: JSON.parse.bind(JSON),
      }),
    /capture missing required authority/
  );
});
