import type { MetadataRoute } from 'next';
import { buildHomeSeoDecision } from '@/lib/storefront-seo/build-home-seo-decision';
import { isSeoSitemapEligible } from '@/lib/storefront-seo/seo-indexing-metadata';
import {
  buildMerchantTrustProfile,
  hasPublishableReturnsPolicy,
  hasPublishableShippingPolicy,
  hasPublishableWarrantyPolicy,
} from '@/lib/storefront-trust/build-merchant-trust-profile';
import type { MerchantTrustProfileSource } from '@/lib/storefront-trust/merchant-trust-profile-types';

type SitemapStaticMerchant = MerchantTrustProfileSource & {
  business_name?: string | null;
  is_published?: boolean | null;
  slug: string;
  updated_at?: string | null;
};

function getMerchantLastModified(
  merchant: SitemapStaticMerchant
): Date | undefined {
  return merchant.updated_at ? new Date(merchant.updated_at) : undefined;
}

export function getStaticSitemapEntries({
  merchant,
  storeUrl,
}: {
  merchant: SitemapStaticMerchant;
  storeUrl: string;
}): MetadataRoute.Sitemap {
  if (
    !isSeoSitemapEligible(
      buildHomeSeoDecision({
        isPublished: merchant.is_published === true,
        canonicalUrl: storeUrl,
        merchantName: merchant.business_name ?? null,
      })
    )
  ) {
    return [];
  }

  const lastModified = getMerchantLastModified(merchant);
  return [
    { url: storeUrl, lastModified, changeFrequency: 'daily', priority: 1 },
    {
      url: `${storeUrl}/faq`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}

export function getTrustPolicySitemapEntries({
  merchant,
  storeUrl,
}: {
  merchant: SitemapStaticMerchant;
  storeUrl: string;
}): MetadataRoute.Sitemap {
  const trustProfile = buildMerchantTrustProfile(merchant, storeUrl);
  const trustUrls = [
    hasPublishableReturnsPolicy(trustProfile) ? `${storeUrl}/returns` : null,
    hasPublishableShippingPolicy(trustProfile) ? `${storeUrl}/shipping` : null,
    hasPublishableWarrantyPolicy(trustProfile) ? `${storeUrl}/warranty` : null,
  ].filter((url): url is string => Boolean(url));
  const lastModified = getMerchantLastModified(merchant);

  return trustUrls.map((url) => ({
    url,
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));
}
