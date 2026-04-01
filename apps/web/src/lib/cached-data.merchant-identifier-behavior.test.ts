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
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error', code: 'DB_ERROR' },
      });

      await expect(getMerchantByIdentifier('store.com')).rejects.toThrow(
        'Database error fetching domain: store.com'
      );
    });

    it('logs warning for transient domain lookup timeouts before throwing', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: null,
        error: {
          message: 'TimeoutError: The operation was aborted due to timeout',
          details:
            'TimeoutError: The operation was aborted due to timeout at undici',
        },
      });

      await expect(getMerchantByIdentifier('store.com')).rejects.toThrow(
        'Database error fetching domain: store.com'
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith('Error fetching domain', {
        domain: 'store.com',
        error: {
          message: 'TimeoutError: The operation was aborted due to timeout',
          details:
            'TimeoutError: The operation was aborted due to timeout at undici',
        },
      });
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
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: null,
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

      await expect(getMerchantByIdentifier('test-store')).resolves.toEqual({
        ...unpublishedMerchant,
        email: '',
        phone: '',
        business_address: '',
      });
    });

    it('redacts contact info when store is not published (domain lookup)', async () => {
      const unpublishedMerchant = { ...mockMerchant, is_published: false };
      harness.mockMaybeSingle.mockResolvedValueOnce({
        data: { merchant_id: 'merchant-123', domain: 'store.com' },
        error: null,
      });
      harness.mockSingle.mockResolvedValueOnce({
        data: unpublishedMerchant,
        error: null,
      });

      await expect(getMerchantByIdentifier('store.com')).resolves.toEqual({
        ...unpublishedMerchant,
        custom_domain: 'store.com',
        email: '',
        phone: '',
        business_address: '',
      });
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
        mockMerchant
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
      ).resolves.toEqual(mockMerchant);
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
        mockMerchant
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
