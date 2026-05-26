import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type React from 'react';
import BankTransferScreen from '@/app/bank-transfer';

const mockClearCart = jest.fn();
let mockSearchParams: Record<string, string> = {
  accountName: 'Baci Store',
  accountNumber: '1234567890',
  amount: '250000',
  bankName: 'Test Bank',
  orderId: 'order-123',
  orderNumber: 'ORD-123',
  reference: 'dva-ref-123',
  trackingToken: 'track-token-123',
};

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  router: {
    back: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({
    children,
  }: {
    children?: React.ReactNode;
  }) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');

    return <View>{children}</View>;
  },
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/lib/clipboard', () => ({
  setClipboardString: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/stores/cart-store', () => ({
  useCartStore: (selector: (state: { clearCart: () => void }) => unknown) =>
    selector({ clearCart: mockClearCart }),
}));

describe('BankTransferScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {
      accountName: 'Baci Store',
      accountNumber: '1234567890',
      amount: '250000',
      bankName: 'Test Bank',
      orderId: 'order-123',
      orderNumber: 'ORD-123',
      reference: 'dva-ref-123',
      trackingToken: 'track-token-123',
    };
  });

  it('preserves tracking token when routing to order success', () => {
    render(<BankTransferScreen />);

    fireEvent.press(
      screen.getByRole('button', { name: "Confirm I've sent the money" })
    );

    expect(mockClearCart).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/order-success',
      params: {
        orderId: 'order-123',
        orderNumber: 'ORD-123',
        paymentMethod: 'bank_transfer',
        trackingToken: 'track-token-123',
      },
    });
  });

  it('omits tracking token when routing order success without a token', () => {
    mockSearchParams = {
      accountName: 'Baci Store',
      accountNumber: '1234567890',
      amount: '250000',
      bankName: 'Test Bank',
      orderId: 'order-123',
      orderNumber: 'ORD-123',
      reference: 'dva-ref-123',
    };

    render(<BankTransferScreen />);

    fireEvent.press(
      screen.getByRole('button', { name: "Confirm I've sent the money" })
    );

    expect(mockClearCart).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/order-success',
      params: {
        orderId: 'order-123',
        orderNumber: 'ORD-123',
        paymentMethod: 'bank_transfer',
      },
    });
  });
});
