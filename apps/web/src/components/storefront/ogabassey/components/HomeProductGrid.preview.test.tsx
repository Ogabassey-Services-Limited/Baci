import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestProduct } from './HomeProductGrid.test-utils';

vi.mock('@baci/shared/storefront', () => ({
  prioritizeSmartphoneProducts: vi.fn((products: unknown[]) => products),
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

vi.mock('./deferred-ad-unit', () => ({
  DeferredAdUnit: ({ fallback }: { fallback?: ReactNode; placementKey: string }) => (
    <div>{fallback}</div>
  ),
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

describe('HomeProductGrid preview catalog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });
    vi.useRealTimers();
  });

  it('does not fetch the mock preview catalog when real products are provided', async () => {
    const loadPreviewCatalog = vi.fn().mockResolvedValue({
      products: [createTestProduct(99)],
    });

    render(
      <HomeProductGrid
        storeSlug="test-store"
        products={[createTestProduct(1)]}
        loadPreviewCatalog={loadPreviewCatalog}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadPreviewCatalog).not.toHaveBeenCalled();
    expect(screen.getByText('Product 1')).toBeInTheDocument();
  });

  it('lazily loads the mock preview catalog when no products are provided', async () => {
    const loadPreviewCatalog = vi.fn().mockResolvedValue({
      products: [createTestProduct(101), createTestProduct(102)],
    });

    render(<HomeProductGrid loadPreviewCatalog={loadPreviewCatalog} />);

    // Before the async catalog resolves the grid renders its empty shell.
    expect(screen.getByText('No products found.')).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadPreviewCatalog).toHaveBeenCalledOnce();
    expect(screen.getByText('Product 101')).toBeInTheDocument();
    expect(screen.getByText('Product 102')).toBeInTheDocument();
    expect(screen.queryByText('No products found.')).not.toBeInTheDocument();
  });
});
