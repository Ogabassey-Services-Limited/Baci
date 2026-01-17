import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { V2ThemeMode } from '@/components/storefront/ogabassey/providers/v2-theme-context';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import {
  generateLocalBusinessSchema,
  generateServiceSchema,
  generateWebSiteSchema,
  type LocalBusinessData,
} from '@/lib/seo-utils';
import {
  isDomainIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';
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

  // Use appropriate lookup method based on identifier type - normalize to lowercase
  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug.toLowerCase())
    : await getCachedMerchant(slug.toLowerCase());

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
  const host = headersList.get('host') || `${slug}.localhost: 3000`;
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

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
export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Validate identifier format (can be slug or domain)
  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }

  // CRITICAL: Merchant lookup - required for page shell
  const lookupKey = slug.toLowerCase();
  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(lookupKey)
    : await getCachedMerchant(lookupKey);

  if (!merchant) {
    notFound();
  }

  // Check if store is published
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!merchant.is_published && !isDevelopment) {
    return <StoreNotPublished businessName={merchant.business_name} />;
  }

  // Theme cookie for SSR consistency
  // IMPORTANT: Cookie name must match V2ThemeProvider's THEME_COOKIE_NAME
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('storefront-theme-v2')?.value;

  // Server-side date check - force standard theme outside December
  const currentMonth = new Date().getMonth();
  const isDecember = currentMonth === 11;

  let initialTheme: V2ThemeMode;
  if (themeCookie === 'santa' && !isDecember) {
    // Force standard theme outside December
    initialTheme = 'standard';
  } else if (themeCookie === 'standard' || themeCookie === 'santa') {
    initialTheme = themeCookie as V2ThemeMode;
  } else {
    // Default based on month for SSR consistency
    initialTheme = isDecember ? 'santa' : 'standard';
  }

  // Generate schemas (fast, uses cached merchant data)
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
    socialMedia:
      Object.keys(socialMediaUrls).length > 0 ? socialMediaUrls : undefined,
  };

  const localBusinessSchema = generateLocalBusinessSchema(businessData);
  const webSiteSchema = generateWebSiteSchema(
    merchant.business_name,
    baseUrl,
    `${baseUrl}/products?q={search_term_string}`
  );

  return (
    <>
      {/* JSON-LD Schemas - Generated synchronously from cached merchant data */}
      {localBusinessSchema && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema from sanitized merchant data
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusinessSchema),
          }}
        />
      )}
      {webSiteSchema && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema from sanitized merchant data
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
        />
      )}

      {/* Service Schemas */}
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
              offers: [
                { price: '100', priceCurrency: 'NGN' },
                { price: '1000', priceCurrency: 'NGN' },
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
              name: 'Cheap Data Bundles',
              description:
                'Buy affordable data bundles for all networks (MTN, Airtel, Glo, 9mobile). Instant activation.',
              providerName: merchant.business_name,
              providerUrl: baseUrl,
              serviceType: 'Internet Data Services',
              logo: merchant.logo_url || undefined,
              offers: [
                { price: '500', priceCurrency: 'NGN' },
                { price: '5000', priceCurrency: 'NGN' },
              ],
            })
          ),
        }}
      />

      {/* STREAMING: Heavy data fetching happens here, wrapped in Suspense */}
      <Suspense fallback={<StorefrontPageSkeleton />}>
        <StorefrontContent merchant={merchant} initialTheme={initialTheme} />
      </Suspense>
    </>
  );
}
