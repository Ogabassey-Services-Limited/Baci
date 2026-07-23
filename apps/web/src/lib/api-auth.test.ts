import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMerchantIdForApiUser,
  getUserAccess,
  hasPermission,
  type UserAccess,
} from './api-auth';

function createMockSupabase(rpcResult: {
  data: unknown;
  error: { message: string; code: string } | null;
}) {
  return {
    rpc: vi.fn(() => Promise.resolve(rpcResult)),
  } as unknown as SupabaseClient;
}

describe('getUserAccess', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns UserAccess for a valid owner response', async () => {
    const supabase = createMockSupabase({
      data: [
        {
          merchant_id: '550e8400-e29b-41d4-a716-446655440000',
          role: 'owner',
          is_owner: true,
          is_staff: false,
          permissions: { '*': { '*': true } },
        },
      ],
      error: null,
    });

    const result = await getUserAccess(supabase);

    expect(result).toEqual({
      merchantId: '550e8400-e29b-41d4-a716-446655440000',
      role: 'owner',
      isOwner: true,
      isStaff: false,
      permissions: { '*': { '*': true } },
    });
    expect(supabase.rpc).toHaveBeenCalledWith('get_user_access');
  });

  it('returns UserAccess for a valid staff response', async () => {
    const supabase = createMockSupabase({
      data: [
        {
          merchant_id: '550e8400-e29b-41d4-a716-446655440000',
          role: 'staff',
          is_owner: false,
          is_staff: true,
          permissions: { orders: { view: true } },
        },
      ],
      error: null,
    });

    const result = await getUserAccess(supabase);

    expect(result).toEqual({
      merchantId: '550e8400-e29b-41d4-a716-446655440000',
      role: 'staff',
      isOwner: false,
      isStaff: true,
      permissions: { orders: { view: true } },
    });
  });

  it('returns null and logs on RPC error', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(/* suppress test noise */ () => undefined);
    const supabase = createMockSupabase({
      data: null,
      error: { message: 'function not found', code: '42883' },
    });

    const result = await getUserAccess(supabase);

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'getUserAccess RPC error:',
      'function not found',
      '42883'
    );
  });

  it('returns null when data is null', async () => {
    const supabase = createMockSupabase({ data: null, error: null });

    const result = await getUserAccess(supabase);

    expect(result).toBeNull();
  });

  it('returns null when data is an empty array', async () => {
    const supabase = createMockSupabase({ data: [], error: null });

    const result = await getUserAccess(supabase);

    expect(result).toBeNull();
  });

  it('returns null and logs on schema validation failure', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(/* suppress test noise */ () => undefined);
    const supabase = createMockSupabase({
      data: [
        {
          merchant_id: 'not-a-uuid',
          role: 'invalid_role',
          is_owner: 'not-boolean',
        },
      ],
      error: null,
    });

    const result = await getUserAccess(supabase);

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'getUserAccess schema validation failed:',
      expect.objectContaining({ fieldErrors: expect.any(Object) })
    );
  });

  it('defaults permissions to empty object when not provided', async () => {
    const supabase = createMockSupabase({
      data: [
        {
          merchant_id: '550e8400-e29b-41d4-a716-446655440000',
          role: 'staff',
          is_owner: false,
          is_staff: true,
        },
      ],
      error: null,
    });

    const result = await getUserAccess(supabase);

    expect(result?.permissions).toEqual({});
  });

  it('handles non-array data (single object)', async () => {
    const supabase = createMockSupabase({
      data: {
        merchant_id: '550e8400-e29b-41d4-a716-446655440000',
        role: 'owner',
        is_owner: true,
        is_staff: false,
        permissions: { '*': { '*': true } },
      },
      error: null,
    });

    const result = await getUserAccess(supabase);

    expect(result).not.toBeNull();
    expect(result?.role).toBe('owner');
  });
});

describe('getMerchantIdForApiUser', () => {
  it('returns merchantId when access exists', async () => {
    const supabase = createMockSupabase({
      data: [
        {
          merchant_id: '550e8400-e29b-41d4-a716-446655440000',
          role: 'owner',
          is_owner: true,
          is_staff: false,
          permissions: {},
        },
      ],
      error: null,
    });

    const result = await getMerchantIdForApiUser(supabase);

    expect(result).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('returns null when access is null', async () => {
    const supabase = createMockSupabase({ data: [], error: null });

    const result = await getMerchantIdForApiUser(supabase);

    expect(result).toBeNull();
  });
});

describe('hasPermission', () => {
  const ownerAccess: UserAccess = {
    merchantId: '550e8400-e29b-41d4-a716-446655440000',
    role: 'owner',
    isOwner: true,
    isStaff: false,
    permissions: {},
  };

  const staffAccess: UserAccess = {
    merchantId: '550e8400-e29b-41d4-a716-446655440000',
    role: 'staff',
    isOwner: false,
    isStaff: true,
    permissions: {
      orders: { view: true, edit: true },
      products: { view: true },
    },
  };

  it('grants owners full access regardless of permissions', () => {
    expect(hasPermission(ownerAccess, 'orders', 'delete')).toBe(true);
    expect(hasPermission(ownerAccess, 'anything', 'anything')).toBe(true);
  });

  it('checks specific resource and action for staff', () => {
    expect(hasPermission(staffAccess, 'orders', 'view')).toBe(true);
    expect(hasPermission(staffAccess, 'orders', 'edit')).toBe(true);
    expect(hasPermission(staffAccess, 'products', 'view')).toBe(true);
  });

  it('denies staff for ungranted permissions', () => {
    expect(hasPermission(staffAccess, 'orders', 'delete')).toBe(false);
    expect(hasPermission(staffAccess, 'products', 'edit')).toBe(false);
    expect(hasPermission(staffAccess, 'marketing', 'view')).toBe(false);
  });

  it('grants access via wildcard resource permission', () => {
    const access: UserAccess = {
      ...staffAccess,
      permissions: { '*': { view: true } },
    };

    expect(hasPermission(access, 'orders', 'view')).toBe(true);
    expect(hasPermission(access, 'anything', 'view')).toBe(true);
    expect(hasPermission(access, 'orders', 'edit')).toBe(false);
  });

  it('grants access via wildcard action permission', () => {
    const access: UserAccess = {
      ...staffAccess,
      permissions: { orders: { '*': true } },
    };

    expect(hasPermission(access, 'orders', 'view')).toBe(true);
    expect(hasPermission(access, 'orders', 'delete')).toBe(true);
    expect(hasPermission(access, 'products', 'view')).toBe(false);
  });

  it('grants access via full wildcard permission', () => {
    const access: UserAccess = {
      ...staffAccess,
      permissions: { '*': { '*': true } },
    };

    expect(hasPermission(access, 'anything', 'anything')).toBe(true);
  });

  it.each([
    ['full access', { full_access: { all: true } }],
    ['legacy resource all', { orders: { all: true } }],
  ])('grants access via %s permission', (_name, permissions) => {
    const access: UserAccess = {
      ...staffAccess,
      permissions,
    };

    expect(hasPermission(access, 'orders', 'delete')).toBe(true);
  });
});
