import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as TypeScript from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const ts = require('typescript') as typeof TypeScript;
const mockCreatePublicClient = vi.fn();
const mockNormalizeProducts = vi.fn((products: unknown[]) =>
  products.map((p: unknown) => ({
    ...(p as Record<string, unknown>),
    normalized: true,
  }))
);

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: (...args: unknown[]) => mockCreatePublicClient(...args),
}));

vi.mock('@/lib/normalize-product', () => ({
  normalizeProducts: (products: unknown[]) => mockNormalizeProducts(products),
}));

import { getCachedStorefrontProductIndex } from '@/lib/cached-storefront-product-index';

const SOURCE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    'cached-storefront-product-index.ts'
  ),
  'utf8'
);
const SOURCE_AST = ts.createSourceFile(
  'cached-storefront-product-index.ts',
  SOURCE,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);

function getFunctionSource(functionName: string): string {
  let match: TypeScript.FunctionDeclaration | undefined;

  function visit(node: TypeScript.Node): void {
    if (match) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) {
      match = node;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(SOURCE_AST);

  if (!match) {
    throw new Error(
      `Unable to locate ${functionName} in cached-storefront-product-index.ts`
    );
  }

  return SOURCE.slice(match.getStart(SOURCE_AST), match.end);
}

function createQueryBuilder(overrides: {
  data?: unknown[] | null;
  count?: number | null;
  error?: { message: string } | null;
}) {
  const result = {
    data: overrides.data ?? null,
    count: overrides.count ?? null,
    error: overrides.error ?? null,
  };

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => Promise.resolve(result)),
  };

  return builder;
}

