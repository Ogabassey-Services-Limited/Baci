import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import type { useUtilityPayment } from '@/hooks/use-utility-payment';
import { BillPaymentSection } from './BillPaymentSection';

jest.mock('./UtilityPaymentOptions', () => ({
  UtilityPaymentOptions: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(Text, null, 'Payment options');
  },
}));

type PaymentState = ReturnType<typeof useUtilityPayment>;

function createPaymentState(): PaymentState {
  return {
    cards: [],
    chargeSavedVtuCard: jest.fn(),
    initializeVtuCheckout: jest.fn(),
    isChargingSavedCard: false,
    isInitializingCheckout: false,
    isLoadingCards: false,
    requiresSavedVtuCardAuthorization: false,
    savedCardsError: null,
    selectGateway: jest.fn(),
    selectSavedCard: jest.fn(),
    selectedGateway: 'paystack',
    selectedSavedCardId: null,
    supportedGateways: ['paystack'],
  } as unknown as PaymentState;
}

describe('BillPaymentSection', () => {
  it('sanitizes editable amount input and renders payment options', () => {
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

    fireEvent.changeText(screen.getByLabelText('Payment amount'), '₦1,2.3a4');

    expect(setAmount).toHaveBeenCalledWith('12.34');
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

    expect(screen.getByLabelText('Payment amount read-only').props.editable).toBe(
      false
    );
  });
});
