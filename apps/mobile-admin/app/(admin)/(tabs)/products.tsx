/**
 * Products Screen - Product/Inventory Management
 * View and manage product catalog with real-time data
 */

import { Ionicons } from '@expo/vector-icons';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareModalContainer } from '@/components/ui/KeyboardAwareModalContainer';
import SafeImage from '@/components/ui/SafeImage';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import {
  type Product,
  type StockFilter,
  useCategories,
  useCreateCategory,
  useInventoryStats,
  useProducts,
} from '@/hooks/useProducts';
import {
  type TopSellingProduct,
  useTopSellingProducts,
} from '@/hooks/useTopSellingProducts';
import { useTheme } from '@/hooks/useTheme';
import {
  getEffectiveProductStock,
  getProductStockBucket,
} from '@/lib/product-inventory';

// Key extractors at module scope — stable references, no recreation on render
const productKeyExtractor = (item: { id: string }) => item.id;
const topSellingKeyExtractor = (item: { id: string }) => item.id;
const categoryKeyExtractor = (item: { id: string }) => item.id;

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

// Helper functions moved outside component to prevent recreation
const formatPrice = (amount: number, currencySymbol: string) =>
  `${currencySymbol}${amount.toLocaleString()}`;

const formatMetric = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toString();
};

// Category type
type Category = { id: string; name: string; slug: string };

interface ProductItemProps {
  item: Product;
  currencySymbol: string;
  onPress: (id: string) => void;
}

function ProductItem({ item, currencySymbol, onPress }: ProductItemProps) {
  const { colors, shadows } = useTheme();
  const getStockStatus = () => {
    const stockBucket = getProductStockBucket(item);
    const stock = getEffectiveProductStock(item);

    if (stockBucket === 'unmanaged') {
      return { label: 'Unlimited stock', color: colors.success };
    }

    if (stockBucket === 'out_of_stock') {
      return { label: 'Out of stock', color: colors.error };
    }

    if (stockBucket === 'low_stock') {
      return { label: `${stock} left`, color: colors.warning };
    }

    return { label: `${stock} in stock`, color: colors.success };
  };

  const stockStatus = getStockStatus();
  const imageUrl = item.images?.[0];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.productCard,
        { backgroundColor: colors.card, minHeight: 56 },
        shadows.sm,
        pressed && { backgroundColor: colors.cardHover },
      ]}
      onPress={() => onPress(item.id)}
      accessibilityLabel={`${item.name}, ${formatPrice(item.price, currencySymbol)}, ${stockStatus.label}`}
      accessibilityRole="button"
      accessibilityHint="View product details"
    >
      <View
        style={[
          styles.productImage,
          { backgroundColor: colors.backgroundLight },
        ]}
      >
        {imageUrl ? (
          <SafeImage source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <Ionicons name="image-outline" size={24} color={colors.textMuted} />
        )}
      </View>

      <View style={styles.productInfo}>
        <Text
          style={[styles.productName, { color: colors.text }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>

        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: colors.text }]}>
            {formatPrice(item.price, currencySymbol)}
          </Text>
          {item.compare_at_price != null &&
          item.compare_at_price > item.price ? (
            <Text style={[styles.comparePrice, { color: colors.textMuted }]}>
              {formatPrice(item.compare_at_price, currencySymbol)}
            </Text>
          ) : null}
        </View>

        <View style={styles.stockRow}>
          <View
            style={[styles.stockDot, { backgroundColor: stockStatus.color }]}
          />
          <Text style={[styles.stockText, { color: stockStatus.color }]}>
            {stockStatus.label}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

// Top Selling Product Item component
interface TopSellingProductItemProps {
  item: TopSellingProduct;
  currencySymbol: string;
  onPress: (id: string) => void;
}

