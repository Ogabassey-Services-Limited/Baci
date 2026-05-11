'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useCartSafe } from '@/hooks/cart';

const CartSidebar = dynamic(
  () => import('./CartSidebar').then((mod) => mod.CartSidebar),
  {
    ssr: false,
    loading: () => (
      <div
        aria-label="Loading cart"
        className="fixed inset-y-0 right-0 z-[60] w-screen max-w-md bg-[var(--store-background,#ffffff)] shadow-2xl"
        role="status"
      />
    ),
  }
);

// Keep the shell import small: the heavy cart drawer chunk is requested only
// after cart state opens, rather than on a startup timer.
export function DeferredCartSidebar() {
  const cart = useCartSafe();
  const isCartOpen = cart?.isCartOpen === true;
  const [hasOpened, setHasOpened] = useState(isCartOpen);

  useEffect(() => {
    if (isCartOpen) {
      setHasOpened(true);
    }
  }, [isCartOpen]);

  if (!(isCartOpen || hasOpened)) {
    return null;
  }

  return <CartSidebar />;
}
