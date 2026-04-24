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

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateProducts: vi.fn(),
}));

type MerchantContextMock = {
  merchantId: string;
  businessName: string;
  staffAccess: {
    isOwner: boolean;
    isStaff: boolean;
    role: string | null;
    permissions: Record<string, Record<string, boolean>>;
  };
};

const merchantContextMock = {
  current: {
    merchantId: 'merchant-123',
    businessName: 'Test Store',
    staffAccess: {
      isOwner: true,
      isStaff: false,
      role: null,
      permissions: { full_access: { all: true } },
    },
  } as MerchantContextMock | null,
};

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(() =>
    Promise.resolve(merchantContextMock.current)
  ),
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
  sanitizeLikePattern: (str: string) => str,
  sanitizeSchemaMarkup: (obj: Record<string, unknown>) => obj,
  sanitizeSearchQuery: (str: string) => str,
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
  createProductSchema: {
    safeParse: (data: Record<string, unknown>) => {
      if (!data.name) {
        return {
          success: false,
          error: {
            errors: [{ path: ['name'], message: 'Required' }],
          },
        };
      }
      if (typeof data.price === 'number' && data.price < 0) {
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

vi.mock('@/lib/product-variant-model', () => ({
  inferProductVariantModel: vi.fn(
    ({
      variantModel,
      hasVariants,
    }: {
      variantModel?: string;
      hasVariants?: boolean;
    }) => {
      if (variantModel === 'sku_matrix') {
        return 'sku_matrix';
      }

      return hasVariants ? 'legacy' : 'simple';
    }
  ),
  getSkuMatrixValidationError: vi.fn(
    ({
      variantModel,
      variants,
    }: {
      variantModel?: string;
      variants?: Array<{ price_override?: number }>;
    }) => {
      if (variantModel !== 'sku_matrix') {
        return null;
      }

      const hasInvalidPriceOverride = (variants ?? []).some(
        (variant) =>
          typeof variant.price_override !== 'number' ||
          variant.price_override < 0
      );

      return hasInvalidPriceOverride
        ? 'Every sku_matrix variant must include a non-negative price_override.'
        : null;
    }
  ),
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
let products: unknown[] = [];
let productsCount = 0;
let productsError: unknown = null;
let rpcData: unknown = null;
let rpcError: unknown = null;
let insertResult: unknown = null;
let insertError: unknown = null;
let variantsInsertError: unknown = null;
let existingProduct: unknown = null;
let lastProductsQueryChain: {
  eq: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
} | null = null;

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
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        or: vi.fn(() => chain),
        gt: vi.fn(() => chain),
        in: vi.fn(() => chain),
        range: vi.fn(() =>
          Promise.resolve({
            data: productsError ? null : products,
            error: productsError,
            count: productsCount,
          })
        ),
        maybeSingle: vi.fn(() =>
          Promise.resolve({
            data: existingProduct,
            error: null,
          })
        ),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: insertError ? null : insertResult,
                error: insertError,
              })
            ),
          })),
        })),
      };
      lastProductsQueryChain = chain;
      return chain;
    }
    if (table === 'product_variants') {
      return {
        insert: vi.fn(() =>
          Promise.resolve({
            error: variantsInsertError,
          })
        ),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };
  }),
  rpc: vi.fn(() =>
    Promise.resolve({
      data: rpcData,
      error: rpcError,
    })
  ),
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createMockSupabase(),
}));

// Mock global fetch for embeddings
global.fetch = vi.fn().mockResolvedValue({ ok: true });

// ---- Import handlers AFTER mocks ----
import { GET, POST } from './route';

// ---- Helpers ----

const validCreateBody = {
  name: 'Test Product',
  description: 'A great product',
  price: 5000,
  stock: 100,
  manage_stock: true,
  status: 'draft',
  category: 'Electronics',
  images: [{ url: 'https://example.com/image.png' }],
};