function TopSellingProductItem({
  item,
  currencySymbol,
  onPress,
}: TopSellingProductItemProps) {
  const { colors, shadows } = useTheme();
  const imageUrl = item.images?.[0];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.productCard,
        { backgroundColor: colors.card, minHeight: 56 },
        shadows.sm,
        pressed && { backgroundColor: colors.cardHover },
      ]}
      onPress={() => onPress(item.id)}
      accessibilityLabel={`Top seller: ${item.name}, ${formatPrice(item.price, currencySymbol)}, ${formatMetric(item.totalSold)} sold`}
      accessibilityRole="button"
      accessibilityHint="View product details"
    >
      <View style={[styles.productRank, { backgroundColor: colors.gold }]}>
        <Ionicons name="trophy" size={12} color="#FFF" />
      </View>

      <View
        style={[
          styles.productImage,
          { backgroundColor: colors.backgroundLight },
        ]}
      >
        {imageUrl ? (
          <SafeImage source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <Ionicons name="image-outline" size={24} color={colors.textMuted} />
        )}
      </View>

      <View style={styles.productInfo}>
        <Text
          style={[styles.productName, { color: colors.text }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>

        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: colors.text }]}>
            {formatPrice(item.price, currencySymbol)}
          </Text>
        </View>

        <View style={styles.stockRow}>
          <Ionicons
            name="analytics"
            size={14}
            color={colors.primary}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.stockText, { color: colors.primary }]}>
            {formatMetric(item.totalSold)} sold •{' '}
            {formatMetric(item.totalRevenue)} rev
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

// Category Item component
interface CategoryItemProps {
  item: Category;
  onPress: (id: string) => void;
}

