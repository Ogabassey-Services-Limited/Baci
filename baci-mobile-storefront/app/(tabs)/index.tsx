import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, Pressable, StatusBar, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import Colors, { BRAND, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Header } from '@/components/storefront/Header';
import { BlockRenderer } from '@/components/storefront/BlockRenderer';
import { useProducts, usePrefetchProduct, useCategories, usePageConfig } from '@/hooks/use-products-query';
import { ProductGridSkeleton, HeroSkeleton, Skeleton } from '@/components/ui/Skeleton';
import type { Product } from '@/types/product';
import { SnowEffect } from '@/components/ui/SnowEffect';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const { data: pageConfig, isLoading: isConfigLoading } = usePageConfig('home');
  const { data: categories = [] } = useCategories();

  const {
    products,
    isLoading: isProductsLoading,
    isFetching,
    error,
    hasMore,
    refetch,
    loadMore,
    isLoadingMore,
  } = useProducts({
    limit: 20,
    category: selectedCategoryId || undefined
  });

  const prefetchProduct = usePrefetchProduct();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      loadMore();
    }
  }, [isLoadingMore, hasMore, loadMore]);

  const handleSearch = useCallback(() => {
    router.push('/search');
  }, []);

  const handleCategorySelect = (id: string | null) => {
    setSelectedCategoryId(id);
  };

  // Convert products array for 2-column grid rendering
  const pairedProducts = useMemo(() => {
    const pairs: Product[][] = [];
    for (let i = 0; i < products.length; i += 2) {
      if (i + 1 < products.length) {
        pairs.push([products[i], products[i + 1]]);
      } else {
        pairs.push([products[i]]);
      }
    }
    return pairs;
  }, [products]);

  // Default "Elite" layout if no config exists
  const defaultBlocks = useMemo(() => [
    { type: 'HeroCarousel', props: { id: 'default-hero' } },
    { type: 'CategoryRail', props: { id: 'default-categories', title: 'Shop by Category' } },
    { type: 'ProductGrid', props: { id: 'default-products', title: 'Featured Products', limit: 12 } }
  ], []);

  const blocks = (pageConfig?.content || defaultBlocks) as any[];

  if (isConfigLoading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showSearch={true} />
        <HeroSkeleton />
        <ProductGridSkeleton count={4} />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <StatusBar barStyle="light-content" />
      <Header showSearch={true} onSearchPress={handleSearch} />

      <BlockRenderer
        blocks={blocks}
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={handleCategorySelect}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SnowEffect />
      <FlashList
        data={[]} // We use ListHeaderComponent for the block-based content
        renderItem={() => null}
        ListHeaderComponent={renderHeader}
        estimatedItemSize={1000}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={BRAND.primary}
            colors={[BRAND.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Background refresh indicator */}
      {isFetching && !refreshing && !isProductsLoading && (
        <View style={styles.backgroundRefreshIndicator}>
          <View style={[styles.refreshDot, { backgroundColor: BRAND.primary }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    marginBottom: 0,
  },
  heroSkeletonContainer: {
    backgroundColor: '#1a1a1a',
    padding: SPACING.md,
  },
  // Section header
  utilityPanel: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  categoryRail: {
    paddingHorizontal: 16,
    gap: 10,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm + 4,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: 'Inter_600SemiBold',
  },
  seeAllLink: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_600SemiBold',
  },
  linkPressed: {
    opacity: 0.7,
  },
  // Product grid
  listContent: {
    paddingBottom: SPACING.lg,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
  },
  productWrapper: {
    flex: 1,
  },
  productLeft: {
    paddingRight: SPACING.sm,
  },
  productRight: {
    paddingLeft: SPACING.sm,
  },
  footer: {
    paddingVertical: SPACING.sm,
  },
  // Empty state
  emptyContainer: {
    paddingVertical: SPACING['3xl'],
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: 'Inter_600SemiBold',
    marginTop: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    maxWidth: 280,
  },
  retryButton: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.md,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_600SemiBold',
  },
  // Loading indicator
  backgroundRefreshIndicator: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  refreshDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    opacity: 0.7,
  },
});
