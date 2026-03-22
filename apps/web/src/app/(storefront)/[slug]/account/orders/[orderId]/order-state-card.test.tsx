import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OrderStateCard } from '@/app/(storefront)/[slug]/account/orders/[orderId]/order-state-card';
import { asRoute } from '@/lib/routes';

vi.mock('next/link', () => ({
  default: vi.fn(
    ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  ),
}));

describe('OrderStateCard', () => {
  it('renders the supplied copy and action link', () => {
    render(
      <OrderStateCard
        title="Order unavailable"
        message="We could not load this order."
        actionLabel="Back to orders"
        actionHref={asRoute('/ogabassey/account/orders')}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Order unavailable' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('We could not load this order.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to orders' })
    ).toHaveAttribute('href', '/ogabassey/account/orders');
  });
});
