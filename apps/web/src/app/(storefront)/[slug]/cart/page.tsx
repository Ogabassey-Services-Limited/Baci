import { notFound } from 'next/navigation';
import { Suspense } from 'react';
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
  // Default to ogabassey cart as it's the fully functional implementation
  return (
    <Suspense fallback={<StorefrontPageSkeleton />}>
      <CartPageWrapper merchantId={merchant.id} />
    </Suspense>
  );
}
