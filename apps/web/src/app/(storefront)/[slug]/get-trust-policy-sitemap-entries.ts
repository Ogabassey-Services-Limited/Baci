import type { MetadataRoute } from 'next';
import {
  buildMerchantTrustProfile,
  hasPublishableReturnsPolicy,
  hasPublishableShippingPolicy,
  hasPublishableWarrantyPolicy,
} from '@/lib/storefront-trust/build-merchant-trust-profile';
import { isStorefrontStaticSitemapEligible } from './is-storefront-static-sitemap-eligible';
import type { SitemapStaticMerchant } from './sitemap-static-merchant';

export function getTrustPolicySitemapEntries({
  merchant,
  storeUrl,
}: {
  merchant: SitemapStaticMerchant;
  storeUrl: string;
}): MetadataRoute.Sitemap {
  if (!isStorefrontStaticSitemapEligible(merchant, storeUrl)) {
    return [];
  }

  const trustProfile = buildMerchantTrustProfile(merchant, storeUrl);
  const trustUrls = [
    hasPublishableReturnsPolicy(trustProfile) ? `${storeUrl}/returns` : null,
    hasPublishableShippingPolicy(trustProfile) ? `${storeUrl}/shipping` : null,
    hasPublishableWarrantyPolicy(trustProfile) ? `${storeUrl}/warranty` : null,
  ].filter((url): url is string => Boolean(url));
  const lastModified = merchant.updated_at
    ? new Date(merchant.updated_at)
    : undefined;

  return trustUrls.map((url) => ({
    url,
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));
}
