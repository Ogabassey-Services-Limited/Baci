import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, type ThemeColors } from '@/constants/theme';
import type {
  ProductMatchCandidate,
  RankedProductMatch,
} from '@/lib/product-matching';

interface ExistingProductSuggestionsProps {
  colors: ThemeColors;
  suggestions: RankedProductMatch<ProductMatchCandidate>[];
  onOpenProduct: (productId: string) => void;
}

export function ExistingProductSuggestions({
  colors,
  suggestions,
  onOpenProduct,
}: ExistingProductSuggestionsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  const hasExactMatch = suggestions.some((suggestion) => suggestion.isExact);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: hasExactMatch
            ? colors.warningLight
            : colors.primaryLight,
          borderColor: hasExactMatch ? colors.warning : colors.primary,
        },
      ]}
    >
      <View style={styles.header}>
        <Ionicons
          name={hasExactMatch ? 'alert-circle-outline' : 'search-outline'}
          size={18}
          color={hasExactMatch ? colors.warning : colors.primary}
        />
        <View style={styles.headerText}>
          <Text
            style={[
              styles.title,
              { color: hasExactMatch ? colors.warning : colors.primary },
            ]}
          >
            {hasExactMatch
              ? 'Existing product found'
              : 'Similar products found'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {hasExactMatch
              ? 'Open the existing product instead of creating a duplicate.'
              : 'These look close. Open one if you meant an existing product.'}
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        {suggestions.map((suggestion) => (
          <Pressable
            key={suggestion.product.id}
            onPress={() => onOpenProduct(suggestion.product.id)}
            style={[
              styles.item,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.itemCopy}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>
                {suggestion.product.name}
              </Text>
              <Text
                style={[styles.itemMeta, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {suggestion.product.sku || 'No SKU'}
                {suggestion.product.category
                  ? ` • ${suggestion.product.category}`
                  : ''}
              </Text>
            </View>

            <View style={styles.itemAction}>
              {suggestion.isExact ? (
                <Text style={[styles.badge, { color: colors.warning }]}>
                  Exact
                </Text>
              ) : null}
              <Text style={[styles.openText, { color: colors.primary }]}>
                Open
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  list: {
    gap: SPACING.sm,
  },
  item: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  itemCopy: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemMeta: {
    fontSize: 12,
  },
  itemAction: {
    alignItems: 'flex-end',
    gap: 4,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  openText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
