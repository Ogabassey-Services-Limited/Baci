import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks — vi.hoisted ensures variables exist before vi.mock hoisting */
/* ------------------------------------------------------------------ */

const {
  mockMaybeSingle,
  mockUpsert,
  mockSupabase,
  mockForIntegration,
  mockCreateProduct,
} = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockUpsert = vi.fn();
  const mockSupabase = {
    from: vi.fn((table: string) => {
      if (table === 'products') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
          }),
        };
      }
      if (table === 'jumia_product_mappings') {
        return { upsert: (...a: unknown[]) => mockUpsert(...a) };
      }
      return {};
    }),
  };
  const mockForIntegration = vi.fn();
  const mockCreateProduct = vi.fn();
  return {
    mockMaybeSingle,
    mockUpsert,
    mockSupabase,
    mockForIntegration,
    mockCreateProduct,
  };
});

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn().mockResolvedValue({
    user: { id: 'u1' },
    error: null,
    supabase: mockSupabase,
  }),
  getMerchantIdForApiUser: vi
    .fn()
    .mockResolvedValue('00000000-0000-4000-8000-000000000001'),
}));

vi.mock('@/lib/jumia/feeds', () => ({
  createProduct: (...a: unknown[]) => mockCreateProduct(...a),
}));

vi.mock('@/lib/jumia/client', () => ({
  JumiaClient: {
    forIntegration: (...a: unknown[]) => mockForIntegration(...a),
  },
}));

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/sanitize-core', () => ({
  sanitizeText: (v: string) => v,
  stripHtmlTags: (v: string) => v,
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const INT_ID = '00000000-0000-4000-8000-000000000099';

const VALID_BODY = {
  integrationId: INT_ID,
  name: 'Test Product',
  brand: { code: 1, name: 'BrandX' },
  category: { code: 42 },
  variations: [{ sellerSku: 'SKU-1', price: 5000, currency: 'NGN' }],
};

function makePostRequest(body: unknown) {
  return new NextRequest(
    'http://localhost/api/marketplace/jumia/products/export',
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

import { POST } from './route';

describe('Products Export POST', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 on CSRF failure', async () => {
    const { checkCsrfProtection } = await import('@/lib/csrf');
    (checkCsrfProtection as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      valid: false,
      response: null,
    });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    const { authenticateApiRequest } = await import('@/lib/api-auth');
    (authenticateApiRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid Zod input', async () => {
    const res = await POST(makePostRequest({ integrationId: 'bad' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid input');
  });

  it('returns matching status when JumiaApiError is thrown', async () => {
    const { JumiaApiError } = await import('@/lib/jumia/helpers');
    mockForIntegration.mockRejectedValue(
      new JumiaApiError(404, 'Integration not found')
    );
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('returns 502 when unknown non-expired error during integration init', async () => {
    mockForIntegration.mockRejectedValue(new Error('unexpected'));
    const res = await POST(makePostRequest(VALID_BODY));
    // The route catch block returns 502 for generic errors that don't match
    // "expired"/"unauthorized" (401) or "not found" (404) patterns.
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('returns 200 on successful feed creation', async () => {
    mockForIntegration.mockResolvedValue({ shopId: 'shop1' });
    mockCreateProduct.mockResolvedValue('feed-abc');
    mockMaybeSingle.mockResolvedValue({ data: { id: 'prod-1' }, error: null });
    mockUpsert.mockResolvedValue({ error: null });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.feedId).toBe('feed-abc');
    // Verify CSRF and auth middleware were invoked
    const { checkCsrfProtection } = await import('@/lib/csrf');
    const { authenticateApiRequest } = await import('@/lib/api-auth');
    expect(checkCsrfProtection).toHaveBeenCalled();
    expect(authenticateApiRequest).toHaveBeenCalled();
    expect(mockForIntegration).toHaveBeenCalledWith(
      expect.anything(),
      '00000000-0000-4000-8000-000000000001',
      INT_ID
    );
    expect(mockCreateProduct).toHaveBeenCalledWith(
      expect.objectContaining({ shopId: 'shop1' }),
      'shop1',
      expect.arrayContaining([
        expect.objectContaining({
          name: expect.objectContaining({ value: 'Test Product' }),
        }),
      ])
    );
  });

  it('returns 500 when createProduct fails', async () => {
    mockForIntegration.mockResolvedValue({ shopId: 'shop1' });
    mockCreateProduct.mockRejectedValue(new Error('Feed creation failed'));
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('returns 200 when product lookup returns no match (null data, no error)', async () => {
    mockForIntegration.mockResolvedValue({ shopId: 'shop1' });
    mockCreateProduct.mockResolvedValue('feed-xyz');
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.feedId).toBe('feed-xyz');
    // Upsert should NOT be called when there is no matching product
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns 200 with lookupFailed flag when product lookup errors', async () => {
    mockForIntegration.mockResolvedValue({ shopId: 'shop1' });
    mockCreateProduct.mockResolvedValue('feed-err');
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'DB connection lost' },
    });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.lookupFailed).toBe(true);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns 207 when mapping upsert fails', async () => {
    mockForIntegration.mockResolvedValue({ shopId: 'shop1' });
    mockCreateProduct.mockResolvedValue('feed-abc');
    mockMaybeSingle.mockResolvedValue({ data: { id: 'prod-1' }, error: null });
    mockUpsert.mockResolvedValue({ error: { message: 'upsert fail' } });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(207);
    const json = await res.json();
    expect(json.partial).toBe(true);
    expect(json.feedId).toBe('feed-abc');
  });
});
