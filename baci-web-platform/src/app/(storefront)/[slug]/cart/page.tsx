import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StorefrontFooter as Footer } from '@/components/storefront/footer';
import { StorefrontHeader as Header } from '@/components/storefront/header';
import { CartPageWrapper } from '@/components/storefront/ogabassey/pages/cart-page-wrapper';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { isDomainIdentifier } from '@/lib/validation';

export default async function CartPage({
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

  // Ogabassey Template - uses CartPageWrapper for item_id parameter handling
  // Supports direct add-to-cart links: /cart?item_id=123 or /cart?item_id=123,456
  if (
    (merchant as unknown as { template_id?: string }).template_id ===
    'ogabassey'
  ) {
    return (
      <Suspense fallback={<StorefrontPageSkeleton />}>
        <CartPageWrapper merchantId={merchant.id} />
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
