import assert from 'node:assert/strict';
import test from 'node:test';

import { assertOwnershipReceipt } from './campaign-ownership.mjs';

const captureSha256 = 'a'.repeat(64);
const receiptWithStep = (id) => ({
  schemaVersion: 2,
  transactionId: 'tx',
  captureSha256,
  network: { status: 'intent', plan: {}, identity: null },
  isolation: {
    steps: [
      {
        id,
        args: ['-A'],
        status: 'applied',
        readbackSha256: 'b'.repeat(64),
      },
    ],
  },
  accounting: null,
});

test('ownership receipts accept CIDR-derived deny IDs but reject arbitrary IDs', () => {
  for (const id of ['deny-input:10.0.0.0/8', 'deny-forward:172.16.0.0/12'])
    assert.doesNotThrow(() =>
      assertOwnershipReceipt(receiptWithStep(id), 'tx', captureSha256)
    );

  for (const id of [
    'deny-input:not-a-cidr',
    'deny-input:10.0.0.0/33',
    'deny-output:10.0.0.0/8',
  ])
    assert.throws(
      () => assertOwnershipReceipt(receiptWithStep(id), 'tx', captureSha256),
      /ownership receipt required/
    );
});
