import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import SearchScreenView from '@/components/search/SearchScreenView';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useCategories, useProductBrands, useProducts } from '@/hooks';
import { useNetworkState } from '@/hooks/use-network-state';
import { resolveSelectedCategoryId } from '@/lib/product-filter-options';
import { syncStorage as storage } from '@/lib/storage';
import type { Product } from '@/types/product';

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_SEARCH_HISTORY = 10;
const DEFAULT_SEARCHES = [
  'iPhone 15 Pro',
  'Samsung Galaxy S24',
  'AirPods Pro',
  'MacBook Air',
  'Apple Watch',
];

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

function loadInitialRecentSearches(): string[] {
  try {
    const saved = storage.getItem(SEARCH_HISTORY_KEY);
    if (!saved) return DEFAULT_SEARCHES;

    let parsed: unknown;
    try {
      parsed = JSON.parse(saved);
    } catch {
      return DEFAULT_SEARCHES;
    }

    if (
      Array.isArray(parsed) &&
      parsed.every((item): item is string => typeof item === 'string')
    ) {
      return dedupeRecentSearches(parsed);
    }
  } catch {
    // Retain defaults when device storage is unavailable.
  }

  return DEFAULT_SEARCHES;
}

export default function SearchScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { isOnline } = useNetworkState();
  const [query, setQuery] = useState('');
  const activeQuery = query.trim();
  const [debouncedQuery, setDebouncedQuery] = useState(activeQuery);
  const hasSearchQuery = debouncedQuery.length >= 2;
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [minRating, setMinRating] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [recentSearches, setRecentSearches] = useState<string[]>(
    loadInitialRecentSearches
  );
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(activeQuery);
      debounceTimerRef.current = null;
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [activeQuery]);

  const saveToHistory = (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 2) return;

    setRecentSearches((previousSearches) => {
      const filtered = previousSearches.filter(
        (search) => search.toLowerCase() !== searchTerm.toLowerCase()
      );
      const updated = [searchTerm, ...filtered].slice(0, MAX_SEARCH_HISTORY);

      try {
        storage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      } catch {
        // Search remains usable if persistence fails.
      }

      return updated;
    });
  };

  const commitSearchQuery = (value: string) => {
    const trimmedValue = value.trim();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    setQuery(trimmedValue);
    setDebouncedQuery(trimmedValue);
    if (trimmedValue.length >= 2) {
      saveToHistory(trimmedValue);
    }
    Keyboard.dismiss();
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
  const categoryNames = ['All', ...categories.map((category) => category.name)];

  // Adjust state inline during render (guarded, converges after one pass) so
  // an invalid brand filter never commits a stale frame.
  if (selectedBrand !== 'All' && !brandNames.includes(selectedBrand)) {
    setSelectedBrand('All');
  }

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setMinPrice(0);
    setMaxPrice(0);
    setSelectedBrand('All');
    setSelectedCondition('All');
    setMinRating(0);
  };

  const handleProductPress = (product: Product) => {
    if (hasSearchQuery) {
      saveToHistory(debouncedQuery);
    }
    router.push(`/product/${product.slug}`);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SearchScreenView
        brandNames={brandNames}
        categories={categories}
        categoryNames={categoryNames}
        colors={colors}
        hasSearchQuery={hasSearchQuery}
        isLoading={isLoading}
        isOnline={isOnline}
        maxPrice={maxPrice}
        minPrice={minPrice}
        minRating={minRating}
        onBack={() => router.back()}
        onCategoryPress={(slug) =>
          router.push({ pathname: '/category/[slug]', params: { slug } })
        }
        onCategorySelect={handleCategorySelect}
        onClearQuery={() => setQuery('')}
        onPriceChange={(minimum, maximum) => {
          setMinPrice(minimum);
          setMaxPrice(maximum);
        }}
        onProductPress={handleProductPress}
        onQueryChange={setQuery}
        onRecentSearch={(search) => {
          setQuery(search);
          saveToHistory(search);
          Keyboard.dismiss();
        }}
        onSelectBrand={setSelectedBrand}
        onSelectCondition={setSelectedCondition}
        onSelectRating={setMinRating}
        onSubmitQuery={() => commitSearchQuery(query)}
        onViewModeChange={setViewMode}
        products={products}
        query={query}
        recentSearches={recentSearches}
        selectedBrand={selectedBrand}
        selectedCategory={selectedCategory}
        selectedCondition={selectedCondition}
        viewMode={viewMode}
      />
    </>
  );
}
