import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { categoryPageProductIdCache } from './category-page-product-id-cache';

const source = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    'category-page-product-id-cache.ts'
  ),
  'utf8'
);

describe('category page product ID cache', () => {
  it('exposes one cohesive primary cache API', () => {
    expect(Object.keys(categoryPageProductIdCache).sort()).toEqual([
      'fetchProductIdWindow',
      'getLegacyProductIds',
      'getLegacyProductTotalCount',
      'getProductIds',
      'getProductTotalCount',
    ]);
    for (const method of Object.values(categoryPageProductIdCache)) {
      expect(method).toBeTypeOf('function');
    }
    expect(source).toContain('export const categoryPageProductIdCache = {');
    expect(source).not.toMatch(/export async function getCached/);
    expect(source).not.toContain(
      'export async function fetchCategoryPageProductIdWindow'
    );
  });

  it('keeps canonical readers remote and legacy readers local', () => {
    expect(source).toContain('function getCachedCategoryPageProductIds');
    expect(source).toContain('RemotelyCachedCategoryPageProductScope');
    expect(source).toContain("'use cache: remote';");
    expect(source).toContain('function getCachedLegacyCategoryPageProductIds');
    expect(source).toContain("'use cache';");
    expect(source).toContain(
      'function getCachedLegacyCategoryPageProductTotalCount'
    );
    expect(source).toContain('getCategoryPageDataCacheTag(merchantId)');
    expect(source).toContain('CATEGORY_PAGE_PRODUCT_ID_CAP');
  });
});
