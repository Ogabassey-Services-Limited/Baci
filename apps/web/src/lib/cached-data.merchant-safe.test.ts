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

const mockWaitForMerchantLookupRetryBackoff = vi.hoisted(() =>
  vi.fn(() => Promise.resolve())
);

vi.mock('@/env', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseServiceRoleKey: vi.fn(() => 'test-service-role-key'),
}));

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/lib/merchant-lookup-backoff', () => ({
  waitForMerchantLookupRetryBackoff: () =>
    mockWaitForMerchantLookupRetryBackoff(),
}));
vi.mock('react', () => ({ cache: vi.fn((fn) => fn) }));
vi.mock('@supabase/supabase-js', async () => {
  const { getMockCreateClient } = await import('@/lib/cached-data.test-utils');
  return {
    createClient: (...args: unknown[]) => {
      const createClient = getMockCreateClient();
      if (!createClient) {
        return {
          rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
          auth: { getUser: vi.fn() },
        };
      }
      return createClient(...args);
    },
  };
});

const FLIGHT_MASKED_ERROR_MESSAGE =
  'An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details.';

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
        custom_domain: options.customDomain ?? null,
        feature_settings: options.featureSettings ?? null,
        merchant_data: merchant,
      },
    ],
    error: null,
  };
}

function transientResolvedError() {
  return {
    data: null,
    error: {
      code: '23',
      details: 'TimeoutError: request aborted at undici',
      message: 'TimeoutError: The operation was aborted due to timeout',
    },
  };
}

let harness: CachedDataTestHarness;

beforeEach(() => {
  mockWaitForMerchantLookupRetryBackoff.mockClear();
  harness = buildCachedDataTestHarness();
});

afterEach(() => {
  resetMockCreateClient();
  vi.restoreAllMocks();
});

