import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { ImeiInsufficientBalanceCta } from './imei-insufficient-balance-cta';

jest.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

describe('ImeiInsufficientBalanceCta', () => {
  it('renders the required top-up delta and calls onTopUp', () => {
    const onTopUp = jest.fn();

    render(
      <ImeiInsufficientBalanceCta
        balance={500}
        colors={Colors.light}
        requiredAmount={1500}
        onTopUp={onTopUp}
      />
    );

    expect(screen.getByText('Wallet balance: ₦500')).toBeTruthy();
    expect(
      screen.getByText('Top up ₦1,000 to run this IMEI lookup.')
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Top up wallet'));

    expect(onTopUp).toHaveBeenCalledWith(1000);
  });

  it('does not call onTopUp when the computed top-up delta is non-positive', () => {
    const onTopUp = jest.fn();

    render(
      <ImeiInsufficientBalanceCta
        balance={1500}
        colors={Colors.light}
        requiredAmount={1500}
        onTopUp={onTopUp}
      />
    );

    expect(screen.getByText('Top up ₦0 to run this IMEI lookup.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Top up wallet'));

    expect(onTopUp).not.toHaveBeenCalled();
  });
});
