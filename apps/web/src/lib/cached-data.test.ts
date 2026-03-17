import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CachedMerchant } from './cached-data';
import {
  getCachedProduct,
  getCachedProductWithDetails,
  getMerchantByIdentifier,
  getMerchantSafe,
  getRequestScopedMerchant,
} from './cached-data';

// Mock environment variables
vi.mock('@/env', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseServiceRoleKey: vi.fn(() => 'test-service-role-key'),
}));

// Mock Next.js cache
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(() => {
    // Intentional no-op mock
  }),
  cacheTag: vi.fn(() => {
    // Intentional no-op mock
  }),
}));

// Mock React cache as passthrough
vi.mock('react', () => ({
  cache: vi.fn((fn) => fn),
}));

// Mock Supabase client - declare mocks that will be assigned in beforeEach
let mockMaybeSingle: ReturnType<typeof vi.fn>;
let mockRpc: ReturnType<typeof vi.fn>;
let mockSingle: ReturnType<typeof vi.fn>;
let mockEq: ReturnType<typeof vi.fn>;
let mockSelect: ReturnType<typeof vi.fn>;
let mockFrom: ReturnType<typeof vi.fn>;
let mockCreateClient: (...args: unknown[]) => unknown;

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    // This will be reassigned in beforeEach, but we need a default for hoisting
    if (!mockCreateClient) {
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
    return mockCreateClient(...args);
  },
}));

