import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleMerchantFeedData } from '@/app/api/feed/google-merchant/feed-data';
import type { OpenAIFeedData } from '@/app/api/feed/openai/feed-data';

vi.mock('@/app/api/feed/google-merchant/feed-data', () => ({
  getCachedGoogleMerchantFeedData: vi.fn(),
}));

vi.mock('@/app/api/feed/openai/feed-data', () => ({
  getCachedOpenAIFeedData: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import { getCachedGoogleMerchantFeedData } from '@/app/api/feed/google-merchant/feed-data';
import { getCachedOpenAIFeedData } from '@/app/api/feed/openai/feed-data';
import { logger } from '@/lib/logger';
import { checkAgentCommerceFeedHealth } from './agent-commerce-feed-health';

const NOW = new Date('2026-05-22T12:00:00.000Z');

function openAiFeed(productIds: string[]): OpenAIFeedData {
  return {
    products: productIds.map((id) => ({
      description: `${id} description`,
      id,
      name: id,
      price: 1000,
      stock: 5,
      updated_at: '2026-05-22T10:00:00.000Z',
    })),
  };
}

function googleFeed(productIds: string[]): GoogleMerchantFeedData {
  return {
    custom_domain: 'ogabassey.com',
    imageManifest: {},
    products: productIds.map((id) => ({
      description: `${id} description`,
      id,
      name: id,
      price: 1000,
      stock: 5,
      updated_at: '2026-05-22T10:00:00.000Z',
    })),
    slug: 'ogabassey',
  };
}

function runCheck() {
  return checkAgentCommerceFeedHealth({
    merchantId: 'merchant-1',
    now: NOW,
    slug: 'ogabassey',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCachedOpenAIFeedData).mockResolvedValue(
    openAiFeed(['product-1', 'product-2'])
  );
  vi.mocked(getCachedGoogleMerchantFeedData).mockResolvedValue(
    googleFeed(['product-1', 'product-2'])
  );
});

describe('checkAgentCommerceFeedHealth', () => {
  it('passes when OpenAI and Google feed product surfaces match', async () => {
    const result = await runCheck();

    expect(result).toEqual({
      google_product_count: 2,
      issue_count: 0,
      issues: [],
      latest_product_updated_at: '2026-05-22T10:00:00.000Z',
      openai_product_count: 2,
      shared_product_count: 2,
      stale_product_count: 0,
      status: 'ok',
    });
    expect(getCachedOpenAIFeedData).toHaveBeenCalledWith('merchant-1');
    expect(getCachedGoogleMerchantFeedData).toHaveBeenCalledWith(
      'merchant-1',
      'ogabassey'
    );
  });

  it('returns attention when feed product sets drift', async () => {
    vi.mocked(getCachedGoogleMerchantFeedData).mockResolvedValueOnce(
      googleFeed(['product-1', 'product-3'])
    );

    const result = await runCheck();

    expect(result).toMatchObject({
      google_product_count: 2,
      issue_count: 1,
      openai_product_count: 2,
      shared_product_count: 1,
      status: 'attention',
    });
    expect(result.issues).toEqual([
      {
        code: 'feed_catalog_drift',
        count: 2,
        message:
          'OpenAI and Google Merchant feeds expose different active product sets.',
        severity: 'attention',
      },
    ]);
  });

  it('returns monitor when agent-visible product timestamps are stale', async () => {
    vi.mocked(getCachedOpenAIFeedData).mockResolvedValueOnce({
      products: [
        {
          description: 'Stale product',
          id: 'product-1',
          name: 'Stale product',
          price: 1000,
          stock: 5,
          updated_at: '2026-04-01T10:00:00.000Z',
        },
      ],
    });
    vi.mocked(getCachedGoogleMerchantFeedData).mockResolvedValueOnce(
      googleFeed(['product-1'])
    );

    const result = await runCheck();

    expect(result).toMatchObject({
      issue_count: 1,
      latest_product_updated_at: '2026-04-01T10:00:00.000Z',
      stale_product_count: 1,
      status: 'monitor',
    });
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'feed_stale',
        count: 1,
        severity: 'monitor',
      }),
    ]);
  });

  it('treats missing or invalid feed timestamps as stale', async () => {
    vi.mocked(getCachedOpenAIFeedData).mockResolvedValueOnce({
      products: [
        {
          description: 'Missing timestamp',
          id: 'product-1',
          name: 'Missing timestamp',
          price: 1000,
          stock: 5,
        },
        {
          description: 'Invalid timestamp',
          id: 'product-2',
          name: 'Invalid timestamp',
          price: 1000,
          stock: 5,
          updated_at: 'not-a-date',
        },
      ],
    });
    vi.mocked(getCachedGoogleMerchantFeedData).mockResolvedValueOnce(
      googleFeed(['product-1', 'product-2'])
    );

    const result = await runCheck();

    expect(result).toMatchObject({
      issue_count: 1,
      latest_product_updated_at: null,
      stale_product_count: 2,
      status: 'monitor',
    });
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'feed_stale',
        count: 2,
        severity: 'monitor',
      }),
    ]);
  });

  it('returns monitor when both feed surfaces are empty', async () => {
    vi.mocked(getCachedOpenAIFeedData).mockResolvedValueOnce(openAiFeed([]));
    vi.mocked(getCachedGoogleMerchantFeedData).mockResolvedValueOnce(
      googleFeed([])
    );

    const result = await runCheck();

    expect(result).toMatchObject({
      google_product_count: 0,
      issue_count: 1,
      openai_product_count: 0,
      shared_product_count: 0,
      stale_product_count: 0,
      status: 'monitor',
    });
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'feed_empty',
        count: 1,
        severity: 'monitor',
      }),
    ]);
  });

  it('returns attention when feed generation fails', async () => {
    vi.mocked(getCachedOpenAIFeedData).mockRejectedValueOnce(
      new Error('products unavailable')
    );

    const result = await runCheck();

    expect(result).toEqual({
      google_product_count: null,
      issue_count: 1,
      issues: [
        {
          code: 'feed_generation_failed',
          count: 1,
          message:
            'Agent catalog feeds could not be generated for health monitoring.',
          severity: 'attention',
        },
      ],
      latest_product_updated_at: null,
      openai_product_count: null,
      shared_product_count: null,
      stale_product_count: null,
      status: 'attention',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Agent commerce feed health check failed',
        merchantId: 'merchant-1',
        slug: 'ogabassey',
      })
    );
  });
});
