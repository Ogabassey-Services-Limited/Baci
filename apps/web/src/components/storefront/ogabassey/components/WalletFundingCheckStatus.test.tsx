import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WalletFundingCheckStatus } from './WalletFundingCheckStatus';

describe('WalletFundingCheckStatus', () => {
  it('offers the arm affordance while idle and calls back when pressed', async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn();

    render(
      <WalletFundingCheckStatus
        creditedAmount={null}
        onCheck={onCheck}
        status="idle"
      />
    );
    await user.click(
      screen.getByRole('button', { name: /I've transferred/i })
    );

    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('shows the checking state and hides the arm button while polling', () => {
    render(
      <WalletFundingCheckStatus
        creditedAmount={null}
        onCheck={vi.fn()}
        status="checking"
      />
    );

    expect(screen.getByText(/Checking for your transfer/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('announces the credit with its amount and offers the purchase resume CTA', () => {
    const onReturnToPurchase = vi.fn();

    render(
      <WalletFundingCheckStatus
        creditedAmount={5000}
        onCheck={vi.fn()}
        onReturnToPurchase={onReturnToPurchase}
        status="credited"
      />
    );

    expect(screen.getByText(/topped up/i)).toBeInTheDocument();
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Return to your purchase/i })
    ).toBeInTheDocument();
  });

  it('disables the resume CTA until the refreshed wallet reflects the credit', () => {
    const onReturnToPurchase = vi.fn();

    render(
      <WalletFundingCheckStatus
        creditedAmount={5000}
        onCheck={vi.fn()}
        onReturnToPurchase={onReturnToPurchase}
        returnReady={false}
        status="credited"
      />
    );

    // The button is present (so the customer sees it is coming) but disabled,
    // so a click cannot return them to a checkout that still reads insufficient.
    expect(
      screen.getByRole('button', { name: /Return to your purchase/i })
    ).toBeDisabled();
    expect(screen.getByText(/Updating your balance/i)).toBeInTheDocument();
  });

  it('enables the resume CTA once the refreshed wallet reflects the credit', () => {
    render(
      <WalletFundingCheckStatus
        creditedAmount={5000}
        onCheck={vi.fn()}
        onReturnToPurchase={vi.fn()}
        returnReady={true}
        status="credited"
      />
    );

    expect(
      screen.getByRole('button', { name: /Return to your purchase/i })
    ).toBeEnabled();
    expect(screen.queryByText(/Updating your balance/i)).not.toBeInTheDocument();
  });

  it('omits the resume CTA where there is no purchase to return to', () => {
    render(
      <WalletFundingCheckStatus
        creditedAmount={5000}
        onCheck={vi.fn()}
        status="credited"
      />
    );

    expect(
      screen.queryByRole('button', { name: /Return to your purchase/i })
    ).not.toBeInTheDocument();
  });

  it('never claims the money arrived on a timeout — it offers "check again"', async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn();

    render(
      <WalletFundingCheckStatus
        creditedAmount={null}
        onCheck={onCheck}
        status="timed_out"
      />
    );

    expect(screen.getByText(/haven't seen your transfer yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/topped up/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Check again/i }));
    expect(onCheck).toHaveBeenCalledTimes(1);
  });
});
