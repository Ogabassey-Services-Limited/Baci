import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDispatchZohoBlogCampaign, mockGetRuntimeConfig } = vi.hoisted(
  () => ({
    mockDispatchZohoBlogCampaign: vi.fn(),
    mockGetRuntimeConfig: vi.fn(),
  })
);

vi.mock('server-only', () => ({}));
vi.mock('./zoho-blog-campaign-runtime-config', () => ({
  getZohoBlogCampaignRuntimeConfig: mockGetRuntimeConfig,
}));
vi.mock('./zoho-blog-campaign-dispatch', () => ({
  dispatchZohoBlogCampaign: mockDispatchZohoBlogCampaign,
}));

import { dispatchConfiguredZohoBlogCampaign } from './zoho-blog-campaign-server';

describe('dispatchConfiguredZohoBlogCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeConfig.mockReturnValue({ enabled: true });
    mockDispatchZohoBlogCampaign.mockResolvedValue({ status: 'skipped' });
  });

  it('injects server-only runtime configuration into campaign dispatch', async () => {
    const post = {
      id: 'post-1',
      merchant_id: 'merchant-1',
      slug: 'new-post',
      title: 'New post',
    };
    const supabase = { from: vi.fn() } as never;

    await dispatchConfiguredZohoBlogCampaign({ post, supabase });

    expect(mockDispatchZohoBlogCampaign).toHaveBeenCalledWith({
      config: { enabled: true },
      post,
      supabase,
    });
  });
});
