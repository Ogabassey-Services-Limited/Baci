import { Suspense } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import {
  OGABASSEY_DESCRIPTION,
  OGABASSEY_HOME_URL,
  OGABASSEY_SOCIAL_IMAGE_URL,
  OGABASSEY_TITLE,
} from '@/config/ogabassey';
import { OgabasseyHomeHeroFallback } from './ogabassey-home-hero-fallback';
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
  url: OGABASSEY_HOME_URL,
  isPartOf: {
    '@type': 'WebSite',
    name: 'OgaBassey',
    url: OGABASSEY_HOME_URL,
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
      {/* The static PPR shell first-flushes a hero-shaped fallback with the same
          critical CSS tokens and geometry as the final product hero. The real,
          uncached product hero then streams after request headers resolve
          path-mode vs subdomain links. */}
      <Suspense fallback={<OgabasseyHomeHeroFallback />}>
        <OgabasseyHomePageContent pathPrefix={pathPrefix} />
      </Suspense>
    </>
  );
}
