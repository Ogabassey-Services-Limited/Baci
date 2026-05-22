import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import {
  buildAgentCommerceFeedHealthActions,
  checkAgentCommerceFeedHealth,
  getAgentCommerceFeedStatusReason,
} from './agent-commerce-feed-health';
import {
  AGENT_COMMERCE_FEED_HEALTH_TEST_NOW,
  googleFeed,
  openAiFeed,
} from './agent-commerce-feed-health-test-helpers';

function runCheck() {
  return checkAgentCommerceFeedHealth({
    merchantId: 'merchant-1',
    now: AGENT_COMMERCE_FEED_HEALTH_TEST_NOW,
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

describe('buildAgentCommerceFeedHealthActions', () => {
  it('maps feed issues into cron health actions', async () => {
    vi.mocked(getCachedGoogleMerchantFeedData).mockResolvedValueOnce(
      googleFeed(['product-1', 'product-3'])
    );

    const result = await runCheck();
    const actions = buildAgentCommerceFeedHealthActions(result);

    expect(actions).toEqual([
      {
        code: 'AGENTIC_FEED_CATALOG_DRIFT',
        count: 2,
        message:
          'OpenAI and Google Merchant feeds expose different active product sets.',
        next_step:
          'Compare OpenAI and Google Merchant feed product IDs, then refresh or publish any missing products.',
        next_step_url: '/dashboard/products',
        severity: 'attention',
      },
    ]);
  });

  it('maps empty feeds into a monitor action', async () => {
    vi.mocked(getCachedOpenAIFeedData).mockResolvedValueOnce(openAiFeed([]));
    vi.mocked(getCachedGoogleMerchantFeedData).mockResolvedValueOnce(
      googleFeed([])
    );

    const result = await runCheck();
    const actions = buildAgentCommerceFeedHealthActions(result);

    expect(actions).toEqual([
      expect.objectContaining({
        code: 'AGENTIC_FEED_EMPTY',
        count: 1,
        severity: 'monitor',
      }),
    ]);
  });

  it('maps feed generation failures into an attention action', async () => {
    vi.mocked(getCachedOpenAIFeedData).mockRejectedValueOnce(
      new Error('products unavailable')
    );

    const result = await runCheck();
    const actions = buildAgentCommerceFeedHealthActions(result);

    expect(actions).toEqual([
      expect.objectContaining({
        code: 'AGENTIC_FEED_GENERATION_FAILED',
        count: 1,
        severity: 'attention',
      }),
    ]);
  });

  it('maps stale products into a monitor action', async () => {
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
    const actions = buildAgentCommerceFeedHealthActions(result);

    expect(actions).toEqual([
      expect.objectContaining({
        code: 'AGENTIC_FEED_STALE_PRODUCTS',
        count: 1,
        severity: 'monitor',
      }),
    ]);
  });
});

describe('getAgentCommerceFeedStatusReason', () => {
  it('returns fallback reason when no attention issues exist', async () => {
    const result = await runCheck();

    expect(getAgentCommerceFeedStatusReason(result, 'fallback')).toBe(
      'fallback'
    );
  });

  it('returns the first attention feed reason', async () => {
    vi.mocked(getCachedOpenAIFeedData).mockRejectedValueOnce(
      new Error('products unavailable')
    );

    const result = await runCheck();

    expect(getAgentCommerceFeedStatusReason(result, 'fallback')).toBe(
      'agent_commerce_feed_generation_failed'
    );
  });
});
