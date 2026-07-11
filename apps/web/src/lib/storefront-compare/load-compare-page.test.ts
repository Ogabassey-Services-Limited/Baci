import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadComparePage } from './load-compare-page';

const mockGetMerchantByIdentifier = vi.fn();
const mockGetCachedCompareCategoryInventory = vi.fn();
const mockGetCachedProductWithDetails = vi.fn();
const mockGetCachedFeatureSettings = vi.fn();
const mockGetPublishedClusterPosts = vi.fn();
const mockGetCachedProductSemanticInventory = vi.fn();
vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
  getCachedProductWithDetails: (...args: unknown[]) =>
    mockGetCachedProductWithDetails(...args),
  getCachedFeatureSettings: (...args: unknown[]) =>
    mockGetCachedFeatureSettings(...args),
}));

vi.mock('./get-cached-compare-category-inventory', () => ({
  getCachedCompareCategoryInventory: (...args: unknown[]) =>
    mockGetCachedCompareCategoryInventory(...args),
}));

vi.mock('@/lib/storefront-content/get-published-cluster-posts', () => ({
  getPublishedClusterPosts: (...args: unknown[]) =>
    mockGetPublishedClusterPosts(...args),
}));

vi.mock(
  '@/lib/storefront-product/get-cached-product-semantic-inventory',
  () => ({
    getCachedProductSemanticInventory: (...args: unknown[]) =>
      mockGetCachedProductSemanticInventory(...args),
  })
);

const merchant = {
  id: 'merchant-1',
  slug: 'ogabassey',
  business_name: 'Ogabassey',
  payout_currency: 'NGN',
};

// Detail-shaped fixtures; the inventory projection derives from these below.
const categoryPageData = {
  isCollection: false,
  fallbackName: 'Smartphones',
  products: [
    {
      id: 'product-a',
      slug: 'iphone-17-pro-max',
      name: 'iPhone 17 Pro Max',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Apple',
      price: 2_200_000,
      product_key_specs: { chipset: 'A19 Pro', ram_gb: 8, storage_gb: 256 },
    },
    {
      id: 'product-b',
      slug: 'samsung-galaxy-z-trifold',
      name: 'Samsung Galaxy Z TriFold',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Samsung',
      price: 2_300_000,
      product_key_specs: {
        chipset: 'Snapdragon 8 Elite',
        ram_gb: 16,
        storage_gb: 512,
      },
    },
    {
      id: 'product-c',
      slug: 'galaxy-a56',
      name: 'Galaxy A56',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Samsung',
      price: 480_000,
      product_key_specs: { chipset: 'Exynos', ram_gb: 8, storage_gb: 128 },
    },
    {
      id: 'product-d',
      slug: 'iphone-16e',
      name: 'iPhone 16e',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Apple',
      price: 495_000,
      product_key_specs: { chipset: 'A18', ram_gb: 8, storage_gb: 128 },
    },
    {
      id: 'product-e',
      slug: 'iphone-15',
      name: 'iPhone 15',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Apple',
      price: 650_000,
      product_key_specs: { chipset: 'A17', ram_gb: 8, storage_gb: 128 },
    },
    {
      id: 'product-f',
      slug: 'iphone-se',
      name: 'iPhone SE',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Apple',
      price: 550_000,
      product_key_specs: { chipset: 'A13', ram_gb: 4, storage_gb: 64 },
    },
    {
      id: 'product-g',
      slug: 'galaxy-s24-fe',
      name: 'Galaxy S24 FE',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Samsung',
      price: 700_000,
      product_key_specs: {
        chipset: 'Exynos 2400e',
        ram_gb: 8,
        storage_gb: 256,
      },
    },
    {
      id: 'product-h',
      slug: 'galaxy-a36',
      name: 'Galaxy A36',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Samsung',
      price: 360_000,
      product_key_specs: {
        chipset: 'Snapdragon 6 Gen 3',
        ram_gb: 8,
        storage_gb: 128,
      },
    },
  ],
};

