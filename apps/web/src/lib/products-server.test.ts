import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PRODUCT_IMAGE_LARGE_PLACEHOLDER_URL,
  PRODUCT_IMAGE_PLACEHOLDER_URL,
} from '@/lib/product-image';

// ---- Mocks ----

vi.mock('@/lib/product-queries', () => ({
  PRODUCT_WITH_VARIANTS_QUERY:
    'id, name, description, price, stock, stock_quantity, status, manage_stock, sku, slug, compare_at_price, cost_price, low_stock_threshold, brand, category, color, has_variants, variant_model, migration_status, default_variant_id, available_conditions, min_variant_price, max_variant_price, images, image_hint, weight_value, weight_unit, dimensions, taxable, tax_code, condition, condition_detail, meta_title, meta_description, keywords, canonical_url, schema_markup, gtin, mpn, google_product_category, created_at, updated_at, merchant_id, fulfillment_details, variants:product_variants!product_variants_product_id_fkey(id, product_id, merchant_id, condition, attributes, price_override, cost_price, stock_quantity, sku, primary_image, images, created_at, updated_at)',
}));

vi.mock('@/lib/sanitize-core', () => ({
  sanitizeSearchQuery: (str: string) => str.trim(),
  sanitizeLikePattern: (str: string) => str,
}));

// ---- Supabase mock builder ----

interface MockQueryResult {
  data: Record<string, unknown>[] | null;
  error: { message: string; code: string } | null;
  count: number | null;
}

function createMockQueryBuilder(result: MockQueryResult) {
  // Supabase PostgREST builders are chainable AND thenable.
  // Every method returns `this`, and `await builder` triggers the query.
  const builder: Record<string, unknown> = {};
  const thenImpl = vi.fn((resolve: (v: MockQueryResult) => void) =>
    resolve(result)
  );

  for (const method of ['select', 'eq', 'gt', 'or', 'order', 'range']) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  // biome-ignore lint/suspicious/noThenProperty: Mocking a thenable Supabase query builder
  builder.then = thenImpl;

  return builder as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gt: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
    then: ReturnType<typeof vi.fn>;
  };
}

function createMockSupabase(
  queryResult: MockQueryResult,
  rpcResult?: { data: unknown; error: unknown }
) {
  const queryBuilder = createMockQueryBuilder(queryResult);
  return {
    client: {
      from: vi.fn().mockReturnValue(queryBuilder),
      rpc: vi.fn().mockResolvedValue(
        rpcResult ?? {
          data: { inventoryValue: 50000, outOfStockCount: 2, categoryCount: 5 },
          error: null,
        }
      ),
    },
    queryBuilder,
  };
}

// ---- Fixtures ----

function makeRawProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-001',
    name: 'Test Product',
    description: 'A great product',
    price: '2500.00',
    stock: 10,
    stock_quantity: 10,
    status: 'active',
    manage_stock: true,
    min_order_quantity: 1,
    sku: 'SKU-001',
    slug: 'test-product',
    compare_at_price: '3000.00',
    cost_price: '1500.00',
    low_stock_threshold: 5,
    brand: 'TestBrand',
    category: 'Electronics',
    color: 'Black',
    has_variants: false,
    images: [
      { url: 'https://cdn.example.com/img.jpg', alt: 'product', order: 0 },
    ],
    image_hint: 'electronics',
    weight_value: '0.5',
    weight_unit: 'kg',
    dimensions: { length: 10, width: 5, height: 3, unit: 'cm' },
    taxable: true,
    tax_code: 'STANDARD',
    condition: 'new',
    condition_detail: 'Brand New',
    meta_title: 'Test Product - TestBrand',
    meta_description: 'A great product',
    keywords: ['test', 'product'],
    canonical_url: 'https://store.example.com/test-product',
    schema_markup: null,
    gtin: '1234567890123',
    mpn: 'MPN-001',
    google_product_category: 'Electronics > Phones',
    variants: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    merchant_id: 'merchant-123',
    fulfillment_details: null,
    ...overrides,
  };
}

// ---- Import under test (after mocks) ----

const { getProducts, getCategories } = await import('@/lib/products-server');

// ---- Tests ----

