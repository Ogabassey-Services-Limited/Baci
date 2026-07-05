import { describe, expect, it } from 'vitest';
import {
  getSupplementalApprovalCandidateLimit,
  selectApprovedCompareGraphEntries,
} from './compare-link-graph-approval';

const deepProducts = Array.from({ length: 152 }, (_, index) => ({
  slug: `phone-${index}`,
  name: `Phone ${index}`,
  brand: `Brand ${index % 4}`,
  price: 250_000 + index,
  category_slug: 'smartphones',
  product_key_specs: {
    chipset: `Chip ${index}`,
    ram_gb: 4 + index,
    storage_gb: 64 + index,
  },
}));

describe('compare link graph approval', () => {
  it('keeps supplemental approval bounded', () => {
    expect(getSupplementalApprovalCandidateLimit(1)).toBe(16);
    expect(getSupplementalApprovalCandidateLimit(100)).toBe(150);
  });

  it('approves a deep candidate through bounded supplemental pair approval', () => {
    const candidate = {
      comparisonSlug: 'phone-150-vs-phone-151',
      productSlugs: ['phone-150', 'phone-151'] as [string, string],
      href: '/smartphones/compare/phone-150-vs-phone-151',
    };

    expect(
      selectApprovedCompareGraphEntries({
        storeUrl: 'https://ogabassey.com',
        categorySlug: 'smartphones',
        categoryName: 'Smartphones',
        policyProducts: deepProducts,
        candidateEntries: [candidate],
        maxLinks: 1,
      })
    ).toEqual([candidate]);
  });
});
