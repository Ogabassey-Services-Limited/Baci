import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrefetchInfiniteQuery = jest.fn<() => Promise<void>>();
const mockPrefetchQuery = jest.fn<() => Promise<void>>();
const mockFrom = jest.fn();
const mockWarn = jest.fn();
const mockWithSupabaseRetry = jest.fn(
  async <T>(operation: () => Promise<T> | T): Promise<T> => await operation()
);

jest.mock('@/lib/query-client', () => ({
  queryClient: {
    prefetchInfiniteQuery: mockPrefetchInfiniteQuery,
    prefetchQuery: mockPrefetchQuery,
  },
}));

jest.mock('@/hooks/product-utils', () => ({
  CONSTANT_MERCHANT_ID: 'merchant-123',
  fetchProductsPage: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  withSupabaseRetry: mockWithSupabaseRetry,
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    warn: mockWarn,
  }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}));

type StartupStorefrontPrefetchModule =
  typeof import('./startup-storefront-prefetch');

function loadModule(): StartupStorefrontPrefetchModule {
  return require('./startup-storefront-prefetch') as StartupStorefrontPrefetchModule;
}

function mockCategoriesQuery(result: unknown) {
  const order = jest.fn(async () => result);
  const merchantEq = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ eq: merchantEq }));
  mockFrom.mockReturnValueOnce({ select });

  return { merchantEq, order, select };
}

function mockPageConfigQuery(result: unknown) {
  const maybeSingle = jest.fn(async () => result);
  const isPublishedEq = jest.fn(() => ({ maybeSingle }));
  const pageSlugEq = jest.fn(() => ({ eq: isPublishedEq }));
  const merchantEq = jest.fn(() => ({ eq: pageSlugEq }));
  const select = jest.fn(() => ({ eq: merchantEq }));
  mockFrom.mockReturnValueOnce({ select });

  return { isPublishedEq, maybeSingle, merchantEq, pageSlugEq, select };
}

