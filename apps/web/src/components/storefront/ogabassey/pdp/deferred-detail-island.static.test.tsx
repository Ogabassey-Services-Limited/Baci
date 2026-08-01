import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Product } from '@/components/storefront/ogabassey/types';
import { OgabasseyPdpDeferredDetailIsland } from './deferred-detail-island';

const product = {
  brand: 'Lenovo',
  category: 'Laptops',
  description: '<p>Creator laptop with RTX graphics.</p>',
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/core-assets/products/legion.avif',
  name: 'Lenovo Legion Pro 9',
  price: 'NGN 5,985,000',
  rawPrice: 5_985_000,
  slug: 'lenovo-legion-pro-9',
} as unknown as Product;

describe('OgabasseyPdpDeferredDetailIsland source HTML', () => {
  it('includes the sole sanitized description before the real client activates', () => {
    const sourceHtml = renderToStaticMarkup(
      <OgabasseyPdpDeferredDetailIsland product={product} storeSlug="ogabassey" />
    );

    expect(sourceHtml).toContain('Creator laptop with RTX graphics.');
    expect(sourceHtml.match(/Creator laptop with RTX graphics\./g)).toHaveLength(1);
    expect(sourceHtml).toContain('data-testid="deferred-product-details-placeholder"');
  });

  it('does not emit an empty description panel for a blank description', () => {
    const sourceHtml = renderToStaticMarkup(
      <OgabasseyPdpDeferredDetailIsland
        product={{ ...product, description: '' }}
        storeSlug="ogabassey"
      />
    );

    expect(sourceHtml).not.toContain(
      'data-ogabassey-pdp-deferred-description-container'
    );
    expect(sourceHtml).toContain('data-testid="deferred-product-details-placeholder"');
  });

  it('does not emit a description panel for markup with no renderable content', () => {
    const sourceHtml = renderToStaticMarkup(
      <OgabasseyPdpDeferredDetailIsland
        product={{ ...product, description: '<p><br /></p>' }}
        storeSlug="ogabassey"
      />
    );

    expect(sourceHtml).not.toContain(
      'data-ogabassey-pdp-deferred-description-container'
    );
  });

  it('does not emit a description panel when sanitization removes the content', () => {
    const sourceHtml = renderToStaticMarkup(
      <OgabasseyPdpDeferredDetailIsland
        product={{ ...product, description: '<script>alert(1)</script>' }}
        storeSlug="ogabassey"
      />
    );

    expect(sourceHtml).not.toContain(
      'data-ogabassey-pdp-deferred-description-container'
    );
  });

  it.each(['<img>', '<img src="">', '<img src="javascript:alert(1)">'])(
    'does not emit a description panel for an image without a usable source: %s',
    (description) => {
      const sourceHtml = renderToStaticMarkup(
        <OgabasseyPdpDeferredDetailIsland
          product={{ ...product, description }}
          storeSlug="ogabassey"
        />
      );

      expect(sourceHtml).not.toContain(
        'data-ogabassey-pdp-deferred-description-container'
      );
    }
  );

  it('keeps a description panel when an image has a usable srcset', () => {
    const sourceHtml = renderToStaticMarkup(
      <OgabasseyPdpDeferredDetailIsland
        product={{
          ...product,
          description: '<img srcset="https://example.com/laptop.avif 1x">',
        }}
        storeSlug="ogabassey"
      />
    );

    expect(sourceHtml).toContain(
      'data-ogabassey-pdp-deferred-description-container'
    );
  });

  it('lazy-loads images in the initial server-rendered description handoff', () => {
    const sourceHtml = renderToStaticMarkup(
      <OgabasseyPdpDeferredDetailIsland
        product={{
          ...product,
          description:
            '<p>Creator laptop.</p><img src="https://example.com/body.jpg" loading="eager" alt="Laptop detail">',
        }}
        storeSlug="ogabassey"
      />
    );

    expect(sourceHtml).toContain('loading="lazy"');
    expect(sourceHtml).not.toContain('loading="eager"');
  });
});
