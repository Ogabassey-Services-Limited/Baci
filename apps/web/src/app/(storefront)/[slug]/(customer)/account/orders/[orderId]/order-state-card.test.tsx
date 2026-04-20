import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OrderStateCard } from '@/app/(storefront)/[slug]/(customer)/account/orders/[orderId]/order-state-card';
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

  it('renders empty title and message values without failing', () => {
    render(
      <OrderStateCard
        title=""
        message=""
        actionLabel="Retry"
        actionHref={asRoute('/ogabassey/account/orders')}
      />
    );

    expect(screen.getByRole('heading', { level: 1 })).toBeEmptyDOMElement();
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName.toLowerCase() === 'p' && element.textContent === ''
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retry' })).toHaveAttribute(
      'href',
      '/ogabassey/account/orders'
    );
  });

  it('renders long copy without truncating the semantic structure', () => {
    const longTitle =
      'Order details are temporarily unavailable while we refresh your storefront account context and reload the document state';
    const longMessage =
      'We are still trying to fetch the latest order details, payment history, shipment progress, and document availability for this purchase. Please wait a moment or try again from your orders list.';

    render(
      <OrderStateCard
        title={longTitle}
        message={longMessage}
        actionLabel="Back to orders"
        actionHref={asRoute('/ogabassey/account/orders')}
      />
    );

    expect(
      screen.getByRole('heading', { name: longTitle })
    ).toBeInTheDocument();
    expect(screen.getByText(longMessage)).toBeInTheDocument();
  });

  it('keeps the link text and href intact for special action labels', () => {
    render(
      <OrderStateCard
        title="Something went wrong"
        message="Please choose another action."
        actionLabel="Retry & return ✨"
        actionHref={asRoute('/ogabassey/account/orders')}
      />
    );

    expect(
      screen.getByRole('link', { name: 'Retry & return ✨' })
    ).toHaveAttribute('href', '/ogabassey/account/orders');
  });

  it('renders a level-one heading and a keyboard-focusable action link', () => {
    render(
      <OrderStateCard
        title="Order unavailable"
        message="We could not load this order."
        actionLabel="Back to orders"
        actionHref={asRoute('/ogabassey/account/orders')}
      />
    );

    const heading = screen.getByRole('heading', {
      name: 'Order unavailable',
      level: 1,
    });
    const actionLink = screen.getByRole('link', { name: 'Back to orders' });

    expect(heading.tagName).toBe('H1');
    actionLink.focus();
    expect(actionLink).toHaveFocus();
  });
});
