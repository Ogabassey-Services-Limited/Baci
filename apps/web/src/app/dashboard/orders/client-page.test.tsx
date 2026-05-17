import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.mock('@/hooks/use-merchant-client', () => ({
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

import { useSearchParams } from 'next/navigation';
import OrdersClientPage from './client-page';

describe('OrdersClientPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ integrations: [] }),
    } as Response);
  });

  it('renders the orders header', () => {
    render(<OrdersClientPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Orders 📦' })
    ).toBeInTheDocument();
  });

  it('renders order cards with initial data', () => {
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

    // Order card expand/collapse behavior is tested in order-card.test.tsx
    expect(screen.getByText('1 item: iPhone 14 Pro')).toBeInTheDocument();
  });

  it('shows the server-provided orders error instead of empty state', () => {
    render(<OrdersClientPage initialOrdersError="Could not load orders." />);

    expect(screen.getByText('Failed to Load Orders')).toBeInTheDocument();
    expect(screen.getByText(/Could not load orders\./i)).toBeInTheDocument();
  });

  it('renders an agentic issue banner when agentic_issue is present', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('agentic_issue=AGENTIC_PAYMENT_SETUP_FAILED') as never
    );

    render(<OrdersClientPage />);

    expect(screen.getByText('Agentic checkout focus')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Payment setup failed for one or more agentic checkouts.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear focus' })).toHaveAttribute(
      'href',
      '/dashboard/orders?source=agentic'
    );
  });

  it('adds a trust-controls shortcut for allowlist issues', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams(
        'agentic_issue=AGENTIC_AGENT_ALLOWLIST_UNSET'
      ) as never
    );

    render(<OrdersClientPage />);

    expect(
      screen.getByRole('link', { name: 'Open trust controls' })
    ).toHaveAttribute(
      'href',
      '/dashboard/settings/trust#agent-checkout-controls'
    );
  });
});
