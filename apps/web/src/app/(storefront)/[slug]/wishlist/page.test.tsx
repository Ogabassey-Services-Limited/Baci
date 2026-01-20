import { render, screen } from '@testing-library/react';
import { useParams } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useCart } from '@/hooks/use-cart';
import WishListPage from './page';

// Mocks
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('@/contexts/customer-auth-context', () => ({
  useCustomerAuth: vi.fn(),
}));

vi.mock('@/hooks/use-cart', () => ({
  useCart: vi.fn(),
  CartProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/hooks/use-currency', () => ({
  useCurrencyWithCountry: () => ({
    formatCurrency: (val: number) => `$${val}`,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('next/image', () => ({
  // biome-ignore lint/performance/noImgElement: mock for testing
  default: (props: any) => <img {...props} alt={props.alt || ''} />,
}));

vi.mock('lucide-react', () => ({
  Check: () => <span>Check</span>,
  Heart: () => <span>Heart</span>,
  Loader2: () => <span>Loader2</span>,
  Package: () => <span>Package</span>,
  Share2: () => <span>Share2</span>,
  ShoppingCart: () => <span>ShoppingCart</span>,
  Trash2: () => <span>Trash2</span>,
}));

// Mock fetch
global.fetch = vi.fn();

describe('WishListPage', () => {
  const mockWishlistItems = [
    {
      id: 'item-1',
      created_at: '2023-01-01',
      product_id: 'prod-1',
      products: {
        id: 'prod-1',
        name: 'Test Product 1',
        slug: 'test-product-1',
        description: 'Description 1',
        price: 100,
        images: ['/img1.jpg'],
        stock_quantity: 10,
        status: 'active',
        category: 'Test Category',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useParams as any).mockReturnValue({ slug: 'test-merchant' });
    (useCart as any).mockReturnValue({ addToCart: vi.fn() });

    // Default logged in state
    (useCustomerAuth as any).mockReturnValue({
      customer: { email: 'test@example.com' },
      isAuthenticated: true,
    });

    // Mock fetch response for wishlist
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockWishlistItems }),
    });
  });

  it('renders "Remove" button with correct aria-label', async () => {
    render(<WishListPage />);

    // Wait for items to load (useEffect fetch)
    // Since fetch is mocked and we are rendering, we need to wait for state update.
    // In a real browser test we'd wait for visibility. Here we can use findBy.

    // Verify the remove button exists and has the aria-label
    const removeButton = await screen.findByLabelText(
      'Remove Test Product 1 from wishlist'
    );
    expect(removeButton).toBeDefined();
    expect(removeButton.getAttribute('aria-label')).toBe(
      'Remove Test Product 1 from wishlist'
    );
  });
});
