import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type DbError = {
  message: string;
};

type InventoryStats = {
  inventoryValue: number;
  outOfStockCount: number;
  categoryCount: number;
};

type MerchantContext = {
  merchantId: string;
  businessName?: string;
};

type MockState = {
  authUser: { id: string } | null;
  merchantContext: MerchantContext | null;
  merchantCountry: string | null;
  products: Record<string, unknown>[];
  productsCount: number;
  productsError: DbError | null;
  rpcData: InventoryStats | null;
  rpcError: DbError | null;
  oosCount: number;
  existingProduct: { id: string } | null;
  createdProduct: Record<string, unknown> | null;
  productInsertError: DbError | null;
  variantsInsertError: DbError | null;
  rollbackError: DbError | null;
};

type SupabaseSpies = {
  productsSelect: ReturnType<typeof vi.fn>;
  productsInsert: ReturnType<typeof vi.fn>;
  productVariantsInsert: ReturnType<typeof vi.fn>;
  rollbackEq: ReturnType<typeof vi.fn>;
};

const mocked = vi.hoisted(() => ({
  cookies: vi.fn(),
  createClient: vi.fn(),
  checkCsrfProtection: vi.fn(),
  safeParse: vi.fn(),
  formatZodErrors: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  revalidateProducts: vi.fn(),
  getProductEmbeddingText: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

vi.mock('next/headers', () => ({
  cookies: mocked.cookies,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocked.createClient,
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocked.getMerchantForApiRequest,
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocked.checkCsrfProtection,
}));

vi.mock('@/schemas/products', () => ({
  createProductSchema: {
    safeParse: mocked.safeParse,
  },
  formatZodErrors: mocked.formatZodErrors,
}));

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateProducts: mocked.revalidateProducts,
}));

vi.mock('@/lib/embeddings', () => ({
  getProductEmbeddingText: mocked.getProductEmbeddingText,
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeHtml: (value: string) => value,
}));

vi.mock('@/lib/sanitize-core', () => ({
  sanitizeLikePattern: (value: string) => value,
  sanitizeSearchQuery: (value: string) => value,
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  sanitizeSchemaMarkup: (value: unknown) => value,
}));

vi.mock('@/lib/seo-utils', () => ({
  generateMetaDescription: (value: string) => value,
  generateProductSchema: () => ({ '@type': 'Product' }),
  generateProductSlug: (name: string) =>
    name.toLowerCase().replace(/\s+/g, '-'),
  generateSlug: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
}));

vi.mock('@/lib/countries', () => ({
  getCountryByCode: () => ({
    currency: 'NGN',
  }),
}));

import { GET, POST } from './route';

const DEFAULT_PRODUCT_ID = 'product-123';
const DEFAULT_MERCHANT_ID = 'merchant-123';

const VALID_CREATE_BODY = {
  name: 'Test Product',
  description: 'A great product',
  price: 5000,
  stock: 100,
  manage_stock: true,
  status: 'draft',
  category: 'Electronics',
  slug: 'test-product',
  images: [{ url: 'https://example.com/image.png' }],
};

let state: MockState;
let supabaseSpies: SupabaseSpies;

function resetState() {
  state = {
    authUser: { id: 'user-123' },
    merchantContext: {
      merchantId: DEFAULT_MERCHANT_ID,
      businessName: 'Test Store',
    },
    merchantCountry: 'NG',
    products: [],
    productsCount: 0,
    productsError: null,
    rpcData: {
      inventoryValue: 50000,
      outOfStockCount: 0,
      categoryCount: 1,
    },
    rpcError: null,
    oosCount: 0,
    existingProduct: null,
    createdProduct: {
      id: DEFAULT_PRODUCT_ID,
      slug: 'test-product',
    },
    productInsertError: null,
    variantsInsertError: null,
    rollbackError: null,
  };
}

