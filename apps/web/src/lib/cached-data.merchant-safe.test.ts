import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMerchantSafe,
  getMerchantStrict,
  getRequestScopedMerchant,
} from '@/lib/cached-data';
import {
  buildCachedDataTestHarness,
  type CachedDataTestHarness,
  mockMerchant,
  resetMockCreateClient,
  withDefaultFeatureSettings,
} from '@/lib/cached-data.test-utils';
import { StorefrontReadUnavailableError } from '@/lib/storefront-read-result';

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
      return createClient
        ? createClient(...args)
        : {
            rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
            auth: { getUser: vi.fn() },
          };
    },
  };
});

function resolverSuccess(
  merchant: typeof mockMerchant = mockMerchant,
  options: {
    customDomain?: string | null;
    featureSettings?: Record<string, unknown> | null;
  } = {}
) {
  return {
    data: [
      {
        resolution_status: 'found',
        custom_domain: options.customDomain ?? null,
        feature_settings: options.featureSettings ?? null,
        merchant_data: merchant,
      },
    ],
    error: null,
    status: 200,
  };
}

let harness: CachedDataTestHarness;

beforeEach(() => {
  harness = buildCachedDataTestHarness();
});

afterEach(() => {
  resetMockCreateClient();
  vi.restoreAllMocks();
});

describe('cached-data merchant safety helpers', () => {
  describe('getMerchantSafe', () => {
    it('returns the one-round-trip public snapshot with safe defaults', async () => {
      harness.mockRpc.mockResolvedValueOnce(resolverSuccess());

      await expect(getMerchantSafe('test-store')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );
      expect(harness.mockRpc).toHaveBeenCalledWith(
        'resolve_storefront_public_snapshot_v2',
        { p_identifier: 'test-store' },
        { get: true }
      );
      expect(harness.mockRpc).toHaveBeenCalledOnce();
      expect(harness.mockFrom).not.toHaveBeenCalled();
    });

    it('uses feature settings and canonical domain returned by the snapshot', async () => {
      harness.mockRpc.mockResolvedValueOnce(
        resolverSuccess(mockMerchant, {
          customDomain: 'shop.example.com',
          featureSettings: { blog_enabled: true },
        })
      );

      await expect(getMerchantSafe('test-store')).resolves.toMatchObject({
        custom_domain: 'shop.example.com',
        feature_settings: { blog_enabled: true },
      });
    });

    it('canonicalizes OgaBassey public media URLs returned by the snapshot', async () => {
      harness.mockRpc.mockResolvedValueOnce(
        resolverSuccess({
          ...mockMerchant,
          id: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
          slug: 'ogabassey',
          template_id: 'ogabassey',
          logo_url:
            'https://aivqthbxdshhltbwipbr.supabase.co/storage/v1/object/public/media/6b5cb8a4-5575-456c-b936-8cdfae30db74/logo.svg',
        })
      );

      await expect(getMerchantSafe('ogabassey')).resolves.toMatchObject({
        logo_url:
          'https://cdn.ogabassey.com/media/6b5cb8a4-5575-456c-b936-8cdfae30db74/logo.svg',
      });
    });

    it('redacts contact and trust fields for unpublished merchants', async () => {
      harness.mockRpc.mockResolvedValueOnce(
        resolverSuccess({
          ...mockMerchant,
          is_published: false,
          support_email: 'support@example.com',
          support_phone: '+2348000000000',
          legal_entity_name: 'Merchant Ltd',
          registered_address: { city: 'Lagos' },
          tax_identification_number: 'TIN-123',
          trust_profile: { founded_year: 2018 },
        })
      );

      await expect(getMerchantSafe('test-store')).resolves.toMatchObject({
        business_address: '',
        email: '',
        legal_entity_name: null,
        phone: '',
        registered_address: null,
        support_email: '',
        support_phone: '',
        tax_identification_number: null,
        trust_profile: null,
      });
    });

    it('returns null only for an explicit successful not-found result', async () => {
      harness.mockRpc.mockResolvedValueOnce({
        data: [
          {
            resolution_status: 'not_found',
            merchant_data: null,
            custom_domain: null,
            feature_settings: null,
          },
        ],
        error: null,
        status: 200,
      });

      await expect(getMerchantSafe('missing-store')).resolves.toBeNull();
      expect(harness.mockRpc).toHaveBeenCalledOnce();
    });

    it('throws a typed unavailable error without an application retry on timeout', async () => {
      harness.mockRpc.mockResolvedValueOnce({
        data: null,
        error: { code: '57014', message: 'statement timeout' },
        status: 500,
      });

      await expect(getMerchantSafe('test-store')).rejects.toMatchObject({
        failure: { kind: 'timeout', retryable: true },
      });
      expect(harness.mockRpc).toHaveBeenCalledOnce();
    });

    it('does not retry or downgrade stable database errors', async () => {
      harness.mockRpc.mockResolvedValueOnce({
        data: null,
        error: {
          code: '25P02',
          message: 'current transaction is aborted, commands ignored',
        },
        status: 503,
      });

      await expect(getMerchantSafe('test-store')).rejects.toBeInstanceOf(
        StorefrontReadUnavailableError
      );
      expect(harness.mockRpc).toHaveBeenCalledOnce();
    });

    it('propagates Next and application exceptions without retrying', async () => {
      const pprError = Object.assign(new Error('prerender interrupted'), {
        digest: 'HANGING_PROMISE_REJECTION',
      });
      harness.mockRpc.mockRejectedValueOnce(pprError);

      await expect(getMerchantSafe('test-store')).rejects.toBe(pprError);
      expect(harness.mockRpc).toHaveBeenCalledOnce();
    });

    it('returns null for invalid identifiers without touching Supabase', async () => {
      await expect(getMerchantSafe('<script>')).resolves.toBeNull();
      expect(harness.mockRpc).not.toHaveBeenCalled();
    });
  });

  describe('getMerchantStrict', () => {
    it('shares the same explicit result semantics', async () => {
      harness.mockRpc.mockResolvedValueOnce(resolverSuccess());

      await expect(getMerchantStrict('test-store')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );
    });

    it('throws instead of caching a transient absence', async () => {
      harness.mockRpc.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST003', message: 'pool timeout' },
        status: 504,
      });

      await expect(getMerchantStrict('test-store')).rejects.toBeInstanceOf(
        StorefrontReadUnavailableError
      );
    });
  });

  describe('getRequestScopedMerchant', () => {
    it('delegates a slug to the public snapshot', async () => {
      harness.mockRpc.mockResolvedValueOnce(resolverSuccess());

      await expect(getRequestScopedMerchant('test-store')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );
    });

    it('normalizes a custom domain before resolving it', async () => {
      harness.mockRpc.mockResolvedValueOnce(
        resolverSuccess(mockMerchant, { customDomain: 'shop.example.com' })
      );

      await expect(
        getRequestScopedMerchant('SHOP.EXAMPLE.COM')
      ).resolves.toMatchObject({ custom_domain: 'shop.example.com' });
      expect(harness.mockRpc).toHaveBeenCalledWith(
        'resolve_storefront_public_snapshot_v2',
        { p_identifier: 'shop.example.com' },
        { get: true }
      );
    });
  });
});
