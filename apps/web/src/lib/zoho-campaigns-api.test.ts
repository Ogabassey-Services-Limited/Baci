import { describe, expect, it, vi } from 'vitest';
import type { ZohoCampaignsRuntimeConfig } from '@/env';
import {
  createZohoBlogCampaign,
  refreshZohoCampaignsAccessToken,
  sendZohoCampaign,
} from './zoho-campaigns-api';

const config: ZohoCampaignsRuntimeConfig = {
  accountsServerUrl: 'https://accounts.zoho.com',
  apiRootUrl: 'https://campaigns.zoho.com/api/v1.1',
  autoSend: false,
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
  topicId: 'topic-1',
};

describe('Zoho Campaigns API client', () => {
  it('refreshes an access token using a refresh token grant', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'new-access-token' }), {
        status: 200,
      })
    );

    await expect(
      refreshZohoCampaignsAccessToken(config, fetchImpl)
    ).resolves.toBe('new-access-token');

    const body = fetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('refresh-token');
  });

  it('reports Zoho refresh errors with upstream details', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 400,
      })
    );

    await expect(
      refreshZohoCampaignsAccessToken(config, fetchImpl)
    ).rejects.toThrow('Zoho OAuth token refresh failed: invalid_grant');
  });

  it('throws before refreshing when required runtime config is missing', async () => {
    const fetchImpl = vi.fn();

    await expect(
      refreshZohoCampaignsAccessToken(
        { ...config, refreshToken: undefined },
        fetchImpl
      )
    ).rejects.toThrow('ZOHO_CAMPAIGNS_REFRESH_TOKEN');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('creates a campaign with encoded list details and optional topic id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ campaignKey: 'campaign-1', code: '200' }), {
        status: 200,
      })
    );

    await expect(
      createZohoBlogCampaign({
        accessToken: 'access-token',
        blogUrl: 'https://ogabassey.com/blog/hot-70',
        config,
        contentUrl:
          'https://ogabassey.com/api/integrations/zoho/blog-content/post-1',
        fetchImpl,
        post: {
          id: 'post-1',
          merchant_id: 'merchant-1',
          slug: 'hot-70',
          title: 'Hot 70 launch',
        },
      })
    ).resolves.toBe('campaign-1');

    const body = fetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get('list_details')).toBe('{"list-key":[]}');
    expect(body.get('topicId')).toBe('topic-1');
  });

  it('omits topic id when the Zoho topic is not configured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ campaignKey: 'campaign-1', code: '200' }), {
        status: 200,
      })
    );

    await createZohoBlogCampaign({
      accessToken: 'access-token',
      blogUrl: 'https://ogabassey.com/blog/hot-70',
      config: { ...config, topicId: undefined },
      contentUrl:
        'https://ogabassey.com/api/integrations/zoho/blog-content/post-1',
      fetchImpl,
      post: {
        id: 'post-1',
        merchant_id: 'merchant-1',
        slug: 'hot-70',
        title: 'Hot 70 launch',
      },
    });

    const body = fetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.has('topicId')).toBe(false);
  });

  it('throws before creating a campaign when required runtime config is missing', async () => {
    const fetchImpl = vi.fn();

    await expect(
      createZohoBlogCampaign({
        accessToken: 'access-token',
        blogUrl: 'https://ogabassey.com/blog/hot-70',
        config: { ...config, fromEmail: undefined, listKey: undefined },
        contentUrl:
          'https://ogabassey.com/api/integrations/zoho/blog-content/post-1',
        fetchImpl,
        post: {
          id: 'post-1',
          merchant_id: 'merchant-1',
          slug: 'hot-70',
          title: 'Hot 70 launch',
        },
      })
    ).rejects.toThrow('ZOHO_CAMPAIGNS_FROM_EMAIL');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws when Zoho does not return a campaign key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: '200' }), {
        status: 200,
      })
    );

    await expect(
      createZohoBlogCampaign({
        accessToken: 'access-token',
        blogUrl: 'https://ogabassey.com/blog/hot-70',
        config,
        contentUrl:
          'https://ogabassey.com/api/integrations/zoho/blog-content/post-1',
        fetchImpl,
        post: {
          id: 'post-1',
          merchant_id: 'merchant-1',
          slug: 'hot-70',
          title: 'Hot 70 launch',
        },
      })
    ).rejects.toThrow('Zoho Campaigns did not return campaignKey');
  });

  it('sends a created Zoho campaign', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          response: { campaign_status: 'inprogress', code: '200' },
        }),
        { status: 200 }
      )
    );

    await expect(
      sendZohoCampaign({
        accessToken: 'access-token',
        apiRootUrl: config.apiRootUrl,
        campaignKey: 'campaign-1',
        fetchImpl,
      })
    ).resolves.toBeUndefined();

    const body = fetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get('campaignkey')).toBe('campaign-1');
  });

  it('throws before sending when the campaign key is missing', async () => {
    const fetchImpl = vi.fn();

    await expect(
      sendZohoCampaign({
        accessToken: 'access-token',
        apiRootUrl: config.apiRootUrl,
        campaignKey: '   ',
        fetchImpl,
      })
    ).rejects.toThrow('Missing Zoho Campaigns campaign key');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws when Zoho send returns a non-success response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'campaign already sent' }), {
        status: 409,
      })
    );

    await expect(
      sendZohoCampaign({
        accessToken: 'access-token',
        apiRootUrl: config.apiRootUrl,
        campaignKey: 'campaign-1',
        fetchImpl,
      })
    ).rejects.toThrow('Zoho Campaigns request failed: campaign already sent');
  });
});
