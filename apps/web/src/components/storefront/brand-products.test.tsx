import { act, render, screen, waitFor } from '@testing-library/react';
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
    id: 'current-product',
    name: 'Current Product',
    description: 'desc',
    status: 'active',
    price: 1000,
    manage_stock: true,
    stock: 3,
    image: '/current.jpg',
    imageLarge: '/current.jpg',
    imageHint: '',
    brand: 'Sony',
    gtin: '',
    mpn: '',
    category: 'Accessories',
    category_slug: 'accessories',
    categories: {
      id: 'cat-1',
      name: 'Accessories',
      slug: 'accessories',
    },
    slug: 'current-product',
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

  function activateViewport() {
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
  }

  it('waits for viewport activation before fetching same-brand products', async () => {
    apiGetMock.mockResolvedValue({
      products: [
        {
          ...product,
          id: 'product-2',
          slug: 'sony-accessory',
          name: 'Sony Accessory',
        },
      ],
    });

    render(<BrandProducts product={product} />);

    expect(apiGetMock).not.toHaveBeenCalled();

    activateViewport();

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledTimes(1);
    });

    expect(apiGetMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/api/storefront/products?merchant_id=merchant-1&category=accessories&brand=Sony&limit=8&compact=true&has_images=true'
      )
    );
  });

  it('filters mismatched brands locally for normal brand names', async () => {
    apiGetMock.mockResolvedValue({
      products: [
        product,
        {
          ...product,
          id: 'same-brand',
          slug: 'sony-accessory',
          name: 'Sony Accessory',
          brand: 'Sony',
        },
        {
          ...product,
          id: 'different-brand',
          slug: 'lg-accessory',
          name: 'LG Accessory',
          brand: 'LG',
        },
      ],
    });

    render(<BrandProducts product={product} />);
    activateViewport();

    await waitFor(() => {
      expect(screen.getByText('Sony Accessory')).toBeInTheDocument();
    });

    expect(screen.queryByText('LG Accessory')).not.toBeInTheDocument();
  });

  it('keeps the exact local brand guard when the product brand is literal All', async () => {
    apiGetMock.mockResolvedValue({
      products: [
        { ...product, brand: 'All' },
        {
          ...product,
          id: 'same-brand',
          slug: 'all-brand-accessory',
          name: 'All Brand Accessory',
          brand: 'All',
        },
        {
          ...product,
          id: 'different-brand',
          slug: 'sony-accessory',
          name: 'Sony Accessory',
          brand: 'Sony',
        },
      ],
    });

    render(<BrandProducts product={{ ...product, brand: 'All' }} />);
    activateViewport();

    await waitFor(() => {
      expect(screen.getByText('All Brand Accessory')).toBeInTheDocument();
    });

    expect(screen.queryByText('Sony Accessory')).not.toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith(
      expect.stringContaining('brand=All')
    );
  });

  it('returns no recommendations when the API request fails', async () => {
    apiGetMock.mockRejectedValue(new Error('network failure'));

    const { container } = render(<BrandProducts product={product} />);
    activateViewport();

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
