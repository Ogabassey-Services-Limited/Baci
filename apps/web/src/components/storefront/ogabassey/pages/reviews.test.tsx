import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

const useCustomerAuthMock = vi.fn();

vi.mock('@/contexts/customer-auth-context', () => ({
  useCustomerAuth: () => useCustomerAuthMock(),
}));

const useMerchantSafeMock = vi.fn();

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => useMerchantSafeMock(),
}));

vi.mock('@/components/storefront/cdn-format-image', () => ({
  CdnFormatImage: (props: Record<string, unknown>) => (
    <img src={String(props.src ?? '')} alt={String(props.alt ?? '')} />
  ),
}));

import { OgabasseyV2Reviews } from './reviews';

describe('OgabasseyV2Reviews', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    useCustomerAuthMock.mockReset();
    useMerchantSafeMock.mockReset();
  });

  it('renders the empty review tabs immediately without fetching when unauthenticated', () => {
    useCustomerAuthMock.mockReturnValue({
      customer: null,
      isAuthenticated: false,
    });
    useMerchantSafeMock.mockReturnValue({
      merchant: { id: 'merchant-1', slug: 'test-store' },
    });

    render(<OgabasseyV2Reviews />);

    expect(screen.getByText('My Reviews')).toBeInTheDocument();
    expect(screen.getByText('No Pending Reviews')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the loader, then pending items from delivered orders once the fetch settles', async () => {
    useCustomerAuthMock.mockReturnValue({
      customer: { email: 'jane@example.com', first_name: 'Jane' },
      isAuthenticated: true,
    });
    useMerchantSafeMock.mockReturnValue({
      merchant: { id: 'merchant-1', slug: 'test-store' },
    });
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/storefront/orders')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              orders: [
                {
                  id: 'order-1',
                  created_at: '2026-04-01T00:00:00.000Z',
                  shipping_status: 'delivered',
                  items: [
                    {
                      id: 'item-1',
                      product_id: 'product-1',
                      name: 'iPhone 15 Pro',
                      image: '/iphone.jpg',
                      price: 125000,
                    },
                  ],
                },
              ],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ reviews: [] }),
      });
    });

    render(<OgabasseyV2Reviews />);

    // Loader renders while the fetch for the current session is unsettled.
    expect(screen.queryByText('My Reviews')).not.toBeInTheDocument();

    expect(await screen.findByText('iPhone 15 Pro')).toBeInTheDocument();
    expect(screen.getByText('To Review (1)')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Rate Now' })
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'iPhone 15 Pro' })).toHaveAttribute(
      'src',
      '/iphone.jpg'
    );
  });

  it('excludes already-reviewed products from the pending list', async () => {
    useCustomerAuthMock.mockReturnValue({
      customer: { email: 'jane@example.com', first_name: 'Jane' },
      isAuthenticated: true,
    });
    useMerchantSafeMock.mockReturnValue({
      merchant: { id: 'merchant-1', slug: 'test-store' },
    });
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/storefront/orders')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              orders: [
                {
                  id: 'order-1',
                  created_at: '2026-04-01T00:00:00.000Z',
                  shipping_status: 'delivered',
                  items: [
                    {
                      id: 'item-1',
                      product_id: 'product-1',
                      name: 'iPhone 15 Pro',
                      image: '/iphone.jpg',
                      price: 125000,
                    },
                  ],
                },
              ],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            reviews: [
              {
                id: 'review-1',
                product_id: 'product-1',
                rating: 5,
                status: 'approved',
                created_at: '2026-04-02T00:00:00.000Z',
                products: { name: 'iPhone 15 Pro', images: ['/iphone.jpg'] },
              },
            ],
          }),
      });
    });

    render(<OgabasseyV2Reviews />);

    expect(await screen.findByText('To Review (0)')).toBeInTheDocument();
    expect(screen.getByText('History (1)')).toBeInTheDocument();
    expect(screen.getByText('No Pending Reviews')).toBeInTheDocument();
  });
});
