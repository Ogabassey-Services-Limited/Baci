import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { ZohoCampaignsRuntimeConfig } from '@/env';
import { dispatchZohoBlogCampaign } from './zoho-blog-campaign-dispatch';

const baseConfig: ZohoCampaignsRuntimeConfig = {
  accountsServerUrl: 'https://accounts.zoho.com',
  apiRootUrl: 'https://campaigns.zoho.com/api/v1.1',
  autoSend: true,
  clientId: 'client-id',
  clientSecret: 'client-secret',
  enabled: true,
  fromEmail: 'news@ogabassey.com',
  fromName: 'OgaBassey',
  contentSecret: 'content-secret',
  listKey: 'list-key',
  publicBaseUrl: 'https://ogabassey.com',
  redirectUri: 'https://ogabassey.com/api/integrations/zoho/callback',
  refreshToken: 'refresh-token',
  requestTimeoutMs: 15_000,
};

const post = {
  id: '4db63f48-3577-4ef3-9e09-e3ec6af7a5a2',
  merchant_id: 'merchant-1',
  slug: 'infinix-hot-70-launch',
  title: 'Infinix Hot 70 released',
};

const context = {
  canonicalMerchantSlug: 'ogabassey',
  identifiers: ['ogabassey', 'ogabassey.com'],
};

const merchantZohoSettings = {
  zohoCampaigns: {
    enabled: true,
    fromEmail: 'news@merchant.test',
    listKey: 'merchant-list-key',
    refreshToken: 'merchant-refresh-token',
    reviewListKey: 'merchant-review-list-key',
  },
};

function createDispatchSupabaseMock({
  customSettings = merchantZohoSettings,
  businessName = 'Oga Gadgets',
}: {
  customSettings?: unknown;
  businessName?: string;
} = {}) {
  return {
    from(table: string) {
      const maybeSingle = () =>
        table === 'merchant_feature_settings'
          ? { data: { custom_settings: customSettings }, error: null }
          : {
              data: {
                brand_colors: { primary: '#dc2626' },
                business_name: businessName,
              },
              error: null,
            };
      return { select: () => ({ eq: () => ({ maybeSingle }) }) };
    },
  } as unknown as SupabaseClient;
}

