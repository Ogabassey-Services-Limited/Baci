/**
 * Inventory Screen - Product and Stock Management
 * Includes barcode scanning for quick updates
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItemInfo,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SafeImage from '@/components/ui/SafeImage';
import { RADIUS, SPACING, TYPOGRAPHY, type ThemeColors } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import {
  type Product,
  useInventoryStats,
  useProducts,
} from '@/hooks/useProducts';
import { useTheme } from '@/hooks/useTheme';
import {
  getEffectiveProductStock,
  getProductStockBucket,
} from '@/lib/product-inventory';

// Item height for getItemLayout optimization
const INVENTORY_ITEM_HEIGHT = 88;

// Helper to get currency symbol from merchant's payout_currency
const getCurrencySymbol = (currencyCode: string | null | undefined) => {
  const symbols: Record<string, string> = {
    NGN: '\u20A6',
    USD: '$',
    GBP: '\u00A3',
    EUR: '\u20AC',
  };
  return symbols[currencyCode || 'NGN'] || '\u20A6';
};

// Helper function moved outside component
const formatPrice = (amount: number, currencySymbol: string) => {
  return `${currencySymbol}${amount.toLocaleString()}`;
};

// Memoized Inventory Product Item component
interface InventoryProductItemProps {
  item: Product;
  colors: ThemeColors;
  currencySymbol: string;
  onPress: (id: string) => void;
}

function InventoryProductItem({
  item,
  colors,
  currencySymbol,
  onPress,
}: InventoryProductItemProps) {
  const stock = getEffectiveProductStock(item);
  const stockBucket = getProductStockBucket(item);
  const isLowStock = stockBucket === 'low_stock';
  const isOutOfStock = stockBucket === 'out_of_stock';
  const isUnmanaged = stockBucket === 'unmanaged';
  const stockStatusLabel = isUnmanaged
    ? 'Unlimited stock'
    : isOutOfStock
      ? 'Out of stock'
      : isLowStock
        ? `Low stock: ${stock} remaining`
        : `${stock} in stock`;

  return (
    <Pressable
      style={[
        styles.productCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          minHeight: 56,
        },
      ]}
      onPress={() => onPress(item.id)}
      accessibilityLabel={`${item.name}, ${formatPrice(item.price, currencySymbol)}, ${stockStatusLabel}`}
      accessibilityRole="button"
      accessibilityHint="View product details"
    >
      {item.images?.[0] ? (
        <SafeImage
          source={{ uri: item.images[0] }}
          style={styles.productImage}
        />
      ) : (
        <View
          style={[styles.productImage, { backgroundColor: colors.inputBg }]}
        >
          <Ionicons
            name="cube-outline"
            size={32}
            color={colors.textSecondary}
          />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text
          style={[styles.productName, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text style={[styles.productSku, { color: colors.textSecondary }]}>
          {item.sku || 'No SKU'}
        </Text>
        <Text style={[styles.productPrice, { color: colors.text }]}>
          {formatPrice(item.price, currencySymbol)}
        </Text>
      </View>
      <View style={styles.stockInfo}>
        <View
          style={[
            styles.stockBadge,
            {
              backgroundColor: isOutOfStock
                ? colors.errorLight
                : isLowStock
                  ? colors.warningLight
                  : colors.successLight,
            },
          ]}
        >
          <Text
            style={[
              styles.stockText,
              {
                color: isOutOfStock
                  ? colors.error
                  : isLowStock
                    ? colors.warning
                    : colors.success,
              },
            ]}
          >
            {isUnmanaged ? '∞' : stock}
          </Text>
        </View>
        <Text style={[styles.stockLabel, { color: colors.textSecondary }]}>
          {isUnmanaged ? 'available' : 'in stock'}
        </Text>
      </View>
    </Pressable>
  );
}

export default function InventoryScreen() {
  const { colors } = useTheme();
  const { merchant } = useMerchant();
  const currencySymbol = getCurrencySymbol(merchant?.payout_currency);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch real products from Supabase
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProducts({ search: searchQuery || undefined });

  // Use server-side stats for accurate counts across all pages
  const { data: inventoryStats } = useInventoryStats();

  // Flatten paginated products
  const products = data?.pages.flatMap((page) => page.products) ?? [];

  // Use server-side inventory stats for accurate global counts
  const totalProducts =
    inventoryStats?.totalProducts ?? data?.pages[0]?.totalCount ?? products.length;
  const lowStockCount = inventoryStats?.lowStockCount ?? 0;
  const outOfStockCount = inventoryStats?.outOfStockCount ?? 0;

  // Navigation callback
  const handleProductPress = (id: string) => {
    router.push(`/product/${id}`);
  };

  const renderProduct = ({ item }: ListRenderItemInfo<Product>) => (
    <InventoryProductItem
      item={item}
      colors={colors}
      currencySymbol={currencySymbol}
      onPress={handleProductPress}
    />
  );

  const productKeyExtractor = (item: Product) => item.id;

  // getItemLayout for consistent item heights
  const getItemLayout = (
    _data: ArrayLike<Product> | null | undefined,
    index: number
  ) => ({
    length: INVENTORY_ITEM_HEIGHT,
    offset: INVENTORY_ITEM_HEIGHT * index,
    index,
  });

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
        edges={['top']}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading inventory...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchInputWrapper,
            { backgroundColor: colors.inputBg },
          ]}
        >
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search products or SKU..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel="Search products"
            accessibilityHint="Enter product name or SKU to search"
          />
        </View>
        <Pressable
          style={[styles.scanButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/scan')}
          accessibilityLabel="Scan barcode"
          accessibilityRole="button"
          accessibilityHint="Opens barcode scanner to find products"
        >
          <Ionicons name="barcode-outline" size={24} color={colors.textOnPrimary} />
        </Pressable>
      </View>

      {/* Quick Stats */}
      <View
        style={styles.statsRow}
        accessibilityRole="summary"
        accessibilityLabel={`Inventory summary: ${totalProducts} products, ${lowStockCount} low stock, ${outOfStockCount} out of stock`}
      >
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              minHeight: 44,
            },
          ]}
          accessibilityLabel={`${totalProducts} products total`}
        >
          <Text style={[styles.statValue, { color: colors.text }]}>
            {totalProducts}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Products
          </Text>
        </View>
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              minHeight: 44,
            },
          ]}
          accessibilityLabel={`${lowStockCount} products with low stock`}
        >
          <Text style={[styles.statValue, { color: colors.warning }]}>
            {lowStockCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Low Stock
          </Text>
        </View>
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              minHeight: 44,
            },
          ]}
          accessibilityLabel={`${outOfStockCount} products out of stock`}
        >
          <Text style={[styles.statValue, { color: colors.error }]}>
            {outOfStockCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Out of Stock
          </Text>
        </View>
      </View>

      {/* Products List */}
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={productKeyExtractor}
        getItemLayout={getItemLayout}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="cube-outline"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No products found
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: colors.textSecondary }]}
            >
              {searchQuery
                ? 'Try a different search term'
                : 'Add products to get started'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    height: 48,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15, // Keep standard size for input
  },
  scanButton: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: TYPOGRAPHY.size['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.extraBold,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginTop: SPACING.xs,
  },
  listContent: {
    padding: SPACING.lg,
    paddingTop: 0,
    gap: SPACING.md,
  },
  productCard: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: SPACING.md,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  productName: {
    fontSize: 15, // Custom size
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  productSku: {
    fontSize: TYPOGRAPHY.size.sm,
  },
  productPrice: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginTop: 2,
  },
  stockInfo: {
    alignItems: 'center',
  },
  stockBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6, // Specific visual alignment value
    borderRadius: RADIUS.sm,
    minWidth: 40,
    alignItems: 'center',
  },
  stockText: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.extraBold,
  },
  stockLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: SPACING.xs,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
  },
  loadingFooter: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: SPACING.md,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  emptySubtitle: {
    fontSize: TYPOGRAPHY.size.md,
    textAlign: 'center',
  },
});
