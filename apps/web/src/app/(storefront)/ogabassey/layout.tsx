import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import StorefrontLayout, {
  generateViewport,
} from '@/app/(storefront)/[slug]/layout';
import { StorefrontLayoutLoadingFallback } from '@/app/(storefront)/[slug]/storefront-layout-loading-fallback';
import {
  HERO_MOBILE_LCP_FALLBACK_SRC,
  HERO_MOBILE_LCP_SRC,
} from '@/components/storefront/ogabassey/components/hero-data';
import {
  OGABASSEY_APPLE_TOUCH_ICON_URL,
  OGABASSEY_DESCRIPTION,
  OGABASSEY_FAVICON_URL,
  OGABASSEY_SOCIAL_IMAGE_URL,
  OGABASSEY_TITLE,
  OGABASSEY_TWITTER_HANDLE,
  OGABASSEY_URL,
} from '@/config/ogabassey';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';

const OGABASSEY_PARAMS = Promise.resolve({ slug: OGABASSEY_TEMPLATE_ID });

export { generateViewport };

export const metadata: Metadata = {
  metadataBase: new URL(OGABASSEY_URL),
  title: OGABASSEY_TITLE,
  description: OGABASSEY_DESCRIPTION,
  icons: {
    icon: OGABASSEY_FAVICON_URL,
    shortcut: OGABASSEY_FAVICON_URL,
    apple: OGABASSEY_APPLE_TOUCH_ICON_URL,
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
  manifest: null,
};

export default function OgabasseyLayout({ children }: { children: ReactNode }) {
  return (
    <StorefrontLayout
      loadingFallback={
        <StorefrontLayoutLoadingFallback
          mobileHeroImage={{
            alt: 'OgaBassey storefront hero',
            avifSrc: HERO_MOBILE_LCP_SRC,
            fallbackSrc: HERO_MOBILE_LCP_FALLBACK_SRC,
          }}
        />
      }
      params={OGABASSEY_PARAMS}
    >
      {children}
    </StorefrontLayout>
  );
}
