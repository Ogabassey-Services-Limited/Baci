import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    // biome-ignore lint/performance/noImgElement: Test mock for next/image intentionally uses <img>
    <img {...props} alt={props.alt as string} />
  ),
}));
vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));
vi.mock('@/hooks/use-merchant', () => ({
  useMerchant: vi.fn(() => ({
    merchant: { id: 'm-1', slug: 'test', currency: 'NGN' },
    loading: false,
  })),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

// The client page imports many subcomponents - mock them all
vi.mock('@/components/ui/bag-loader', () => ({
  BagLoader: () => <div>Loading...</div>,
}));

// Mock AuthContext to provide the required context
vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-1', email: 'test@example.com' },
    loading: false,
    signOut: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import OrdersClientPage from './client-page';

describe('OrdersClientPage', () => {
  it('renders without crashing', () => {
    const { container } = render(<OrdersClientPage />);
    expect(container).toBeDefined();
  });

  it('expands an order when a non-interactive part of the card is clicked', async () => {
    const user = userEvent.setup();

    render(
      <OrdersClientPage
        initialOrders={[
          {
            id: 'order-1',
            orderNumber: 'ORD-001',
            customerName: 'Chidimma Azubuike',
            total: 803638,
            shippingStatus: 'Pending',
            paymentStatus: 'Pending',
            paymentMethod: 'card',
            date: 'Mar 18, 2026',
            createdAt: Date.now(),
            source: 'online_store',
            items: [
              {
                id: 'item-1',
                name: 'iPhone 14 Pro',
                quantity: 1,
                price: 803638,
              },
            ],
          },
        ]}
      />
    );

    expect(screen.queryByText('Item Details')).not.toBeInTheDocument();

    await user.click(screen.getByText('1 items: iPhone 14 Pro'));

    expect(screen.getByText('Item Details')).toBeInTheDocument();
  });
});
