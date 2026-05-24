import Ionicons from "@react-native-vector-icons/ionicons/static";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ShippingQuote } from '@/components/checkout/types';
import { ShippingQuotesRetryCard } from '@/components/checkout/ShippingQuotesRetryCard';
import type Colors from '@/constants/Colors';
import { BRAND, palette, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';
import { formatPrice } from '@/stores/cart-store';

type ColorsScheme = (typeof Colors)['light'];

interface ShippingQuotesCardProps {
  colors: ColorsScheme;
  isDark: boolean;
  isLoadingQuotes: boolean;
  shippingQuotes: ShippingQuote[];
  selectedQuoteId: string;
  onSelectQuote: (id: string) => void;
  onRetryQuotes: () => void;
}

export function ShippingQuotesCard({
  colors,
  isDark,
  isLoadingQuotes,
  shippingQuotes,
  selectedQuoteId,
  onSelectQuote,
  onRetryQuotes,
}: ShippingQuotesCardProps) {
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
        <Ionicons name="car-outline" size={16} color={BRAND.primary} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Select Delivery Option
        </Text>
      </View>

      <View style={styles.cardBody}>
        {isLoadingQuotes ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={BRAND.primary} />
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Fetching delivery options…
            </Text>
          </View>
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
              const carrier =
                quote.carrierName || quote.provider || 'Delivery';

              return (
                <Pressable
                  key={String(quote.id)}
                  onPress={() => onSelectQuote(String(quote.id))}
                  style={[
                    styles.quoteRow,
                    {
                      borderColor: isSelected ? BRAND.primary : colors.border,
                      backgroundColor: isSelected
                        ? isDark
                          ? 'rgba(217, 59, 48, 0.16)'
                          : palette.red[50]
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
                            color: isSelected
                              ? isDark
                                ? '#FDECEA'
                                : BRAND.primary
                              : colors.text,
                          },
                        ]}
                      >
                        {quote.displayName}
                      </Text>
                      {carrier.toLowerCase().includes('gig') && (
                        <View style={styles.badgeDark}>
                          <Text style={styles.badgeText}>GIGL</Text>
                        </View>
                      )}
                      {carrier.toLowerCase().includes('topship') && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeTextLight}>Topship</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.quoteMeta,
                        {
                          color: isSelected
                            ? isDark
                              ? palette.gray[200]
                              : '#B42318'
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
                          color: isSelected
                            ? isDark
                              ? '#FFF5F4'
                              : BRAND.primary
                            : colors.text,
                        },
                      ]}
                    >
                      {formatPrice(quote.price)}
                    </Text>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={isSelected ? BRAND.primary : colors.textSecondary}
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
    backgroundColor: '#DBEAFE',
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeDark: {
    backgroundColor: '#111827',
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  badgeTextLight: {
    color: '#0F172A',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
