import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { RecentlyViewedProducts } from './recently-viewed';

const {
  apiGetMock,
  addToCartMock,
  toastMock,
  recentlyViewedIdsState,
  merchantState,
} = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  addToCartMock: vi.fn(),
  toastMock: vi.fn(),
  recentlyViewedIdsState: { value: [] as string[] },
  merchantState: {
    value: { id: 'merchant-1', slug: 'ogabassey' } as {
      id: string;
      slug: string;
    } | null,
  },
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

vi.mock('@/hooks/use-cart', () => ({
  useCart: () => ({ addToCart: addToCartMock }),
}));

vi.mock('@/hooks/use-currency', () => ({
  useCurrency: () => ({ formatCurrency: (value: number) => `₦${value}` }),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: () => ({
    merchant: merchantState.value,
    basePath: '/ogabassey',
  }),
}));

vi.mock('@/hooks/use-recently-viewed', () => ({
  useRecentlyViewed: () => ({
    recentlyViewedIds: recentlyViewedIdsState.value,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/lib/api-client', () => ({
  apiGet: apiGetMock,
}));

vi.mock('@/lib/seo-utils', () => ({
  getProductUrl: (product: { slug?: string; id: string }) =>
    `/products/${product.slug ?? product.id}`,
}));

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    name: 'Samsung Galaxy S25',
    description: 'Flagship phone',
    status: 'active',
    price: 1500000,
    manage_stock: true,
    stock: 4,
    image: '/phone.jpg',
    imageLarge: '/phone.jpg',
    imageHint: '',
    brand: 'Samsung',
    gtin: '',
    mpn: '',
    category: 'smartphones',
    category_slug: 'smartphones',
    slug: 'samsung-galaxy-s25',
    categories: {
      id: 'cat-1',
      name: 'Smartphones',
      slug: 'smartphones',
    },
    ...overrides,
  } as Product;
}

describe('RecentlyViewedProducts', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    addToCartMock.mockReset();
    toastMock.mockReset();
    recentlyViewedIdsState.value = [];
    merchantState.value = { id: 'merchant-1', slug: 'ogabassey' };
  });

  it('does not render a section when there are no recently viewed ids', async () => {
    render(<RecentlyViewedProducts />);

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { level: 2, name: 'Recently Viewed' })
      ).not.toBeInTheDocument();
    });

    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it('fetches products and keeps the recently-viewed order while filtering inactive items', async () => {
    recentlyViewedIdsState.value = ['p3', 'p1', 'p2'];
    apiGetMock.mockResolvedValue({
      products: [
        buildProduct({ id: 'p1', name: 'First Product', slug: 'first' }),
        buildProduct({
          id: 'p2',
          name: 'Inactive Product',
          slug: 'inactive',
          status: 'draft',
        }),
        buildProduct({ id: 'p3', name: 'Third Product', slug: 'third' }),
      ],
    });

    render(<RecentlyViewedProducts />);

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        '/api/storefront/products?merchant_id=merchant-1&ids=p3,p1,p2'
      );
    });

    await waitFor(() => {
      const cardTitles = screen
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent);
      expect(cardTitles).toEqual(['Third Product', 'First Product']);
    });

    expect(screen.queryByText('Inactive Product')).not.toBeInTheDocument();
  });

  it('adds a product to cart and shows a toast', async () => {
    const featured = buildProduct({
      id: 'p9',
      name: 'Featured Device',
      slug: 'featured-device',
    });

    recentlyViewedIdsState.value = ['p9'];
    apiGetMock.mockResolvedValue({ products: [featured] });

    render(<RecentlyViewedProducts />);

    const addButton = await screen.findByRole('button', { name: 'Add' });
    fireEvent.click(addButton);

    expect(addToCartMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p9' })
    );
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Added to cart',
      description: 'Featured Device has been added to your cart.',
    });
  });

  it('renders nothing and logs when the products fetch rejects', async () => {
    recentlyViewedIdsState.value = ['p1'];
    apiGetMock.mockRejectedValueOnce(new Error('network down'));
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    render(<RecentlyViewedProducts />);

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledTimes(1);
    });

    // Section should not appear when fetch fails (products list stays empty)
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { level: 2, name: 'Recently Viewed' })
      ).not.toBeInTheDocument();
    });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('disables the Add button when the product is out of stock (manage_stock)', async () => {
    // manage_stock !== false AND stock <= 0 triggers the disabled state
    recentlyViewedIdsState.value = ['p-oos'];
    apiGetMock.mockResolvedValue({
      products: [
        buildProduct({
          id: 'p-oos',
          name: 'Sold Out Device',
          slug: 'sold-out',
          manage_stock: true,
          stock: 0,
        }),
      ],
    });

    render(<RecentlyViewedProducts />);

    const addButton = await screen.findByRole('button', { name: 'Add' });
    expect(addButton).toBeDisabled();
  });

  it('enables the Add button when manage_stock=false regardless of stock', async () => {
    recentlyViewedIdsState.value = ['p-service'];
    apiGetMock.mockResolvedValue({
      products: [
        buildProduct({
          id: 'p-service',
          name: 'Digital Service',
          slug: 'service',
          manage_stock: false,
          stock: 0,
        }),
      ],
    });

    render(<RecentlyViewedProducts />);

    const addButton = await screen.findByRole('button', { name: 'Add' });
    expect(addButton).not.toBeDisabled();
  });
});
