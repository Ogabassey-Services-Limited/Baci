import {
  MerchantNotFoundError,
  resolveFeedMerchant,
} from '@/lib/feed-identifier';
import { logger } from '@/lib/logger';
import { getCachedGoogleMerchantFeedData } from '../google-merchant/feed-data';
import { buildMerchantBaseUrl } from '../google-merchant/route-utils';
import { generateFacebookCatalogFeed } from './feed-builder';

type FacebookCatalogFeedServiceSuccess = {
  success: true;
  xml: string;
};

type FacebookCatalogFeedServiceFailure = {
  success: false;
  error: string;
  status: 404 | 500;
  cause: unknown;
};

export type FacebookCatalogFeedServiceResult =
  | FacebookCatalogFeedServiceSuccess
  | FacebookCatalogFeedServiceFailure;

export async function generateFacebookCatalogFeedForIdentifier({
  identifier,
  isBySlug,
}: {
  identifier: string;
  isBySlug: boolean;
}): Promise<FacebookCatalogFeedServiceResult> {
  try {
    const resolvedMerchant = await resolveFeedMerchant(identifier, isBySlug);
    const { custom_domain, products, imageManifest } =
      await getCachedGoogleMerchantFeedData(
        resolvedMerchant.id,
        resolvedMerchant.slug
      );
    const merchant = {
      ...resolvedMerchant,
      custom_domain,
    };
    const baseUrl = buildMerchantBaseUrl({
      slug: resolvedMerchant.slug,
      custom_domain,
    });

    return {
      success: true,
      xml: generateFacebookCatalogFeed(
        products,
        merchant,
        baseUrl,
        imageManifest
      ),
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
      message: 'Failed to generate Facebook catalog feed',
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
