import { describe, expect, it } from 'vitest';
import { withReceiptClaimedSearchParam } from './receipt-claim-url';

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

  it('replaces an existing post-claim marker', () => {
    expect(
      withReceiptClaimedSearchParam('/receipts?receiptClaimed=0&tab=devices')
    ).toBe('/receipts?receiptClaimed=1&tab=devices');
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
