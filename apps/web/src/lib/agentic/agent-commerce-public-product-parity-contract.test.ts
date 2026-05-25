import { describe, expect, it } from 'vitest';
import {
  comparePublicProductParitySurfaces,
  type PublicProductApiSample,
  parseCurrentAgentProductSample,
  parseGoogleMerchantProductSample,
  parsePdpProductSample,
  selectPublicProductApiSample,
} from './agent-commerce-public-product-parity-contract';

const API_SAMPLE = {
  availability: 'in_stock',
  has_condition_offers: false,
  has_variants: false,
  id: 'product-1',
  image: 'https://cdn.example.com/phone.jpg',
  name: 'Test Phone',
  price: 1000,
} satisfies PublicProductApiSample;

const CURRENT_FEED_LINE = JSON.stringify({
  id: 'product-1',
  media: [{ type: 'image', url: 'https://cdn.example.com/phone.jpg' }],
  title: 'Test Phone',
  url: 'https://ogabassey.com/phones/test-phone',
  variants: [
    {
      availability: { status: 'in_stock' },
      price: { amount: 1000, currency: 'NGN' },
    },
  ],
});

const GOOGLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <item>
      <g:id>product-1</g:id>
      <g:title>Test Phone</g:title>
      <g:link>https://ogabassey.com/phones/test-phone</g:link>
      <g:image_link>https://cdn.example.com/phone.jpg</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:price>1000.00 NGN</g:price>
    </item>
  </channel>
</rss>`;

const PDP_HTML = `<html><head><script type="application/ld+json">${JSON.stringify(
  {
    '@context': 'https://schema.org',
    '@type': 'Product',
    image: ['https://cdn.example.com/phone.jpg'],
    name: 'Test Phone',
    offers: {
      '@type': 'Offer',
      availability: 'https://schema.org/InStock',
      price: 1000,
      priceCurrency: 'NGN',
      url: 'https://ogabassey.com/phones/test-phone',
    },
    url: 'https://ogabassey.com/phones/test-phone',
  }
)}</script></head></html>`;

describe('selectPublicProductApiSample', () => {
  it('selects the first simple product and skips matrix-style products', () => {
    const result = selectPublicProductApiSample({
      products: [
        { ...API_SAMPLE, has_variants: true, id: 'variant-product' },
        API_SAMPLE,
      ],
    });

    expect(result).toEqual({ kind: 'selected', product: API_SAMPLE });
  });

  it('reports when the sampled API window contains only complex products', () => {
    const result = selectPublicProductApiSample({
      products: [{ ...API_SAMPLE, has_condition_offers: true }],
    });

    expect(result).toEqual({ kind: 'unsupported' });
  });

  it('rejects an invalid public product API contract', () => {
    expect(
      selectPublicProductApiSample({ products: [{ id: 'product-1' }] })
    ).toEqual({ kind: 'invalid' });
  });
});

describe('public product parity surface parsers', () => {
  it('parses matching current feed, Google XML, and PDP JSON-LD samples', () => {
    const current = parseCurrentAgentProductSample(
      CURRENT_FEED_LINE,
      'product-1'
    );
    const google = parseGoogleMerchantProductSample(GOOGLE_XML, 'product-1');
    const pdp = parsePdpProductSample(PDP_HTML);

    expect(current).not.toBeNull();
    expect(google).not.toBeNull();
    expect(pdp).not.toBeNull();
    if (!current || !google || !pdp) {
      throw new Error('Expected every public product parity surface to parse.');
    }
    expect(
      comparePublicProductParitySurfaces({
        api: API_SAMPLE,
        current,
        google,
        pdp,
      })
    ).toEqual([]);
  });

  it('returns every drifted public field for the sampled product', () => {
    const current = parseCurrentAgentProductSample(
      CURRENT_FEED_LINE,
      'product-1'
    );
    const google = parseGoogleMerchantProductSample(GOOGLE_XML, 'product-1');
    const pdp = parsePdpProductSample(
      PDP_HTML.replace('1000', '1200').replace('InStock', 'OutOfStock')
    );
    if (!current || !google || !pdp) {
      throw new Error('Expected every public product parity surface to parse.');
    }

    expect(
      comparePublicProductParitySurfaces({
        api: API_SAMPLE,
        current,
        google,
        pdp,
      })
    ).toEqual(['availability', 'price']);
  });

  it('returns null when a required surface does not expose the sample', () => {
    expect(
      parseCurrentAgentProductSample(CURRENT_FEED_LINE, 'missing-product')
    ).toBeNull();
    expect(
      parseGoogleMerchantProductSample(GOOGLE_XML, 'missing-product')
    ).toBeNull();
    expect(parsePdpProductSample('<html><body>No JSON-LD</body></html>')).toBe(
      null
    );
  });
});
