import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UniversalCartReadinessCard } from './universal-cart-readiness-card';

const readiness = {
  checks: [
    {
      id: 'ucp_cart_capability' as const,
      message: 'Cart ready',
      status: 'pass' as const,
    },
    {
      id: 'ucp_catalog_search_capability' as const,
      message: 'Search ready',
      status: 'pass' as const,
    },
    {
      id: 'ucp_catalog_lookup_capability' as const,
      message: 'Lookup ready',
      status: 'pass' as const,
    },
    {
      id: 'ucp_checkout_capability' as const,
      message: 'Checkout ready',
      status: 'pass' as const,
    },
    {
      id: 'ucp_order_capability' as const,
      message: 'Order ready',
      status: 'pass' as const,
    },
    {
      id: 'payment_handler_configured' as const,
      message: 'Payment ready',
      status: 'pass' as const,
    },
  ],
  lastCheckedAt: '2026-05-26T12:00:00.000Z',
  status: 'pass' as const,
  url: 'https://ogabassey.com/.well-known/ucp',
};

describe('UniversalCartReadinessCard', () => {
  it('renders Universal Cart readiness dimensions', () => {
    render(<UniversalCartReadinessCard readiness={readiness} />);

    expect(screen.getByText('Universal Cart readiness')).toBeInTheDocument();
    expect(screen.getByText('Cart')).toBeInTheDocument();
    expect(screen.getByText('Catalog')).toBeInTheDocument();
    expect(screen.getByText('Checkout')).toBeInTheDocument();
    expect(screen.getByText('Payment')).toBeInTheDocument();
    expect(screen.getByText('2026-05-26T12:00:00.000Z')).toBeInTheDocument();
  });

  it('collapses catalog to fail when lookup fails', () => {
    render(
      <UniversalCartReadinessCard
        readiness={{
          ...readiness,
          checks: readiness.checks.map((check) =>
            check.id === 'ucp_catalog_lookup_capability'
              ? { ...check, status: 'fail' as const }
              : check
          ),
          status: 'fail',
        }}
      />
    );

    expect(screen.getByRole('group', { name: 'Catalog: fail' })).toBeVisible();
  });

  it('shows an unavailable state without readiness data', () => {
    render(<UniversalCartReadinessCard readiness={null} />);

    expect(screen.getByText('Readiness data is unavailable.')).toBeVisible();
  });
});
