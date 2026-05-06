import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OgabasseyHeroPreloads } from '@/components/storefront/ogabassey/components/ogabassey-hero-preloads';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';
import { OgabasseyHomePageContent } from './ogabassey-home-page-content';

const OGABASSEY_URL = 'https://ogabassey.com';
const OGABASSEY_TITLE = 'OgaBassey - Official Online Store';
const OGABASSEY_DESCRIPTION =
  'Shop OgaBassey for phones, laptops, gaming consoles, accessories, subscriptions, airtime, data, and flexible payment options in Nigeria.';

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
  },
  twitter: {
    card: 'summary_large_image',
    title: OGABASSEY_TITLE,
    description: OGABASSEY_DESCRIPTION,
    site: '@ogabasseyy',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
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
