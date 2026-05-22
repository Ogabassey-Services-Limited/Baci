import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getCronSecret: vi.fn(() => 'cron-secret'),
}));

vi.mock('@/lib/agentic/action-health-loader', () => ({
  loadAgenticActionHealth: vi.fn(),
}));

vi.mock('@/lib/agentic/agent-commerce-manifest-health', () => ({
  checkAgentCommerceManifestHealth: vi.fn(),
}));

vi.mock('@/lib/agentic/agent-commerce-feed-health', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/agentic/agent-commerce-feed-health')
  >('@/lib/agentic/agent-commerce-feed-health');

  return {
    ...actual,
    checkAgentCommerceFeedHealth: vi.fn(),
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

import { loadAgenticActionHealth } from '@/lib/agentic/action-health-loader';
import { checkAgentCommerceFeedHealth } from '@/lib/agentic/agent-commerce-feed-health';
import { checkAgentCommerceManifestHealth } from '@/lib/agentic/agent-commerce-manifest-health';
import { createAdminClient } from '@/lib/supabase/admin';
import { GET } from './route';

function createCronRequest() {
  return new NextRequest(
    'http://localhost:3000/api/cron/agentic-commerce-health',
    {
      headers: { authorization: 'Bearer cron-secret' },
      method: 'GET',
    }
  );
}

function createSupabaseMock() {
  const domainQuery = {
    eq: vi.fn(),
    in: vi.fn(),
    select: vi.fn(),
  };
  domainQuery.select.mockReturnValue(domainQuery);
  domainQuery.in.mockReturnValue(domainQuery);
  domainQuery.eq
    .mockImplementationOnce(() => domainQuery)
    .mockResolvedValueOnce({
      data: [{ domain: 'ogabassey.com', merchant_id: 'merchant-1' }],
      error: null,
    });

  const merchantQuery = {
    in: vi.fn().mockResolvedValue({
      data: [
        {
          business_name: 'Ogabassey',
          id: 'merchant-1',
          is_published: true,
          slug: 'ogabassey',
        },
      ],
      error: null,
    }),
    select: vi.fn(),
  };
  merchantQuery.select.mockReturnValue(merchantQuery);

  return {
    from: vi.fn((table: string) => {
      if (table === 'domains') return domainQuery;
      if (table === 'merchants') return merchantQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('GET /api/cron/agentic-commerce-health manifest monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAdminClient).mockReturnValue(createSupabaseMock() as never);
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
    vi.mocked(loadAgenticActionHealth).mockResolvedValue({
      actions: [
        {
          code: 'AGENTIC_ACTIONS_HEALTHY',
          count: 0,
          message: 'No recent agentic action issues need attention.',
          severity: 'ok',
        },
      ],
      generated_at: '2026-05-22T03:00:00.000Z',
    });
  });

  it('returns ok when the public manifest is healthy', async () => {
    vi.mocked(checkAgentCommerceManifestHealth).mockResolvedValue({
      issue_count: 0,
      issues: [],
      status: 'ok',
      url: 'https://ogabassey.com/agent-commerce.json',
    });

    const response = await GET(createCronRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      merchants: [
        {
          actions: [],
          manifest: {
            issue_count: 0,
            status: 'ok',
            url: 'https://ogabassey.com/agent-commerce.json',
          },
          status: 'ok',
        },
      ],
      status: 'ok',
    });
  });

  it('fails the cron response when the public manifest has capability drift', async () => {
    vi.mocked(checkAgentCommerceManifestHealth).mockResolvedValue({
      issue_count: 1,
      issues: [
        {
          code: 'manifest_contract_drift',
          message: 'Manifest advertises a partial checkout capability set.',
        },
      ],
      status: 'attention',
      url: 'https://ogabassey.com/agent-commerce.json',
    });

    const response = await GET(createCronRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      merchants: [
        {
          actions: [
            {
              code: 'AGENT_COMMERCE_MANIFEST_DRIFT',
              count: 1,
              severity: 'attention',
            },
          ],
          manifest: {
            issue_count: 1,
            status: 'attention',
            url: 'https://ogabassey.com/agent-commerce.json',
          },
          status: 'attention',
          status_reason: 'agent_commerce_manifest_drift',
        },
      ],
      status: 'attention',
    });
  });

  it('fails the cron response when the public manifest is unavailable', async () => {
    vi.mocked(checkAgentCommerceManifestHealth).mockResolvedValue({
      issue_count: 1,
      issues: [
        {
          code: 'manifest_unavailable',
          message: 'Manifest returned HTTP 404.',
        },
      ],
      status: 'attention',
      url: 'https://ogabassey.com/agent-commerce.json',
    });

    const response = await GET(createCronRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      merchants: [
        {
          actions: [
            {
              code: 'AGENT_COMMERCE_MANIFEST_UNAVAILABLE',
              count: 1,
              severity: 'attention',
            },
          ],
          manifest: {
            issue_count: 1,
            status: 'attention',
            url: 'https://ogabassey.com/agent-commerce.json',
          },
          status: 'attention',
          status_reason: 'agent_commerce_manifest_unavailable',
        },
      ],
      status: 'attention',
    });
  });
});
