import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMerchantSafe,
  getMerchantStrict,
  getRequestScopedMerchant,
} from '@/lib/cached-data';

const mockUnstableRethrow = vi.hoisted(() => vi.fn());

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
vi.mock('next/navigation', () => ({
  unstable_rethrow: (error: unknown) => mockUnstableRethrow(error),
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
  mockUnstableRethrow.mockReset();
  mockUnstableRethrow.mockImplementation(() => undefined);
  harness = buildCachedDataTestHarness();
});

afterEach(() => {
  resetMockCreateClient();
  vi.restoreAllMocks();
});

describe('cached-data merchant safety helpers', () => {
  describe('getMerchantSafe', () => {
    it('returns merchant data on successful lookup', async () => {
      const merchantWithTrustFields = {
        ...mockMerchant,
        support_email: 'support@ogabassey.com',
        support_phone: '+2348000000000',
        legal_entity_name: 'Ogabassey Gadgets Ltd',
        registered_address: {
          street: '12 Allen Avenue',
          city: 'Ikeja',
          state: 'Lagos',
          country: 'Nigeria',
        },
        tax_identification_number: 'TIN-123',
        trust_profile: {
          founded_year: 2018,
        },
      };
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: merchantWithTrustFields,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(getMerchantSafe('test-store')).resolves.toEqual(
        withDefaultFeatureSettings(merchantWithTrustFields)
      );
      expect(harness.mockSelect).toHaveBeenCalledWith(
        expect.stringContaining('mobile_hero_slides')
      );
    });

    it('canonicalizes OgaBassey public media URLs to CDN URLs before rendering', async () => {
      const merchantWithSupabaseMedia = {
        ...mockMerchant,
        id: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
        template_id: 'ogabassey',
        logo_url:
          'https://aivqthbxdshhltbwipbr.supabase.co/storage/v1/object/public/media/6b5cb8a4-5575-456c-b936-8cdfae30db74/ogabassey_logo_2026_v1.svg',
        favicon_png_32_url:
          'https://aivqthbxdshhltbwipbr.supabase.co/storage/v1/object/public/media/merchants/6b5cb8a4-5575-456c-b936-8cdfae30db74/favicon/favicon-32.png',
        favicon_apple_touch_url:
          'https://aivqthbxdshhltbwipbr.supabase.co/storage/v1/object/public/media/merchants/6b5cb8a4-5575-456c-b936-8cdfae30db74/favicon/apple-touch-icon.png',
      };
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: merchantWithSupabaseMedia,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: { domain: 'ogabassey.com' },
        error: null,
      });

      await expect(getMerchantSafe('ogabassey')).resolves.toMatchObject({
        logo_url:
          'https://cdn.ogabassey.com/media/6b5cb8a4-5575-456c-b936-8cdfae30db74/ogabassey_logo_2026_v1.svg',
        favicon_png_32_url:
          'https://cdn.ogabassey.com/media/merchants/6b5cb8a4-5575-456c-b936-8cdfae30db74/favicon/favicon-32.png',
        favicon_apple_touch_url:
          'https://cdn.ogabassey.com/media/merchants/6b5cb8a4-5575-456c-b936-8cdfae30db74/favicon/apple-touch-icon.png',
      });
    });

    it('does not rewrite non-OgaBassey merchant media onto the OgaBassey CDN', async () => {
      const merchantMediaUrl =
        'https://project.supabase.co/storage/v1/object/public/media/merchant-1/logo.svg';
      const merchantWithSupabaseMedia = {
        ...mockMerchant,
        id: 'merchant-1',
        slug: 'test-store',
        custom_domain: 'test-store.example.com',
        template_id: 'ogabassey',
        logo_url: merchantMediaUrl,
      };
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: merchantWithSupabaseMedia,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: { domain: 'test-store.example.com' },
        error: null,
      });

      await expect(getMerchantSafe('test-store')).resolves.toMatchObject({
        logo_url: merchantMediaUrl,
      });
    });

    it('retries once on first failure and returns data on retry success', async () => {
      harness.mockMaybeSingle
        .mockRejectedValueOnce(new Error('Transient network error'))
        .mockResolvedValueOnce({ data: mockMerchant, error: null });
      harness.mockSingle
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      await expect(getMerchantSafe('test-store')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );
      const merchantTableLookups = harness.mockFrom.mock.calls.filter(
        ([table]) => table === 'merchants'
      );
      expect(merchantTableLookups).toHaveLength(2);
    });

    it('rethrows Next PPR control-flow errors instead of logging them as merchant failures', async () => {
      const pprError = Object.assign(
        new Error(
          'During prerendering, dynamic "use cache" rejects when the prerender is complete'
        ),
        { digest: 'HANGING_PROMISE_REJECTION' }
      );
      mockUnstableRethrow.mockImplementation((error: unknown) => {
        if (error === pprError) throw error;
      });
      harness.mockMaybeSingle.mockRejectedValueOnce(pprError);

      await expect(getMerchantSafe('test-store')).rejects.toBe(pprError);
      expect(mockUnstableRethrow).toHaveBeenCalledWith(pprError);
      expect(harness.mockMaybeSingle).toHaveBeenCalledTimes(1);
    });
    it('returns null after both attempts fail', async () => {
      harness.mockMaybeSingle
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'));

      await expect(getMerchantSafe('test-store')).resolves.toBeNull();
      expect(harness.mockMaybeSingle).toHaveBeenCalledTimes(2);
    });

    it('logs error after retry failure', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      harness.mockMaybeSingle
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'));

      await getMerchantSafe('test-store');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Non-transient merchant lookup failed after retry:',
        'test-store',
        expect.objectContaining({
          firstError: expect.objectContaining({ transient: false }),
          retryError: expect.objectContaining({ transient: false }),
        })
      );
    });

    it('logs warning after retry failure for transient timeout errors', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const timeoutError = new Error(
        'TimeoutError: The operation was aborted due to timeout'
      );
      harness.mockMaybeSingle
        .mockRejectedValueOnce(timeoutError)
        .mockRejectedValueOnce(timeoutError);

      await getMerchantSafe('test-store');

      expect(consoleWarnSpy).toHaveBeenLastCalledWith(
        'Merchant lookup direct fallback returned no merchant:',
        'test-store',
        expect.objectContaining({
          firstError: expect.objectContaining({ transient: true }),
          retryError: expect.objectContaining({ transient: true }),
        })
      );
    });

    it('logs warning after wrapped transient lookup failures', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const timeoutLookupResult = {
        data: null,
        error: {
          message: 'TimeoutError: The operation was aborted due to timeout',
          details:
            'TimeoutError: The operation was aborted due to timeout at undici',
        },
      };
      harness.mockMaybeSingle
        .mockResolvedValueOnce(timeoutLookupResult)
        .mockResolvedValueOnce(timeoutLookupResult)
        .mockResolvedValueOnce({ data: null, error: null });

      await getMerchantSafe('test-store');

      expect(consoleWarnSpy).toHaveBeenLastCalledWith(
        'Merchant lookup direct fallback returned no merchant:',
        'test-store',
        expect.objectContaining({
          firstError: expect.objectContaining({ transient: true }),
          retryError: expect.objectContaining({ transient: true }),
        })
      );
    });

    it('falls back to a direct merchant lookup after remote cache handler failures', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const remoteCacheError = new Error(
        'RemoteCacheHandler: <html><body>502 Bad Gateway</body></html>'
      );
      harness.mockMaybeSingle
        .mockRejectedValueOnce(remoteCacheError)
        .mockRejectedValueOnce(remoteCacheError)
        .mockResolvedValueOnce({ data: mockMerchant, error: null });
      harness.mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(getMerchantSafe('test-store')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );

      const merchantTableLookups = harness.mockFrom.mock.calls.filter(
        ([table]) => table === 'merchants'
      );
      expect(merchantTableLookups).toHaveLength(3);
      expect(consoleWarnSpy).toHaveBeenLastCalledWith(
        'Merchant fetch failed after retry; direct fallback succeeded:',
        'test-store',
        expect.objectContaining({
          firstError: expect.objectContaining({ transient: true }),
          retryError: expect.objectContaining({ transient: true }),
        })
      );
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        'Merchant fetch failed after retry:',
        'test-store'
      );
    });

    it('keeps transient direct fallback on the public client when RLS hides unpublished merchants', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const remoteCacheError = new Error(
        'RemoteCacheHandler: <html><body>502 Bad Gateway</body></html>'
      );
      harness.mockMaybeSingle
        .mockRejectedValueOnce(remoteCacheError)
        .mockRejectedValueOnce(remoteCacheError)
        .mockResolvedValueOnce({ data: null, error: null });

      await expect(getMerchantSafe('test-store')).resolves.toBeNull();

      expect(consoleWarnSpy).toHaveBeenLastCalledWith(
        'Merchant lookup direct fallback returned no merchant:',
        'test-store',
        expect.objectContaining({
          firstError: expect.objectContaining({ transient: true }),
          retryError: expect.objectContaining({ transient: true }),
        })
      );
    });

    it('treats low-level fetch failures as transient and falls back to a direct merchant lookup', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const fetchFailure = new TypeError('fetch failed');
      harness.mockMaybeSingle
        .mockRejectedValueOnce(fetchFailure)
        .mockRejectedValueOnce(fetchFailure)
        .mockResolvedValueOnce({ data: mockMerchant, error: null });
      harness.mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(getMerchantSafe('test-store')).resolves.toEqual(
        withDefaultFeatureSettings(mockMerchant)
      );

      const merchantTableLookups = harness.mockFrom.mock.calls.filter(
        ([table]) => table === 'merchants'
      );
      expect(merchantTableLookups).toHaveLength(3);
      expect(consoleWarnSpy).toHaveBeenLastCalledWith(
        'Merchant fetch failed after retry; direct fallback succeeded:',
        'test-store',
        expect.objectContaining({
          firstError: expect.objectContaining({
            message: 'fetch failed',
            transient: true,
          }),
          retryError: expect.objectContaining({
            message: 'fetch failed',
            transient: true,
          }),
        })
      );
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        'Merchant fetch failed after retry:',
        'test-store',
        expect.any(Object)
      );
    });

    it('does not classify unrelated messages containing 408 digits as transient', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const nonTransientError = new Error('catalog row id 4089 failed');
      harness.mockMaybeSingle
        .mockRejectedValueOnce(nonTransientError)
        .mockRejectedValueOnce(nonTransientError);

      await expect(getMerchantSafe('test-store')).resolves.toBeNull();

      const merchantTableLookups = harness.mockFrom.mock.calls.filter(
        ([table]) => table === 'merchants'
      );
      expect(merchantTableLookups).toHaveLength(2);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Non-transient merchant lookup failed after retry:',
        'test-store',
        expect.objectContaining({
          firstError: expect.objectContaining({ transient: false }),
          retryError: expect.objectContaining({ transient: false }),
        })
      );
    });

    it('returns null and logs an error when cached and direct merchant lookups fail', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const remoteCacheError = new Error(
        'RemoteCacheHandler: <html><body>502 Bad Gateway</body></html>'
      );
      const directLookupError = new Error('direct lookup failed');
      harness.mockMaybeSingle
        .mockRejectedValueOnce(remoteCacheError)
        .mockRejectedValueOnce(remoteCacheError)
        .mockRejectedValueOnce(directLookupError);
      harness.mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(getMerchantSafe('test-store')).resolves.toBeNull();

      const merchantTableLookups = harness.mockFrom.mock.calls.filter(
        ([table]) => table === 'merchants'
      );
      expect(merchantTableLookups).toHaveLength(3);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Direct merchant lookup failed after retry:',
        'test-store',
        expect.objectContaining({
          directError: expect.objectContaining({
            message: 'direct lookup failed',
            transient: false,
          }),
          firstError: expect.objectContaining({ transient: true }),
          retryError: expect.objectContaining({ transient: true }),
        })
      );
    });

    it('does not throw errors even when lookup fails twice', async () => {
      harness.mockMaybeSingle
        .mockRejectedValueOnce(new Error('Database timeout'))
        .mockRejectedValueOnce(new Error('Database timeout'));

      await expect(getMerchantSafe('test-store')).resolves.toBeNull();
    });

    it('redacts trust and legal fields for unpublished merchants', async () => {
      const merchantWithTrustFields = {
        ...mockMerchant,
        is_published: false,
        support_email: 'support@ogabassey.com',
        support_phone: '+2348000000000',
        business_address: '12 Allen Avenue, Ikeja, Lagos',
        legal_entity_name: 'Ogabassey Gadgets Ltd',
        registered_address: {
          street: '12 Allen Avenue',
          city: 'Ikeja',
          state: 'Lagos',
          country: 'Nigeria',
        },
        tax_identification_number: 'TIN-123',
        trust_profile: {
          founded_year: 2018,
        },
      };
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: merchantWithTrustFields,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(getMerchantSafe('test-store')).resolves.toMatchObject({
        business_address: '',
        support_email: '',
        support_phone: '',
        legal_entity_name: null,
        registered_address: null,
        tax_identification_number: null,
        trust_profile: null,
      });
    });

    it('sanitizes and truncates error identifiers', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      harness.mockMaybeSingle
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockRejectedValueOnce(new Error('Third failure'))
        .mockRejectedValueOnce(new Error('Fourth failure'));
      harness.mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await getMerchantSafe('test-store-123');
      await getMerchantSafe('a'.repeat(200));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Non-transient merchant lookup failed after retry:',
        'test-store-123',
        expect.any(Object)
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Non-transient merchant lookup failed after retry:',
        'a'.repeat(100),
        expect.any(Object)
      );
    });

    it('returns null for invalid identifiers without retry', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      await expect(getMerchantSafe('<script>')).resolves.toBeNull();
      expect(harness.mockMaybeSingle).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('getMerchantStrict', () => {
    it('throws the retry error when both non-PPR attempts fail', async () => {
      const firstError = new Error('First failure');
      const retryError = new Error('Second failure');
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      harness.mockMaybeSingle
        .mockRejectedValueOnce(firstError)
        .mockRejectedValueOnce(retryError);

      await expect(getMerchantStrict('test-store')).rejects.toBe(retryError);
      expect(mockUnstableRethrow).toHaveBeenCalledWith(firstError);
      expect(mockUnstableRethrow).toHaveBeenCalledWith(retryError);
      expect(harness.mockMaybeSingle).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Strict merchant lookup failed after retry:',
        'test-store'
      );
    });

    it('rethrows Next PPR control-flow errors without retrying', async () => {
      const pprError = Object.assign(
        new Error(
          'During prerendering, dynamic "use cache" rejects when the prerender is complete'
        ),
        { digest: 'HANGING_PROMISE_REJECTION' }
      );
      mockUnstableRethrow.mockImplementation((error: unknown) => {
        if (error === pprError) throw error;
      });
      harness.mockMaybeSingle.mockRejectedValueOnce(pprError);

      await expect(getMerchantStrict('test-store')).rejects.toBe(pprError);
      expect(mockUnstableRethrow).toHaveBeenCalledWith(pprError);
      expect(harness.mockMaybeSingle).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRequestScopedMerchant', () => {
    it('delegates to getMerchantSafe', async () => {
      const merchantWithTrustFields = {
        ...mockMerchant,
        support_email: 'support@ogabassey.com',
        support_phone: '+2348000000000',
        legal_entity_name: 'Ogabassey Gadgets Ltd',
        registered_address: {
          street: '12 Allen Avenue',
          city: 'Ikeja',
          state: 'Lagos',
          country: 'Nigeria',
        },
        tax_identification_number: 'TIN-123',
        trust_profile: {
          founded_year: 2018,
        },
      };
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: merchantWithTrustFields,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(getRequestScopedMerchant('test-store')).resolves.toEqual(
        withDefaultFeatureSettings(merchantWithTrustFields)
      );
    });

    it('returns null when getMerchantSafe returns null', async () => {
      harness.mockMaybeSingle
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'));

      await expect(getRequestScopedMerchant('test-store')).resolves.toBeNull();
    });

    it('handles invalid identifiers', async () => {
      await expect(getRequestScopedMerchant('')).resolves.toBeNull();
    });

    it('passes identifier to getMerchantSafe correctly', async () => {
      harness.mockRpc.mockResolvedValueOnce({
        data: [
          {
            custom_domain: 'shop.example.com',
            feature_settings: null,
            merchant_data: { ...mockMerchant },
          },
        ],
        error: null,
      });

      await expect(
        getRequestScopedMerchant('shop.example.com')
      ).resolves.toEqual(
        withDefaultFeatureSettings({
          ...mockMerchant,
          custom_domain: 'shop.example.com',
        })
      );
      expect(harness.mockRpc).toHaveBeenCalledWith(
        'resolve_storefront_cached_merchant',
        { p_identifier: 'shop.example.com' }
      );
    });
  });
});