function createSupabaseMock() {
  const listBuilder = {
    eq: vi.fn(() => listBuilder),
    order: vi.fn(() => listBuilder),
    or: vi.fn(() => listBuilder),
    gt: vi.fn(() => listBuilder),
    in: vi.fn(() => listBuilder),
    range: vi.fn(async () => ({
      data: state.productsError ? null : state.products,
      error: state.productsError,
      count: state.productsCount,
    })),
  };

  const countBuilder = {
    eq: vi.fn((column: string, _value: unknown) => {
      if (column === 'stock_quantity') {
        return Promise.resolve({
          count: state.oosCount,
          error: null,
          data: null,
        });
      }
      return countBuilder;
    }),
  };

  const duplicateBuilder = {
    eq: vi.fn(() => duplicateBuilder),
    maybeSingle: vi.fn(async () => ({
      data: state.existingProduct,
      error: null,
    })),
  };

  const productsSelect = vi.fn(
    (columns: string, options?: { count?: 'exact'; head?: boolean }) => {
      if (options?.head) {
        return countBuilder;
      }
      if (columns === 'id') {
        return duplicateBuilder;
      }
      return listBuilder;
    }
  );

  const productsInsert = vi.fn((_payload: unknown) => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({
        data: state.productInsertError ? null : state.createdProduct,
        error: state.productInsertError,
      })),
    })),
  }));

  const rollbackEq = vi.fn(async () => ({
    error: state.rollbackError,
  }));

  const productVariantsInsert = vi.fn(async (_payload: unknown) => ({
    error: state.variantsInsertError,
  }));

  const merchantsBuilder = {
    select: vi.fn(() => merchantsBuilder),
    eq: vi.fn(() => merchantsBuilder),
    single: vi.fn(async () => ({
      data: state.merchantCountry ? { country: state.merchantCountry } : null,
      error: null,
    })),
  };

  supabaseSpies = {
    productsSelect,
    productsInsert,
    productVariantsInsert,
    rollbackEq,
  };

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: state.authUser },
        error: state.authUser ? null : { message: 'Not authenticated' },
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'products') {
        return {
          select: productsSelect,
          insert: productsInsert,
          delete: vi.fn(() => ({ eq: rollbackEq })),
        };
      }

      if (table === 'product_variants') {
        return {
          insert: productVariantsInsert,
        };
      }

      if (table === 'merchants') {
        return merchantsBuilder;
      }

      throw new Error(`Unexpected table requested in test: ${table}`);
    }),
    rpc: vi.fn(async () => ({
      data: state.rpcData,
      error: state.rpcError,
    })),
  };
}

function makeGetRequest(params?: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/products');

  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.set(key, value);
  }

  return new NextRequest(url.toString(), { method: 'GET' });
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetState();

  mocked.cookies.mockResolvedValue({ get: vi.fn(), set: vi.fn() });
  mocked.createClient.mockImplementation(() => createSupabaseMock());
  mocked.checkCsrfProtection.mockResolvedValue({ valid: true, response: null });
  mocked.getMerchantForApiRequest.mockImplementation(
    async () => state.merchantContext
  );
  mocked.safeParse.mockImplementation((payload: Record<string, unknown>) => ({
    success: true,
    data: payload,
  }));
  mocked.formatZodErrors.mockReturnValue([
    { field: 'name', message: 'Required' },
  ]);
  mocked.getProductEmbeddingText.mockReturnValue('embedding text');

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

  mocked.fetch.mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', mocked.fetch);
});

