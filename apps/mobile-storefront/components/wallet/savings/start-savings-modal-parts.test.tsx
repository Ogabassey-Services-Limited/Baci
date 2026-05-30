import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import {
  FundingOptionCard,
  SavedPaymentMethodCard,
  SummaryRow,
} from './start-savings-modal-parts';

describe('start savings modal parts', () => {
  it('renders and selects a funding option card', () => {
    const onPress = jest.fn();
    render(
      <FundingOptionCard
        active={false}
        colors={Colors.light}
        description="Use wallet balance"
        label="Pay with wallet balance"
        onPress={onPress}
      />
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Pay with wallet balance' })
    );

    expect(screen.getByText('Use wallet balance')).toBeOnTheScreen();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders saved payment method metadata and handles selection', () => {
    const onPress = jest.fn();
    render(
      <SavedPaymentMethodCard
        active
        colors={Colors.light}
        method={{
          bank: 'Access Bank',
          brand: 'visa',
          exp_month: '08',
          exp_year: '2030',
          id: 'card-1',
          is_default: true,
          label: 'Access Bank ending 1234',
          last4: '1234',
          provider: 'paystack',
        }}
        onPress={onPress}
      />
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Select Access Bank ending 1234' })
    );

    expect(
      screen.getByText('Access Bank · visa · •••• 1234')
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Saved payment method selected')
    ).toBeOnTheScreen();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders inactive saved payment methods without the active checkmark', () => {
    const onPress = jest.fn();
    render(
      <SavedPaymentMethodCard
        active={false}
        colors={Colors.light}
        method={{
          bank: 'GTBank',
          brand: 'mastercard',
          exp_month: '09',
          exp_year: '2031',
          id: 'card-2',
          is_default: false,
          label: 'GTBank ending 9876',
          last4: '9876',
          provider: 'paystack',
        }}
        onPress={onPress}
      />
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Select GTBank ending 9876' })
    );

    expect(screen.queryByLabelText('Saved payment method selected')).toBeNull();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('omits empty saved payment method metadata parts', () => {
    render(
      <SavedPaymentMethodCard
        active={false}
        colors={Colors.light}
        method={{
          bank: '',
          brand: '',
          exp_month: '10',
          exp_year: '2032',
          id: 'card-3',
          is_default: false,
          label: 'Saved card',
          last4: '',
          provider: 'paystack',
        }}
        onPress={jest.fn()}
      />
    );

    expect(screen.getByText('Saved card')).toBeOnTheScreen();
    expect(screen.queryByText(/·/)).toBeNull();
    expect(screen.queryByText(/••••/)).toBeNull();
  });

  it('renders summary rows', () => {
    render(
      <SummaryRow
        colors={Colors.light}
        label="Total payable"
        value="₦800,000"
      />
    );

    expect(screen.getByText('Total payable')).toBeOnTheScreen();
    expect(screen.getByText('₦800,000')).toBeOnTheScreen();
  });
});
