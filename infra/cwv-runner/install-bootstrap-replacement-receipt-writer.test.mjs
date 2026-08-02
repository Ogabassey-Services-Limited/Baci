import assert from 'node:assert/strict';
import test from 'node:test';
import fixture from './install-bootstrap-replacement-receipt.test-fixture.mjs';
import { persistBootstrapReplacementReceipt } from './install-bootstrap-replacement-receipt-writer.mjs';

test('resumes an interrupted receipt and refuses value drift', async (context) => {
  const directory = await fixture.temporary(context, 'baci-bootstrap-receipt-');
  await assert.rejects(
    persistBootstrapReplacementReceipt(directory, fixture.receipt, {
      afterValue: () => {
        throw new Error('crash after replacement receipt');
      },
    }),
    /crash after replacement receipt/
  );
  await persistBootstrapReplacementReceipt(directory, fixture.receipt);
  await persistBootstrapReplacementReceipt(directory, fixture.receipt);
  await assert.rejects(
    persistBootstrapReplacementReceipt(directory, {
      ...fixture.receipt,
      receiptSha256: fixture.digest('d'),
    }),
    /replacement receipt drift/
  );
});
