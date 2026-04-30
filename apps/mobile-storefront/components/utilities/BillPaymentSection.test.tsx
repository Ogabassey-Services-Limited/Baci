import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import type { useUtilityPayment } from '@/hooks/use-utility-payment';
import { BillPaymentSection } from './BillPaymentSection';

jest.mock('./UtilityPaymentOptions', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    UtilityPaymentOptions: () =>
      React.createElement(Text, null, 'Payment options'),
  };
});

type PaymentState = ReturnType<typeof useUtilityPayment>;

function createPaymentState(): PaymentState {
  return {
    cards: [],
    isLoadingCards: false,
    refetchCards: jest.fn<PaymentState['refetchCards']>(),
    selectGateway: jest.fn(),
    selectSavedCard: jest.fn(),
    selectedGateway: 'paystack',
    selectedSavedCardId: null,
    supportedGateways: ['paystack'],
  };
}

describe('BillPaymentSection', () => {
  it('sanitizes editable amount input', () => {
    const setAmount = jest.fn();

    render(
      <BillPaymentSection
        colors={Colors.light}
        formattedAmount="1,000"
        handlePaymentLayout={jest.fn()}
        isFixedAmount={false}
        numericAmount={1000}
        payment={createPaymentState()}
        setAmount={setAmount}
      />
    );

    fireEvent.changeText(
      screen.getByLabelText('Payment amount'),
      '₦1,2.3a456'
    );

    expect(setAmount).toHaveBeenCalledWith('12.34');
    fireEvent.changeText(screen.getByLabelText('Payment amount'), '.');
    expect(setAmount).toHaveBeenLastCalledWith('');
    fireEvent.changeText(screen.getByLabelText('Payment amount'), '12.');
    expect(setAmount).toHaveBeenLastCalledWith('12.');
  });

  it('renders payment options', () => {
    render(
      <BillPaymentSection
        colors={Colors.light}
        formattedAmount="1,000"
        handlePaymentLayout={jest.fn()}
        isFixedAmount={false}
        numericAmount={1000}
        payment={createPaymentState()}
        setAmount={jest.fn()}
      />
    );

    expect(screen.getByText('Payment options')).toBeOnTheScreen();
  });

  it('marks fixed amounts as read-only', () => {
    render(
      <BillPaymentSection
        colors={Colors.light}
        formattedAmount="2,500"
        handlePaymentLayout={jest.fn()}
        isFixedAmount={true}
        numericAmount={2500}
        payment={createPaymentState()}
        setAmount={jest.fn()}
      />
    );

    expect(screen.getByLabelText('Payment amount read-only')).toHaveProp(
      'editable',
      false
    );
  });
});
