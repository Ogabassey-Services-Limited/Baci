import { buildLaunchSlides } from '@/components/storefront/ogabassey/components/build-launch-slides';
import { Hero } from '@/components/storefront/ogabassey/components/Hero';
import { loadOgabasseyLaunchProducts } from './ogabassey-home-launch-products';

interface OgabasseyHomeHeroSectionProps {
  merchantId: string;
  pathPrefix: string;
}

export async function OgabasseyHomeHeroSection({
  merchantId,
  pathPrefix,
}: OgabasseyHomeHeroSectionProps) {
  const launchProducts = await loadOgabasseyLaunchProducts(merchantId);
  const launchSlides = buildLaunchSlides(launchProducts, pathPrefix);

  return <Hero slides={launchSlides} />;
}
