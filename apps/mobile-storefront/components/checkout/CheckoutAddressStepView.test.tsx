import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import type { ComponentProps, ReactNode } from 'react';
import { CheckoutAddressStepView } from './CheckoutAddressStepView';
import type { ShippingQuote } from './types';

const mockDeliveryMethodCard = jest.fn();
const mockShippingQuotesCard = jest.fn();

jest.mock('@/components/checkout/CheckoutContactCard', () => ({
  CheckoutContactCard: () => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>contact card</Text>;
  },
}));

jest.mock('@/components/checkout/CheckoutDeliveryCard', () => ({
  CheckoutDeliveryCard: () => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>delivery card</Text>;
  },
}));

jest.mock('@/components/checkout/CheckoutFormField', () => ({
  CheckoutFormField: () => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>notes field</Text>;
  },
}));

jest.mock('@/components/checkout/DeliveryMethodCard', () => ({
  DeliveryMethodCard: (
    props: Record<string, unknown> & { children?: ReactNode }
  ) => {
    const { Text, View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    mockDeliveryMethodCard(props);
    return (
      <View>
        <Text>delivery method card</Text>
        {props.children}
      </View>
    );
  },
}));

jest.mock('@/components/checkout/DeliveryNotesCard', () => ({
  DeliveryNotesCard: ({ children }: { children: ReactNode }) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/components/checkout/PickupStationCard', () => ({
  PickupStationCard: () => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>pickup card</Text>;
  },
}));

jest.mock('@/components/checkout/ShippingQuotesCard', () => ({
  ShippingQuotesCard: (props: Record<string, unknown>) => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    mockShippingQuotesCard(props);
    return <Text>shipping quotes card</Text>;
  },
}));

type AddressStepProps = ComponentProps<typeof CheckoutAddressStepView>;

const colors = {
  background: '#ffffff',
  border: '#e5e7eb',
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
} as unknown as AddressStepProps['colors'];

const doorQuote: ShippingQuote = {
  displayName: 'Topship Door Delivery',
  id: 'door-quote',
  price: 10_000,
  provider: 'Topship',
};

const stationQuote: ShippingQuote = {
  displayName: 'GIG Logistics - Pickup at PORT HARCOURT',
  id: 'station-quote',
  isStationPickup: true,
  price: 9493,
  provider: 'GIGL',
  stationAddress: 'GIGL Aba Road, Port Harcourt',
  stationName: 'PORT HARCOURT',
};
const goFasterQuote: ShippingQuote = {
  displayName: 'GIG Logistics - GoFaster',
  id: 'gofaster-quote',
  price: 18_500,
  provider: 'GIGL',
  serviceTier: 'GoFaster',
};

function createProps(
  overrides: Partial<AddressStepProps> = {}
): AddressStepProps {
  return {
    accountPassword: '',
    addressScrollOffsetRef: { current: 0 },
    addressScrollRef: { current: null },
    colors,
    contactSummary: 'Ada Lovelace',
    control: {} as AddressStepProps['control'],
    currentDeliverySummary: '5 Customer Street',
    defaultSavedAddress: null,
    deliveryMethod: 'door',
    errors: {},
    formContentPaddingBottom: 32,
    hasContactIdentity: true,
    hasSavedAddresses: false,
    isAddingNewAddress: false,
    isAuthenticated: true,
    isContactCollapsed: true,
    isDark: false,
    isDeliveryCollapsed: false,
    isLoadingCities: false,
    isLoadingLocations: false,
    isLoadingQuotes: false,
    isLoadingSavedAddresses: false,
    onAddressSelected: jest.fn() as AddressStepProps['onAddressSelected'],
    onAddressTextChanged: jest.fn() as AddressStepProps['onAddressTextChanged'],
    onChangeAccountPassword: jest.fn(),
    onOpenCityPicker: jest.fn(),
    onOpenNewAddressEditor: jest.fn(),
    onOpenStatePicker: jest.fn(),
    onRetryQuotes: jest.fn(),
    onSelectDeliveryMethod: jest.fn(),
    onSelectQuote: jest.fn(),
    onToggleContactCollapsed: jest.fn(),
    onToggleDeliveryCollapsed: jest.fn(),
    onToggleSaveAsDefaultAddress: jest.fn(),
    onToggleSaveDetails: jest.fn(),
    onUseSavedAddress: jest.fn() as AddressStepProps['onUseSavedAddress'],
    phone: '08012345678',
    saveAsDefaultAddress: false,
    saveDetails: false,
    savedAddresses: [],
    selectedQuote: doorQuote,
    selectedQuoteId: 'door-quote',
    selectedSavedAddress: null,
    selectedSavedAddressId: null,
    shippingQuotes: [doorQuote],
    watchedCity: 'Port Harcourt',
    watchedEmail: 'ada@example.com',
    watchedState: 'Rivers',
    ...overrides,
  };
}

