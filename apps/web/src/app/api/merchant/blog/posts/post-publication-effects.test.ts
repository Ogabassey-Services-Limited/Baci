import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDispatchZohoBlogCampaign, mockSchedulePrewarmBlogImageTransforms } =
  vi.hoisted(() => ({
    mockDispatchZohoBlogCampaign: vi.fn(),
    mockSchedulePrewarmBlogImageTransforms: vi.fn(),
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
  schedulePrewarmBlogImageTransforms: mockSchedulePrewarmBlogImageTransforms,
}));

vi.mock('@/lib/zoho-blog-campaign-dispatch', () => ({
  dispatchZohoBlogCampaign: (...args: unknown[]) =>
    mockDispatchZohoBlogCampaign(...args),
}));

import { scheduleCreatedPostPublicationEffects } from './post-publication-effects';

const requestSupabase = createClient(
  'https://request-client.supabase.co',
  'request-anon-key'
);

describe('scheduleCreatedPostPublicationEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatchZohoBlogCampaign.mockResolvedValue({
      postId: 'post-1',
      reason: 'Zoho Campaigns disabled',
      status: 'skipped',
    });
  });

  it('dispatches the created-post campaign with the authorized request client', () => {
    scheduleCreatedPostPublicationEffects({
      blogRevalidation: undefined,
      post: {
        featured_image_url: null,
        id: 'post-1',
        merchant_id: 'merchant-1',
        slug: 'new-arrivals',
        title: 'New arrivals',
      },
      supabase: requestSupabase,
    });

    expect(mockDispatchZohoBlogCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        post: expect.objectContaining({ merchant_id: 'merchant-1' }),
        supabase: requestSupabase,
      })
    );
  });

  it('does not schedule image prewarming when the created post has no featured image', () => {
    scheduleCreatedPostPublicationEffects({
      blogRevalidation: undefined,
      post: {
        featured_image_url: null,
        id: 'post-1',
        merchant_id: 'merchant-1',
        slug: 'new-arrivals',
        title: 'New arrivals',
      },
      supabase: requestSupabase,
    });

    expect(mockSchedulePrewarmBlogImageTransforms).not.toHaveBeenCalled();
  });
});
