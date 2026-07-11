import { isAirportDeliveryEligible, isPickupEligible } from '@baci/shared';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  getPickupStationAddressLines,
  isProviderStationPickupQuote,
} from '@/components/checkout/checkout-station-pickup';
import { AIRPORT_QUOTE_ID } from '@/components/checkout/checkout-step-helpers';
import { ShippingQuoteRow } from '@/components/checkout/ShippingQuoteRow';
import type {
  DeliveryMethod,
  ShippingQuote,
} from '@/components/checkout/types';
import type Colors from '@/constants/Colors';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import {
  type DeliveryMethodOption,
  DeliveryMethodTabs,
} from './DeliveryMethodTabs';
import { CheckoutSectionCard } from './selection/CheckoutSectionCard';

const AIRPORT_DOORSTEP_NOTE = 'Delivery to your doorstep';
const PICKUP_HELPER_TEXT = 'Pick from a centre close to you';
const ignoreAirportQuotePress = () => undefined;

type ColorsScheme = (typeof Colors)['light'];

interface DeliveryMethodCardProps {
  colors: ColorsScheme;
  isDark: boolean;
  selectedMethod: DeliveryMethod;
  onSelectMethod: (method: DeliveryMethod) => void;
  doorSubtitle: string;
  airportFee: number;
  deliveryCity?: string | null;
  deliveryState?: string | null;
  pickupStationQuote?: ShippingQuote;
  children?: ReactNode;
}

export function DeliveryMethodCard({
  colors,
  isDark,
  selectedMethod,
  onSelectMethod,
  doorSubtitle,
  airportFee,
  deliveryCity,
  deliveryState,
  pickupStationQuote,
  children,
}: DeliveryMethodCardProps) {
  const options: DeliveryMethodOption[] = [
    {
      id: 'door',
      title: 'By Road',
      subtitle: doorSubtitle,
      helperText: AIRPORT_DOORSTEP_NOTE,
      icon: 'car-outline',
      isProviderPickup: false,
    },
  ];
  if (isAirportDeliveryEligible(deliveryState)) {
    options.push({
      id: 'airport',
      title: 'By Air',
      subtitle: AIRPORT_DOORSTEP_NOTE,
      helperText: AIRPORT_DOORSTEP_NOTE,
      icon: 'airplane-outline',
      isProviderPickup: false,
    });
  }
  const usesMerchantPickup = isPickupEligible(deliveryState);
  const providerPickupQuote = usesMerchantPickup
    ? undefined
    : pickupStationQuote;
  const canRequestProviderPickup = Boolean(deliveryState?.trim());
  if (usesMerchantPickup || providerPickupQuote || canRequestProviderPickup) {
    const hasProviderQuote = isProviderStationPickupQuote(providerPickupQuote);
    options.push({
      id: 'pickup_station',
      title: 'Pickup Station',
      subtitle: hasProviderQuote
        ? getPickupStationAddressLines(providerPickupQuote).join(', ')
        : usesMerchantPickup
          ? getPickupStationAddressLines().join(', ')
          : 'Collect from a nearby GIG Logistics service centre',
      helperText: PICKUP_HELPER_TEXT,
      icon: 'storefront-outline',
      pickupStationQuote: providerPickupQuote,
      isProviderPickup: !usesMerchantPickup,
    });
  }
  const selectedOption =
    options.find((option) => option.id === selectedMethod) ?? options[0];
  const shouldShowPickupAddress =
    selectedOption?.id === 'pickup_station' &&
    (Boolean(selectedOption.pickupStationQuote) ||
      !selectedOption.isProviderPickup);
  const pickupAddressLines = shouldShowPickupAddress
    ? getPickupStationAddressLines(selectedOption?.pickupStationQuote)
    : [];
  const [primaryPickupLine, ...secondaryPickupLines] = pickupAddressLines;
  const stationCode = selectedOption?.pickupStationQuote
    ? (selectedOption.pickupStationQuote.stationCode ??
      selectedOption.pickupStationQuote.pickupStationCode)
    : undefined;
  const helperText = selectedOption?.helperText ?? AIRPORT_DOORSTEP_NOTE;
  const airportLocation = deliveryCity?.trim() || deliveryState?.trim();
  const airportQuote: ShippingQuote = {
    carrierName: 'By Air',
    deliveryRange: '24-48 working hours',
    displayName: airportLocation
      ? `${airportLocation} Airport Delivery`
      : 'Airport Delivery',
    id: AIRPORT_QUOTE_ID,
    price: airportFee,
  };

  return (
    <CheckoutSectionCard
      icon="cube-outline"
      title="Delivery Methods"
      colors={colors}
      isDark={isDark}
    >
      <DeliveryMethodTabs
        colors={colors}
        isDark={isDark}
        options={options}
        selectedMethod={selectedMethod}
        onSelectMethod={onSelectMethod}
      />
      <View
        style={[
          styles.detailsPanel,
          {
            backgroundColor: isDark ? colors.muted : colors.background,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
          {helperText}
        </Text>
        {children ?? (
          <>
            {selectedOption?.id === 'airport' ? (
              <ShippingQuoteRow
                colors={colors}
                isSelected
                leadingIcon="airplane-outline"
                onSelect={ignoreAirportQuotePress}
                quote={airportQuote}
                selectedAccentColor={BRAND.primary}
                selectedBackgroundColor={colors.card}
              />
            ) : null}
            {primaryPickupLine ? (
              <Text
                style={[
                  styles.infoText,
                  { color: colors.text, fontWeight: '700' },
                ]}
              >
                {primaryPickupLine}
              </Text>
            ) : null}
            {stationCode ? (
              <Text
                style={[
                  styles.infoText,
                  { color: colors.textSecondary, fontWeight: '700' },
                ]}
              >
                Station code: {stationCode}
              </Text>
            ) : null}
            {selectedOption?.id === 'pickup_station' &&
            !selectedOption.isProviderPickup ? (
              <Text
                style={[
                  styles.infoText,
                  { color: colors.textSecondary, fontWeight: '600' },
                ]}
              >
                Free pickup
              </Text>
            ) : null}
            {selectedOption?.id === 'pickup_station' &&
            selectedOption.isProviderPickup &&
            !selectedOption.pickupStationQuote ? (
              <Text
                style={[
                  styles.infoText,
                  { color: colors.textSecondary, fontWeight: '500' },
                ]}
              >
                Select to load available GIGL pickup stations for this area.
              </Text>
            ) : null}
            {secondaryPickupLines.map((line) => (
              <Text
                key={line}
                style={[
                  styles.infoText,
                  { color: colors.text, fontWeight: '500' },
                ]}
              >
                {line}
              </Text>
            ))}
          </>
        )}
      </View>
    </CheckoutSectionCard>
  );
}

const styles = StyleSheet.create({
  detailsPanel: {
    gap: SPACING.sm,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.md,
  },
  helperText: { fontSize: 13, lineHeight: 18 },
  infoText: { fontSize: 13, lineHeight: 20 },
});
