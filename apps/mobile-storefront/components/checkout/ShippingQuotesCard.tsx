import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ShippingQuote } from '@/components/checkout/types';
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
          <Pressable
            onPress={onRetryQuotes}
            style={[
              styles.retryCard,
              {
                borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : '#FCD34D',
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#FFFBEB',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Reload delivery rates"
          >
            <View
              style={[
                styles.retryIconWrap,
                {
                  backgroundColor: isDark
                    ? 'rgba(245, 158, 11, 0.14)'
                    : '#FEF3C7',
                },
              ]}
            >
              <Ionicons
                name="car-outline"
                size={22}
                color={isDark ? colors.warning : '#B45309'}
              />
            </View>
            <View style={styles.retryTextWrap}>
              <Text
                style={[
                  styles.retryTitle,
                  { color: isDark ? colors.text : '#111827' },
                ]}
              >
                Oops! Rates took a detour
              </Text>
              <Text
                style={[
                  styles.retrySubtitle,
                  { color: isDark ? colors.textSecondary : '#B45309' },
                ]}
              >
                Our delivery partners are a bit slow today. Tap here to try
                again.
              </Text>
            </View>
            <View
              style={[
                styles.retryBadge,
                {
                  backgroundColor: isDark
                    ? 'rgba(245, 158, 11, 0.14)'
                    : '#FEF3C7',
                },
              ]}
            >
              <Text
                style={[
                  styles.retryBadgeText,
                  { color: isDark ? colors.warning : '#B45309' },
                ]}
              >
                Refresh Rates
              </Text>
            </View>
          </Pressable>
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
                      {carrier.includes('GIG') && (
                        <View style={styles.badgeDark}>
                          <Text style={styles.badgeText}>GIGL</Text>
                        </View>
                      )}
                      {carrier.toLowerCase().includes('topship') && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>Topship</Text>
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
  retryCard: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  retryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryTextWrap: {
    alignItems: 'center',
  },
  retryTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  retrySubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  retryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  retryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
