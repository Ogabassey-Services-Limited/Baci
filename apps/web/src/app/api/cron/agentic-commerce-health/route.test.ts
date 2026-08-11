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

  it('returns 401 when the cron secret is invalid', async () => {
    const response = await GET(createCronRequest({ auth: 'Bearer wrong' }));

    expect(response.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('returns 500 when the cron secret is not configured', async () => {
    vi.mocked(getCronSecret).mockReturnValue(undefined);

    const response = await GET(createCronRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: 'server_misconfigured',
      error: 'Server misconfigured',
    });
  });

  it('returns a healthy monitor summary for the requested merchant slugs', async () => {
    const supabase = createSupabaseMock();
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);

    const response = await GET(
      createCronRequest({
        search: '?merchant_slug=Ogabassey&fail_on_attention=false',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      merchant_count: 1,
      merchants: [
        {
          actions: [],
          action_health: {
            actions: {
              ok_count: 1,
              total_count: 1,
            },
            requests: {
              recent_count: 1,
            },
          },
          business_name: 'Ogabassey',
          crawler: {
            issue_count: 0,
            status: 'ok',
          },
          feeds: {
            google_product_count: 2,
            openai_product_count: 2,
            status: 'ok',
          },
          merchant_id: 'merchant-1',
          parity: {
            issue_count: 0,
            sample_product_id: 'product-1',
            status: 'ok',
          },
          slug: 'ogabassey',
          status: 'ok',
          status_reason: 'agentic_action_health_ok',
          trust: {
            issue_count: 0,
            status: 'ok',
            url: 'https://ogabassey.com/agent-trust.json',
          },
          universal_cart: {
            status: 'pass',
            url: 'https://ogabassey.com/.well-known/ucp',
          },
        },
      ],
      status: 'ok',
      support_chat: {
        issue_count: 0,
        response_time_ms: 120,
        status: 'ok',
        url: 'https://usebaci.com/api/chat',
      },
    });
    expect(body.merchants[0].action_health.requests).not.toHaveProperty(
      'records'
    );
    expect(supabase.__mocks.merchantQuery.select).toHaveBeenCalledWith(
      'id, slug, business_name, is_published'
    );
    expect(supabase.__mocks.merchantQuery.in).toHaveBeenCalledWith('slug', [
      'ogabassey',
    ]);
    expect(checkAgentCommerceManifestHealth).toHaveBeenCalledWith({
      custom_domain: 'ogabassey.com',
      slug: 'ogabassey',
    });
    expect(loadAgenticActionHealth).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      { recordsSource: 'admin_direct' }
    );
    expect(checkAgentCommerceFeedHealth).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      slug: 'ogabassey',
      supabase,
    });
    expect(checkAgentCommerceTrustHealth).toHaveBeenCalledWith({
      custom_domain: 'ogabassey.com',
      slug: 'ogabassey',
    });
    expect(checkAgentCommercePublicProductParity).toHaveBeenCalledWith({
      custom_domain: 'ogabassey.com',
      slug: 'ogabassey',
    });
    expect(checkAgentCommerceUniversalCartReadiness).toHaveBeenCalledWith({
      custom_domain: 'ogabassey.com',
      slug: 'ogabassey',
    });
    expect(checkAgentCommerceSupportChatHealth).toHaveBeenCalledOnce();
    expect(supabase.__mocks.crawlerQuery.select).toHaveBeenCalledWith(
      'agent_family, bot_name, cache_outcome, crawled_at, host, response_time_ms, status_code, url_path, user_agent'
    );
    expect(supabase.__mocks.crawlerQuery.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
  });
});
