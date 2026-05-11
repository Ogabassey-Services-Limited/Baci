import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { getAdminMerchantUserDirectory } from '@/lib/admin-merchant-users';

type QueryResult<T> = {
  data: T | T[] | null;
  error: { message: string } | null;
};

function createQuery<T>(result: QueryResult<T>) {
  const query = {
    eq: vi.fn(() => query),
    limit: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    order: vi.fn(() => query),
    select: vi.fn((_columns?: string) => query),
  };

  return query;
}

type MockSupabaseClient = {
  from: (table: string) => ReturnType<typeof createQuery>;
};

function toSupabaseClient(client: MockSupabaseClient): SupabaseClient {
  return client as unknown as SupabaseClient;
}

describe('getAdminMerchantUserDirectory', () => {
  it('builds a merchant user directory across web and app surfaces without exposing push tokens', async () => {
    const merchantQuery = createQuery({
      data: {
        business_name: 'Baci Store',
        created_at: '2026-03-20T10:00:00.000Z',
        email: 'owner@example.com',
        id: '11111111-1111-4111-8111-111111111111',
        is_published: true,
        phone: '+2348000000000',
        plan_tier: 'pro',
        signup_source: 'web',
        slug: 'baci-store',
        updated_at: '2026-03-21T10:00:00.000Z',
        user_id: 'owner-user',
      },
      error: null,
    });
    const staffQuery = createQuery({
      data: [
        {
          accepted_at: '2026-03-22T10:00:00.000Z',
          created_at: '2026-03-22T09:00:00.000Z',
          email: 'staff@example.com',
          id: 'staff-1',
          last_login_at: '2026-03-23T10:00:00.000Z',
          merchant_id: '11111111-1111-4111-8111-111111111111',
          name: 'Staff User',
          permissions: {},
          phone: '+2348111111111',
          role: 'manager',
          status: 'active',
          user_id: 'staff-user',
        },
      ],
      error: null,
    });
    const customersQuery = createQuery({
      data: [
        {
          auth_provider: 'email',
          created_at: '2026-03-24T10:00:00.000Z',
          deleted_at: null,
          email: 'customer@example.com',
          first_name: 'Customer',
          full_name: 'Customer One',
          id: 'customer-1',
          last_login_at: '2026-03-25T10:00:00.000Z',
          last_name: 'One',
          phone: '+2348222222222',
          total_orders: 3,
          total_spent: 1200,
          user_id: 'customer-user',
        },
      ],
      error: null,
    });
    const pushTokensQuery = createQuery({
      data: [
        {
          app_type: 'admin',
          created_at: '2026-03-23T10:00:00.000Z',
          device_name: 'iPhone 16',
          id: 'push-1',
          is_active: true,
          last_used_at: '2026-03-26T10:00:00.000Z',
          platform: 'ios',
          updated_at: '2026-03-26T10:00:00.000Z',
          user_id: 'staff-user',
        },
        {
          app_type: 'storefront',
          created_at: '2026-03-25T10:00:00.000Z',
          device_name: 'Pixel',
          id: 'push-2',
          is_active: true,
          last_used_at: '2026-03-27T10:00:00.000Z',
          platform: 'android',
          updated_at: '2026-03-27T10:00:00.000Z',
          user_id: 'customer-user',
        },
        {
          app_type: 'admin',
          created_at: '2026-03-27T10:00:00.000Z',
          device_name: 'Android tablet',
          id: 'push-3',
          is_active: true,
          last_used_at: 'invalid-date',
          platform: 'android',
          updated_at: '2026-03-28T10:00:00.000Z',
          user_id: 'app-only-user',
        },
      ],
      error: null,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'merchants') return merchantQuery;
        if (table === 'staff_members') return staffQuery;
        if (table === 'customers') return customersQuery;
        if (table === 'push_tokens') return pushTokensQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await getAdminMerchantUserDirectory(
      toSupabaseClient(supabase),
      '11111111-1111-4111-8111-111111111111'
    );

    expect(result.error).toBeNull();
    expect(result.data?.merchant.businessName).toBe('Baci Store');
    expect(result.data?.users.owner.surfaces).toEqual(['web']);
    expect(result.data?.users.staff[0]).toMatchObject({
      activeAppInstallations: 1,
      appPlatforms: ['ios'],
      email: 'staff@example.com',
      role: 'staff',
      surfaces: ['web', 'admin_app'],
    });
    expect(result.data?.users.customers[0]).toMatchObject({
      activeAppInstallations: 1,
      appPlatforms: ['android'],
      email: 'customer@example.com',
      role: 'customer',
      status: 'active',
      surfaces: ['web', 'storefront_app'],
    });
    expect(result.data?.summary).toMatchObject({
      activeAdminAppInstallations: 2,
      activeStorefrontAppInstallations: 1,
      customerUsers: 1,
      staffUsers: 1,
      unmatchedAppUsers: 1,
      webUsers: 3,
    });
    expect(result.data?.users.unmatchedAppUsers[0]).toMatchObject({
      activeAppInstallations: 1,
      appPlatforms: ['android'],
      lastSeenAt: '2026-03-28T10:00:00.000Z',
      role: 'app_user',
      surfaces: ['admin_app'],
      userId: 'app-only-user',
    });
    expect(pushTokensQuery.select).toHaveBeenCalled();
    const selectedPushTokenColumns = String(
      pushTokensQuery.select.mock.calls[0]?.[0]
    )
      .split(',')
      .map((column) => column.trim());
    expect(selectedPushTokenColumns).not.toContain('token');
    expect(JSON.stringify(result.data)).not.toContain('ExponentPushToken');
  });
});
