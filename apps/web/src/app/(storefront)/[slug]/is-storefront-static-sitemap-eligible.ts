import { buildHomeSeoDecision } from '@/lib/storefront-seo/build-home-seo-decision';
import { isSeoSitemapEligible } from '@/lib/storefront-seo/is-seo-sitemap-eligible';
import { isStorefrontSitemapPublished } from '@/lib/storefront-seo/is-storefront-sitemap-published';
import type { SitemapStaticMerchant } from './sitemap-static-merchant';

export function isStorefrontStaticSitemapEligible(
  merchant: SitemapStaticMerchant,
  storeUrl: string
): boolean {
  return (
    isStorefrontSitemapPublished(merchant) &&
    isSeoSitemapEligible(
      buildHomeSeoDecision({
        isPublished: true,
        canonicalUrl: storeUrl,
        merchantName: merchant.business_name ?? null,
      })
    )
  );
}
