import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantSafe, getRequestScopedMerchant } from '@/lib/cached-data';
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

describe('cached-data merchant safety helpers', () => {
  describe('getMerchantSafe', () => {
    it('returns merchant data on successful lookup', async () => {
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(getMerchantSafe('test-store')).resolves.toEqual(
        mockMerchant
      );
    });

    it('retries once on first failure and returns data on retry success', async () => {
      harness.mockMaybeSingle
        .mockRejectedValueOnce(new Error('Transient network error'))
        .mockResolvedValueOnce({ data: mockMerchant, error: null });
      harness.mockSingle
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      await expect(getMerchantSafe('test-store')).resolves.toEqual(
        mockMerchant
      );
      expect(harness.mockMaybeSingle).toHaveBeenCalledTimes(2);
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
        'Merchant fetch failed after retry:',
        'test-store'
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

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Merchant fetch failed after retry:',
        'test-store'
      );
    });

    it('does not throw errors even when lookup fails twice', async () => {
      harness.mockMaybeSingle
        .mockRejectedValueOnce(new Error('Database timeout'))
        .mockRejectedValueOnce(new Error('Database timeout'));

      await expect(getMerchantSafe('test-store')).resolves.toBeNull();
    });

    it('sanitizes and truncates error identifiers', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      harness.mockMaybeSingle
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'));
      harness.mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await getMerchantSafe('test-store-123');
      await getMerchantSafe('a'.repeat(200));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Merchant fetch failed after retry:',
        'test-store-123'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Merchant fetch failed after retry:',
        'a'.repeat(100)
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

  describe('getRequestScopedMerchant', () => {
    it('delegates to getMerchantSafe', async () => {
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(getRequestScopedMerchant('test-store')).resolves.toEqual(
        mockMerchant
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
      harness.mockSingle
        .mockResolvedValueOnce({
          data: { merchant_id: 'merchant-123', domain: 'shop.example.com' },
          error: null,
        })
        .mockResolvedValueOnce({ data: mockMerchant, error: null });

      await expect(
        getRequestScopedMerchant('shop.example.com')
      ).resolves.toEqual({
        ...mockMerchant,
        custom_domain: 'shop.example.com',
      });
      expect(harness.mockEq).toHaveBeenCalledWith('domain', 'shop.example.com');
    });
  });
});
