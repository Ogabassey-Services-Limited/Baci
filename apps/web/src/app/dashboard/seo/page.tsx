import { redirect } from 'next/navigation';
import { ensurePermission } from '@/lib/merchant-server';
import { getSEOStatus } from './actions';
import { getStorefrontSearchReadiness } from './get-storefront-search-readiness';
import SEOClient from './seo-client';
import { StorefrontSearchReadinessCard } from './storefront-search-readiness-card';

export const metadata = {
  title: 'SEO Optimizer | Dashboard',
  description: 'AI-powered SEO optimization for your products',
};

export default async function SEOOptimizerPage() {
  let merchantId: string | null = null;
  try {
    const { merchant } = await ensurePermission('marketing', 'view');
    merchantId = merchant.id;
  } catch {
    redirect('/dashboard');
  }

  if (!merchantId) {
    redirect('/dashboard');
  }

  // Fetch initial data with error handling
  let products: Awaited<ReturnType<typeof getSEOStatus>>['products'] = [];
  let summary: Awaited<ReturnType<typeof getSEOStatus>>['summary'] = null;
  let storefrontSearchReadiness: Awaited<
    ReturnType<typeof getStorefrontSearchReadiness>
  > | null = null;

  try {
    const result = await getSEOStatus(merchantId);
    products = result.products;
    summary = result.summary;
  } catch (error) {
    console.error('Failed to fetch SEO status:', error);
    // Products and summary remain at default values
  }

  try {
    storefrontSearchReadiness = await getStorefrontSearchReadiness(merchantId);
  } catch (error) {
    console.error('Failed to load storefront search readiness:', error);
  }

  return (
    <>
      {storefrontSearchReadiness ? (
        <StorefrontSearchReadinessCard assessment={storefrontSearchReadiness} />
      ) : null}
      <SEOClient
        initialProducts={products}
        initialSummary={summary}
        merchantId={merchantId}
      />
    </>
  );
}
