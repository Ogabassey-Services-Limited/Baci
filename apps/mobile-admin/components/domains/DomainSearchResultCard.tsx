import Ionicons from '@react-native-vector-icons/ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { styles } from '@/components/domains/buy-domain.styles';
import type { DomainSearchResult } from '@/components/domains/domain-search-result';
import { useTheme } from '@/hooks/useTheme';
import { formatMerchantAmount } from '@/lib/format-merchant-currency';

// Domain prices are platform costs charged to the merchant's wallet in NGN —
// never the merchant's own payout currency. Formatting them in a merchant's
// local currency would imply an FX conversion that never happened, so this
// is intentionally NGN for every merchant regardless of `payout_currency`/
// `country` (mirrors the web dashboard's domain search panel). The API's
// per-result `currency` field is intentionally ignored for display.
function formatDomainPrice(price: number): string {
  return formatMerchantAmount(
    price,
    { payout_currency: 'NGN' },
    { minimumFractionDigits: 0, maximumFractionDigits: 0 }
  );
}

interface DomainSearchResultCardProps {
  domain: DomainSearchResult;
  isPurchasing: boolean;
  onBuy: () => void;
}

export function DomainSearchResultCard({
  domain,
  isPurchasing,
  onBuy,
}: DomainSearchResultCardProps) {
  const { colors, shadows } = useTheme();
  const formattedPrice = formatDomainPrice(domain.price);

  return (
    <View
      style={[
        styles.resultCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        shadows.sm,
      ]}
    >
      <View style={styles.resultInfo}>
        <View style={styles.resultHeader}>
          <Text style={[styles.domainName, { color: colors.text }]}>
            {domain.domain}
          </Text>
          {domain.popular ? (
            <View
              style={[styles.popularBadge, { backgroundColor: colors.primary }]}
            >
              <Text
                style={[
                  styles.popularBadgeText,
                  { color: colors.textOnPrimary },
                ]}
              >
                POPULAR
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          style={[
            styles.availabilityText,
            { color: domain.available ? colors.success : colors.textSecondary },
          ]}
        >
          {domain.available ? 'Available' : 'Unavailable'}
        </Text>
      </View>

      <View style={styles.priceColumn}>
        <Text style={[styles.price, { color: colors.text }]}>
          {formattedPrice}
        </Text>
        <Text style={[styles.currencyNote, { color: colors.textSecondary }]}>
          Billed in NGN
        </Text>
        {domain.available ? (
          <Pressable
            accessibilityLabel={`Buy ${domain.domain}`}
            accessibilityRole="button"
            accessibilityHint={`Purchases the domain ${domain.domain} for ${formattedPrice}`}
            accessibilityState={{ disabled: isPurchasing }}
            disabled={isPurchasing}
            onPress={onBuy}
            style={({ pressed }) => [
              styles.buyButton,
              {
                backgroundColor: colors.primary,
                opacity: isPurchasing ? 0.5 : pressed ? 0.85 : 1,
              },
              pressed && !isPurchasing ? styles.buyButtonPressed : null,
            ]}
          >
            {isPurchasing ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <>
                <Text style={[styles.buyText, { color: colors.textOnPrimary }]}>
                  Buy
                </Text>
                <Ionicons
                  color={colors.textOnPrimary}
                  name="arrow-forward"
                  size={14}
                />
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
