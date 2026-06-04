import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BillPaymentCustomerIdentifier } from './BillPaymentCustomerIdentifier';

describe('BillPaymentCustomerIdentifier', () => {
  it('renders identifier copy and sends changes upstream', () => {
    const onCustomerIdChange = vi.fn();
    const onVerify = vi.fn();

    render(
      <BillPaymentCustomerIdentifier
        customerId=""
        isVerifyDisabled={false}
        label="Smart Card Number"
        onCustomerIdChange={onCustomerIdChange}
        onVerify={onVerify}
        placeholder="Enter smart card number"
        verifying={false}
      />
    );

    fireEvent.change(
      screen.getByRole('textbox', { name: /Smart Card Number/i }),
      {
        target: { value: '1234567890' },
      }
    );
    fireEvent.click(screen.getByRole('button', { name: /Verify/i }));

    expect(screen.getByText('Smart Card Number')).toBeInTheDocument();
    expect(onCustomerIdChange).toHaveBeenCalledWith('1234567890');
    expect(onVerify).toHaveBeenCalledTimes(1);
  });

  it('disables verification while a request is in flight', () => {
    render(
      <BillPaymentCustomerIdentifier
        customerId="1234567890"
        isVerifyDisabled={false}
        label="Meter Number"
        onCustomerIdChange={vi.fn()}
        onVerify={vi.fn()}
        placeholder="Enter meter number"
        verifying={true}
      />
    );

    expect(screen.getByRole('button', { name: /Verify/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Verify/i })).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });

  it('disables verification when the identifier is incomplete', () => {
    render(
      <BillPaymentCustomerIdentifier
        customerId=""
        isVerifyDisabled={true}
        label="Meter Number"
        onCustomerIdChange={vi.fn()}
        onVerify={vi.fn()}
        placeholder="Enter meter number"
        verifying={false}
      />
    );

    expect(screen.getByRole('button', { name: /Verify/i })).toBeDisabled();
  });
});
