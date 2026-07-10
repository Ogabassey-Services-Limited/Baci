import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/components/storefront/ogabassey/types';
import { OgabasseyPdpDeferredDetailIsland } from './deferred-detail-island';

const mockDeferredDetailClient = vi.hoisted(() => vi.fn());
const mockDeferredRailsIsland = vi.hoisted(() => vi.fn());

vi.mock('./deferred-detail-island.client', () => ({
  OgabasseyPdpDeferredDetailClient: (props: unknown) => {
    mockDeferredDetailClient(props);
    return <section aria-label="Deferred product detail client" />;
  },
}));

vi.mock('./deferred-rails-island.client', () => ({
  OgabasseyPdpDeferredRailsIsland: (props: unknown) => {
    mockDeferredRailsIsland(props);
    return <section aria-label="Deferred related product rails" />;
  },
}));

const product = {
  brand: 'Lenovo',
  category: 'Laptops',
  categorySlug: 'laptops',
  description: 'Creator laptop with RTX graphics.',
  detailedSpecs: [
    {
      category: 'Performance',
      items: [{ label: 'Processor', value: 'Intel Core i9' }],
    },
  ],
  has_condition_offers: true,
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/core-assets/products/legion.avif',
  image_payloads: [
    {
      alt: 'verbose generated alt payload that must stay server-side',
      source: 'generated',
    },
  ],
  images: [
    'https://cdn.ogabassey.com/core-assets/products/legion.avif',
    'https://cdn.ogabassey.com/core-assets/products/legion-gallery.avif',
  ],
  name: 'Lenovo Legion Pro 9',
  offers: [
    {
      condition: 'new',
      id: 'offer-1',
      notes: 'verbose offer notes that should not hydrate below-fold islands',
      price: 'NGN 5,985,000',
      rawPrice: 5_985_000,
    },
  ],
  price: 'NGN 5,985,000',
  rawPrice: 5_985_000,
  slug: 'lenovo-legion-pro-9',
  variants: [
    {
      attributes: { ram: '32GB', storage: '1TB' },
      id: 'variant-1',
      images: ['https://cdn.ogabassey.com/core-assets/products/variant.avif'],
      stock: 4,
    },
  ],
} as unknown as Product;

describe('OgabasseyPdpDeferredDetailIsland', () => {
  beforeEach(() => {
    mockDeferredDetailClient.mockReset();
    mockDeferredRailsIsland.mockReset();
  });

  it('keeps crawl-visible details server-rendered and sends compact client payloads', () => {
    const { container } = render(
      <OgabasseyPdpDeferredDetailIsland
        product={product}
        semanticSections={<section aria-label="Buying guidance" />}
        serverPrimaryDetails={<section aria-label="Server product details" />}
        storeSlug="ogabassey"
      />
    );

    expect(
      screen.getByRole('region', { name: 'Product details' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Buying guidance')).toBeInTheDocument();
    expect(
      container.querySelector('[data-ogabassey-pdp-semantics]')
    ).not.toBeNull();
    expect(screen.getByLabelText('Server product details')).toBeInTheDocument();
    expect(mockDeferredDetailClient).toHaveBeenCalledWith(
      expect.objectContaining({
        productData: expect.objectContaining({
          name: 'Lenovo Legion Pro 9',
        }),
        storeSlug: 'ogabassey',
      })
    );
    expect(mockDeferredDetailClient.mock.calls[0]?.[0]).not.toHaveProperty(
      'product'
    );
    // The multi-KB description HTML is rendered server-side as a slot and must
    // NOT be serialized into the client island's `productData` props.
    expect(
      (mockDeferredDetailClient.mock.calls[0]?.[0] as { productData?: unknown })
        ?.productData
    ).not.toHaveProperty('description');
    // The description is sanitized on the server here (SafeHtml element) and
    // passed down as a slot, so `sanitize-html` never enters the client tabs
    // chunk. `headingLevelOffset: 1` is the SEO heading demotion that used to
    // live inside the client tabs component.
    const detailProps = mockDeferredDetailClient.mock.calls[0]?.[0] as {
      descriptionSlot?: {
        props?: { html?: string; headingLevelOffset?: number };
      };
    };
    expect(detailProps.descriptionSlot?.props?.html).toBe(
      'Creator laptop with RTX graphics.'
    );
    expect(detailProps.descriptionSlot?.props?.headingLevelOffset).toBe(1);
    expect(mockDeferredRailsIsland).toHaveBeenCalledWith(
      expect.objectContaining({
        product: expect.objectContaining({
          category_slug: 'laptops',
          merchant_id: undefined,
          name: 'Lenovo Legion Pro 9',
        }),
      })
    );
    // Serialize only the plain data payload. `descriptionSlot` is a
    // server-rendered React element (not a serializable client prop), so it is
    // excluded here — it would otherwise fail JSON.stringify via its owner
    // fiber. The verbose server-only strings live in productData regardless.
    const clientPayload = JSON.stringify(
      mockDeferredDetailClient.mock.calls.map((call) => {
        const props = call[0] as {
          productData?: unknown;
          storeSlug?: string;
        };
        return { productData: props.productData, storeSlug: props.storeSlug };
      })
    );
    expect(clientPayload).not.toContain('verbose offer notes');
    expect(clientPayload).not.toContain('verbose generated alt payload');
    // The description HTML lives only in the server-rendered slot, never in the
    // serialized client payload.
    expect(clientPayload).not.toContain('Creator laptop with RTX graphics.');
  });

  it('renders without semantic sections', () => {
    render(
      <OgabasseyPdpDeferredDetailIsland
        product={product}
        storeSlug="ogabassey"
      />
    );

    expect(
      screen.getByRole('region', { name: 'Product details' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Deferred product detail client' })
    ).toBeInTheDocument();
  });
});
