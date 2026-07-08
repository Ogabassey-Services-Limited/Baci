import { isAirportDeliveryEligible, isPickupEligible } from '@baci/shared';
import type { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import { StyleSheet, Text, View } from 'react-native';
import {
  getPickupStationAddressLines,
  isProviderStationPickupQuote,
} from '@/components/checkout/checkout-station-pickup';
import type {
  DeliveryMethod,
  ShippingQuote,
} from '@/components/checkout/types';
import type Colors from '@/constants/Colors';
import { SPACING } from '@/constants/Colors';
import { formatPrice } from '@/stores/cart-store';
import { CheckoutSectionCard } from './selection/CheckoutSectionCard';
import { DefaultBadge } from './selection/DefaultBadge';
import { SelectableOptionRow } from './selection/SelectableOptionRow';

const AIRPORT_DOORSTEP_NOTE = 'Delivery to your doorstep';
const DELIVERY_ESTIMATE = 'Est Delivery within 24-48 working hours';

type ColorsScheme = (typeof Colors)['light'];

interface DeliveryMethodCardProps {
  colors: ColorsScheme;
  isDark: boolean;
  selectedMethod: DeliveryMethod;
  onSelectMethod: (method: DeliveryMethod) => void;
  doorSubtitle: string;
  doorPrice: string;
  airportFee: number;
  deliveryState?: string | null;
  pickupStationQuote?: ShippingQuote;
}

interface MethodOption {
  id: DeliveryMethod;
  title: string;
  subtitle: string;
  price: string;
  icon: IoniconsIconName;
  pickupStationQuote?: ShippingQuote;
  isProviderPickup: boolean;
}

export function DeliveryMethodCard({
  colors,
  isDark,
  selectedMethod,
  onSelectMethod,
  doorSubtitle,
  doorPrice,
  airportFee,
  deliveryState,
  pickupStationQuote,
}: DeliveryMethodCardProps) {
  // Door is always available. The store ships from Lagos, so pickup is offered
  // only for Lagos, and airport (air-cargo) delivery only for non-Lagos states
  // that have an airport. The delivery address (state) is captured before this
  // card, so the options reflect the selected state.
  const options: MethodOption[] = [
    {
      id: 'door',
      title: 'Door delivery',
      subtitle: doorSubtitle,
      price: doorPrice,
      icon: 'home-outline',
      isProviderPickup: false,
    },
  ];
  if (isAirportDeliveryEligible(deliveryState)) {
    options.push({
      id: 'airport',
      title: 'Airport Delivery (Outside Lagos)',
      subtitle: AIRPORT_DOORSTEP_NOTE,
      price: formatPrice(airportFee),
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
      title: usesMerchantPickup ? 'Pick Up Station' : 'Pickup Stations (GIGL)',
      subtitle: hasProviderQuote
        ? getPickupStationAddressLines(providerPickupQuote).join(', ')
        : usesMerchantPickup
          ? getPickupStationAddressLines().join(', ')
          : 'Collect from a nearby GIG Logistics service centre',
      price: hasProviderQuote
        ? formatPrice(providerPickupQuote.price)
        : usesMerchantPickup
          ? 'Free'
          : 'See rates',
      icon: 'storefront-outline',
      pickupStationQuote: providerPickupQuote,
      isProviderPickup: !usesMerchantPickup,
    });
  }

  return (
    <CheckoutSectionCard
      icon="cube-outline"
      title="Delivery Methods"
      colors={colors}
      isDark={isDark}
    >
      <View style={styles.list}>
        {options.map((option) => {
          const isSelected = selectedMethod === option.id;
          const isFree = option.price === 'Free';
          const pickupAddressLines =
            option.id === 'pickup_station'
              ? option.pickupStationQuote || !option.isProviderPickup
                ? getPickupStationAddressLines(option.pickupStationQuote)
                : []
              : [];
          const [primaryPickupLine, ...secondaryPickupLines] =
            pickupAddressLines;

          return (
            <SelectableOptionRow
              key={option.id}
              selected={isSelected}
              onPress={() => onSelectMethod(option.id)}
              colors={colors}
              icon={option.icon}
              title={option.title}
              subtitle={option.subtitle}
              accessibilityLabel={`Select ${option.title}`}
              trailing={
                isFree ? (
                  <DefaultBadge label="Free" />
                ) : (
                  <Text style={[styles.price, { color: colors.text }]}>
                    {option.price}
                  </Text>
                )
              }
            >
              {option.id === 'airport' ? (
                <>
                  <Text style={[styles.infoTitle, { color: colors.text }]}>
                    Airport Delivery
                  </Text>
                  <Text
                    style={[styles.infoText, { color: colors.textSecondary }]}
                  >
                    {AIRPORT_DOORSTEP_NOTE}. {DELIVERY_ESTIMATE}
                  </Text>
                </>
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
              {option.id === 'pickup_station' &&
              option.isProviderPickup &&
              !option.pickupStationQuote ? (
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
            </SelectableOptionRow>
          );
        })}
      </View>
    </CheckoutSectionCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACING.sm },
  price: { fontSize: 13, fontWeight: '700' },
  infoTitle: { fontSize: 14, fontWeight: '700' },
  infoText: { fontSize: 13, lineHeight: 20 },
});
