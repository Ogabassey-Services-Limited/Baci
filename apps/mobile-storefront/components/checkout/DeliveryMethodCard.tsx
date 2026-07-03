import { isAirportDeliveryEligible, isPickupEligible } from '@baci/shared';
import type { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { PICKUP_STATION_ADDRESS_LINES } from '@/components/checkout/PickupStationCard';
import type { DeliveryMethod } from '@/components/checkout/types';
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
}

interface MethodOption {
  id: DeliveryMethod;
  title: string;
  subtitle: string;
  price: string;
  icon: IoniconsIconName;
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
    },
  ];
  if (isAirportDeliveryEligible(deliveryState)) {
    options.push({
      id: 'airport',
      title: 'Airport Delivery (Outside Lagos)',
      subtitle: AIRPORT_DOORSTEP_NOTE,
      price: formatPrice(airportFee),
      icon: 'airplane-outline',
    });
  }
  if (isPickupEligible(deliveryState)) {
    options.push({
      id: 'pickup_station',
      title: 'Pick Up Station',
      subtitle: PICKUP_STATION_ADDRESS_LINES.join(', '),
      price: 'Free',
      icon: 'storefront-outline',
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
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    {AIRPORT_DOORSTEP_NOTE}. {DELIVERY_ESTIMATE}
                  </Text>
                </>
              ) : null}
              {option.id === 'pickup_station'
                ? PICKUP_STATION_ADDRESS_LINES.map((line, index) => (
                    <Text
                      key={line}
                      style={[
                        styles.infoText,
                        {
                          color: colors.text,
                          fontWeight: index === 0 ? '700' : '500',
                        },
                      ]}
                    >
                      {line}
                    </Text>
                  ))
                : null}
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
