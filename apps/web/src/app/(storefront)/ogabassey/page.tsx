import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OgabasseyHeroPreloads } from '@/components/storefront/ogabassey/components/ogabassey-hero-preloads';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';
import {
  OGABASSEY_APPLE_TOUCH_ICON_URL,
  OGABASSEY_DESCRIPTION,
  OGABASSEY_FAVICON_URL,
  OGABASSEY_SOCIAL_IMAGE_URL,
  OGABASSEY_TITLE,
  OGABASSEY_TWITTER_HANDLE,
  OGABASSEY_URL,
} from '@/config/ogabassey';
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
