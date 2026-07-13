import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RateFeeFields } from './rate-fee-fields';

type RateFeeFieldsProps = Parameters<typeof RateFeeFields>[0];

function renderFields(overrides: Partial<RateFeeFieldsProps> = {}) {
  const props: RateFeeFieldsProps = {
    freeOverAmount: '',
    onFreeOverAmountChange: vi.fn(),
    deliveryMinDays: '',
    onDeliveryMinDaysChange: vi.fn(),
    deliveryMaxDays: '',
    onDeliveryMaxDaysChange: vi.fn(),
    currencySymbol: '₦',
    ...overrides,
  };
  render(<RateFeeFields {...props} />);
  return props;
}

describe('RateFeeFields', () => {
  it('shows the currency symbol in the free-over label', () => {
    renderFields({ currencySymbol: '$' });

    expect(
      screen.getByLabelText(/free when order total is over \(\$\)/i)
    ).toBeInTheDocument();
  });

  it('renders existing values in each field', () => {
    renderFields({
      freeOverAmount: '50000',
      deliveryMinDays: '2',
      deliveryMaxDays: '4',
    });

    expect(screen.getByLabelText(/free when order total is over/i)).toHaveValue(
      50_000
    );
    expect(screen.getByLabelText(/delivery days \(min\)/i)).toHaveValue(2);
    expect(screen.getByLabelText(/delivery days \(max\)/i)).toHaveValue(4);
  });

  it('constrains the delivery-day inputs to a minimum of 1 day', () => {
    renderFields();

    expect(screen.getByLabelText(/delivery days \(min\)/i)).toHaveAttribute(
      'min',
      '1'
    );
    expect(screen.getByLabelText(/delivery days \(max\)/i)).toHaveAttribute(
      'min',
      '1'
    );
  });

  it('reports edits through each change callback', () => {
    const props = renderFields();

    fireEvent.change(screen.getByLabelText(/free when order total is over/i), {
      target: { value: '25000' },
    });
    fireEvent.change(screen.getByLabelText(/delivery days \(min\)/i), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText(/delivery days \(max\)/i), {
      target: { value: '3' },
    });

    expect(props.onFreeOverAmountChange).toHaveBeenCalledWith('25000');
    expect(props.onDeliveryMinDaysChange).toHaveBeenCalledWith('1');
    expect(props.onDeliveryMaxDaysChange).toHaveBeenCalledWith('3');
  });
});
