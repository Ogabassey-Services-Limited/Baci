import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: vi.fn().mockReturnValue(true),
}));

const merchantMock = { context: null as unknown };
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(() => Promise.resolve(merchantMock.context)),
  toUserAccess: vi.fn().mockReturnValue({
    merchantId: 'merchant-123',
    role: 'owner',
    isOwner: true,
    isStaff: false,
    permissions: { full_access: { all: true } },
  }),
}));

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateProducts: vi.fn(),
}));

let csrfValid = true;
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({
      valid: csrfValid,
      response: csrfValid
        ? null
        : new Response(JSON.stringify({ error: 'CSRF validation failed' }), {
            status: 403,
          }),
    })
  ),
}));

vi.mock('@/lib/embeddings', () => ({
  getProductEmbeddingText: vi.fn().mockReturnValue('product text'),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeHtml: (str: string) => str,
}));

vi.mock('@/lib/sanitize-core', () => ({
  sanitizeText: (str: string) => str,
  sanitizeSchemaMarkup: (obj: Record<string, unknown>) => obj,
}));

vi.mock('@/lib/seo-utils', () => ({
  generateMetaDescription: (str: string) => `${str.substring(0, 50)}...`,
  generateProductSchema: () => ({ '@type': 'Product' }),
  generateProductSlug: (name: string) => name.toLowerCase().replace(/\s/g, '-'),
  generateSlug: (name: string) => name.toLowerCase().replace(/\s/g, '-'),
}));

vi.mock('@/lib/countries', () => ({
  getCountryByCode: (code: string) => ({
    code,
    name: 'Test Country',
    currency: 'NGN',
  }),
}));

vi.mock('@/schemas/products', () => ({
  updateProductSchema: {
    safeParse: (data: Record<string, unknown>) => {
      if (data.price && typeof data.price === 'number' && data.price < 0) {
        return {
          success: false,
          error: {
            errors: [{ path: ['price'], message: 'Must be positive' }],
          },
        };
      }
      return { success: true, data };
    },
  },
  formatZodErrors: (error: { errors: { path: string[]; message: string }[] }) =>
    error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
}));

// Supabase mock
const MERCHANT_ID = 'merchant-123';
const USER_ID = 'user-123';
const PRODUCT_ID = 'product-456';

let authUser: unknown = { id: USER_ID };
let merchant: unknown = {
  id: MERCHANT_ID,
  business_name: 'Test Store',
  country: 'NG',
};
let product: unknown = null;
let productError: unknown = null;
let variants: unknown[] = [];
let updateResult: unknown = null;
let updateError: unknown = null;
let deleteError: unknown = null;
let variantInsertError: unknown = null;
let variantUpsertError: unknown = null;
let lastProductUpdatePayload: unknown = null;

const createMockSupabase = () => ({
  auth: {
    getUser: vi.fn(() => {
      if (authUser === undefined) {
        return Promise.reject(new Error('Unexpected error'));
      }
      return Promise.resolve({
        data: { user: authUser },
        error: authUser ? null : { message: 'Not authenticated' },
      });
    }),
  },
  from: vi.fn((table: string) => {
    if (table === 'merchants') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(() =>
          Promise.resolve({
            data: merchant,
            error: null,
          })
        ),
        single: vi.fn(() =>
          Promise.resolve({
            data: merchant,
            error: merchant ? null : { message: 'Not found' },
          })
        ),
      };
    }
    if (table === 'products') {
      let eqCallCount = 0;
      const deleteChain: { eq: ReturnType<typeof vi.fn> } = {
        eq: vi.fn((): unknown => {
          eqCallCount++;
          if (eqCallCount >= 2) {
            return Promise.resolve({ error: deleteError });
          }
          return deleteChain;
        }),
      };

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(() =>
          Promise.resolve({
            data: productError ? null : product,
            error: productError,
          })
        ),
        update: vi.fn((payload: unknown) => {
          lastProductUpdatePayload = payload;
          return {
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(() =>
                    Promise.resolve({
                      data: updateError ? null : updateResult,
                      error: updateError,
                    })
                  ),
                })),
              })),
            })),
          };
        }),
        delete: vi.fn(() => {
          eqCallCount = 0; // Reset counter
          return deleteChain;
        }),
      };
    }
    if (table === 'product_variants') {
      const variantSelectChain = {
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            returns: vi.fn(() =>
              Promise.resolve({
                data: variants,
                error: null,
              })
            ),
          })),
        })),
      };
      return {
        select: vi.fn(() => variantSelectChain),
        eq: vi.fn(() => variantSelectChain),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              not: vi.fn(() =>
                Promise.resolve({
                  error: null,
                })
              ),
            })),
          })),
        })),
        upsert: vi.fn(() =>
          Promise.resolve({
            error: variantUpsertError,
          })
        ),
        insert: vi.fn(() =>
          Promise.resolve({
            error: variantInsertError,
          })
        ),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };
  }),
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createMockSupabase(),
}));

