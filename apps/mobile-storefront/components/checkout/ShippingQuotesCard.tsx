import Ionicons from '@react-native-vector-icons/ionicons';
import { useEffect } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ShippingPickupFallbackNotice } from '@/components/checkout/ShippingPickupFallbackNotice';
import { ShippingQuoteRow } from '@/components/checkout/ShippingQuoteRow';
import { ShippingQuotesRetryCard } from '@/components/checkout/ShippingQuotesRetryCard';
import type { ShippingQuote } from '@/components/checkout/types';
import type Colors from '@/constants/Colors';
import { BRAND, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';

type ColorsScheme = (typeof Colors)['light'];

interface ShippingQuotesCardProps {
  colors: ColorsScheme;
  estimateOverride?: string | null;
  isDark: boolean;
  embedded?: boolean;
  isLoadingQuotes: boolean;
  shippingQuotes: ShippingQuote[];
  stationPickupQuote?: ShippingQuote;
  selectedQuoteId: string;
  onSelectQuote: (id: string) => void;
  onRetryQuotes: () => void;
}

export function ShippingQuotesCard({
  colors,
  estimateOverride,
  isDark,
  embedded = false,
  isLoadingQuotes,
  shippingQuotes,
  stationPickupQuote,
  selectedQuoteId,
  onSelectQuote,
  onRetryQuotes,
}: ShippingQuotesCardProps) {
  const selectedAccentColor = embedded ? BRAND.primary : colors.primary;
  const selectedBackgroundColor = embedded
    ? colors.card
    : colors.primaryLowOpacity;

  useEffect(() => {
    if (isLoadingQuotes) {
      AccessibilityInfo.announceForAccessibility('Fetching delivery options…');
    }
  }, [isLoadingQuotes]);

  return (
    <View
      style={
        embedded
          ? undefined
          : [
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: isDark
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'transparent',
              },
            ]
      }
    >
      {!embedded && (
        <View style={styles.cardHeader}>
          <Ionicons name="car-outline" size={16} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Select Delivery Option
          </Text>
        </View>
      )}

      <View style={styles.cardBody}>
        {isLoadingQuotes ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={selectedAccentColor} />
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Fetching delivery options…
            </Text>
          </View>
        ) : shippingQuotes.length === 0 && stationPickupQuote ? (
          <ShippingPickupFallbackNotice
            colors={colors}
            stationPickupQuote={stationPickupQuote}
          />
        ) : shippingQuotes.length === 0 ? (
          <ShippingQuotesRetryCard
            colors={colors}
            isDark={isDark}
            onRetryQuotes={onRetryQuotes}
          />
        ) : (
          <View style={styles.quoteList}>
            {shippingQuotes.map((quote) => (
              <ShippingQuoteRow
                key={String(quote.id)}
                colors={colors}
                estimateOverride={estimateOverride}
                isSelected={String(quote.id) === String(selectedQuoteId)}
                onSelect={onSelectQuote}
                quote={quote}
                selectedAccentColor={selectedAccentColor}
                selectedBackgroundColor={selectedBackgroundColor}
              />
            ))}
          </View>
        )}
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
  cardTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  cardBody: { gap: SPACING.sm },
  helperText: { fontSize: 12 },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quoteList: { gap: 10 },
});
