import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as TypeScript from 'typescript';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const ts = require('typescript') as typeof TypeScript;
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

  it('keeps public blog metadata and listing data off the remote cache handler', () => {
    for (const functionName of ['getCachedBlogPost', 'getCachedBlogListing']) {
      const source = getFunctionSource(functionName);
      expect(source, functionName).toContain("'use cache';");
      expect(source, functionName).not.toContain("'use cache: remote';");

      // Next 16's local `use cache` API explicitly supports cacheLife/cacheTag.
      // Keep these so blog metadata/content stays tag-revalidatable without
      // reintroducing RemoteCacheHandler.
      expect(source, functionName).toContain('cacheTag(');
    }
  });

  it('uses the long-lived `blog` profile for posts and canonical listings, but a short profile for filtered listings', () => {
    // Blog posts are keyed by a bounded postSlug, so they always use the
    // near-static `blog` profile (daily revalidate) to avoid re-rendering every
    // 60s under crawler load.
    const postSource = getFunctionSource('getCachedBlogPost');
    expect(postSource).toContain("cacheLife('blog');");
    expect(postSource).not.toContain("cacheLife('merchant');");

    // Blog listings take user-supplied search/category args. Canonical
    // (unfiltered) listings use the long `blog` profile, but filtered listings
    // must stay on the short `merchant` profile so unbounded one-off
    // search/category entries are not retained for a week.
    const listingSource = getFunctionSource('getCachedBlogListing');
    expect(listingSource).toContain("cacheLife('blog');");
    expect(listingSource).toContain("cacheLife('merchant');");
  });
});

describe('next.config cacheLife profiles', () => {
  const NEXT_CONFIG_SOURCE = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'next.config.ts'),
    'utf8'
  );

  it('defines a long-lived `blog` profile so near-static blog pages are not re-rendered every minute', () => {
    const match = NEXT_CONFIG_SOURCE.match(
      /blog:\s*\{\s*stale:\s*(\d+),\s*revalidate:\s*(\d+),\s*expire:\s*(\d+)\s*\}/
    );
    expect(
      match,
      'blog cacheLife profile must be declared in next.config.ts'
    ).not.toBeNull();

    const [, stale, revalidate, expire] = match as RegExpMatchArray;
    // The cost win comes from a long server `revalidate` (far fewer re-renders),
    // not a long client `stale`. Blog edits invalidate by cacheTag, so server
    // revalidation can be infrequent.
    expect(Number(revalidate)).toBeGreaterThanOrEqual(86400); // >= 1 day server revalidation
    // Keep client-side staleness short so edited posts surface quickly for
    // visitors who already have the page in their router cache.
    expect(Number(stale)).toBeLessThanOrEqual(600);
    expect(Number(expire)).toBeGreaterThanOrEqual(Number(revalidate));
  });
});
