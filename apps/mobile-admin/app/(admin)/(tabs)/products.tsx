import Ionicons from '@react-native-vector-icons/ionicons';
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
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryItem } from '@/components/product/CategoryItem';
import { ProductItem } from '@/components/product/ProductItem';
import { ProductsSearchActions } from '@/components/product/ProductsSearchActions';
import { ProductsStatCards } from '@/components/product/ProductsStatCards';
import type { Category } from '@/components/product/product.shared';
import { TopSellingProductItem } from '@/components/product/TopSellingProductItem';
import { KeyboardAwareModalContainer } from '@/components/ui/KeyboardAwareModalContainer';
import { TopTabBar } from '@/components/ui/TopTabBar';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useDebounce } from '@/hooks/useDebounce';
import { useMerchant } from '@/hooks/useMerchant';
import {
  type Product,
  type StockFilter,
  useCategories,
  useCreateCategory,
  useInventoryStats,
  useProducts,
} from '@/hooks/useProducts';
import { useTheme } from '@/hooks/useTheme';
import {
  type TopSellingProduct,
  useTopSellingProducts,
} from '@/hooks/useTopSellingProducts';

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

// Helper functions moved to product.shared.ts
// Tabs available on the products screen
type ProductsTab =
  | 'all'
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'categories'
  | 'top_selling';

interface TabButtonProps {
  id: ProductsTab;
  label: string;
  activeTab: ProductsTab;
  onSelect: (id: ProductsTab) => void;
}

