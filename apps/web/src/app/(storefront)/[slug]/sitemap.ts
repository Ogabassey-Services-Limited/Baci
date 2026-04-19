import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import {
  buildMerchantTrustProfile,
  hasPublishableReturnsPolicy,
  hasPublishableShippingPolicy,
  hasPublishableWarrantyPolicy,
} from '@/lib/storefront-trust/build-merchant-trust-profile';
import {
  getRootSitemapEntries,
  resolveStorefrontSitemapContext,
} from './sitemap-data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const context = await resolveStorefrontSitemapContext(await headers());

  if (!context) {
    return [];
  }

  const [rootEntries, trustProfile] = await Promise.all([
    getRootSitemapEntries(context),
    Promise.resolve(
      buildMerchantTrustProfile(context.merchant, context.storeUrl)
    ),
  ]);

  const trustUrls = [
    hasPublishableReturnsPolicy(trustProfile)
      ? `${context.storeUrl}/returns`
      : null,
    hasPublishableShippingPolicy(trustProfile)
      ? `${context.storeUrl}/shipping`
      : null,
    hasPublishableWarrantyPolicy(trustProfile)
      ? `${context.storeUrl}/warranty`
      : null,
  ].filter((url): url is string => typeof url === 'string' && url.length > 0);

  return [
    ...rootEntries,
    ...trustUrls.map((url) => ({
      url,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
