import { describe, expect, it } from 'vitest';
import {
  comparePublicProductParitySurfaces,
  type PublicProductApiSample,
  parseCurrentAgentProductSample,
  parseCurrentAgentProductSampleStream,
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

const PDP_PRODUCT_GROUP_HTML = `<html><head><script type="application/ld+json">${JSON.stringify(
  {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    hasVariant: [
      {
        '@type': 'Product',
        offers: {
          '@type': 'Offer',
          availability: 'https://schema.org/InStock',
          price: 1000,
          priceCurrency: 'NGN',
          url: 'https://ogabassey.com/phones/test-phone?variantId=variant-1',
        },
      },
    ],
    image: ['https://cdn.example.com/phone.jpg'],
    name: 'Test Phone',
    productGroupID: 'test-phone',
    url: 'https://ogabassey.com/phones/test-phone',
  }
)}</script></head></html>`;

const PDP_WITH_OPTIONAL_OFFER_FIELDS_HTML = `<html><head><script type="application/ld+json">${JSON.stringify(
  {
    '@type': 'Product',
    image: ['https://cdn.example.com/phone.jpg'],
    name: 'Test Phone',
    offers: {
      availability: ' HTTP://schema.org/INSTOCK/ ',
      price: 1000,
    },
    url: 'https://ogabassey.com/phones/test-phone',
  }
)}</script></head></html>`;

describe('selectPublicProductApiSample', () => {
  it('reports empty when no public products are available', () => {
    expect(selectPublicProductApiSample({ products: [] })).toEqual({
      kind: 'empty',
    });
  });

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
  it('returns null for malformed feed and PDP payloads', () => {
    expect(
      parseCurrentAgentProductSample('{not-json}', 'product-1')
    ).toBeNull();
    expect(
      parseGoogleMerchantProductSample('<rss><channel><item>', 'product-1')
    ).toBeNull();
    expect(
      parsePdpProductSample(
        '<script type="application/ld+json">{not-json}</script>'
      )
    ).toBeNull();
  });

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

  it('validates only the selected Google feed item', () => {
    const xmlWithMalformedUnrelatedItem = GOOGLE_XML.replace(
      '<channel>',
      '<channel><item><g:id>unrelated</g:id></item>'
    );
    expect(
      parseGoogleMerchantProductSample(
        xmlWithMalformedUnrelatedItem,
        'product-1'
      )
    ).not.toBeNull();
  });

  it('parses the current feed sample incrementally across stream chunks', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"id":"unrelated"}\n'));
        controller.enqueue(encoder.encode(CURRENT_FEED_LINE.slice(0, 34)));
        controller.enqueue(encoder.encode(CURRENT_FEED_LINE.slice(34)));
        controller.close();
      },
    });

    await expect(
      parseCurrentAgentProductSampleStream(stream, 'product-1')
    ).resolves.toEqual({
      availability: 'in_stock',
      image: API_SAMPLE.image,
      name: API_SAMPLE.name,
      price: API_SAMPLE.price,
      url: 'https://ogabassey.com/phones/test-phone',
    });
  });

  it('accepts canonical availability variants when offer URLs are omitted', () => {
    const pdp = parsePdpProductSample(PDP_WITH_OPTIONAL_OFFER_FIELDS_HTML);

    expect(pdp).toEqual({
      availability: 'in_stock',
      image: API_SAMPLE.image,
      name: API_SAMPLE.name,
      price: API_SAMPLE.price,
      url: 'https://ogabassey.com/phones/test-phone',
    });
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

  it('allows SKU-specific Google variant titles and images for grouped product samples', () => {
    const current = parseCurrentAgentProductSample(
      CURRENT_FEED_LINE,
      'product-1'
    );
    const google = parseGoogleMerchantProductSample(
      GOOGLE_XML.replace(
        '<g:id>product-1</g:id>',
        '<g:id>variant-1</g:id><g:item_group_id>product-1</g:item_group_id>'
      )
        .replace('Test Phone', 'Test Phone - Blue - New')
        .replace(
          'https://cdn.example.com/phone.jpg',
          'https://cdn.example.com/phone-blue.jpg'
        ),
      'product-1'
    );
    const pdp = parsePdpProductSample(PDP_HTML);
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

  it('skips an unsupported Product JSON-LD block when a later block is comparable', () => {
    const current = parseCurrentAgentProductSample(
      CURRENT_FEED_LINE,
      'product-1'
    );
    const google = parseGoogleMerchantProductSample(GOOGLE_XML, 'product-1');
    const pdp = parsePdpProductSample(
      `${PDP_HTML.replace('InStock', 'BadAvailability')}${PDP_HTML}`
    );
    if (!current || !google || !pdp) {
      throw new Error('Expected a later comparable Product block to parse.');
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

  it('parses a single-variant ProductGroup PDP using its canonical group fields and offer', () => {
    const current = parseCurrentAgentProductSample(
      CURRENT_FEED_LINE,
      'product-1'
    );
    const google = parseGoogleMerchantProductSample(GOOGLE_XML, 'product-1');
    const pdp = parsePdpProductSample(PDP_PRODUCT_GROUP_HTML);
    if (!current || !google || !pdp) {
      throw new Error('Expected single-variant ProductGroup JSON-LD to parse.');
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
