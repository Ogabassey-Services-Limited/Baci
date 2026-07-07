import Ionicons from '@react-native-vector-icons/ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { getPickupStationLabel } from '@/components/checkout/checkout-station-pickup';
import type { ShippingQuote } from '@/components/checkout/types';
import type Colors from '@/constants/Colors';
import { RADIUS, SPACING } from '@/constants/Colors';

type ColorsScheme = (typeof Colors)['light'];

interface ShippingPickupFallbackNoticeProps {
  colors: ColorsScheme;
  stationPickupQuote: ShippingQuote;
}

export function ShippingPickupFallbackNotice({
  colors,
  stationPickupQuote,
}: ShippingPickupFallbackNoticeProps) {
  return (
    <View
      style={[
        styles.pickupFallback,
        {
          borderColor: colors.border,
          backgroundColor: colors.background,
        },
      ]}
    >
      <View
        style={[styles.pickupFallbackIcon, { backgroundColor: colors.card }]}
      >
        <Ionicons name="storefront-outline" size={22} color={colors.primary} />
      </View>
      <View style={styles.pickupFallbackText}>
        <Text style={[styles.pickupFallbackTitle, { color: colors.text }]}>
          GIGL doesn't currently support door delivery to this location.
        </Text>
        <Text
          style={[
            styles.pickupFallbackSubtitle,
            { color: colors.textSecondary },
          ]}
        >
          Choose {getPickupStationLabel(stationPickupQuote)} above to collect
          from a nearby service centre.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pickupFallback: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  pickupFallbackIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupFallbackText: {
    gap: SPACING.xs,
  },
  pickupFallbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  pickupFallbackSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
});
