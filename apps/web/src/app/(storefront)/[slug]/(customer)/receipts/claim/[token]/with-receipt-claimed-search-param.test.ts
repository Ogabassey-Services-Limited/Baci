import { describe, expect, it } from 'vitest';
import { withReceiptClaimedSearchParam } from './with-receipt-claimed-search-param';

describe('withReceiptClaimedSearchParam', () => {
  it('adds the post-claim marker to receipt redirect paths', () => {
    expect(withReceiptClaimedSearchParam('/receipts')).toBe(
      '/receipts?receiptClaimed=1'
    );
    expect(withReceiptClaimedSearchParam('/receipts?tab=devices')).toBe(
      '/receipts?tab=devices&receiptClaimed=1'
    );
    expect(withReceiptClaimedSearchParam('/receipts#latest')).toBe(
      '/receipts?receiptClaimed=1#latest'
    );
  });

  it('preserves absolute URL origins while adding the marker', () => {
    expect(withReceiptClaimedSearchParam('https://example.com/receipts')).toBe(
      'https://example.com/receipts?receiptClaimed=1'
    );
  });

  it('returns malformed paths unchanged', () => {
    expect(withReceiptClaimedSearchParam('http://[')).toBe('http://[');
  });
});
