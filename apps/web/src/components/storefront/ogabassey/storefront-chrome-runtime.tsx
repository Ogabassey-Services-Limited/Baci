import { headers } from 'next/headers';
import type { MerchantData } from '@/hooks/use-merchant';
import {
  OgabasseyLayoutChrome,
  type OgabasseyLayoutChromeSection,
} from './storefront-layout-chrome';
import { shouldHideOgabasseyNavigation } from './storefront-layout-utils';

interface StorefrontChromeRuntimeProps {
  section: OgabasseyLayoutChromeSection;
  merchant?: MerchantData;
  basePath: string;
  hideNavigation?: boolean;
}

export async function StorefrontChromeRuntime({
  section,
  merchant,
  basePath,
  hideNavigation = false,
}: StorefrontChromeRuntimeProps) {
  const pathname = (await headers()).get('x-pathname');
  const resolvedHideNavigation = shouldHideOgabasseyNavigation(
    pathname,
    hideNavigation
  );

  return (
    <OgabasseyLayoutChrome
      basePath={basePath}
      hideNavigation={resolvedHideNavigation}
      merchant={merchant}
      section={section}
    />
  );
}
