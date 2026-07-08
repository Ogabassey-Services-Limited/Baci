import { buildMerchantBaseUrl } from '@/app/api/feed/google-merchant/route-utils';
import {
  MerchantNotFoundError,
  resolveFeedMerchant,
} from '@/lib/feed-identifier';
import { logger } from '@/lib/logger';
import { getCachedRepairsFeedData } from '@/lib/storefront-repairs/repairs-feed-data';
import { createAnonClient } from '@/lib/supabase/anon';
import { generateRepairsFacebookFeed } from './feed-builder';

type FacebookRepairsFeedServiceSuccess = {
  success: true;
  xml: string;
};

type FacebookRepairsFeedServiceFailure = {
  success: false;
  error: string;
  status: 404 | 500;
  cause: unknown;
};

export type FacebookRepairsFeedServiceResult =
  | FacebookRepairsFeedServiceSuccess
  | FacebookRepairsFeedServiceFailure;

async function resolvePrimaryCustomDomain(
  merchantId: string
): Promise<string | null> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from('domains')
    .select('domain')
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .eq('is_primary', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const domain = (data as { domain?: string | null } | null)?.domain;
  return domain ?? null;
}

export async function generateRepairsFacebookFeedForIdentifier({
  identifier,
  isBySlug,
}: {
  identifier: string;
  isBySlug: boolean;
}): Promise<FacebookRepairsFeedServiceResult> {
  try {
    const merchant = await resolveFeedMerchant(identifier, isBySlug);
    const customDomain = await resolvePrimaryCustomDomain(merchant.id);
    const baseUrl = buildMerchantBaseUrl({
      slug: merchant.slug,
      custom_domain: customDomain,
    });
    const { items } = await getCachedRepairsFeedData(merchant.id);

    return {
      success: true,
      xml: generateRepairsFacebookFeed(items, merchant, baseUrl),
    };
  } catch (error) {
    if (error instanceof MerchantNotFoundError) {
      return {
        success: false,
        status: 404,
        error: 'Merchant not found',
        cause: error,
      };
    }

    logger.error({
      message: 'Failed to generate Facebook repairs feed',
      error,
      identifier,
      isBySlug,
    });

    return {
      success: false,
      status: 500,
      error: 'Failed to generate feed',
      cause: error,
    };
  }
}
