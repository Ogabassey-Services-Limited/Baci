import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./agent-commerce-feed-health-snapshot', () => ({
  getAgentCommerceFeedHealthSnapshot: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import { logger } from '@/lib/logger';
import { checkAgentCommerceFeedHealth } from './agent-commerce-feed-health';
import { getAgentCommerceFeedHealthSnapshot } from './agent-commerce-feed-health-snapshot';
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
  vi.mocked(getAgentCommerceFeedHealthSnapshot).mockResolvedValue({
    googleProducts: googleFeed(['product-1', 'product-2']).products,
    openAiProducts: openAiFeed(['product-1', 'product-2']).products,
  });
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
    expect(getAgentCommerceFeedHealthSnapshot).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      supabase: undefined,
    });
  });

  it('passes the provided Supabase client through to the health snapshot query', async () => {
    const fakeSupabase = { from: vi.fn() } as unknown as SupabaseClient;

    await checkAgentCommerceFeedHealth({
      merchantId: 'merchant-1',
      now: AGENT_COMMERCE_FEED_HEALTH_TEST_NOW,
      slug: 'ogabassey',
      supabase: fakeSupabase,
    });

    expect(getAgentCommerceFeedHealthSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        supabase: fakeSupabase,
      })
    );
  });

  it('does not report catalog drift from the monitor-only product snapshot', async () => {
    vi.mocked(getAgentCommerceFeedHealthSnapshot).mockResolvedValueOnce({
      googleProducts: googleFeed(['product-1', 'product-3']).products,
      openAiProducts: openAiFeed(['product-1', 'product-2']).products,
    });

    const result = await runCheck();

    expect(result).toMatchObject({
      google_product_count: 2,
      issue_count: 0,
      openai_product_count: 2,
      shared_product_count: 2,
      status: 'ok',
    });
    expect(result.issues).toEqual([]);
  });

  it('returns monitor when agent-visible product timestamps are stale', async () => {
    vi.mocked(getAgentCommerceFeedHealthSnapshot).mockResolvedValueOnce({
      googleProducts: googleFeed(['product-1']).products,
      openAiProducts: [
        {
          id: 'product-1',
          updated_at: '2026-04-01T10:00:00.000Z',
        },
      ],
    });

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

  it('keeps old valid timestamps ok when freshness coverage remains healthy', async () => {
    const productIds = Array.from(
      { length: 100 },
      (_, index) => `product-${index + 1}`
    );
    // Two stale products keeps the catalog at the 98% freshness threshold.
    vi.mocked(getAgentCommerceFeedHealthSnapshot).mockResolvedValueOnce({
      googleProducts: googleFeed(productIds).products,
      openAiProducts: openAiFeed(productIds).products.map((product, index) => ({
        ...product,
        updated_at:
          index < 2 ? '2026-04-01T10:00:00.000Z' : '2026-05-22T10:00:00.000Z',
      })),
    });

    const result = await runCheck();

    expect(result).toMatchObject({
      issue_count: 0,
      latest_product_updated_at: '2026-05-22T10:00:00.000Z',
      stale_product_count: 2,
      status: 'ok',
    });
    expect(result.issues).toEqual([]);
  });

  it('treats missing or invalid feed timestamps as stale', async () => {
    vi.mocked(getAgentCommerceFeedHealthSnapshot).mockResolvedValueOnce({
      googleProducts: googleFeed(['product-1', 'product-2']).products,
      openAiProducts: [
        {
          id: 'product-1',
        },
        {
          id: 'product-2',
          updated_at: 'not-a-date',
        },
      ],
    });

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

  it('reports the broader stale count when missing timestamps also breach freshness coverage', async () => {
    const productIds = Array.from(
      { length: 100 },
      (_, index) => `product-${index + 1}`
    );
    vi.mocked(getAgentCommerceFeedHealthSnapshot).mockResolvedValueOnce({
      googleProducts: googleFeed(productIds).products,
      openAiProducts: openAiFeed(productIds).products.map((product, index) => ({
        ...product,
        updated_at: index === 0 ? undefined : '2026-04-01T10:00:00.000Z',
      })),
    });

    const result = await runCheck();

    expect(result).toMatchObject({
      issue_count: 1,
      latest_product_updated_at: '2026-04-01T10:00:00.000Z',
      stale_product_count: 100,
      status: 'monitor',
    });
    expect(result.issues).toEqual([
      {
        code: 'feed_stale',
        count: 100,
        message:
          'Agent-visible product timestamps include missing or invalid values, and freshness coverage is below the monitoring threshold.',
        severity: 'monitor',
      },
    ]);
  });

  it('returns monitor when both feed surfaces are empty', async () => {
    vi.mocked(getAgentCommerceFeedHealthSnapshot).mockResolvedValueOnce({
      googleProducts: [],
      openAiProducts: [],
    });

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
    vi.mocked(getAgentCommerceFeedHealthSnapshot).mockRejectedValueOnce(
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
