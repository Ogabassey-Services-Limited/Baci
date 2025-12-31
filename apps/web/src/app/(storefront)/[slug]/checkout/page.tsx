import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { NewTemplateCheckoutPage } from '@/components/storefront/new-template';
import { CheckoutPage as OgabasseyCheckoutPage } from '@/components/storefront/ogabassey/pages/checkout-page';
import { CheckoutThemeProvider } from '@/components/checkout-theme-provider';
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
        <CheckoutThemeProvider>
          <NewTemplateCheckoutPage />
        </CheckoutThemeProvider>
      </Suspense>
    );
  }

  // Ogabassey Template (or any template that doesn't have a custom checkout)
  // Default to ogabassey checkout as it's the fully functional implementation
  return (
    <Suspense fallback={<CheckoutLoading />}>
      <CheckoutThemeProvider>
        <OgabasseyCheckoutPage />
      </CheckoutThemeProvider>
    </Suspense>
  );
}