describe('getProducts', () => {
  const merchantId = 'merchant-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Basic fetch & pagination ---

  it('returns products with default pagination when no params given', async () => {
    // Arrange
    const raw = makeRawProduct();
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('falls back to legacy stock when stock_quantity drifted to zero', async () => {
    const raw = makeRawProduct({ stock: 8, stock_quantity: 0 });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    const result = await getProducts(client as never, merchantId, {});

    expect(result.products[0].stock).toBe(8);
  });

  it('applies page and limit to range correctly', async () => {
    // Arrange
    const { client, queryBuilder } = createMockSupabase({
      data: [],
      error: null,
      count: 25,
    });

    // Act
    await getProducts(client as never, merchantId, { page: 3, limit: 5 });

    // Assert — offset = (3-1)*5 = 10, end = 10+5-1 = 14
    expect(queryBuilder.range).toHaveBeenCalledWith(10, 14);
  });

  it('computes totalPages correctly', async () => {
    // Arrange
    const { client } = createMockSupabase({
      data: [],
      error: null,
      count: 23,
    });

    // Act
    const result = await getProducts(client as never, merchantId, { limit: 5 });

    // Assert
    expect(result.pagination.totalPages).toBe(5); // ceil(23/5) = 5
  });

  it('handles null count as zero total', async () => {
    // Arrange
    const { client } = createMockSupabase({
      data: [],
      error: null,
      count: null,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
  });

  it('maps sku_matrix projection fields onto returned products', async () => {
    const raw = makeRawProduct({
      available_conditions: ['new', 'used'],
      default_variant_id: 'variant-1',
      max_variant_price: '3200.00',
      migration_status: 'needs_review',
      min_variant_price: '2500.00',
      variant_model: 'sku_matrix',
    });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    const result = await getProducts(client as never, merchantId, {});

    expect(result.products[0]).toMatchObject({
      available_conditions: ['new', 'used'],
      default_variant_id: 'variant-1',
      max_variant_price: 3200,
      migration_status: 'needs_review',
      min_variant_price: 2500,
      variant_model: 'sku_matrix',
    });
  });

  // --- Filtering ---

  it('filters by status when not "All"', async () => {
    // Arrange
    const { client, queryBuilder } = createMockSupabase({
      data: [],
      error: null,
      count: 0,
    });

    // Act
    await getProducts(client as never, merchantId, { status: 'active' });

    // Assert
    expect(queryBuilder.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('filters by migration_status when a concrete migration filter is provided', async () => {
    const { client, queryBuilder } = createMockSupabase({
      data: [],
      error: null,
      count: 0,
    });

    await getProducts(client as never, merchantId, {
      migration: 'needs_review',
    });

    expect(queryBuilder.eq).toHaveBeenCalledWith(
      'migration_status',
      'needs_review'
    );
  });

  it('treats pending migration filter as pending or null rows', async () => {
    const { client, queryBuilder } = createMockSupabase({
      data: [],
      error: null,
      count: 0,
    });

    await getProducts(client as never, merchantId, {
      migration: 'pending',
    });

    expect(queryBuilder.or).toHaveBeenCalledWith(
      'migration_status.eq.pending,migration_status.is.null'
    );
  });

  it('does not filter status when "All"', async () => {
    // Arrange
    const { client, queryBuilder } = createMockSupabase({
      data: [],
      error: null,
      count: 0,
    });

    // Act
    await getProducts(client as never, merchantId, { status: 'All' });

    // Assert — eq is called once for merchant_id, not for status
    const statusCalls = queryBuilder.eq.mock.calls.filter(
      (c: unknown[]) => c[0] === 'status'
    );
    expect(statusCalls).toHaveLength(0);
  });

  it('filters out_of_stock using effective stock and managed stock semantics', async () => {
    const { client, queryBuilder } = createMockSupabase({
      data: [
        makeRawProduct({ id: 'managed-oos', stock: 0, stock_quantity: 0 }),
        makeRawProduct({
          id: 'legacy-drift',
          stock: 5,
          stock_quantity: 0,
        }),
        makeRawProduct({
          id: 'unmanaged',
          manage_stock: false,
          stock: 0,
          stock_quantity: 0,
        }),
      ],
      error: null,
      count: 3,
    });

    const result = await getProducts(client as never, merchantId, {
      stock: 'out_of_stock',
    });

    expect(result.products.map((product) => product.id)).toEqual([
      'managed-oos',
    ]);
    expect(queryBuilder.range).not.toHaveBeenCalled();
  });

  it('filters in_stock using effective stock and unlimited-stock semantics', async () => {
    const { client, queryBuilder } = createMockSupabase({
      data: [
        makeRawProduct({ id: 'managed-oos', stock: 0, stock_quantity: 0 }),
        makeRawProduct({
          id: 'legacy-drift',
          stock: 5,
          stock_quantity: 0,
        }),
        makeRawProduct({
          id: 'unmanaged',
          manage_stock: false,
          stock: 0,
          stock_quantity: 0,
        }),
      ],
      error: null,
      count: 3,
    });

    const result = await getProducts(client as never, merchantId, {
      stock: 'in_stock',
    });

    expect(result.products.map((product) => product.id)).toEqual([
      'legacy-drift',
      'unmanaged',
    ]);
    expect(queryBuilder.range).not.toHaveBeenCalled();
  });

  it('does not filter stock when "All"', async () => {
    // Arrange
    const { client, queryBuilder } = createMockSupabase({
      data: [],
      error: null,
      count: 0,
    });

    // Act
    await getProducts(client as never, merchantId, { stock: 'All' });

    // Assert
    expect(queryBuilder.range).toHaveBeenCalledWith(0, 9);
  });

  // --- Search ---

  it('applies OR filter for search across name, sku, description', async () => {
    // Arrange
    const { client, queryBuilder } = createMockSupabase({
      data: [],
      error: null,
      count: 0,
    });

    // Act
    await getProducts(client as never, merchantId, { search: 'phone' });

    // Assert
    expect(queryBuilder.or).toHaveBeenCalledWith(
      'name.ilike.%phone%,sku.ilike.%phone%,description.ilike.%phone%'
    );
  });

  it('does not apply search filter for empty string', async () => {
    // Arrange
    const { client, queryBuilder } = createMockSupabase({
      data: [],
      error: null,
      count: 0,
    });

    // Act
    await getProducts(client as never, merchantId, { search: '' });

    // Assert
    expect(queryBuilder.or).not.toHaveBeenCalled();
  });

  it('does not apply search filter for whitespace-only string', async () => {
    // Arrange
    const { client, queryBuilder } = createMockSupabase({
      data: [],
      error: null,
      count: 0,
    });

    // Act
    await getProducts(client as never, merchantId, { search: '   ' });

    // Assert
    expect(queryBuilder.or).not.toHaveBeenCalled();
  });

  // --- Data transformation ---

  it('parses price from string to number', async () => {
    // Arrange
    const raw = makeRawProduct({ price: '1999.99' });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].price).toBe(1999.99);
    expect(typeof result.products[0].price).toBe('number');
  });

  it('parses compare_at_price and cost_price from strings', async () => {
    // Arrange
    const raw = makeRawProduct({
      compare_at_price: '3500.50',
      cost_price: '1200.75',
    });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].compare_at_price).toBe(3500.5);
    expect(result.products[0].cost_price).toBe(1200.75);
  });

  it('returns undefined for null compare_at_price and cost_price', async () => {
    // Arrange
    const raw = makeRawProduct({
      compare_at_price: null,
      cost_price: null,
    });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].compare_at_price).toBeUndefined();
    expect(result.products[0].cost_price).toBeUndefined();
  });

  it('parses weight_value from string to number', async () => {
    // Arrange
    const raw = makeRawProduct({ weight_value: '2.5' });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].weight_value).toBe(2.5);
  });

  it('returns undefined weight_value when null', async () => {
    // Arrange
    const raw = makeRawProduct({ weight_value: null });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].weight_value).toBeUndefined();
  });

  // --- Image fallback chain ---

  it('uses first image URL from images array when type is object', async () => {
    // Arrange
    const raw = makeRawProduct({
      images: [
        { url: 'https://cdn.example.com/main.jpg', alt: 'main', order: 0 },
      ],
      image_small: 'https://cdn.example.com/fallback-sm.jpg',
      image_large: 'https://cdn.example.com/fallback-lg.jpg',
    });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].image).toBe('https://cdn.example.com/main.jpg');
    expect(result.products[0].imageLarge).toBe(
      'https://cdn.example.com/main.jpg'
    );
  });

  it('uses first image string when images is array of strings', async () => {
    // Arrange
    const raw = makeRawProduct({
      images: ['https://cdn.example.com/str-img.jpg'],
      image_small: null,
      image_large: null,
    });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].image).toBe(
      'https://cdn.example.com/str-img.jpg'
    );
  });

  it('falls back to placeholder when image URLs are blank', async () => {
    // Arrange
    const raw = makeRawProduct({
      images: [{ url: '', alt: 'broken', order: 0 }],
    });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].image).toBe(PRODUCT_IMAGE_PLACEHOLDER_URL);
    expect(result.products[0].imageLarge).toBe(
      PRODUCT_IMAGE_LARGE_PLACEHOLDER_URL
    );
  });

  it('falls back to placeholder when no images available', async () => {
    // Arrange
    const raw = makeRawProduct({
      images: [],
      image_small: null,
      image_large: null,
    });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].image).toBe(PRODUCT_IMAGE_PLACEHOLDER_URL);
    expect(result.products[0].imageLarge).toBe(
      PRODUCT_IMAGE_LARGE_PLACEHOLDER_URL
    );
  });

  // --- Status derivation ---

  it('falls back to draft when status field is null', async () => {
    // Arrange
    const rawActive = makeRawProduct({ status: null });
    const rawInactive = makeRawProduct({
      id: 'prod-002',
      status: null,
    });
    const { client } = createMockSupabase({
      data: [rawActive, rawInactive],
      error: null,
      count: 2,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].status).toBe('draft');
    expect(result.products[1].status).toBe('draft');
  });

  // --- Variant transformation ---

  it('transforms variants with correct type coercions', async () => {
    // Arrange
    const raw = makeRawProduct({
      has_variants: true,
      variants: [
        {
          id: 'var-001',
          product_id: 'prod-001',
          merchant_id: 'merchant-123',
          attributes: { color: 'Blue', storage: '128GB' },
          price_override: '2999.99',
          cost_price: '1800.00',
          stock_quantity: '15',
          sku: 'SKU-001-BLUE',
          primary_image: 'https://cdn.example.com/blue.jpg',
          images: ['https://cdn.example.com/blue-1.jpg'],
        },
      ],
    });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});
    const product = result.products[0];
    const variants = product.variants ?? [];
    expect(variants).toHaveLength(1);
    const variant = variants[0];

    // Assert
    expect(variant.id).toBe('var-001');
    expect(variant.price_override).toBe(2999.99);
    expect(variant.cost_price).toBe(1800);
    expect(variant.stock_quantity).toBe(15);
    expect(variant.attributes).toEqual({ color: 'Blue', storage: '128GB' });
  });

  it('handles null variant price_override and cost_price as undefined/0', async () => {
    // Arrange
    const raw = makeRawProduct({
      has_variants: true,
      variants: [
        {
          id: 'var-002',
          product_id: 'prod-001',
          merchant_id: 'merchant-123',
          attributes: { size: 'M' },
          price_override: null,
          cost_price: null,
          stock_quantity: null,
          sku: null,
          primary_image: null,
          images: null,
        },
      ],
    });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});
    const product = result.products[0];
    const variants = product.variants ?? [];
    expect(variants).toHaveLength(1);
    const variant = variants[0];

    // Assert
    expect(variant.price_override).toBeUndefined();
    expect(variant.cost_price).toBeUndefined();
    expect(variant.stock_quantity).toBe(0);
  });

  // --- Denormalized variant attributes ---

  it('extracts colors, storage_options, available_sizes from variants', async () => {
    // Arrange
    const raw = makeRawProduct({
      has_variants: true,
      color: null,
      variants: [
        {
          id: 'v1',
          product_id: 'prod-001',
          merchant_id: 'merchant-123',
          attributes: { color: 'Red', storage: '64GB', size: 'S' },
          price_override: null,
          cost_price: null,
          stock_quantity: 5,
          sku: null,
          primary_image: null,
          images: null,
        },
        {
          id: 'v2',
          product_id: 'prod-001',
          merchant_id: 'merchant-123',
          attributes: { color: 'Blue', storage: '128GB', size: 'M' },
          price_override: null,
          cost_price: null,
          stock_quantity: 3,
          sku: null,
          primary_image: null,
          images: null,
        },
      ],
    });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].colors).toEqual(
      expect.arrayContaining(['Red', 'Blue'])
    );
    expect(result.products[0].storage_options).toEqual(
      expect.arrayContaining(['64GB', '128GB'])
    );
    expect(result.products[0].available_sizes).toEqual(
      expect.arrayContaining(['S', 'M'])
    );
  });

  it('falls back to product color when no variant colors', async () => {
    // Arrange
    const raw = makeRawProduct({
      has_variants: false,
      color: 'Gold',
      variants: [],
    });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].colors).toEqual(['Gold']);
    expect(result.products[0].storage_options).toBeUndefined();
    expect(result.products[0].available_sizes).toBeUndefined();
  });

  it('returns undefined colors when no variant colors and no product color', async () => {
    // Arrange
    const raw = makeRawProduct({
      has_variants: false,
      color: null,
      variants: [],
    });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].colors).toBeUndefined();
  });

  // --- Rating extraction from schema_markup ---

  it('extracts rating and review_count from schema_markup', async () => {
    // Arrange
    const raw = makeRawProduct({
      schema_markup: {
        '@context': 'https://schema.org',
        '@type': 'Product',
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: 4.5,
          reviewCount: 120,
        },
      },
    });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].rating).toBe(4.5);
    expect(result.products[0].review_count).toBe(120);
  });

  it('returns undefined rating when schema_markup is null', async () => {
    // Arrange
    const raw = makeRawProduct({ schema_markup: null });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].rating).toBeUndefined();
    expect(result.products[0].review_count).toBeUndefined();
  });

  it('returns undefined rating when ratingValue is not a number', async () => {
    // Arrange
    const raw = makeRawProduct({
      schema_markup: {
        aggregateRating: {
          ratingValue: 'four',
          reviewCount: 'many',
        },
      },
    });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].rating).toBeUndefined();
    expect(result.products[0].review_count).toBeUndefined();
  });

  // --- Default / fallback fields ---

  it('defaults description to empty string when null', async () => {
    // Arrange
    const raw = makeRawProduct({ description: null });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].description).toBe('');
  });

  it('defaults category to "General" when null', async () => {
    // Arrange
    const raw = makeRawProduct({ category: null });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].category).toBe('General');
  });

  it('defaults manage_stock to true when null', async () => {
    // Arrange
    const raw = makeRawProduct({ manage_stock: null });
    const { client } = createMockSupabase({
      data: [raw],
      error: null,
      count: 1,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products[0].manage_stock).toBe(true);
  });

  // --- Inventory stats via RPC ---

  it('returns inventory stats from RPC call', async () => {
    // Arrange
    const { client } = createMockSupabase(
      { data: [], error: null, count: 0 },
      {
        data: { inventoryValue: 75000, outOfStockCount: 3, categoryCount: 8 },
        error: null,
      }
    );

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.stats).toEqual({
      inventoryValue: 75000,
      outOfStockCount: 3,
      categoryCount: 8,
    });
  });

  it('returns zero stats when RPC errors', async () => {
    // Arrange
    const { client } = createMockSupabase(
      { data: [], error: null, count: 0 },
      {
        data: null,
        error: { message: 'RPC failed', code: '42883' },
      }
    );

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.stats).toEqual({
      inventoryValue: 0,
      outOfStockCount: 0,
      categoryCount: 0,
    });
  });

  it('returns zero stats when RPC throws an exception', async () => {
    // Arrange
    const queryBuilder = createMockQueryBuilder({
      data: [],
      error: null,
      count: 0,
    });
    const client = {
      from: vi.fn().mockReturnValue(queryBuilder),
      rpc: vi.fn().mockRejectedValue(new Error('Network failure')),
    };

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.stats).toEqual({
      inventoryValue: 0,
      outOfStockCount: 0,
      categoryCount: 0,
    });
  });

  // --- Error handling ---

  it('throws when Supabase query returns an error', async () => {
    // Arrange
    const { client } = createMockSupabase({
      data: null,
      error: { message: 'relation "products" does not exist', code: '42P01' },
      count: null,
    });

    // Act & Assert
    await expect(getProducts(client as never, merchantId, {})).rejects.toThrow(
      'Failed to fetch products'
    );
  });

  it('returns empty products array when data is null but no error', async () => {
    // Arrange
    const { client } = createMockSupabase({
      data: null,
      error: null,
      count: 0,
    });

    // Act
    const result = await getProducts(client as never, merchantId, {});

    // Assert
    expect(result.products).toEqual([]);
  });
});

