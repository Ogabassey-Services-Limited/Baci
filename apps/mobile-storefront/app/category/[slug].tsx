/**
 * Category Screen
 * Displays products filtered by category slug
 */

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductCard } from '@/components/storefront/ProductCard';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useProducts } from '@/hooks/use-products';
import type { Product } from '@/types/product';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const { products, isLoading, error, hasMore, refetch, loadMore } =
    useProducts({ category: slug, limit: 20 });

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadMore();
    }
  }, [isLoading, hasMore, loadMore]);

  const handleProductPress = (product: Product) => {
    router.push(`/product/${product.slug}`);
  };

  const getCategoryTitle = (slug: string): string => {
    const titles: Record<string, string> = {
      all: 'All Products',
      iphones: 'iPhones',
      samsung: 'Samsung',
      laptops: 'Laptops',
      accessories: 'Accessories',
      tablets: 'Tablets',
      smartwatches: 'Smart Watches',
    };
    return (
      titles[slug] ||
      slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
    );
  };

  const renderProduct = ({ item, index }: { item: Product; index: number }) => (
    <View
      style={[
        styles.productWrapper,
        index % 2 === 0 ? styles.productLeft : styles.productRight,
      ]}
    >
      <ProductCard product={item} onPress={() => handleProductPress(item)} />
    </View>
  );

  const renderFooter = () => {
    if (!hasMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={BRAND.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={BRAND.primary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Loading products...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Something went wrong
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {error}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bag-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No products found
        </Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Check back later for products in this category
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <Stack.Screen
        options={{
          title: getCategoryTitle(slug || ''),
          headerBackTitle: 'Back',
        }}
      />
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
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
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.row}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  row: {
    paddingHorizontal: 16,
  },
  productWrapper: {
    flex: 1,
  },
  productLeft: {
    paddingRight: 8,
  },
  productRight: {
    paddingLeft: 8,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
  },
});
