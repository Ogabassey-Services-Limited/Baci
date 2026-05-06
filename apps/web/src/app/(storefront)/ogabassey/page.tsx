import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { OgabasseyHeroPreloads } from '@/components/storefront/ogabassey/components/ogabassey-hero-preloads';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { generateMetaDescription } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { OgabasseyHomePageContent } from './ogabassey-home-page-content';

const OGABASSEY_URL = 'https://ogabassey.com';
const OGABASSEY_TITLE = 'OgaBassey - Official Online Store';
const OGABASSEY_DESCRIPTION =
  'Shop OgaBassey for phones, laptops, gaming consoles, accessories, subscriptions, airtime, data, and flexible payment options in Nigeria.';

function buildStorefrontLanguageAlternates(
  baseUrl: string,
  country: string | null | undefined
): Record<string, string> {
  const languages: Record<string, string> = {
    'x-default': baseUrl,
  };

  if (country?.trim().toUpperCase() === 'NG') {
    languages['en-NG'] = baseUrl;
  }

  return languages;
}

export async function generateMetadata(): Promise<Metadata> {
  await connection();

  const merchant = await getRequestScopedMerchant(OGABASSEY_TEMPLATE_ID);
  const title = merchant?.site_title || OGABASSEY_TITLE;
  const description = generateMetaDescription(
    merchant?.site_description || merchant?.site_tagline || '',
    160,
    {
      minLength: 110,
      fallback: OGABASSEY_DESCRIPTION,
    }
  );
  const baseUrl = merchant ? buildStoreUrl(merchant) : OGABASSEY_URL;
  const socialMedia = merchant?.social_media as Record<string, string> | null;

  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    keywords: [
      'Showmax Subscription',
      'Buy Showmax Online',
      'Cheap Airtime',
      'Buy Data Bundle',
      'Pay Electricity Bill',
      'Utility Payment',
      merchant?.business_name || 'OgaBassey',
      'Online Shopping',
      'Nigeria',
    ],
    alternates: {
      canonical: baseUrl,
      languages: buildStorefrontLanguageAlternates(baseUrl, merchant?.country),
    },
    openGraph: {
      title,
      description,
      url: baseUrl,
      type: 'website',
      siteName: merchant?.business_name || 'OgaBassey',
      ...(merchant?.logo_url && {
        images: [
          { url: merchant.logo_url, alt: `${merchant.business_name} logo` },
        ],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(merchant?.logo_url && { images: [merchant.logo_url] }),
      ...(socialMedia?.twitter && {
        site: socialMedia.twitter.startsWith('@')
          ? socialMedia.twitter
          : `@${socialMedia.twitter}`,
      }),
    },
    icons: {
      icon:
        merchant?.favicon_svg_url ||
        merchant?.favicon_png_32_url ||
        '/favicon.ico',
      shortcut: merchant?.favicon_png_32_url || '/favicon.ico',
      apple: merchant?.favicon_apple_touch_url || '/favicon.ico',
    },
  };
}

export default function OgabasseyStaticHomePage() {
  return (
    <>
      <OgabasseyHeroPreloads />
      <Suspense fallback={<StorefrontPageSkeleton />}>
        <OgabasseyHomePageContent />
      </Suspense>
    </>
  );
}
