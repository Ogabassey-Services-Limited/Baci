import type { Metadata } from 'next';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { buildStoreUrl } from '@/lib/store-url';
import { isValidMerchantIdentifier } from '@/lib/validation';
import { StorefrontPageContent } from '../storefront-page-content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  // Skip database query for invalid identifiers (like static asset requests)
  if (!isValidMerchantIdentifier(slug)) {
    return {
      title: 'Not Found',
      description: 'The page you are looking for does not exist.',
    };
  }

  // Use request-scoped lookup (deduplicates with layout, retries on transient errors)
  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) {
    return {
      title: 'Store Not Found',
      description: 'The store you are looking for does not exist.',
    };
  }

  const title =
    merchant?.site_title ||
    (merchant?.business_name
      ? `${merchant.business_name} - Official Online Store`
      : 'Official Online Store');
  const description =
    merchant.site_description ||
    merchant.site_tagline ||
    `Shop at ${merchant.business_name}. Browse our collection and enjoy convenient delivery.`;

  const baseUrl = buildStoreUrl(merchant);

  const socialMedia = merchant.social_media as Record<string, string> | null;

  return {
    metadataBase: new URL(baseUrl),
    title: title,
    description: description,
    keywords: [
      'Showmax Subscription',
      'Buy Showmax Online',
      'Cheap Airtime',
      'Buy Data Bundle',
      'Pay Electricity Bill',
      'Utility Payment',
      merchant.business_name,
      'Online Shopping',
      'Nigeria',
    ],
    alternates: {
      canonical: baseUrl,
    },
    openGraph: {
      title: title,
      description: description,
      url: baseUrl,
      type: 'website',
      siteName: merchant.business_name,
      ...(merchant.logo_url && {
        images: [
          { url: merchant.logo_url, alt: `${merchant.business_name} logo` },
        ],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      ...(merchant.logo_url && { images: [merchant.logo_url] }),
      ...(socialMedia?.twitter && {
        site: socialMedia.twitter.startsWith('@')
          ? socialMedia.twitter
          : `@${socialMedia.twitter}`,
      }),
    },
    // Dynamic Favicon Support
    icons: {
      icon:
        merchant.favicon_svg_url ||
        merchant.favicon_png_32_url ||
        '/favicon.ico',
      shortcut: merchant.favicon_png_32_url || '/favicon.ico',
      apple: merchant.favicon_apple_touch_url || '/favicon.ico',
    },
  };
}

export default function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <StorefrontPageContent params={params} />;
}
