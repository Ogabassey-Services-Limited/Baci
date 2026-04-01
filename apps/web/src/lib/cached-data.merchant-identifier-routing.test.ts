import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import {
  buildCachedDataTestHarness,
  type CachedDataTestHarness,
  mockMerchant,
  resetMockCreateClient,
} from '@/lib/cached-data.test-utils';

vi.mock('@/env', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseServiceRoleKey: vi.fn(() => 'test-service-role-key'),
}));

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('react', () => ({ cache: vi.fn((fn) => fn) }));
vi.mock('@supabase/supabase-js', async () => {
  const { getMockCreateClient } = await import('@/lib/cached-data.test-utils');
  return {
    createClient: (...args: unknown[]) => {
      const createClient = getMockCreateClient();
      if (!createClient) {
        return {
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn(),
                single: vi.fn(),
                eq: vi.fn(),
              }),
            }),
          }),
          auth: { getUser: vi.fn() },
        };
      }
      return createClient(...args);
    },
  };
});

let harness: CachedDataTestHarness;

beforeEach(() => {
  harness = buildCachedDataTestHarness();
});

afterEach(() => {
  resetMockCreateClient();
  vi.restoreAllMocks();
});

describe('cached-data getMerchantByIdentifier routing', () => {
  describe('validation', () => {
    it('returns null for empty string identifier', async () => {
      await expect(getMerchantByIdentifier('')).resolves.toBeNull();
    });

    it('returns null for identifier with special characters', async () => {
      await expect(
        getMerchantByIdentifier('<script>alert("xss")</script>')
      ).resolves.toBeNull();
    });

    it('returns null for identifier starting with invalid character', async () => {
      await expect(getMerchantByIdentifier('-invalid')).resolves.toBeNull();
    });

    it('returns null for identifier ending with invalid character', async () => {
      await expect(getMerchantByIdentifier('invalid-')).resolves.toBeNull();
    });

    it('returns null for identifier with consecutive dots at the start', async () => {
      await expect(getMerchantByIdentifier('.invalid')).resolves.toBeNull();
    });

    it('returns null for identifier that is too long', async () => {
      await expect(
        getMerchantByIdentifier('a'.repeat(300))
      ).resolves.toBeNull();
    });

    it('returns null for identifier with spaces', async () => {
      await expect(getMerchantByIdentifier('my store')).resolves.toBeNull();
    });

    it('returns null for identifier with forward slashes', async () => {
      await expect(getMerchantByIdentifier('store/admin')).resolves.toBeNull();
    });
  });

  describe('slug lookup routing', () => {
    it('routes to slug lookup for simple identifier', async () => {
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(getMerchantByIdentifier('my-store')).resolves.toEqual(
        mockMerchant
      );
      expect(harness.mockFrom).toHaveBeenCalledWith('merchants');
      expect(harness.mockEq).toHaveBeenCalledWith('slug', 'my-store');
    });

    it('lowercases slug identifier before lookup', async () => {
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await getMerchantByIdentifier('MY-STORE');

      expect(harness.mockEq).toHaveBeenCalledWith('slug', 'my-store');
    });

    it('accepts alphanumeric slugs with hyphens', async () => {
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(getMerchantByIdentifier('store-123-abc')).resolves.toEqual(
        mockMerchant
      );
    });
  });

  describe('domain lookup routing', () => {
    it('routes to domain lookup for domain-like identifier', async () => {
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: { merchant_id: 'merchant-123', domain: 'store.com' },
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });

      await expect(getMerchantByIdentifier('store.com')).resolves.toEqual({
        ...mockMerchant,
        custom_domain: 'store.com',
      });
      expect(harness.mockFrom).toHaveBeenCalledWith('domains');
      expect(harness.mockEq).toHaveBeenCalledWith('domain', 'store.com');
    });

    it('lowercases domain identifier before lookup', async () => {
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: { merchant_id: 'merchant-123', domain: 'store.com' },
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });

      await expect(getMerchantByIdentifier('STORE.COM')).resolves.toEqual({
        ...mockMerchant,
        custom_domain: 'store.com',
      });
      expect(harness.mockEq).toHaveBeenCalledWith('domain', 'store.com');
    });

    it('accepts subdomains', async () => {
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: { merchant_id: 'merchant-123', domain: 'shop.store.com' },
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });

      await expect(getMerchantByIdentifier('shop.store.com')).resolves.toEqual({
        ...mockMerchant,
        custom_domain: 'shop.store.com',
      });
    });

    it('does not route hyphenated identifiers to domain lookup', async () => {
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await getMerchantByIdentifier('my-store-123');

      expect(harness.mockFrom).toHaveBeenCalledWith('merchants');
      expect(harness.mockEq).toHaveBeenCalledWith('slug', 'my-store-123');
    });
  });
});
