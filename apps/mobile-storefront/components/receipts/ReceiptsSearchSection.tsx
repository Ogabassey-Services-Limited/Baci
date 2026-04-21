import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
            />
          </Pressable>
        )}
      </View>
      {searchQuery.length > 0 && (
        <Text style={[styles.searchResults, { color: colors.textSecondary }]}>
          {filteredCount} {filteredCount === 1 ? 'receipt' : 'receipts'} found
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  searchResults: {
    fontSize: 13,
    marginTop: 8,
    marginLeft: 4,
  },
});
