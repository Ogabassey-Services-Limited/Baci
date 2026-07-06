import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreditDirectVerificationView } from './CreditDirectVerificationView';

function renderView(phase: 'polling' | 'timeout' | 'cancelled') {
  const onKeepWaiting = vi.fn();
  const onRetryPayment = vi.fn();
  const onReturnHome = vi.fn();

  render(
    <CreditDirectVerificationView
      phase={phase}
      onKeepWaiting={onKeepWaiting}
      onRetryPayment={onRetryPayment}
      onReturnHome={onReturnHome}
    />,
  );

  return { onKeepWaiting, onRetryPayment, onReturnHome };
}

describe('CreditDirectVerificationView', () => {
  it('shows the confirming state while polling', () => {
    renderView('polling');

    expect(
      screen.getByRole('heading', { name: 'Confirming your payment' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Try payment again' }),
    ).not.toBeInTheDocument();
  });

  it('offers keep-checking, retry, and home actions after a timeout', () => {
    const { onKeepWaiting, onRetryPayment, onReturnHome } =
      renderView('timeout');

    expect(
      screen.getByRole('heading', { name: 'Payment confirmation pending' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Keep checking' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Start a new payment attempt' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Return to Home' }));

    expect(onKeepWaiting).toHaveBeenCalledTimes(1);
    expect(onRetryPayment).toHaveBeenCalledTimes(1);
    expect(onReturnHome).toHaveBeenCalledTimes(1);
  });

  it('explains a cancelled order and only offers returning home', () => {
    const { onReturnHome } = renderView('cancelled');

    expect(
      screen.getByRole('heading', { name: 'Order cancelled' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Keep checking' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Return to Home' }));
    expect(onReturnHome).toHaveBeenCalledTimes(1);
  });
});
