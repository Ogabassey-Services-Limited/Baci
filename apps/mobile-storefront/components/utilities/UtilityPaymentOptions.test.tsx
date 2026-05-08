import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { UtilityPaymentOptions } from '@/components/utilities/UtilityPaymentOptions';
import type { SavedVtuCard } from '@/lib/vtu-checkout';

const mockOnSelectGateway = jest.fn();
const mockOnSelectSavedCard = jest.fn();

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

// Capture the props PaymentMethodSelector receives so the wallet
// gating test can assert exactly what UtilityPaymentOptions forwards.
const lastSelectorProps: { current: Record<string, unknown> | null } = {
  current: null,
};

const mockSavedCard: SavedVtuCard = {
  id: 'card-1',
  provider: 'paystack',
  label: 'Access Bank ending 1234',
  brand: 'visa',
  bank: 'Access Bank',
  last4: '1234',
  exp_month: '08',
  exp_year: '2030',
  is_default: true,
};

jest.mock('@/components/checkout/PaymentMethodSelector', () => ({
  PaymentMethodSelector: (props: {
    enabledMethods?: Array<'paystack' | 'korapay' | 'bank_transfer'>;
    methodBadgeOverrides?: Record<string, string>;
    methodDescriptionOverrides?: Record<string, string>;
    methodLabelOverrides?: Record<string, string>;
    onSelectMethod: (method: 'paystack' | 'korapay' | 'bank_transfer') => void;
  }) => {
    lastSelectorProps.current = props as unknown as Record<string, unknown>;
    const { Pressable, Text, View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    const enabledMethods = props.enabledMethods ?? ['paystack', 'korapay'];
    const labelFor = (method: 'paystack' | 'bank_transfer') =>
      props.methodLabelOverrides?.[method] ??
      (method === 'paystack' ? 'Pay with Card' : 'Bank Transfer');

    return (
      <View>
        {enabledMethods.includes('paystack') ? (
          <Pressable onPress={() => props.onSelectMethod('paystack')}>
            <Text>{labelFor('paystack')}</Text>
            {props.methodDescriptionOverrides?.paystack ? (
              <Text>{props.methodDescriptionOverrides.paystack}</Text>
            ) : null}
            {props.methodBadgeOverrides?.paystack ? (
              <Text>{props.methodBadgeOverrides.paystack}</Text>
            ) : null}
          </Pressable>
        ) : null}
        {enabledMethods.includes('bank_transfer') ? (
          <Pressable onPress={() => props.onSelectMethod('bank_transfer')}>
            <Text>{labelFor('bank_transfer')}</Text>
          </Pressable>
        ) : null}
        {enabledMethods.includes('korapay') ? (
          <Pressable onPress={() => props.onSelectMethod('korapay')}>
            <Text>Pay with Korapay</Text>
          </Pressable>
        ) : null}
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
        cards={[mockSavedCard]}
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

  it('marks the selected saved card and makes the generic Paystack row an alternate card option', () => {
    render(
      <UtilityPaymentOptions
        amount={1000}
        cards={[mockSavedCard]}
        isLoadingCards={false}
        onSelectGateway={mockOnSelectGateway}
        onSelectSavedCard={mockOnSelectSavedCard}
        selectedGateway="paystack"
        selectedSavedCardId="card-1"
        supportedGateways={['paystack', 'korapay']}
      />
    );

    const selectedSavedCard = screen.getByLabelText(
      'Access Bank ending 1234. Expires 08/2030'
    );

    expect(selectedSavedCard.props.accessibilityRole).toBe('radio');
    expect(selectedSavedCard.props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(lastSelectorProps.current).toMatchObject({
      suppressedSelectedMethods: ['paystack'],
      methodLabelOverrides: {
        bank_transfer: 'Pay with Bank Transfer',
        paystack: 'Use another card',
      },
    });
  });

  it('does not mark a saved card selected while full-wallet payment is active', () => {
    const onWalletToggle = jest.fn();

    render(
      <UtilityPaymentOptions
        amount={1000}
        cards={[mockSavedCard]}
        isLoadingCards={false}
        onSelectGateway={mockOnSelectGateway}
        onSelectSavedCard={mockOnSelectSavedCard}
        selectedGateway="paystack"
        selectedSavedCardId="card-1"
        supportedGateways={['paystack', 'korapay']}
        walletBalance={1500}
        walletSelection={{ use: true, amount: 1000 }}
        onWalletToggle={onWalletToggle}
      />
    );

    const savedCard = screen.getByLabelText(
      'Access Bank ending 1234. Expires 08/2030'
    );

    expect(savedCard.props.accessibilityState).toMatchObject({
      checked: false,
    });
    expect(lastSelectorProps.current?.suppressedSelectedMethods).toBeUndefined();

    fireEvent.press(savedCard);

    expect(onWalletToggle).toHaveBeenCalledWith({ amount: 0, use: false });
    expect(mockOnSelectSavedCard).toHaveBeenCalledWith('card-1');
  });

  it('keeps a saved card selected when wallet credit only covers part of the bill', () => {
    render(
      <UtilityPaymentOptions
        amount={1000}
        cards={[mockSavedCard]}
        isLoadingCards={false}
        onSelectGateway={mockOnSelectGateway}
        onSelectSavedCard={mockOnSelectSavedCard}
        selectedGateway="paystack"
        selectedSavedCardId="card-1"
        supportedGateways={['paystack', 'korapay']}
        walletBalance={500}
        walletSelection={{ use: true, amount: 500 }}
        onWalletToggle={jest.fn()}
      />
    );

    const savedCard = screen.getByLabelText(
      'Access Bank ending 1234. Expires 08/2030'
    );

    expect(savedCard.props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(lastSelectorProps.current).toMatchObject({
      suppressedSelectedMethods: ['paystack'],
    });
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

  it('shows card and bank transfer options with Paystack trust and card cashback copy', () => {
    render(
      <UtilityPaymentOptions
        amount={1000}
        cards={[]}
        isLoadingCards={false}
        onSelectGateway={mockOnSelectGateway}
        onSelectSavedCard={mockOnSelectSavedCard}
        selectedGateway="paystack"
        selectedSavedCardId={null}
        supportedGateways={['paystack', 'bank_transfer']}
      />
    );

    expect(screen.getByText('Pay with Card')).toBeTruthy();
    expect(screen.getByText('Pay with Bank Transfer')).toBeTruthy();
    expect(screen.getByText(/Secured by/i)).toBeTruthy();
    expect(screen.getByText('Paystack')).toBeTruthy();
    expect(
      screen.getByText('2x cashback on your first card payment')
    ).toBeTruthy();
    expect(screen.getByText('2x cashback')).toBeTruthy();
  });

  // Phase B.8 — wallet gating contract. The shared selector treats
  // `walletMode='off'` as a hard gate; UtilityPaymentOptions opts in
  // by passing 'vtu' ONLY when `onWalletToggle` is provided. Pin
  // both directions so a future caller that omits onWalletToggle
  // doesn't accidentally surface the wallet row in VTU.

  it("forwards walletMode='vtu' and the wallet props when onWalletToggle is provided", () => {
    const onWalletToggle = jest.fn();
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
        walletBalance={500}
        walletSelection={{ use: true, amount: 500 }}
        onWalletToggle={onWalletToggle}
      />
    );

    expect(lastSelectorProps.current).toMatchObject({
      walletMode: 'vtu',
      walletBalance: 500,
      walletOrderTotal: 1000,
      walletSelection: { use: true, amount: 500 },
      onWalletToggle,
    });
  });

  it("defaults to walletMode='off' when onWalletToggle is not provided", () => {
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

    expect(lastSelectorProps.current).toMatchObject({ walletMode: 'off' });
  });
});
