/**
 * Products Screen - Product/Inventory Management
 * View and manage product catalog with real-time data
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Image,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useProducts, type Product } from '@/hooks/useProducts';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';

export default function ProductsScreen() {
  const { colors, shadows, isDark } = useTheme();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useProducts();

  // Flatten pages into single array
  const products = useMemo(() => {
    return data?.pages.flatMap((page) => page.products) ?? [];
  }, [data]);

  const totalCount = data?.pages[0]?.totalCount ?? 0;

  // Calculate stats
  const stats = useMemo(() => {
    const active = products.filter((p) => p.status === 'active').length;
    const lowStock = products.filter((p) => (p.stock ?? p.stock_quantity ?? 0) < 10 && (p.stock ?? p.stock_quantity ?? 0) > 0).length;
    const outOfStock = products.filter((p) => (p.stock ?? p.stock_quantity ?? 0) === 0).length;
    return { total: totalCount, active, lowStock, outOfStock };
  }, [products, totalCount]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const formatPrice = (amount: number) => {
    return `₦${amount.toLocaleString()}`;
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: 'Out of stock', color: colors.error };
    if (stock < 10) return { label: `${stock} left`, color: colors.warning };
    return { label: `${stock} in stock`, color: colors.success };
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const stock = item.stock ?? item.stock_quantity ?? 0;
    const stockStatus = getStockStatus(stock);
    const imageUrl = item.images?.[0];

    return (
      <Pressable
        style={({ pressed }) => [
          styles.productCard,
          { backgroundColor: colors.card },
          shadows.sm,
          pressed && { backgroundColor: colors.cardHover },
        ]}
        onPress={() => router.push(`/product/${item.id}`)}
      >
        <View style={[styles.productImage, { backgroundColor: colors.backgroundLight }]}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <Ionicons name="image-outline" size={24} color={colors.textMuted} />
          )}
        </View>

        <View style={styles.productInfo}>
          <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>

          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.text }]}>{formatPrice(item.price)}</Text>
            {item.compare_at_price && item.compare_at_price > item.price && (
              <Text style={[styles.comparePrice, { color: colors.textMuted }]}>{formatPrice(item.compare_at_price)}</Text>
            )}
          </View>

          <View style={styles.stockRow}>
            <View style={[styles.stockDot, { backgroundColor: stockStatus.color }]} />
            <Text style={[styles.stockText, { color: stockStatus.color }]}>
              {stockStatus.label}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Products</Text>
        <View style={styles.headerActions}>
          <Pressable style={[styles.headerButton, { backgroundColor: colors.card }]}>
            <Ionicons name="search" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            style={[styles.headerButton, { backgroundColor: colors.gold }]}
            onPress={() => router.push('/product/new')}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* Stats Summary */}
      <View style={[styles.statsRow, { backgroundColor: colors.card }, shadows.sm]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>{stats.active}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.warning }]}>{stats.lowStock}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Low Stock</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.error }]}>{stats.outOfStock}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Out</Text>
        </View>
      </View>

      {/* Products List */}
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={56} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No products yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Add your first product to get started</Text>
              <Pressable
                style={[styles.emptyButton, { backgroundColor: colors.gold }]}
                onPress={() => router.push('/product/new')}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Add Product</Text>
              </Pressable>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
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
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
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
});
