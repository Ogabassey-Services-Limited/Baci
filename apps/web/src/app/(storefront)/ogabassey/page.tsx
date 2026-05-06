import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OgabasseyHeroPreloads } from '@/components/storefront/ogabassey/components/ogabassey-hero-preloads';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';
import { OgabasseyHomePageContent } from './ogabassey-home-page-content';

const OGABASSEY_URL = 'https://ogabassey.com';
const OGABASSEY_TITLE = 'OgaBassey - Official Online Store';
const OGABASSEY_DESCRIPTION =
  'Shop OgaBassey for phones, laptops, gaming consoles, accessories, subscriptions, airtime, data, and flexible payment options in Nigeria.';
const OGABASSEY_SOCIAL_IMAGE_URL = `${OGABASSEY_URL}/template-previews/ogabassey-v2.png`;
const OGABASSEY_FAVICON_URL =
  'https://aivqthbxdshhltbwipbr.supabase.co/storage/v1/object/public/media/merchants/6b5cb8a4-5575-456c-b936-8cdfae30db74/favicon/favicon-32.png';
const OGABASSEY_APPLE_TOUCH_ICON_URL =
  'https://aivqthbxdshhltbwipbr.supabase.co/storage/v1/object/public/media/merchants/6b5cb8a4-5575-456c-b936-8cdfae30db74/favicon/apple-touch-icon.png';

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
    site: '@ogabasseyy',
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
