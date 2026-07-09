import Ionicons from '@react-native-vector-icons/ionicons';
import { useEffect } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import gigLogoSource from '@/assets/images/gig-logo.webp';
import { ShippingPickupFallbackNotice } from '@/components/checkout/ShippingPickupFallbackNotice';
import { ShippingQuotesRetryCard } from '@/components/checkout/ShippingQuotesRetryCard';
import type { ShippingQuote } from '@/components/checkout/types';
import type Colors from '@/constants/Colors';
import { RADIUS, SHADOWS, SPACING } from '@/constants/Colors';
import { formatPrice } from '@/stores/cart-store';

type ColorsScheme = (typeof Colors)['light'];

interface ShippingQuotesCardProps {
  colors: ColorsScheme;
  isDark: boolean;
  isLoadingQuotes: boolean;
  shippingQuotes: ShippingQuote[];
  stationPickupQuote?: ShippingQuote;
  selectedQuoteId: string;
  onSelectQuote: (id: string) => void;
  onRetryQuotes: () => void;
}

export function ShippingQuotesCard({
  colors,
  isDark,
  isLoadingQuotes,
  shippingQuotes,
  stationPickupQuote,
  selectedQuoteId,
  onSelectQuote,
  onRetryQuotes,
}: ShippingQuotesCardProps) {
  useEffect(() => {
    if (isLoadingQuotes) {
      AccessibilityInfo.announceForAccessibility('Fetching delivery options…');
    }
  }, [isLoadingQuotes]);

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
        <Ionicons name="car-outline" size={16} color={colors.primary} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Select Delivery Option
        </Text>
      </View>

      <View style={styles.cardBody}>
        {isLoadingQuotes ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
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
            {shippingQuotes.map((quote) => {
              const isSelected = String(quote.id) === String(selectedQuoteId);
              const eta =
                quote.deliveryRange ||
                (quote.estimatedDays
                  ? `${quote.estimatedDays} days`
                  : 'ETA unavailable');
              const carrier = quote.carrierName || quote.provider || 'Delivery';
              const isGiglQuote =
                carrier.toLowerCase().includes('gig') ||
                quote.provider?.toLowerCase() === 'gigl';

              return (
                <Pressable
                  key={String(quote.id)}
                  onPress={() => onSelectQuote(String(quote.id))}
                  style={[
                    styles.quoteRow,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected
                        ? colors.primaryLowOpacity
                        : colors.card,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${quote.displayName} for ${formatPrice(quote.price)}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.quoteInfo}>
                    <View style={styles.quoteHeader}>
                      <Text
                        style={[
                          styles.quoteTitle,
                          {
                            color: isSelected ? colors.primary : colors.text,
                          },
                        ]}
                      >
                        {quote.displayName}
                      </Text>
                      {isGiglQuote && (
                        <View
                          style={[
                            styles.logoBadge,
                            { backgroundColor: colors.background },
                          ]}
                          accessibilityLabel="GIG Logistics logo"
                          accessibilityRole="image"
                        >
                          <Image
                            source={gigLogoSource}
                            style={styles.gigLogo}
                            resizeMode="contain"
                          />
                        </View>
                      )}
                      {carrier.toLowerCase().includes('topship') && (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: colors.muted },
                          ]}
                        >
                          <Text
                            style={[styles.badgeText, { color: colors.text }]}
                          >
                            Topship
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.quoteMeta,
                        {
                          color: isSelected
                            ? colors.primary
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {carrier} • Est. {eta}
                    </Text>
                  </View>
                  <View style={styles.quoteRight}>
                    <Text
                      style={[
                        styles.quotePrice,
                        {
                          color: isSelected ? colors.primary : colors.text,
                        },
                      ]}
                    >
                      {formatPrice(quote.price)}
                    </Text>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={isSelected ? colors.primary : colors.textSecondary}
                    />
                  </View>
                </Pressable>
              );
            })}
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quoteList: {
    gap: 10,
  },
  quoteRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quoteInfo: {
    flex: 1,
    marginRight: 12,
  },
  quoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  quoteTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  quoteMeta: {
    fontSize: 12,
  },
  quoteRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  quotePrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  badge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  logoBadge: {
    borderRadius: 4,
    minHeight: 24,
    minWidth: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },

  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  gigLogo: {
    width: 30,
    height: 22,
  },
});
