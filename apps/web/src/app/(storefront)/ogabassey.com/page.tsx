import type { Metadata } from 'next';
import { OgabasseyStaticHomePageContent } from '@/app/(storefront)/ogabassey/ogabassey-static-home-page-content';
import { metadata as ogabasseyMetadata } from '@/app/(storefront)/ogabassey/page';

export const metadata: Metadata = ogabasseyMetadata;

export default function OgabasseyDomainHomePage() {
  return <OgabasseyStaticHomePageContent />;
}
