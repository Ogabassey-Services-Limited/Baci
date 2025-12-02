import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';
import { MerchantProvider } from '@/hooks/use-merchant';
import { getCachedMerchant } from '@/lib/cached-data';
import {
  generateLocalBusinessSchema,
  generateWebSiteSchema,
  type LocalBusinessData,
} from '@/lib/seo-utils';
import { StorefrontWrapper } from './storefront-wrapper';

// Valid slug pattern: alphanumeric and hyphens, no file extensions
const VALID_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

function isValidMerchantSlug(slug: string): boolean {
  return (
    typeof slug === 'string' &&
    !!slug.trim() &&
    !slug.includes('.') && // No file extensions
    VALID_SLUG_REGEX.test(slug.toLowerCase())
  );
}

// Enable ISR with 1 minute revalidation for storefront homepages
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  // Skip database query for invalid slugs (like static asset requests)
  if (!isValidMerchantSlug(slug)) {
    return {
      title: 'Not Found',
      description: 'The page you are looking for does not exist.',
    };
  }

  // Use cached merchant data for better performance
  const merchant = await getCachedMerchant(slug);

  if (!merchant) {
    return {
      title: 'Store Not Found',
      description: 'The store you are looking for does not exist.',
    };
  }

  const title = merchant.site_title || merchant.business_name;
  const description =
    merchant.site_description ||
    merchant.site_tagline ||
    `Welcome to ${merchant.business_name}`;

  const headersList = await headers();
  const host = headersList.get('host') || `${slug}.localhost:3000`;
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const socialMedia = merchant.social_media as Record<string, string> | null;

  return {
    title: title,
    description: description,
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

  // Validate slug format to prevent database queries for static assets
  if (!isValidMerchantSlug(slug)) {
    notFound();
  }

  // Use cached merchant data for better performance
  const merchant = await getCachedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  let localBusinessSchema = null;
  let webSiteSchema = null;
  // ... rest of the component

  if (merchant) {
    const headersList = await headers();
    const host = headersList.get('host') || `${slug}.localhost:3000`;
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
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
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusinessSchema),
          }}
        />
      )}
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml */}
      {webSiteSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
        />
      )}
      <MerchantProvider slug={slug}>
        <Suspense fallback={<StorefrontPageSkeleton />}>
          <StorefrontWrapper />
        </Suspense>
      </MerchantProvider>
    </>
  );
}
