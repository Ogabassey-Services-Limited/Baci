import { describe, expect, it } from 'vitest';
import {
  createDeviceListItems,
  joinBasePath,
  withReceiptClaimedSearchParam,
} from './receipt-claim-page-utils';

describe('receipt claim page utils', () => {
  it('joins optional storefront base paths', () => {
    expect(joinBasePath('/ogabassey', '/receipts')).toBe('/ogabassey/receipts');
    expect(joinBasePath('/ogabassey/', '/receipts')).toBe(
      '/ogabassey/receipts'
    );
    expect(joinBasePath('/ogabassey', 'receipts')).toBe('/ogabassey/receipts');
    expect(joinBasePath(undefined, '/receipts')).toBe('/receipts');
  });

  it('creates duplicate-safe device item keys', () => {
    expect(createDeviceListItems(['Pixel 9', 'Pixel 9'])).toEqual([
      { device: 'Pixel 9', key: 'Pixel 9-1' },
      { device: 'Pixel 9', key: 'Pixel 9-2' },
    ]);
  });

  it('marks receipt redirects as coming from a successful claim', () => {
    expect(withReceiptClaimedSearchParam('/receipts')).toBe(
      '/receipts?receiptClaimed=1'
    );
  });
});
