'use client';

import dynamic from 'next/dynamic';
import type { StickyAddToCartProps } from '@/components/storefront/sticky-add-to-cart';

// Match the sticky bar's fixed box while keeping it off-screen to avoid CLS.
const stickyCartLoadingFallback = (
  <div
    aria-hidden="true"
    className="fixed bottom-0 left-0 right-0 z-50 h-[72px] translate-y-full md:hidden"
    data-testid="sticky-cart-loading-fallback"
  />
);

const StickyAddToCart = dynamic<StickyAddToCartProps>(
  () =>
    import('@/components/storefront/sticky-add-to-cart').then(
      (mod) => mod.StickyAddToCart
    ),
  {
    loading: () => stickyCartLoadingFallback,
    ssr: false,
  }
);

export function DeferredStickyAddToCart(props: StickyAddToCartProps) {
  return <StickyAddToCart {...props} />;
}
