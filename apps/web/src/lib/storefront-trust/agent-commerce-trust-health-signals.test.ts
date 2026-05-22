import { describe, expect, it } from 'vitest';
import type { OpenAIFeedProduct } from '@/app/api/feed/openai/feed-data';
import { buildAgentCommerceTrustHealthSignals } from './agent-commerce-trust-health-signals';

const NOW = new Date('2026-05-15T00:00:00.000Z');

function product(
  overrides: Partial<OpenAIFeedProduct> = {}
): OpenAIFeedProduct {
  return {
    id: 'product-1',
    name: 'Samsung Galaxy S25',
    description: 'Flagship phone',
    slug: 'samsung-galaxy-s25',
    price: 500_000,
    stock: 5,
    stock_quantity: 5,
    manage_stock: true,
    category: 'phones',
    average_rating: 4.7,
    review_count: 24,
    updated_at: '2026-05-10T00:00:00.000Z',
    ...overrides,
  };
}

function buildSignals(products: OpenAIFeedProduct[]) {
  return buildAgentCommerceTrustHealthSignals({
    now: NOW,
    openAiProducts: products,
    surfaces: {
      llms: 'https://ogabassey.com/llms.txt',
      robots: 'https://ogabassey.com/robots.txt',
      sitemap: 'https://ogabassey.com/sitemap.xml',
    },
  });
}

