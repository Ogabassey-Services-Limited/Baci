import { render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandProducts } from './brand-products';

vi.mock('next/image', () => ({
  default: (props: React.ComponentProps<'div'> & { alt?: string }) => (
    <div data-testid="mock-next-image" title={props.alt ?? ''} />
  ),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
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
  useCart: () => ({
    addToCart: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-currency', () => ({
  useCurrency: () => ({
    formatCurrency: (value: number) => `NGN ${value}`,
  }),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: () => ({
    merchant: { id: 'merchant-1' },
    basePath: '/store',
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockApiGet = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiGet: (url: string) => mockApiGet(url),
}));

describe('BrandProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters mismatched brands locally for normal brand names', async () => {
    mockApiGet.mockResolvedValue({
      products: [
        {
          id: 'current-product',
          name: 'Current Product',
          brand: 'Sony',
          status: 'active',
          price: 1000,
          image: '/current.jpg',
          imageLarge: '/current.jpg',
        },
        {
          id: 'same-brand',
          name: 'Sony Accessory',
          brand: 'Sony',
          status: 'active',
          price: 2000,
          image: '/sony.jpg',
          imageLarge: '/sony.jpg',
        },
        {
          id: 'different-brand',
          name: 'LG Accessory',
          brand: 'LG',
          status: 'active',
          price: 3000,
          image: '/lg.jpg',
          imageLarge: '/lg.jpg',
        },
      ],
    });

    render(
      <BrandProducts
        product={{
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
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Sony Accessory')).toBeInTheDocument();
    });

    expect(screen.queryByText('LG Accessory')).not.toBeInTheDocument();
  });

  it('keeps the exact local brand guard when the product brand is literal All', async () => {
    mockApiGet.mockResolvedValue({
      products: [
        {
          id: 'current-product',
          name: 'Current Product',
          brand: 'All',
          status: 'active',
          price: 1000,
          image: '/current.jpg',
          imageLarge: '/current.jpg',
        },
        {
          id: 'same-brand',
          name: 'All Brand Accessory',
          brand: 'All',
          status: 'active',
          price: 2000,
          image: '/all.jpg',
          imageLarge: '/all.jpg',
        },
        {
          id: 'different-brand',
          name: 'Sony Accessory',
          brand: 'Sony',
          status: 'active',
          price: 3000,
          image: '/sony.jpg',
          imageLarge: '/sony.jpg',
        },
      ],
    });

    render(
      <BrandProducts
        product={{
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
          brand: 'All',
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
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('All Brand Accessory')).toBeInTheDocument();
    });

    expect(screen.queryByText('Sony Accessory')).not.toBeInTheDocument();
    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/storefront/products?merchant_id=merchant-1&category=accessories&brand=All'
    );
  });

  it('returns no recommendations when the API request fails', async () => {
    mockApiGet.mockRejectedValue(new Error('network failure'));

    const { container } = render(
      <BrandProducts
        product={{
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
        }}
      />
    );

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
