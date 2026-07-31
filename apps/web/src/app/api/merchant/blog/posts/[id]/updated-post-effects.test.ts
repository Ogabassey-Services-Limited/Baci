import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDispatchZohoBlogCampaign } = vi.hoisted(() => ({
  mockDispatchZohoBlogCampaign: vi.fn(),
}));

vi.mock('next/server', () => ({
  after: (callback: () => void | Promise<void>) => callback(),
}));

vi.mock('@/lib/indexnow', () => ({
  buildIndexNowBlogPostUrl: vi.fn(),
  getIndexNowHostFromIdentifiers: vi.fn(),
  submitIndexNowUrls: vi.fn(),
}));

vi.mock('@/lib/ogabassey-blog-image-prewarm', () => ({
  schedulePrewarmBlogImageTransforms: vi.fn(),
}));

vi.mock('@/lib/zoho-blog-campaign-dispatch', () => ({
  dispatchZohoBlogCampaign: (...args: unknown[]) =>
    mockDispatchZohoBlogCampaign(...args),
}));

import { scheduleUpdatedPostEffects } from './updated-post-effects';

const requestSupabase = createClient(
  'https://request-client.supabase.co',
  'request-anon-key'
);

describe('scheduleUpdatedPostEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatchZohoBlogCampaign.mockResolvedValue({
      postId: 'post-1',
      reason: 'Zoho Campaigns disabled',
      status: 'skipped',
    });
  });

  it('dispatches a newly published post with the authorized request client', () => {
    scheduleUpdatedPostEffects({
      blogRevalidation: undefined,
      featuredImageUrlChanged: false,
      post: {
        featured_image_url: null,
        id: 'post-1',
        merchant_id: 'merchant-1',
        slug: 'new-arrivals',
        status: 'published',
        title: 'New arrivals',
      },
      publishingNow: true,
      supabase: requestSupabase,
    });

    expect(mockDispatchZohoBlogCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        post: expect.objectContaining({ merchant_id: 'merchant-1' }),
        supabase: requestSupabase,
      })
    );
  });
});
