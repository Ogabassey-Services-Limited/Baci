import type { ReactNode } from 'react';
import type { Control, FieldValues } from 'react-hook-form';

jest.mock('@/components/checkout/CheckoutStepper', () => ({
  CheckoutStepper: ({ step }: { step: string }) => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text accessibilityLabel="checkout-step">step:{step}</Text>;
  },
}));

jest.mock('@/components/checkout/CheckoutDeliveryLocationPicker', () => ({
  CheckoutDeliveryLocationPicker: ({
    control,
    label,
    valueName,
  }: {
    control: Control<FieldValues>;
    label: 'City' | 'State';
    valueName: 'city' | 'state';
  }) => {
    const { Pressable, Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    const { Controller } =
      jest.requireActual<typeof import('react-hook-form')>('react-hook-form');
    const selectedValue = label === 'State' ? 'Lagos' : 'Ikeja';
    return (
      <Controller
        control={control}
        name={valueName}
        render={({
          field: { onChange, value },
        }: {
          field: { onChange: (value: string) => void; value: string };
        }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mock select ${label}`}
            onPress={() => onChange(selectedValue)}
          >
            <Text>{value || `Select ${label.toLowerCase()}`}</Text>
          </Pressable>
        )}
      />
    );
  },
}));

jest.mock('@/components/checkout/DeliveryMethodCard', () => ({
  DeliveryMethodCard: ({
    onSelectMethod,
  }: {
    onSelectMethod: (method: 'door' | 'pickup_station' | 'airport') => void;
  }) => {
    const { Pressable, Text, View } =
      jest.requireActual<typeof import('react-native')>('react-native');
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
  PickupStationCard: () => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Pickup station card</Text>;
  },
}));

jest.mock('@/components/checkout/pickup-station.constants', () => ({
  PICKUP_STATION_ADDRESS_LINES: ['No. 5 Example Plaza'],
  PICKUP_STATION_CITY: 'Lagos',
  PICKUP_STATION_STATE: 'Lagos',
}));

jest.mock('@/components/checkout/ShippingQuotesCard', () => ({
  ShippingQuotesCard: () => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Shipping quotes card</Text>;
  },
}));

jest.mock('@/components/checkout/CryptoSelectionModal', () => ({
  CryptoSelectionModal: () => null,
}));

jest.mock('@/components/storefront/PatternedBackground', () => ({
  PatternedBackground: ({ backgroundColor }: { backgroundColor: string }) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <View style={{ backgroundColor }} testID="patterned-background" />;
  },
}));

jest.mock('@/components/checkout/DeliveryNotesCard', () => ({
  DeliveryNotesCard: ({ children }: { children: ReactNode }) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/components/checkout/PaymentMethodSelector', () => ({
  PaymentMethodSelector: (props: {
    methodDescriptionOverrides?: Record<string, string>;
    methodLabelOverrides?: Record<string, string>;
    onSelectMethod?: (method: string) => void;
    onSavingsToggle?: (selection: {
      amount: number;
      goalId: string | null;
      use: boolean;
    }) => void;
    onSelectTab?: (tab: 'full' | 'installments' | 'pay_later') => void;
    selectedMethod?: string;
    selectedTab?: string;
    savingsBalance?: number;
    savingsGoalId?: string | null;
    walletFundedBankTransferMode?: boolean;
  }) => {
    const { Pressable, Text, View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    const bankTransferLabel =
      props.methodLabelOverrides?.bank_transfer ?? 'Bank Transfer';
    const bankTransferDescription =
      props.methodDescriptionOverrides?.bank_transfer ??
      'Pay via direct bank transfer';
    return (
      <View>
        <Text>Payment methods selector</Text>
        <Text>Selected payment: {props.selectedMethod}</Text>
        <Text>Selected tab: {props.selectedTab}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mock select Paystack"
          onPress={() => {
            props.onSelectTab?.('full');
            props.onSelectMethod?.('paystack');
          }}
        >
          <Text>Paystack</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mock select Credit Direct"
          onPress={() => {
            props.onSelectTab?.('installments');
            props.onSelectMethod?.('credit_direct');
          }}
        >
          <Text>Credit Direct</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mock select Klump"
          onPress={() => {
            props.onSelectTab?.('installments');
            props.onSelectMethod?.('klump');
          }}
        >
          <Text>Klump</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mock select ${bankTransferLabel}`}
          onPress={() => {
            props.onSelectTab?.('full');
            props.onSelectMethod?.('bank_transfer');
          }}
        >
          <Text>{bankTransferLabel}</Text>
          <Text>{bankTransferDescription}</Text>
          {props.walletFundedBankTransferMode ? (
            <Text>
              We will fund your wallet and pay this order automatically.
            </Text>
          ) : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mock use checkout savings"
          onPress={() =>
            props.onSavingsToggle?.({
              amount: props.savingsBalance ?? 0,
              goalId: props.savingsGoalId ?? null,
              use: true,
            })
          }
        >
          <Text>Use savings</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mock remove checkout savings"
          onPress={() =>
            props.onSavingsToggle?.({
              amount: props.savingsBalance ?? 0,
              goalId: props.savingsGoalId ?? null,
              use: false,
            })
          }
        >
          <Text>Remove savings</Text>
        </Pressable>
      </View>
    );
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
    const { TextInput } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <TextInput
        placeholder="Start typing your address…"
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
    const { TextInput } =
      jest.requireActual<typeof import('react-native')>('react-native');
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
