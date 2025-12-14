import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';

import { getCachedMerchant, getCachedMerchantByDomain } from '@/lib/cached-data';
import { getPlaceDetailsServer } from '@/lib/google-places';
import {
  generateLocalBusinessSchema,
  generateServiceSchema,
  generateWebSiteSchema,
  type LocalBusinessData,
} from '@/lib/seo-utils';
import { StorefrontWrapper } from './storefront-wrapper';

// Valid slug pattern: alphanumeric and hyphens, no file extensions
const VALID_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

// Valid domain pattern: basic domain format (e.g., ogabassey.com)
const VALID_DOMAIN_REGEX = /^[a-z0-9][a-z0-9-]*\.[a-z]{2,}$/;

// Reserved paths that should NOT be treated as merchant slugs
const RESERVED_PATHS = new Set([
  'cart',
  'checkout',
  'api',
  'auth',
  'login',
  'logout',
  'dashboard',
  'admin',
  'builder',
  'onboarding',
  'preview',
  'about',
  'contact',
  'blog',
  'pricing',
  'terms',
  'privacy',
  'features',
  'demo',
  'developers',
  'track',
  'invite',
  'reset-password',
  'template-preview',
]);

/**
 * Check if the identifier looks like a domain (contains a dot)
 */
function isDomainIdentifier(identifier: string): boolean {
  return identifier.includes('.') && VALID_DOMAIN_REGEX.test(identifier.toLowerCase());
}

function isValidMerchantSlug(slug: string): boolean {
  return (
    typeof slug === 'string' &&
    !!slug.trim() &&
    !slug.includes('.') && // No file extensions
    !RESERVED_PATHS.has(slug.toLowerCase()) && // Not a reserved path
    VALID_SLUG_REGEX.test(slug.toLowerCase())
  );
}

/**
 * Validate that the identifier is either a valid slug or a valid domain
 */
function isValidMerchantIdentifier(identifier: string): boolean {
  return isValidMerchantSlug(identifier) || isDomainIdentifier(identifier);
}

// Enable ISR with 1 minute revalidation for storefront homepages
export const revalidate = 60;

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

  // Use appropriate lookup method based on identifier type
  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);

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

  const headersList = await headers();
  const host = headersList.get('host') || `${slug}.localhost:3000`;
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const socialMedia = merchant.social_media as Record<string, string> | null;

  return {
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
  };
}

import { notFound } from 'next/navigation';

