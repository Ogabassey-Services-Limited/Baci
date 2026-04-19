/**
 * Search Screen
 * Product search with filters and results
 * 2026 Best Practice: Offline-aware with graceful degradation
 */

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { useDeferredValue, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// OfflineNotice removed as it was unused.
import { ProductCard } from '@/components/storefront/ProductCard';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useCategories, useProductBrands, useProducts } from '@/hooks';
import { useNetworkState } from '@/hooks/use-network-state';
import { resolveSelectedCategoryId } from '@/lib/product-filter-options';
import { syncStorage as storage } from '@/lib/storage';
import type { Product } from '@/types/product';

// 2026 Best Practice: Persist search history in storage
const SEARCH_HISTORY_KEY = 'search_history';
const MAX_SEARCH_HISTORY = 10;

const DEFAULT_SEARCHES = [
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

function dedupeRecentSearches(searches: string[]) {
  const seen = new Set<string>();

  return searches.filter((search) => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch || seen.has(normalizedSearch)) {
      return false;
    }

    seen.add(normalizedSearch);
    return true;
  });
}

// ... (imports remain)

export default function SearchScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // 2026 Best Practice: Network state monitoring for offline UX
  const { isOnline } = useNetworkState();

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const activeQuery = deferredQuery.trim();
  const [debouncedQuery, setDebouncedQuery] = useState(activeQuery);
  const hasSearchQuery = debouncedQuery.length >= 2;

  // Filter State
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [minRating, setMinRating] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // 2026 Best Practice: Persist search history
  const [recentSearches, setRecentSearches] =
    useState<string[]>(DEFAULT_SEARCHES);

  // Load search history from storage on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(activeQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [activeQuery]);

  useEffect(() => {
    const loadSearchHistory = () => {
      try {
        const saved = storage.getItem(SEARCH_HISTORY_KEY);
        if (saved) {
          // 2026 Critical Fix: Validate JSON.parse result with proper type guard
          let parsed: unknown;
          try {
            parsed = JSON.parse(saved);
          } catch {
            // Invalid JSON, use defaults
            return;
          }
          // BUG-2-003 FIX: Allow empty arrays, remove length check
          // Type guard: ensure parsed is string array
          if (
            Array.isArray(parsed) &&
            parsed.every((item): item is string => typeof item === 'string')
          ) {
            setRecentSearches(dedupeRecentSearches(parsed));
          }
        }
      } catch {
        // Use defaults on error
      }
    };
    loadSearchHistory();
  }, []);

  const commitSearchQuery = (value: string) => {
    const trimmedValue = value.trim();

    setDebouncedQuery(trimmedValue);

    if (trimmedValue.length >= 2) {
      saveToHistory(trimmedValue);
    }

    Keyboard.dismiss();
  };

  // Save search to history
  const saveToHistory = (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 2) return;

    setRecentSearches((prev) => {
      // Remove duplicates and add to front
      const filtered = prev.filter(
        (s) => s.toLowerCase() !== searchTerm.toLowerCase()
      );
      const updated = [searchTerm, ...filtered].slice(0, MAX_SEARCH_HISTORY);

      // Persist to storage
      try {
        storage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }

      return updated;
    });
  };

  const { data: categories = [] } = useCategories();
  const selectedCategoryId = resolveSelectedCategoryId(
    selectedCategory,
    categories
  );

  const { products, isLoading } = useProducts({
    search: hasSearchQuery ? debouncedQuery : undefined,
    limit: 20,
    category: selectedCategoryId,
    brand: selectedBrand !== 'All' ? selectedBrand : undefined,
    condition: selectedCondition !== 'All' ? selectedCondition : undefined,
    minPrice: minPrice > 0 ? minPrice : undefined,
    maxPrice: maxPrice > 0 ? maxPrice : undefined,
    minRating: minRating > 0 ? minRating : undefined,
  });
  const { brands: brandNames } = useProductBrands({
    search: hasSearchQuery ? debouncedQuery : undefined,
    category: selectedCategoryId,
    condition: selectedCondition !== 'All' ? selectedCondition : undefined,
    minPrice: minPrice > 0 ? minPrice : undefined,
    maxPrice: maxPrice > 0 ? maxPrice : undefined,
    minRating: minRating > 0 ? minRating : undefined,
  });

  // Derived data for filters (mocking for now)
  // Derive brand names for filter
  const categoryNames = ['All', ...categories.map((c) => c.name)];

  useEffect(() => {
    if (selectedBrand !== 'All' && !brandNames.includes(selectedBrand)) {
      setSelectedBrand('All');
    }
  }, [brandNames, selectedBrand]);

  const handleRecentSearch = (search: string) => {
    setQuery(search);
    saveToHistory(search);
    Keyboard.dismiss();
  };

  const handleCategoryPress = (slug: string) => {
    // 2026 Critical Fix: Use proper Href type for type-safe navigation
    router.push({ pathname: '/category/[slug]', params: { slug } });
  };

  const handleProductPress = (product: Product) => {
    if (hasSearchQuery) {
      saveToHistory(debouncedQuery);
    }
    router.push(`/product/${product.slug}`);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setMinPrice(0);
    setMaxPrice(0);
    setSelectedBrand('All');
    setSelectedCondition('All');
    setMinRating(0);
  };

  const renderSearchResults = () => {
    // 2026 Best Practice: Show offline message when searching without internet
    if (!isOnline && hasSearchQuery) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="cloud-offline-outline"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            You're offline
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Connect to the internet to search products
          </Text>
        </View>
      );
    }

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

    if (products.length === 0 && hasSearchQuery) {
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
      <FlashList
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
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
          {recentSearches.map((search) => (
            <Pressable
              key={`${search}-${search.toLowerCase()}`}
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
        {/* BUG-2-008 FIX: Implement proper search header with TextInput */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View
            style={[
              styles.searchInputContainer,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={colors.icon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search products..."
              placeholderTextColor={colors.placeholder}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => {
                commitSearchQuery(query);
              }}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus // eslint-disable-line jsx-a11y/no-autofocus -- search screen should focus input on open
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => {
                  setQuery('');
                }}
              >
                <Ionicons name="close-circle" size={18} color={colors.icon} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Filter Bar - Show only when searching */}
        {hasSearchQuery && (
          <FilterBar
            categories={categoryNames}
            selectedCategory={selectedCategory}
            onSelectCategory={handleCategorySelect}
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
        {hasSearchQuery ? renderSearchResults() : renderSuggestions()}
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
