import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { getAdminMerchantUserDirectory } from '@/lib/admin-merchant-users';

const TEST_MERCHANT_ID = '11111111-1111-4111-8111-111111111111';

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

function createMerchantQuery() {
  return createQuery({
    data: {
      business_name: 'Baci Store',
      created_at: '2026-03-20T10:00:00.000Z',
      email: 'owner@example.com',
      id: TEST_MERCHANT_ID,
      is_published: true,
      phone: null,
      plan_tier: null,
      signup_source: null,
      slug: 'baci-store',
      updated_at: null,
      user_id: 'owner-user',
    },
    error: null,
  });
}

describe('getAdminMerchantUserDirectory error paths', () => {
  it('rejects invalid merchant ids before querying the database', async () => {
    const supabase = { from: vi.fn() };

    const result = await getAdminMerchantUserDirectory(
      toSupabaseClient(supabase),
      'not-a-uuid'
    );

    expect(result.data).toBeNull();
    expect(result.error).toEqual({
      code: 'INVALID_MERCHANT_ID',
      message: 'Invalid merchant ID',
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns a not-found result when the merchant does not exist', async () => {
    const merchantQuery = createQuery({ data: null, error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'merchants') return merchantQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await getAdminMerchantUserDirectory(
      toSupabaseClient(supabase),
      TEST_MERCHANT_ID
    );

    expect(result).toEqual({ data: null, error: null });
  });

  it('surfaces merchant query errors for API handlers', async () => {
    const merchantQuery = createQuery({
      data: null,
      error: { message: 'database unavailable' },
    });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'merchants') return merchantQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await getAdminMerchantUserDirectory(
      toSupabaseClient(supabase),
      TEST_MERCHANT_ID
    );

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('database unavailable');
  });

  it.each([
    ['staff_members', 'staff members unavailable'],
    ['customers', 'customers table unavailable'],
    ['push_tokens', 'push tokens unavailable'],
  ])('surfaces %s query errors', async (failingTable, message) => {
    const staffQuery = createQuery({
      data: failingTable === 'staff_members' ? null : [],
      error: failingTable === 'staff_members' ? { message } : null,
    });
    const customersQuery = createQuery({
      data: failingTable === 'customers' ? null : [],
      error: failingTable === 'customers' ? { message } : null,
    });
    const pushTokensQuery = createQuery({
      data: failingTable === 'push_tokens' ? null : [],
      error: failingTable === 'push_tokens' ? { message } : null,
    });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'merchants') return createMerchantQuery();
        if (table === 'staff_members') return staffQuery;
        if (table === 'customers') return customersQuery;
        if (table === 'push_tokens') return pushTokensQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await getAdminMerchantUserDirectory(
      toSupabaseClient(supabase),
      TEST_MERCHANT_ID
    );

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe(message);
  });

  it.each([
    ['staff_members', { email: 'staff@example.com' }],
    ['customers', { email: 'customer@example.com' }],
    ['push_tokens', { token: 'ExponentPushToken[secret]' }],
  ])('returns a row-shape error when %s rows are malformed', async (failingTable, malformedRow) => {
    const staffQuery = createQuery({
      data: failingTable === 'staff_members' ? [malformedRow] : [],
      error: null,
    });
    const customersQuery = createQuery({
      data: failingTable === 'customers' ? [malformedRow] : [],
      error: null,
    });
    const pushTokensQuery = createQuery({
      data: failingTable === 'push_tokens' ? [malformedRow] : [],
      error: null,
    });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'merchants') return createMerchantQuery();
        if (table === 'staff_members') return staffQuery;
        if (table === 'customers') return customersQuery;
        if (table === 'push_tokens') return pushTokensQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await getAdminMerchantUserDirectory(
      toSupabaseClient(supabase),
      TEST_MERCHANT_ID
    );

    expect(result.data).toBeNull();
    expect(result.error).toEqual({
      code: 'INVALID_ROW_SHAPE',
      message: 'Invalid merchant user row returned from database',
    });
  });
});
