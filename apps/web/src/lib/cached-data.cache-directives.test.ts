import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as TypeScript from '@typescript/typescript6';
import { describe, expect, it } from 'vitest';
import { CACHE_LIFE_PROFILES } from '@/config/cache-life-profiles';

const require = createRequire(import.meta.url);
// The classic compiler API used below is gone from typescript@7 (native
// compiler), so this test pins Microsoft's @typescript/typescript6 compat
// package instead of the workspace `typescript` version.
const ts = require('@typescript/typescript6') as typeof TypeScript;
const CACHED_DATA_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'cached-data.ts'),
  'utf8'
);
const CACHED_DATA_AST = ts.createSourceFile(
  'cached-data.ts',
  CACHED_DATA_SOURCE,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);
const CATEGORY_PAGE_PRODUCT_ID_CACHE_SOURCE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    'category-page-product-id-cache.ts'
  ),
  'utf8'
);
const CATEGORY_PAGE_PRODUCT_ID_CACHE_AST = ts.createSourceFile(
  'category-page-product-id-cache.ts',
  CATEGORY_PAGE_PRODUCT_ID_CACHE_SOURCE,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);
const HYDRATE_PUBLIC_PRODUCTS_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'hydrate-public-products.ts'),
  'utf8'
);
const HYDRATE_PUBLIC_PRODUCTS_AST = ts.createSourceFile(
  'hydrate-public-products.ts',
  HYDRATE_PUBLIC_PRODUCTS_SOURCE,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);
const CATEGORY_PAGE_SHELL_SOURCE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    'cached-category-page-shell.ts'
  ),
  'utf8'
);
const CATEGORY_PAGE_SHELL_AST = ts.createSourceFile(
  'cached-category-page-shell.ts',
  CATEGORY_PAGE_SHELL_SOURCE,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);

function getFunctionSourceFrom(
  functionName: string,
  source: string,
  sourceFile: TypeScript.SourceFile
): string {
  let match: TypeScript.FunctionDeclaration | undefined;

  function visit(node: TypeScript.Node): void {
    if (match) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) {
      match = node;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!match) {
    throw new Error(
      `Unable to locate ${functionName} in ${sourceFile.fileName}`
    );
  }

  return source.slice(match.getStart(sourceFile), match.end);
}

function getFunctionSource(functionName: string): string {
  return getFunctionSourceFrom(
    functionName,
    CACHED_DATA_SOURCE,
    CACHED_DATA_AST
  );
}

function getCategoryPageShellFunctionSource(functionName: string): string {
  return getFunctionSourceFrom(
    functionName,
    CATEGORY_PAGE_SHELL_SOURCE,
    CATEGORY_PAGE_SHELL_AST
  );
}

function getCategoryPageProductIdCacheFunctionSource(
  functionName: string
): string {
  return getFunctionSourceFrom(
    functionName,
    CATEGORY_PAGE_PRODUCT_ID_CACHE_SOURCE,
    CATEGORY_PAGE_PRODUCT_ID_CACHE_AST
  );
}

