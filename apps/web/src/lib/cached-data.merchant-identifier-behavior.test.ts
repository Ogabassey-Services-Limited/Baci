import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import {
  buildCachedDataTestHarness,
  type CachedDataTestHarness,
  mockMerchant,
  resetMockCreateClient,
  resolvedStorefrontMerchantRpcResult,
  withDefaultFeatureSettings,
} from '@/lib/cached-data.test-utils';

vi.mock('@/env', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseServiceRoleKey: vi.fn(() => 'test-service-role-key'),
}));

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/lib/merchant-lookup-backoff', () => ({
  waitForMerchantLookupRetryBackoff: vi.fn(() => Promise.resolve()),
}));
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

describe('cached-data getMerchantByIdentifier behavior', () => {
  describe('error handling', () => {
    it('throws error when merchant lookup fails', async () => {
      harness.mockRpc.mockResolvedValueOnce({
        data: null,
        error: { code: 'XX000', message: 'Database error' },
      });

      await expect(getMerchantByIdentifier('test-store')).rejects.toThrow(
        'Failed to fetch merchant for slug: test-store'
      );
    });

    it('throws error when domain lookup fails', async () => {
      harness.mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error', code: 'DB_ERROR' },
      });

      await expect(getMerchantByIdentifier('store.com')).rejects.toThrow(
        'Database error resolving merchant for domain: store.com'
      );
    });

    it('logs an error after a transient domain lookup exhausts its retry', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const resolveError = {
        message: 'TimeoutError: The operation was aborted due to timeout',
        details:
          'TimeoutError: The operation was aborted due to timeout at undici',
      };
      harness.mockRpc
        .mockResolvedValueOnce({ data: null, error: resolveError })
        .mockResolvedValueOnce({ data: null, error: resolveError });

      await expect(getMerchantByIdentifier('store.com')).rejects.toThrow(
        'Database error resolving merchant for domain: store.com'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error resolving merchant for domain',
        expect.objectContaining({
          domain: 'store.com',
          cause: expect.objectContaining({
            message: resolveError.message,
            transient: true,
          }),
          error: expect.objectContaining({
            transient: true,
          }),
        })
      );
    });

    it('returns null when merchant not found by slug', async () => {
      harness.mockRpc.mockResolvedValueOnce({ data: [], error: null });

      await expect(
        getMerchantByIdentifier('nonexistent-store')
      ).resolves.toBeNull();
    });

    it('returns null when domain not found', async () => {
      harness.mockRpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await expect(
        getMerchantByIdentifier('nonexistent.com')
      ).resolves.toBeNull();
    });
  });

  describe('security - contact info redaction for unpublished stores', () => {
    it('redacts contact info when store is not published (slug lookup)', async () => {
      const unpublishedMerchant = { ...mockMerchant, is_published: false };
      harness.mockRpc.mockResolvedValueOnce(
        resolvedStorefrontMerchantRpcResult(unpublishedMerchant)
      );

      await expect(
        getMerchantByIdentifier('test-store')
      ).resolves.toMatchObject({
        ...unpublishedMerchant,
        email: '',
        phone: '',
        support_email: '',
        support_phone: '',
        business_address: '',
        legal_entity_name: null,
        registered_address: null,
        tax_identification_number: null,
        trust_profile: null,
      });
    });

    it('redacts contact info when store is not published (domain lookup)', async () => {
      const unpublishedMerchant = { ...mockMerchant, is_published: false };
      harness.mockRpc.mockResolvedValueOnce({
        data: [
          {
            custom_domain: 'store.com',
            feature_settings: null,
            merchant_data: { ...unpublishedMerchant },
          },
        ],
        error: null,
      });

      await expect(getMerchantByIdentifier('store.com')).resolves.toMatchObject(
        {
          ...unpublishedMerchant,
          custom_domain: 'store.com',
          email: '',
          phone: '',
          support_email: '',
          support_phone: '',
          business_address: '',
          legal_entity_name: null,
          registered_address: null,
          tax_identification_number: null,
          trust_profile: null,
        }
      );
    });

    it('does not redact contact info when store is published', async () => {
      harness.mockRpc.mockResolvedValueOnce(
        resolvedStorefrontMerchantRpcResult({
          ...mockMerchant,
          is_published: true,
        })
      );

      const result = await getMerchantByIdentifier('test-store');

      expect(result?.email).toBe('test@example.com');
      expect(result?.phone).toBe('+234800000000');
      expect(result?.business_address).toBe('123 Test Street');
    });
  });

  describe('paystack_subaccount_code projection', () => {
    it('preserves paystack_subaccount_code for slug lookups', async () => {
      harness.mockRpc.mockResolvedValueOnce(
        resolvedStorefrontMerchantRpcResult({
          ...mockMerchant,
          paystack_subaccount_code: 'ACCT_test_123',
        })
      );

      const result = await getMerchantByIdentifier('test-store');

      expect(result?.paystack_subaccount_code).toBe('ACCT_test_123');
    });

    it('routes slug projection through the public-safe resolver RPC', async () => {
      harness.mockRpc.mockResolvedValueOnce(
        resolvedStorefrontMerchantRpcResult(mockMerchant)
      );

      await getMerchantByIdentifier('test-store');

      expect(harness.mockRpc).toHaveBeenCalledWith(
        'resolve_storefront_cached_merchant',
        { p_identifier: 'test-store' }
      );
      expect(harness.mockSelect).not.toHaveBeenCalled();
    });

    it('preserves paystack_subaccount_code for domain lookups', async () => {
      harness.mockRpc.mockResolvedValueOnce({
        data: [
          {
            custom_domain: 'store.com',
            feature_settings: null,
            merchant_data: {
              ...mockMerchant,
              paystack_subaccount_code: 'ACCT_domain_456',
            },
          },
        ],
        error: null,
      });

      const result = await getMerchantByIdentifier('store.com');

      expect(result?.paystack_subaccount_code).toBe('ACCT_domain_456');
    });

    // The public projection now lives server-side in the
    // resolve_storefront_cached_merchant RPC (asserted by the migration
    // suite), so a domain lookup routes through the resolver instead of
    // issuing a client-side merchants select.
    it('selects paystack_subaccount_code for domain lookups', async () => {
      harness.mockRpc.mockResolvedValueOnce({
        data: [
          {
            custom_domain: 'store.com',
            feature_settings: null,
            merchant_data: {
              ...mockMerchant,
              paystack_subaccount_code: 'ACCT_domain_456',
            },
          },
        ],
        error: null,
      });

      const result = await getMerchantByIdentifier('store.com');

      expect(harness.mockRpc).toHaveBeenCalledWith(
        'resolve_storefront_cached_merchant',
        { p_identifier: 'store.com' }
      );
      expect(result?.paystack_subaccount_code).toBe('ACCT_domain_456');
    });

    it('preserves published_config for slug lookups', async () => {
      harness.mockRpc.mockResolvedValueOnce(
        resolvedStorefrontMerchantRpcResult({
          ...mockMerchant,
          published_config: { theme: 'dark' },
        })
      );

      const result = await getMerchantByIdentifier('test-store');

      expect(result?.published_config).toEqual({ theme: 'dark' });
    });

    // published_config is projected server-side by the
    // resolve_storefront_cached_merchant RPC, so assert it survives the
    // resolver round-trip for a domain lookup rather than inspecting a
    // client-side select projection.
    it('selects published_config for domain lookups', async () => {
      harness.mockRpc.mockResolvedValueOnce({
        data: [
          {
            custom_domain: 'store.com',
            feature_settings: null,
            merchant_data: {
              ...mockMerchant,
              published_config: { theme: 'dark' },
            },
          },
        ],
        error: null,
      });

      const result = await getMerchantByIdentifier('store.com');

      expect(harness.mockRpc).toHaveBeenCalledWith(
        'resolve_storefront_cached_merchant',
        { p_identifier: 'store.com' }
      );
      expect(result?.published_config).toEqual({ theme: 'dark' });
    });

    it('uses an allowlisted public-safe feature-settings projection for merchant lookups', async () => {
      harness.mockRpc.mockResolvedValueOnce(
        resolvedStorefrontMerchantRpcResult(mockMerchant, {
          featureSettings: {
            blog_enabled: true,
            shipping_insurance_enabled: true,
          },
        })
      );

      const result = await getMerchantByIdentifier('test-store');

      expect(result?.feature_settings).toMatchObject({
        blog_enabled: true,
        shipping_insurance_enabled: true,
      });
      expect(harness.mockSelect).not.toHaveBeenCalled();
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('handles identifier with only dots (invalid)', async () => {
      await expect(getMerchantByIdentifier('...')).resolves.toBeNull();
    });

    it('handles identifier with only hyphens (invalid)', async () => {
      await expect(getMerchantByIdentifier('---')).resolves.toBeNull();
    });

    it('handles minimum length valid identifier (2 chars)', async () => {
      harness.mockRpc.mockResolvedValueOnce(
        resolvedStorefrontMerchantRpcResult(mockMerchant)
      );

      await expect(getMerchantByIdentifier('ab')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );
    });

    it('handles maximum length valid identifier (254 chars)', async () => {
      harness.mockRpc.mockResolvedValueOnce(
        resolvedStorefrontMerchantRpcResult(mockMerchant)
      );

      await expect(
        getMerchantByIdentifier(`a${'b'.repeat(252)}c`)
      ).resolves.toEqual(withDefaultFeatureSettings(mockMerchant));
    });

    it('handles identifier with mixed case correctly', async () => {
      harness.mockRpc.mockResolvedValueOnce(
        resolvedStorefrontMerchantRpcResult(mockMerchant)
      );

      await getMerchantByIdentifier('TeSt-StOrE');

      expect(harness.mockRpc).toHaveBeenCalledWith(
        'resolve_storefront_cached_merchant',
        { p_identifier: 'test-store' }
      );
    });

    it('handles null-like identifier gracefully', async () => {
      await expect(
        getMerchantByIdentifier(null as unknown as string)
      ).resolves.toBeNull();
      await expect(
        getMerchantByIdentifier(undefined as unknown as string)
      ).resolves.toBeNull();
    });

    it('handles numeric identifier', async () => {
      harness.mockRpc.mockResolvedValueOnce(
        resolvedStorefrontMerchantRpcResult(mockMerchant)
      );

      await expect(getMerchantByIdentifier('123')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );
    });

    it('rejects domains with port numbers and unicode identifiers', async () => {
      await expect(
        getMerchantByIdentifier('store.com:8080')
      ).resolves.toBeNull();
      await expect(getMerchantByIdentifier('störe')).resolves.toBeNull();
    });
  });
});
