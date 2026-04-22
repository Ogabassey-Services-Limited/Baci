import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';

const mockUseMerchantSafe = vi.fn<() => { basePath?: string } | null>(
  () => null
);

vi.mock('@baci/shared', () => ({
  prioritizeSmartphoneProducts: vi.fn((products: unknown[]) => products),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: () => mockUseMerchantSafe(),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    prefetch,
    ...props
  }: {
    children: ReactNode;
    href: string;
    prefetch?: boolean;
  }) => (
    <a data-prefetch={String(prefetch)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('./AdUnit', () => ({
  AdUnit: () => <div data-testid="ad-unit" />,
}));

vi.mock('./HomeProductGridCard', () => ({
  HomeProductGridCard: ({
    product,
    deferImageLoading,
  }: {
    product: { name: string };
    deferImageLoading?: boolean;
  }) => (
    <article
      data-card-variant="static"
      data-defer-image-loading={String(Boolean(deferImageLoading))}
    >
      {product.name}
    </article>
  ),
}));

vi.mock('./ProductGridItem', () => ({
  ProductGridItem: ({
    product,
    deferImageLoading,
    interactiveChromeTimeoutMs,
    interactiveChromeActivateOnIdle,
  }: {
    product: { name: string };
    deferImageLoading?: boolean;
    interactiveChromeTimeoutMs?: number;
    interactiveChromeActivateOnIdle?: boolean;
  }) => (
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
}));

import { HomeProductGrid } from './HomeProductGrid';

function createTestProduct(index: number): Product {
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

describe('HomeProductGrid', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseMerchantSafe.mockReturnValue(null);
  });

  afterEach(async () => {
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });
    vi.useRealTimers();
  });

  it('limits the initial home feed to the configured display count', () => {
    render(
      <HomeProductGrid
        storeSlug="test-store"
        products={Array.from({ length: 13 }, (_, index) =>
          createTestProduct(index + 1)
        )}
      />
    );

    expect(screen.getAllByRole('article')).toHaveLength(8);
    expect(screen.queryByText('Product 13')).not.toBeInTheDocument();
  });

  it('links the view-all CTA to the storefront products route', () => {
    render(
      <HomeProductGrid
        storeSlug="test-store"
        products={[createTestProduct(1)]}
      />
    );

    expect(
      screen.getByRole('link', { name: 'View all products' })
    ).toHaveAttribute('href', '/test-store/products');
    expect(
      screen.getByRole('link', { name: 'View all products' })
    ).toHaveAttribute('data-prefetch', 'false');
  });

  it('uses merchant basePath so custom domains avoid slug-prefixed links', () => {
    mockUseMerchantSafe.mockReturnValue({ basePath: '' });

    render(
      <HomeProductGrid
        storeSlug="ogabassey"
        products={[createTestProduct(1)]}
      />
    );

    expect(
      screen.getByRole('link', { name: 'View all products' })
    ).toHaveAttribute('href', '/products');
  });

  it('defers image loading for cards after the first mobile row', () => {
    render(
      <HomeProductGrid
        storeSlug="test-store"
        products={Array.from({ length: 6 }, (_, index) =>
          createTestProduct(index + 1)
        )}
      />
    );

    expect(screen.getAllByRole('article')[0]).toHaveAttribute(
      'data-defer-image-loading',
      'false'
    );
    expect(screen.getAllByRole('article')[1]).toHaveAttribute(
      'data-defer-image-loading',
      'false'
    );
    expect(screen.getAllByRole('article')[2]).toHaveAttribute(
      'data-defer-image-loading',
      'true'
    );
  });

  it('defers the interactive bindings import until activation', async () => {
    const loadInteractionBindings = vi.fn().mockResolvedValue({
      ProductGridInteractionBindings: ({
        children,
      }: {
        children: (bindings: {
          isAdded: () => boolean;
          getCartQuantity: () => number;
          isWishlisted: () => boolean;
          onAddToCart: () => void;
          onToggleWishlist: () => void;
          particles: [];
        }) => ReactNode;
      }) =>
        children({
          isAdded: () => false,
          getCartQuantity: () => 0,
          isWishlisted: () => false,
          onAddToCart: () => undefined,
          onToggleWishlist: () => undefined,
          particles: [],
        }),
    });

    render(
      <HomeProductGrid
        products={[createTestProduct(1)]}
        loadInteractionBindings={loadInteractionBindings}
      />
    );

    expect(loadInteractionBindings).not.toHaveBeenCalled();

    fireEvent.pointerDown(window);

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadInteractionBindings).toHaveBeenCalledOnce();
  });

  it('renders lightweight static cards until the interactive modules load', async () => {
    const loadInteractionBindings = vi.fn().mockResolvedValue({
      ProductGridInteractionBindings: ({
        children,
      }: {
        children: (bindings: {
          isAdded: () => boolean;
          getCartQuantity: () => number;
          isWishlisted: () => boolean;
          onAddToCart: () => void;
          onToggleWishlist: () => void;
          particles: [];
        }) => ReactNode;
      }) =>
        children({
          isAdded: () => false,
          getCartQuantity: () => 0,
          isWishlisted: () => false,
          onAddToCart: () => undefined,
          onToggleWishlist: () => undefined,
          particles: [],
        }),
    });
    const loadInteractiveCard = vi.fn().mockResolvedValue({
      ProductGridItem: ({
        product,
        deferImageLoading,
        interactiveChromeTimeoutMs,
        interactiveChromeActivateOnIdle,
      }: {
        product: { name: string };
        deferImageLoading?: boolean;
        interactiveChromeTimeoutMs?: number;
        interactiveChromeActivateOnIdle?: boolean;
      }) => (
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
    });

    render(
      <HomeProductGrid
        products={[createTestProduct(1)]}
        loadInteractionBindings={loadInteractionBindings}
        loadInteractiveCard={loadInteractiveCard}
      />
    );

    expect(screen.getByRole('article')).toHaveAttribute(
      'data-card-variant',
      'static'
    );
    expect(loadInteractiveCard).not.toHaveBeenCalled();

    fireEvent.pointerDown(window);

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadInteractionBindings).toHaveBeenCalledOnce();
    expect(loadInteractiveCard).toHaveBeenCalledOnce();
    expect(screen.getByRole('article')).toHaveAttribute(
      'data-card-variant',
      'interactive'
    );
  });

  it('does not auto-import interactive bindings on a timeout alone', async () => {
    const loadInteractionBindings = vi.fn().mockResolvedValue({
      ProductGridInteractionBindings: ({
        children,
      }: {
        children: (bindings: {
          isAdded: () => boolean;
          getCartQuantity: () => number;
          isWishlisted: () => boolean;
          onAddToCart: () => void;
          onToggleWishlist: () => void;
          particles: [];
        }) => ReactNode;
      }) =>
        children({
          isAdded: () => false,
          getCartQuantity: () => 0,
          isWishlisted: () => false,
          onAddToCart: () => undefined,
          onToggleWishlist: () => undefined,
          particles: [],
        }),
    });

    render(
      <HomeProductGrid
        products={[createTestProduct(1)]}
        loadInteractionBindings={loadInteractionBindings}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(loadInteractionBindings).not.toHaveBeenCalled();
  });
});
