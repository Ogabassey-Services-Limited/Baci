import type { ZohoCampaignsRuntimeConfig } from '@/env';

export const ZOHO_CAMPAIGNS_BLOG_SCOPES = [
  'ZohoCampaigns.campaign.CREATE',
  // Zoho documents sendcampaign under campaign.UPDATE; there is no separate send scope.
  'ZohoCampaigns.campaign.UPDATE',
  'ZohoCampaigns.contact.READ',
] as const;

export type FetchImplementation = typeof fetch;

export type ZohoBlogCampaignPost = {
  id: string;
  category?: string | null;
  excerpt?: string | null;
  merchant_id: string;
  published_at?: string | null;
  slug: string | null;
  title: string | null;
};

export type ZohoCampaignDispatchResult =
  | {
      postId: string;
      reason: string;
      status: 'skipped';
    }
  | {
      campaignKey: string;
      contentUrl: string;
      postId: string;
      status: 'created' | 'sent';
    }
  | {
      campaignKey?: string;
      error: string;
      postId: string;
      status: 'failed';
    };

export type ZohoCampaignCreateInput = {
  accessToken: string;
  blogUrl: string;
  config: ZohoCampaignsRuntimeConfig;
  contentUrl: string;
  fetchImpl: FetchImplementation;
  post: ZohoBlogCampaignPost;
};

export class ZohoCampaignsError extends Error {
  readonly code?: string;
  readonly statusCode?: number;

  constructor(
    message: string,
    options?: { code?: string; statusCode?: number }
  ) {
    super(message);
    this.name = 'ZohoCampaignsError';
    this.code = options?.code;
    this.statusCode = options?.statusCode;
  }
}
