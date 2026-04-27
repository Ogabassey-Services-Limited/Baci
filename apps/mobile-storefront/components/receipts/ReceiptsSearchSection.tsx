import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/Colors';

interface ReceiptsSearchSectionProps {
  colors: {
    background: string;
    border: string;
    card: string;
    text: string;
    textSecondary: string;
  };
  filteredCount: number;
  hasReceipts: boolean;
  onChangeSearchQuery: (query: string) => void;
  onClearSearch: () => void;
  searchQuery: string;
}

export function ReceiptsSearchSection({
  colors,
  filteredCount,
  hasReceipts,
  onChangeSearchQuery,
  onClearSearch,
  searchQuery,
}: ReceiptsSearchSectionProps) {
  if (!hasReceipts) return null;

  return (
    <View
      style={[styles.searchContainer, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.searchInputContainer,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Ionicons
          name="search-outline"
          size={20}
          color={colors.textSecondary}
          accessible={false}
          importantForAccessibility="no"
        />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          accessibilityLabel="Search receipts"
          accessibilityHint="Search by order number, product, or payment status"
          placeholder="Search by order #, product, or status..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={onChangeSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={onClearSearch}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            accessibilityHint="Clears the current search query"
          >
            <Ionicons
              name="close-circle"
              size={20}
              color={colors.textSecondary}
              accessible={false}
              importantForAccessibility="no"
            />
          </Pressable>
        )}
      </View>
      {searchQuery.length > 0 && (
        <Text
          style={[styles.searchResults, { color: colors.textSecondary }]}
          accessibilityLiveRegion="polite"
        >
          {filteredCount} {filteredCount === 1 ? 'receipt' : 'receipts'} found
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm + SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm + SPACING.xs,
    paddingVertical: SPACING.sm + SPACING.xs,
    borderRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.base,
    paddingVertical: 0,
  },
  searchResults: {
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.sm,
    marginLeft: SPACING.xs,
  },
});
