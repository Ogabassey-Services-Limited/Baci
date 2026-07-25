import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    'category-page-product-id-cache.ts'
  ),
  'utf8'
);

describe('category page product ID cache', () => {
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
