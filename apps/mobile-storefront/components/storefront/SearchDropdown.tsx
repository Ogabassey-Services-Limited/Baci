/**
 * SearchDropdown — anchored dropdown panel beneath the Header search bar.
 *
 * Unlike a full-screen overlay, this panel:
 * - Slides down from directly under the header
 * - Shows recent searches as chips, category quick-links, and live results
 * - Keeps the page content partially visible underneath (light scrim)
 * - Dismisses on backdrop tap, Cancel press, or product navigation
 *
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SafeImage } from '@/components/ui/SafeImage';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';
import { type Category, useCategories, useProducts, useDebounce } from '@/hooks';
import { useSearchStorage } from '@/hooks/use-search-storage';
import { formatPrice, type Product } from '@/types/product';

const MAX_RESULTS = 6;

interface SearchDropdownProps {
  isVisible: boolean;
  onClose: () => void;
  /** Vertical offset from top of screen to position the dropdown */
  topOffset: number;
  /** Optional: external search query for dual-control scenarios */
  query?: string;
  /** Optional: callback for external query changes */
  onQueryChange?: (text: string) => void;
  /** If true, the internal search bar is hidden — usually because Header is handling it */
  hideInput?: boolean;
}

export function SearchDropdown({
  isVisible,
  onClose,
  topOffset,
  query: externalQuery,
  onQueryChange: onExternalQueryChange,
  hideInput = false,
}: SearchDropdownProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [internalQuery, setInternalQuery] = useState('');

  // Use external query if provided, otherwise internal
  const activeQuery =
    externalQuery !== undefined ? externalQuery : internalQuery;
  const debouncedQuery = useDebounce(activeQuery, 300);
  const effectiveQuery = debouncedQuery.trim();
  const setQuery = onExternalQueryChange || setInternalQuery;

  const { recentSearches, saveSearch, clearHistory } = useSearchStorage();
  const { products, isLoading } = useProducts({
    search: effectiveQuery.length >= 2 ? effectiveQuery : undefined,
    limit: MAX_RESULTS,
  });
  const { data: categories = [] } = useCategories();

  useEffect(() => {
    if (isVisible && !hideInput) {
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
    if (!isVisible) {
      Keyboard.dismiss();
      if (externalQuery === undefined) {
        setInternalQuery('');
      }
    }
  }, [isVisible, hideInput, externalQuery]);

  const handleProductPress = (product: Product) => {
    saveSearch(activeQuery.trim() || product.name);
    onClose();
    router.push(`/product/${product.slug}`);
  };

  const handleSuggestionPress = (term: string) => {
    setQuery(term);
    saveSearch(term);
    // Focus the input if it's visible
    if (!hideInput) {
      inputRef.current?.focus();
    }
  };

  const handleCategoryPress = (slug: string) => {
    onClose();
    router.push({ pathname: '/category/[slug]', params: { slug } });
  };

  const handleSubmit = () => {
    if (activeQuery.trim().length >= 2) {
      saveSearch(activeQuery.trim());
      Keyboard.dismiss();
    }
  };

  if (!isVisible) return null;

  const hasQuery = effectiveQuery.length >= 2;

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      {/* Scrim — light so the page shows through */}
      <Pressable
        style={[StyleSheet.absoluteFill, styles.scrim]}
        onPress={onClose}
        accessibilityLabel="Close search"
        accessibilityRole="button"
      />

      {/* Dropdown panel — anchored below header */}
      <View
        style={[
          styles.panel,
          {
            top: topOffset,
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
          SHADOWS.lg,
        ]}
      >
        {/* Search input row — hidden if Header is handling it */}
        {!hideInput && (
          <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
            <View
              style={[styles.inputContainer, { backgroundColor: colors.muted }]}
            >
              <Ionicons name="search" size={18} color={colors.icon} />
              <TextInput
                ref={inputRef}
                value={activeQuery}
                onChangeText={setQuery}
                placeholder="Search products..."
                placeholderTextColor={colors.placeholder}
                style={[styles.input, { color: colors.text }]}
                returnKeyType="search"
                onSubmitEditing={handleSubmit}
                clearButtonMode="while-editing"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {activeQuery.length > 0 && (
                <Pressable
                  onPress={() => setQuery('')}
                  hitSlop={8}
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={18} color={colors.icon} />
                </Pressable>
              )}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="Cancel search"
              accessibilityRole="button"
            >
              <Text style={[styles.cancelText, { color: BRAND.primary }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        )}

        {/* Scrollable content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {!hasQuery ? (
            <IdleContent
              recentSearches={recentSearches}
              categories={categories}
              colors={colors}
              onSuggestionPress={handleSuggestionPress}
              onCategoryPress={handleCategoryPress}
              onClearHistory={clearHistory}
            />
          ) : (
            <ResultsContent
              products={products}
              isLoading={isLoading}
              query={effectiveQuery}
              colors={colors}
              onProductPress={handleProductPress}
            />
          )}
        </ScrollView>
      </View>
    </View>
  );
}

/* ──────────────────────────── Sub-components ──────────────────────────── */

interface IdleContentProps {
  recentSearches: string[];
  categories: Category[];
  colors: (typeof Colors)['light'];
  onSuggestionPress: (term: string) => void;
  onCategoryPress: (slug: string) => void;
  onClearHistory: () => void;
}

function IdleContent({
  recentSearches,
  categories,
  colors,
  onSuggestionPress,
  onCategoryPress,
  onClearHistory,
}: IdleContentProps) {
  return (
    <>
      {/* Recent searches */}
      {recentSearches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text
              style={[styles.sectionLabel, { color: colors.textSecondary }]}
            >
              Recent
            </Text>
            <Pressable onPress={onClearHistory} hitSlop={8}>
              <Text style={[styles.clearText, { color: colors.textSecondary }]}>
                Clear
              </Text>
            </Pressable>
          </View>
          <View style={styles.chipsRow}>
            {recentSearches.slice(0, 6).map((term) => (
              <Pressable
                key={term}
                style={[
                  styles.chip,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                ]}
                onPress={() => onSuggestionPress(term)}
                accessibilityLabel={`Search for ${term}`}
                accessibilityRole="button"
              >
                <Ionicons
                  name="time-outline"
                  size={13}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.chipText, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {term}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            Categories
          </Text>
          <View style={styles.categoryList}>
            {categories.slice(0, 5).map((cat) => (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryRow,
                  { borderBottomColor: colors.border },
                ]}
                onPress={() => onCategoryPress(cat.slug)}
                accessibilityLabel={`Browse ${cat.name}`}
                accessibilityRole="button"
              >
                <View
                  style={[
                    styles.categoryDot,
                    { backgroundColor: BRAND.primary },
                  ]}
                />
                <Text style={[styles.categoryName, { color: colors.text }]}>
                  {cat.name}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={colors.icon}
                  style={{ opacity: 0.5 }}
                />
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

interface ResultsContentProps {
  products: Product[];
  isLoading: boolean;
  query: string;
  colors: (typeof Colors)['light'];
  onProductPress: (product: Product) => void;
}

function ResultsContent({
  products,
  isLoading,
  query,
  colors,
  onProductPress,
}: ResultsContentProps) {
  if (isLoading) {
    return (
      <View style={styles.statusContainer}>
        <ActivityIndicator size="small" color={BRAND.primary} />
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
          Searching...
        </Text>
      </View>
    );
  }

  if (!products || products.length === 0) {
    return (
      <View style={styles.statusContainer}>
        <Ionicons
          name="search-outline"
          size={32}
          color={colors.icon}
          style={{ opacity: 0.4 }}
        />
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
          No results for "{query}"
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.resultsList}>
      {products.slice(0, MAX_RESULTS).map((product) => (
        <Pressable
          key={product.id}
          style={[styles.resultRow, { borderBottomColor: colors.border }]}
          onPress={() => onProductPress(product)}
          accessibilityLabel={`${product.name}, ${formatPrice(product.price)}`}
          accessibilityRole="button"
        >
          <SafeImage
            source={{ uri: product.image }}
            style={[styles.resultThumb, { backgroundColor: colors.muted }]}
            contentFit="cover"
            fallbackIconSize={20}
          />
          <View style={styles.resultInfo}>
            <Text
              style={[styles.resultName, { color: colors.text }]}
              numberOfLines={1}
            >
              {product.name}
            </Text>
            <View style={styles.resultMeta}>
              <Text style={[styles.resultPrice, { color: BRAND.primary }]}>
                {formatPrice(product.price)}
              </Text>
              {product.brand && (
                <Text
                  style={[styles.resultBrand, { color: colors.textSecondary }]}
                >
                  {product.brand}
                </Text>
              )}
            </View>
          </View>
          <Ionicons
            name="arrow-forward-outline"
            size={14}
            color={colors.icon}
            style={{ opacity: 0.4 }}
          />
        </Pressable>
      ))}
    </View>
  );
}

/* ──────────────────────────── Styles ──────────────────────────── */

const styles = StyleSheet.create({
  root: {
    zIndex: 9999,
  },
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    maxHeight: '60%',
    borderBottomLeftRadius: RADIUS['2xl'],
    borderBottomRightRadius: RADIUS['2xl'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
    ...Platform.select({
      android: { paddingVertical: 0 },
    }),
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    flexGrow: 0,
  },
  contentInner: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },

  /* Idle state */
  section: {
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearText: {
    fontSize: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  chipText: {
    fontSize: 13,
    maxWidth: 120,
  },
  categoryList: {
    marginTop: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },

  /* Results */
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  statusText: {
    fontSize: 13,
  },
  resultsList: {
    gap: 0,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  resultThumb: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '500',
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultPrice: {
    fontSize: 13,
    fontWeight: '700',
  },
  resultBrand: {
    fontSize: 12,
  },
});