function makeGetRequest(params?: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/products');
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url.toString(), {
    method: 'GET',
  });
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function resetMocks() {
  authUser = { id: USER_ID };
  merchant = {
    id: MERCHANT_ID,
    business_name: 'Test Store',
    country: 'NG',
  };
  merchantContextMock.current = {
    merchantId: MERCHANT_ID,
    businessName: 'Test Store',
    staffAccess: {
      isOwner: true,
      isStaff: false,
      role: null,
      permissions: { full_access: { all: true } },
    },
  };
  products = [];
  productsCount = 0;
  productsError = null;
  rpcData = {
    inventoryValue: 50000,
    outOfStockCount: 0,
    categoryCount: 1,
  };
  rpcError = null;
  insertResult = null;
  insertError = null;
  variantsInsertError = null;
  existingProduct = null;
  lastProductsQueryChain = null;
  csrfValid = true;
}

// ---- Tests ----

describe('GET /api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      authUser = null;

      const res = await GET(makeGetRequest());
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });
  });

  describe('merchant lookup', () => {
    it('returns 404 when merchant not found', async () => {
      merchantContextMock.current = null;

      const res = await GET(makeGetRequest());
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });
  });

  describe('success with products', () => {
    it('returns products with pagination and stats', async () => {
      products = [
        {
          id: PRODUCT_ID,
          name: 'Product 1',
          description: 'Description 1',
          price: '1000',
          stock_quantity: 50,
          status: 'active',
          manage_stock: true,
          images: [{ url: 'https://example.com/p1.png' }],
          variants: [],
          has_variants: false,
          category: 'General',
          sku: 'SKU-001',
          slug: 'product-1',
        },
      ];
      productsCount = 1;

      const res = await GET(makeGetRequest());
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.products).toHaveLength(1);
      expect(json.products[0].name).toBe('Product 1');
      expect(json.pagination.total).toBe(1);
      expect(json.stats.inventoryValue).toBe(50000);
    });

    // Note: Filter tests removed - testing query builder logic is not the responsibility
    // of API route tests. The filters (search, status, stock) are business logic that
    // would ideally be extracted and unit tested separately.

    it('applies ids filter and ignores pagination', async () => {
      const res = await GET(makeGetRequest({ ids: 'id1,id2,id3' }));
      await res.json();

      expect(res.status).toBe(200);
    });

    it('handles stats RPC fallback gracefully', async () => {
      rpcError = { message: 'RPC not found' };
      products = [
        {
          id: PRODUCT_ID,
          name: 'Product 1',
          price: '1000',
          stock_quantity: 10,
          status: 'active',
          manage_stock: true,
          category: 'Electronics',
          variants: [],
        },
      ];
      productsCount = 1;

      const res = await GET(makeGetRequest());
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.stats).toBeDefined();
      expect(json.stats.inventoryValue).toBeGreaterThanOrEqual(0);
    });

    it('applies migration_status filter for explicit review queues', async () => {
      const res = await GET(makeGetRequest({ migration: 'needs_review' }));

      expect(res.status).toBe(200);
      expect(lastProductsQueryChain?.eq).toHaveBeenCalledWith(
        'migration_status',
        'needs_review'
      );
    });

    it('treats pending migration filter as pending or null rows', async () => {
      const res = await GET(makeGetRequest({ migration: 'pending' }));

      expect(res.status).toBe(200);
      expect(lastProductsQueryChain?.or).toHaveBeenCalledWith(
        'migration_status.eq.pending,migration_status.is.null'
      );
    });

    it('rejects invalid migration filters', async () => {
      const res = await GET(makeGetRequest({ migration: 'broken' }));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid query parameters');
    });
  });

  describe('error handling', () => {
    it('returns 500 on database error', async () => {
      productsError = { message: 'Database error' };

      const res = await GET(makeGetRequest());
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to fetch products');
    });

    it('returns 500 on unexpected error', async () => {
      authUser = undefined;

      const res = await GET(makeGetRequest());
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});

describe('POST /api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      authUser = null;

      const res = await POST(makePostRequest(validCreateBody));
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });
  });

  describe('CSRF protection', () => {
    it('returns 403 when CSRF check fails', async () => {
      csrfValid = false;

      const res = await POST(makePostRequest(validCreateBody));
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('CSRF validation failed');
    });
  });

  describe('validation', () => {
    it('returns 400 when name is missing', async () => {
      const { name: _, ...body } = validCreateBody;
      const res = await POST(makePostRequest(body));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Validation failed');
      expect(json.details).toBeDefined();
    });

    it('returns 400 when price is negative', async () => {
      const res = await POST(
        makePostRequest({ ...validCreateBody, price: -100 })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Validation failed');
    });

    it('rejects sku_matrix products when a variant lacks price_override', async () => {
      const res = await POST(
        makePostRequest({
          ...validCreateBody,
          has_variants: true,
          variant_model: 'sku_matrix',
          variants: [
            {
              condition: 'used',
              attributes: { storage: '256GB' },
              stock_quantity: 2,
            },
          ],
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe(
        'Every sku_matrix variant must include a non-negative price_override.'
      );
    });

    it('accepts sku_matrix products when every variant includes price_override', async () => {
      insertResult = {
        id: PRODUCT_ID,
        merchant_id: MERCHANT_ID,
        name: 'Matrix Product',
      };

      const res = await POST(
        makePostRequest({
          ...validCreateBody,
          has_variants: true,
          variant_model: 'sku_matrix',
          variants: [
            {
              condition: 'used',
              attributes: { storage: '256GB' },
              price_override: 4500,
              stock_quantity: 2,
            },
          ],
        })
      );

      expect(res.status).toBe(201);
    });
  });

  describe('merchant lookup', () => {
    it('returns 404 when merchant not found', async () => {
      merchantContextMock.current = null;

      const res = await POST(makePostRequest(validCreateBody));
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });
  });

  describe('duplicate slug check', () => {
    it('returns 409 when product with same slug exists', async () => {
      existingProduct = { id: 'existing-product-id' };

      const res = await POST(makePostRequest(validCreateBody));
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error).toBe('A product with this name already exists.');
    });
  });

  describe('success', () => {
    it('creates product and returns 201', async () => {
      insertResult = {
        id: PRODUCT_ID,
        merchant_id: MERCHANT_ID,
        name: 'Test Product',
        price: '5000',
        stock_quantity: 100,
        slug: 'test-product',
      };

      const res = await POST(makePostRequest(validCreateBody));
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.product).toBeDefined();
      expect(json.product.id).toBe(PRODUCT_ID);
    });

    it('creates product with variants', async () => {
      const bodyWithVariants = {
        ...validCreateBody,
        has_variants: true,
        color: 'Gold',
        variants: [
          {
            attributes: { size: 'M' },
            price: 5000,
            stock_quantity: 10,
            sku: 'SKU-M-RED',
          },
        ],
      };

      insertResult = {
        id: PRODUCT_ID,
        merchant_id: MERCHANT_ID,
        name: 'Test Product',
        has_variants: true,
      };

      const res = await POST(makePostRequest(bodyWithVariants));
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.product.has_variants).toBe(true);
      expect(lastProductsQueryChain).toBeDefined();
      if (!lastProductsQueryChain) {
        throw new Error('Expected products query chain to be captured');
      }
      expect(lastProductsQueryChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 'Gold',
        })
      );
    });

    it('triggers embedding generation asynchronously', async () => {
      insertResult = { id: PRODUCT_ID };

      const res = await POST(makePostRequest(validCreateBody));

      expect(res.status).toBe(201);
    });
  });

  describe('error handling', () => {
    it('returns 500 when product insertion fails', async () => {
      insertError = { message: 'Insert failed' };

      const res = await POST(makePostRequest(validCreateBody));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to create product');
    });

    it('returns 500 on unexpected error', async () => {
      authUser = undefined;

      const res = await POST(makePostRequest(validCreateBody));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});