// Mock global fetch for embeddings
global.fetch = vi.fn().mockResolvedValue({ ok: true });

// ---- Import handlers AFTER mocks ----
import { DELETE, GET, PUT } from './route';

// ---- Helpers ----

const validUpdateBody = {
  name: 'Updated Product',
  price: 6000,
};

function makeGetRequest(id: string) {
  return new NextRequest(`http://localhost:3000/api/products/${id}`, {
    method: 'GET',
  });
}

function makePutRequest(id: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost:3000/api/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(id: string) {
  return new NextRequest(`http://localhost:3000/api/products/${id}`, {
    method: 'DELETE',
  });
}

function resetMocks() {
  authUser = { id: USER_ID };
  merchant = {
    id: MERCHANT_ID,
    business_name: 'Test Store',
    country: 'NG',
  };
  merchantMock.context = {
    merchantId: MERCHANT_ID,
    merchantSlug: 'test-store',
    businessName: 'Test Store',
    staffAccess: {
      isStaff: false,
      isOwner: true,
      role: null,
      permissions: { full_access: { all: true } },
    },
  };
  product = {
    id: PRODUCT_ID,
    name: 'Test Product',
    price: '5000',
    stock_quantity: 100,
    has_variants: false,
  };
  productError = null;
  variants = [];
  updateResult = null;
  updateError = null;
  deleteError = null;
  variantInsertError = null;
  variantUpsertError = null;
  lastProductUpdatePayload = null;
  csrfValid = true;
}

// ---- Tests ----

describe('GET /api/products/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      authUser = null;

      const res = await GET(makeGetRequest(PRODUCT_ID), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });
  });

  describe('merchant lookup', () => {
    it('returns 404 when merchant not found', async () => {
      merchantMock.context = null;

      const res = await GET(makeGetRequest(PRODUCT_ID), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });
  });

  describe('product lookup', () => {
    it('returns 404 when product not found', async () => {
      product = null;
      productError = { message: 'Not found' };

      const res = await GET(makeGetRequest(PRODUCT_ID), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Product not found');
    });
  });

  describe('success', () => {
    it('returns product by UUID', async () => {
      product = {
        id: PRODUCT_ID,
        name: 'Test Product',
        description: 'A great product',
        price: '5000',
        stock_quantity: 100,
        status: 'active',
        manage_stock: true,
        has_variants: false,
        images: [{ url: 'https://example.com/image.png' }],
        category: 'Electronics',
        sku: 'SKU-001',
        slug: 'test-product',
      };

      const res = await GET(makeGetRequest(PRODUCT_ID), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.product).toBeDefined();
      expect(json.product.name).toBe('Test Product');
      expect(json.product.id).toBe(PRODUCT_ID);
    });

    it('returns product by slug', async () => {
      const slug = 'test-product-slug';
      product = {
        id: PRODUCT_ID,
        name: 'Test Product',
        slug: slug,
        price: '5000',
        stock_quantity: 100,
        has_variants: false,
      };

      const res = await GET(makeGetRequest(slug), {
        params: Promise.resolve({ id: slug }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.product.slug).toBe(slug);
    });

    it('returns product with variants', async () => {
      product = {
        id: PRODUCT_ID,
        name: 'Test Product',
        has_variants: true,
        price: '5000',
      };

      variants = [
        {
          id: 'variant-1',
          product_id: PRODUCT_ID,
          merchant_id: MERCHANT_ID,
          attributes: { size: 'M', color: 'Red' },
          price_override: 5000,
          stock_quantity: 10,
          sku: 'SKU-M-RED',
        },
      ];

      const res = await GET(makeGetRequest(PRODUCT_ID), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.product.has_variants).toBe(true);
      expect(json.product.variants).toHaveLength(1);
      expect(json.product.variants[0].sku).toBe('SKU-M-RED');
    });
  });

  describe('error handling', () => {
    it('returns 500 on unexpected error', async () => {
      authUser = undefined;

      const res = await GET(makeGetRequest(PRODUCT_ID), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});

describe('PUT /api/products/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      authUser = null;

      const res = await PUT(makePutRequest(PRODUCT_ID, validUpdateBody), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });
  });

  describe('CSRF protection', () => {
    it('returns 403 when CSRF check fails', async () => {
      csrfValid = false;

      const res = await PUT(makePutRequest(PRODUCT_ID, validUpdateBody), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('CSRF validation failed');
    });
  });

  describe('validation', () => {
    it('returns 400 when price is negative', async () => {
      const res = await PUT(makePutRequest(PRODUCT_ID, { price: -100 }), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Validation failed');
    });

    it('rejects sku_matrix updates when a variant lacks condition', async () => {
      product = {
        id: PRODUCT_ID,
        name: 'Product',
        condition: 'new',
        has_variants: true,
        variant_model: 'legacy',
      };

      const res = await PUT(
        makePutRequest(PRODUCT_ID, {
          has_variants: true,
          variant_model: 'sku_matrix',
          variants: [
            {
              price_override: 7000,
              stock_quantity: 5,
            },
          ],
        }),
        {
          params: Promise.resolve({ id: PRODUCT_ID }),
        }
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe(
        'Every sku_matrix variant must include a condition.'
      );
      expect(lastProductUpdatePayload).toBeNull();
    });
  });

  describe('product lookup', () => {
    it('returns 404 when product not found', async () => {
      product = null;
      productError = { message: 'Not found' };

      const res = await PUT(makePutRequest(PRODUCT_ID, validUpdateBody), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Product not found');
    });
  });

  describe('success', () => {
    it('updates product successfully', async () => {
      product = {
        id: PRODUCT_ID,
        name: 'Old Name',
        description: 'Old description',
        condition: 'new',
      };

      updateResult = {
        id: PRODUCT_ID,
        name: 'Updated Product',
        price: '6000',
        slug: 'updated-product',
      };

      const res = await PUT(makePutRequest(PRODUCT_ID, validUpdateBody), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.product).toBeDefined();
      expect(json.product.name).toBe('Updated Product');
    });

    it('preserves explicit images when single-image fields are also provided', async () => {
      product = {
        id: PRODUCT_ID,
        name: 'Old Name',
        description: 'Old description',
        condition: 'new',
      };

      updateResult = {
        id: PRODUCT_ID,
        name: 'Updated Product',
        price: '6000',
        slug: 'updated-product',
      };

      const explicitImages = [
        {
          url: 'https://cdn.example.com/products/explicit.jpg',
          alt: 'Explicit image',
          order: 0,
        },
      ];

      const res = await PUT(
        makePutRequest(PRODUCT_ID, {
          ...validUpdateBody,
          images: explicitImages,
          image: 'https://cdn.example.com/products/legacy-small.jpg',
          imageLarge: 'https://cdn.example.com/products/legacy-large.jpg',
        }),
        {
          params: Promise.resolve({ id: PRODUCT_ID }),
        }
      );
      await res.json();

      expect(res.status).toBe(200);
      expect(lastProductUpdatePayload).toEqual(
        expect.objectContaining({
          images: explicitImages,
        })
      );
      // When an explicit images array is supplied, legacy single-image fields
      // must NOT be forwarded to the update payload.
      expect(lastProductUpdatePayload).not.toHaveProperty('image');
      expect(lastProductUpdatePayload).not.toHaveProperty('imageLarge');
    });

    it('updates product with variants', async () => {
      product = {
        id: PRODUCT_ID,
        name: 'Product',
        condition: 'new',
      };

      updateResult = {
        id: PRODUCT_ID,
        has_variants: true,
      };

      const bodyWithVariants = {
        has_variants: true,
        variants: [
          {
            id: 'variant-1',
            attributes: { size: 'L' },
            price: 7000,
            stock_quantity: 5,
            sku: 'SKU-L',
          },
        ],
      };

      const res = await PUT(makePutRequest(PRODUCT_ID, bodyWithVariants), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      await res.json();

      expect(res.status).toBe(200);
    });

    it('does not mark a product as migrated when variant sync fails', async () => {
      product = {
        id: PRODUCT_ID,
        name: 'Product',
        slug: 'product',
        condition: 'new',
        has_variants: true,
        variant_model: 'legacy',
      };

      updateResult = {
        id: PRODUCT_ID,
        slug: 'product',
        name: 'Product',
      };
      variantInsertError = { message: 'insert failed' };

      const res = await PUT(
        makePutRequest(PRODUCT_ID, {
          has_variants: true,
          variant_model: 'sku_matrix',
          variants: [
            {
              attributes: { storage: '128GB' },
              condition: 'used',
              price_override: 7000,
              stock_quantity: 5,
            },
          ],
        }),
        {
          params: Promise.resolve({ id: PRODUCT_ID }),
        }
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to create product variants');
      expect(lastProductUpdatePayload).not.toHaveProperty('migration_status');
      expect(lastProductUpdatePayload).not.toHaveProperty('variant_model');
    });

    it('syncs variants when the variants payload is provided without has_variants', async () => {
      product = {
        id: PRODUCT_ID,
        name: 'Product',
        slug: 'product',
        condition: 'new',
        has_variants: false,
        variant_model: 'legacy',
      };

      updateResult = {
        id: PRODUCT_ID,
        slug: 'product',
        name: 'Product',
      };
      variantInsertError = { message: 'insert failed' };

      const res = await PUT(
        makePutRequest(PRODUCT_ID, {
          variants: [
            {
              attributes: { storage: '128GB' },
              price_override: 7000,
              stock_quantity: 5,
            },
          ],
        }),
        {
          params: Promise.resolve({ id: PRODUCT_ID }),
        }
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to create product variants');
    });

    it('does not send migration_status on legacy-variant updates', async () => {
      product = {
        id: PRODUCT_ID,
        name: 'Product',
        condition: 'used',
        variant_model: 'legacy',
        migration_status: 'needs_review',
      };

      updateResult = {
        id: PRODUCT_ID,
        name: 'Updated Product',
        price: '6000',
        slug: 'updated-product',
      };

      const res = await PUT(
        makePutRequest(PRODUCT_ID, {
          name: 'Updated Product',
          variants: [
            {
              id: 'variant-1',
              attributes: { storage: '128GB' },
              price_override: 6000,
              stock_quantity: 5,
            },
          ],
        }),
        {
          params: Promise.resolve({ id: PRODUCT_ID }),
        }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.product).toBeDefined();
      expect(lastProductUpdatePayload).toEqual(
        expect.objectContaining({
          variant_model: 'legacy',
        })
      );
      expect(lastProductUpdatePayload).not.toHaveProperty('migration_status');
    });

    it('deletes variants when has_variants is set to false', async () => {
      product = {
        id: PRODUCT_ID,
        name: 'Product',
        condition: 'new',
      };

      updateResult = {
        id: PRODUCT_ID,
        has_variants: false,
      };

      const res = await PUT(
        makePutRequest(PRODUCT_ID, { has_variants: false }),
        {
          params: Promise.resolve({ id: PRODUCT_ID }),
        }
      );
      await res.json();

      expect(res.status).toBe(200);
    });
  });

  describe('error handling', () => {
    it('returns 500 when update fails', async () => {
      product = {
        id: PRODUCT_ID,
        name: 'Product',
        condition: 'new',
      };

      updateError = { message: 'Update failed' };

      const res = await PUT(makePutRequest(PRODUCT_ID, validUpdateBody), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to update product');
    });

    it('returns 500 on unexpected error', async () => {
      authUser = undefined;

      const res = await PUT(makePutRequest(PRODUCT_ID, validUpdateBody), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});

describe('DELETE /api/products/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      authUser = null;

      const res = await DELETE(makeDeleteRequest(PRODUCT_ID), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });
  });

  describe('CSRF protection', () => {
    it('returns 403 when CSRF check fails', async () => {
      csrfValid = false;

      const res = await DELETE(makeDeleteRequest(PRODUCT_ID), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('CSRF validation failed');
    });
  });

  describe('success', () => {
    it('deletes product successfully', async () => {
      deleteError = null;

      const res = await DELETE(makeDeleteRequest(PRODUCT_ID), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('returns 500 on unexpected error', async () => {
      authUser = undefined;

      const res = await DELETE(makeDeleteRequest(PRODUCT_ID), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});
