import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  PICKUP_STATION_ADDRESS_LINES,
} from '@/components/checkout/PickupStationCard';
import type { DeliveryMethod } from '@/components/checkout/types';
import type Colors from '@/constants/Colors';
import { BRAND, palette, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';
import { formatPrice } from '@/stores/cart-store';

type ColorsScheme = (typeof Colors)['light'];

interface DeliveryMethodCardProps {
  colors: ColorsScheme;
  isDark: boolean;
  selectedMethod: DeliveryMethod;
  onSelectMethod: (method: DeliveryMethod) => void;
  doorSubtitle: string;
  doorPrice: string;
  airportFee: number;
}

export function DeliveryMethodCard({
  colors,
  isDark,
  selectedMethod,
  onSelectMethod,
  doorSubtitle,
  doorPrice,
  airportFee,
}: DeliveryMethodCardProps) {
  const options = [
    {
      id: 'door',
      title: 'Door delivery',
      subtitle: doorSubtitle,
      price: doorPrice,
    },
    {
      id: 'airport',
      title: 'Airport Delivery (Outside Lagos)',
      subtitle: 'Est Delivery within 24-48 working hours',
      price: formatPrice(airportFee),
    },
    {
      id: 'pickup_station',
      title: 'Pick Up Station',
      subtitle: PICKUP_STATION_ADDRESS_LINES.join(', '),
      price: 'Free',
    },
  ] as const;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Ionicons name="cube-outline" size={16} color={BRAND.primary} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Delivery Methods
        </Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
          Choose how you want to receive this order.
        </Text>

        <View style={styles.deliveryMethodList}>
          {options.map((option) => {
            const isSelected = selectedMethod === option.id;

            return (
              <Pressable
                key={option.id}
                onPress={() => onSelectMethod(option.id)}
                style={[
                  styles.deliveryMethodCard,
                  {
                    borderColor: isSelected ? BRAND.primary : colors.border,
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(217, 59, 48, 0.14)'
                        : palette.red[50]
                      : colors.background,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Select ${option.title}`}
              >
                <View style={styles.deliveryMethodTopRow}>
                  <View style={styles.deliveryMethodLabelWrap}>
                    <Text
                      style={[
                        styles.deliveryMethodTitle,
                        { color: isSelected ? BRAND.primary : colors.text },
                      ]}
                    >
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.deliveryMethodSubtitle,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {option.subtitle}
                    </Text>
                  </View>
                  <View style={styles.deliveryMethodMeta}>
                    <Text
                      style={[
                        styles.deliveryMethodPrice,
                        { color: isSelected ? BRAND.primary : colors.text },
                      ]}
                    >
                      {option.price}
                    </Text>
                    <Ionicons
                      name={
                        isSelected ? 'checkmark-circle' : 'ellipse-outline'
                      }
                      size={20}
                      color={isSelected ? BRAND.primary : colors.textSecondary}
                    />
                  </View>
                </View>

                {isSelected && option.id === 'airport' ? (
                  <View
                    style={[
                      styles.expandedInfo,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.04)'
                          : palette.gray[50],
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.expandedTitle, { color: colors.text }]}
                    >
                      Airport Delivery
                    </Text>
                    <Text
                      style={[
                        styles.expandedText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Est Delivery within 24-48 working hours
                    </Text>
                  </View>
                ) : null}

                {isSelected && option.id === 'pickup_station' ? (
                  <View
                    style={[
                      styles.expandedInfo,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.04)'
                          : palette.gray[50],
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {PICKUP_STATION_ADDRESS_LINES.map((line) => (
                      <Text
                        key={line}
                        style={[
                          styles.expandedText,
                          {
                            color: colors.text,
                            fontWeight:
                              line === PICKUP_STATION_ADDRESS_LINES[0]
                                ? '700'
                                : '500',
                          },
                        ]}
                      >
                        {line}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingTop: 14,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardBody: {
    gap: SPACING.sm,
  },
  helperText: {
    fontSize: 12,
  },
  deliveryMethodList: {
    gap: 10,
  },
  deliveryMethodCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  deliveryMethodTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  deliveryMethodLabelWrap: {
    flex: 1,
    gap: 4,
  },
  deliveryMethodTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  deliveryMethodSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  deliveryMethodMeta: {
    alignItems: 'flex-end',
    gap: 8,
  },
  deliveryMethodPrice: {
    fontSize: 13,
    fontWeight: '700',
  },
  expandedInfo: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  expandedTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  expandedText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
