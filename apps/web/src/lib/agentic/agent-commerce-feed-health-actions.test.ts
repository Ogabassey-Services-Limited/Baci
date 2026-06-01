import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./agent-commerce-feed-health-snapshot', () => ({
  getAgentCommerceFeedHealthSnapshot: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import {
  type AgentCommerceFeedHealthResult,
  buildAgentCommerceFeedHealthActions,
  checkAgentCommerceFeedHealth,
  getAgentCommerceFeedStatusReason,
} from './agent-commerce-feed-health';
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

describe('buildAgentCommerceFeedHealthActions', () => {
  it('does not emit drift actions from monitor-only product snapshots', async () => {
    vi.mocked(getAgentCommerceFeedHealthSnapshot).mockResolvedValueOnce({
      googleProducts: googleFeed(['product-1', 'product-3']).products,
      openAiProducts: openAiFeed(['product-1', 'product-2']).products,
    });

    const result = await runCheck();
    const actions = buildAgentCommerceFeedHealthActions(result);

    expect(actions).toEqual([]);
  });

  it('maps empty feeds into a monitor action', async () => {
    vi.mocked(getAgentCommerceFeedHealthSnapshot).mockResolvedValueOnce({
      googleProducts: [],
      openAiProducts: [],
    });

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
    vi.mocked(getAgentCommerceFeedHealthSnapshot).mockRejectedValueOnce(
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
    vi.mocked(getAgentCommerceFeedHealthSnapshot).mockRejectedValueOnce(
      new Error('products unavailable')
    );

    const result = await runCheck();

    expect(getAgentCommerceFeedStatusReason(result, 'fallback')).toBe(
      'agent_commerce_feed_generation_failed'
    );
  });

  it('returns generation failure as the attention feed reason', () => {
    const result: AgentCommerceFeedHealthResult = {
      google_product_count: 2,
      issue_count: 1,
      issues: [
        {
          code: 'feed_generation_failed',
          count: 1,
          message: 'Feed generation failed',
          severity: 'attention',
        },
      ],
      latest_product_updated_at: '2026-05-22T10:00:00.000Z',
      openai_product_count: 2,
      shared_product_count: 1,
      stale_product_count: 0,
      status: 'attention',
    };

    expect(getAgentCommerceFeedStatusReason(result, 'fallback')).toBe(
      'agent_commerce_feed_generation_failed'
    );
  });
});
