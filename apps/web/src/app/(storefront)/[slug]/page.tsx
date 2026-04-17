import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateLocalBusinessSchema,
  generateOrganizationSchema,
  generateWebSiteSchema,
  type LocalBusinessData,
  type OrganizationData,
} from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { isValidMerchantIdentifier } from '@/lib/validation';
import { StorefrontContent } from './storefront-content';

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

/**
 * Storefront Homepage
 *
 * STREAMING SSR: Only essential work happens before HTML is sent.
 * Heavy data fetching (products, categories) is deferred to StorefrontContent
 * which streams in via Suspense.
 */
export async function StorefrontPageContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Validate identifier format (can be slug or domain)
  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }

  // Hoist headers() — used for pathname check and schema generation below.
  // React deduplicates this call with generateMetadata's headers() invocation.
  const headersList = await headers();

  // This page only serves the storefront homepage.
  // If the original path had sub-segments (e.g., /product/..., /product-tag/...),
  // it means no child route matched — return 404 instead of rendering the homepage.
  // In subdomain/custom-domain mode, x-pathname is "/" for the homepage.
  // In path-mode (dev), x-pathname is "/{slug}" — also a valid homepage hit.
  const originalPathname = headersList.get('x-pathname') || '/';
  const isHomepage =
    originalPathname === '/' || originalPathname === `/${slug}`;
  if (!isHomepage) {
    notFound();
  }

  // CRITICAL: Merchant lookup — request-scoped (deduplicates with layout)
  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  // Check if store is published
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!merchant.is_published && !isDevelopment) {
    return <StoreNotPublished businessName={merchant.business_name} />;
  }

  // Generate schemas (fast, uses cached merchant data)
  const baseUrl = buildStoreUrl(merchant);
  const description =
    merchant.site_description ||
    merchant.site_tagline ||
    `Welcome to ${merchant.business_name}`;
  const socialMedia = merchant.social_media as Record<string, string> | null;

  // Build social media URLs
  const socialMediaUrls: Record<string, string> = {};
  if (socialMedia) {
    if (socialMedia.facebook)
      socialMediaUrls.facebook = `https://facebook.com/${encodeURIComponent(
        socialMedia.facebook.replace('@', '')
      )}`;
    if (socialMedia.instagram)
      socialMediaUrls.instagram = `https://instagram.com/${encodeURIComponent(socialMedia.instagram.replace('@', ''))}`;
    if (socialMedia.twitter)
      socialMediaUrls.twitter = `https://twitter.com/${encodeURIComponent(socialMedia.twitter.replace('@', ''))}`;
    if (socialMedia.tiktok)
      socialMediaUrls.tiktok = `https://www.tiktok.com/@${encodeURIComponent(socialMedia.tiktok.replace('@', ''))}`;
    if (socialMedia.youtube)
      socialMediaUrls.youtube = `https://youtube.com/${encodeURIComponent(socialMedia.youtube)}`;
    if (socialMedia.linkedin)
      socialMediaUrls.linkedin = `https://linkedin.com/company/${encodeURIComponent(socialMedia.linkedin)}`;
  }

  // LocalBusiness schema (without Google reviews - they'll be added client-side if needed)
  const businessData: LocalBusinessData = {
    name: merchant.business_name,
    description,
    url: baseUrl,
    logo: merchant.logo_url || undefined,
    telephone: merchant.phone || undefined,
    address: merchant.business_address
      ? {
          street: merchant.business_address,
          country: merchant.country || 'NG',
        }
      : undefined,
    socialMedia:
      Object.keys(socialMediaUrls).length > 0 ? socialMediaUrls : undefined,
  };
  const organizationData: OrganizationData = {
    name: merchant.business_name,
    description,
    url: baseUrl,
    logo: merchant.logo_url || undefined,
    email: merchant.email || undefined,
    telephone: merchant.phone || undefined,
    socialMedia:
      Object.keys(socialMediaUrls).length > 0 ? socialMediaUrls : undefined,
  };

  const organizationSchema = generateOrganizationSchema(organizationData);
  const localBusinessSchema = merchant.business_address
    ? generateLocalBusinessSchema(businessData)
    : null;
  const searchUrlTemplate = `${baseUrl}/search?q={search_term_string}`;
  const webSiteSchema = generateWebSiteSchema(
    merchant.business_name,
    baseUrl,
    searchUrlTemplate
  );

  return (
    <>
      {/* JSON-LD @graph: merchant LocalBusiness + WebSite in one script tag */}
      {(localBusinessSchema || webSiteSchema) && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema from sanitized merchant data
          dangerouslySetInnerHTML={{
            __html: safeJsonLdStringify({
              '@context': 'https://schema.org',
              '@graph': [organizationSchema, localBusinessSchema, webSiteSchema]
                .filter(Boolean)
                .map((s) => {
                  const { '@context': _, ...rest } = s as Record<
                    string,
                    unknown
                  >;
                  return rest;
                }),
            }),
          }}
        />
      )}

      {/* STREAMING: Heavy data fetching happens here, wrapped in Suspense */}
      <Suspense fallback={<StorefrontPageSkeleton />}>
        <StorefrontContent merchant={merchant} />
      </Suspense>
    </>
  );
}

export default function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<StorefrontPageSkeleton />}>
      <StorefrontPageContent params={params} />
    </Suspense>
  );
}
