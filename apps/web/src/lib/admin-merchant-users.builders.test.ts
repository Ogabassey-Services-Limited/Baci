import { describe, expect, it } from 'vitest';
import {
  buildCustomerRecord,
  buildOwnerRecord,
  buildStaffRecord,
  buildUnmatchedAppUsers,
} from '@/lib/admin-merchant-users.builders';
import type {
  AdminMerchantCustomerRow,
  AdminMerchantPushTokenRow,
  AdminMerchantRow,
  AdminMerchantStaffRow,
} from '@/lib/admin-merchant-users.types';

const pushTokens: AdminMerchantPushTokenRow[] = [
  {
    app_type: 'admin',
    created_at: '2026-03-21T10:00:00.000Z',
    id: 'token-admin',
    is_active: true,
    last_used_at: '2026-03-24T10:00:00.000Z',
    platform: 'ios',
    updated_at: '2026-03-23T10:00:00.000Z',
    user_id: 'user-1',
  },
  {
    app_type: 'storefront',
    created_at: '2026-03-22T10:00:00.000Z',
    id: 'token-storefront',
    is_active: true,
    last_used_at: '2026-03-25T10:00:00.000Z',
    platform: 'android',
    updated_at: '2026-03-23T10:00:00.000Z',
    user_id: 'app-only',
  },
];

describe('admin merchant user builders', () => {
  it('builds owner, staff, and customer records with device surfaces', () => {
    const merchant: AdminMerchantRow = {
      business_name: 'Baci Store',
      created_at: '2026-03-20T10:00:00.000Z',
      email: 'owner@example.com',
      id: 'merchant-1',
      is_published: true,
      phone: null,
      plan_tier: 'pro',
      signup_source: 'web',
      slug: 'baci-store',
      updated_at: '2026-03-21T10:00:00.000Z',
      user_id: 'user-1',
    };
    const staff: AdminMerchantStaffRow = {
      created_at: '2026-03-21T10:00:00.000Z',
      email: 'staff@example.com',
      id: 'staff-1',
      last_login_at: '2026-03-22T10:00:00.000Z',
      name: 'Staff User',
      role: 'manager',
      status: 'active',
      user_id: 'user-1',
    };
    const customer: AdminMerchantCustomerRow = {
      auth_provider: 'email',
      created_at: '2026-03-21T10:00:00.000Z',
      deleted_at: null,
      email: 'customer@example.com',
      first_name: 'Customer',
      full_name: null,
      id: 'customer-1',
      last_login_at: '2026-03-22T10:00:00.000Z',
      last_name: 'One',
      user_id: 'user-1',
    };

    expect(buildOwnerRecord(merchant, pushTokens)).toMatchObject({
      activeAppInstallations: 1,
      appPlatforms: ['ios'],
      role: 'owner',
      surfaces: ['web', 'admin_app'],
    });
    expect(buildStaffRecord(staff, pushTokens)).toMatchObject({
      role: 'staff',
      staffRole: 'manager',
      status: 'active',
    });
    expect(buildCustomerRecord(customer, pushTokens)).toMatchObject({
      name: 'Customer One',
      role: 'customer',
    });
  });

  it('groups unmatched app users without duplicating known users', () => {
    const records = buildUnmatchedAppUsers(pushTokens, new Set(['user-1']));

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      activeAppInstallations: 1,
      appPlatforms: ['android'],
      role: 'app_user',
      surfaces: ['storefront_app'],
      userId: 'app-only',
    });
  });
});
