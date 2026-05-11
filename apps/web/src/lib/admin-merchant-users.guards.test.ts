import { describe, expect, it } from 'vitest';
import {
  isAdminMerchantPushTokenRow,
  isAdminMerchantRow,
  isValidRowArray,
} from '@/lib/admin-merchant-users.guards';

describe('admin merchant user row guards', () => {
  it('accepts valid merchant and push token rows', () => {
    expect(
      isAdminMerchantRow({
        business_name: 'Baci Store',
        id: 'merchant-1',
        user_id: 'owner-1',
      })
    ).toBe(true);
    expect(
      isAdminMerchantPushTokenRow({
        app_type: 'admin',
        id: 'token-1',
        is_active: true,
        platform: 'ios',
        user_id: 'owner-1',
      })
    ).toBe(true);
  });

  it('rejects arrays and malformed rows', () => {
    expect(isAdminMerchantRow([])).toBe(false);
    expect(isAdminMerchantRow(null)).toBe(false);
    expect(isAdminMerchantRow(undefined)).toBe(false);
    expect(isAdminMerchantRow({ id: 'merchant-1' })).toBe(false);
    expect(isAdminMerchantPushTokenRow(null)).toBe(false);
    expect(isAdminMerchantPushTokenRow(undefined)).toBe(false);
    expect(
      isAdminMerchantPushTokenRow({ id: 'token-1', is_active: 'yes' })
    ).toBe(false);
  });

  it('validates arrays with the supplied row guard', () => {
    const row = {
      business_name: null,
      id: 'merchant-1',
      user_id: null,
    };

    expect(isValidRowArray([], isAdminMerchantRow)).toBe(true);
    expect(isValidRowArray([row], isAdminMerchantRow)).toBe(true);
    expect(isValidRowArray([row, []], isAdminMerchantRow)).toBe(false);
    expect(isValidRowArray(row, isAdminMerchantRow)).toBe(false);
  });
});
