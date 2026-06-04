import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BillPaymentCheckoutActions } from './BillPaymentCheckoutActions';

describe('BillPaymentCheckoutActions', () => {
  it('renders verified amount controls and pay button', () => {
    const onAmountChange = vi.fn();

    render(
      <form>
        <BillPaymentCheckoutActions
          amount="5000"
          isFixedAmount={false}
          isVerificationCurrent={true}
          loading={false}
          onAmountChange={onAmountChange}
          verification={{
            verified: true,
            customerName: 'Ada Buyer',
            inputKey: 'current',
          }}
          verifying={false}
        />
      </form>
    );

    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '6000' },
    });

    expect(screen.getByText('Ada Buyer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pay ₦5,000/i })).toBeEnabled();
    expect(onAmountChange).toHaveBeenCalledWith('6000');
  });

  it('hides payment controls for stale verification results', () => {
    render(
      <BillPaymentCheckoutActions
        amount="5000"
        isFixedAmount={false}
        isVerificationCurrent={false}
        loading={false}
        onAmountChange={vi.fn()}
        verification={{
          verified: true,
          customerName: 'Ada Buyer',
          inputKey: 'stale',
        }}
        verifying={false}
      />
    );

    expect(screen.getByText('Ada Buyer')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('0.00')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pay/i })).toBeNull();
  });
});
