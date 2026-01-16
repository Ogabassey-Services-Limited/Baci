/**
 * Search Screen
 * Product search with filters and results
 */

import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  type TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductCard } from '@/components/storefront/ProductCard';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useCategories, useProducts } from '@/hooks/use-products-query';
import type { Product } from '@/types/product';

const RECENT_SEARCHES = [
  'iPhone 15 Pro',
  'Samsung Galaxy S24',
  'AirPods Pro',
  'MacBook Air',
  'Apple Watch',
];

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  phones: 'phone-portrait-outline',
  gaming: 'game-controller-outline',
  accessories: 'headset-outline',
  laptops: 'laptop-outline',
  audio: 'musical-notes-outline',
  tablets: 'tablet-portrait-outline',
  smartwatches: 'watch-outline',
};

import { FilterBar } from '@/components/storefront/FilterBar';

// ... (imports remain)

export default function SearchScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Filter State
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [minRating, setMinRating] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { products, isLoading } = useProducts({
    search: query.length >= 2 ? query : undefined,
    limit: 20,
  });

  const { data: categories = [] } = useCategories();

  // Derived data for filters (mocking for now)
  // Derive brand names for filter
  const categoryNames = ['All', ...categories.map((c) => c.name)];
  const brandNames = Array.from(
    new Set(products.map((p) => p.brand).filter(Boolean) as string[])
  ).slice(0, 10);

  const _handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (text.length >= 2) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, []);

  const _handleClear = () => {
    setQuery('');
    setIsSearching(false);
    inputRef.current?.focus();
  };

  const handleRecentSearch = (search: string) => {
    setQuery(search);
    setIsSearching(true);
    Keyboard.dismiss();
  };

  const handleCategoryPress = (slug: string) => {
    router.push(`/category/${slug}` as any);
  };

  const handleProductPress = (product: Product) => {
    router.push(`/product/${product.slug}`);
  };

  const renderSearchResults = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Searching...
          </Text>
        </View>
      );
    }

    if (products.length === 0 && query.length >= 2) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="search-outline"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No results found
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Try searching for something else
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={products}
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.productWrapper,
              index % 2 === 0 ? styles.productLeft : styles.productRight,
            ]}
          >
            <ProductCard
              product={item}
              onPress={() => handleProductPress(item)}
            />
          </View>
        )}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.resultsContainer}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    );
  };

  const renderSuggestions = () => (
    <View style={styles.suggestionsContainer}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Recent Searches
        </Text>
        <View style={styles.recentList}>
          {RECENT_SEARCHES.map((search, index) => (
            <Pressable
              key={index}
              style={[styles.recentItem, { borderBottomColor: colors.border }]}
              onPress={() => handleRecentSearch(search)}
              accessibilityRole="button"
              accessibilityLabel={`Recent search: ${search}`}
            >
              <Ionicons name="time-outline" size={16} color={colors.icon} />
              <Text style={[styles.recentText, { color: colors.text }]}>
                {search}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Popular Categories
        </Text>
        <View style={styles.categoriesGrid}>
          {categories.slice(0, 4).map((category) => (
            <Pressable
              key={category.slug}
              style={[
                styles.categoryCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => handleCategoryPress(category.slug)}
              accessibilityRole="button"
              accessibilityLabel={`Category: ${category.name}`}
            >
              <Ionicons
                name={CATEGORY_ICONS[category.slug] || 'cube-outline'}
                size={24}
                color={BRAND.primary}
              />
              <Text style={[styles.categoryName, { color: colors.text }]}>
                {category.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        {/* Search Header */}
        <View style={styles.header}>{/* ... header code ... */}</View>

        {/* Filter Bar - Show only when searching */}
        {isSearching && (
          <FilterBar
            categories={categoryNames}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            minPrice={minPrice}
            maxPrice={maxPrice}
            onPriceChange={(min, max) => {
              setMinPrice(min);
              setMaxPrice(max);
            }}
            brands={brandNames}
            selectedBrand={selectedBrand}
            onSelectBrand={setSelectedBrand}
            selectedCondition={selectedCondition}
            onSelectCondition={setSelectedCondition}
            minRating={minRating}
            onSelectRating={setMinRating}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        )}

        {/* Content */}
        {isSearching ? renderSearchResults() : renderSuggestions()}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  suggestionsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  recentList: {
    gap: 8,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  recentText: {
    fontSize: 15,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '47%',
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
  },
  resultsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  row: {
    gap: 0,
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
});
