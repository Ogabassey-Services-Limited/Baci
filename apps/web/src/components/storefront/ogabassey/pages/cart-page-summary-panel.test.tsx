import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CartPageSummaryPanel } from './cart-page-summary-panel';

function renderSummary(overrides = {}) {
  const props = {
    displayCartTotal: 125_000,
    hasNonNegotiableCartItem: false,
    hasPriceNegotiation: true,
    onCheckoutClick: vi.fn(),
    onOpenTotalNegotiation: vi.fn(),
    ...overrides,
  };

  render(<CartPageSummaryPanel {...props} />);

  return props;
}

describe('CartPageSummaryPanel', () => {
  it('wires desktop negotiation and checkout actions', () => {
    const props = renderSummary();

    fireEvent.click(screen.getByRole('button', { name: /negotiate total/i }));
    fireEvent.click(screen.getByRole('button', { name: /proceed to checkout/i }));

    expect(props.onOpenTotalNegotiation).toHaveBeenCalledTimes(1);
    expect(props.onCheckoutClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText('₦125,000')).toBeInTheDocument();
  });

  it('hides total negotiation for non-negotiable carts', () => {
    renderSummary({ hasNonNegotiableCartItem: true });

    expect(
      screen.queryByRole('button', { name: /negotiate total/i })
    ).not.toBeInTheDocument();
  });
});