describe('getCategories', () => {
  const merchantId = 'merchant-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns categories sorted by count descending', async () => {
    // Arrange
    const selectResult = {
      data: [
        { category: 'Electronics' },
        { category: 'Clothing' },
        { category: 'Electronics' },
        { category: 'Electronics' },
        { category: 'Clothing' },
        { category: 'Food' },
      ],
      error: null,
    };
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue(selectResult),
    };
    const client = {
      from: vi.fn().mockReturnValue(builder),
    };

    // Act
    const result = await getCategories(client as never, merchantId);

    // Assert
    expect(result).toEqual([
      { name: 'Electronics', count: 3 },
      { name: 'Clothing', count: 2 },
      { name: 'Food', count: 1 },
    ]);
  });

  it('skips null and empty category values', async () => {
    // Arrange
    const selectResult = {
      data: [
        { category: null },
        { category: '' },
        { category: 'Valid' },
        { category: undefined },
      ],
      error: null,
    };
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue(selectResult),
    };
    const client = {
      from: vi.fn().mockReturnValue(builder),
    };

    // Act
    const result = await getCategories(client as never, merchantId);

    // Assert
    expect(result).toEqual([{ name: 'Valid', count: 1 }]);
  });

  it('returns empty array when no products found', async () => {
    // Arrange
    const selectResult = { data: null, error: null };
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue(selectResult),
    };
    const client = {
      from: vi.fn().mockReturnValue(builder),
    };

    // Act
    const result = await getCategories(client as never, merchantId);

    // Assert
    expect(result).toEqual([]);
  });
});