describe('cached-data merchant safety helpers', () => {
  describe('getMerchantSafe', () => {
    it('returns the one-round-trip resolver merchant with public defaults', async () => {
      harness.mockRpc.mockResolvedValueOnce(resolverSuccess());

      await expect(getMerchantSafe('test-store')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );
      expect(harness.mockRpc).toHaveBeenCalledOnce();
      expect(harness.mockRpc).toHaveBeenCalledWith(
        'resolve_storefront_cached_merchant',
        { p_identifier: 'test-store' }
      );
      expect(harness.mockFrom).not.toHaveBeenCalled();
    });

    it('uses feature settings and the canonical domain returned by the resolver', async () => {
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

    it('canonicalizes OgaBassey public media URLs returned by the resolver', async () => {
      const merchantWithSupabaseMedia = {
        ...mockMerchant,
        id: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
        slug: 'ogabassey',
        template_id: 'ogabassey',
        logo_url:
          'https://aivqthbxdshhltbwipbr.supabase.co/storage/v1/object/public/media/6b5cb8a4-5575-456c-b936-8cdfae30db74/logo.svg',
      };
      harness.mockRpc.mockResolvedValueOnce(
        resolverSuccess(merchantWithSupabaseMedia)
      );

      await expect(getMerchantSafe('ogabassey')).resolves.toMatchObject({
        logo_url:
          'https://cdn.ogabassey.com/media/6b5cb8a4-5575-456c-b936-8cdfae30db74/logo.svg',
      });
    });

    it('redacts public contact and trust fields for unpublished merchants', async () => {
      const unpublishedMerchant = {
        ...mockMerchant,
        is_published: false,
        support_email: 'support@example.com',
        support_phone: '+2348000000000',
        legal_entity_name: 'Merchant Ltd',
        registered_address: { city: 'Lagos' },
        tax_identification_number: 'TIN-123',
        trust_profile: { founded_year: 2018 },
      };
      harness.mockRpc.mockResolvedValueOnce(
        resolverSuccess(unpublishedMerchant)
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

    it('returns null only when the resolver successfully confirms no merchant', async () => {
      harness.mockRpc.mockResolvedValueOnce({ data: [], error: null });

      await expect(getMerchantSafe('missing-store')).resolves.toBeNull();
      expect(mockWaitForMerchantLookupRetryBackoff).not.toHaveBeenCalled();
    });

    it('propagates Next control-flow errors without retrying', async () => {
      const pprError = Object.assign(new Error('prerender interrupted'), {
        digest: 'HANGING_PROMISE_REJECTION',
      });
      harness.mockRpc.mockRejectedValueOnce(pprError);

      await expect(getMerchantSafe('test-store')).rejects.toBe(pprError);
      expect(harness.mockRpc).toHaveBeenCalledOnce();
      expect(mockWaitForMerchantLookupRetryBackoff).not.toHaveBeenCalled();
    });

    it('does not retry or downgrade an unrelated application error to a 404', async () => {
      const applicationError = new Error(
        'merchant normalizer invariant failed'
      );
      harness.mockRpc.mockRejectedValueOnce(applicationError);

      await expect(getMerchantSafe('test-store')).rejects.toBe(
        applicationError
      );
      expect(harness.mockRpc).toHaveBeenCalledOnce();
      expect(mockWaitForMerchantLookupRetryBackoff).not.toHaveBeenCalled();
    });

    it('does not retry a coded database error whose message contains aborted', async () => {
      harness.mockRpc.mockResolvedValueOnce({
        data: null,
        error: {
          code: '25P02',
          message: 'current transaction is aborted, commands ignored',
        },
      });

      await expect(getMerchantSafe('test-store')).rejects.toThrow(
        'Failed to fetch merchant for slug: test-store'
      );
      expect(harness.mockRpc).toHaveBeenCalledOnce();
      expect(mockWaitForMerchantLookupRetryBackoff).not.toHaveBeenCalled();
    });

    it('runs one uncached resolver retry after a flattened transport timeout', async () => {
      harness.mockRpc
        .mockResolvedValueOnce(transientResolvedError())
        .mockResolvedValueOnce(resolverSuccess());

      await expect(getMerchantSafe('test-store')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );
      expect(harness.mockRpc).toHaveBeenCalledTimes(2);
      expect(mockWaitForMerchantLookupRetryBackoff).toHaveBeenCalledOnce();
    });

    it('does not classify a digest-masked Server Components error as a transport failure', async () => {
      const unrelatedServerError = Object.assign(
        new Error(FLIGHT_MASKED_ERROR_MESSAGE),
        { digest: 'unrelated-application-error' }
      );
      harness.mockRpc.mockRejectedValueOnce(unrelatedServerError);

      await expect(getMerchantSafe('test-store')).rejects.toBe(
        unrelatedServerError
      );
      expect(harness.mockRpc).toHaveBeenCalledOnce();
      expect(mockWaitForMerchantLookupRetryBackoff).not.toHaveBeenCalled();
    });

    it('returns null when the second resolver attempt confirms no merchant', async () => {
      harness.mockRpc
        .mockResolvedValueOnce(transientResolvedError())
        .mockResolvedValueOnce({ data: [], error: null });

      await expect(getMerchantSafe('test-store')).resolves.toBeNull();
      expect(harness.mockRpc).toHaveBeenCalledTimes(2);
    });

    it('throws instead of producing a false 404 when the second attempt fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      harness.mockRpc
        .mockResolvedValueOnce(transientResolvedError())
        .mockResolvedValueOnce({
          data: null,
          error: { code: '', message: 'fetch failed' },
        });

      await expect(getMerchantSafe('test-store')).rejects.toThrow(
        'Failed to fetch merchant for slug: test-store'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching merchant for slug:',
        'test-store',
        expect.objectContaining({
          cause: expect.objectContaining({ transient: true }),
          error: expect.objectContaining({ transient: true }),
        })
      );
    });

    it('treats a low-level fetch rejection as transient', async () => {
      harness.mockRpc
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(resolverSuccess());

      await expect(getMerchantSafe('test-store')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );
      expect(harness.mockRpc).toHaveBeenCalledTimes(2);
    });

    it.each([
      'HTTP 408 Request Timeout',
      'HTTP 503 Service Unavailable',
      'HTTP 520 Web Server Returned an Unknown Error',
    ])('owns the retry for transient upstream status: %s', async (message) => {
      harness.mockRpc
        .mockResolvedValueOnce({
          data: null,
          error: { code: '', message },
        })
        .mockResolvedValueOnce(resolverSuccess());

      await expect(getMerchantSafe('test-store')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );
      expect(harness.mockRpc).toHaveBeenCalledTimes(2);
      expect(mockWaitForMerchantLookupRetryBackoff).toHaveBeenCalledOnce();
    });

    it('retries the Postgres statement-timeout SQLSTATE', async () => {
      harness.mockRpc
        .mockResolvedValueOnce({
          data: null,
          error: { code: '57014', message: 'canceling statement' },
        })
        .mockResolvedValueOnce(resolverSuccess());

      await expect(getMerchantSafe('test-store')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );
      expect(harness.mockRpc).toHaveBeenCalledTimes(2);
    });

    it('does not classify unrelated messages containing 408 digits as transient', async () => {
      const unrelatedError = new Error('catalog row id 4089 failed');
      harness.mockRpc.mockRejectedValueOnce(unrelatedError);

      await expect(getMerchantSafe('test-store')).rejects.toBe(unrelatedError);
      expect(harness.mockRpc).toHaveBeenCalledOnce();
      expect(mockWaitForMerchantLookupRetryBackoff).not.toHaveBeenCalled();
    });

    it('disables PostgREST retries because the outer resolver owns retry', async () => {
      const retry = vi.fn().mockReturnValue(Promise.resolve(resolverSuccess()));
      harness.mockRpc.mockReturnValueOnce({ retry } as never);

      await expect(getMerchantSafe('test-store')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );
      expect(retry).toHaveBeenCalledWith(false);
    });

    it('sanitizes and truncates identifiers in error logs', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const identifier = `test-store-${'a'.repeat(120)}`;
      harness.mockRpc.mockRejectedValueOnce(new Error('application failure'));

      await expect(getMerchantSafe(identifier)).rejects.toThrow(
        'application failure'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching merchant for slug:',
        `test-store-${'a'.repeat(89)}`,
        expect.any(Object)
      );
    });

    it('returns null for invalid identifiers without touching Supabase', async () => {
      await expect(getMerchantSafe('<script>')).resolves.toBeNull();
      expect(harness.mockRpc).not.toHaveBeenCalled();
    });
  });

  describe('getMerchantStrict', () => {
    it('does not retry non-transient failures', async () => {
      const applicationError = new Error('application failure');
      harness.mockRpc.mockRejectedValueOnce(applicationError);

      await expect(getMerchantStrict('test-store')).rejects.toBe(
        applicationError
      );
      expect(harness.mockRpc).toHaveBeenCalledOnce();
      expect(mockWaitForMerchantLookupRetryBackoff).not.toHaveBeenCalled();
    });

    it('uses one bounded retry for transient failures', async () => {
      harness.mockRpc
        .mockResolvedValueOnce(transientResolvedError())
        .mockResolvedValueOnce(resolverSuccess());

      await expect(getMerchantStrict('test-store')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );
      expect(harness.mockRpc).toHaveBeenCalledTimes(2);
      expect(mockWaitForMerchantLookupRetryBackoff).toHaveBeenCalledOnce();
    });

    it('throws when the second attempt also fails', async () => {
      harness.mockRpc
        .mockResolvedValueOnce(transientResolvedError())
        .mockResolvedValueOnce({
          data: null,
          error: { code: '', message: 'fetch failed' },
        });

      await expect(getMerchantStrict('test-store')).rejects.toThrow(
        'Failed to fetch merchant for slug: test-store'
      );
    });

    it('propagates Next control-flow errors without retrying', async () => {
      const pprError = Object.assign(new Error('prerender interrupted'), {
        digest: 'HANGING_PROMISE_REJECTION',
      });
      harness.mockRpc.mockRejectedValueOnce(pprError);

      await expect(getMerchantStrict('test-store')).rejects.toBe(pprError);
      expect(harness.mockRpc).toHaveBeenCalledOnce();
    });
  });

  describe('getRequestScopedMerchant', () => {
    it('delegates a slug to the resilient resolver', async () => {
      harness.mockRpc.mockResolvedValueOnce(resolverSuccess());

      await expect(getRequestScopedMerchant('test-store')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );
      expect(harness.mockRpc).toHaveBeenCalledWith(
        'resolve_storefront_cached_merchant',
        { p_identifier: 'test-store' }
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
        'resolve_storefront_cached_merchant',
        { p_identifier: 'shop.example.com' }
      );
    });
  });
});
