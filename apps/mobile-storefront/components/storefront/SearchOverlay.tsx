/**
 * SearchOverlay Component
 *
 * Implements an inline search experience with:
 * - History & Suggestion dropdowns
 * - Live results
 * - AI integration points (Camera/Voice)
 * - Smooth layout animations
 *
 * 2026 Best Practices:
 * - KeyboardAVoidingView specific to platform
 * - Reanimated for layout transitions
 * - Accessibility roles and labels
 */

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { type Category, useCategories, useProducts } from '@/hooks';
import { useDebounce } from '@/hooks/use-debounce';
import { useSearchStorage } from '@/hooks/use-search-storage';
import type { Product } from '@/types/product';

interface SearchOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export function SearchOverlay({
  isVisible,
  onClose,
  initialQuery = '',
}: SearchOverlayProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState(initialQuery);

  // ⚡ Bolt: Replace useDeferredValue with useDebounce (250ms)
  // useDeferredValue only defers UI updates and still triggers the network hook
  // on every keystroke, causing API overfetching.
  const debouncedQuery = useDebounce(query, 250);

  const activeSearchQuery = debouncedQuery.trim();
  const hasSearchQuery = activeSearchQuery.length >= 2;

  // Custom hook usage
  const { recentSearches, saveSearch, clearHistory } = useSearchStorage();

  // Data fetching
  const { products, isLoading } = useProducts({
    search: activeSearchQuery.length >= 2 ? activeSearchQuery : undefined,
    limit: 10,
  });

  const { data: categories = [] } = useCategories();

  // Effects
  useEffect(() => {
    if (isVisible) {
      // Small timeout to allow animation to start before keyboard logic
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      Keyboard.dismiss();
    }
  }, [isVisible]);

  // Handlers
  const handleSearchSubmit = () => {
    if (query.trim().length >= 2) {
      saveSearch(query.trim());
      // Logic could navigate to full search results page OR show more here
      // prioritizing inline results for now, but deep link to search page on submit is valid too
      // router.push(`/search?q=${encodeURIComponent(query)}`); // Optional: maintain old route for full page
      Keyboard.dismiss();
    }
  };

  const handleProductPress = (product: Product) => {
    saveSearch(query.trim() || product.name);
    onClose();
    router.push(`/product/${product.slug}`);
  };

  const handleSuggestionPress = (suggestion: string) => {
    setQuery(suggestion);
    saveSearch(suggestion);
    // Trigger immediate search or focus
  };

  const handleCategoryPress = (slug: string) => {
    onClose();
    router.push({ pathname: '/category/[slug]', params: { slug } });
  };

  // Render Helpers
  const renderEmptyState = () => (
    <Animated.ScrollView
      entering={FadeIn.delay(200)}
      style={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Recent
            </Text>
            <Pressable
              onPress={clearHistory}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Clear recent searches"
            >
              <Text style={{ color: colors.text, opacity: 0.6, fontSize: 13 }}>
                Clear
              </Text>
            </Pressable>
          </View>
          <View style={styles.tagsContainer}>
            {recentSearches.map((term) => (
              <Pressable
                key={term}
                style={[
                  styles.tag,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => handleSuggestionPress(term)}
                accessibilityRole="button"
                accessibilityLabel={`Search for ${term}`}
              >
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={colors.text}
                  style={{ opacity: 0.6 }}
                />
                <Text style={{ color: colors.text, fontSize: 14 }}>{term}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Categories / Popular */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Explore Categories
        </Text>
        <View style={styles.categoriesGrid}>
          {categories.slice(0, 6).map((cat: Category) => (
            <Pressable
              key={cat.id}
              style={[
                styles.categoryCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => handleCategoryPress(cat.slug)}
              accessibilityRole="button"
              accessibilityLabel={`Explore category ${cat.name}`}
            >
              <Text style={[styles.categoryText, { color: colors.text }]}>
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* AI Prompt Placeholder */}
      <View style={[styles.aiPrompt, { borderColor: BRAND.primary }]}>
        <Ionicons name="sparkles" size={20} color={BRAND.primary} />
        <View>
          <Text style={[styles.aiTitle, { color: colors.text }]}>
            Ask AI to find a gift
          </Text>
          <Text style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>
            "Show me summer dresses for a wedding"
          </Text>
        </View>
      </View>
    </Animated.ScrollView>
  );

  const renderResults = () => {
    if (isLoading && hasSearchQuery) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={BRAND.primary} />
        </View>
      );
    }

    if (products.length === 0 && hasSearchQuery && !isLoading) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons
            name="search-outline"
            size={48}
            color={colors.text}
            style={{ opacity: 0.2 }}
          />
          <Text style={{ marginTop: 12, color: colors.text, opacity: 0.6 }}>
            No results found
          </Text>
        </View>
      );
    }

    return (
      <FlashList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.resultItem, { borderBottomColor: colors.border }]}
            onPress={() => handleProductPress(item)}
            accessibilityRole="button"
            accessibilityLabel={`View product ${item.name} by ${item.brand}`}
          >
            <View style={styles.resultDetails}>
              <Text
                style={[styles.resultTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>
                {item.brand}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.text}
              style={{ opacity: 0.3 }}
            />
          </Pressable>
        )}
        contentContainerStyle={{
          paddingHorizontal: SPACING.md,
          paddingBottom: 40,
        }}
        keyboardShouldPersistTaps="handled"
      />
    );
  };

  if (!isVisible) return null;

  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}
      accessibilityViewIsModal={true}
    >
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn}
        exiting={FadeOut}
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(0,0,0,0.4)' },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
        />
      </Animated.View>

      {/* Main Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
        entering={SlideInUp.duration(300)}
        exiting={SlideOutDown.duration(300)}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View
            style={[styles.inputContainer, { backgroundColor: colors.card }]}
          >
            <Ionicons
              name="search"
              size={20}
              color={colors.text}
              style={{ opacity: 0.5 }}
            />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="Search products..."
              placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
              style={[styles.input, { color: colors.text }]}
              returnKeyType="search"
              onSubmitEditing={handleSearchSubmit}
              clearButtonMode="while-editing"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search input"
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.text}
                  style={{ opacity: 0.5 }}
                />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Cancel search"
          >
            <Text style={[styles.cancelText, { color: colors.text }]}>
              Cancel
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          {!hasSearchQuery ? renderEmptyState() : renderResults()}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    paddingTop: SPACING.sm, // Add some top padding below safe area
    gap: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44, // Taller touch target
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  contentContainer: {
    flex: 1,
    padding: SPACING.md,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 6,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  categoryCard: {
    width: '48%', // Approx 2 columns
    padding: 16,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultDetails: {
    flex: 1,
    gap: 4,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  aiPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: 12,
    backgroundColor: 'rgba(BRAND.primary, 0.05)', // Fallback if brand unused, but styles handled inline above better
    marginBottom: 24,
    borderStyle: 'dashed',
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
});
