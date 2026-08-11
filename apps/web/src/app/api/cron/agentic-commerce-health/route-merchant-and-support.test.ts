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
import { logger } from '@/lib/logger';
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

  it('falls back to the legacy merchant slug env when the Baci slug is blank', async () => {
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', '   ');
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', ' legacy-store ');
    const supabase = createSupabaseMock({
      merchantRows: [
        {
          business_name: 'Legacy Store',
          id: 'merchant-legacy',
          is_published: true,
          slug: 'legacy-store',
        },
      ],
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);

    const response = await GET(createCronRequest());

    expect(response.status).toBe(200);
    expect(supabase.__mocks.merchantQuery.in).toHaveBeenCalledWith('slug', [
      'legacy-store',
    ]);
  });

  it('reports support chat provider failure without failing commerce status', async () => {
    vi.mocked(checkAgentCommerceSupportChatHealth).mockResolvedValue({
      issue_count: 1,
      issues: [
        {
          code: 'support_chat_static_fallback',
          message:
            'Support chat returned its static provider-failure fallback.',
        },
      ],
      response_time_ms: 125,
      status: 'attention',
      url: 'https://usebaci.com/api/chat',
    });

    const response = await GET(createCronRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      support_chat: {
        issue_count: 1,
        status: 'attention',
      },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Support chat health monitor needs attention',
      })
    );
  });

  it('reports Universal Cart readiness failures without failing the scheduled cron response', async () => {
    vi.mocked(checkAgentCommerceUniversalCartReadiness).mockResolvedValue({
      checks: [
        {
          id: 'ucp_cart_capability',
          message: 'Cart capability is missing.',
          status: 'fail',
        },
      ],
      lastCheckedAt: '2026-05-26T12:00:00.000Z',
      status: 'fail',
      url: 'https://ogabassey.com/.well-known/ucp',
    });

    const response = await GET(createCronRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      merchants: [
        {
          actions: [
            {
              code: 'AGENT_COMMERCE_UNIVERSAL_CART_NOT_READY',
              count: 1,
              severity: 'attention',
            },
          ],
          status: 'attention',
          status_reason: 'agent_commerce_universal_cart_not_ready',
          universal_cart: {
            status: 'fail',
          },
        },
      ],
      status: 'attention',
    });
  });
});
