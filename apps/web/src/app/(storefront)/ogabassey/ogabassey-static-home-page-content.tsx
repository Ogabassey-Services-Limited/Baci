import { Suspense } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import {
  OGABASSEY_DESCRIPTION,
  OGABASSEY_MERCHANT_ID,
  OGABASSEY_SOCIAL_IMAGE_URL,
  OGABASSEY_TITLE,
  OGABASSEY_URL,
} from '@/config/ogabassey';
import { OgabasseyHomeHeroSection } from './ogabassey-home-hero-section';
import { OgabasseyHomePageContent } from './ogabassey-home-page-content';
import { OgabasseyHomeStyleLoader } from './ogabassey-home-style-loader';

interface OgabasseyStaticHomePageContentProps {
  /** Static per-route path prefix for storefront links: '' for the apex domain
   *  (ogabassey.com), '/ogabassey' for the path-based route. Passed as a
   *  constant from each route's page so the hero needs no per-request headers. */
  pathPrefix: string;
}

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
  pathPrefix,
}: OgabasseyStaticHomePageContentProps) {
  return (
    <>
      <JsonLd data={ogabasseyStaticHomepageSchema} />
      <OgabasseyHomeStyleLoader />
      {/* Hero renders in the PPR static shell from cached data + the known
          OgaBassey merchant id + a static pathPrefix, so the real product hero
          is in the first byte (edge-served) — no Suspense placeholder, no swap. */}
      <OgabasseyHomeHeroSection
        merchantId={OGABASSEY_MERCHANT_ID}
        pathPrefix={pathPrefix}
      />
      {/* Below-the-fold commerce content (product grid, analytics, full JSON-LD)
          needs the request-scoped merchant, so it streams as the dynamic hole. */}
      <Suspense>
        <OgabasseyHomePageContent pathPrefix={pathPrefix} />
      </Suspense>
    </>
  );
}
