import { render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: () => ({
    merchant: { slug: 'test-store' },
  }),
}));

vi.mock('@/contexts/customer-auth-context', () => ({
  useCustomerAuth: () => ({
    customer: { id: 'customer-1' },
    isAuthenticated: true,
  }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img {...props} alt={String(props.alt ?? '')} />
  ),
}));

import { OgabasseyV2Orders } from './orders';

describe('OgabasseyV2Orders', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('renders storefront-aware order detail links after a successful fetch', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        orders: [
          {
            id: 'order-1',
            order_number: 'ORD-001',
            created_at: '2026-04-01T00:00:00.000Z',
            shipping_status: 'Processing',
            total: 125000,
            items: [
              {
                id: 'item-1',
                name: 'iPhone 15 Pro',
                quantity: 1,
                image: '/iphone.jpg',
                product_slug: 'iphone-15-pro',
                category_slug: 'smartphones',
              },
            ],
          },
        ],
      }),
    });

    render(<OgabasseyV2Orders />);

    await screen.findByText('ORD-001');

    expect(screen.getByRole('link', { name: /view details/i })).toHaveAttribute(
      'href',
      '/test-store/account/orders/order-1'
    );
  });

  it('does not parse JSON when the orders request fails', async () => {
    const json = vi.fn();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json,
    });

    render(<OgabasseyV2Orders />);

    await waitFor(() =>
      expect(screen.getByText('No orders yet')).toBeInTheDocument()
    );

    expect(json).not.toHaveBeenCalled();
  });
});