describe('Zoho blog campaign dispatch', () => {
  it('skips dispatch when Zoho Campaigns is disabled', async () => {
    const result = await dispatchZohoBlogCampaign({
      config: { ...baseConfig, enabled: false },
      context,
      post,
      supabase: createDispatchSupabaseMock(),
    });

    expect(result).toEqual({
      postId: post.id,
      reason: 'Zoho Campaigns disabled',
      status: 'skipped',
    });
  });

  it('skips dispatch when the blog post has no slug', async () => {
    const result = await dispatchZohoBlogCampaign({
      config: baseConfig,
      context,
      post: { ...post, slug: null },
      supabase: createDispatchSupabaseMock(),
    });

    expect(result).toEqual({
      postId: post.id,
      reason: 'Blog post has no slug',
      status: 'skipped',
    });
  });

  it('skips dispatch when required Zoho config is missing', async () => {
    const result = await dispatchZohoBlogCampaign({
      config: { ...baseConfig, contentSecret: undefined },
      context,
      post,
      supabase: createDispatchSupabaseMock(),
    });

    expect(result).toEqual({
      postId: post.id,
      reason: 'Missing Zoho Campaigns config: ZOHO_CAMPAIGNS_CONTENT_SECRET',
      status: 'skipped',
    });
  });

  it('creates and sends a campaign for a newly published blog post', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-token' }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ campaignKey: 'campaign-1', code: '200' }),
          {
            status: 200,
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            response: { campaign_status: 'inprogress', code: '200' },
          }),
          { status: 200 }
        )
      );

    const result = await dispatchZohoBlogCampaign({
      config: baseConfig,
      context,
      fetchImpl,
      post,
      supabase: createDispatchSupabaseMock(),
    });

    expect(result).toMatchObject({
      campaignKey: 'campaign-1',
      postId: post.id,
      status: 'sent',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    const tokenBody = fetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(tokenBody.get('refresh_token')).toBe('merchant-refresh-token');

    const createBody = fetchImpl.mock.calls[1]?.[1]?.body as URLSearchParams;
    expect(createBody.get('campaignname')).toBe(
      'Blog: Infinix Hot 70 released'
    );
    const contentUrl = new URL(createBody.get('content_url') ?? '');
    expect(contentUrl.origin).toBe('https://ogabassey.com');
    expect(contentUrl.pathname).toBe(
      `/api/integrations/zoho/blog-content/${post.id}`
    );
    expect(contentUrl.searchParams.get('sig')).toMatch(/^[a-f0-9]{64}$/);
    expect(createBody.get('list_details')).toBe('{"merchant-list-key":[]}');
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: 'Zoho-oauthtoken access-token',
    });
  });

  it('sends a review campaign to the merchant review list', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-token' }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ campaignKey: 'campaign-review', code: '200' }),
          {
            status: 200,
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            response: { campaign_status: 'inprogress', code: '200' },
          }),
          { status: 200 }
        )
      );

    const result = await dispatchZohoBlogCampaign({
      audience: 'review',
      config: { ...baseConfig, autoSend: false },
      context,
      fetchImpl,
      post,
      supabase: createDispatchSupabaseMock(),
    });

    expect(result).toMatchObject({
      campaignKey: 'campaign-review',
      postId: post.id,
      status: 'sent',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    const createBody = fetchImpl.mock.calls[1]?.[1]?.body as URLSearchParams;
    expect(createBody.get('list_details')).toBe(
      '{"merchant-review-list-key":[]}'
    );
  });

  it('skips review campaigns when the merchant review list is missing', async () => {
    const fetchImpl = vi.fn();

    const result = await dispatchZohoBlogCampaign({
      audience: 'review',
      config: baseConfig,
      context,
      fetchImpl,
      post,
      supabase: createDispatchSupabaseMock({
        customSettings: {
          zohoCampaigns: {
            enabled: true,
            fromEmail: 'news@merchant.test',
            listKey: 'merchant-list-key',
            refreshToken: 'merchant-refresh-token',
          },
        },
      }),
    });

    expect(result).toEqual({
      postId: post.id,
      reason: 'Missing Zoho Campaigns merchant settings: reviewListKey',
      status: 'skipped',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('creates a draft campaign without sending when auto-send is disabled', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-token' }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ campaignKey: 'campaign-1', code: '200' }),
          {
            status: 200,
          }
        )
      );

    const result = await dispatchZohoBlogCampaign({
      config: { ...baseConfig, autoSend: false },
      context,
      fetchImpl,
      post,
      supabase: createDispatchSupabaseMock(),
    });

    expect(result).toMatchObject({
      campaignKey: 'campaign-1',
      postId: post.id,
      status: 'created',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns a failed result when campaign creation fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-token' }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'missing list' }), {
          status: 400,
        })
      );

    const result = await dispatchZohoBlogCampaign({
      config: baseConfig,
      context,
      fetchImpl,
      post,
      supabase: createDispatchSupabaseMock(),
    });

    expect(result).toMatchObject({
      error: 'Zoho Campaigns request failed: missing list',
      postId: post.id,
      status: 'failed',
    });
  });

  it('returns a failed result when Zoho requests time out', async () => {
    const fetchImpl = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    ) as unknown as typeof fetch;

    const result = await dispatchZohoBlogCampaign({
      config: { ...baseConfig, requestTimeoutMs: 1 },
      context,
      fetchImpl,
      post,
      supabase: createDispatchSupabaseMock(),
    });

    expect(result).toMatchObject({
      error: 'Zoho Campaigns request timed out after 1ms',
      postId: post.id,
      status: 'failed',
    });
  });

  it('returns a failed result with the campaign key when sending fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-token' }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ campaignKey: 'campaign-1', code: '200' }),
          {
            status: 200,
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'send blocked' }), {
          status: 403,
        })
      );

    const result = await dispatchZohoBlogCampaign({
      config: baseConfig,
      context,
      fetchImpl,
      post,
      supabase: createDispatchSupabaseMock(),
    });

    expect(result).toMatchObject({
      campaignKey: 'campaign-1',
      error: 'Zoho Campaigns request failed: send blocked',
      postId: post.id,
      status: 'failed',
    });
  });
});
