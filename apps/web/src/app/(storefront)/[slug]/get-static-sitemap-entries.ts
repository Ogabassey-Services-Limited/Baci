import type { MetadataRoute } from 'next';
import { isStorefrontStaticSitemapEligible } from './is-storefront-static-sitemap-eligible';
import type { SitemapStaticMerchant } from './sitemap-static-merchant';

export function getStaticSitemapEntries({
  merchant,
  storeUrl,
}: {
  merchant: SitemapStaticMerchant;
  storeUrl: string;
}): MetadataRoute.Sitemap {
  if (!isStorefrontStaticSitemapEligible(merchant, storeUrl)) {
    return [];
  }

  const lastModified = merchant.updated_at
    ? new Date(merchant.updated_at)
    : undefined;
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
