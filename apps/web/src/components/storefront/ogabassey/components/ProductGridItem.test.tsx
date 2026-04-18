import { act, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';

vi.mock('next/dynamic', async () => {
  const chromeModule = await vi.importActual<typeof import('./ProductGridItemChrome')>(
    './ProductGridItemChrome'
  );

  return {
    default: (loader: () => Promise<unknown>) => {
      const source = loader.toString();

      if (source.includes('ProductGridImageChrome')) {
        return chromeModule.ProductGridImageChrome;
      }

      if (source.includes('ProductGridContentChrome')) {
        return chromeModule.ProductGridContentChrome;
      }

      return () => null;
    },
  };
});

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: () => ({ basePath: '/ogabassey' }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img {...props} alt={String(props.alt ?? '')} />
  ),
}));

import { ProductGridItem } from './ProductGridItem';

const baseProduct: Product = {
  id: 'product-1',
  name: 'iPhone 17 Pro Max',
  price: '₦2,100,000',
  image: '/iphone.jpg',
  category: 'Smartphones',
  slug: 'iphone-17-pro-max',
  categories: {
    id: 'cat-smartphones',
    name: 'Smartphones',
    slug: 'smartphones',
  },
  rating: 4.9,
  description: 'Flagship phone with top-tier camera and performance.',
  condition: 'New',
  images: ['/iphone-black.jpg', '/iphone-gold.jpg'],
  colors: [
    { name: 'Black', value: '#111111' },
    { name: 'Gold', value: '#d4af37' },
  ],
};

describe('ProductGridItem', () => {
  let observerCallback: IntersectionObserverCallback | null = null;

  beforeEach(() => {
    vi.useFakeTimers();

    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }

      observe() {
        return;
      }

      disconnect() {
        return;
      }

      unobserve() {
        return;
      }

      takeRecords() {
        return [];
      }
    }

    global.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    observerCallback = null;
    delete (
      globalThis as { IntersectionObserver?: typeof IntersectionObserver }
    ).IntersectionObserver;
  });

  it('defers heavy interactive chrome when requested', () => {
    render(
      <ProductGridItem
        product={baseProduct}
        onAddToCart={vi.fn()}
        isAdded={false}
        isWishlisted={false}
        onToggleWishlist={vi.fn()}
        deferInteractiveChrome={true}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Add to wishlist' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: `Add ${baseProduct.name} to cart`,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Previous color' })
    ).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1400);
    });

    expect(
      screen.getByRole('button', { name: 'Add to wishlist' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: `Add ${baseProduct.name} to cart`,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Previous color' })
    ).toBeInTheDocument();
  });

  it('can defer interactive chrome until real interaction only', () => {
    render(
      <ProductGridItem
        product={baseProduct}
        onAddToCart={vi.fn()}
        isAdded={false}
        isWishlisted={false}
        onToggleWishlist={vi.fn()}
        deferInteractiveChrome={true}
        interactiveChromeTimeoutMs={0}
        interactiveChromeActivateOnIdle={false}
      />
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(
      screen.queryByRole('button', { name: 'Add to wishlist' })
    ).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new PointerEvent('pointerdown'));
    });

    expect(
      screen.getByRole('button', { name: 'Add to wishlist' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: `Add ${baseProduct.name} to cart`,
      })
    ).toBeInTheDocument();
  });

  it('waits to mount deferred images until the card is near the viewport', () => {
    render(
      <ProductGridItem
        product={baseProduct}
        onAddToCart={vi.fn()}
        isAdded={false}
        isWishlisted={false}
        onToggleWishlist={vi.fn()}
        deferImageLoading={true}
      />
    );

    expect(screen.queryByAltText(baseProduct.name)).not.toBeInTheDocument();

    act(() => {
      observerCallback?.(
        [
          {
            isIntersecting: true,
            target: screen.getByText(baseProduct.name),
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
    });

    expect(screen.getByAltText(baseProduct.name)).toBeInTheDocument();
  });
});
