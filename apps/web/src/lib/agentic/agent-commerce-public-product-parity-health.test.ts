import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { checkAgentCommercePublicProductParity } from './agent-commerce-public-product-parity-health';

const BASE_URL = 'https://ogabassey.com';
const API_URL = `${BASE_URL}/api/storefront/ogabassey/products?limit=10`;
const CURRENT_FEED_URL = `${BASE_URL}/feeds/agent-products.jsonl`;
const GOOGLE_FEED_URL = `${BASE_URL}/feeds/google-merchant.xml`;
const PDP_URL = `${BASE_URL}/phones/test-phone`;

function apiBody(overrides: Record<string, unknown> = {}) {
  return {
    products: [
      {
        availability: 'in_stock',
        has_condition_offers: false,
        has_variants: false,
        id: 'product-1',
        image: 'https://cdn.example.com/phone.jpg',
        name: 'Test Phone',
        price: 1000,
        ...overrides,
      },
    ],
  };
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

function pdpBody(price = 1000) {
  return `<script type="application/ld+json">${JSON.stringify({
    '@type': 'Product',
    image: ['https://cdn.example.com/phone.jpg'],
    name: 'Test Phone',
    offers: {
      availability: 'https://schema.org/InStock',
      price,
      url: PDP_URL,
    },
    url: PDP_URL,
  })}</script>`;
}

function productGroupPdpBody() {
  return `<script type="application/ld+json">${JSON.stringify({
    '@type': 'ProductGroup',
    hasVariant: [
      {
        '@type': 'Product',
        offers: {
          availability: 'https://schema.org/InStock',
          price: 1000,
          url: `${PDP_URL}?variantId=variant-1`,
        },
      },
    ],
    image: ['https://cdn.example.com/phone.jpg'],
    name: 'Test Phone',
    url: PDP_URL,
  })}</script>`;
}

function healthyResponse(url: Parameters<typeof fetch>[0]) {
  switch (url) {
    case API_URL:
      return Response.json(apiBody());
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

function healthyFetcher() {
  return vi.fn<typeof fetch>((url) => Promise.resolve(healthyResponse(url)));
}

function runCheck(fetcher: typeof fetch) {
  return checkAgentCommercePublicProductParity(
    { custom_domain: 'ogabassey.com', slug: 'ogabassey' },
    fetcher
  );
}

describe('checkAgentCommercePublicProductParity', () => {
  it('passes a simple product matched across API, feeds, and PDP JSON-LD', async () => {
    const fetcher = healthyFetcher();

    const result = await runCheck(fetcher);

    expect(result).toEqual({
      issue_count: 0,
      issues: [],
      sample_product_id: 'product-1',
      status: 'ok',
      surfaces: {
        agent_products: CURRENT_FEED_URL,
        google_merchant_xml: GOOGLE_FEED_URL,
        product_api: API_URL,
        product_page: PDP_URL,
      },
    });
    expect(fetcher).toHaveBeenCalledWith(
      API_URL,
      expect.objectContaining({ cache: 'no-store' })
    );
    expect(fetcher).toHaveBeenCalledWith(
      PDP_URL,
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('streams the JSONL sample rather than materializing the current feed text', async () => {
    const currentResponse = new Response(currentFeedBody());
    const currentText = vi.spyOn(currentResponse, 'text');
    const fetcher = healthyFetcher();
    fetcher.mockImplementation((url) =>
      Promise.resolve(
        url === CURRENT_FEED_URL ? currentResponse : healthyResponse(url)
      )
    );

    const result = await runCheck(fetcher);

    expect(result.status).toBe('ok');
    expect(currentText).not.toHaveBeenCalled();
  });

  it('starts consuming both public feed bodies without waiting for JSONL completion', async () => {
    let releaseCurrent: () => void = () => undefined;
    const canCompleteCurrent = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    const currentResponse = new Response(
      new ReadableStream<Uint8Array>({
        async start(controller) {
          await canCompleteCurrent;
          controller.enqueue(new TextEncoder().encode(currentFeedBody()));
          controller.close();
        },
      })
    );
    const googleResponse = new Response(googleFeedBody());
    const googleText = vi
      .spyOn(googleResponse, 'text')
      .mockImplementation(() => {
        releaseCurrent();
        return Promise.resolve(googleFeedBody());
      });
    const fetcher = healthyFetcher();
    fetcher.mockImplementation((url) =>
      Promise.resolve(
        url === CURRENT_FEED_URL
          ? currentResponse
          : url === GOOGLE_FEED_URL
            ? googleResponse
            : healthyResponse(url)
      )
    );
    const resultPromise = runCheck(fetcher);
    await vi.waitFor(() => expect(googleText).toHaveBeenCalledOnce());
    await expect(resultPromise).resolves.toMatchObject({ status: 'ok' });
  });

  it('returns attention when a PDP JSON-LD value drifts from public catalog surfaces', async () => {
    const fetcher = healthyFetcher();
    fetcher.mockImplementation((url) =>
      Promise.resolve(
        url === PDP_URL ? new Response(pdpBody(1200)) : healthyResponse(url)
      )
    );

    const result = await runCheck(fetcher);

    expect(result).toMatchObject({
      issue_count: 1,
      sample_product_id: 'product-1',
      status: 'attention',
      issues: [
        {
          code: 'parity_surface_mismatch',
          count: 1,
          fields: ['price'],
          severity: 'attention',
        },
      ],
    });
  });

  it('passes a product represented as a single-variant ProductGroup on its PDP', async () => {
    const fetcher = healthyFetcher();
    fetcher.mockImplementation((url) =>
      Promise.resolve(
        url === PDP_URL
          ? new Response(productGroupPdpBody())
          : healthyResponse(url)
      )
    );

    const result = await runCheck(fetcher);

    expect(result).toMatchObject({
      issue_count: 0,
      sample_product_id: 'product-1',
      status: 'ok',
    });
  });

  it('returns monitor without fetching feeds when the sample window has only complex products', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(apiBody({ has_variants: true })));

    const result = await runCheck(fetcher);

    expect(result).toMatchObject({
      issue_count: 1,
      sample_product_id: null,
      status: 'monitor',
      issues: [
        {
          code: 'parity_sample_unavailable',
          severity: 'monitor',
        },
      ],
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('returns attention when a required public response is unavailable', async () => {
    const fetcher = healthyFetcher();
    fetcher.mockImplementation((url) =>
      Promise.resolve(
        url === GOOGLE_FEED_URL
          ? new Response('unavailable', { status: 500 })
          : healthyResponse(url)
      )
    );

    const result = await runCheck(fetcher);

    expect(result).toMatchObject({
      issues: [{ code: 'parity_surface_unavailable', severity: 'attention' }],
      status: 'attention',
    });
  });

  it('returns attention instead of fetching a PDP URL outside the storefront origin', async () => {
    const fetcher = healthyFetcher();
    fetcher.mockImplementation((url) => {
      if (url === CURRENT_FEED_URL) {
        return Promise.resolve(
          new Response(
            currentFeedBody().replace(PDP_URL, 'https://outside.example/p')
          )
        );
      }
      return Promise.resolve(healthyResponse(url));
    });

    const result = await runCheck(fetcher);

    expect(result).toMatchObject({
      issues: [{ code: 'parity_contract_drift', severity: 'attention' }],
      status: 'attention',
    });
    expect(fetcher).not.toHaveBeenCalledWith(
      'https://outside.example/p',
      expect.anything()
    );
  });
});
