import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();
const mockGetCurrentSlugForAlias = vi.fn();

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: () => ({ rpc: mockRpc }),
}));
vi.mock('@/lib/slug-alias-cache', () => ({
  getCurrentSlugForAlias: (...args: unknown[]) =>
    mockGetCurrentSlugForAlias(...args),
}));

import {
  isUuid,
  MerchantNotFoundError,
  resolveFeedMerchant,
} from '@/lib/feed-identifier';

const merchantFixture = {
  id: '11111111-1111-4111-8111-111111111111',
  business_name: 'Ogabassey',
  country: 'NG',
  payout_currency: 'NGN',
  slug: 'ogabassey',
};

function mockQuery(result: { data: unknown; error: unknown }) {
  mockRpc.mockResolvedValue(result);
}

describe('isUuid', () => {
  it('returns true for a valid UUID v4', () => {
    expect(isUuid('00000000-0000-4000-8000-000000000001')).toBe(true);
  });

  it('returns true for uppercase UUIDs', () => {
    expect(isUuid('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')).toBe(true);
  });

  it('returns false for a slug', () => {
    expect(isUuid('ogabassey')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isUuid('')).toBe(false);
  });

  it('returns false for a UUID missing dashes', () => {
    expect(isUuid('00000000000040008000000000000001')).toBe(false);
  });
});

describe('resolveFeedMerchant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves a merchant by slug', async () => {
    mockQuery({ data: [merchantFixture], error: null });

    const result = await resolveFeedMerchant('ogabassey', true);
    expect(result).toEqual(merchantFixture);
    expect(mockRpc).toHaveBeenCalledWith('resolve_public_feed_merchant', {
      p_identifier: 'ogabassey',
      p_is_by_slug: true,
    });
  });

  it('falls back to the alias table for a retired slug and retries with the current slug', async () => {
    mockRpc.mockImplementation((_fn, args: { p_identifier: string }) =>
      args.p_identifier === 'ogabassey'
        ? Promise.resolve({ data: [merchantFixture], error: null })
        : Promise.resolve({ data: [], error: null })
    );
    mockGetCurrentSlugForAlias.mockResolvedValue('ogabassey');

    const result = await resolveFeedMerchant('yodhashop', true);

    expect(result).toEqual(merchantFixture);
    expect(mockRpc).toHaveBeenCalledWith('resolve_public_feed_merchant', {
      p_identifier: 'yodhashop',
      p_is_by_slug: true,
    });
    expect(mockRpc).toHaveBeenCalledWith('resolve_public_feed_merchant', {
      p_identifier: 'ogabassey',
      p_is_by_slug: true,
    });
  });

  it('resolves a merchant by UUID', async () => {
    mockQuery({ data: [merchantFixture], error: null });

    const result = await resolveFeedMerchant(merchantFixture.id, false);
    expect(result).toEqual(merchantFixture);
    expect(mockRpc).toHaveBeenCalledWith('resolve_public_feed_merchant', {
      p_identifier: merchantFixture.id,
      p_is_by_slug: false,
    });
  });

  it('throws MerchantNotFoundError when merchant does not exist', async () => {
    mockQuery({ data: [], error: null });

    await expect(resolveFeedMerchant('nonexistent', true)).rejects.toThrow(
      MerchantNotFoundError
    );
  });

  it('throws a generic error when the database query fails', async () => {
    mockQuery({ data: null, error: { message: 'connection refused' } });

    await expect(resolveFeedMerchant('ogabassey', true)).rejects.toThrow(
      'Failed to resolve merchant'
    );
  });

  it('database error is not a MerchantNotFoundError', async () => {
    mockQuery({ data: null, error: { message: 'connection refused' } });

    await expect(resolveFeedMerchant('ogabassey', true)).rejects.not.toThrow(
      MerchantNotFoundError
    );
  });
});
