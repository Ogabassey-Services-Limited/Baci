import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveSelectedMerchantAccess } from './resolve-selected-merchant-access';

const mocks = vi.hoisted(() => ({
  getMerchantForApiRequest: vi.fn(),
  toUserAccess: vi.fn(),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mocks.getMerchantForApiRequest(...args),
  toUserAccess: (...args: unknown[]) => mocks.toUserAccess(...args),
}));

const merchantId = '22222222-2222-4222-8222-222222222222';
const supabase = {} as SupabaseClient;

describe('resolveSelectedMerchantAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves only an explicitly selected merchant through the scoped access lookup', async () => {
    const merchantContext = {
      merchantId,
      staffAccess: { isOwner: true, isStaff: false, permissions: {} },
    };
    const access = { merchantId, role: 'owner' };
    mocks.getMerchantForApiRequest.mockResolvedValue(merchantContext);
    mocks.toUserAccess.mockReturnValue(access);

    const result = await resolveSelectedMerchantAccess({
      requestedMerchantId: merchantId,
      supabase,
      userId: 'user-1',
    });

    expect(result).toEqual({ access, invalidMerchantId: false });
    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      supabase,
      'user-1',
      { requestedMerchantId: merchantId }
    );
  });

  it('trims a selected merchant ID before authorizing it', async () => {
    const merchantContext = {
      merchantId,
      staffAccess: { isOwner: true, isStaff: false, permissions: {} },
    };
    const access = { merchantId, role: 'owner' };
    mocks.getMerchantForApiRequest.mockResolvedValue(merchantContext);
    mocks.toUserAccess.mockReturnValue(access);

    const result = await resolveSelectedMerchantAccess({
      requestedMerchantId: ` ${merchantId} `,
      supabase,
      userId: 'user-1',
    });

    expect(result).toEqual({ access, invalidMerchantId: false });
    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      supabase,
      'user-1',
      { requestedMerchantId: merchantId }
    );
  });

  it('rejects a missing selected merchant before any access lookup', async () => {
    const result = await resolveSelectedMerchantAccess({
      requestedMerchantId: undefined,
      supabase,
      userId: 'user-1',
    });

    expect(result).toEqual({ access: null, invalidMerchantId: true });
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('rejects an explicitly null selected merchant before any access lookup', async () => {
    const result = await resolveSelectedMerchantAccess({
      requestedMerchantId: null,
      supabase,
      userId: 'user-1',
    });

    expect(result).toEqual({ access: null, invalidMerchantId: true });
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('rejects an invalid selected merchant before any access lookup', async () => {
    const result = await resolveSelectedMerchantAccess({
      requestedMerchantId: 'not-a-uuid',
      supabase,
      userId: 'user-1',
    });

    expect(result).toEqual({ access: null, invalidMerchantId: true });
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
  });
});
