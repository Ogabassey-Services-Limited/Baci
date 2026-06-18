import { describe, expect, it } from 'vitest';
import {
  createDeviceListItems,
  getParamValue,
  joinBasePath,
  readClaimError,
} from './receipt-claim-page-utils';

describe('receipt claim page utils', () => {
  it('reads route params safely', () => {
    expect(getParamValue('claim-token')).toBe('claim-token');
    expect(getParamValue(['claim-token', 'ignored'])).toBe('claim-token');
    expect(getParamValue(undefined)).toBe('');
  });

  it('joins optional storefront base paths', () => {
    expect(joinBasePath('/ogabassey', '/receipts')).toBe('/ogabassey/receipts');
    expect(joinBasePath(undefined, '/receipts')).toBe('/receipts');
  });

  it('reads error payloads without assuming every payload is an error', () => {
    expect(readClaimError({ error: 'Expired' }, 'Fallback')).toBe('Expired');
    expect(
      readClaimError(
        {
          claim: {
            claimed: false,
            customerName: null,
            devices: [],
            merchantName: 'Ogabassey',
          },
        },
        'Fallback'
      )
    ).toBe('Fallback');
  });

  it('creates duplicate-safe device item keys', () => {
    expect(createDeviceListItems(['Pixel 9', 'Pixel 9'])).toEqual([
      { device: 'Pixel 9', key: 'Pixel 9-1' },
      { device: 'Pixel 9', key: 'Pixel 9-2' },
    ]);
  });
});
