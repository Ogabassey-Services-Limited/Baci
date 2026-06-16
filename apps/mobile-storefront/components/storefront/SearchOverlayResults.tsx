import Ionicons from '@react-native-vector-icons/ionicons';
import { FlashList } from '@shopify/flash-list';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND, SPACING } from '@/constants/Colors';
import type { Product } from '@/types/product';
import { searchOverlayStyles as styles } from './SearchOverlay.styles';

type SearchOverlayColors = (typeof Colors)['light'];

interface SearchOverlayResultsProps {
  colors: SearchOverlayColors;
  products: Product[];
  isLoading: boolean;
  hasSearchQuery: boolean;
  onProductPress: (product: Product) => void;
}

export function SearchOverlayResults({
  colors,
  products,
  isLoading,
  hasSearchQuery,
  onProductPress,
}: SearchOverlayResultsProps) {
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
          onPress={() => onProductPress(item)}
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
}
