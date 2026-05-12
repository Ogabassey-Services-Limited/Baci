import { describe, expect, it } from 'vitest';
import {
  isAdminMerchantCustomerRow,
  isAdminMerchantPushTokenRow,
  isAdminMerchantRow,
  isAdminMerchantStaffRow,
  isValidRowArray,
} from '@/lib/admin-merchant-users.guards';

const merchantRow = {
  business_name: 'Baci Store',
  created_at: '2026-03-20T10:00:00.000Z',
  email: 'owner@example.com',
  id: 'merchant-1',
  is_published: true,
  phone: '+2348000000000',
  plan_tier: 'pro',
  signup_source: 'web',
  slug: 'baci-store',
  updated_at: '2026-03-21T10:00:00.000Z',
  user_id: 'owner-1',
};

const staffRow = {
  created_at: '2026-03-20T10:00:00.000Z',
  email: 'staff@example.com',
  id: 'staff-1',
  last_login_at: null,
  name: 'Staff User',
  role: 'manager',
  status: 'active',
  user_id: 'staff-user-1',
};

const customerRow = {
  auth_provider: 'email',
  created_at: '2026-03-20T10:00:00.000Z',
  deleted_at: null,
  email: 'customer@example.com',
  first_name: 'Customer',
  full_name: 'Customer One',
  id: 'customer-1',
  last_login_at: null,
  last_name: 'One',
  user_id: 'customer-user-1',
};

const pushTokenRow = {
  app_type: 'admin',
  created_at: '2026-03-20T10:00:00.000Z',
  id: 'token-1',
  is_active: true,
  last_used_at: '2026-03-21T10:00:00.000Z',
  platform: 'ios',
  updated_at: '2026-03-21T10:00:00.000Z',
  user_id: 'owner-1',
};

describe('admin merchant user row guards', () => {
  it('accepts valid merchant, staff, customer, and push token rows', () => {
    expect(isAdminMerchantRow(merchantRow)).toBe(true);
    expect(isAdminMerchantStaffRow(staffRow)).toBe(true);
    expect(isAdminMerchantCustomerRow(customerRow)).toBe(true);
    expect(isAdminMerchantPushTokenRow(pushTokenRow)).toBe(true);
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

  it('rejects rows when any declared field has the wrong type', () => {
    expect(isAdminMerchantRow({ ...merchantRow, is_published: 'yes' })).toBe(
      false
    );
    expect(isAdminMerchantStaffRow({ ...staffRow, role: 7 })).toBe(false);
    expect(
      isAdminMerchantCustomerRow({ ...customerRow, deleted_at: false })
    ).toBe(false);
    expect(
      isAdminMerchantPushTokenRow({ ...pushTokenRow, last_used_at: 123 })
    ).toBe(false);
  });

  it('validates arrays with the supplied row guard', () => {
    expect(isValidRowArray([], isAdminMerchantRow)).toBe(true);
    expect(isValidRowArray([merchantRow], isAdminMerchantRow)).toBe(true);
    expect(isValidRowArray([merchantRow, []], isAdminMerchantRow)).toBe(false);
    expect(isValidRowArray(merchantRow, isAdminMerchantRow)).toBe(false);
  });
});