describe('prefetchStartupStorefrontData', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockWithSupabaseRetry.mockImplementation(
      async <T>(operation: () => Promise<T> | T): Promise<T> =>
        await operation()
    );
  });

  it('fetches startup categories through the expected Supabase query', async () => {
    const { fetchStartupCategories } = loadModule();
    const categories = [
      {
        id: 'cat-1',
        image_url: 'https://cdn.example.com/cat.png',
        name: 'Phones',
        slug: 'phones',
      },
    ];
    const query = mockCategoriesQuery({ data: categories, error: null });

    await expect(fetchStartupCategories()).resolves.toEqual(categories);

    expect(mockWithSupabaseRetry).toHaveBeenCalledWith(expect.any(Function), {
      maxRetries: 3,
      onRetry: expect.any(Function),
    });
    expect(mockFrom).toHaveBeenCalledWith('categories');
    expect(query.select).toHaveBeenCalledWith('id, name, slug, image_url');
    expect(query.merchantEq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-123'
    );
    expect(query.order).toHaveBeenCalledWith('name');
  });

  it('filters malformed startup category rows', async () => {
    const { fetchStartupCategories } = loadModule();
    mockCategoriesQuery({
      data: [
        { id: 'cat-1', image_url: null, name: 'Phones', slug: 'phones' },
        { id: 'cat-2', name: 'Laptops', slug: 'laptops' },
        { id: 'cat-3', name: null, slug: 'broken' },
      ],
      error: null,
    });

    await expect(fetchStartupCategories()).resolves.toEqual([
      { id: 'cat-1', name: 'Phones', slug: 'phones' },
      { id: 'cat-2', name: 'Laptops', slug: 'laptops' },
    ]);
  });

  it('throws when startup category prefetch receives a Supabase error', async () => {
    const { fetchStartupCategories } = loadModule();
    const error = new Error('categories unavailable');
    mockCategoriesQuery({ data: null, error });

    await expect(fetchStartupCategories()).rejects.toThrow(
      'categories unavailable'
    );
  });

  it('fetches and validates startup page config', async () => {
    const { fetchStartupPageConfig } = loadModule();
    const pageConfig = {
      content: [{ props: { id: 'products' }, type: 'ProductGrid' }],
      root: { props: { title: 'Home' } },
    };
    const query = mockPageConfigQuery({
      data: { published_config: pageConfig },
      error: null,
    });

    await expect(fetchStartupPageConfig()).resolves.toEqual(pageConfig);

    expect(mockWithSupabaseRetry).toHaveBeenCalledWith(expect.any(Function), {
      maxRetries: 3,
      onRetry: expect.any(Function),
    });
    expect(mockFrom).toHaveBeenCalledWith('page_configs');
    expect(query.select).toHaveBeenCalledWith('published_config');
    expect(query.merchantEq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-123'
    );
    expect(query.pageSlugEq).toHaveBeenCalledWith('page_slug', 'home');
    expect(query.isPublishedEq).toHaveBeenCalledWith('is_published', true);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('returns null when startup page config is missing', async () => {
    const { fetchStartupPageConfig } = loadModule();
    mockPageConfigQuery({ data: null, error: null });

    await expect(fetchStartupPageConfig()).resolves.toBeNull();
  });

  it('warns and returns null when startup page config is invalid', async () => {
    const { fetchStartupPageConfig } = loadModule();
    mockPageConfigQuery({
      data: { published_config: { content: [{ props: {}, type: '' }] } },
      error: null,
    });

    await expect(fetchStartupPageConfig()).resolves.toBeNull();

    expect(mockWarn).toHaveBeenCalledWith(
      'Invalid startup page config payload',
      expect.objectContaining({ slug: 'home' })
    );
  });

  it('throws when startup page config prefetch receives a Supabase error', async () => {
    const { fetchStartupPageConfig } = loadModule();
    const error = new Error('page config unavailable');
    mockPageConfigQuery({ data: null, error });

    await expect(fetchStartupPageConfig()).rejects.toThrow(
      'page config unavailable'
    );
  });

  it('prewarms home storefront queries once with the products key used by the default grid', async () => {
    const { prefetchStartupStorefrontData, STARTUP_HOME_PRODUCTS_OPTIONS } =
      loadModule();

    mockPrefetchInfiniteQuery.mockResolvedValue(undefined);
    mockPrefetchQuery.mockResolvedValue(undefined);

    await prefetchStartupStorefrontData();
    await prefetchStartupStorefrontData();

    expect(mockPrefetchQuery).toHaveBeenCalledTimes(2);
    expect(mockPrefetchQuery).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        queryKey: ['categories', 'merchant-123'],
      })
    );
    expect(mockPrefetchQuery).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        queryKey: ['page_config', 'home', 'merchant-123'],
      })
    );
    expect(mockPrefetchInfiniteQuery).toHaveBeenCalledTimes(1);
    expect(mockPrefetchInfiniteQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        initialPageParam: 0,
        queryKey: ['products', 'merchant-123', STARTUP_HOME_PRODUCTS_OPTIONS],
      })
    );
    expect(STARTUP_HOME_PRODUCTS_OPTIONS).toEqual({ limit: 12 });
  });

  it('allows startup prewarm to retry after a rejected prefetch', async () => {
    const { prefetchStartupStorefrontData } = loadModule();

    mockPrefetchQuery.mockRejectedValueOnce(new Error('categories failed'));
    mockPrefetchQuery.mockResolvedValue(undefined);
    mockPrefetchInfiniteQuery.mockResolvedValue(undefined);

    await prefetchStartupStorefrontData();
    await prefetchStartupStorefrontData();

    expect(mockPrefetchQuery).toHaveBeenCalledTimes(4);
    expect(mockPrefetchInfiniteQuery).toHaveBeenCalledTimes(2);
  });

  it('catches synchronous prefetch scheduling failures', async () => {
    const { prefetchStartupStorefrontData } = loadModule();
    const error = new Error('query client unavailable');
    mockPrefetchQuery.mockImplementationOnce(() => {
      throw error;
    });

    await expect(prefetchStartupStorefrontData()).resolves.toBeUndefined();

    expect(mockWarn).toHaveBeenCalledWith(
      'Startup storefront prefetch failed before scheduling',
      { error }
    );
  });
});
