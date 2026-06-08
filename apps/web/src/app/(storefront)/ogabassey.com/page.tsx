import '@/app/(storefront)/storefront-full.css';

import { OgabasseyStaticHomePageContent } from '@/app/(storefront)/ogabassey/ogabassey-static-home-page-content';
import { metadata } from '@/app/(storefront)/ogabassey/page';

export { metadata };

export default function OgabasseyDomainHomePage() {
  return <OgabasseyStaticHomePageContent heroBasePath="" />;
}
