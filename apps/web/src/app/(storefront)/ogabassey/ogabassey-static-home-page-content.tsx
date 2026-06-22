import { Suspense } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import {
  OGABASSEY_DESCRIPTION,
  OGABASSEY_SOCIAL_IMAGE_URL,
  OGABASSEY_TITLE,
  OGABASSEY_URL,
} from '@/config/ogabassey';
import { OgabasseyHomePageContent } from './ogabassey-home-page-content';
import { OgabasseyHomeStyleLoader } from './ogabassey-home-style-loader';

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

export function OgabasseyStaticHomePageContent() {
  return (
    <>
      <JsonLd data={ogabasseyStaticHomepageSchema} />
      <OgabasseyHomeStyleLoader />
      {/* The hero is now product-driven and renders inside the dynamic home
          content (where launch products are available). The layout's static
          loading shell paints the baked mobile hero banner so mobile LCP is
          still served from the first flush while this streams in. */}
      <Suspense fallback={null}>
        <OgabasseyHomePageContent />
      </Suspense>
    </>
  );
}
