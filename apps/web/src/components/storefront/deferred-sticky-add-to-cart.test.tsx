import { render, screen } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { PRODUCT_STATUS_ACTIVE } from '@/lib/products';
import { DeferredStickyAddToCart } from './deferred-sticky-add-to-cart';

type DynamicOptions = {
  loading?: () => ReactNode;
  ssr?: boolean;
};

const mockDynamic = vi.hoisted(() =>
  vi.fn(
    (
      _loader: () => Promise<ComponentType<{ product: Product }>>,
      _options: DynamicOptions
    ) => {
      return ({ product }: { product: Product }) => (
        <section aria-label="Deferred sticky add to cart">
          {product.name}
        </section>
      );
    }
  )
);

vi.mock('next/dynamic', () => ({
  default: mockDynamic,
}));

function makeProduct(): Product {
  return {
    brand: 'Apple',
    category: 'Tablets',
    category_slug: 'tablets',
    condition: 'new',
    description: 'Tablet',
    gtin: '',
    id: 'product-1',
    image: '/ipad.jpg',
    imageHint: 'ipad',
    imageLarge: '/ipad.jpg',
    manage_stock: true,
    mpn: '',
    name: 'iPad 11th Gen',
    price: 550_000,
    slug: 'ipad-11th-gen',
    status: PRODUCT_STATUS_ACTIVE,
    stock: 10,
  };
}

describe('DeferredStickyAddToCart', () => {
  it('loads the sticky cart outside the first server-rendered client graph', () => {
    const product = makeProduct();

    render(<DeferredStickyAddToCart product={product} />);

    expect(
      screen.getByRole('region', { name: 'Deferred sticky add to cart' })
    ).toHaveTextContent('iPad 11th Gen');
    expect(mockDynamic).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        loading: expect.any(Function),
        ssr: false,
      })
    );
  });

  it('uses a non-layout-shifting fallback while the sticky cart chunk loads', () => {
    const options = mockDynamic.mock.calls[0]?.[1];
    expect(options?.loading).toBeDefined();

    render(options?.loading?.());

    expect(screen.getByTestId('sticky-cart-loading-fallback')).toHaveClass(
      'fixed',
      'bottom-0',
      'h-[72px]',
      'translate-y-full',
      'md:hidden'
    );
  });
});
