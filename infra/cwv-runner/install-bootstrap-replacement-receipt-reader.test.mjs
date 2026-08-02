import assert from 'node:assert/strict';
import test from 'node:test';
import fixture from './install-bootstrap-replacement-receipt.test-fixture.mjs';
import { readBootstrapReplacementReceipt } from './install-bootstrap-replacement-receipt-reader.mjs';
import { persistBootstrapReplacementReceipt } from './install-bootstrap-replacement-receipt-writer.mjs';

test('reads a valid receipt and requires its receipt digest field', async (context) => {
  const directory = await fixture.temporary(
    context,
    'baci-bootstrap-receipt-reader-'
  );
  await persistBootstrapReplacementReceipt(directory, fixture.receipt);
  assert.deepEqual(
    await readBootstrapReplacementReceipt(directory),
    fixture.receipt
  );

  const invalidDirectory = await fixture.temporary(
    context,
    'baci-bootstrap-invalid-receipt-'
  );
  await persistBootstrapReplacementReceipt(invalidDirectory, fixture.intent);
  await assert.rejects(
    readBootstrapReplacementReceipt(invalidDirectory),
    /invalid bootstrap replacement-receipt/
  );
});
