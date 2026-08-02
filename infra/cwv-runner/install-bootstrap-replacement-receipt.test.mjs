import assert from 'node:assert/strict';
import test from 'node:test';

import {
  persistBootstrapReplacementIntent,
  persistBootstrapReplacementReceipt,
  readBootstrapReplacementIntent,
  readBootstrapReplacementReceipt,
} from './install-bootstrap-replacement-receipt.mjs';

test('aggregates the four replacement receipt operations', () => {
  assert.equal(typeof persistBootstrapReplacementIntent, 'function');
  assert.equal(typeof persistBootstrapReplacementReceipt, 'function');
  assert.equal(typeof readBootstrapReplacementIntent, 'function');
  assert.equal(typeof readBootstrapReplacementReceipt, 'function');
});
