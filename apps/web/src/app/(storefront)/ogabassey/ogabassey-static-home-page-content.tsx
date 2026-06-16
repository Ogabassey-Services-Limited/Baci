import { Suspense } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import { Hero } from '@/components/storefront/ogabassey/components/Hero';
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

export function OgabasseyStaticHomePageContent({
  heroBasePath,
}: {
  heroBasePath: string;
}) {
  return (
    <>
      <JsonLd data={ogabasseyStaticHomepageSchema} />
      {/* The storefront layout blocks unpublished merchants before rendering children; keep Hero in this page shell so mobile LCP is not delayed by dynamic home data. */}
      <Hero basePath={heroBasePath} />
      <OgabasseyHomeStyleLoader />
      <Suspense fallback={null}>
        <OgabasseyHomePageContent renderHero={false} />
      </Suspense>
    </>
  );
}
