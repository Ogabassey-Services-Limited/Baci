import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  formatLargePrice,
  getCurrencySymbol,
} from '@/components/product/product.shared';
import { useMerchant } from '@/hooks/useMerchant';
import { useInventoryStats } from '@/hooks/useProducts';
import { useTheme } from '@/hooks/useTheme';
import { useWebsiteAnalytics } from '@/hooks/useWebsiteAnalytics';

type ProductsStatCardsProps = {
  activeTab: 'in_stock' | 'on_website';
};

export function ProductsStatCards({ activeTab }: ProductsStatCardsProps) {
  const {
    data: analyticsData,
    error: analyticsError,
    isLoading: isAnalyticsLoading,
  } = useWebsiteAnalytics();
  const {
    data: inventoryStats,
    error: inventoryError,
    isLoading: isInventoryLoading,
  } = useInventoryStats();
  const { merchant } = useMerchant();
  const { colors } = useTheme();

  const currencySymbol = getCurrencySymbol(merchant?.payout_currency);

  const renderCard = (title: string, value: string, subtitle?: string) => (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text
        style={[styles.cardTitle, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text
        style={[styles.cardValue, { color: colors.text }]}
        numberOfLines={1}
      >
        {value}
      </Text>
      {subtitle ? (
        <Text
          style={[styles.cardSubtitle, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  if (activeTab === 'on_website') {
    if (isAnalyticsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            accessibilityLabel="Loading product stats"
            color={colors.primary}
          />
        </View>
      );
    }

    if (analyticsError) {
      return (
        <View style={styles.container}>
          {renderCard('Website Stats', 'Unavailable', 'Try again later')}
        </View>
      );
    }

    const { bestSeller, mostSearched, topConverting } =
      analyticsData?.summary || {};

    return (
      <View style={styles.container}>
        {renderCard(
          'Best Seller',
          bestSeller ? bestSeller.name : '-',
          bestSeller ? `${bestSeller.units_sold} sold` : ''
        )}
        {renderCard(
          'Most Searched',
          mostSearched ? mostSearched.query : '-',
          mostSearched ? `${mostSearched.count} searches` : ''
        )}
        {renderCard(
          'Top Converting',
          topConverting ? topConverting.name : '-',
          topConverting
            ? `${topConverting.conversionRate.toFixed(1)}% rate`
            : ''
        )}
      </View>
    );
  }

  // In Stock tab
  if (isInventoryLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          accessibilityLabel="Loading product stats"
          color={colors.primary}
        />
      </View>
    );
  }

  if (inventoryError) {
    return (
      <View style={styles.container}>
        {renderCard('Inventory Stats', 'Unavailable', 'Try again later')}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderCard(
        'Total Value',
        formatLargePrice(inventoryStats?.inventoryValue || 0, currencySymbol)
      )}
      {renderCard(
        'Stock Cost',
        formatLargePrice(inventoryStats?.inventoryCost || 0, currencySymbol)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  cardSubtitle: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardValue: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    height: 80,
    justifyContent: 'center',
  },
});
