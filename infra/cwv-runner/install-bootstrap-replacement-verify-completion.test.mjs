import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyBootstrapReplacementCompletion } from './install-bootstrap-replacement-verify-completion.mjs';

const complete = {
  phase: 'complete',
  receiptSha256: '9'.repeat(64),
};
const intent = {
  schemaVersion: 1,
  sourceSha: 'b'.repeat(40),
};
const expected = { ...intent, receiptSha256: complete.receiptSha256 };

test('refuses downstream verification until the replacement receipt is exact', async () => {
  await assert.rejects(
    verifyBootstrapReplacementCompletion(
      { currentDirectory: '/state/bootstrap-bbbbbbbbbbbb' },
      {
        readState: async () => complete,
        readIntent: async () => intent,
        readReceipt: () => {
          const error = new Error('missing digest');
          error.code = 'ENOENT';
          throw error;
        },
      }
    ),
    /missing digest/
  );
  assert.deepEqual(
    await verifyBootstrapReplacementCompletion(
      { currentDirectory: '/state/bootstrap-bbbbbbbbbbbb' },
      {
        readState: async () => complete,
        readIntent: async () => intent,
        readReceipt: async () => expected,
      }
    ),
    expected
  );
});
