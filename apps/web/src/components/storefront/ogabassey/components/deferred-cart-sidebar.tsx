'use client';

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { loadCartSidebar } from '@/components/storefront/ogabassey/components/load-cart-sidebar';
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

function CartSidebarError({
  onDismiss,
  onRetry,
}: {
  onDismiss: () => void;
  onRetry: () => void;
}) {
  // `role="alert"` already implies `aria-live="assertive"`. Setting an
  // explicit `aria-live="polite"` would conflict with the role's implicit
  // semantics, so we omit it.
  return (
    <div
      className="fixed inset-y-0 right-0 z-[60] flex w-screen max-w-md flex-col justify-center gap-4 bg-[var(--store-background)] p-6 shadow-2xl"
      role="alert"
    >
      <button
        aria-label="Close cart"
        className="absolute right-4 top-4 min-h-10 rounded-full border border-[var(--store-border)] px-4 py-2 text-sm font-semibold text-[var(--store-background-text)]"
        onClick={onDismiss}
        type="button"
      >
        Close
      </button>
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

    void loadCartSidebar()
      .then((LoadedCartSidebar) => {
        if (!cancelled) {
          setCartSidebar(() => LoadedCartSidebar);
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
        onDismiss={() => {
          setLoadError(false);
          cart?.setIsCartOpen(false);
        }}
        onRetry={() => {
          // Clear the error synchronously so the loading shell renders on the
          // next paint instead of letting the error UI flash for an extra
          // render cycle while waiting for the effect to clear it.
          setLoadError(false);
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
