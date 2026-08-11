import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getCronSecret: vi.fn(() => 'cron-secret'),
  getRootDomain: vi.fn(() => 'usebaci.com'),
}));

vi.mock('@/lib/agentic/action-health-loader', () => ({
  loadAgenticActionHealth: vi.fn(),
}));

vi.mock('@/lib/agentic/agent-commerce-manifest-health', () => ({
  checkAgentCommerceManifestHealth: vi.fn(),
}));

vi.mock('@/lib/agentic/agent-commerce-health-monitor', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/agentic/agent-commerce-health-monitor')
  >('@/lib/agentic/agent-commerce-health-monitor');

  return {
    ...actual,
    checkAgentCommerceUniversalCartReadiness: vi.fn(),
  };
});

vi.mock(
  '@/lib/agentic/agent-commerce-public-product-parity-health',
  async () => {
    const actual = await vi.importActual<
      typeof import('@/lib/agentic/agent-commerce-public-product-parity-health')
    >('@/lib/agentic/agent-commerce-public-product-parity-health');

    return {
      ...actual,
      checkAgentCommercePublicProductParity: vi.fn(),
    };
  }
);

vi.mock('@/lib/agentic/agent-commerce-feed-health', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/agentic/agent-commerce-feed-health')
  >('@/lib/agentic/agent-commerce-feed-health');

  return {
    ...actual,
    checkAgentCommerceFeedHealth: vi.fn(),
  };
});

vi.mock('@/lib/agentic/agent-commerce-support-chat-health', () => ({
  checkAgentCommerceSupportChatHealth: vi.fn(),
}));

vi.mock('@/lib/agentic/agent-commerce-trust-health', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/agentic/agent-commerce-trust-health')
  >('@/lib/agentic/agent-commerce-trust-health');

  return {
    ...actual,
    checkAgentCommerceTrustHealth: vi.fn(),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

import { getCronSecret } from '@/env';
import { loadAgenticActionHealth } from '@/lib/agentic/action-health-loader';
import { checkAgentCommerceFeedHealth } from '@/lib/agentic/agent-commerce-feed-health';
import { checkAgentCommerceUniversalCartReadiness } from '@/lib/agentic/agent-commerce-health-monitor';
import { checkAgentCommerceManifestHealth } from '@/lib/agentic/agent-commerce-manifest-health';
import { checkAgentCommercePublicProductParity } from '@/lib/agentic/agent-commerce-public-product-parity-health';
import { checkAgentCommerceSupportChatHealth } from '@/lib/agentic/agent-commerce-support-chat-health';
import { checkAgentCommerceTrustHealth } from '@/lib/agentic/agent-commerce-trust-health';
import { createAdminClient } from '@/lib/supabase/admin';
import { GET } from './route';
import {
  createCronRequest,
  createSupabaseMock,
  healthyAction,
} from './route.test-setup';

describe('GET /api/cron/agentic-commerce-health', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.mocked(getCronSecret).mockReturnValue('cron-secret');
    vi.mocked(checkAgentCommerceManifestHealth).mockResolvedValue({
      issue_count: 0,
      issues: [],
      status: 'ok',
      url: 'https://ogabassey.com/agent-commerce.json',
    });
    vi.mocked(checkAgentCommerceFeedHealth).mockResolvedValue({
      google_product_count: 2,
      issue_count: 0,
      issues: [],
      latest_product_updated_at: '2026-05-22T10:00:00.000Z',
      openai_product_count: 2,
      shared_product_count: 2,
      stale_product_count: 0,
      status: 'ok',
    });
    vi.mocked(checkAgentCommerceSupportChatHealth).mockResolvedValue({
      issue_count: 0,
      issues: [],
      response_time_ms: 120,
      status: 'ok',
      url: 'https://usebaci.com/api/chat',
    });
    vi.mocked(checkAgentCommerceTrustHealth).mockResolvedValue({
      issue_count: 0,
      issues: [],
      status: 'ok',
      url: 'https://ogabassey.com/agent-trust.json',
    });
    vi.mocked(checkAgentCommercePublicProductParity).mockResolvedValue({
      issue_count: 0,
      issues: [],
      sample_product_id: 'product-1',
      status: 'ok',
      surfaces: {
        agent_products: 'https://ogabassey.com/feeds/agent-products.jsonl',
        google_merchant_xml: 'https://ogabassey.com/feeds/google-merchant.xml',
        product_api:
          'https://ogabassey.com/api/storefront/ogabassey/products?limit=10',
        product_page: 'https://ogabassey.com/phones/test-phone',
      },
    });
    vi.mocked(checkAgentCommerceUniversalCartReadiness).mockResolvedValue({
      checks: [],
      lastCheckedAt: '2026-05-26T12:00:00.000Z',
      status: 'pass',
      url: 'https://ogabassey.com/.well-known/ucp',
    });
    vi.mocked(loadAgenticActionHealth).mockResolvedValue({
      actions: [healthyAction],
      generated_at: '2026-05-22T03:00:00.000Z',
      requests: {
        recent_count: 1,
        records: [
          {
            agent_id: 'openai:chatgpt',
            api_version: '2026-04-28',
            created_at: '2026-05-22T08:03:00.000Z',
            expires_at: '2026-05-22T08:18:00.000Z',
            route: 'checkout_sessions.complete',
          },
        ],
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(createSupabaseMock() as never);
  });

  it('reports feed generation attention without failing the scheduled cron response', async () => {
    vi.mocked(checkAgentCommerceFeedHealth).mockResolvedValue({
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

    const response = await GET(createCronRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      merchants: [
        {
          actions: [
            {
              code: 'AGENTIC_FEED_GENERATION_FAILED',
              count: 1,
              severity: 'attention',
            },
          ],
          feeds: {
            issue_count: 1,
            status: 'attention',
          },
          status: 'attention',
          status_reason: 'agent_commerce_feed_generation_failed',
        },
      ],
      status: 'attention',
    });
  });

  it('keeps stale feed products as monitor-only actions', async () => {
    vi.mocked(checkAgentCommerceFeedHealth).mockResolvedValue({
      google_product_count: 2,
      issue_count: 1,
      issues: [
        {
          code: 'feed_stale',
          count: 1,
          message:
            'One or more agent-visible products have stale or missing feed timestamps.',
          severity: 'monitor',
        },
      ],
      latest_product_updated_at: '2026-04-01T10:00:00.000Z',
      openai_product_count: 2,
      shared_product_count: 2,
      stale_product_count: 1,
      status: 'monitor',
    });

    const response = await GET(createCronRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      merchants: [
        {
          actions: [
            {
              code: 'AGENTIC_FEED_STALE_PRODUCTS',
              count: 1,
              severity: 'monitor',
            },
          ],
          feeds: {
            stale_product_count: 1,
            status: 'monitor',
          },
          status: 'monitor',
        },
      ],
      status: 'monitor',
    });
  });
});