describe('CheckoutAddressStepView station pickup quotes', () => {
  beforeEach(() => {
    mockDeliveryMethodCard.mockClear();
    mockShippingQuotesCard.mockClear();
  });

  it('keeps station-pickup quotes out of the door delivery selector', () => {
    render(
      <CheckoutAddressStepView
        {...createProps({
          selectedQuote: stationQuote,
          selectedQuoteId: 'station-quote',
          shippingQuotes: [doorQuote, stationQuote],
        })}
      />
    );

    const deliveryProps = mockDeliveryMethodCard.mock.calls[0]?.[0] as {
      doorSubtitle: string;
      pickupStationQuote?: ShippingQuote;
    };
    const quotesProps = mockShippingQuotesCard.mock.calls[0]?.[0] as {
      shippingQuotes: ShippingQuote[];
      stationPickupQuote?: ShippingQuote;
    };

    expect(deliveryProps.doorSubtitle).toBe(
      'Rates loaded after you enter your address'
    );
    expect(deliveryProps.pickupStationQuote).toBe(stationQuote);
    expect(quotesProps.shippingQuotes).toEqual([doorQuote]);
    expect(quotesProps.stationPickupQuote).toBe(stationQuote);
  });

  it('passes selected door quote details through the door delivery option', () => {
    render(<CheckoutAddressStepView {...createProps()} />);

    const deliveryProps = mockDeliveryMethodCard.mock.calls[0]?.[0] as {
      deliveryCity: string;
      doorSubtitle: string;
      pickupStationQuote?: ShippingQuote;
    };
    const quotesProps = mockShippingQuotesCard.mock.calls[0]?.[0] as {
      shippingQuotes: ShippingQuote[];
    };

    expect(deliveryProps.doorSubtitle).toBe(
      'Topship • Delivery estimate shown after selection'
    );
    expect(deliveryProps.deliveryCity).toBe('Port Harcourt');
    expect(deliveryProps.pickupStationQuote).toBeUndefined();
    expect(quotesProps.shippingQuotes).toEqual([doorQuote]);
  });

  it('shows GoStandard under Road and GoFaster beside the local Air option', () => {
    const { rerender } = render(
      <CheckoutAddressStepView
        {...createProps({ shippingQuotes: [doorQuote, goFasterQuote] })}
      />
    );

    let quotesProps = mockShippingQuotesCard.mock.calls.at(-1)?.[0] as {
      shippingQuotes: ShippingQuote[];
    };
    expect(quotesProps.shippingQuotes).toEqual([doorQuote]);

    rerender(
      <CheckoutAddressStepView
        {...createProps({
          deliveryMethod: 'airport',
          selectedQuote: goFasterQuote,
          selectedQuoteId: 'gofaster-quote',
          shippingQuotes: [doorQuote, goFasterQuote],
        })}
      />
    );

    quotesProps = mockShippingQuotesCard.mock.calls.at(-1)?.[0] as {
      shippingQuotes: ShippingQuote[];
    };
    expect(quotesProps.shippingQuotes.map((quote) => quote.id)).toEqual([
      'airport-delivery',
      'gofaster-quote',
    ]);
  });

  it('handles empty quotes and an undefined selected quote safely', () => {
    render(
      <CheckoutAddressStepView
        {...createProps({
          selectedQuote: undefined,
          selectedQuoteId: '',
          shippingQuotes: [],
        })}
      />
    );

    const deliveryProps = mockDeliveryMethodCard.mock.calls[0]?.[0] as {
      pickupStationQuote?: ShippingQuote;
    };
    const quotesProps = mockShippingQuotesCard.mock.calls[0]?.[0] as {
      shippingQuotes: ShippingQuote[];
    };

    expect(deliveryProps.pickupStationQuote).toBeUndefined();
    expect(quotesProps.shippingQuotes).toEqual([]);
  });

  it('renders quote selection instead of the merchant pickup card for non-Lagos pickup stations', () => {
    const screen = render(
      <CheckoutAddressStepView
        {...createProps({
          deliveryMethod: 'pickup_station',
          selectedQuote: undefined,
          selectedQuoteId: '',
          shippingQuotes: [],
          watchedCity: 'Port Harcourt',
          watchedState: 'Rivers',
        })}
      />
    );

    expect(screen.getByText('shipping quotes card')).toBeTruthy();
    const quotesProps = mockShippingQuotesCard.mock.calls[0]?.[0] as {
      shippingQuotes: ShippingQuote[];
    };
    expect(quotesProps.shippingQuotes).toEqual([]);
  });

  it('keeps Lagos free pickup inside the delivery methods card', () => {
    const screen = render(
      <CheckoutAddressStepView
        {...createProps({
          deliveryMethod: 'pickup_station',
          selectedQuote: undefined,
          selectedQuoteId: '',
          shippingQuotes: [],
          watchedCity: 'Ikeja',
          watchedState: 'Lagos',
        })}
      />
    );

    expect(screen.getByText('delivery method card')).toBeTruthy();
    expect(mockShippingQuotesCard).not.toHaveBeenCalled();
  });

  it('waits for a resolved delivery state and city before showing delivery methods', () => {
    const screen = render(
      <CheckoutAddressStepView
        {...createProps({
          selectedQuote: undefined,
          selectedQuoteId: '',
          shippingQuotes: [],
          watchedCity: '',
          watchedState: '',
        })}
      />
    );

    expect(screen.queryByText('delivery method card')).toBeNull();
    expect(mockDeliveryMethodCard).not.toHaveBeenCalled();
    expect(mockShippingQuotesCard).not.toHaveBeenCalled();
  });
});
