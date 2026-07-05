import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { OgabasseyPdpRequestScopedSemanticSections } from './ogabassey-pdp-request-scoped-semantic-sections';

const mockHeaders = vi.fn<() => Promise<Headers>>();
const mockOgabasseyPdpSemanticSections = vi.fn();

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('./ogabassey-pdp-semantic-sections', () => ({
  OgabasseyPdpSemanticSections: (props: unknown) => {
    mockOgabasseyPdpSemanticSections(props);
    return null;
  },
}));

const props = {
  categoryName: 'Smartphones',
  categorySlug: 'smartphones',
  merchant: {
    id: 'merchant-1',
    business_name: 'OgaBassey',
    custom_domain: 'ogabassey.com',
  },
  product: {
    id: 'prod-1',
    slug: 'xiaomi-13t',
    name: 'Xiaomi 13T',
    price: 450_000,
  } as Product,
  storeSlug: 'ogabassey',
  storeUrl: 'https://ogabassey.com',
};

describe('OgabasseyPdpRequestScopedSemanticSections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the slug prefix for platform path-mode PDP requests', async () => {
    mockHeaders.mockResolvedValueOnce(new Headers());

    render(await OgabasseyPdpRequestScopedSemanticSections(props));

    expect(mockOgabasseyPdpSemanticSections).toHaveBeenCalledWith(
      expect.objectContaining({
        productComparePathPrefix: '/ogabassey',
      })
    );
  });

  it('passes no prefix for custom-domain PDP requests', async () => {
    mockHeaders.mockResolvedValueOnce(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    render(await OgabasseyPdpRequestScopedSemanticSections(props));

    expect(mockOgabasseyPdpSemanticSections).toHaveBeenCalledWith(
      expect.objectContaining({
        productComparePathPrefix: '',
      })
    );
  });

  it('keeps the slug prefix when the custom-domain header is not for this merchant', async () => {
    mockHeaders.mockResolvedValueOnce(
      new Headers([['x-custom-domain', 'evil.example']])
    );

    render(await OgabasseyPdpRequestScopedSemanticSections(props));

    expect(mockOgabasseyPdpSemanticSections).toHaveBeenCalledWith(
      expect.objectContaining({
        productComparePathPrefix: '/ogabassey',
      })
    );
  });
});
