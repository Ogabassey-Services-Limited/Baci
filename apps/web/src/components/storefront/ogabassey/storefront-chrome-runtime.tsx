import type { MerchantData } from '@/hooks/merchant/types';
import {
  OgabasseyLayoutChrome,
  type OgabasseyLayoutChromeSection,
} from './storefront-layout-chrome';

interface StorefrontChromeRuntimeProps {
  section: OgabasseyLayoutChromeSection;
  merchant?: MerchantData;
  basePath: string;
  /**
   * Escape hatch: forces the nav chrome hidden regardless of route.
   * When `false`/omitted, the client-side `OgabasseyLayoutChrome`
   * derives hide-state from `usePathname()` so it stays reactive
   * across client-side route changes (the `[slug]` shell is
   * persistent, so server-computed pathname state would go stale
   * after in-app navigation).
   */
  hideNavigation?: boolean;
}

export function StorefrontChromeRuntime({
  section,
  merchant,
  basePath,
  hideNavigation = false,
}: StorefrontChromeRuntimeProps) {
  return (
    <OgabasseyLayoutChrome
      basePath={basePath}
      hideNavigation={hideNavigation}
      merchant={merchant}
      section={section}
    />
  );
}
