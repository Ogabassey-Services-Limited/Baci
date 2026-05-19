jest.mock('@/components/checkout/CheckoutStepper', () => ({
  CheckoutStepper: ({ step }: { step: string }) => {
    const { Text } = require('react-native');
    return <Text accessibilityLabel="checkout-step">step:{step}</Text>;
  },
}));

jest.mock('@/components/checkout/DeliveryMethodCard', () => ({
  DeliveryMethodCard: ({
    onSelectMethod,
  }: {
    onSelectMethod: (method: 'door' | 'pickup_station' | 'airport') => void;
  }) => {
    const { Pressable, Text, View } = require('react-native');
    return (
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select pickup station"
          onPress={() => onSelectMethod('pickup_station')}
        >
          <Text>Pickup Station</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('@/components/checkout/PickupStationCard', () => ({
  AIRPORT_DELIVERY_FEE: 0,
  PICKUP_STATION_ADDRESS_LINES: ['No. 5 Example Plaza'],
  PICKUP_STATION_CITY: 'Lagos',
  PICKUP_STATION_STATE: 'Lagos',
  PickupStationCard: () => {
    const { Text } = require('react-native');
    return <Text>Pickup station card</Text>;
  },
}));

jest.mock('@/components/checkout/ShippingQuotesCard', () => ({
  ShippingQuotesCard: () => {
    const { Text } = require('react-native');
    return <Text>Shipping quotes card</Text>;
  },
}));

jest.mock('@/components/checkout/CryptoSelectionModal', () => ({
  CryptoSelectionModal: () => null,
}));

jest.mock('@/components/checkout/DeliveryNotesCard', () => ({
  DeliveryNotesCard: ({ children }: { children: unknown }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/components/checkout/PaymentMethodSelector', () => ({
  PaymentMethodSelector: () => {
    const { Text } = require('react-native');
    return <Text>Payment methods selector</Text>;
  },
}));

jest.mock('@/components/ui/AddressAutocomplete', () => ({
  AddressAutocomplete: ({
    value,
    onChangeText,
  }: {
    value: string;
    onChangeText: (value: string) => void;
  }) => {
    const { TextInput } = require('react-native');
    return (
      <TextInput
        placeholder="Start typing your address..."
        value={value}
        onChangeText={onChangeText}
      />
    );
  },
}));

jest.mock('@/components/ui/PhoneInput', () => ({
  PhoneInput: ({
    value,
    onBlur,
    onChangeText,
  }: {
    value: string;
    onBlur: () => void;
    onChangeText: (value: string) => void;
  }) => {
    const { TextInput } = require('react-native');
    return (
      <TextInput
        placeholder="e.g. 08012345678"
        value={value}
        onBlur={onBlur}
        onChangeText={onChangeText}
      />
    );
  },
}));
