import Ionicons from '@react-native-vector-icons/ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeImage } from '@/components/ui/SafeImage';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import type { Category } from '@/hooks';
import { createSafeBoundedImageSource } from '@/lib/safe-bounded-image-source';
import { formatPrice, type Product } from '@/types/product';
import { searchDropdownStyles as styles } from './SearchDropdown.styles';

const MAX_RESULTS = 6;
type ThemeColors = (typeof Colors)['light'];

interface SearchDropdownListProps {
  categories: Category[];
  colors: ThemeColors;
  isLoading: boolean;
  onCategoryPress: (slug: string) => void;
  onClearHistory: () => void;
  onProductPress: (product: Product) => void;
  onSuggestionPress: (term: string) => void;
  products: Product[];
  query: string;
  recentSearches: string[];
}

export function SearchDropdownList({
  categories,
  colors,
  isLoading,
  onCategoryPress,
  onClearHistory,
  onProductPress,
  onSuggestionPress,
  products,
  query,
  recentSearches,
}: SearchDropdownListProps) {
  const hasQuery = query.length >= 2;
  if (!hasQuery) {
    return (
      <>
        {recentSearches.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text
                style={[styles.sectionLabel, { color: colors.textSecondary }]}
              >
                Recent
              </Text>
              <Pressable onPress={onClearHistory} hitSlop={8}>
                <Text
                  style={[styles.clearText, { color: colors.textSecondary }]}
                >
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
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                    },
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
        ) : null}

        {categories.length > 0 ? (
          <View style={styles.section}>
            <Text
              style={[styles.sectionLabel, { color: colors.textSecondary }]}
            >
              Categories
            </Text>
            <View style={styles.categoryList}>
              {categories.slice(0, 5).map((category) => (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryRow,
                    { borderBottomColor: colors.border },
                  ]}
                  onPress={() => onCategoryPress(category.slug)}
                  accessibilityLabel={`Browse ${category.name}`}
                  accessibilityRole="button"
                >
                  <View
                    style={[
                      styles.categoryDot,
                      { backgroundColor: BRAND.primary },
                    ]}
                  />
                  <Text style={[styles.categoryName, { color: colors.text }]}>
                    {category.name}
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
        ) : null}
      </>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.statusContainer}>
        <ActivityIndicator size="small" color={BRAND.primary} />
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
          Searching…
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
            source={createSafeBoundedImageSource({
              fit: 'cover',
              height: 44,
              uri: product.image,
              width: 44,
            })}
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
              {product.brand ? (
                <Text
                  style={[styles.resultBrand, { color: colors.textSecondary }]}
                >
                  {product.brand}
                </Text>
              ) : null}
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
