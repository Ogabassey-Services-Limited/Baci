import {
  ActivityIndicator,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import {
  formatLargePrice,
  getCurrencySymbol,
} from '@/components/product/product.shared';
import type { ThemeColors } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import { useInventoryStats } from '@/hooks/useProducts';
import { useTheme } from '@/hooks/useTheme';
import { useWebsiteAnalytics } from '@/hooks/useWebsiteAnalytics';

type ProductsStatCardsProps = {
  activeTab: 'in_stock' | 'on_website';
};

export function ProductsStatCards({ activeTab }: ProductsStatCardsProps) {
  return activeTab === 'on_website' ? (
    <WebsiteStatCards />
  ) : (
    <InventoryStatCards />
  );
}

type ProductStatCardProps = {
  colors: ThemeColors;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
  title: string;
  value: string;
};

function ProductStatCard({
  colors,
  style,
  subtitle,
  title,
  value,
}: ProductStatCardProps) {
  return (
    <View
      style={[
        styles.card,
        style,
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
}

function WebsiteStatCards() {
  const {
    data: analyticsData,
    error: analyticsError,
    isLoading: isAnalyticsLoading,
  } = useWebsiteAnalytics();
  const { colors } = useTheme();

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
        <ProductStatCard
          colors={colors}
          title="Website Stats"
          value="Unavailable"
          subtitle="Try again later"
        />
      </View>
    );
  }

  const { bestSeller, mostSearched, topConverting } =
    analyticsData?.summary || {};

  return (
    <View style={styles.container}>
      <ProductStatCard
        colors={colors}
        title="Best Seller"
        value={bestSeller ? bestSeller.name : 'No data'}
        subtitle={bestSeller ? `${bestSeller.units_sold} sold` : ''}
      />
      <ProductStatCard
        colors={colors}
        title="Most Searched"
        value={mostSearched ? mostSearched.query : 'No data'}
        subtitle={mostSearched ? `${mostSearched.count} searches` : ''}
      />
      <ProductStatCard
        colors={colors}
        title="Top Converting"
        value={topConverting ? topConverting.name : 'No data'}
        subtitle={
          topConverting
            ? `${topConverting.conversionRate.toFixed(1)}% rate`
            : ''
        }
      />
    </View>
  );
}

function InventoryStatCards() {
  const {
    data: inventoryStats,
    error: inventoryError,
    isLoading: isInventoryLoading,
  } = useInventoryStats();
  const { merchant } = useMerchant();
  const { colors } = useTheme();

  const currencySymbol = getCurrencySymbol(merchant?.payout_currency);

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
        <ProductStatCard
          colors={colors}
          title="Inventory Stats"
          value="Unavailable"
          subtitle="Try again later"
        />
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.inventoryScroller}
      contentContainerStyle={styles.inventoryContainer}
      testID="inventory-stat-card-strip"
    >
      <ProductStatCard
        colors={colors}
        style={styles.inventoryCard}
        title="Total Value"
        value={formatLargePrice(
          inventoryStats?.inventoryValue || 0,
          currencySymbol
        )}
      />
      <ProductStatCard
        colors={colors}
        style={styles.inventoryCard}
        title="Stock Cost"
        value={formatLargePrice(
          inventoryStats?.inventoryCost || 0,
          currencySymbol
        )}
      />
      <ProductStatCard
        colors={colors}
        style={styles.inventoryCard}
        title="Low Stock"
        value={`${inventoryStats?.lowStockCount || 0}`}
        subtitle="needs attention"
      />
      <ProductStatCard
        colors={colors}
        style={styles.inventoryCard}
        title="Out of Stock"
        value={`${inventoryStats?.outOfStockCount || 0}`}
        subtitle="restock first"
      />
    </ScrollView>
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
  inventoryCard: {
    flex: 0,
    minHeight: 72,
    width: 136,
  },
  inventoryContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
  },
  inventoryScroller: {
    flexGrow: 0,
    maxHeight: 84,
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    height: 80,
    justifyContent: 'center',
  },
});
