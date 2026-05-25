import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import {
  buildMerchantTrustProfile,
  hasPublishableReturnsPolicy,
  hasPublishableShippingPolicy,
  hasPublishableWarrantyPolicy,
} from '@/lib/storefront-trust/build-merchant-trust-profile';
import {
  getStaticSitemapEntries,
  getNamedSitemapEntries,
  resolveStorefrontSitemapContext,
} from './sitemap-data';

/**
 * 2026 Best Practice: Sitemap Indexing
 * Generates multiple specialized sitemaps for easier SEO reporting in Google Search Console.
 */
export function generateSitemaps() {
  return [
    { id: 'static' },
    { id: 'products' },
    { id: 'categories' },
    { id: 'commercial-support' },
  ];
}

export default async function sitemap(props: {
  id: Promise<string> | string;
}): Promise<MetadataRoute.Sitemap> {
  const rawId = await props.id;
  const sitemapId = typeof rawId === 'string' ? rawId : await rawId;

  // Next.js 16 with generateSitemaps() only passes { id } — not params.
  // Read the merchant slug from proxy headers or fall back to the host header.
  const headersList = await headers();
  const routeSlug =
    headersList.get('x-merchant-slug') ??
    headersList.get('x-custom-domain') ??
    headersList.get('host')?.split('.')[0] ??
    '';

  const context = await resolveStorefrontSitemapContext(headersList, routeSlug);
  if (!context) {
    return [];
  }

  if (sitemapId === 'static') {
    const [staticEntries, trustProfile] = await Promise.all([
      getStaticSitemapEntries(context.storeUrl),
      buildMerchantTrustProfile(context.merchant, context.storeUrl),
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
      ...staticEntries,
      ...trustUrls.map((url) => ({
        url,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      })),
    ];
  }

  return getNamedSitemapEntries(context, sitemapId);
}