describe('GET /api/products', () => {
  it('returns 401 when user is not authenticated', async () => {
    state.authUser = null;

    const response = await GET(makeGetRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('parses variant price_override and uses explicit id select for OOS fallback count', async () => {
    state.products = [
      {
        id: 'product-1',
        name: 'Phone',
        description: 'Smartphone',
        status: 'active',
        is_active: true,
        price: '1500.00',
        manage_stock: true,
        stock_quantity: 10,
        min_order_quantity: 1,
        images: [],
        image_small: null,
        image_large: null,
        image_hint: null,
        brand: null,
        gtin: null,
        mpn: null,
        google_product_category: null,
        has_variants: true,
        variants: [
          {
            id: 'variant-1',
            product_id: 'product-1',
            merchant_id: DEFAULT_MERCHANT_ID,
            attributes: { color: 'Blue' },
            price_override: '1750.55',
            stock_quantity: 3,
            sku: 'PHONE-BLUE',
            primary_image: null,
            images: [],
          },
        ],
        category: 'Electronics',
        color: 'Blue',
        sku: 'PHONE-001',
        slug: 'phone',
        compare_at_price: null,
        cost_price: null,
        low_stock_threshold: 5,
        weight_value: null,
        weight_unit: null,
        dimensions: null,
        taxable: true,
        tax_code: null,
        condition: 'new',
        condition_detail: null,
        meta_title: null,
        meta_description: null,
        keywords: null,
        canonical_url: null,
        schema_markup: null,
      },
    ];
    state.productsCount = 1;
    state.rpcData = null;
    state.rpcError = { message: 'RPC missing' };
    state.oosCount = 4;

    const response = await GET(makeGetRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.products[0].variants[0].price_override).toBe(1750.55);
    expect(supabaseSpies.productsSelect).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    });
    expect(body.stats.outOfStockCount).toBe(4);
  });
});

describe('POST /api/products', () => {
  it('returns 401 when user is not authenticated', async () => {
    state.authUser = null;

    const response = await POST(makePostRequest(VALID_CREATE_BODY));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when createProductSchema validation fails', async () => {
    mocked.safeParse.mockReturnValueOnce({
      success: false,
      error: { issues: [{ path: ['name'], message: 'Required' }] },
    });
    mocked.formatZodErrors.mockReturnValueOnce([
      { field: 'name', message: 'Required' },
    ]);

    const response = await POST(makePostRequest(VALID_CREATE_BODY));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(mocked.safeParse).toHaveBeenCalledTimes(1);
    expect(mocked.formatZodErrors).toHaveBeenCalledTimes(1);
  });

  it('returns 409 when a duplicate slug already exists', async () => {
    state.existingProduct = { id: 'existing-product' };

    const response = await POST(makePostRequest(VALID_CREATE_BODY));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('A product with this name already exists.');
    expect(supabaseSpies.productsInsert).not.toHaveBeenCalled();
  });

  it('rolls back product creation when variant insertion fails', async () => {
    state.createdProduct = { id: 'rollback-product', slug: 'rollback-product' };
    state.variantsInsertError = { message: 'variant insert failed' };

    const response = await POST(
      makePostRequest({
        ...VALID_CREATE_BODY,
        has_variants: true,
        variants: [
          {
            attributes: { size: 'M', color: 'Black' },
            price: 5100,
            cost_price: 4500,
            stock_quantity: 8,
            sku: 'TP-M-BLK',
            image: 'https://example.com/variant.png',
            images: [],
          },
        ],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to create product variants');
    expect(supabaseSpies.productVariantsInsert).toHaveBeenCalledTimes(1);
    expect(supabaseSpies.rollbackEq).toHaveBeenCalledWith(
      'id',
      'rollback-product'
    );
    expect(mocked.revalidateProducts).not.toHaveBeenCalled();
    expect(mocked.fetch).not.toHaveBeenCalled();
  });

  it('creates product + variants, revalidates cache, and triggers embedding fetch', async () => {
    state.createdProduct = { id: 'happy-product-id', slug: 'happy-product' };

    const response = await POST(
      makePostRequest({
        ...VALID_CREATE_BODY,
        slug: 'happy-product',
        has_variants: true,
        variants: [
          {
            attributes: { size: 'L', color: 'Red' },
            price: 5200,
            cost_price: 4700,
            stock_quantity: 4,
            sku: 'TP-L-RED',
            image: 'https://example.com/red.png',
            images: [],
          },
        ],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.product.id).toBe('happy-product-id');
    expect(supabaseSpies.productsInsert).toHaveBeenCalledTimes(1);
    expect(supabaseSpies.productVariantsInsert).toHaveBeenCalledTimes(1);
    expect(mocked.getProductEmbeddingText).toHaveBeenCalledTimes(1);
    expect(mocked.fetch).toHaveBeenCalledTimes(1);
    expect(mocked.revalidateProducts).toHaveBeenCalledWith(
      DEFAULT_MERCHANT_ID,
      'happy-product'
    );
  });
});
