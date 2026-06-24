import { ShellChromeLoading } from '@/app/(storefront)/[slug]/storefront-loading-ui';
import { OGABASSEY_MERCHANT_ID } from '@/config/ogabassey';
import { OgabasseyHomeHeroSection } from './ogabassey-home-hero-section';

interface OgabasseyHomeShellFallbackProps {
  /** Root-relative by default so subdomain rewrites never leak /ogabassey into visible hrefs. */
  pathPrefix?: string;
}

export function OgabasseyHomeShellFallback({
  pathPrefix = '',
}: OgabasseyHomeShellFallbackProps) {
  return (
    <>
      <ShellChromeLoading showChromeFrame />
      <OgabasseyHomeHeroSection
        merchantId={OGABASSEY_MERCHANT_ID}
        pathPrefix={pathPrefix}
      />
    </>
  );
}
