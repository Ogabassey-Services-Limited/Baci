import type { Metadata } from 'next';
import {
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_SRC,
  OGABASSEY_HERO_PRELOAD_IDENTIFIERS,
} from '@/components/storefront/ogabassey/components/hero-data';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { generateMetaDescription } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { isValidMerchantIdentifier } from '@/lib/validation';
import { StorefrontPageContent } from '../storefront-page-content';

// Origins the OgaBassey storefront fetches above-the-fold from.
// React 19 hoists these <link> tags to <head> automatically; warming the
// connection before the LCP image request is queued cuts handshake time.
const OGABASSEY_HERO_PRECONNECT_ORIGINS = [
  'https://cdn.ogabassey.com',
  'https://store.storeimages.cdn-apple.com',
] as const;

function OgabasseyHeroPreloads() {
  return (
    <>
      {OGABASSEY_HERO_PRECONNECT_ORIGINS.map((origin) => (
        <link key={`dns-${origin}`} rel="dns-prefetch" href={origin} />
      ))}
      {OGABASSEY_HERO_PRECONNECT_ORIGINS.map((origin) => (
        <link
          key={`preconnect-${origin}`}
          rel="preconnect"
          href={origin}
          crossOrigin="anonymous"
        />
      ))}
      <link
        rel="preload"
        as="image"
        href={HERO_DESKTOP_LCP_SRC}
        fetchPriority="high"
        media="(min-width: 768px)"
      />
      <link
        rel="preload"
        as="image"
        href={HERO_MOBILE_LCP_SRC}
        fetchPriority="high"
        media="(max-width: 767px)"
      />
    </>
  );
}

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
  const description = generateMetaDescription(
    merchant.site_description || merchant.site_tagline || '',
    160,
    {
      minLength: 110,
      fallback: `Shop at ${merchant.business_name || merchant.slug}. Discover products and services with trusted quality, nationwide delivery, and flexible payment options.`,
    }
  );

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

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  if (
    OGABASSEY_HERO_PRELOAD_IDENTIFIERS.has(resolvedParams.slug.toLowerCase())
  ) {
    return (
      <>
        <OgabasseyHeroPreloads />
        <StorefrontPageContent params={params} />
      </>
    );
  }

  return <StorefrontPageContent params={params} />;
}
