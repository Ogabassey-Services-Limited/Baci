import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCategoryPageDataCacheTag } from './category-page-cache-tags';

const mocks = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag }));

import { revalidateCategories } from './revalidate-categories';

const MERCHANT_ID = 'merchant-1';

describe('revalidateCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('evicts the merchant, navigation and page tags', () => {
    revalidateCategories(MERCHANT_ID);

    const tags = mocks.revalidateTag.mock.calls.map(([tag]) => tag);
    expect(tags).toEqual([
      `categories-${MERCHANT_ID}`,
      'navigation-categories',
      getCategoryPageDataCacheTag(MERCHANT_ID),
      'product-canonical-redirect',
      'product-legacy-redirect',
    ]);
  });

  it('adds the slug-scoped tag when a slug is given', () => {
    revalidateCategories(MERCHANT_ID, 'phones');

    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      `category-${MERCHANT_ID}-phones`,
      'categories'
    );
  });

  it('hard-expires category data before an outer CDN eviction', () => {
    revalidateCategories(MERCHANT_ID, 'phones', {
      expireImmediately: true,
    });

    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      `categories-${MERCHANT_ID}`,
      { expire: 0 }
    );
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      `category-${MERCHANT_ID}-phones`,
      { expire: 0 }
    );
  });

  it('propagates cache API failures to the mutation caller', () => {
    mocks.revalidateTag.mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });

    expect(() => revalidateCategories(MERCHANT_ID)).toThrow(
      'cache unavailable'
    );
  });

  it('stays free of credential-reaching imports', async () => {
    // The whole point of this module: category API routes import it instead of
    // cache-revalidation, which pulls cloudflare-purge -> getCloudflareApiToken.
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(
      join(import.meta.dirname, 'revalidate-categories.ts'),
      'utf8'
    );

    const imports = source.match(/^import .*$/gm) ?? [];
    expect(imports).toEqual([
      "import { revalidateTag } from 'next/cache';",
      "import { getCategoryPageDataCacheTag } from '@/lib/category-page-cache-tags';",
    ]);
  });
});