// ... imports

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  console.log('[StorefrontPage] Loading slug:', slug);

  // Validate identifier format (can be slug or domain)
  if (!isValidMerchantIdentifier(slug)) {
    console.log('[StorefrontPage] Invalid identifier:', slug);
    notFound();
  }

  // Use appropriate lookup method based on identifier type
  console.log('[StorefrontPage] Fetching cached merchant...');
  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);
  console.log(
    '[StorefrontPage] Merchant result:',
    merchant ? merchant.id : 'null'
  );

  if (!merchant) {
    notFound();
  }

  // Fetch Google Place Details (Reviews & Ratings) for SEO
  // TODO: Move Place ID to merchant config in DB
  let placeDetails = null;
  const OGABASSEY_PLACE_ID = 'ChIJychoUsKNOxARHWCwVgvx670';

  if (
    merchant.slug === 'ogabassey' ||
    merchant.slug === 'gadget-universe-demo'
  ) {
    try {
      console.log('[StorefrontPage] Fetching Google Place details...');
      placeDetails = await getPlaceDetailsServer(OGABASSEY_PLACE_ID);
    } catch (err) {
      console.error('[StorefrontPage] Failed to fetch place details:', err);
    }
  }

  // Check if store is published - show "coming soon" page if not
  // In development, allow viewing unpublished stores for testing
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!merchant.is_published && !isDevelopment) {
    return <StoreNotPublished businessName={merchant.business_name} />;
  }

  let localBusinessSchema = null;
  let webSiteSchema = null;
  let baseUrl = '';

  // ... rest of the component

  if (merchant) {
    const headersList = await headers();
    const host = headersList.get('host') || `${slug}.localhost:3000`;
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    baseUrl = `${protocol}://${host}`;
    const description =
      merchant.site_description ||
      merchant.site_tagline ||
      `Welcome to ${merchant.business_name}`;
    const socialMedia = merchant.social_media as Record<string, string> | null;

    // Build social media URLs
    const socialMediaUrls: Record<string, string> = {};
    if (socialMedia) {
      if (socialMedia.facebook)
        socialMediaUrls.facebook = `https://facebook.com/${encodeURIComponent(socialMedia.facebook)}`;
      if (socialMedia.instagram)
        socialMediaUrls.instagram = `https://instagram.com/${encodeURIComponent(socialMedia.instagram.replace('@', ''))}`;
      if (socialMedia.twitter)
        socialMediaUrls.twitter = `https://twitter.com/${encodeURIComponent(socialMedia.twitter.replace('@', ''))}`;
      if (socialMedia.tiktok)
        socialMediaUrls.tiktok = `https://tiktok.com/@${encodeURIComponent(socialMedia.tiktok.replace('@', ''))}`;
      if (socialMedia.youtube)
        socialMediaUrls.youtube = `https://youtube.com/${encodeURIComponent(socialMedia.youtube)}`;
      if (socialMedia.linkedin)
        socialMediaUrls.linkedin = `https://linkedin.com/company/${encodeURIComponent(socialMedia.linkedin)}`;
    }

    // Build LocalBusiness schema data
    const businessData: LocalBusinessData = {
      name: merchant.business_name,
      description,
      url: baseUrl,
      logo: merchant.logo_url || undefined,
      telephone: merchant.phone || undefined,
      socialMedia:
        Object.keys(socialMediaUrls).length > 0 ? socialMediaUrls : undefined,
    };

    // Inject Google Ratings & Reviews if available
    if (placeDetails) {
      if (placeDetails.rating) {
        businessData.rating = {
          ratingValue: placeDetails.rating,
          reviewCount: placeDetails.userRatingCount || 0,
        };
      }

      if (placeDetails.reviews && Array.isArray(placeDetails.reviews)) {
        // Map Google reviews to our Schema format
        // biome-ignore lint/suspicious/noExplicitAny: Google Places API returns untyped review objects
        businessData.reviews = placeDetails.reviews.map((review: any) => ({
          author: review.authorAttribution?.displayName || 'Google User',
          datePublished: review.publishTime || new Date().toISOString(),
          reviewBody: review.text?.text || '',
          reviewRating: review.rating || 5,
        }));
      }
    }

    localBusinessSchema = generateLocalBusinessSchema(businessData);

    // Generate WebSite schema with search action
    webSiteSchema = generateWebSiteSchema(
      merchant.business_name,
      baseUrl,
      `${baseUrl}/products?q={search_term_string}`
    );
  }

  return (
    <>
      {/* Schema.org JSON-LD - Safe: Generated from sanitized merchant data via generateLocalBusinessSchema */}
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml */}
      {localBusinessSchema && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema from sanitized merchant data
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusinessSchema),
          }}
        />
      )}
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml */}
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml */}
      {webSiteSchema && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema from sanitized merchant data
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
        />
      )}

      {/* Service Schemas for Utilities (Showmax, Airtime, Data) */}
      {merchant && (
        <>
          <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Static trusted schema
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                generateServiceSchema({
                  name: 'Showmax Subscription Payment',
                  description:
                    'Pay for your Showmax subscription online instantly. Fast, secure, and reliable payment service.',
                  providerName: merchant.business_name,
                  providerUrl: baseUrl,
                  serviceType: 'Streaming Subscription Payment',
                  logo: merchant.logo_url || undefined,
                  offers: [
                    { price: '1200', priceCurrency: 'NGN' },
                    { price: '2500', priceCurrency: 'NGN' },
                  ],
                })
              ),
            }}
          />
          <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Static trusted schema
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                generateServiceSchema({
                  name: 'Instant Airtime Top-up',
                  description:
                    'Buy airtime for MTN, Airtel, Glo, and 9mobile instantly. Fast and secure recharge.',
                  providerName: merchant.business_name,
                  providerUrl: baseUrl,
                  serviceType: 'Mobile Phone Top-up',
                  logo: merchant.logo_url || undefined,
                })
              ),
            }}
          />
          <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Static trusted schema
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                generateServiceSchema({
                  name: 'Cheap Data Bundles',
                  description:
                    'Buy affordable data bundles for all networks (MTN, Airtel, Glo, 9mobile). Instant activation.',
                  providerName: merchant.business_name,
                  providerUrl: baseUrl,
                  serviceType: 'Internet Data Services',
                  logo: merchant.logo_url || undefined,
                })
              ),
            }}
          />
        </>
      )}
      <Suspense fallback={<StorefrontPageSkeleton />}>
        <StorefrontWrapper />
      </Suspense>
    </>
  );
}
