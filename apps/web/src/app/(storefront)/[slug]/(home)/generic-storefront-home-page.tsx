import '@/app/(storefront)/storefront-full.css';
import { StorefrontPageContent } from '../storefront-page-content';

export function GenericStorefrontHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <StorefrontPageContent params={params} />;
}
