import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { StorefrontProductGrid } from './product-grid';

// Mock dependencies
vi.mock('@/contexts/storefront-context', () => ({
  useStorefrontSafe: vi.fn(),
}));

vi.mock('@/hooks/use-cart', () => ({
  useCart: vi.fn(),
}));

vi.mock('@/hooks/use-currency', () => ({
  useCurrency: vi.fn(() => ({
    formatCurrency: (amount: number) => `$${amount}`,
    formatCurrencyCompact: (amount: number) => `$${amount}`,
  })),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

// Mock API client
vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(),
}));

// Mock child components that might cause issues in testing
vi.mock('./product-card', () => ({
  StorefrontProductCard: ({
    product,
  }: {
    product: Product;
    onAddToCart: unknown;
  }) => (
    <div data-testid="product-card">
      {product.name} - {product.price}
    </div>
  ),
}));

vi.mock('./quick-view-modal', () => ({
  QuickViewModal: () => <div data-testid="quick-view-modal" />,
  useQuickView: () => ({
    isOpen: false,
    openQuickView: vi.fn(),
    closeQuickView: vi.fn(),
    product: null,
  }),
}));

// Import mocks after definition
import { useStorefrontSafe } from '@/contexts/storefront-context';
import { useCart } from '@/hooks/use-cart';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { apiGet } from '@/lib/api-client';

describe('StorefrontProductGrid', () => {
  const mockProducts: Product[] = [
    {
      id: '1',
      name: 'Test Product 1',
      price: 100,
      category: 'Electronics',
      status: 'active',
      images: ['img1.jpg'],
      stock: 10,
      slug: 'test-product-1',
      description: 'Description 1',
    },
    {
      id: '2',
      name: 'Test Product 2',
      price: 200,
      category: 'Clothing',
      status: 'active',
      images: ['img2.jpg'],
      stock: 5,
      slug: 'test-product-2',
      description: 'Description 2',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    (useMerchantSafe as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      merchant: { id: 'merchant-123', slug: 'test-store' },
    });

    (useCart as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      cart: [],
      addToCart: vi.fn(),
      updateQuantity: vi.fn(),
      setMerchantSlug: vi.fn(),
    });

    (useStorefrontSafe as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      searchQuery: '',
      selectedCategory: 'All',
      setSelectedCategory: vi.fn(),
      setSearchQuery: vi.fn(),
    });

    (apiGet as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url) => {
        if (url.includes('/api/storefront/products')) {
          return Promise.resolve({ products: mockProducts });
        }
        if (url.includes('/api/products/count')) {
          return Promise.resolve({ count: 2, recommendedMethod: 'client' });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }
    );
  });

  it('renders loading state initially', () => {
    render(<StorefrontProductGrid />);
    // Initial render shows skeleton or loading state
    // We check for the output live region text
    expect(screen.getByText(/Loading products/i)).toBeInTheDocument();
  });

  it('renders products after fetching', async () => {
    render(<StorefrontProductGrid />);

    await waitFor(() => {
      expect(screen.getAllByTestId('product-card')).toHaveLength(2);
    });

    expect(screen.getByText('Test Product 1 - 100')).toBeInTheDocument();
    expect(screen.getByText('Test Product 2 - 200')).toBeInTheDocument();
  });

  it('filters by category when category is selected', async () => {
    (useStorefrontSafe as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      searchQuery: '',
      selectedCategory: 'Electronics', // Pre-selected
      setSelectedCategory: vi.fn(),
      setSearchQuery: vi.fn(),
    });

    render(<StorefrontProductGrid />);

    await waitFor(() => {
      // Should only show Electronics product
      const products = screen.getAllByTestId('product-card');
      expect(products).toHaveLength(1);
      expect(products[0]).toHaveTextContent('Test Product 1');
    });
  });

  it('filters by search query', async () => {
    (useStorefrontSafe as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      searchQuery: 'Product 2', // Search active
      selectedCategory: 'All',
      setSelectedCategory: vi.fn(),
      setSearchQuery: vi.fn(),
    });

    render(<StorefrontProductGrid />);

    await waitFor(() => {
      const products = screen.getAllByTestId('product-card');
      expect(products).toHaveLength(1);
      expect(products[0]).toHaveTextContent('Test Product 2');
    });
  });

  it('handles empty state', async () => {
    (apiGet as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url) => {
        if (url.includes('/api/storefront/products')) {
          return Promise.resolve({ products: [] });
        }
        if (url.includes('/api/products/count')) {
          return Promise.resolve({ count: 0, recommendedMethod: 'client' });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }
    );

    render(<StorefrontProductGrid />);

    await waitFor(() => {
      expect(
        screen.getByText(/No products are currently available/i)
      ).toBeInTheDocument();
    });
  });
});