function toCompareInventory(data: typeof categoryPageData) {
  return {
    isCollection: data.isCollection,
    fallbackName: data.fallbackName,
    products: data.products.map((product) => ({
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      price: product.price,
      category_slug: product.category_slug,
      status: 'active',
      product_key_specs: product.product_key_specs,
    })),
  };
}

describe('loadComparePage', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    mockGetMerchantByIdentifier.mockReset();
    mockGetCachedCompareCategoryInventory.mockReset();
    mockGetCachedProductWithDetails.mockReset();
    mockGetCachedFeatureSettings.mockReset();
    mockGetPublishedClusterPosts.mockReset();
    mockGetCachedProductSemanticInventory.mockReset();
    mockGetMerchantByIdentifier.mockResolvedValue(merchant);
    mockGetCachedCompareCategoryInventory.mockResolvedValue(
      toCompareInventory(categoryPageData)
    );
    mockGetCachedFeatureSettings.mockResolvedValue({ blog_enabled: false });
    mockGetPublishedClusterPosts.mockResolvedValue([]);
    mockGetCachedProductSemanticInventory.mockResolvedValue(
      categoryPageData.products.map((product) => ({
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        price: product.price,
        category_slug: product.category_slug,
        product_key_specs: product.product_key_specs,
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a canonical product-vs-product page model for eligible products', async () => {
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categoryPageData.products[0],
      product_key_specs: { chipset: 'A19 Pro', ram_gb: 8, storage_gb: 256 },
    });
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categoryPageData.products[1],
      product_key_specs: {
        chipset: 'Snapdragon 8 Elite',
        ram_gb: 16,
        storage_gb: 512,
      },
    });

    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    });

    expect(result?.kind).toBe('product');
    expect(result?.canonicalSlug).toBe(
      'iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
    );
    expect(result?.canonicalUrl).toBe(
      'http://localhost:3000/ogabassey/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
    );
    expect(result?.metaTitle).toBe(
      'iPhone 17 Pro Max vs Samsung Galaxy Z TriFold in Nigeria | Ogabassey'
    );
    expect(result?.metaDescription).toContain(
      'Compare iPhone 17 Pro Max vs Samsung Galaxy Z TriFold in Nigeria by price, specs'
    );
    expect(result?.faqItems[0]?.question).toBe(
      'Which is better in Nigeria, iPhone 17 Pro Max or Samsung Galaxy Z TriFold?'
    );
    expect(result?.comparisonRows[0]).toMatchObject({
      label: expect.any(String),
      leftValue: expect.any(String),
      rightValue: expect.any(String),
    });
    expect(result?.breadcrumbItems.at(-1)?.url).toBe(result?.canonicalUrl);
    expect(result?.relatedCompareLinks.length).toBeLessThanOrEqual(6);
    expect(
      result?.relatedCompareLinks.some(
        (link) => link.comparisonSlug === result.canonicalSlug
      )
    ).toBe(false);
  });

  it('keeps full product names in metaTitle when the pair exceeds the SERP display cap', async () => {
    const longLeft = {
      ...categoryPageData.products[0],
      name: 'Samsung Galaxy S26 Ultra 5G Titanium Black 12GB RAM 512GB',
    };
    const longRight = {
      ...categoryPageData.products[1],
      name: 'Samsung Galaxy S26 Ultra 5G Titanium Gray 16GB RAM 1TB Dual SIM',
    };
    mockGetCachedCompareCategoryInventory.mockResolvedValue(
      toCompareInventory({
        ...categoryPageData,
        products: [longLeft, longRight, ...categoryPageData.products.slice(2)],
      })
    );
    mockGetCachedProductWithDetails.mockResolvedValueOnce(longLeft);
    mockGetCachedProductWithDetails.mockResolvedValueOnce(longRight);

    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    });

    expect(result?.kind).toBe('product');
    // Distinguishing tail tokens must survive: truncating them collapses
    // distinct comparisons into byte-identical duplicate titles.
    expect(result?.metaTitle).toBe(
      `${longLeft.name} vs ${longRight.name} in Nigeria | Ogabassey`
    );
    expect(result?.metaTitle).not.toContain('...');
  });

  it('returns a canonical brand-vs-brand page model when both brands pass thresholds', async () => {
    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'apple-vs-samsung',
    });

    expect(result?.kind).toBe('brand');
    expect(result?.canonicalSlug).toBe('apple-vs-samsung');
    expect(result?.heading).toBe('Apple vs Samsung Smartphones in Nigeria');
    expect(result?.metaDescription).toContain(
      'Compare Apple and Samsung smartphones in Nigeria by live model count'
    );
    expect(result?.summaryVerdict).toMatch(/smartphones shoppers in Nigeria/i);
    expect(result?.faqItems.length).toBeGreaterThan(0);
    expect(result?.comparisonRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Active models' }),
      ])
    );
    expect(mockGetCachedProductSemanticInventory).not.toHaveBeenCalled();
  });

  it('keeps the full brand-vs-brand metaTitle when a long category name exceeds the SERP display cap', async () => {
    // A long category name pushes "{leftBrand} vs {rightBrand} {category}"
    // past the 60-char SERP display cap; without the higher compare cap the
    // tail is sliced off and distinct brand pages collapse into duplicate
    // titles.
    mockGetCachedCompareCategoryInventory.mockResolvedValue(
      toCompareInventory({
        ...categoryPageData,
        fallbackName: 'Premium Flagship Android and iOS Smartphones',
      })
    );

    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'apple-vs-samsung',
    });

    expect(result?.kind).toBe('brand');
    expect(result?.metaTitle).toBe(
      'Apple vs Samsung Premium Flagship Android and iOS Smartphones in Nigeria | Ogabassey'
    );
    expect(result?.metaTitle).not.toContain('...');
  });

  it('keeps product compare pages indexable when detail payloads omit key specs but still expose rich spec rows', async () => {
    const leftDetail = {
      ...categoryPageData.products[0],
      specs: [
        { label: 'Processor', value: 'A19 Pro' },
        { label: 'RAM', value: '8GB' },
        { label: 'Storage', value: '256GB' },
      ],
    };
    const rightDetail = {
      ...categoryPageData.products[1],
      specs: [
        { label: 'Processor', value: 'Snapdragon 8 Elite' },
        { label: 'RAM', value: '16GB' },
        { label: 'Storage', value: '512GB' },
      ],
    };

    mockGetCachedProductWithDetails.mockResolvedValueOnce(leftDetail);
    mockGetCachedProductWithDetails.mockResolvedValueOnce(rightDetail);

    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    });

    expect(result?.kind).toBe('product');
    expect(result?.isIndexable).toBe(true);
    expect(result?.canonicalSlug).toBe(
      'iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
    );
    expect(result?.canonicalUrl).toBe(
      'http://localhost:3000/ogabassey/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
    );
  });

  it('does not block product detail fetches behind guide post loading', async () => {
    let resolveGuidePosts: ((value: []) => void) | undefined;
    const guidePostsPromise = new Promise<[]>((resolve) => {
      resolveGuidePosts = resolve;
    });
    const detailSlugs: string[] = [];

    mockGetPublishedClusterPosts.mockReturnValueOnce(guidePostsPromise);
    mockGetCachedProductWithDetails.mockImplementation(
      (_merchantId: string, productSlug: string) => {
        detailSlugs.push(productSlug);

        return productSlug === 'iphone-17-pro-max'
          ? {
              ...categoryPageData.products[0],
              product_key_specs: {
                chipset: 'A19 Pro',
                ram_gb: 8,
                storage_gb: 256,
              },
            }
          : {
              ...categoryPageData.products[1],
              product_key_specs: {
                chipset: 'Snapdragon 8 Elite',
                ram_gb: 16,
                storage_gb: 512,
              },
            };
      }
    );

    const resultPromise = loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    });

    await vi.waitFor(() => {
      expect(detailSlugs).toEqual([
        'iphone-17-pro-max',
        'samsung-galaxy-z-trifold',
      ]);
    });

    expect(resolveGuidePosts).toBeDefined();
    expect(mockGetPublishedClusterPosts).toHaveBeenCalledWith('merchant-1', {
      pageKind: 'compare',
      categorySlug: 'smartphones',
      productSlugs: ['iphone-17-pro-max', 'samsung-galaxy-z-trifold'],
    });
    resolveGuidePosts?.([]);

    await expect(resultPromise).resolves.toMatchObject({
      kind: 'product',
      canonicalSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    });
  });

  it('marks maintained graph-emitted product compare routes as indexable', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // No fallback warning should be emitted for a graph-emitted pair.
    });

    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categoryPageData.products[5],
      product_key_specs: { chipset: 'A13', ram_gb: 4, storage_gb: 64 },
    });
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categoryPageData.products[1],
      product_key_specs: {
        chipset: 'Snapdragon 8 Elite',
        ram_gb: 16,
        storage_gb: 512,
      },
    });

    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'iphone-se-vs-samsung-galaxy-z-trifold',
    });

    expect(result?.kind).toBe('product');
    expect(result?.isIndexable).toBe(true);
    expect(result?.isLegacyFallback).toBe(false);
    expect(result?.canonicalSlug).toBe('iphone-se-vs-samsung-galaxy-z-trifold');
    expect(warnSpy).not.toHaveBeenCalledWith(
      'COMPARE_NON_CURATED_FALLBACK',
      expect.anything()
    );

    warnSpy.mockRestore();
  });

  it('keeps reversed maintained graph product compare routes non-indexable', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Suppress expected non-canonical fallback warning.
    });
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categoryPageData.products[1],
      product_key_specs: {
        chipset: 'Snapdragon 8 Elite',
        ram_gb: 16,
        storage_gb: 512,
      },
    });
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categoryPageData.products[5],
      product_key_specs: { chipset: 'A13', ram_gb: 4, storage_gb: 64 },
    });

    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'samsung-galaxy-z-trifold-vs-iphone-se',
    });

    expect(result?.kind).toBe('product');
    expect(result?.canonicalSlug).toBe('iphone-se-vs-samsung-galaxy-z-trifold');
    expect(result?.isIndexable).toBe(false);
    expect(result?.isLegacyFallback).toBe(true);

    warnSpy.mockRestore();
  });

  it('keeps valid PDP-emitted compare routes indexable when the anchor is outside bounded graph inventory', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // No fallback warning should be emitted for a valid clicked pair.
    });
    // Persistent (not ...Once) so BOTH bounded-inventory reads — loadCompareGraphProducts
    // AND getCachedCategoryCompareGraphSlugs — see only samsung. iphone-17-pro-max is thus
    // an OVERFLOW clicked product (resolved from the larger compare inventory but absent from
    // the bounded semantic inventory), so routeApprovalProducts outgrows semanticCompareProducts
    // and the overflow guard forces the uncached graph rebuild over routeApprovalProducts
    // (bounded inventory + the clicked iphone-17-pro-max) rather than trusting the bounded
    // cached set, which cannot attest to the overflow pair. This is the branch the test exists
    // to protect; without the overflow/uncached path it would fall to the narrower anchored
    // check (or a stale cached set) and could de-index a valid clicked pair.
    mockGetCachedProductSemanticInventory.mockResolvedValue([
      {
        slug: 'samsung-galaxy-z-trifold',
        name: 'Samsung Galaxy Z TriFold',
        brand: 'Samsung',
        price: 2_300_000,
        category_slug: 'smartphones',
        product_key_specs: {
          chipset: 'Snapdragon 8 Elite',
          ram_gb: 16,
          storage_gb: 512,
        },
      },
    ]);
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categoryPageData.products[0],
      product_key_specs: { chipset: 'A19 Pro', ram_gb: 8, storage_gb: 256 },
    });
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categoryPageData.products[1],
      product_key_specs: {
        chipset: 'Snapdragon 8 Elite',
        ram_gb: 16,
        storage_gb: 512,
      },
    });

    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    });

    expect(result?.kind).toBe('product');
    expect(result?.isIndexable).toBe(true);
    expect(result?.isLegacyFallback).toBe(false);
    expect(warnSpy).not.toHaveBeenCalledWith(
      'COMPARE_NON_CURATED_FALLBACK',
      expect.anything()
    );

    warnSpy.mockRestore();
  });

  it('keeps clicked inactive products from approving maintained compare routes', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Suppress expected non-maintained fallback warning.
    });
    const inactiveLeft = {
      ...categoryPageData.products[0],
      status: 'draft',
    };
    const activeRight = {
      ...categoryPageData.products[1],
      status: 'active',
    };
    // A product can go draft after the inventory entry was cached; the graph
    // approval path must still reject it via the clicked product's status.
    const staleInventory = toCompareInventory({
      ...categoryPageData,
      products: [inactiveLeft, activeRight],
    });
    staleInventory.products[0].status = 'draft';
    mockGetCachedCompareCategoryInventory.mockResolvedValueOnce(staleInventory);
    // Persistent (not Once): getCachedProductSemanticInventory is now read twice
    // per render — by loadCompareGraphProducts (anchored checks) AND by the
    // per-category cached graph-slug set. In prod both hit the same
    // status='active'-filtered query, so the draft left product is absent from
    // both; the mock mirrors that so the clicked-inactive rejection still holds.
    mockGetCachedProductSemanticInventory.mockResolvedValue([
      {
        slug: 'samsung-galaxy-z-trifold',
        name: 'Samsung Galaxy Z TriFold',
        brand: 'Samsung',
        price: 2_300_000,
        category_slug: 'smartphones',
        product_key_specs: {
          chipset: 'Snapdragon 8 Elite',
          ram_gb: 16,
          storage_gb: 512,
        },
      },
    ]);
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...inactiveLeft,
      product_key_specs: { chipset: 'A19 Pro', ram_gb: 8, storage_gb: 256 },
    });
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...activeRight,
      product_key_specs: {
        chipset: 'Snapdragon 8 Elite',
        ram_gb: 16,
        storage_gb: 512,
      },
    });

    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    });

    expect(result?.kind).toBe('product');
    expect(result?.isIndexable).toBe(false);
    expect(result?.isLegacyFallback).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      'COMPARE_NON_CURATED_FALLBACK',
      expect.objectContaining({
        comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
      })
    );

    warnSpy.mockRestore();
  });

  it('degrades a bounded-graph-inventory failure to the curated-slug fallback per request without 404ing or caching it', async () => {
    // The graph inventory (related links + graph-based approval) is auxiliary:
    // it is loaded per-request OUTSIDE the remote-cached model, so a transient
    // failure degrades this one request (curated-slug fallback indexability,
    // empty related links) instead of caching a degraded model for the window
    // or 404ing an otherwise-valid compare page.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Suppress expected bounded-inventory warning.
    });
    mockGetCachedProductSemanticInventory.mockRejectedValueOnce(
      new Error('inventory timeout')
    );
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categoryPageData.products[0],
      product_key_specs: { chipset: 'A19 Pro', ram_gb: 8, storage_gb: 256 },
    });
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categoryPageData.products[1],
      product_key_specs: {
        chipset: 'Snapdragon 8 Elite',
        ram_gb: 16,
        storage_gb: 512,
      },
    });

    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    });

    expect(result?.kind).toBe('product');
    expect(result?.isIndexable).toBe(true);
    expect(result?.isLegacyFallback).toBe(false);
    expect(result?.relatedCompareLinks).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to load bounded compare graph inventory',
      expect.objectContaining({
        categorySlug: 'smartphones',
        merchantId: 'merchant-1',
      })
    );

    warnSpy.mockRestore();
  });

  it('keeps a graph-maintained non-curated compare route indexable when only the cached slug-set read fails', async () => {
    // Regression guard (Codex P2): when the per-category slug-set read fails but
    // the bounded inventory read succeeded, indexability must be decided by the
    // UNCACHED graph rebuild over routeApprovalProducts — NOT demoted to the
    // curated-only decision. iphone-15-vs-iphone-se is graph-maintained but is
    // absent from the curated discovery set, so a curated-only fallback would
    // wrongly mark this valid page legacy/noindex.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Suppress the expected slug-set load-failure warning.
    });
    const fullSemanticInventory = categoryPageData.products.map((product) => ({
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      price: product.price,
      category_slug: product.category_slug,
      product_key_specs: product.product_key_specs,
    }));
    // 1st read (loadCompareGraphProducts) succeeds; 2nd read
    // (getCachedCategoryCompareGraphSlugs) fails -> loadCategoryCompareGraphSlugs
    // returns null while routeApprovalProducts is fully populated.
    mockGetCachedProductSemanticInventory
      .mockResolvedValueOnce(fullSemanticInventory)
      .mockRejectedValueOnce(new Error('slug-set cache timeout'));
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categoryPageData.products[4],
      product_key_specs: { chipset: 'A17', ram_gb: 8, storage_gb: 128 },
    });
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categoryPageData.products[5],
      product_key_specs: { chipset: 'A13', ram_gb: 4, storage_gb: 64 },
    });

    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'iphone-15-vs-iphone-se',
    });

    expect(result?.kind).toBe('product');
    expect(result?.isIndexable).toBe(true);
    expect(result?.isLegacyFallback).toBe(false);
    // Proves the decision came from the graph, not the curated set: a curated
    // fallback would have emitted the non-curated warning and de-indexed it.
    expect(warnSpy).not.toHaveBeenCalledWith(
      'COMPARE_NON_CURATED_FALLBACK',
      expect.anything()
    );
    // The bounded inventory itself did NOT fail — only the slug-set read did.
    expect(warnSpy).not.toHaveBeenCalledWith(
      'Failed to load bounded compare graph inventory',
      expect.anything()
    );
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to load category compare graph slugs',
      expect.objectContaining({ categorySlug: 'smartphones' })
    );

    warnSpy.mockRestore();
  });

  it('degrades a guide-post load failure to empty guide links per request without 404ing the page', async () => {
    // Buyer-guide links are auxiliary and loaded per-request outside the cache
    // (loadPublishedClusterPostsSafely degrades to [] by contract). A transient
    // guide-RPC failure must not cache empty guideLinks for the window, nor
    // 404 the compare page — it renders with guideLinks: [].
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Suppress expected guide-load warning.
    });
    mockGetPublishedClusterPosts.mockRejectedValueOnce(
      new Error('guide rpc timeout')
    );
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categoryPageData.products[0],
      product_key_specs: { chipset: 'A19 Pro', ram_gb: 8, storage_gb: 256 },
    });
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categoryPageData.products[1],
      product_key_specs: {
        chipset: 'Snapdragon 8 Elite',
        ram_gb: 16,
        storage_gb: 512,
      },
    });

    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    });

    expect(result?.kind).toBe('product');
    expect(result?.guideLinks).toEqual([]);
    expect(result?.isIndexable).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to load bounded storefront guide candidates',
      expect.objectContaining({ merchantId: 'merchant-1' })
    );

    warnSpy.mockRestore();
  });

  it('returns null when the identifier resolves to a different merchant inside the cached model than for the caller', async () => {
    // Outer per-request resolution (which forms the cache key) sees
    // merchant-1 …
    mockGetMerchantByIdentifier.mockResolvedValueOnce(merchant);
    // … but by the time the cached fill re-resolves the identifier, the slug
    // has been reassigned to another tenant (slug rename + reuse, or custom
    // domain reassignment). The cached builder must refuse to build a model
    // for the mismatched tenant instead of serving cross-tenant content.
    mockGetMerchantByIdentifier.mockResolvedValueOnce({
      ...merchant,
      id: 'merchant-2',
    });

    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    });

    expect(result).toBeNull();
    expect(mockGetCachedCompareCategoryInventory).not.toHaveBeenCalled();
  });

  describe('slug safety gate', () => {
    const overEncodedSlug = (() => {
      let value = 'x y';
      for (let index = 0; index < 10; index += 1) {
        value = encodeURIComponent(value);
      }
      return value;
    })();
    const overLongSlug = 'a'.repeat(4000);

    it('returns null for a repeatedly percent-encoded category slug without hitting the cached category lookup', async () => {
      const result = await loadComparePage({
        merchantSlug: 'ogabassey',
        categorySlug: overEncodedSlug,
        comparisonSlug: 'apple-vs-samsung',
      });

      expect(result).toBeNull();
      expect(mockGetCachedCompareCategoryInventory).not.toHaveBeenCalled();
      expect(mockGetCachedProductWithDetails).not.toHaveBeenCalled();
    });

    it('returns null for an over-long category slug without hitting the cached category lookup', async () => {
      const result = await loadComparePage({
        merchantSlug: 'ogabassey',
        categorySlug: overLongSlug,
        comparisonSlug: 'apple-vs-samsung',
      });

      expect(result).toBeNull();
      expect(mockGetCachedCompareCategoryInventory).not.toHaveBeenCalled();
    });

    it('returns null when a parsed compare half is over-long, before the cached lookups', async () => {
      const result = await loadComparePage({
        merchantSlug: 'ogabassey',
        categorySlug: 'smartphones',
        comparisonSlug: `${overLongSlug}-vs-${overLongSlug}`,
      });

      expect(result).toBeNull();
      expect(mockGetCachedCompareCategoryInventory).not.toHaveBeenCalled();
      expect(mockGetCachedProductWithDetails).not.toHaveBeenCalled();
    });

    it('does NOT 404 a legitimate long composite compare slug (two <=200-char product slugs)', async () => {
      // Each half is a valid single product slug (~131 chars, <=200); the
      // composite (~266 chars) exceeds the single-slug 255 cap but must NOT be
      // gated — the parsed halves are each within bound, so the category lookup
      // still runs. Regression test for the composite-length false positive.
      const longLeft = `aa${'-bb'.repeat(43)}`;
      const longRight = `cc${'-dd'.repeat(43)}`;

      await loadComparePage({
        merchantSlug: 'ogabassey',
        categorySlug: 'smartphones',
        comparisonSlug: `${longLeft}-vs-${longRight}`,
      });

      expect(mockGetCachedCompareCategoryInventory).toHaveBeenCalledWith(
        'merchant-1',
        'smartphones',
        'ogabassey'
      );
    });

    it('still resolves a valid short slug through the cached category lookup', async () => {
      const result = await loadComparePage({
        merchantSlug: 'ogabassey',
        categorySlug: 'smartphones',
        comparisonSlug: 'apple-vs-samsung',
      });

      expect(mockGetCachedCompareCategoryInventory).toHaveBeenCalledWith(
        'merchant-1',
        'smartphones',
        'ogabassey'
      );
      expect(result?.kind).toBe('brand');
    });
  });

  it('degrades a transient product-detail failure to a per-request null without caching it', async () => {
    // getCachedProductWithDetails returns null on transient query errors; the
    // cached model builder must THROW (so Cache Components never stores a
    // cached 404 for the revalidate window) and the per-request wrapper must
    // degrade that single request to null.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Suppress expected model-failure log.
    });
    mockGetCachedProductWithDetails.mockResolvedValue(null);

    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    });

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to load compare page model',
      expect.objectContaining({
        comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
        error: expect.objectContaining({
          message: expect.stringContaining(
            'Compare product details unavailable'
          ),
        }),
      })
    );

    errorSpy.mockRestore();
  });

  it('resolves compare pages from custom-domain storefront identifiers', async () => {
    mockGetMerchantByIdentifier.mockResolvedValueOnce({
      ...merchant,
      custom_domain: 'ogabassey.com',
    });

    const result = await loadComparePage({
      merchantSlug: 'ogabassey.com',
      categorySlug: 'smartphones',
      comparisonSlug: 'apple-vs-samsung',
    });

    expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('ogabassey.com');
    expect(mockGetCachedCompareCategoryInventory).toHaveBeenCalledWith(
      merchant.id,
      'smartphones',
      'ogabassey.com'
    );
    expect(result?.kind).toBe('brand');
  });
});