function TabButton({ id, label, activeTab, onSelect }: TabButtonProps) {
  const { colors } = useTheme();
  const isActive = activeTab === id;

  return (
    <Pressable
      style={[
        styles.tabButton,
        isActive && { backgroundColor: colors.gold },
        !isActive && { backgroundColor: colors.card },
      ]}
      onPress={() => onSelect(id)}
      accessibilityLabel={`${label}${isActive ? ', currently selected' : ''}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityHint={`Show ${label.toLowerCase()} products`}
    >
      <Text
        style={[
          styles.tabText,
          isActive
            ? {
                color: colors.background,
                fontFamily: TYPOGRAPHY.fontFamily.semiBold,
              }
            : { color: colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Navigation callback for products
function handleProductPress(id: string): void {
  router.push(`/product/${id}`);
}

// Navigation callback for categories
function handleCategoryPress(_id: string): void {
  Alert.alert(
    'Coming Soon',
    'Category filtering will be available in a future update.'
  );
}

export default function ProductsScreen() {
  const { colors, shadows, isDark } = useTheme();
  const { merchant } = useMerchant();
  const currencySymbol = getCurrencySymbol(merchant?.payout_currency);
  const [topTab, setTopTab] = useState<'in_stock' | 'on_website'>('in_stock');

  const handleTopTabChange = (tab: 'in_stock' | 'on_website') => {
    setTopTab(tab);
    if (tab === 'in_stock') {
      setActiveTab('in_stock');
    } else {
      setActiveTab('all');
    }
  };

  const [activeTab, setActiveTab] = useState<ProductsTab>('in_stock');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 250);

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
    error: productsError,
  } = useProducts({
    stockFilter,
    search: debouncedSearchQuery.trim() || undefined,
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
  const { data: inventoryStats } = useInventoryStats();

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

  // Collapsible search bar animation — useState initializer keeps a stable
  // Animated.Value without reading a ref during render (React Compiler safe).
  const [searchBarAnim] = useState(() => new Animated.Value(1));
  const [isSearchActionsVisible, setIsSearchActionsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const isSearchVisible = useRef(true);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const diff = currentScrollY - lastScrollY.current;

    if (Math.abs(diff) > 10) {
      if (diff > 0 && isSearchVisible.current && currentScrollY > 50) {
        isSearchVisible.current = false;
        setIsSearchActionsVisible(false);
        Animated.timing(searchBarAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else if (diff < 0 && !isSearchVisible.current) {
        isSearchVisible.current = true;
        setIsSearchActionsVisible(true);
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
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage && activeTab !== 'top_selling') {
      fetchNextPage();
    }
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

  const getEmptyStateDetails = () => {
    if (searchQuery.trim().length > 0) {
      return {
        icon: 'search-outline' as const,
        title: 'No search results',
        description: `We couldn't find any products matching "${searchQuery}". Check the spelling or try a different term.`,
        buttonLabel: 'Clear Search',
        onPress: () => setSearchQuery(''),
      };
    }

    if (topTab === 'in_stock') {
      if (activeTab === 'low_stock') {
        return {
          icon: 'shield-checkmark-outline' as const,
          title: 'Stock levels healthy',
          description:
            'Great job! None of your tracked items are running low on stock right now.',
          buttonLabel: null,
          onPress: null,
        };
      }
      if (activeTab === 'out_of_stock') {
        return {
          icon: 'checkmark-circle-outline' as const,
          title: 'Nothing depleted',
          description:
            'All managed inventory items have stock available right now.',
          buttonLabel: null,
          onPress: null,
        };
      }
      return {
        icon: 'calculator-outline' as const,
        title: 'Start managing stock',
        description:
          'Track inventory quantities, monitor low stock items, and watch your total stock value grow in real-time.',
        buttonLabel: 'Add Stocked Item',
        onPress: () => router.push('/product/new'),
      };
    }

    return {
      icon: 'globe-outline' as const,
      title: 'No items on website',
      description:
        'Create and list products in your online catalog so customers can view and purchase them.',
      buttonLabel: 'Add Product',
      onPress: () => router.push('/product/new'),
    };
  };

  const emptyState = getEmptyStateDetails();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Products</Text>
      </View>

      <TopTabBar
        activeTab={topTab}
        inStockCount={stats.active}
        onWebsiteCount={stats.total}
        onTabChange={handleTopTabChange}
      />

      <ProductsSearchActions
        colors={colors}
        isVisible={isSearchActionsVisible}
        onClearSearch={() => setSearchQuery('')}
        onScanPress={() => router.push('/scan')}
        onSearchChange={setSearchQuery}
        searchBarAnim={searchBarAnim}
        searchQuery={searchQuery}
      />

      <ProductsStatCards activeTab={topTab} />

      {/* Products List tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {topTab === 'in_stock' ? (
            <>
              <TabButton
                id="in_stock"
                label={`Items (${stats.active})`}
                activeTab={activeTab}
                onSelect={setActiveTab}
              />
              <TabButton
                id="categories"
                label={`Categories (${categories?.length ?? 0})`}
                activeTab={activeTab}
                onSelect={setActiveTab}
              />
              <TabButton
                id="low_stock"
                label={`Low Stock (${inventoryStats?.lowStockCount ?? 0})`}
                activeTab={activeTab}
                onSelect={setActiveTab}
              />
              <TabButton
                id="out_of_stock"
                label={`Out of Stock (${inventoryStats?.outOfStockCount ?? 0})`}
                activeTab={activeTab}
                onSelect={setActiveTab}
              />
              <TabButton
                id="top_selling"
                label="Top Selling"
                activeTab={activeTab}
                onSelect={setActiveTab}
              />
            </>
          ) : (
            <>
              <TabButton
                id="all"
                label={`Items (${stats.total})`}
                activeTab={activeTab}
                onSelect={setActiveTab}
              />
              <TabButton
                id="categories"
                label={`Categories (${categories?.length ?? 0})`}
                activeTab={activeTab}
                onSelect={setActiveTab}
              />
              <TabButton
                id="top_selling"
                label="Top Selling"
                activeTab={activeTab}
                onSelect={setActiveTab}
              />
            </>
          )}
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
                  <Ionicons name="add" size={20} color={colors.textOnPrimary} />
                  <Text
                    style={[
                      styles.emptyButtonText,
                      { color: colors.textOnPrimary },
                    ]}
                  >
                    Create Category
                  </Text>
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
                  name={
                    productsError ? 'alert-circle-outline' : emptyState.icon
                  }
                  size={56}
                  color={colors.textMuted}
                />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {productsError ? "Couldn't load products" : emptyState.title}
                </Text>
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  {productsError
                    ? 'Refresh the page or try again in a moment.'
                    : emptyState.description}
                </Text>
                {!productsError &&
                emptyState.buttonLabel &&
                emptyState.onPress ? (
                  <Pressable
                    style={[
                      styles.emptyButton,
                      { backgroundColor: colors.gold, minHeight: 44 },
                    ]}
                    onPress={emptyState.onPress}
                    accessibilityLabel={emptyState.buttonLabel}
                    accessibilityRole="button"
                    accessibilityHint={
                      emptyState.icon === 'search-outline'
                        ? 'Resets search query'
                        : 'Opens form to create a new product'
                    }
                  >
                    {emptyState.icon !== 'search-outline' && (
                      <Ionicons
                        name="add"
                        size={20}
                        color={colors.textOnPrimary}
                      />
                    )}
                    <Text
                      style={[
                        styles.emptyButtonText,
                        { color: colors.textOnPrimary },
                      ]}
                    >
                      {emptyState.buttonLabel}
                    </Text>
                  </Pressable>
                ) : null}
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
        <Ionicons name="add" size={28} color={colors.textOnPrimary} />
      </Pressable>

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
            backgroundColor: colors.backdrop,
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
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
                    <ActivityIndicator color={colors.textOnPrimary} />
                  ) : (
                    <Text
                      style={{ color: colors.textOnPrimary, fontWeight: '600' }}
                    >
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
    paddingHorizontal: 24,
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
  },
  footerLoader: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 125,
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
