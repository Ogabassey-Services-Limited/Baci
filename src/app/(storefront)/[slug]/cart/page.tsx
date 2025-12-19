import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StorefrontFooter as Footer } from '@/components/storefront/footer';
import { StorefrontHeader as Header } from '@/components/storefront/header';
import { CartPage as OgabasseyCartPage } from '@/components/storefront/ogabassey/pages/cart-page';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';
import { getCachedMerchant } from '@/lib/cached-data';

export default async function CartPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = await getCachedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  // Ogabassey Template
  if (
    (merchant as unknown as { template_id?: string }).template_id ===
    'ogabassey'
  ) {
    return (
      <Suspense fallback={<StorefrontPageSkeleton />}>
        <OgabasseyCartPage />
      </Suspense>
    );
  }

  // Fallback for other templates (e.g. new-template uses different system or standard fallback)
  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Cart</h1>
        <p>Cart functionality for this template is coming soon.</p>
      </div>
      <Footer />
    </>
  );
}
