import { describe, expect, it } from 'vitest';
import type { InternalLinkEquityGroupConfig } from '@/config/ogabassey-internal-link-equity';
import { resolveInternalLinkEquityGroups } from './resolve-internal-link-equity-groups';

const GROUPS: InternalLinkEquityGroupConfig[] = [
  {
    title: 'Core shopping paths',
    description: 'Category pages.',
    links: [
      { href: '/smartphones', label: 'Smartphones' },
      { href: '/laptops', label: 'Laptops' },
    ],
    productLinks: [],
  },
  {
    title: 'Smartphone paths',
    description: 'Product pages.',
    links: [],
    productLinks: [
      { productSlug: 'iphone-xr', label: 'iPhone XR' },
      { productSlug: 'archived-product', label: 'Archived Product' },
    ],
  },
];

describe('resolveInternalLinkEquityGroups', () => {
  it('keeps hardcoded links and appends resolved product links', () => {
    const resolved = resolveInternalLinkEquityGroups(GROUPS, {
      'iphone-xr': '/smartphones/iphone-xr',
    });

    expect(resolved[0]).toEqual({
      title: 'Core shopping paths',
      description: 'Category pages.',
      links: [
        { href: '/smartphones', label: 'Smartphones' },
        { href: '/laptops', label: 'Laptops' },
      ],
    });
    expect(resolved[1].links).toContainEqual({
      href: '/smartphones/iphone-xr',
      label: 'iPhone XR',
    });
  });

  it('drops product links whose slug is missing from the lookup', () => {
    const resolved = resolveInternalLinkEquityGroups(GROUPS, {
      'iphone-xr': '/smartphones/iphone-xr',
    });

    expect(resolved[1].links).toHaveLength(1);
    expect(resolved[1].links).not.toContainEqual(
      expect.objectContaining({ label: 'Archived Product' })
    );
  });

  it('returns empty links for a group when no product slug resolves', () => {
    const resolved = resolveInternalLinkEquityGroups(GROUPS, {});

    expect(resolved[1].links).toEqual([]);
  });
});
