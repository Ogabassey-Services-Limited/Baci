import { describe, expect, it, vi } from 'vitest';
import { dispatchZohoBlogCampaign } from './zoho-blog-campaign-dispatch';
import {
  baseConfig,
  context,
  createDispatchSupabaseMock,
  post,
} from './zoho-blog-campaign-dispatch.test-utils';

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
