import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import Colors from '@/constants/Colors';
import { CryptoPaymentView } from './CryptoPaymentView';

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <View>{children}</View>;
  },
}));

describe('CryptoPaymentView', () => {
  const props = {
    address: 'TWalletAddress123',
    amount: '100000',
    chain: 'TRX',
    chainLabel: 'Tron (TRC-20)',
    colors: Colors.light,
    confirmationTime: '5 minutes',
    copiedField: null,
    countdown: 1800,
    cryptoAmount: '60.5',
    currency: 'USDT',
    error: null,
    isValid: true,
    onBack: jest.fn(),
    onCopyAddress: jest.fn(),
    onDone: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders payment details and exposes labeled payment actions', () => {
    render(<CryptoPaymentView {...props} />);

    expect(screen.getByText('60.5 USDT')).toBeTruthy();
    expect(screen.getByText('Payment expires in 30:00')).toBeTruthy();
    expect(screen.getByText('Expected confirmation: 5 minutes')).toBeTruthy();

    fireEvent.press(
      screen.getByRole('button', { name: 'Copy wallet address' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: "I've Sent the Payment" })
    );

    expect(props.onCopyAddress).toHaveBeenCalledTimes(1);
    expect(props.onDone).toHaveBeenCalledTimes(1);
  });

  it('renders invalid payment recovery and triggers its back action', () => {
    render(
      <CryptoPaymentView
        {...props}
        error="Wallet address is required"
        isValid={false}
      />
    );

    expect(screen.getByText('Invalid Payment')).toBeTruthy();
    expect(screen.getByText('Wallet address is required')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Go Back' }));

    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('announces copied addresses and hides optional payment details', () => {
    render(
      <CryptoPaymentView
        {...props}
        amount={undefined}
        confirmationTime={undefined}
        copiedField="address"
        countdown={0}
      />
    );

    expect(screen.getByText('Payment window expired')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Wallet address copied' })
    ).toBeTruthy();
    expect(screen.queryByText('Expected confirmation: 5 minutes')).toBeNull();
    expect(screen.queryByText(/NGN/)).toBeNull();
  });

  it('does not display a NaN fiat amount for invalid amount input', () => {
    render(<CryptoPaymentView {...props} amount="not-a-number" />);

    expect(screen.queryByText('NaN NGN')).toBeNull();
  });
});
