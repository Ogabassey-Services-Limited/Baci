import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as TypeScript from '@typescript/typescript6';
import { describe, expect, it } from 'vitest';

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

  visit(CACHED_DATA_AST);

  if (!match) {
    throw new Error(`Unable to locate ${functionName} in cached-data.ts`);
  }

  return CACHED_DATA_SOURCE.slice(match.getStart(CACHED_DATA_AST), match.end);
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
    const hydrateSource = getFunctionSource('hydrateAndSanitizeProducts');

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
    const source = getFunctionSource('getCachedCategoryPageShellData');

    expect(source).toContain("'use cache';");
    expect(source).not.toContain("'use cache: remote';");
    expect(source).toContain("cacheLife('storefront-page');");
    expect(source).toContain('cacheTag(');
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
});

describe('next.config cacheLife profiles', () => {
  const NEXT_CONFIG_SOURCE = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'next.config.ts'),
    'utf8'
  );

  it('defines a long-lived `blog` profile so near-static blog pages are not re-rendered every minute', () => {
    const match = NEXT_CONFIG_SOURCE.match(
      /blog:\s*\{\s*stale:\s*(\d+),\s*revalidate:\s*(\d+),\s*expire:\s*(\d+),?\s*\}/
    );
    expect(
      match,
      'blog cacheLife profile must be declared in next.config.ts'
    ).not.toBeNull();

    const [, stale, revalidate, expire] = match as RegExpMatchArray;
    // Server `revalidate` must be far less frequent than the hot merchant
    // profile (60s) to stop the re-render storm — but bounded (not days):
    // LOCAL Cache Components entries on this profile (e.g. getCachedBlogPost)
    // don't get guaranteed cross-instance tag eviction, so this window also
    // caps edit/delete staleness and missing-slug negative caching (Codex
    // review). Remote entries on the profile (getPublishedClusterPosts) DO
    // get cross-instance tag eviction; for them the window is purely a
    // write-churn bound.
    expect(Number(revalidate)).toBeGreaterThanOrEqual(1800); // >= 30 min
    expect(Number(revalidate)).toBeLessThanOrEqual(14400); // <= 4 hr
    // Keep client-side staleness short so edited posts surface quickly for
    // visitors who already have the page in their router cache.
    expect(Number(stale)).toBeLessThanOrEqual(600);
    expect(Number(expire)).toBeGreaterThanOrEqual(Number(revalidate));
  });
});
