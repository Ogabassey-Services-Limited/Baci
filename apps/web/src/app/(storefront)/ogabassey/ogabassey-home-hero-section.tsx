import { buildLaunchSlides } from '@/components/storefront/ogabassey/components/build-launch-slides';
import { Hero } from '@/components/storefront/ogabassey/components/Hero';
import type { CurrencyConfig } from '@/lib/currency';
import { loadOgabasseyLaunchProducts } from './ogabassey-home-launch-products';

interface OgabasseyHomeHeroSectionProps {
  merchantId: string;
  pathPrefix: string;
  /** Resolved merchant display currency for the streamed hero price labels. */
  currency?: CurrencyConfig;
}

/**
 * Product-driven hero for the published, request-resolved storefront boundary.
 * Keep this component uncached: `loadOgabasseyLaunchProducts()` intentionally
 * degrades transient feed failures to `[]`, and caching this wrapper would make
 * that temporary empty hero sticky. The underlying product loaders own their
 * data caches and tags.
 */
export async function OgabasseyHomeHeroSection({
  merchantId,
  pathPrefix,
  currency,
}: OgabasseyHomeHeroSectionProps) {
  const launchProducts = await loadOgabasseyLaunchProducts(
    merchantId,
    currency
  );
  const launchSlides = buildLaunchSlides(launchProducts, pathPrefix);

  return <Hero slides={launchSlides} />;
}
