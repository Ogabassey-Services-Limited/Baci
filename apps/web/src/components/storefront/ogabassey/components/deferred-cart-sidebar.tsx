'use client';

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { useCartSafe } from '@/hooks/cart';

type CartSidebarComponent = ComponentType;

function CartSidebarLoading() {
  return (
    <div
      aria-label="Loading cart"
      className="fixed inset-y-0 right-0 z-[60] w-screen max-w-md bg-[var(--store-background)] shadow-2xl"
      role="status"
    />
  );
}

function CartSidebarError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      aria-live="polite"
      className="fixed inset-y-0 right-0 z-[60] flex w-screen max-w-md flex-col justify-center gap-4 bg-[var(--store-background)] p-6 shadow-2xl"
      role="alert"
    >
      <p className="text-sm font-medium text-[var(--store-background-text)]">
        Unable to load cart.
      </p>
      <button
        className="min-h-12 rounded-full bg-[var(--store-primary)] px-4 py-2 text-sm font-semibold text-[var(--store-on-primary)]"
        onClick={onRetry}
        type="button"
      >
        Retry
      </button>
    </div>
  );
}

// Keep the shell import small: the heavy cart drawer chunk is requested only
// after cart state opens, rather than on a startup timer.
export function DeferredCartSidebar() {
  const cart = useCartSafe();
  const isCartOpen = cart?.isCartOpen === true;
  const [hasOpened, setHasOpened] = useState(isCartOpen);
  const [CartSidebar, setCartSidebar] =
    useState<CartSidebarComponent | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!isCartOpen) {
      return;
    }

    setHasOpened(true);
    setLoadError(false);

    if (CartSidebar) {
      return;
    }

    let cancelled = false;

    void import('@/components/storefront/ogabassey/components/CartSidebar')
      .then((mod) => {
        if (!cancelled) {
          setCartSidebar(() => mod.CartSidebar);
          setLoadError(false);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error('Failed to load OgaBassey cart drawer', error);
          setLoadError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [CartSidebar, isCartOpen, loadAttempt]);

  if (!(isCartOpen || (hasOpened && CartSidebar))) {
    return null;
  }

  if (loadError) {
    return (
      <CartSidebarError
        onRetry={() => {
          setLoadAttempt((attempt) => attempt + 1);
        }}
      />
    );
  }

  if (!CartSidebar) {
    return <CartSidebarLoading />;
  }

  return <CartSidebar />;
}
