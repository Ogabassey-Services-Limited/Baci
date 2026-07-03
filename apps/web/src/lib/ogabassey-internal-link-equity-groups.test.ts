import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS } from '@/config/ogabassey-internal-link-equity';

const { mockGetCachedProductCanonicalPaths } = vi.hoisted(() => ({
  mockGetCachedProductCanonicalPaths: vi.fn(),
}));

vi.mock('@/lib/cached-product-canonical-paths', () => ({
  getCachedProductCanonicalPaths: (...args: unknown[]) =>
    mockGetCachedProductCanonicalPaths(...args),
}));

import { getOgabasseyInternalLinkEquityGroups } from './ogabassey-internal-link-equity-groups';

const ALL_PRODUCT_SLUGS = OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS.flatMap(
  (group) => group.productLinks.map((productLink) => productLink.productSlug)
);

describe('getOgabasseyInternalLinkEquityGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests canonical paths for every configured product slug', async () => {
    mockGetCachedProductCanonicalPaths.mockResolvedValue({});

    await getOgabasseyInternalLinkEquityGroups('merchant-1');

    expect(mockGetCachedProductCanonicalPaths).toHaveBeenCalledWith(
      'merchant-1',
      ALL_PRODUCT_SLUGS
    );
  });

  it('returns groups with resolved product links, dropping unresolved slugs', async () => {
    mockGetCachedProductCanonicalPaths.mockResolvedValue({
      'iphone-xr': '/smartphones/iphone-xr',
    });

    const groups = await getOgabasseyInternalLinkEquityGroups('merchant-1');
    const allLinks = groups.flatMap((group) => group.links);

    expect(allLinks).toContainEqual({
      href: '/smartphones/iphone-xr',
      label: 'iPhone XR',
    });
    // literal links pass through untouched
    expect(allLinks).toContainEqual({
      href: '/compare',
      label: 'Compare products',
    });
    // exactly one product link resolved; every other product entry is dropped
    const productLinkCount = allLinks.length - literalLinkCount();
    expect(productLinkCount).toBe(1);
  });
});

function literalLinkCount() {
  return OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS.reduce(
    (total, group) => total + group.links.length,
    0
  );
}