describe('cached-data cache directives', () => {
  it('keeps hot storefront merchant lookups off the remote cache handler', () => {
    for (const functionName of [
      'getCachedMerchant',
      'getCachedMerchantByDomain',
      'getCachedFeatureSettings',
    ]) {
      const source = getFunctionSource(functionName);
      expect(source, functionName).toContain("'use cache';");
      expect(source, functionName).not.toContain("'use cache: remote';");
    }
  });

  it('keeps the category aggregate wrapper off the remote cache handler', () => {
    const source = getFunctionSource('getCachedCategoryPageData');

    expect(source).not.toContain("'use cache';");
    expect(source).not.toContain("'use cache: remote';");
    expect(source).not.toContain("cacheLife('storefront-page');");

    // The full category payload can include an unbounded product array, so the
    // wrapper must not write that whole aggregate into one remote cache item.
    expect(source).toContain('getCategoryPageShellData');
    expect(source).toContain('getCachedCategoryPageProducts');
  });

  it('keeps category detail chunk reads bounded and inventory-safe', () => {
    const detailsSource = getFunctionSource(
      'getCachedCategoryPageProductDetailsChunk'
    );
    const aggregateSource = getFunctionSource(
      'getCachedCategoryPageProductsUncached'
    );

    expect(CACHED_DATA_SOURCE).toContain('stock_quantity');
    expect(CACHED_DATA_SOURCE).toContain('manage_stock');
    expect(detailsSource).toContain('product_categories.category_id');
    expect(aggregateSource).toContain('mapWithConcurrency');
    expect(aggregateSource).toContain(
      'CATEGORY_PAGE_PRODUCT_DETAIL_CONCURRENCY'
    );
  });

  it('keeps transient category detail query fallbacks outside the cached chunk', () => {
    const cachedDetailsSource = getFunctionSource(
      'getCachedCategoryPageProductDetailsChunk'
    );
    const wrapperSource = getFunctionSource(
      'getCategoryPageProductDetailsChunk'
    );

    expect(cachedDetailsSource).toContain('throw error');
    expect(cachedDetailsSource).not.toContain('productIds.map(() => null)');
    expect(wrapperSource).toContain('Product detail query error:');
    expect(wrapperSource).toContain('productIds.map(() => null)');
  });

  it('keeps serialized inventory availability out of the products cache', () => {
    const hydrateSource = getFunctionSourceFrom(
      'hydrateAndSanitizePublicProducts',
      HYDRATE_PUBLIC_PRODUCTS_SOURCE,
      HYDRATE_PUBLIC_PRODUCTS_AST
    );

    expect(CACHED_DATA_SOURCE).not.toContain(
      'getCachedPublicSerializedVariantSummariesByProductId'
    );
    expect(CACHED_DATA_SOURCE).not.toContain('serialized-variant-summaries');
    expect(hydrateSource).toContain(
      'getPublicSerializedVariantSummariesByProductId'
    );
    expect(hydrateSource).toContain('supabase');
  });

  it('keeps storefront home and launch product caches shared across instances', () => {
    for (const functionName of [
      'getCachedStorefrontHomeProducts',
      'getCachedStorefrontLaunchProducts',
    ]) {
      const source = getFunctionSource(functionName);
      expect(source, functionName).toContain("'use cache: remote';");
    }
  });

  it('keeps the route-critical category page shell off the remote cache handler', () => {
    // The compare page model and compare category inventory were demoted from
    // 'use cache: remote' to local 'use cache' (PR #3049) because their Vercel
    // remote-cache SET (RemoteCacheHandler K.set) hangs and never persists under
    // crawler load. This shell is the LAST route-critical remote write on the
    // compare/category path — it is nested by the category listing page, both
    // compare reads, the price-band page, and the category-scoped semantic
    // inventory — and it is keyed on an unbounded (high-cardinality) category
    // slug. It therefore belongs on the same local cache: no remote write
    // round-trip, and its 'storefront-page' window (revalidate 300) already
    // bounds cross-instance staleness of the rarely-changing shell to ~5min.
    const source = getCategoryPageShellFunctionSource(
      'getCachedCategoryPageShellData'
    );

    expect(source).toContain("'use cache';");
    expect(source).not.toContain("'use cache: remote';");
    expect(source).toContain("cacheLife('storefront-page');");
    expect(source).toContain('cacheTag(');
    expect(source).not.toContain('_storeSlug');
  });

  it('keeps high-cardinality public product reads off the remote cache handler', () => {
    for (const functionName of [
      'getCachedProductLcpHint',
      'getCachedProductWithDetails',
    ]) {
      const source = getFunctionSource(functionName);
      expect(source, functionName).toContain("'use cache';");
      expect(source, functionName).not.toContain("'use cache: remote';");
      expect(source, functionName).toContain("cacheLife('products');");
      expect(source, functionName).toContain('cacheTag(');
    }
  });

  it('keeps the unbounded-key canonical redirect preflight off the remote cache handler (PR4a)', () => {
    // Keyed on arbitrary crawler product slugs (unbounded remote keys); origin
    // is an indexed slug/id .maybeSingle() (<15ms). Already fail-loud. The
    // remote SET is the exit-128 write hazard, so it must be local.
    const source = getFunctionSource('getCachedProductCanonicalRedirectTarget');
    expect(source).toContain("'use cache';");
    expect(source).not.toContain("'use cache: remote';");
    expect(source).toContain("cacheLife('products');");
    expect(source).toContain('cacheTag(');
  });

  it('keeps fast merchant-by-id lookups off the remote cache handler and fail-loud (PR4a)', () => {
    // Primary-key .single() (<5ms), ~75 keys, tiny row, no cross-instance need.
    // Fail-loud: a transient read must throw (never cache null-as-absence);
    // only a genuine PGRST116 "no rows" returns null. Both repair-notification
    // consumers already `.catch(() => null)`, so the throw degrades safely.
    const source = getFunctionSource('getCachedMerchantById');
    expect(source).toContain("'use cache';");
    expect(source).not.toContain("'use cache: remote';");
    expect(source).toContain('isPostgrestNoRowsError');
    expect(source).toContain('throw error');
  });

  it('caps the hydrated products payload and keeps it on the shared store (PR4b review r4)', () => {
    // Demotion REVERTED: `revalidateProducts()` busts `products-${merchantId}`
    // on every product create/update/delete, so this entry's freshness depends
    // on tag propagation — which only the SHARED store delivers cross-instance.
    // The row cap (the real exit-128 mitigation) is retained and matters MORE
    // on remote, where an oversized item is what fails the write.
    const source = getFunctionSource('getCachedProducts');
    expect(source).toContain("'use cache: remote';");
    expect(source).toContain("cacheLife('products');");
    expect(source).toContain('cacheTag(');
    expect(source).toContain('GET_CACHED_PRODUCTS_MAX_ROWS');
    expect(CACHED_DATA_SOURCE).toContain('const GET_CACHED_PRODUCTS_MAX_ROWS');
  });

  it('keeps the categories read on the shared store so nav invalidation propagates (PR4b review r4)', () => {
    // Demotion REVERTED: `revalidateCategories()` busts
    // `categories-${merchantId}`; a local entry on another instance would keep
    // serving retired storefront navigation until cacheLife expiry.
    const source = getFunctionSource('getCachedCategories');
    expect(source).toContain("'use cache: remote';");
    expect(source).toContain("cacheLife('categories');");
    expect(source).toContain('cacheTag(');
    expect(source).toContain('throw error');
  });

  it('keeps canonical category product IDs on the shared store while legacy IDs stay local', () => {
    // Demotion REVERTED (Codex PRRT_kwDOQZgfis6QjNxf): the
    // category-page-data-${id} / products-${id} / categories-${id} tags are
    // all busted by
    // revalidateProducts() and revalidateCategories(), so category membership
    // and counts MUST invalidate on every instance. The deterministic ID cap
    // stays (each scope branch orders by id last) to bound the cache item.
    const source = getCategoryPageProductIdCacheFunctionSource(
      'getCachedCategoryPageProductIds'
    );
    expect(source).toContain("'use cache: remote';");
    expect(source).toContain("cacheLife('storefront-page');");
    expect(source).toContain('cacheTag(');
    expect(source).toContain('CATEGORY_PAGE_PRODUCT_ID_CAP');
    expect(source).toContain('.limit(CATEGORY_PAGE_PRODUCT_ID_CAP)');
    expect(CATEGORY_PAGE_PRODUCT_ID_CACHE_SOURCE).toContain(
      'CATEGORY_PAGE_PRODUCT_ID_CAP'
    );
    expect(source).toContain('getCategoryPageDataCacheTag(merchantId)');

    const legacySource = getCategoryPageProductIdCacheFunctionSource(
      'getCachedLegacyCategoryPageProductIds'
    );
    expect(legacySource).toContain("'use cache';");
    expect(legacySource).not.toContain("'use cache: remote';");
    expect(legacySource).toContain('getCategoryPageDataCacheTag(merchantId)');
  });

  it('caches the exact count as its OWN entry so a count failure cannot empty the catalog (PR4b review r4)', () => {
    // Codex PRRT_kwDOQZgfis6QjNxX: folding the supplementary head-count into
    // the ID-list read meant a failed COUNT threw, the request-local boundary
    // caught it, and a category with a perfectly good ID window rendered an
    // EMPTY catalog. Core data must never be discarded because an auxiliary
    // query failed. The count now owns its own cached entry (a throw persists
    // NO entry, so the wrong count is never cached and the next request
    // refills), and the boundary degrades the TOTALS only.
    const idsSource = getCategoryPageProductIdCacheFunctionSource(
      'getCachedCategoryPageProductIds'
    );
    const countSource = getCategoryPageProductIdCacheFunctionSource(
      'getCachedCategoryPageProductTotalCount'
    );
    const boundarySource = getFunctionSource('getCategoryPageProductIds');

    // The ID list is CORE: it must not carry the count query at all.
    expect(idsSource).not.toContain("count: 'exact'");

    // The count is SUPPLEMENTARY, separately cached, and shares the ID list's
    // invalidation contract (so it must also be remote).
    expect(countSource).toContain("'use cache: remote';");
    expect(countSource).toContain("count: 'exact'");
    // No cap-equality gate in front of the count (max-rows clamp trap).
    expect(countSource).not.toContain('=== CATEGORY_PAGE_PRODUCT_ID_CAP');

    const legacyCountSource = getCategoryPageProductIdCacheFunctionSource(
      'getCachedLegacyCategoryPageProductTotalCount'
    );
    expect(legacyCountSource).toContain("'use cache';");
    expect(legacyCountSource).not.toContain("'use cache: remote';");
    expect(legacyCountSource).toContain("count: 'exact'");

    // The boundary keeps the IDs and degrades only the totals on count failure.
    expect(boundarySource).toContain('totalProductCountExact: false');
    expect(boundarySource).toContain('totalProductCount: productIds.length');
  });

  it('keeps pagination truthful past the capped ID list (PR4b review fix)', () => {
    // The cap bounds the cached ID list, but totalPages must reflect the EXACT
    // count or valid pages past the cap 404. The exact head-count query must
    // run UNCONDITIONALLY: PostgREST max-rows (managed default 1,000 — not
    // overridden in supabase/config.toml) clamps responses BELOW the 2,000
    // cap, so any "did we hit the cap?" gate silently reports the clamped
    // length as the total. Windows beyond the cached list are fetched
    // per-request with the same deterministic ordering, and no-limit
    // consumers get the FULL ID list assembled per-request.
    const countSource = getCategoryPageProductIdCacheFunctionSource(
      'getCachedCategoryPageProductTotalCount'
    );
    expect(countSource).toContain("count: 'exact'");
    const aggregateSource = getFunctionSource(
      'getCachedCategoryPageProductsUncached'
    );
    expect(aggregateSource).toContain('totalProductCount');
    expect(aggregateSource).toContain(
      'categoryPageProductIdCache.fetchProductIdWindow'
    );
    // Unbounded (no-limit) consumers assemble the complete ID list.
    expect(aggregateSource).toContain('fetchAllCategoryPageProductIds');
    // ...but NEVER page toward a total that the count query failed to produce.
    expect(aggregateSource).toContain('totalProductCountExact');
  });

  it('keeps dashboard stats on the shared store and fail-loud (PR4b review r4)', () => {
    // Demotion REVERTED: `dashboard-${merchantId}` is busted by
    // revalidateProducts(), revalidateMerchant() AND
    // revalidateMerchantPublication(). A merchant who adds a product expects
    // the dashboard to reflect it on whichever instance serves them. Still
    // fail-loud so a transient RPC error is never persisted as null.
    const source = getFunctionSource('getCachedDashboardStats');
    expect(source).toContain("'use cache: remote';");
    expect(source).toContain("cacheLife('merchant');");
    expect(source).toContain('cacheTag(');
    expect(source).toContain('throw error');
  });

  it('keeps platform analytics on the shared store and fail-loud (PR4b review r4)', () => {
    // Demotion REVERTED: the admin "refresh analytics views" route calls
    // revalidateAnalytics(), busting the `analytics` tag — an explicit,
    // user-triggered invalidation contract. A local entry would leave the
    // refresh button silently broken on every other instance. Still fail-loud
    // so a transient aggregate error is never cached as null.
    const source = getFunctionSource('getCachedPlatformAnalytics');
    expect(source).toContain("'use cache: remote';");
    expect(source).toContain("cacheLife('products');");
    expect(source).toContain('cacheTag(');
    expect(source).toContain('throw summaryError');
  });
});

