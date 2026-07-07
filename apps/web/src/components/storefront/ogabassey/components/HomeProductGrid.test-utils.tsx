import { act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import type { Product } from '../types';

export function createTestProduct(index: number): Product {
  return {
    id: `product-${index}`,
    name: `Product ${index}`,
    description: '',
    price: `₦${index}`,
    rawPrice: index,
    condition: 'New',
    image: '',
    images: [],
    manage_stock: true,
    stock: index,
  };
}

export async function flushPostPaintActivation() {
  await act(async () => {
    vi.advanceTimersByTime(16);
    await Promise.resolve();
    vi.runOnlyPendingTimers();
    await Promise.resolve();
  });
}

export interface MockInteractionBindings {
  isAdded: () => boolean;
  getCartQuantity: () => number;
  isWishlisted: () => boolean;
  onAddToCart: () => void;
  onToggleWishlist: () => void;
  particles: [];
}

/**
 * Builds a dynamic-import-shaped module matching the default export of
 * `./ProductGridInteractionBindings`, resolving synchronously to the same
 * inert bindings used across the interaction/activation test suite.
 */
export function createMockInteractionBindingsModule() {
  return {
    ProductGridInteractionBindings: ({
      children,
    }: {
      children: (bindings: MockInteractionBindings) => ReactNode;
    }) =>
      children({
        isAdded: () => false,
        getCartQuantity: () => 0,
        isWishlisted: () => false,
        onAddToCart: () => undefined,
        onToggleWishlist: () => undefined,
        particles: [],
      }),
  };
}

interface MockInteractiveCardProps {
  product: { name: string };
  deferImageLoading?: boolean;
  interactiveChromeTimeoutMs?: number;
  interactiveChromeActivateOnIdle?: boolean;
}

/**
 * Builds a dynamic-import-shaped module matching the default export of
 * `./ProductGridItem`, mirroring the module-level mock so tests that inject a
 * custom `loadInteractiveCard` see the same interactive-card markup.
 */
export function createMockInteractiveCardModule() {
  return {
    ProductGridItem: ({
      product,
      deferImageLoading,
      interactiveChromeTimeoutMs,
      interactiveChromeActivateOnIdle,
    }: MockInteractiveCardProps) => (
      <article
        data-card-variant="interactive"
        data-defer-image-loading={String(Boolean(deferImageLoading))}
        data-interactive-timeout={
          interactiveChromeTimeoutMs === undefined
            ? 'default'
            : String(interactiveChromeTimeoutMs)
        }
        data-interactive-idle={String(
          interactiveChromeActivateOnIdle !== false
        )}
      >
        {product.name}
      </article>
    ),
  };
}
