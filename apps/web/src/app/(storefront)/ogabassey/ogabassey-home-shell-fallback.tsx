import { ShellChromeLoading } from '@/app/(storefront)/[slug]/storefront-loading-ui';
import { getOgabasseyLayoutStyle } from '@/components/storefront/ogabassey/storefront-layout-utils';
import { OgabasseyHomeHeroFallback } from './ogabassey-home-hero-fallback';

const ogabasseyStaticShellStyle = getOgabasseyLayoutStyle();

export function OgabasseyHomeShellFallback() {
  return (
    <div
      data-ogabassey-static-shell-fallback="true"
      style={ogabasseyStaticShellStyle}
    >
      <ShellChromeLoading showChromeFrame />
      <OgabasseyHomeHeroFallback />
    </div>
  );
}
