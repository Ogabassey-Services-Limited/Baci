import { describe, expect, it, vi } from 'vitest';
import { dispatchZohoBlogCampaign } from './zoho-blog-campaign-dispatch';
import {
  baseConfig,
  context,
  createDispatchSupabaseMock,
  post,
} from './zoho-blog-campaign-dispatch.test-utils';

describe('Zoho blog campaign dispatch review audience', () => {
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
      // Review audience overrides autoSend and always sends the campaign.
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
});
