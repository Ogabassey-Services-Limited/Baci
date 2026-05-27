import { describe, expect, it, vi } from 'vitest';

const { mockDomainPage, mockFullStorefrontCssImport } = vi.hoisted(() => ({
  mockDomainPage: vi.fn(() => null),
  mockFullStorefrontCssImport: vi.fn(),
}));

vi.mock('@/app/(storefront)/storefront-full.css', () => {
  mockFullStorefrontCssImport();
  return {};
});

vi.mock('@/app/(storefront)/ogabassey/page', () => ({
  default: mockDomainPage,
  metadata: {
    title: 'OgaBassey - Official Online Store | Baci',
  },
}));

import OgabasseyDomainPage, { metadata } from './page';

describe('OgabasseyDomainPage', () => {
  it('loads the full storefront stylesheet at the custom-domain page leaf', () => {
    expect(mockFullStorefrontCssImport).toHaveBeenCalledOnce();
  });

  it('re-exports the static OgaBassey homepage implementation', () => {
    expect(OgabasseyDomainPage).toBe(mockDomainPage);
    expect(metadata).toEqual({
      title: 'OgaBassey - Official Online Store | Baci',
    });
  });
});
