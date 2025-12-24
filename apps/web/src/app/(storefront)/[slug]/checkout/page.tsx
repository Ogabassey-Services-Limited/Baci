import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StorefrontFooter as Footer } from '@/components/storefront/footer';
import { StorefrontHeader as Header } from '@/components/storefront/header';
import { NewTemplateCheckoutPage } from '@/components/storefront/new-template';
import { CheckoutPage as OgabasseyCheckoutPage } from '@/components/storefront/ogabassey/pages/checkout-page';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { isDomainIdentifier } from '@/lib/validation';

// Loading fallback for checkout page
function CheckoutLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Loading checkout...</p>
      </div>
    </div>
  );
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  // Check for new template
  if (
    (merchant as unknown as { template_id?: string }).template_id ===
    'new-template'
  ) {
    return (
      <Suspense fallback={<CheckoutLoading />}>
        <NewTemplateCheckoutPage />
      </Suspense>
    );
  }

  // Ogabassey Template
  if (
    (merchant as unknown as { template_id?: string }).template_id ===
    'ogabassey'
  ) {
    return (
      <Suspense fallback={<CheckoutLoading />}>
        <OgabasseyCheckoutPage />
      </Suspense>
    );
  }

  // Fallback
  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Checkout</h1>
        <p>Checkout functionality for this template is coming soon.</p>
      </div>
      <Footer />
    </>
  );
}