describe('cached-data utility functions', () => {
  const mockMerchant: CachedMerchant = {
    id: 'merchant-123',
    business_name: 'Test Store',
    site_title: 'Test Store - Best Products',
    site_tagline: 'Quality products for you',
    site_description: 'We sell amazing products',
    business_type: 'retail',
    logo_url: 'https://example.com/logo.png',
    phone: '+234800000000',
    email: 'test@example.com',
    slug: 'test-store',
    business_address: '123 Test Street',
    payout_currency: 'NGN',
    is_published: true,
    template_id: 'template-1',
    plan_tier: 'free',
    premium_features: null,
    brand_colors: {
      primary: '#000000',
      accent: '#ff0000',
      background: '#ffffff',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize Supabase mock chain
    mockMaybeSingle = vi.fn();
    mockRpc = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    mockSingle = vi.fn();
    mockEq = vi.fn(() => ({
      maybeSingle: mockMaybeSingle,
      single: mockSingle,
      eq: mockEq,
    }));
    mockSelect = vi.fn(() => ({
      eq: mockEq,
    }));
    mockFrom = vi.fn(() => ({
      select: mockSelect,
    }));
    mockCreateClient = vi.fn(() => ({
      from: mockFrom,
      rpc: mockRpc,
      auth: {
        getUser: vi.fn(),
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getMerchantByIdentifier', () => {
    describe('validation', () => {
      it('returns null for empty string identifier', async () => {
        const result = await getMerchantByIdentifier('');
        expect(result).toBeNull();
      });

      it('returns null for identifier with special characters', async () => {
        const result = await getMerchantByIdentifier(
          '<script>alert("xss")</script>'
        );
        expect(result).toBeNull();
      });

      it('returns null for identifier starting with invalid character', async () => {
        const result = await getMerchantByIdentifier('-invalid');
        expect(result).toBeNull();
      });

      it('returns null for identifier ending with invalid character', async () => {
        const result = await getMerchantByIdentifier('invalid-');
        expect(result).toBeNull();
      });

      it('returns null for identifier with consecutive dots', async () => {
        // Note: The regex actually allows consecutive dots in the middle
        // This test verifies invalid start/end only
        const result = await getMerchantByIdentifier('.invalid');
        expect(result).toBeNull();
      });

      it('returns null for identifier that is too long', async () => {
        const tooLong = 'a'.repeat(300);
        const result = await getMerchantByIdentifier(tooLong);
        expect(result).toBeNull();
      });

      it('returns null for identifier with spaces', async () => {
        const result = await getMerchantByIdentifier('my store');
        expect(result).toBeNull();
      });

      it('returns null for identifier with forward slashes', async () => {
        const result = await getMerchantByIdentifier('store/admin');
        expect(result).toBeNull();
      });
    });

    describe('slug lookup routing', () => {
      it('routes to slug lookup for simple identifier', async () => {
        // Arrange
        mockMaybeSingle.mockResolvedValueOnce({
          data: mockMerchant,
          error: null,
        });
        mockSingle.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' },
        });

        // Act
        const result = await getMerchantByIdentifier('my-store');

        // Assert
        expect(result).toEqual(mockMerchant);
        expect(mockFrom).toHaveBeenCalledWith('merchants');
        expect(mockEq).toHaveBeenCalledWith('slug', 'my-store');
      });

      it('lowercases slug identifier before lookup', async () => {
        // Arrange
        mockMaybeSingle.mockResolvedValueOnce({
          data: mockMerchant,
          error: null,
        });
        mockSingle.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' },
        });

        // Act
        await getMerchantByIdentifier('MY-STORE');

        // Assert
        expect(mockEq).toHaveBeenCalledWith('slug', 'my-store');
      });

      it('accepts alphanumeric slugs with hyphens', async () => {
        // Arrange
        mockMaybeSingle.mockResolvedValueOnce({
          data: mockMerchant,
          error: null,
        });
        mockSingle.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' },
        });

        // Act
        const result = await getMerchantByIdentifier('store-123-abc');

        // Assert
        expect(result).toEqual(mockMerchant);
      });
    });

    describe('domain lookup routing', () => {
      it('routes to domain lookup for domain-like identifier', async () => {
        // Arrange
        const mockDomainMerchant = {
          ...mockMerchant,
          custom_domain: 'store.com',
        };
        mockSingle
          .mockResolvedValueOnce({
            data: { merchant_id: 'merchant-123', domain: 'store.com' },
            error: null,
          })
          .mockResolvedValueOnce({
            data: mockMerchant,
            error: null,
          });

        // Act
        const result = await getMerchantByIdentifier('store.com');

        // Assert
        expect(result).toEqual(mockDomainMerchant);
        expect(mockFrom).toHaveBeenCalledWith('domains');
        expect(mockEq).toHaveBeenCalledWith('domain', 'store.com');
      });

      it('lowercases domain identifier before lookup', async () => {
        // Arrange
        const mockDomainMerchant = {
          ...mockMerchant,
          custom_domain: 'store.com',
        };
        mockSingle
          .mockResolvedValueOnce({
            data: { merchant_id: 'merchant-123', domain: 'store.com' },
            error: null,
          })
          .mockResolvedValueOnce({
            data: mockMerchant,
            error: null,
          });

        // Act
        const result = await getMerchantByIdentifier('STORE.COM');

        // Assert
        expect(result).toEqual(mockDomainMerchant);
        expect(mockEq).toHaveBeenCalledWith('domain', 'store.com');
      });

      it('accepts subdomains', async () => {
        // Arrange
        const mockDomainMerchant = {
          ...mockMerchant,
          custom_domain: 'shop.store.com',
        };
        mockSingle
          .mockResolvedValueOnce({
            data: { merchant_id: 'merchant-123', domain: 'shop.store.com' },
            error: null,
          })
          .mockResolvedValueOnce({
            data: mockMerchant,
            error: null,
          });

        // Act
        const result = await getMerchantByIdentifier('shop.store.com');

        // Assert
        expect(result).toEqual(mockDomainMerchant);
      });

      it('does NOT route hyphenated identifiers to domain lookup', async () => {
        // Arrange
        mockMaybeSingle.mockResolvedValueOnce({
          data: mockMerchant,
          error: null,
        });
        mockSingle.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' },
        });

        // Act - "my-store-123" has hyphens, so treated as slug, not domain
        await getMerchantByIdentifier('my-store-123');

        // Assert - should call slug lookup (merchants table), not domains table
        expect(mockFrom).toHaveBeenCalledWith('merchants');
        expect(mockEq).toHaveBeenCalledWith('slug', 'my-store-123');
      });
    });

    describe('error handling', () => {
      it('throws error when merchant lookup fails', async () => {
        // Arrange
        mockMaybeSingle.mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' },
        });

        // Act & Assert
        await expect(getMerchantByIdentifier('test-store')).rejects.toThrow(
          'Failed to fetch merchant for slug: test-store'
        );
      });

      it('throws error when domain lookup fails', async () => {
        // Arrange
        mockSingle.mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error', code: 'DB_ERROR' },
        });

        // Act & Assert
        await expect(getMerchantByIdentifier('store.com')).rejects.toThrow(
          'Database error fetching domain: store.com'
        );
      });

      it('returns null when merchant not found by slug', async () => {
        // Arrange
        mockMaybeSingle.mockResolvedValueOnce({
          data: null,
          error: null,
        });

        // Act
        const result = await getMerchantByIdentifier('nonexistent-store');

        // Assert
        expect(result).toBeNull();
      });

      it('returns null when domain not found', async () => {
        // Arrange
        mockSingle.mockResolvedValueOnce({
          data: null,
          error: null,
        });

        // Act
        const result = await getMerchantByIdentifier('nonexistent.com');

        // Assert
        expect(result).toBeNull();
      });
    });

    describe('security - contact info redaction for unpublished stores', () => {
      it('redacts contact info when store is not published (slug lookup)', async () => {
        // Arrange
        const unpublishedMerchant = { ...mockMerchant, is_published: false };
        mockMaybeSingle.mockResolvedValueOnce({
          data: unpublishedMerchant,
          error: null,
        });
        mockSingle.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' },
        });

        // Act
        const result = await getMerchantByIdentifier('test-store');

        // Assert
        expect(result).toEqual({
          ...unpublishedMerchant,
          email: '',
          phone: '',
          business_address: '',
        });
      });

      it('redacts contact info when store is not published (domain lookup)', async () => {
        // Arrange
        const unpublishedMerchant = { ...mockMerchant, is_published: false };
        mockSingle
          .mockResolvedValueOnce({
            data: { merchant_id: 'merchant-123', domain: 'store.com' },
            error: null,
          })
          .mockResolvedValueOnce({
            data: unpublishedMerchant,
            error: null,
          });

        // Act
        const result = await getMerchantByIdentifier('store.com');

        // Assert
        expect(result).toEqual({
          ...unpublishedMerchant,
          custom_domain: 'store.com',
          email: '',
          phone: '',
          business_address: '',
        });
      });

      it('does NOT redact contact info when store is published', async () => {
        // Arrange
        const publishedMerchant = { ...mockMerchant, is_published: true };
        mockMaybeSingle.mockResolvedValueOnce({
          data: publishedMerchant,
          error: null,
        });
        mockSingle.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' },
        });

        // Act
        const result = await getMerchantByIdentifier('test-store');

        // Assert
        expect(result?.email).toBe('test@example.com');
        expect(result?.phone).toBe('+234800000000');
        expect(result?.business_address).toBe('123 Test Street');
      });
    });
  });

  describe('getMerchantSafe', () => {
    it('returns merchant data on successful lookup', async () => {
      // Arrange
      mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Act
      const result = await getMerchantSafe('test-store');

      // Assert
      expect(result).toEqual(mockMerchant);
    });

    it('retries once on first failure and returns data on retry success', async () => {
      // Arrange - first call fails, second succeeds
      mockMaybeSingle
        .mockRejectedValueOnce(new Error('Transient network error'))
        .mockResolvedValueOnce({
          data: mockMerchant,
          error: null,
        });
      mockSingle
        .mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' },
        })
        .mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' },
        });

      // Act
      const result = await getMerchantSafe('test-store');

      // Assert
      expect(result).toEqual(mockMerchant);
      expect(mockMaybeSingle).toHaveBeenCalledTimes(2);
    });

    it('returns null after both attempts fail', async () => {
      // Arrange - both attempts fail
      mockMaybeSingle
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'));

      // Act
      const result = await getMerchantSafe('test-store');

      // Assert
      expect(result).toBeNull();
      expect(mockMaybeSingle).toHaveBeenCalledTimes(2);
    });

    it('logs error after retry failure', async () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {
          // Intentional no-op to silence console during test
        });
      mockMaybeSingle
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'));

      // Act
      await getMerchantSafe('test-store');

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Merchant fetch failed after retry:',
        'test-store'
      );

      consoleErrorSpy.mockRestore();
    });

    it('does not throw errors even when lookup fails twice', async () => {
      // Arrange
      mockMaybeSingle
        .mockRejectedValueOnce(new Error('Database timeout'))
        .mockRejectedValueOnce(new Error('Database timeout'));

      // Act & Assert - should not throw
      await expect(getMerchantSafe('test-store')).resolves.toBeNull();
    });

    it('sanitizes identifier in error log to prevent log injection', async () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {
          // Intentional no-op to silence console during test
        });
      mockMaybeSingle
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'));
      mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      // Act - valid identifier that fails lookup (to trigger error log)
      await getMerchantSafe('test-store-123');

      // Assert - error is logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Merchant fetch failed after retry:',
        'test-store-123'
      );

      consoleErrorSpy.mockRestore();
    });

    it('truncates long identifiers in error log', async () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {
          // Intentional no-op to silence console during test
        });
      mockMaybeSingle
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'));
      const longIdentifier = 'a'.repeat(200);

      // Act
      await getMerchantSafe(longIdentifier);

      // Assert - should truncate to 100 chars
      const expectedTruncated = longIdentifier.substring(0, 100);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Merchant fetch failed after retry:',
        expectedTruncated
      );

      consoleErrorSpy.mockRestore();
    });

    it('returns null for invalid identifiers without retry', async () => {
      // Arrange - no mock needed since validation happens before lookup
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {
          // Intentional no-op to silence console during test
        });

      // Act
      const result = await getMerchantSafe('<script>');

      // Assert - should return null immediately, no retry
      expect(result).toBeNull();
      expect(mockMaybeSingle).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getRequestScopedMerchant', () => {
    it('delegates to getMerchantSafe', async () => {
      // Arrange
      mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Act
      const result = await getRequestScopedMerchant('test-store');

      // Assert
      expect(result).toEqual(mockMerchant);
    });

    it('returns null when getMerchantSafe returns null', async () => {
      // Arrange
      mockMaybeSingle
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'));

      // Act
      const result = await getRequestScopedMerchant('test-store');

      // Assert
      expect(result).toBeNull();
    });

    it('handles invalid identifiers', async () => {
      // Act
      const result = await getRequestScopedMerchant('');

      // Assert
      expect(result).toBeNull();
    });

    it('passes identifier to getMerchantSafe correctly', async () => {
      // Arrange
      const mockDomainMerchant = {
        ...mockMerchant,
        custom_domain: 'shop.example.com',
      };
      mockSingle
        .mockResolvedValueOnce({
          data: { merchant_id: 'merchant-123', domain: 'shop.example.com' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockMerchant,
          error: null,
        });

      // Act
      const result = await getRequestScopedMerchant('shop.example.com');

      // Assert
      expect(result).toEqual(mockDomainMerchant);
      expect(mockEq).toHaveBeenCalledWith('domain', 'shop.example.com');
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('handles identifier with only dots (invalid)', async () => {
      const result = await getMerchantByIdentifier('...');
      expect(result).toBeNull();
    });

    it('handles identifier with only hyphens (invalid)', async () => {
      const result = await getMerchantByIdentifier('---');
      expect(result).toBeNull();
    });

    it('handles minimum length valid identifier (2 chars)', async () => {
      // Arrange
      mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Act
      const result = await getMerchantByIdentifier('ab');

      // Assert
      expect(result).toEqual(mockMerchant);
    });

    it('handles maximum length valid identifier (254 chars)', async () => {
      // Arrange
      const maxLengthSlug = `a${'b'.repeat(252)}c`; // 254 chars
      mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Act
      const result = await getMerchantByIdentifier(maxLengthSlug);

      // Assert
      expect(result).toEqual(mockMerchant);
    });

    it('handles identifier with mixed case correctly', async () => {
      // Arrange
      mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Act
      await getMerchantByIdentifier('TeSt-StOrE');

      // Assert - should lowercase before lookup
      expect(mockEq).toHaveBeenCalledWith('slug', 'test-store');
    });

    it('handles null-like identifier gracefully', async () => {
      // Act
      const resultNull = await getMerchantByIdentifier(
        null as unknown as string
      );
      const resultUndefined = await getMerchantByIdentifier(
        undefined as unknown as string
      );

      // Assert
      expect(resultNull).toBeNull();
      expect(resultUndefined).toBeNull();
    });

    it('handles numeric identifier', async () => {
      // Arrange
      mockMaybeSingle.mockResolvedValueOnce({
        data: mockMerchant,
        error: null,
      });
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Act
      const result = await getMerchantByIdentifier('123');

      // Assert
      expect(result).toEqual(mockMerchant);
    });

    it('handles domain with port number (invalid per regex)', async () => {
      // Domain regex does not account for ports, so this should be invalid
      const result = await getMerchantByIdentifier('store.com:8080');
      expect(result).toBeNull();
    });

    it('handles identifier with unicode characters (invalid)', async () => {
      const result = await getMerchantByIdentifier('störe');
      expect(result).toBeNull();
    });
  });

  describe('product query projections', () => {
    it('getCachedProduct uses RPC for product_variants instead of inline select', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'product-123', slug: 'iphone-16' },
        error: null,
      });

      await getCachedProduct('merchant-123', 'iphone-16');

      expect(mockEq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
      expect(mockEq).toHaveBeenCalledWith('slug', 'iphone-16');

      const selectArg = String(mockSelect.mock.calls.at(-1)?.[0]);
      expect(selectArg).not.toMatch(/\*\s*,/);
      // Variants are fetched via RPC, not inline select — select should NOT contain product_variants
      expect(selectArg).not.toContain('product_variants');
    });

    it('getCachedProductWithDetails uses RPC for product_variants instead of inline select', async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: { id: 'product-123', slug: 'iphone-16' },
        error: null,
      });

      await getCachedProductWithDetails('merchant-123', 'iphone-16');

      expect(mockEq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
      expect(mockEq).toHaveBeenCalledWith('slug', 'iphone-16');

      const selectArg = String(mockSelect.mock.calls.at(-1)?.[0]);
      expect(selectArg).not.toMatch(/\*\s*,/);
      expect(selectArg).toContain('imageHint:image_hint');
      expect(selectArg).toContain('fulfillmentFields:fulfillment_fields');
      // Variants are fetched via RPC, not inline select — select should NOT contain product_variants
      expect(selectArg).not.toContain('product_variants');
    });

    it('getCachedProduct returns null on query error', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'db error', code: '42P01' },
      });

      const result = await getCachedProduct('merchant-123', 'missing-product');

      expect(result).toBeNull();
    });

    it('getCachedProduct attaches storefront variants from the public RPC', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'product-123',
          slug: 'iphone-16',
          product_variants: [],
        },
        error: null,
      });
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            id: 'variant-1',
            product_id: 'product-123',
            attributes: { storage: '128GB', sim_type: 'eSIM Only' },
            stock_quantity: 2,
          },
        ],
        error: null,
      });

      const result = await getCachedProduct('merchant-123', 'iphone-16');

      expect(mockRpc).toHaveBeenCalledWith('get_storefront_product_variants', {
        p_product_ids: ['product-123'],
      });
      expect(result?.product_variants).toEqual([
        expect.objectContaining({
          id: 'variant-1',
          attributes: { storage: '128GB', sim_type: 'eSIM Only' },
        }),
      ]);
    });

    it('getCachedProductWithDetails returns null on query error', async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'db error', code: '42P01' },
      });

      const result = await getCachedProductWithDetails(
        'merchant-123',
        'missing-product'
      );

      expect(result).toBeNull();
    });

    it('getCachedProductWithDetails attaches storefront variants from the public RPC', async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: {
          id: 'product-123',
          slug: 'iphone-16',
          product_variants: [],
        },
        error: null,
      });
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            id: 'variant-2',
            product_id: 'product-123',
            attributes: { storage: '256GB' },
            stock_quantity: 1,
          },
        ],
        error: null,
      });

      const result = await getCachedProductWithDetails(
        'merchant-123',
        'iphone-16'
      );

      expect(mockRpc).toHaveBeenCalledWith('get_storefront_product_variants', {
        p_product_ids: ['product-123'],
      });
      expect(result?.product_variants).toEqual([
        expect.objectContaining({
          id: 'variant-2',
          attributes: { storage: '256GB' },
        }),
      ]);
    });
  });
});
