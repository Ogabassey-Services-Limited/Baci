import { Suspense } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import {
  OGABASSEY_DESCRIPTION,
  OGABASSEY_HOME_URL,
  OGABASSEY_SOCIAL_IMAGE_URL,
  OGABASSEY_TITLE,
} from '@/config/ogabassey';
import { preloadOgabasseyHomeHeroResources } from './ogabassey-home-hero-resource-hints';
import { resolveOgabasseyHomeHeroShell } from './ogabassey-home-hero-shell-data';
import { OgabasseyHomePageContent } from './ogabassey-home-page-content';
import { OgabasseyHomeStyleLoader } from './ogabassey-home-style-loader';
import { OgabasseyPublicationSafeHeroFallback } from './ogabassey-publication-safe-hero-fallback';

interface OgabasseyStaticHomePageContentProps {
  /** Static per-route prefix for request-streamed storefront links: '' for the
   *  apex domain and '/ogabassey' for the path route. */
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

export async function OgabasseyStaticHomePageContent({
  pathPrefix,
}: OgabasseyStaticHomePageContentProps) {
  // Cached-only lookup (never request APIs — those stay in the dynamic
  // subtree). Slides are inert data here: only the request-scoped subtree may
  // turn them into shopping UI after it confirms the current publication
  // state. The slide-0 preload intentionally stays early for LCP discovery, and
  // the fallback below paints that same image (image only) so LCP lands at FCP.
  // In the narrow stale-shell window it can disclose/fetch the formerly public
  // image URL, but it cannot render product copy or expose PDP navigation; the
  // shopping surface is tenant- and publication-gated below.
  const heroShell = await resolveOgabasseyHomeHeroShell();
  const shellSlides =
    heroShell?.status === 'published' ? heroShell.slides : null;
  const shellMerchantId =
    heroShell?.status === 'published' ? heroShell.merchantId : null;
  if (shellSlides?.[0]) {
    preloadOgabasseyHomeHeroResources(shellSlides[0].imageUrl);
  }

  return (
    <>
      <JsonLd data={ogabasseyStaticHomepageSchema} />
      <OgabasseyHomeStyleLoader />
      {/* The fallback paints slide-0's decorative hero image (image only) to
          reserve the critical viewport and land LCP at FCP, while emitting no
          product copy, prices, links or controls. The sole shopping Hero is
          rendered only after the request-scoped publication guard succeeds. */}
      <Suspense
        fallback={
          shellSlides ? (
            <OgabasseyPublicationSafeHeroFallback
              hasCarouselControls={shellSlides.length > 1}
              heroImageUrl={shellSlides[0]?.imageUrl ?? null}
            />
          ) : null
        }
      >
        <OgabasseyHomePageContent
          pathPrefix={pathPrefix}
          shellMerchantId={shellMerchantId}
          shellSlides={shellSlides}
        />
      </Suspense>
    </>
  );
}