describe('getCachedStorefrontProductIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNormalizeProducts.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the public product index off the remote cache handler', () => {
    const source = getFunctionSource('getCachedStorefrontProductIndex');

    expect(source).toContain("'use cache';");
    expect(source).not.toContain("'use cache: remote';");
    expect(source).toContain("cacheLife('products');");
    expect(source).toContain('cacheTag(');
  });

  it('returns normalized products with pagination metadata on success', async () => {
    const rawProducts = [
      { id: 'p1', name: 'Phone', price: 100 },
      { id: 'p2', name: 'Tablet', price: 200 },
    ];

    const builder = createQueryBuilder({
      data: rawProducts,
      count: 25,
    });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductIndex('merchant-1', {
      page: 1,
      limit: 10,
    });

    expect(result.products).toHaveLength(2);
    expect(result.hasError).toBe(false);
    expect(result.products[0]).toHaveProperty('normalized', true);
    expect(result.errorMessage).toBeNull();
    expect(result.totalCount).toBe(25);
    expect(result.totalPages).toBe(3); // ceil(25/10)
  });

  it('keeps the product index projection compact and derives schema-safe listing descriptions', async () => {
    const rawProducts = [
      {
        id: 'p1',
        name: 'Alienware 18',
        brand: 'Dell',
        category: '',
        product_categories: [
          {
            categories: {
              name: 'Gaming Laptops',
              slug: 'gaming-laptops',
            },
          },
        ],
        price: 5900000,
      },
      {
        id: 'p2',
        name: 'Latitude 7450',
        brand: 'Dell',
        category: 'Laptops',
        product_categories: [
          {
            categories: {
              name: 'Business Laptops',
              slug: 'business-laptops',
            },
          },
        ],
        price: 2100000,
      },
      {
        id: 'p3',
        name: '',
        brand: '',
        category: '',
        product_categories: [
          {
            categories: {
              name: '',
              slug: 'uncategorized',
            },
          },
        ],
        price: 100000,
      },
    ];

    const builder = createQueryBuilder({
      data: rawProducts,
      count: 3,
    });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    await getCachedStorefrontProductIndex('merchant-1', {
      page: 1,
      limit: 10,
    });

    const lastSelectCall = builder.select.mock.calls.at(-1) as
      | [unknown]
      | undefined;
    const selectArg = String(lastSelectCall?.[0]);
    expect(selectArg).not.toMatch(/(?:^|[\s,])description\s*(?:,|\n|$)/);
    expect(selectArg).not.toMatch(/(?:^|[\s,])specifications\s*(?:,|\n|$)/);
    expect(mockNormalizeProducts).toHaveBeenCalledWith([
      expect.objectContaining({
        description: 'Dell Gaming Laptops',
      }),
      expect.objectContaining({
        description: 'Dell Laptops',
      }),
      expect.objectContaining({
        description: null,
      }),
    ]);
  });

  it('selects the canonical category_id relation so prerender params match the PDP canonical category', async () => {
    // generateStaticParams derives prerender category slugs from this index.
    // The PDP route treats `categories:category_id` as the canonical category
    // (canonicalCategory ?? fallbackCategory), and normalizeProduct prepends
    // that direct relation before product_categories — so the index must select
    // it, or category_id-only products would prerender a divergent category URL.
    const builder = createQueryBuilder({ data: [], count: 0 });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    await getCachedStorefrontProductIndex('merchant-1', {
      page: 1,
      limit: 10,
    });

    const lastSelectCall = builder.select.mock.calls.at(-1) as
      | [unknown]
      | undefined;
    const selectArg = String(lastSelectCall?.[0]);
    expect(selectArg).toMatch(/categories:category_id\(/);
  });

  it('calculates correct offset for page > 1', async () => {
    const builder = createQueryBuilder({ data: [], count: 0 });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    await getCachedStorefrontProductIndex('merchant-1', {
      page: 3,
      limit: 10,
    });

    // offset = (3 - 1) * 10 = 20, range = 20..29
    expect(builder.range).toHaveBeenCalledWith(20, 29);
  });

  it('calculates correct offset for page 1', async () => {
    const builder = createQueryBuilder({ data: [], count: 0 });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    await getCachedStorefrontProductIndex('merchant-1', {
      page: 1,
      limit: 20,
    });

    expect(builder.range).toHaveBeenCalledWith(0, 19);
  });

  it('returns empty result on supabase error', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const builder = createQueryBuilder({
      error: { message: 'Connection refused' },
    });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductIndex('merchant-1', {
      page: 1,
      limit: 10,
    });

    expect(result.hasError).toBe(true);
    expect(result.errorMessage).toBe('Connection refused');
    expect(result.products).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error fetching storefront product index:',
      expect.objectContaining({ message: 'Connection refused' })
    );
  });

  it('returns empty products array when data is null', async () => {
    const builder = createQueryBuilder({ data: null, count: 0 });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductIndex('merchant-1', {
      page: 1,
      limit: 10,
    });

    expect(result.products).toEqual([]);
    expect(result.hasError).toBe(false);
    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('handles null count by defaulting to 0', async () => {
    const builder = createQueryBuilder({
      data: [{ id: 'p1', name: 'Phone', price: 100 }],
      count: null,
    });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductIndex('merchant-1', {
      page: 1,
      limit: 10,
    });

    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('calculates totalPages correctly with exact division', async () => {
    const builder = createQueryBuilder({ data: [], count: 40 });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductIndex('merchant-1', {
      page: 1,
      limit: 20,
    });

    expect(result.totalPages).toBe(2); // 40 / 20 = 2
  });

  it('calculates totalPages correctly with remainder', async () => {
    const builder = createQueryBuilder({ data: [], count: 41 });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductIndex('merchant-1', {
      page: 1,
      limit: 20,
    });

    expect(result.totalPages).toBe(3); // ceil(41/20) = 3
  });

  it('filters by merchant_id and active status', async () => {
    const builder = createQueryBuilder({ data: [], count: 0 });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    await getCachedStorefrontProductIndex('merchant-abc', {
      page: 1,
      limit: 10,
    });

    expect(builder.eq).toHaveBeenCalledWith('merchant_id', 'merchant-abc');
    expect(builder.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('throws when public client creation fails', async () => {
    mockCreatePublicClient.mockImplementationOnce(() => {
      throw new Error('Supabase configuration is missing');
    });

    await expect(
      getCachedStorefrontProductIndex('merchant-1', { page: 1, limit: 10 })
    ).rejects.toThrow('Supabase configuration is missing');
  });

  it('throws when the requested limit is not a positive integer', async () => {
    await expect(
      getCachedStorefrontProductIndex('merchant-1', { page: 1, limit: 0 })
    ).rejects.toThrow(
      'Storefront product index limit must be a positive integer'
    );
  });

  it('throws when the requested page is not a positive integer', async () => {
    await expect(
      getCachedStorefrontProductIndex('merchant-1', { page: 0, limit: 10 })
    ).rejects.toThrow(
      'Storefront product index page must be a positive integer'
    );
  });
  it('throws when the requested page is negative', async () => {
    await expect(
      getCachedStorefrontProductIndex('merchant-1', { page: -1, limit: 10 })
    ).rejects.toThrow(
      'Storefront product index page must be a positive integer'
    );
  });

  it('throws when the requested page is not an integer', async () => {
    await expect(
      getCachedStorefrontProductIndex('merchant-1', { page: 1.5, limit: 10 })
    ).rejects.toThrow(
      'Storefront product index page must be a positive integer'
    );
  });
});
