import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import handlers. We need to use require or dynamic import if we want to spy on them?
// No, we test the handlers directly.
import { GET as searchGET } from './route';
import { GET as autocompleteGET } from './autocomplete/route';

// Mock env
vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://mock.supabase.co',
  getSupabaseAnonKey: () => 'mock-key',
  getSupabaseServiceRoleKey: () => 'mock-service-key',
  getRootDomain: () => 'localhost:3000',
}));

// Shared mock for chainable methods
const sharedChainableMock: any = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({
    data: {
      id: 'merchant-id',
      business_name: 'Test Merchant',
      country: 'NG',
    },
    error: null,
  }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
  insert: vi.fn().mockResolvedValue({ error: null }),
  then: (resolve: any) => Promise.resolve().then(resolve),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
};

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    }),
  },
  from: vi.fn(() => sharedChainableMock),
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
  }),
}));

describe('Search API Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset shared mock implementation if needed, but simple clearAllMocks should clear calls.
  });

  describe('GET /api/search', () => {
    it('should sanitize search query before passing to rpc and insert', async () => {
      const maliciousQuery = '<script>alert(1)</script>';
      const merchantId = '123e4567-e89b-12d3-a456-426614174000';

      const request = new NextRequest(
        `http://localhost:3000/api/search?q=${encodeURIComponent(
          maliciousQuery
        )}&merchant_id=${merchantId}&limit=10`
      );

      await searchGET(request);

      // Verify RPC call
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'smart_product_search',
        expect.objectContaining({
          search_query: expect.not.stringContaining('<script>'),
        })
      );

      // Verify insert call (Stored XSS prevention)
      // We expect the query to be sanitized (stripped of HTML tags)
      expect(sharedChainableMock.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          search_query: expect.not.stringContaining('<script>'),
        })
      );
    });

    it('should validate merchant_id UUID', async () => {
      const invalidMerchantId = 'not-a-uuid';
      const request = new NextRequest(
        `http://localhost:3000/api/search?q=test&merchant_id=${invalidMerchantId}`
      );

      const response = await searchGET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/Invalid merchant_id/);
    });
  });

  describe('GET /api/search/autocomplete', () => {
    it('should sanitize search query and escape LIKE pattern', async () => {
      const maliciousQuery = '100%';
      const merchantId = '123e4567-e89b-12d3-a456-426614174000';

      const request = new NextRequest(
        `http://localhost:3000/api/search/autocomplete?q=${encodeURIComponent(
          maliciousQuery
        )}&merchant_id=${merchantId}`
      );

      await autocompleteGET(request);

      // Verify ilike call
      // If sanitized, "100%" becomes "100\%" (via sanitizeLikePattern)
      // Then `%${query}%` becomes `%100\%%`
      // We check that % is escaped in the middle part

      // Note: sanitizeLikePattern relies on implementation.
      // If sanitizeSearchQuery is applied first, it doesn't strip %.
      // sanitizeLikePattern escapes %.

      expect(sharedChainableMock.ilike).toHaveBeenCalledWith(
        'search_query',
        expect.stringMatching(/%100\\%%/) // Expect backslash before %
      );
    });

    it('should validate merchant_id UUID', async () => {
        const invalidMerchantId = 'not-a-uuid';
        const request = new NextRequest(
            `http://localhost:3000/api/search/autocomplete?q=test&merchant_id=${invalidMerchantId}`
        );

        const response = await autocompleteGET(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toMatch(/Invalid merchant_id/);
    });
  });
});
