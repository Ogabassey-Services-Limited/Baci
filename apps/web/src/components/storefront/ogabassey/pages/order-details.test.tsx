import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ id: 'order-123' })),
  usePathname: vi.fn(() => '/ogabassey/account/orders/order-123'),
  useRouter: vi.fn(() => ({ push: mockPush, back: vi.fn(), replace: vi.fn() })),
}));

vi.mock('next/link', () => ({
  default: vi.fn(({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  )),
}));

vi.mock('@/contexts/customer-auth-context', () => ({
  useCustomerAuth: vi.fn(() => ({
    customer: { id: 'cust-1', email: 'test@example.com' },
    isAuthenticated: true,
  })),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(() => 'subscribed'),
      unsubscribe: vi.fn(),
    })),
  })),
}));

vi.mock('../components/empty-state', () => ({
  EmptyState: vi.fn(({ title, description }: { title: string; description: string }) => (
    <div data-testid="empty-state">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )),
}));

import { useParams } from 'next/navigation';
import { OgabasseyV2OrderDetails } from './order-details';

const mockOrder = {
  id: 'order-123',
  order_number: 'ORD-001',
  created_at: '2026-01-15T10:00:00Z',
  shipping_status: 'Processing',
  payment_status: 'paid',
  total: 25000,
  subtotal: 23000,
  shipping_cost: 2000,
  shipping_provider: 'GIGL',
  shipping_address: { address_line1: '10 Marina Road', city: 'Lagos' },
  payment_method: 'paystack',
  items: [
    {
      id: 'item-1',
      product_id: 'prod-1',
      name: 'Wireless Headphones',
      product_name: 'Wireless Headphones',
      quantity: 2,
      price: 11500,
      product_image: '/images/headphones.png',
    },
    {
      id: 'item-2',
      product_id: 'prod-2',
      name: 'Phone Case',
      product_name: 'Phone Case',
      quantity: 1,
      price: 2000,
      image: '/images/case.png',
    },
  ],
};

describe('OgabasseyV2OrderDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders loading state initially', () => {
    // fetch never resolves so loading spinner stays visible
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));

    const { container } = render(<OgabasseyV2OrderDetails />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('renders order not found (EmptyState) when fetch fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    render(<OgabasseyV2OrderDetails />);

    await waitFor(() => {
      expect(screen.getByText('Order Not Found')).toBeTruthy();
    });

    expect(screen.getByText("We couldn't find the order you are looking for.")).toBeTruthy();
  });

  it('renders order details when order data is available', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockOrder,
    } as Response);

    render(<OgabasseyV2OrderDetails />);

    await waitFor(() => {
      expect(screen.getByText('Order Details')).toBeTruthy();
    });

    // Order number displayed
    expect(screen.getByText(/ORD-001/)).toBeTruthy();

    // Order status section
    expect(screen.getByText('Order Status')).toBeTruthy();

    // Order summary section
    expect(screen.getByText('Order Summary')).toBeTruthy();

    // Delivery details
    expect(screen.getByText('GIGL')).toBeTruthy();
    expect(screen.getByText('10 Marina Road, Lagos')).toBeTruthy();

    // Payment provider badge
    expect(screen.getByText('paystack')).toBeTruthy();
  });

  it('renders items list with product info', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockOrder,
    } as Response);

    render(<OgabasseyV2OrderDetails />);

    await waitFor(() => {
      expect(screen.getByText('Wireless Headphones')).toBeTruthy();
    });

    // Items count header
    expect(screen.getByText('Items (2)')).toBeTruthy();

    // Second item
    expect(screen.getByText('Phone Case')).toBeTruthy();

    // Quantities
    expect(screen.getByText('Qty: 2')).toBeTruthy();
    expect(screen.getByText('Qty: 1')).toBeTruthy();
  });
});
