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
    updated_at: '2026-05-10T00:00:00.000Z',
    ...overrides,
  };
}

function buildSignals(products: OpenAIFeedProduct[]) {
  return buildAgentCommerceTrustHealthSignals({
    now: NOW,
    openAiProducts: products,
    surfaces: {
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
      result.checks.find((check) => check.id === 'feed-freshness')
    ).toMatchObject({ severity: 'pass' });
    expect(
      result.checks.find((check) => check.id === 'crawler-visibility')
    ).toMatchObject({ severity: 'pass' });
  });

  it('warns when only some products have structured fields or fresh timestamps', () => {
    const result = buildSignals([
      product({ updated_at: '2026-03-01T00:00:00.000Z' }),
      product({
        category: undefined,
        description: '',
        id: 'product-2',
        name: 'Pixel 10',
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
    ).toMatchObject({ severity: 'warn' });
    expect(
      result.checks.find((check) => check.id === 'feed-freshness')
    ).toMatchObject({
      message: '2 products have stale or missing feed timestamps.',
      severity: 'warn',
    });
  });

  it('fails freshness and crawler checks when timestamps or crawler URLs are unusable', () => {
    const result = buildAgentCommerceTrustHealthSignals({
      now: NOW,
      openAiProducts: [product({ updated_at: 'not-a-date' })],
      surfaces: {
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
    ).toMatchObject({ severity: 'fail' });
    expect(
      result.checks.find((check) => check.id === 'crawler-visibility')
    ).toMatchObject({ severity: 'fail' });
  });
});
