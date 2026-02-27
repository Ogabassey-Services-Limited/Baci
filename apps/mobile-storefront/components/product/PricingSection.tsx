/**
 * PricingSection - Displays product pricing, negotiated price badge,
 * and "Make an Offer" button.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND, RADIUS, TYPOGRAPHY } from '@/constants/Colors';
import { formatPrice } from '@/types/product';

type ColorsScheme = (typeof Colors)['light'];

interface PricingSectionProps {
  effectivePrice: number;
  effectiveComparePrice: number | undefined;
  negotiatedPrice: number | null;
  onOpenNegotiation: () => void;
  colors: ColorsScheme;
}

export function PricingSection({
  effectivePrice,
  effectiveComparePrice,
  negotiatedPrice,
  onOpenNegotiation,
  colors,
}: PricingSectionProps) {
  return (
    <>
      {/* Pricing */}
      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: BRAND.primary }]}>
          {formatPrice(effectivePrice)}
        </Text>
        {effectiveComparePrice != null &&
          effectiveComparePrice > effectivePrice && (
            <Text
              style={[styles.comparePrice, { color: colors.textSecondary }]}
            >
              {formatPrice(effectiveComparePrice)}
            </Text>
          )}
      </View>

      {/* Negotiated Price Badge */}
      {/* M11 FIX: Use != null instead of truthy check so price of 0 is handled */}
      {negotiatedPrice != null && (
        <View
          style={[
            styles.negotiatedBadge,
            { backgroundColor: `${colors.success}20` },
          ]}
        >
          <Ionicons name="pricetag" size={14} color={colors.success} />
          <Text style={[styles.negotiatedText, { color: colors.success }]}>
            Your negotiated price!
          </Text>
        </View>
      )}

      {/* Make an Offer Button */}
      {negotiatedPrice == null && (
        <Pressable
          style={[styles.makeOfferButton, { borderColor: BRAND.primary }]}
          onPress={onOpenNegotiation}
          accessibilityRole="button"
          accessibilityLabel="Make an offer on this product"
        >
          <Ionicons name="chatbubble-outline" size={16} color={BRAND.primary} />
          <Text style={[styles.makeOfferText, { color: BRAND.primary }]}>
            Make an Offer
          </Text>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 24,
  },
  price: {
    fontSize: TYPOGRAPHY.size['3xl'],
    fontWeight: '900',
  },
  comparePrice: {
    fontSize: 18,
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  negotiatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  negotiatedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  makeOfferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    marginBottom: 16,
  },
  makeOfferText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
