import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { RelatedProducts } from './related-products';

const { apiGetMock, addToCartMock, toastMock, merchantState } = vi.hoisted(
  () => ({
    apiGetMock: vi.fn(),
    addToCartMock: vi.fn(),
    toastMock: vi.fn(),
    merchantState: {
      value: { id: 'merchant-1', slug: 'ogabassey' } as {
        id: string;
        slug: string;
      } | null,
    },
  })
);

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

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => ({
    merchant: merchantState.value,
    basePath: '/ogabassey',
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
    id: overrides.id ?? 'p-default',
    name: overrides.name ?? 'Samsung Galaxy Device',
    description: overrides.description ?? 'Device description',
    status: overrides.status ?? 'active',
    price: overrides.price ?? 1000,
    manage_stock: overrides.manage_stock ?? true,
    stock: overrides.stock ?? 5,
    image: overrides.image ?? '/device.jpg',
    imageLarge: overrides.imageLarge ?? '/device.jpg',
    imageHint: overrides.imageHint ?? '',
    brand: overrides.brand ?? 'Samsung',
    gtin: overrides.gtin ?? '',
    mpn: overrides.mpn ?? '',
    category: overrides.category ?? 'smartphones',
    category_slug: overrides.category_slug ?? 'smartphones',
    slug: overrides.slug ?? 'samsung-galaxy-device',
    categories: overrides.categories ?? {
      id: 'cat-1',
      name: 'Smartphones',
      slug: 'smartphones',
    },
    ...overrides,
  };
}

describe('RelatedProducts', () => {
  const currentProduct = buildProduct({
    id: 'current',
    name: 'Current Galaxy',
    slug: 'current-galaxy',
    price: 1000,
    brand: 'Samsung',
    category: 'smartphones',
  });

  beforeEach(() => {
    apiGetMock.mockReset();
    addToCartMock.mockReset();
    toastMock.mockReset();
    merchantState.value = { id: 'merchant-1', slug: 'ogabassey' };
  });

  it('fetches related candidates and ranks best semantic matches first', async () => {
    apiGetMock.mockResolvedValue({
      products: [
        currentProduct,
        buildProduct({
          id: 'top',
          name: 'Top Match',
          slug: 'top-match',
          category: 'smartphones',
          brand: 'Samsung',
          price: 1100,
        }),
        buildProduct({
          id: 'mid',
          name: 'Mid Match',
          slug: 'mid-match',
          category: 'smartphones',
          brand: 'Tecno',
          price: 1400,
        }),
        buildProduct({
          id: 'low',
          name: 'Low Match',
          slug: 'low-match',
          category: 'tablets',
          brand: 'Samsung',
          price: 1020,
        }),
        buildProduct({
          id: 'inactive',
          name: 'Inactive Match',
          slug: 'inactive-match',
          category: 'smartphones',
          brand: 'Samsung',
          price: 1050,
          status: 'draft',
        }),
      ],
    });

    render(<RelatedProducts product={currentProduct} maxProducts={3} />);

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        '/api/storefront/products?merchant_id=merchant-1'
      );
    });

    await waitFor(() => {
      const cardTitles = screen
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent);
      expect(cardTitles).toEqual(['Top Match', 'Mid Match', 'Low Match']);
    });
  });

  it('returns null when there are no eligible related products', async () => {
    apiGetMock.mockResolvedValue({
      products: [currentProduct],
    });

    render(<RelatedProducts product={currentProduct} />);

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          level: 2,
          name: 'You Might Also Like',
        })
      ).not.toBeInTheDocument();
    });
  });

  it('adds a related product to cart and shows a toast', async () => {
    const related = buildProduct({
      id: 'related-1',
      name: 'Related Device',
      slug: 'related-device',
    });

    apiGetMock.mockResolvedValue({
      products: [currentProduct, related],
    });

    render(<RelatedProducts product={currentProduct} />);

    const addButton = await screen.findByRole('button', { name: 'Add' });
    fireEvent.click(addButton);

    expect(addToCartMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'related-1' })
    );
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Added to cart',
      description: 'Related Device has been added to your cart.',
    });
  });

  it('renders nothing and logs when the related-products fetch rejects', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('network error'));
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    render(<RelatedProducts product={currentProduct} />);

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          level: 2,
          name: 'You Might Also Like',
        })
      ).not.toBeInTheDocument();
    });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('disables the Add button for stock-managed out-of-stock products', async () => {
    // isOutOfStock: manage_stock !== false AND stock <= 0
    const soldOut = buildProduct({
      id: 'sold-out',
      name: 'Sold Out Device',
      slug: 'sold-out',
      manage_stock: true,
      stock: 0,
    });

    apiGetMock.mockResolvedValue({
      products: [currentProduct, soldOut],
    });

    render(<RelatedProducts product={currentProduct} />);

    const addButton = await screen.findByRole('button', { name: 'Add' });
    expect(addButton).toBeDisabled();
  });

  it('keeps the Add button enabled when manage_stock is false (service/digital)', async () => {
    const service = buildProduct({
      id: 'service',
      name: 'Subscription Service',
      slug: 'service',
      manage_stock: false,
      stock: 0,
    });

    apiGetMock.mockResolvedValue({
      products: [currentProduct, service],
    });

    render(<RelatedProducts product={currentProduct} />);

    const addButton = await screen.findByRole('button', { name: 'Add' });
    expect(addButton).not.toBeDisabled();
  });
});
