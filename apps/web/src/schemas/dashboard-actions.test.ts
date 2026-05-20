import { describe, expect, it } from 'vitest';
import {
  dashboardMerchantActionArgsSchema,
  dashboardRecentSalesArgsSchema,
} from './dashboard-actions';

describe('dashboard action schemas', () => {
  it('accepts and trims merchant ids', () => {
    expect(
      dashboardMerchantActionArgsSchema.parse({ merchantId: ' merchant-1 ' })
    ).toEqual({
      merchantId: 'merchant-1',
    });
  });

  it('rejects missing merchant ids', () => {
    expect(
      dashboardMerchantActionArgsSchema.safeParse({ merchantId: '   ' }).success
    ).toBe(false);
  });

  it('defaults recent sales limit when omitted', () => {
    expect(
      dashboardRecentSalesArgsSchema.parse({ merchantId: 'merchant-1' })
    ).toEqual({
      limit: 5,
      merchantId: 'merchant-1',
    });
  });

  it('rejects unsafe recent sales limits', () => {
    expect(
      dashboardRecentSalesArgsSchema.safeParse({
        limit: 0,
        merchantId: 'merchant-1',
      }).success
    ).toBe(false);
    expect(
      dashboardRecentSalesArgsSchema.safeParse({
        limit: 51,
        merchantId: 'merchant-1',
      }).success
    ).toBe(false);
  });
});
