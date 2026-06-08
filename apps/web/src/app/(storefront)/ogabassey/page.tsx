import type { Metadata } from 'next';
import '@/app/(storefront)/storefront-full.css';
import { Suspense } from 'react';
import { OgabasseyStaticResourceHints } from '@/app/(storefront)/ogabassey/ogabassey-static-resource-hints';
import { Hero } from '@/components/storefront/ogabassey/components/Hero';
import {
  OGABASSEY_APPLE_TOUCH_ICON_URL,
  OGABASSEY_DESCRIPTION,
  OGABASSEY_FAVICON_URL,
  OGABASSEY_SOCIAL_IMAGE_URL,
  OGABASSEY_TITLE,
  OGABASSEY_TWITTER_HANDLE,
  OGABASSEY_URL,
} from '@/config/ogabassey';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { OgabasseyHomePageContent } from './ogabassey-home-page-content';

export const metadata: Metadata = {
  metadataBase: new URL(OGABASSEY_URL),
  title: OGABASSEY_TITLE,
  description: OGABASSEY_DESCRIPTION,
  keywords: [
    'Showmax Subscription',
    'Buy Showmax Online',
    'Cheap Airtime',
    'Buy Data Bundle',
    'Pay Electricity Bill',
    'Utility Payment',
    'OgaBassey',
    'Online Shopping',
    'Nigeria',
  ],
  alternates: {
    canonical: OGABASSEY_URL,
    languages: {
      'en-NG': OGABASSEY_URL,
      'x-default': OGABASSEY_URL,
    },
  },
  openGraph: {
    title: OGABASSEY_TITLE,
    description: OGABASSEY_DESCRIPTION,
    url: OGABASSEY_URL,
    type: 'website',
    siteName: 'OgaBassey',
    images: [
      {
        url: OGABASSEY_SOCIAL_IMAGE_URL,
        width: 1440,
        height: 900,
        alt: 'OgaBassey storefront preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: OGABASSEY_TITLE,
    description: OGABASSEY_DESCRIPTION,
    images: [OGABASSEY_SOCIAL_IMAGE_URL],
    site: OGABASSEY_TWITTER_HANDLE,
  },
  icons: {
    icon: OGABASSEY_FAVICON_URL,
    shortcut: OGABASSEY_FAVICON_URL,
    apple: OGABASSEY_APPLE_TOUCH_ICON_URL,
  },
};

const ogabasseyStaticHomepageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: OGABASSEY_TITLE,
  description: OGABASSEY_DESCRIPTION,
  url: OGABASSEY_URL,
  isPartOf: {
    '@type': 'WebSite',
    name: 'OgaBassey',
    url: OGABASSEY_URL,
  },
  primaryImageOfPage: {
    '@type': 'ImageObject',
    url: OGABASSEY_SOCIAL_IMAGE_URL,
  },
} as const;

export function OgabasseyStaticHomePageContent({
  heroBasePath,
}: {
  heroBasePath: string;
}) {
  return (
    <>
      <OgabasseyStaticResourceHints />
      <script type="application/ld+json">
        {safeJsonLdStringify(ogabasseyStaticHomepageSchema)}
      </script>
      {/* The storefront layout blocks unpublished merchants before rendering children; keep Hero in this page shell so mobile LCP is not delayed by dynamic home data. */}
      <Hero basePath={heroBasePath} />
      <Suspense fallback={null}>
        <OgabasseyHomePageContent renderHero={false} />
      </Suspense>
    </>
  );
}

export default function OgabasseyStaticHomePage() {
  return <OgabasseyStaticHomePageContent heroBasePath="/ogabassey" />;
}