describe('buildAgentCommerceTrustHealthSignals', () => {
  it('passes when product metadata, timestamps, and crawler URLs are usable', () => {
    const result = buildSignals([
      product(),
      product({
        id: 'product-2',
        name: 'Pixel 10',
        slug: 'pixel-10',
        updated_at: '2026-05-11T00:00:00.000Z',
      }),
    ]);

    expect(result.totals).toEqual({
      latestProductUpdatedAt: '2026-05-11T00:00:00.000Z',
      productsWithStructuredData: 2,
      staleProducts: 0,
    });
    expect(
      result.checks.find((check) => check.id === 'structured-data-readiness')
    ).toMatchObject({ severity: 'pass' });
    expect(
      result.checks.find((check) => check.id === 'review-signal-coverage')
    ).toMatchObject({ severity: 'pass' });
    expect(
      result.checks.find((check) => check.id === 'feed-freshness')
    ).toMatchObject({ severity: 'pass' });
    expect(
      result.checks.find((check) => check.id === 'crawler-visibility')
    ).toMatchObject({ severity: 'pass' });
  });

  it('warns when only some products have structured fields or usable timestamps', () => {
    const result = buildSignals([
      product({ updated_at: '2026-03-01T00:00:00.000Z' }),
      product({
        category: undefined,
        description: '',
        id: 'product-2',
        name: 'Pixel 10',
        review_count: null,
        slug: 'pixel-10',
        updated_at: undefined,
      }),
    ]);

    expect(result.totals).toEqual({
      latestProductUpdatedAt: '2026-03-01T00:00:00.000Z',
      productsWithStructuredData: 1,
      staleProducts: 2,
    });
    expect(
      result.checks.find((check) => check.id === 'structured-data-readiness')
    ).toMatchObject({ affectedProductCount: 1, severity: 'warn' });
    expect(
      result.checks.find((check) => check.id === 'review-signal-coverage')
    ).toMatchObject({ severity: 'warn' });
    expect(
      result.checks.find((check) => check.id === 'feed-freshness')
    ).toMatchObject({
      affectedProductCount: 2,
      message:
        'Product timestamps are missing or invalid for 1 product, and 2 products are outside the freshness window.',
      severity: 'warn',
    });
  });

  it('passes freshness when older valid timestamps stay below the warning threshold', () => {
    // Two stale products keeps the catalog at the 98% freshness threshold.
    const result = buildSignals(
      Array.from({ length: 100 }, (_, index) =>
        product({
          id: `product-${index + 1}`,
          slug: `product-${index + 1}`,
          updated_at:
            index < 2 ? '2026-03-01T00:00:00.000Z' : '2026-05-10T00:00:00.000Z',
        })
      )
    );

    expect(result.totals).toMatchObject({
      latestProductUpdatedAt: '2026-05-10T00:00:00.000Z',
      staleProducts: 2,
    });
    expect(
      result.checks.find((check) => check.id === 'feed-freshness')
    ).toMatchObject({
      affectedProductCount: 0,
      message: 'Latest product feed timestamp is 2026-05-10T00:00:00.000Z.',
      severity: 'pass',
    });
  });

  it('warns freshness when older valid timestamps exceed the warning threshold', () => {
    const result = buildSignals([
      product({ updated_at: '2026-03-01T00:00:00.000Z' }),
      product({
        id: 'product-2',
        slug: 'product-2',
        updated_at: '2026-05-10T00:00:00.000Z',
      }),
    ]);

    expect(result.totals).toMatchObject({
      latestProductUpdatedAt: '2026-05-10T00:00:00.000Z',
      staleProducts: 1,
    });
    expect(
      result.checks.find((check) => check.id === 'feed-freshness')
    ).toMatchObject({
      affectedProductCount: 1,
      message:
        'Product timestamps are outside the freshness window for 1 product.',
      severity: 'warn',
    });
  });

  it('reports stale coverage when missing timestamps also exceed the warning threshold', () => {
    const result = buildSignals(
      Array.from({ length: 100 }, (_, index) =>
        product({
          id: `product-${index + 1}`,
          slug: `product-${index + 1}`,
          updated_at: index === 0 ? undefined : '2026-03-01T00:00:00.000Z',
        })
      )
    );

    expect(result.totals).toMatchObject({
      latestProductUpdatedAt: '2026-03-01T00:00:00.000Z',
      staleProducts: 100,
    });
    expect(
      result.checks.find((check) => check.id === 'feed-freshness')
    ).toMatchObject({
      affectedProductCount: 100,
      message:
        'Product timestamps are missing or invalid for 1 product, and 100 products are outside the freshness window.',
      severity: 'warn',
    });
  });

  it('treats zero-review products as missing review signal coverage', () => {
    const result = buildSignals([
      product({
        average_rating: 0,
        review_count: 0,
      }),
    ]);

    expect(
      result.checks.find((check) => check.id === 'review-signal-coverage')
    ).toMatchObject({
      affectedProductCount: 1,
      message:
        '0 of 1 agent-visible products have usable review count and rating metadata.',
      severity: 'fail',
    });
  });

  it('passes missing product reviews when merchant review authority is connected', () => {
    const result = buildAgentCommerceTrustHealthSignals({
      hasVerifiedMerchantReviewAuthority: true,
      now: NOW,
      openAiProducts: [
        product({
          average_rating: null,
          review_count: null,
        }),
      ],
      surfaces: {
        llms: 'https://ogabassey.com/llms.txt',
        robots: 'https://ogabassey.com/robots.txt',
        sitemap: 'https://ogabassey.com/sitemap.xml',
      },
    });

    expect(
      result.checks.find((check) => check.id === 'review-signal-coverage')
    ).toMatchObject({
      affectedProductCount: 0,
      message:
        '0 of 1 agent-visible products have product-level review metadata; verified merchant-level Google review authority satisfies review trust for this catalog.',
      severity: 'pass',
    });
  });

  it('fails freshness and crawler checks when timestamps or crawler URLs are unusable', () => {
    const result = buildAgentCommerceTrustHealthSignals({
      now: NOW,
      openAiProducts: [product({ updated_at: 'not-a-date' })],
      surfaces: {
        llms: 'https://ogabassey.com/llms.txt',
        robots: 'not-a-url',
        sitemap: 'https://ogabassey.com/sitemap.xml',
      },
    });

    expect(result.totals).toEqual({
      latestProductUpdatedAt: null,
      productsWithStructuredData: 1,
      staleProducts: 1,
    });
    expect(
      result.checks.find((check) => check.id === 'feed-freshness')
    ).toMatchObject({ affectedProductCount: 1, severity: 'fail' });
    expect(
      result.checks.find((check) => check.id === 'crawler-visibility')
    ).toMatchObject({ severity: 'fail' });
  });
});
