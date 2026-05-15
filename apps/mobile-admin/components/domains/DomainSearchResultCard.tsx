import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { styles } from '@/components/domains/buy-domain.styles';
import type { DomainSearchResult } from '@/components/domains/domain-search-result';
import { useTheme } from '@/hooks/useTheme';

const DOMAIN_PRICE_LOCALE_BY_CURRENCY: Record<string, string> = {
  GBP: 'en-GB',
  NGN: 'en-NG',
  USD: 'en-US',
};

function formatDomainPrice(price: number, currency: string): string {
  const locale = DOMAIN_PRICE_LOCALE_BY_CURRENCY[currency] ?? 'en-US';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    const formattedNumber = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
    return currency ? `${currency} ${formattedNumber}` : formattedNumber;
  }
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
  const formattedPrice = formatDomainPrice(domain.price, domain.currency);

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
