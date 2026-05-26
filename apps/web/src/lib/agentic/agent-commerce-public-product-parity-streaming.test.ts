import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { checkAgentCommercePublicProductParity } from '@/lib/agentic/agent-commerce-public-product-parity-health';

const BASE_URL = 'https://ogabassey.com';
const API_URL = `${BASE_URL}/api/storefront/ogabassey/products?limit=10`;
const CURRENT_FEED_URL = `${BASE_URL}/feeds/agent-products.jsonl`;
const GOOGLE_FEED_URL = `${BASE_URL}/feeds/google-merchant.xml`;
const PDP_URL = `${BASE_URL}/phones/test-phone`;

function apiResponse() {
  return Response.json({
    products: [
      {
        availability: 'in_stock',
        has_condition_offers: false,
        has_variants: false,
        id: 'product-1',
        image: 'https://cdn.example.com/phone.jpg',
        name: 'Test Phone',
        price: 1000,
      },
    ],
  });
}

function currentFeedBody() {
  return JSON.stringify({
    id: 'product-1',
    media: [{ type: 'image', url: 'https://cdn.example.com/phone.jpg' }],
    title: 'Test Phone',
    url: PDP_URL,
    variants: [
      {
        availability: { status: 'in_stock' },
        price: { amount: 1000, currency: 'NGN' },
      },
    ],
  });
}

function googleFeedBody() {
  return `<rss xmlns:g="http://base.google.com/ns/1.0"><channel><item>
    <g:id>product-1</g:id><g:title>Test Phone</g:title>
    <g:link>${PDP_URL}</g:link>
    <g:image_link>https://cdn.example.com/phone.jpg</g:image_link>
    <g:availability>in_stock</g:availability><g:price>1000.00 NGN</g:price>
  </item></channel></rss>`;
}

function pdpBody() {
  return `<script type="application/ld+json">${JSON.stringify({
    '@type': 'Product',
    image: ['https://cdn.example.com/phone.jpg'],
    name: 'Test Phone',
    offers: {
      availability: 'https://schema.org/InStock',
      price: 1000,
      url: PDP_URL,
    },
    url: PDP_URL,
  })}</script>`;
}

function runCheck(fetcher: typeof fetch) {
  return checkAgentCommercePublicProductParity(
    { custom_domain: 'ogabassey.com', slug: 'ogabassey' },
    fetcher
  );
}

function responseForUrl(url: Parameters<typeof fetch>[0]) {
  switch (url) {
    case API_URL:
      return apiResponse();
    case CURRENT_FEED_URL:
      return new Response(currentFeedBody());
    case GOOGLE_FEED_URL:
      return new Response(googleFeedBody());
    case PDP_URL:
      return new Response(pdpBody());
    default:
      return new Response('not found', { status: 404 });
  }
}

describe('streamed public product parity feeds', () => {
  it('streams the Google XML sample without materializing the feed body', async () => {
    const xml = googleFeedBody();
    const encoder = new TextEncoder();
    const googleResponse = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(xml.slice(0, 40)));
          controller.enqueue(encoder.encode(xml.slice(40)));
          controller.close();
        },
      })
    );
    const googleText = vi.spyOn(googleResponse, 'text');
    const fetcher = vi.fn<typeof fetch>((url) =>
      Promise.resolve(
        url === GOOGLE_FEED_URL ? googleResponse : responseForUrl(url)
      )
    );

    const result = await runCheck(fetcher);

    expect(result.status).toBe('ok');
    expect(googleText).not.toHaveBeenCalled();
  });

  it('allows longer download deadlines for feed surfaces only', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const fetcher = vi.fn<typeof fetch>((url) =>
      Promise.resolve(responseForUrl(url))
    );

    try {
      await expect(runCheck(fetcher)).resolves.toMatchObject({ status: 'ok' });
      expect(timeout).toHaveBeenNthCalledWith(1, 5_000);
      expect(timeout).toHaveBeenNthCalledWith(2, 30_000);
      expect(timeout).toHaveBeenNthCalledWith(3, 30_000);
      expect(timeout).toHaveBeenNthCalledWith(4, 5_000);
    } finally {
      timeout.mockRestore();
    }
  });
});