describe('next.config cacheLife profiles', () => {
  it('defines a long-lived `blog` profile so near-static blog pages are not re-rendered every minute', () => {
    const { stale, revalidate, expire } = CACHE_LIFE_PROFILES.blog;
    // Server `revalidate` must be far less frequent than the hot merchant
    // profile (60s) to stop the re-render storm — but bounded (not days):
    // LOCAL Cache Components entries on this profile (e.g. getCachedBlogPost)
    // don't get guaranteed cross-instance tag eviction, so this window also
    // caps edit/delete staleness and missing-slug negative caching (Codex
    // review). Remote entries on the profile (getPublishedClusterPosts) DO
    // get cross-instance tag eviction; for them the window is purely a
    // write-churn bound.
    expect(revalidate).toBeGreaterThanOrEqual(1800); // >= 30 min
    expect(revalidate).toBeLessThanOrEqual(14400); // <= 4 hr
    // Keep client-side staleness short so edited posts surface quickly for
    // visitors who already have the page in their router cache.
    expect(stale).toBeLessThanOrEqual(600);
    expect(expire).toBeGreaterThanOrEqual(revalidate);
  });

  it('keeps product/PDP and compare cache revalidation at least 30 minutes', () => {
    const { stale, revalidate, expire } = CACHE_LIFE_PROFILES.products;
    expect(revalidate).toBeGreaterThanOrEqual(1800);
    expect(revalidate).toBeLessThanOrEqual(3600);
    expect(stale).toBeLessThanOrEqual(600);
    expect(expire).toBeGreaterThan(revalidate);
  });
});
