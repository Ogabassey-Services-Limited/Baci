import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import {
  buildCachedDataTestHarness,
  type CachedDataTestHarness,
  mockMerchant,
  resetMockCreateClient,
  withDefaultFeatureSettings,
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

describe('cached-data getMerchantByIdentifier behavior', () => {
  describe('error handling', () => {
    it('throws error when merchant lookup fails', async () => {
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
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

    it('logs warning for transient domain lookup timeouts before throwing', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const resolveError = {
        message: 'TimeoutError: The operation was aborted due to timeout',
        details:
          'TimeoutError: The operation was aborted due to timeout at undici',
      };
      harness.mockRpc.mockResolvedValueOnce({
        data: null,
        error: resolveError,
      });

      await expect(getMerchantByIdentifier('store.com')).rejects.toThrow(
        'Database error resolving merchant for domain: store.com'
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Error resolving merchant for domain',
        {
          domain: 'store.com',
          error: resolveError,
        }
      );
    });

    it('returns null when merchant not found by slug', async () => {
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

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
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: unpublishedMerchant,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

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
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: { ...mockMerchant, is_published: true },
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await getMerchantByIdentifier('test-store');

      expect(result?.email).toBe('test@example.com');
      expect(result?.phone).toBe('+234800000000');
      expect(result?.business_address).toBe('123 Test Street');
    });
  });

  describe('paystack_subaccount_code projection', () => {
    it('preserves paystack_subaccount_code for slug lookups', async () => {
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: {
          ...mockMerchant,
          paystack_subaccount_code: 'ACCT_test_123',
        },
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await getMerchantByIdentifier('test-store');

      expect(result?.paystack_subaccount_code).toBe('ACCT_test_123');
    });

    it('selects paystack_subaccount_code for slug lookups', async () => {
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await getMerchantByIdentifier('test-store');

      expect(
        harness.mockSelect.mock.calls.some(
          ([projection]) =>
            typeof projection === 'string' &&
            projection.includes('paystack_subaccount_code')
        )
      ).toBe(true);
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

    it('selects published_config for slug lookups', async () => {
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await getMerchantByIdentifier('test-store');

      expect(
        harness.mockSelect.mock.calls.some(
          ([projection]) =>
            typeof projection === 'string' &&
            projection.includes('published_config')
        )
      ).toBe(true);
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
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await getMerchantByIdentifier('test-store');

      const merchantProjection = harness.mockSelect.mock.calls
        .map(([projection]) => String(projection))
        .find(
          (projection) =>
            projection.includes('business_name') &&
            projection.includes('published_config')
        );
      const featureSettingsProjection = harness.mockSelect.mock.calls
        .map(([projection]) => String(projection))
        .find((projection) => projection.includes('blog_enabled'));

      expect(merchantProjection).toBeDefined();
      expect(merchantProjection).not.toContain('merchant_feature_settings');
      expect(featureSettingsProjection).toBeDefined();
      expect(featureSettingsProjection).toContain('blog_enabled');
      expect(featureSettingsProjection).toContain('shipping_insurance_enabled');
      expect(featureSettingsProjection).toContain('custom_settings');
      expect(merchantProjection).not.toContain('merchant_feature_settings(*)');
      expect(featureSettingsProjection).not.toContain('facebook_capi_token');
      expect(featureSettingsProjection).not.toContain('tiktok_access_token');
      expect(featureSettingsProjection).not.toContain('ga4_api_secret');
      expect(featureSettingsProjection).not.toContain('snapchat_capi_token');
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
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(getMerchantByIdentifier('ab')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );
    });

    it('handles maximum length valid identifier (254 chars)', async () => {
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(
        getMerchantByIdentifier(`a${'b'.repeat(252)}c`)
      ).resolves.toEqual(withDefaultFeatureSettings(mockMerchant));
    });

    it('handles identifier with mixed case correctly', async () => {
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await getMerchantByIdentifier('TeSt-StOrE');

      expect(harness.mockEq).toHaveBeenCalledWith('slug', 'test-store');
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
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

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
