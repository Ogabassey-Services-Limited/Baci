import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAfter,
  mockBuildIndexNowBlogPostUrl,
  mockDispatchZohoBlogCampaign,
  mockGetIndexNowHostFromIdentifiers,
  mockSubmitIndexNowUrls,
} = vi.hoisted(() => ({
  mockAfter: vi.fn(),
  mockBuildIndexNowBlogPostUrl: vi.fn(),
  mockDispatchZohoBlogCampaign: vi.fn(),
  mockGetIndexNowHostFromIdentifiers: vi.fn(),
  mockSubmitIndexNowUrls: vi.fn(),
}));

vi.mock('next/server', () => ({ after: mockAfter }));
vi.mock('@/lib/indexnow', () => ({
  buildIndexNowBlogPostUrl: mockBuildIndexNowBlogPostUrl,
  getIndexNowHostFromIdentifiers: mockGetIndexNowHostFromIdentifiers,
  submitIndexNowUrls: mockSubmitIndexNowUrls,
}));
vi.mock('@/lib/zoho-blog-campaign-dispatch', () => ({
  dispatchZohoBlogCampaign: mockDispatchZohoBlogCampaign,
}));

import { schedulePostPublicationWorkflow } from './post-publication-workflow';

const requestSupabase = createClient(
  'https://request-client.supabase.co',
  'request-anon-key'
);

const post = {
  id: 'post-1',
  merchant_id: 'merchant-1',
  slug: 'new-arrivals',
  title: 'New arrivals',
};

async function runScheduledEffect() {
  const callback = mockAfter.mock.calls[0]?.[0] as
    | (() => Promise<void>)
    | undefined;
  if (!callback) throw new Error('Expected an after callback');
  await callback();
}

describe('schedulePostPublicationWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildIndexNowBlogPostUrl.mockReturnValue(
      'https://merchant.example/blog/new-arrivals'
    );
    mockDispatchZohoBlogCampaign.mockResolvedValue({ status: 'skipped' });
    mockGetIndexNowHostFromIdentifiers.mockReturnValue('merchant.example');
    mockSubmitIndexNowUrls.mockResolvedValue({ status: 'accepted' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('dispatches Zoho when IndexNow setup throws synchronously', async () => {
    mockSubmitIndexNowUrls.mockImplementation(() => {
      throw new Error('IndexNow unavailable');
    });

    schedulePostPublicationWorkflow({ post, supabase: requestSupabase });
    await runScheduledEffect();

    expect(mockDispatchZohoBlogCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ post, supabase: requestSupabase })
    );
    expect(console.error).toHaveBeenCalledWith(
      'IndexNow blog submit failed',
      expect.any(Error)
    );
  });

  it('dispatches Zoho when IndexNow rejects', async () => {
    mockSubmitIndexNowUrls.mockRejectedValue(new Error('IndexNow unavailable'));

    schedulePostPublicationWorkflow({ post, supabase: requestSupabase });
    await runScheduledEffect();

    expect(mockDispatchZohoBlogCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ post, supabase: requestSupabase })
    );
    expect(console.error).toHaveBeenCalledWith(
      'IndexNow blog submit failed',
      expect.any(Error)
    );
  });

  it('submits IndexNow when Zoho throws synchronously', async () => {
    mockDispatchZohoBlogCampaign.mockImplementation(() => {
      throw new Error('Zoho unavailable');
    });

    schedulePostPublicationWorkflow({ post, supabase: requestSupabase });
    await runScheduledEffect();

    expect(mockSubmitIndexNowUrls).toHaveBeenCalledWith({
      host: 'merchant.example',
      urls: ['https://merchant.example/blog/new-arrivals'],
    });
    expect(console.error).toHaveBeenCalledWith(
      'Zoho Campaigns blog dispatch failed',
      expect.any(Error)
    );
  });

  it('submits IndexNow when Zoho rejects', async () => {
    mockDispatchZohoBlogCampaign.mockRejectedValue(
      new Error('Zoho unavailable')
    );

    schedulePostPublicationWorkflow({ post, supabase: requestSupabase });
    await runScheduledEffect();

    expect(mockSubmitIndexNowUrls).toHaveBeenCalledWith({
      host: 'merchant.example',
      urls: ['https://merchant.example/blog/new-arrivals'],
    });
    expect(console.error).toHaveBeenCalledWith(
      'Zoho Campaigns blog dispatch failed',
      expect.any(Error)
    );
  });
});
