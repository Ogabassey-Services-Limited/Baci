import { fireEvent, render, screen } from '@testing-library/react-native';
import { UtilityPaymentOptions } from '@/components/utilities/UtilityPaymentOptions';

const mockOnSelectGateway = jest.fn();
const mockOnSelectSavedCard = jest.fn();

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@/components/checkout/PaymentMethodSelector', () => ({
  PaymentMethodSelector: ({
    onSelectMethod,
  }: {
    onSelectMethod: (method: 'paystack' | 'korapay') => void;
  }) => {
    const { Pressable, Text, View } =
      jest.requireActual<typeof import('react-native')>('react-native');

    return (
      <View>
        <Pressable onPress={() => onSelectMethod('paystack')}>
          <Text>Pay with Card</Text>
        </Pressable>
        <Pressable onPress={() => onSelectMethod('korapay')}>
          <Text>Pay with Korapay</Text>
        </Pressable>
      </View>
    );
  },
}));

describe('UtilityPaymentOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders saved cards and notifies when one is selected', () => {
    render(
      <UtilityPaymentOptions
        amount={1000}
        cards={[
          {
            id: 'card-1',
            provider: 'paystack',
            label: 'Access Bank ending 1234',
            brand: 'visa',
            bank: 'Access Bank',
            last4: '1234',
            exp_month: '08',
            exp_year: '2030',
            is_default: true,
          },
        ]}
        isLoadingCards={false}
        onSelectGateway={mockOnSelectGateway}
        onSelectSavedCard={mockOnSelectSavedCard}
        selectedGateway="paystack"
        selectedSavedCardId={null}
        supportedGateways={['paystack', 'korapay']}
      />
    );

    fireEvent.press(screen.getByText('Access Bank ending 1234'));

    expect(screen.getByText('Default')).toBeTruthy();
    expect(mockOnSelectSavedCard).toHaveBeenCalledWith('card-1');
  });

  it('passes gateway selections through to the parent', () => {
    render(
      <UtilityPaymentOptions
        amount={1000}
        cards={[]}
        isLoadingCards={false}
        onSelectGateway={mockOnSelectGateway}
        onSelectSavedCard={mockOnSelectSavedCard}
        selectedGateway="paystack"
        selectedSavedCardId={null}
        supportedGateways={['paystack', 'korapay']}
      />
    );

    fireEvent.press(screen.getByText('Pay with Korapay'));
    expect(mockOnSelectGateway).toHaveBeenCalledWith('korapay');
  });
});
