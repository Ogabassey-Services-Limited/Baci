import { act, render, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { BrandProducts } from './brand-products';

const { apiGetMock, addToCartMock, toastMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  addToCartMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // biome-ignore lint/performance/noImgElement: test stub
    <img alt={props.alt ?? ''} {...props} />
  ),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/themed', () => ({
  ThemedButton: ({
    children,
    colorRole: _colorRole,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    colorRole?: string;
  }) => <button {...props}>{children}</button>,
  ThemedCard: ({
    children,
    accentPosition: _accentPosition,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { accentPosition?: string }) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  CardContent: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/hooks/cart', () => ({
  useCart: () => ({ addToCart: addToCartMock }),
}));

vi.mock('@/hooks/use-currency', () => ({
  useCurrency: () => ({ formatCurrency: (value: number) => `₦${value}` }),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: () => ({
    merchant: { id: 'merchant-1', slug: 'ogabassey' },
    basePath: '/ogabassey',
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/lib/api-client', () => ({
  apiGet: apiGetMock,
}));

describe('BrandProducts', () => {
  let observerCallback: IntersectionObserverCallback | null = null;

  const product: Product = {
    id: 'product-1',
    name: 'iPhone 17 Pro Max',
    description: 'Flagship phone',
    status: 'active',
    price: 1200000,
    manage_stock: true,
    stock: 4,
    image: '/phone.jpg',
    imageLarge: '/phone.jpg',
    imageHint: 'phone',
    brand: 'Apple',
    gtin: '123',
    mpn: '456',
    category: 'smartphones',
    category_slug: 'smartphones',
    slug: 'iphone-17-pro-max',
    categories: { name: 'smartphones', slug: 'smartphones' },
  };

  beforeEach(() => {
    apiGetMock.mockReset();
    addToCartMock.mockReset();
    toastMock.mockReset();

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
    observerCallback = null;
    delete (
      globalThis as { IntersectionObserver?: typeof IntersectionObserver }
    ).IntersectionObserver;
  });

  it('waits for viewport activation before fetching same-brand products', async () => {
    apiGetMock.mockResolvedValue({
      products: [
        { ...product, id: 'product-2', slug: 'iphone-17', name: 'iPhone 17' },
      ],
    });

    render(<BrandProducts product={product} />);

    expect(apiGetMock).not.toHaveBeenCalled();

    act(() => {
      observerCallback?.(
        [
          {
            isIntersecting: true,
            target: document.body,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
    });

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledTimes(1);
    });

    expect(apiGetMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/api/storefront/products?merchant_id=merchant-1&category=smartphones&brand=Apple&limit=8&compact=true&has_images=true'
      )
    );
  });
});
