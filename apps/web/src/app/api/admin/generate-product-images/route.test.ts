import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCheckCsrfProtection,
  mockCheckRateLimit,
  mockCookies,
  mockFrom,
  mockGenerateText,
  mockGetMerchantForApiRequest,
  mockGetPublicUrl,
  mockGetUser,
  mockRevalidateProductSlugs,
  mockRevalidateProducts,
  mockStorageFrom,
  mockUpload,
} = vi.hoisted(() => ({
  mockCheckCsrfProtection: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockCookies: vi.fn(),
  mockFrom: vi.fn(),
  mockGenerateText: vi.fn(),
  mockGetMerchantForApiRequest: vi.fn(),
  mockGetPublicUrl: vi.fn(),
  mockGetUser: vi.fn(),
  mockRevalidateProductSlugs: vi.fn(),
  mockRevalidateProducts: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockUpload: vi.fn(),
}));
vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));
vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));
vi.mock('@/ai/provider', () => ({
  activeImageModel: 'mock-image-model',
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mockCheckCsrfProtection,
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mockGetMerchantForApiRequest,
}));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mockCheckRateLimit,
}));
vi.mock('@/lib/product-cache-revalidation', () => ({
  productCacheRevalidation: {
    revalidateProducts: (...args: unknown[]) => mockRevalidateProducts(...args),
    revalidateProductSlugs: (...args: unknown[]) =>
      mockRevalidateProductSlugs(...args),
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    storage: { from: mockStorageFrom },
  })),
}));

import { POST } from './route';

const MERCHANT_ID = 'merchant-1';
const USER_ID = 'user-1';

function createRequest(
  url = 'https://usebaci.com/api/admin/generate-product-images'
) {
  return new NextRequest(url, { method: 'POST' });
}

function createEqChain<T>(result: T) {
  return {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

function createProductsQuery(result: unknown) {
  return {
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

function mockSupabaseTables({
  admin = true,
  products = [],
  productsError = null,
  updateError = null,
}: {
  admin?: boolean;
  products?: Record<string, unknown>[];
  productsError?: unknown;
  updateError?: unknown;
} = {}) {
  const merchantsChain = {
    select: vi.fn(() => createEqChain({ data: { is_platform_admin: admin } })),
  };

  const productsQuery = createProductsQuery({
    data: products,
    error: productsError,
  });
  const updateEq = vi.fn();
  const updateChain = {
    eq: updateEq,
  };
  updateEq.mockReturnValueOnce(updateChain).mockResolvedValueOnce({
    error: updateError,
  });

  const productsTable = {
    select: vi.fn(() => productsQuery),
    update: vi.fn(() => updateChain),
  };

  mockFrom.mockImplementation((table: string) => {
    if (table === 'merchants') return merchantsChain;
    if (table === 'products') return productsTable;
    throw new Error(`Unexpected table: ${table}`);
  });

  return { merchantsChain, productsQuery, productsTable, updateChain };
}

describe('POST /api/admin/generate-product-images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockCookies.mockResolvedValue({});
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: MERCHANT_ID,
      merchantSlug: 'test-store',
      staffAccess: { isStaff: false },
    });
    mockCheckRateLimit.mockResolvedValue(true);
    mockStorageFrom.mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    });
    mockUpload.mockResolvedValue({
      data: { path: 'product-1/gen.png' },
      error: null,
    });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://cdn.usebaci.com/product-1/gen.png' },
    });
    mockGenerateText.mockResolvedValue({
      response: {
        body: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      data: Buffer.from('fake-image').toString('base64'),
                      mimeType: 'image/png',
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    });
  });

  it('rejects invalid CSRF tokens before auth or database work', async () => {
    mockCheckCsrfProtection.mockResolvedValue({ valid: false, response: null });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'CSRF validation failed' });
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns 401 when the user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('rejects staff members even when they belong to a merchant', async () => {
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: MERCHANT_ID,
      staffAccess: { isStaff: true },
    });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Permission denied' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('requires the merchant owner to be a platform admin', async () => {
    mockSupabaseTables({ admin: false });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Forbidden' });
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it('enforces the per-user AI image generation rate limit', async () => {
    mockSupabaseTables({ admin: true });
    mockCheckRateLimit.mockResolvedValue(false);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: 'Rate limit exceeded',
      code: 'rate_limited',
    });
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('generates and appends an image for eligible parent variants', async () => {
    const { productsQuery, productsTable } = mockSupabaseTables({
      products: [
        {
          id: 'product-1',
          name: 'Baci Phone',
          color: 'blue',
          images: [],
          parent_product_id: 'parent-1',
          slug: 'baci-phone',
          category: 'Phones',
        },
      ],
    });

    const response = await POST(
      createRequest(
        'https://usebaci.com/api/admin/generate-product-images?parent_product_id=parent-1'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      processed_count: 1,
      processed: [
        {
          id: 'product-1',
          name: 'Baci Phone',
          new_image: 'https://cdn.usebaci.com/product-1/gen.png',
        },
      ],
      errors: [],
    });
    expect(productsQuery.eq).toHaveBeenCalledWith(
      'parent_product_id',
      'parent-1'
    );
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-image-model',
        providerOptions: { google: { responseModalities: ['IMAGE'] } },
      })
    );
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^product-1\/gen_\d+\.png$/),
      expect.any(Buffer),
      { contentType: 'image/png', upsert: false }
    );
    expect(productsTable.update).toHaveBeenCalledWith({
      images: ['https://cdn.usebaci.com/product-1/gen.png'],
    });
    expect(mockRevalidateProducts).toHaveBeenCalledWith(
      MERCHANT_ID,
      undefined,
      { feedScope: 'merchant' }
    );
    expect(mockRevalidateProductSlugs).toHaveBeenCalledWith(MERCHANT_ID, [
      'baci-phone',
    ]);
  });

  it('returns a no-op message when no products are eligible', async () => {
    mockSupabaseTables({
      products: [
        {
          id: 'product-1',
          name: 'Complete Gallery',
          color: null,
          images: ['1.png', '2.png', '3.png', '4.png'],
          parent_product_id: null,
        },
      ],
    });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      message: 'No eligible products found needing images.',
    });
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('returns 500 when the products query fails', async () => {
    mockSupabaseTables({
      admin: true,
      productsError: { message: 'products query failed' },
    });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'products query failed' });
    expect(mockGenerateText).not.toHaveBeenCalled();
  });
});
