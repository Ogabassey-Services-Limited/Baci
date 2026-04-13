import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { styles } from '@/components/domains/buy-domain.styles';
import { useTheme } from '@/hooks/useTheme';

interface DomainSearchResult {
  available: boolean;
  currency: string;
  domain: string;
  popular?: boolean;
  price: number;
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
              <Text style={styles.popularBadgeText}>POPULAR</Text>
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
          ₦{domain.price.toLocaleString()}
        </Text>
        {domain.available ? (
          <Pressable
            accessibilityLabel={`Buy ${domain.domain}`}
            accessibilityRole="button"
            disabled={isPurchasing}
            onPress={onBuy}
            style={[
              styles.buyButton,
              {
                backgroundColor: colors.primary,
                opacity: isPurchasing ? 0.5 : 1,
              },
            ]}
          >
            {isPurchasing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Text style={styles.buyText}>Buy</Text>
                <Ionicons color="#FFF" name="arrow-forward" size={14} />
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