function CategoryItem({ item, onPress }: CategoryItemProps) {
  const { colors, shadows } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.categoryCard,
        { backgroundColor: colors.card, minHeight: 56 },
        shadows.sm,
        pressed && { backgroundColor: colors.cardHover },
      ]}
      onPress={() => onPress(item.id)}
      accessibilityLabel={`Category: ${item.name}`}
      accessibilityRole="button"
      accessibilityHint="View products in this category"
    >
      <View
        style={[styles.categoryIcon, { backgroundColor: colors.goldLight }]}
      >
        <Ionicons name="folder-open" size={20} color={colors.gold} />
      </View>
      <Text style={[styles.categoryName, { color: colors.text }]}>
        {item.name}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function ProductsScreen() {
  const { colors, shadows, isDark } = useTheme();
  const { merchant } = useMerchant();
  const currencySymbol = getCurrencySymbol(merchant?.payout_currency);

  const [activeTab, setActiveTab] = useState<
    | 'all'
    | 'in_stock'
    | 'low_stock'
    | 'out_of_stock'
    | 'categories'
    | 'top_selling'
  >('in_stock');
  const [searchQuery, setSearchQuery] = useState('');

  // Map activeTab to server-side stock filter
  const stockFilter: StockFilter | undefined =
    activeTab === 'in_stock' ||
    activeTab === 'low_stock' ||
    activeTab === 'out_of_stock'
      ? activeTab
      : undefined;

  const {
    data,
    isLoading: isProductsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchProducts,
  } = useProducts({
    stockFilter,
    search: searchQuery.trim() || undefined,
  });

  const {
    data: categories,
    isLoading: isCategoriesLoading,
    refetch: refetchCategories,
  } = useCategories();

  const {
    data: topSellingProducts,
    isLoading: isTopSellingLoading,
    refetch: refetchTopSelling,
  } = useTopSellingProducts(20);
  const { data: inventoryStats, isLoading: isStatsLoading } =
    useInventoryStats();

  // Category Creation State
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const createCategoryMutation = useCreateCategory();

  const handleCreateCategory = () => {
    const trimmedCategoryName = newCategoryName.trim();
    if (!trimmedCategoryName || createCategoryMutation.isPending) return;

    createCategoryMutation.mutate(trimmedCategoryName, {
      onSuccess: () => {
        setNewCategoryName('');
        setIsCategoryModalVisible(false);
      },
      onError: (err) => {
        Alert.alert('Error', err.message);
      },
    });
  };

  // Collapsible search bar animation
  const searchBarAnim = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const isSearchVisible = useRef(true);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const diff = currentScrollY - lastScrollY.current;

    if (Math.abs(diff) > 10) {
      if (diff > 0 && isSearchVisible.current && currentScrollY > 50) {
        isSearchVisible.current = false;
        Animated.timing(searchBarAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else if (diff < 0 && !isSearchVisible.current) {
        isSearchVisible.current = true;
        Animated.timing(searchBarAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }

    lastScrollY.current = currentScrollY;
  };

  // Server-side filtering handles stock + search — just flatten pages
  const displayData = data?.pages.flatMap((page) => page.products) ?? [];

  // Calculate stats
  const stats = {
    total:
      inventoryStats?.totalProducts ??
      data?.pages[0]?.totalCount ??
      displayData.length,
    active: inventoryStats?.activeCount ?? 0,
    lowStock: inventoryStats?.lowStockCount ?? 0,
    outOfStock: inventoryStats?.outOfStockCount ?? 0,
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage && activeTab !== 'top_selling') {
      fetchNextPage();
    }
  };

  // Navigation callback for products
  const handleProductPress = (id: string) => {
    router.push(`/product/${id}`);
  };

  // Navigation callback for categories
  const handleCategoryPress = (_id: string) => {
    Alert.alert(
      'Coming Soon',
      'Category filtering will be available in a future update.'
    );
  };

  const renderProduct = ({ item }: ListRenderItemInfo<Product>) => (
    <ProductItem
      item={item}
      currencySymbol={currencySymbol}
      onPress={handleProductPress}
    />
  );

  const renderTopSellingProduct = ({
    item,
  }: ListRenderItemInfo<TopSellingProduct>) => (
    <TopSellingProductItem
      item={item}
      currencySymbol={currencySymbol}
      onPress={handleProductPress}
    />
  );

  const renderCategory = ({ item }: ListRenderItemInfo<Category>) => (
    <CategoryItem item={item} onPress={handleCategoryPress} />
  );

  // Interactive Stat Card Component
  const StatCard = ({
    label,
    value,
    color,
    isActive,
    onPress,
  }: {
    label: string;
    value: number;
    color: string;
    isActive: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      style={[
        styles.statCard,
        {
          backgroundColor: isActive ? color : colors.card,
          borderColor: isActive ? color : colors.border,
        },
        shadows.sm,
      ]}
      onPress={onPress}
      accessibilityLabel={`${label}: ${value} products${isActive ? ', currently selected' : ''}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityHint={`Filter products by ${label.toLowerCase()}`}
    >
      <Text style={[styles.statValue, { color: isActive ? '#FFF' : color }]}>
        {value}
      </Text>
      <Text
        style={[
          styles.statLabel,
          { color: isActive ? 'rgba(255,255,255,0.9)' : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  const TabButton = ({
    id,
    label,
  }: {
    id:
      | 'all'
      | 'in_stock'
      | 'low_stock'
      | 'out_of_stock'
      | 'categories'
      | 'top_selling';
    label: string;
  }) => {
    const isActive = activeTab === id;
    if (id === 'low_stock' || id === 'out_of_stock') return null;

    return (
      <Pressable
        style={[
          styles.tabButton,
          isActive && { backgroundColor: colors.gold },
          !isActive && { backgroundColor: colors.card },
        ]}
        onPress={() => setActiveTab(id)}
        accessibilityLabel={`${label}${isActive ? ', currently selected' : ''}`}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityHint={`Show ${label.toLowerCase()} products`}
      >
        <Text
          style={[
            styles.tabText,
            isActive
              ? { color: '#000000', fontFamily: TYPOGRAPHY.fontFamily.semiBold }
              : { color: colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const InventorySummaryBar = () => {
    if (isStatsLoading) {
      return (
        <View style={styles.summaryWrapper}>
          <View
            style={[styles.summaryBar, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
          >
            <Text style={{ color: '#FFF' }}>Loading stats...</Text>
          </View>
        </View>
      );
    }

    if (!inventoryStats) {
      return (
        <View style={styles.summaryWrapper}>
          <View
            style={[
              styles.summaryBar,
              { backgroundColor: 'rgba(255,0,0,0.5)' },
            ]}
          >
            <Text style={{ color: '#FFF' }}>No stats data</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.summaryWrapper}>
        <View
          style={[
            styles.summaryBar,
            {
              backgroundColor: isDark
                ? 'rgba(30, 30, 30, 0.85)'
                : 'rgba(255, 255, 255, 0.9)',
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.summaryItem}>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              Total Value
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatPrice(inventoryStats.inventoryValue, currencySymbol)}
            </Text>
          </View>

          <View
            style={[styles.summaryDivider, { backgroundColor: colors.border }]}
          />

          <View style={styles.summaryItem}>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              Stock Cost
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatPrice(inventoryStats.inventoryCost, currencySymbol)}
            </Text>
          </View>

          <View
            style={[styles.summaryDivider, { backgroundColor: colors.border }]}
          />

          <View style={styles.summaryItem}>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              Total Units
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {inventoryStats.totalStock.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <SystemBars style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Products</Text>
      </View>

      {/* Collapsible Search Bar */}
      <Animated.View
        style={[
          styles.searchContainer,
          {
            opacity: searchBarAnim,
            transform: [
              {
                translateY: searchBarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-60, 0],
                }),
              },
              {
                scaleY: searchBarAnim,
              },
            ],
          },
        ]}
      >
        <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search products..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search products"
            accessibilityRole="search"
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <Pressable
              onPress={() => setSearchQuery('')}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                minWidth: 44,
                minHeight: 44,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <StatCard
          label="In Stock"
          value={stats.active}
          color={colors.primary}
          isActive={activeTab === 'in_stock' || activeTab === 'all'}
          onPress={() => setActiveTab('in_stock')}
        />
        <StatCard
          label="Low Stock"
          value={stats.lowStock}
          color={colors.warning}
          isActive={activeTab === 'low_stock'}
          onPress={() => setActiveTab('low_stock')}
        />
        <StatCard
          label="Out of Stock"
          value={stats.outOfStock}
          color={colors.error}
          isActive={activeTab === 'out_of_stock'}
          onPress={() => setActiveTab('out_of_stock')}
        />
      </View>

      {/* Products List tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          <TabButton id="in_stock" label={`In Stock (${stats.active})`} />
          <TabButton id="top_selling" label="Top Selling" />
          <TabButton id="all" label={`All (${stats.total})`} />
          <TabButton
            id="categories"
            label={`Categories (${categories?.length ?? 0})`}
          />
        </ScrollView>
      </View>

      {activeTab === 'categories' ? (
        <FlashList
          data={categories}
          renderItem={renderCategory}
          keyExtractor={categoryKeyExtractor}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={isCategoriesLoading}
              onRefresh={refetchCategories}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
          ListEmptyComponent={
            !isCategoriesLoading ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="folder-open-outline"
                  size={56}
                  color={colors.textMuted}
                />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No categories found
                </Text>
                <Pressable
                  style={[
                    styles.emptyButton,
                    {
                      backgroundColor: colors.gold,
                      marginTop: 16,
                      minHeight: 44,
                    },
                  ]}
                  onPress={() => setIsCategoryModalVisible(true)}
                  accessibilityLabel="Create Category"
                  accessibilityRole="button"
                  accessibilityHint="Opens form to create a new product category"
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>Create Category</Text>
                </Pressable>
              </View>
            ) : null
          }
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
      ) : activeTab === 'top_selling' ? (
        <FlashList
          data={topSellingProducts}
          renderItem={renderTopSellingProduct}
          keyExtractor={topSellingKeyExtractor}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={isTopSellingLoading}
              onRefresh={refetchTopSelling}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
          ListEmptyComponent={
            !isTopSellingLoading ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="trophy-outline"
                  size={56}
                  color={colors.textMuted}
                />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No sales yet
                </Text>
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  Start selling to see top products here.
                </Text>
              </View>
            ) : (
              <ActivityIndicator
                size="large"
                color={colors.gold}
                style={{ marginTop: 20 }}
              />
            )
          }
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
      ) : (
        <FlashList
          data={displayData}
          renderItem={renderProduct}
          keyExtractor={productKeyExtractor}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={isProductsLoading}
              onRefresh={refetchProducts}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.gold} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !isProductsLoading ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="cube-outline"
                  size={56}
                  color={colors.textMuted}
                />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No products yet
                </Text>
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  Add your first product to get started
                </Text>
                <Pressable
                  style={[
                    styles.emptyButton,
                    { backgroundColor: colors.gold, minHeight: 44 },
                  ]}
                  onPress={() => router.push('/product/new')}
                  accessibilityLabel="Add Product"
                  accessibilityRole="button"
                  accessibilityHint="Opens form to create a new product"
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>Add Product</Text>
                </Pressable>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.gold },
          shadows.lg,
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
        onPress={() => {
          if (activeTab === 'categories') {
            setIsCategoryModalVisible(true);
          } else {
            router.push('/product/new');
          }
        }}
        accessibilityLabel={
          activeTab === 'categories' ? 'Add new category' : 'Add new product'
        }
        accessibilityRole="button"
        accessibilityHint={
          activeTab === 'categories'
            ? 'Opens form to create a new category'
            : 'Opens form to create a new product'
        }
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <InventorySummaryBar />

      {/* Create Category Modal */}
      <Modal
        visible={isCategoryModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsCategoryModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setIsCategoryModalVisible(false)}
          />
          <KeyboardAwareModalContainer align="center">
            <Pressable
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  color: colors.text,
                  marginBottom: 16,
                }}
              >
                Create Category
              </Text>

              <TextInput
                style={{
                  backgroundColor: colors.background,
                  color: colors.text,
                  padding: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginBottom: 16,
                }}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="e.g. Electronics"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Category name"
                returnKeyType="done"
                onSubmitEditing={handleCreateCategory}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                    minHeight: 44,
                    justifyContent: 'center',
                  }}
                  onPress={() => setIsCategoryModalVisible(false)}
                  accessibilityLabel="Cancel"
                  accessibilityRole="button"
                  accessibilityHint="Closes the create category dialog"
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  style={{
                    flex: 1,
                    backgroundColor: colors.primary,
                    padding: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                    minHeight: 44,
                    justifyContent: 'center',
                  }}
                  onPress={handleCreateCategory}
                  disabled={
                    createCategoryMutation.isPending || !newCategoryName.trim()
                  }
                  accessibilityLabel={
                    createCategoryMutation.isPending
                      ? 'Creating category'
                      : 'Create category'
                  }
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled:
                      createCategoryMutation.isPending ||
                      !newCategoryName.trim(),
                  }}
                  accessibilityHint="Creates the new category"
                >
                  {createCategoryMutation.isPending ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={{ color: '#FFF', fontWeight: '600' }}>
                      Create
                    </Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAwareModalContainer>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.size['3xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    paddingVertical: SPACING.xs,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statValue: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  tabsContainer: {
    marginBottom: SPACING.lg,
  },
  tabsContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  tabButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  categoryName: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  listContent: {
    padding: SPACING.lg,
    paddingTop: 0,
    gap: SPACING.md,
  },
  productCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.md,
    marginRight: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  productRank: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  price: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  comparePrice: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textDecorationLine: 'line-through',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stockText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  emptyButtonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    color: '#FFFFFF',
  },
  footerLoader: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300,
  },
  summaryWrapper: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 200,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 8,
  },
});
