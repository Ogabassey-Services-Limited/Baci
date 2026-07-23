import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ShippingQuoteRow } from '@/components/checkout/ShippingQuoteRow';
import { ShippingQuotesRetryCard } from '@/components/checkout/ShippingQuotesRetryCard';
import type { ShippingQuote } from '@/components/checkout/types';
import type Colors from '@/constants/Colors';
import { BRAND, SPACING } from '@/constants/Colors';
import {
  MERCHANT_PICKUP_QUOTE_ID,
  type MerchantPickupLocation,
} from './merchant-pickup-location';

type ColorsScheme = (typeof Colors)['light'];

interface PickupLocationOptionsProps {
  colors: ColorsScheme;
  isDark: boolean;
  isLoading: boolean;
  merchantLocation?: MerchantPickupLocation;
  onRetry: () => void;
  onSelect: (id: string) => void;
  providerQuotes: ShippingQuote[];
  selectedQuoteId: string;
}

export function PickupLocationOptions({
  colors,
  isDark,
  isLoading,
  merchantLocation,
  onRetry,
  onSelect,
  providerQuotes,
  selectedQuoteId,
}: PickupLocationOptionsProps) {
  const hasPickupOption =
    Boolean(merchantLocation) || providerQuotes.length > 0;

  return (
    <View style={styles.list}>
      {merchantLocation ? (
        <ShippingQuoteRow
          colors={colors}
          estimateOverride={null}
          isSelected={selectedQuoteId === MERCHANT_PICKUP_QUOTE_ID}
          leadingIcon="location-outline"
          onSelect={onSelect}
          priceLabelOverride="Free"
          quote={{
            carrierName: merchantLocation.address,
            displayName: merchantLocation.label,
            id: MERCHANT_PICKUP_QUOTE_ID,
            price: 0,
          }}
          selectedAccentColor={BRAND.primary}
          selectedBackgroundColor={colors.card}
        />
      ) : null}

      {providerQuotes.map((quote) => (
        <ShippingQuoteRow
          key={String(quote.id)}
          colors={colors}
          estimateOverride={null}
          isSelected={String(quote.id) === String(selectedQuoteId)}
          onSelect={onSelect}
          quote={quote}
          selectedAccentColor={BRAND.primary}
          selectedBackgroundColor={colors.card}
        />
      ))}

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={BRAND.primary} size="small" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Checking nearby GIG Logistics centres…
          </Text>
        </View>
      ) : !hasPickupOption ? (
        <ShippingQuotesRetryCard
          colors={colors}
          isDark={isDark}
          onRetryQuotes={onRetry}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACING.sm },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  loadingText: { flex: 1, fontSize: 12, lineHeight: 17 },
});
